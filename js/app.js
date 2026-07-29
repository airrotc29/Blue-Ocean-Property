/* 앱 초기화, 라우팅, 모달/토스트 공통 UI */

let crudViews = [];

function openModal(html, onMount) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal-box" role="dialog" aria-modal="true">${html}</div>
    </div>`;
  root.querySelector('#modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  document.addEventListener('keydown', escCloseHandler);
  if (onMount) onMount(root);
}

function escCloseHandler(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
  document.removeEventListener('keydown', escCloseHandler);
}

function showToast(message, type) {
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function renderSettings(container) {
  container.innerHTML = `
    <div class="view-header">
      <h2>⚙️ 설정 / 데이터 관리</h2>
      <p class="view-desc">모든 데이터는 이 브라우저에만 저장됩니다. 기기를 바꾸거나 브라우저 데이터를 지우면 사라지므로 주기적으로 백업하세요.</p>
    </div>
    <div class="settings-grid">
      <div class="settings-card">
        <h3>대시보드 배경 사진</h3>
        <p>대시보드 상단 남색 배너의 배경으로 표시할 사진(호텔 전경 등)을 업로드합니다.</p>
        <input type="file" id="heroImgInput" accept="image/*">
        <button class="btn btn-secondary" id="heroImgClear">사진 제거</button>
      </div>
      <div class="settings-card">
        <h3>회사 로고</h3>
        <p>상단 헤더에 표시할 로고 이미지를 업로드합니다. (배경 투명 PNG 권장)</p>
        <input type="file" id="logoImgInput" accept="image/*">
        <button class="btn btn-secondary" id="logoImgClear">로고 제거</button>
      </div>
      <div class="settings-card">
        <h3>전체 데이터 백업</h3>
        <p>계약/입퇴실/민원/하자 데이터를 JSON 파일 하나로 내려받습니다.</p>
        <button class="btn btn-primary" id="backupBtn">백업 파일 다운로드</button>
      </div>
      <div class="settings-card">
        <h3>백업 파일 복원</h3>
        <p>이전에 내려받은 백업(JSON) 파일을 불러와 복원합니다. 현재 데이터는 덮어씌워집니다.</p>
        <input type="file" id="restoreInput" accept="application/json">
      </div>
      <div class="settings-card">
        <h3>샘플 데이터로 체험하기</h3>
        <p>기능을 미리 확인할 수 있도록 예시 데이터를 채워 넣습니다.</p>
        <button class="btn btn-secondary" id="seedBtn">샘플 데이터 채우기</button>
      </div>
      <div class="settings-card">
        <h3>전체 초기화</h3>
        <p>모든 모듈의 데이터를 삭제합니다. 되돌릴 수 없으니 백업 후 진행하세요.</p>
        <button class="btn btn-danger" id="resetBtn">전체 데이터 삭제</button>
      </div>
    </div>
  `;

  const bindImageSlot = (inputId, clearId, key, maxW, label) => {
    container.querySelector(inputId).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataURL(file, maxW);
        localStorage.setItem(key, dataUrl);
        applyBrandLogo();
        showToast(`${label}을(를) 저장했습니다. 대시보드에서 확인하세요.`);
      } catch (err) {
        console.error(err);
        showToast(`${label} 저장에 실패했습니다. 더 작은 이미지로 시도해 주세요.`, 'error');
      }
      e.target.value = '';
    });
    container.querySelector(clearId).addEventListener('click', () => {
      localStorage.removeItem(key);
      applyBrandLogo();
      showToast(`${label}을(를) 제거했습니다.`);
    });
  };
  bindImageSlot('#heroImgInput', '#heroImgClear', 'rsc_img_hero', 1600, '배경 사진');
  bindImageSlot('#logoImgInput', '#logoImgClear', 'rsc_img_logo', 512, '로고');

  container.querySelector('#backupBtn').addEventListener('click', () => {
    const payload = { exportedAt: nowISO(), data: {} };
    crudViews.forEach((v) => { payload.data[v.config.key] = v.store.getAll(); });
    downloadFile(`입주지원센터_백업_${todayStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    showToast('백업 파일을 다운로드했습니다.');
  });

  container.querySelector('#restoreInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      const data = parsed.data || parsed;
      if (!confirm('현재 저장된 모든 데이터가 백업 파일 내용으로 대체됩니다. 계속할까요?')) {
        e.target.value = '';
        return;
      }
      crudViews.forEach((v) => {
        if (Array.isArray(data[v.config.key])) {
          v.store.saveAll(data[v.config.key]);
        }
      });
      showToast('백업 데이터를 복원했습니다.');
      navigate(currentRoute());
    } catch (err) {
      console.error(err);
      showToast('백업 파일을 읽을 수 없습니다. 파일을 확인해주세요.', 'error');
    }
    e.target.value = '';
  });

  container.querySelector('#seedBtn').addEventListener('click', () => {
    if (!confirm('샘플 데이터를 추가합니다. 계속할까요?')) return;
    seedSampleData();
    showToast('샘플 데이터를 채워 넣었습니다.');
    navigate('dashboard');
  });

  container.querySelector('#resetBtn').addEventListener('click', () => {
    if (!confirm('정말 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    if (!confirm('마지막 확인입니다. 전체 데이터를 삭제할까요?')) return;
    crudViews.forEach((v) => v.store.saveAll([]));
    showToast('모든 데이터를 삭제했습니다.');
    navigate('dashboard');
  });
}

function seedSampleData() {
  const t = todayStr();
  const shift = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const seeds = {
    contracts: [
      { unitNo: '1502', contractType: '위탁운영계약', ownerName: '김민수', phone: '010-1234-5678', startDate: shift(-300), endDate: shift(20), amount: 1500000, autoRenew: 'Y', status: '유효', memo: '' },
      { unitNo: '2108', contractType: '임대차계약', ownerName: '이영희', phone: '010-2222-3333', startDate: shift(-400), endDate: shift(-10), amount: 1200000, autoRenew: 'N', status: '만료', memo: '재계약 협의 중' },
      { unitNo: '905', contractType: '위탁운영계약', ownerName: '박준형', phone: '010-4444-5555', startDate: shift(-60), endDate: shift(300), amount: 1600000, autoRenew: 'Y', status: '유효', memo: '' },
    ],
    stays: [
      { unitNo: '1502', guestName: '홍길동', phone: '010-9999-1111', numGuests: 2, checkInDate: shift(-3), expectedCheckOutDate: shift(0), actualCheckOutDate: '', status: '체크인', memo: '' },
      { unitNo: '2108', guestName: '최수진', phone: '010-8888-2222', numGuests: 1, checkInDate: shift(-10), expectedCheckOutDate: shift(-2), actualCheckOutDate: '', status: '체크인', memo: '연장 문의 있음' },
      { unitNo: '905', guestName: '정다은', phone: '010-7777-3333', numGuests: 3, checkInDate: shift(1), expectedCheckOutDate: shift(7), actualCheckOutDate: '', status: '예정', memo: '' },
    ],
    complaints: [
      { receivedDate: shift(-1), channel: '전화', unitNo: '1502', name: '김민수', phone: '010-1234-5678', category: '소음', title: '야간 소음 민원', content: '옆호실 소음이 심합니다.', priority: '보통', status: '처리중', assignee: '센터장', resolution: '', resolvedDate: '' },
      { receivedDate: shift(-5), channel: '방문', unitNo: '2108', name: '이영희', phone: '010-2222-3333', category: '주차', title: '주차공간 부족 문의', content: '방문객 주차공간 안내 요청', priority: '낮음', status: '완료', assignee: '센터장', resolution: '방문객 주차 안내문 발송 완료', resolvedDate: shift(-4) },
    ],
    defects: [
      { receivedDate: shift(-2), unitNo: '905', requester: '박준형', phone: '010-4444-5555', category: '누수', content: '욕실 천장 누수 발생', priority: '긴급', status: '수리중', assignee: '설비팀 김기사', completedDate: '', cost: '', memo: '' },
      { receivedDate: shift(-8), unitNo: '1502', requester: '김민수', phone: '010-1234-5678', category: '전기', content: '콘센트 작동 불량', priority: '보통', status: '완료', assignee: '전기팀 이기사', completedDate: shift(-6), cost: 30000, memo: '' },
    ],
  };

  crudViews.forEach((v) => {
    const existing = v.store.getAll();
    const additions = (seeds[v.config.key] || []).map((d) => ({
      id: uid(v.config.idPrefix), ...d, createdAt: nowISO(), updatedAt: nowISO(),
    }));
    v.store.saveAll([...existing, ...additions]);
  });
}

function currentRoute() {
  const hash = window.location.hash.replace('#', '');
  const valid = ['dashboard', 'settings', ...MODULES.map((m) => m.key)];
  return valid.includes(hash) ? hash : 'dashboard';
}

function navigate(route) {
  window.location.hash = `#${route}`;
}

function renderRoute() {
  const route = currentRoute();
  const container = document.getElementById('content');
  document.querySelectorAll('#nav button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
  document.getElementById('nav').classList.remove('open');

  if (route === 'dashboard') {
    renderDashboard(container, crudViews);
  } else if (route === 'settings') {
    renderSettings(container);
  } else {
    const view = crudViews.find((v) => v.config.key === route);
    if (view) view.render(container);
  }
}

function initNav() {
  const nav = document.getElementById('nav');
  const navItems = [
    { key: 'dashboard', label: '📊 대시보드' },
    ...MODULES.map((m) => ({ key: m.key, label: `${m.icon} ${m.shortTitle}` })),
    { key: 'settings', label: '⚙️ 설정' },
  ];
  nav.innerHTML = navItems.map((n) => `<button data-route="${n.key}">${n.label}</button>`).join('');
  nav.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('open');
  });
}

let defaultBrandMarkHtml = '';

/** 업로드한 로고가 있으면 헤더 마크를 교체, 없으면 기본 SVG 로 복원 */
function applyBrandLogo() {
  const mark = document.querySelector('.brand-mark');
  if (!mark) return;
  const data = localStorage.getItem('rsc_img_logo');
  if (data) {
    const img = document.createElement('img');
    img.src = data;
    img.alt = '회사 로고';
    img.className = 'brand-logo-img';
    mark.replaceChildren(img);
  } else if (defaultBrandMarkHtml) {
    mark.innerHTML = defaultBrandMarkHtml;
  }
}

function init() {
  crudViews = MODULES.map((m) => createCrudView(m));
  const mark = document.querySelector('.brand-mark');
  if (mark) defaultBrandMarkHtml = mark.innerHTML;
  applyBrandLogo();
  initNav();
  window.addEventListener('hashchange', renderRoute);
  renderRoute();

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
