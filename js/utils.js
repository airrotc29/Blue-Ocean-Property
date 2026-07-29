/* 공통 유틸리티 함수 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowISO() {
  return new Date().toISOString();
}

/** YYYY-MM-DD 문자열과 오늘 사이의 일수 차이 (미래=양수, 과거=음수) */
function daysDiff(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - t0) / 86400000);
}

function formatDate(s) {
  return s ? s : '-';
}

function formatNumber(n) {
  if (n === undefined || n === null || n === '') return '-';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString('ko-KR');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(items, fields) {
  const header = fields.map((f) => csvEscape(f.label)).join(',');
  const rows = items.map((it) => fields.map((f) => csvEscape(it[f.name])).join(','));
  return `﻿${[header, ...rows].join('\r\n')}`;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file, 'utf-8');
  });
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ── 현황(배지) 상태 공통 정의: 대시보드 차트와 목록의 현황별 보기가 함께 사용 ── */

/* 차트 색상: 색각이상 검증(validate_palette)을 통과한 조합. 순서도 검증된 인접 순서 */
const STATE_ORDER = ['green', 'blue', 'yellow', 'red', 'gray'];
const STATE_COLORS = {
  green: '#1f7d54',
  blue: '#2b5aa0',
  yellow: '#d19a06',
  red: '#9c2b20',
  gray: '#5d6b85',
};

/* 모듈별 배지 상태 이름 (computeBadge 가 반환하는 badge-* 클래스 기준) */
const MODULE_STATE_LABELS = {
  contracts: { green: '유효', yellow: '만료임박', red: '만료경과', gray: '해지/기타' },
  stays: { blue: '재실/입실예정', yellow: '오늘 퇴실예정', red: '퇴실 연체', gray: '퇴실완료' },
  complaints: { yellow: '처리중', red: '긴급처리 필요', green: '완료', gray: '보류' },
  defects: { yellow: '처리중', red: '긴급처리 필요', green: '완료', gray: '보류' },
};

/** 항목의 현황 상태 키(green/yellow/...)를 계산 */
function badgeStateOf(config, item) {
  if (!config.computeBadge) return 'gray';
  const b = config.computeBadge(item);
  return (b && b.cls ? b.cls : 'badge-gray').replace('badge-', '');
}

/** data-tip 속성이 붙은 요소들에 마우스 추적 툴팁 연결 */
function attachVizTips(root) {
  let tip = document.getElementById('vizTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'vizTip';
    tip.className = 'viz-tip';
    document.body.appendChild(tip);
  }
  root.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mouseenter', () => { tip.textContent = el.dataset.tip; tip.classList.add('show'); });
    el.addEventListener('mousemove', (e) => {
      tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
      tip.style.top = `${e.clientY - 36}px`;
    });
    el.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
}
