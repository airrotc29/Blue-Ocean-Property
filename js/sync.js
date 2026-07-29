/* 기기 간 데이터 동기화: 비공개 GitHub 저장소에 데이터 파일을 올리고 받는다.
   - 앱을 열 때 자동으로 받아오고(최신이면), 데이터를 수정하면 몇 초 뒤 자동으로 올린다.
   - 설정 → 클라우드 동기화 카드에서 연결한다. (GitHub 아이디 / 비공개 저장소 / 토큰) */

const SYNC_CONFIG_KEY = 'rsc_sync_config';
const SYNC_FILE_PATH = 'data/backup.json';

function getSyncConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || 'null');
    return cfg && cfg.owner && cfg.repo && cfg.token ? cfg : null;
  } catch (e) {
    return null;
  }
}

function saveSyncConfig(cfg) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
}

function clearSyncConfig() {
  localStorage.removeItem(SYNC_CONFIG_KEY);
}

/* UTF-8 문자열 ↔ base64 (GitHub contents API 형식) */
function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUtf8(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

async function ghFetch(cfg, path, options) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      ...(options && options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  return res;
}

/** 저장소 접근 확인. 성공 시 true, 실패 시 이유 문자열 반환 */
async function syncTestConnection(cfg) {
  try {
    const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}`);
    if (res.status === 404) return '저장소를 찾을 수 없습니다. 아이디/저장소 이름과 토큰 권한을 확인해주세요.';
    if (res.status === 401 || res.status === 403) return '토큰이 올바르지 않거나 권한이 없습니다.';
    if (!res.ok) return `GitHub 응답 오류 (${res.status})`;
    const info = await res.json();
    if (!info.private) return '⚠️ 공개 저장소입니다! 개인정보 보호를 위해 반드시 비공개(Private) 저장소를 사용하세요.';
    return true;
  } catch (e) {
    return '네트워크 오류로 GitHub에 연결하지 못했습니다.';
  }
}

async function syncGetRemoteFile(cfg) {
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${SYNC_FILE_PATH}?t=${Date.now()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub 읽기 실패 (${res.status})`);
  return res.json();
}

function collectSyncPayload() {
  const payload = { exportedAt: nowISO(), data: {} };
  crudViews.forEach((v) => { payload.data[v.config.key] = v.store.getAll(); });
  return payload;
}

function applySyncPayload(payload) {
  const data = payload.data || {};
  crudViews.forEach((v) => {
    if (Array.isArray(data[v.config.key])) v.store.saveAll(data[v.config.key], { silent: true });
  });
}

function setSyncStatusText(text) {
  localStorage.setItem('rsc_sync_status', text);
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = text;
}

/** 클라우드에서 받아와서 원격이 더 최신이면 적용. 적용했으면 true */
async function syncPull(opts) {
  const cfg = getSyncConfig();
  if (!cfg) return false;
  const file = await syncGetRemoteFile(cfg);
  if (!file) {
    if (!(opts && opts.quiet)) showToast('클라우드에 아직 데이터가 없습니다. "지금 올리기"를 먼저 해주세요.');
    return false;
  }
  const payload = JSON.parse(b64DecodeUtf8(String(file.content || '').replace(/\n/g, '')));
  const localMod = localStorage.getItem('rsc_last_modified') || '';
  if ((payload.exportedAt || '') > localMod) {
    applySyncPayload(payload);
    localStorage.setItem('rsc_last_modified', payload.exportedAt || nowISO());
    setSyncStatusText(`마지막 동기화(받음): ${formatDateTime(nowISO())}`);
    return true;
  }
  return false;
}

/** 현재 데이터를 클라우드에 업로드 (충돌 시 1회 재시도) */
async function syncPush(retry) {
  const cfg = getSyncConfig();
  if (!cfg) return false;
  const payload = collectSyncPayload();
  const existing = await syncGetRemoteFile(cfg);
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}/contents/${SYNC_FILE_PATH}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `데이터 동기화 ${payload.exportedAt}`,
      content: b64EncodeUtf8(JSON.stringify(payload, null, 2)),
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });
  if (res.status === 409 && !retry) return syncPush(true);
  if (!res.ok) throw new Error(`GitHub 쓰기 실패 (${res.status})`);
  localStorage.setItem('rsc_last_modified', payload.exportedAt);
  setSyncStatusText(`마지막 동기화(올림): ${formatDateTime(nowISO())}`);
  return true;
}

/* 데이터가 바뀌면 4초 뒤 자동 업로드 (연속 수정은 한 번으로 묶임) */
let syncPushTimer = null;
function scheduleSyncPush() {
  if (!getSyncConfig()) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => {
    syncPush().catch((e) => {
      console.error(e);
      setSyncStatusText('자동 업로드 실패 — 네트워크 연결 후 설정에서 "지금 올리기"를 눌러주세요.');
    });
  }, 4000);
}

/** 앱 시작 시: 클라우드가 더 최신이면 받아와서 화면 갱신 */
function syncOnStartup() {
  if (!getSyncConfig()) return;
  syncPull({ quiet: true }).then((changed) => {
    if (changed) {
      renderRoute();
      showToast('다른 기기의 최신 데이터를 불러왔습니다.');
    }
  }).catch((e) => console.error('동기화 실패', e));
}
