/* 대시보드: 모듈별 현황 분포 차트 + 최근 14일 활동 차트 + 최근 등록/수정 내역 */

function renderDashboard(container, crudViews) {
  const cardsHtml = crudViews.map((view) => {
    const items = view.store.getAll();
    const labels = MODULE_STATE_LABELS[view.config.key] || {};
    const counts = {};
    items.forEach((it) => {
      const s = badgeStateOf(view.config, it);
      counts[s] = (counts[s] || 0) + 1;
    });
    const total = items.length;
    const states = STATE_ORDER.filter((s) => counts[s]);

    const segs = states.map((s) => `
      <div class="dist-seg" style="flex-grow:${counts[s]};background:${STATE_COLORS[s]}"
        data-tip="${escapeHtml(labels[s] || s)} · ${counts[s]}건" data-route="${view.config.key}" data-state="${s}"></div>`).join('');

    const maxCount = Math.max(1, ...states.map((s) => counts[s]));
    const legend = states.map((s) => `
      <li class="dl-row" data-route="${view.config.key}" data-state="${s}" title="클릭하면 해당 현황만 모아 봅니다">
        <span class="dl-swatch" style="background:${STATE_COLORS[s]}"></span>
        <span class="dl-label">${escapeHtml(labels[s] || s)}</span>
        <span class="dl-track"><span class="dl-fill" style="width:${Math.max(6, Math.round((counts[s] / maxCount) * 100))}%;background:${STATE_COLORS[s]}"></span></span>
        <span class="dl-count">${counts[s]}</span>
      </li>`).join('');

    return `
      <div class="dash-card">
        <div class="dash-card-head" data-route="${view.config.key}">
          <span class="dash-card-icon">${view.config.icon}</span>
          <span class="dash-card-title">${escapeHtml(view.config.shortTitle)}</span>
          <span class="dash-card-total">${total}건</span>
        </div>
        <div class="dist-bar">${total ? segs : ''}</div>
        ${total ? `<ul class="dist-legend">${legend}</ul>` : '<p class="dist-empty">등록된 항목이 없습니다.</p>'}
      </div>`;
  }).join('');

  /* 호실별 현황판: 등록된 모든 호실을 격자로 배치하고 상태를 색으로 표시 */
  const roomStates = buildRoomBoard(crudViews);
  const roomTiles = roomStates.map((r) => `
    <div class="room-tile" style="background:${STATE_COLORS[r.state]}" data-tip="${escapeHtml(r.tip)}" data-room="${escapeHtml(r.no)}">${escapeHtml(r.no)}</div>`).join('');
  const roomLegend = [
    ['red', '연체/긴급'],
    ['yellow', '오늘 퇴실·처리중'],
    ['blue', '재실/입실예정'],
    ['gray', '공실/기타'],
  ].map(([s, label]) => `<span class="room-legend-item"><span class="dl-swatch" style="background:${STATE_COLORS[s]}"></span>${label}</span>`).join('');

  const recent = crudViews.flatMap((view) => view.store.getAll().map((it) => ({
    module: view.config,
    item: it,
  })))
    .sort((a, b) => (b.item.updatedAt || b.item.createdAt || '').localeCompare(a.item.updatedAt || a.item.createdAt || ''))
    .slice(0, 8);

  const recentHtml = recent.length ? recent.map(({ module, item }) => {
    const titleField = module.fields.find((f) => f.searchable) || module.fields[0];
    const label = item[titleField.name] || item.id;
    const badge = module.computeBadge ? module.computeBadge(item) : null;
    const when = formatDateTime(item.updatedAt || item.createdAt);
    return `
      <li class="recent-item" data-route="${module.key}">
        <span class="recent-icon">${module.icon}</span>
        <span class="recent-text"><strong>${escapeHtml(module.shortTitle)}</strong> · ${escapeHtml(label)}</span>
        ${when ? `<span class="recent-time">${escapeHtml(when)}</span>` : ''}
        ${badge ? `<span class="badge ${badge.cls}">${escapeHtml(badge.text)}</span>` : ''}
      </li>`;
  }).join('') : '<li class="recent-empty">최근 등록된 항목이 없습니다.</li>';

  container.innerHTML = `
    <section class="hero">
      <div class="hero-media"></div>
      <div class="hero-inner">
        <p class="hero-kicker">Residential Support Center</p>
        <h2>블루오션 레지던스 호텔 입주지원센터</h2>
        <hr class="hero-rule">
        <p class="hero-sub">㈜블루오션자산관리 · ${escapeHtml(todayStr())} 기준 업무 현황</p>
        <button class="btn btn-report" id="dailyReportBtn">📄 일일업무보고서 PDF</button>
      </div>
    </section>
    <div class="dash-grid">${cardsHtml}</div>
    <div class="dash-bottom">
      <div class="dash-panel">
        <h3>호실별 현황판</h3>
        <div class="room-legend">${roomLegend}</div>
        ${roomStates.length ? `<div class="room-grid">${roomTiles}</div>` : '<p class="dist-empty">등록된 호실이 없습니다. 계약이나 입퇴실을 등록하면 호실이 표시됩니다.</p>'}
      </div>
      <div class="dash-panel">
        <h3>최근 등록/수정</h3>
        <ul class="recent-list">${recentHtml}</ul>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-route]').forEach((el) => {
    el.addEventListener('click', () => {
      /* 현황(범례/막대) 클릭 시 해당 모듈로 이동하면서 그 현황만 필터 */
      if (el.dataset.state) {
        sessionStorage.setItem(`rsc_filter_${el.dataset.route}`, el.dataset.state);
      }
      window.location.hash = `#${el.dataset.route}`;
    });
  });

  container.querySelector('#dailyReportBtn').addEventListener('click', () => openDailyReport(crudViews));

  /* 호실 타일 클릭 → 입퇴실관리에서 해당 호실 검색 */
  container.querySelectorAll('.room-tile').forEach((el) => {
    el.addEventListener('click', () => {
      sessionStorage.setItem('rsc_search_stays', el.dataset.room);
      window.location.hash = '#stays';
    });
  });

  attachVizTips(container);
}

/** 모든 모듈의 호실번호를 모아 호실별 상태(red > yellow > blue > gray)를 계산 */
function buildRoomBoard(crudViews) {
  const byKey = {};
  crudViews.forEach((v) => { byKey[v.config.key] = v; });
  const rooms = new Map();
  const room = (no) => {
    const k = String(no || '').trim();
    if (!k) return null;
    if (!rooms.has(k)) rooms.set(k, { no: k, notes: [], state: 'gray' });
    return rooms.get(k);
  };
  const lift = (r, s) => {
    const rank = { gray: 0, blue: 1, yellow: 2, red: 3 };
    if (rank[s] > rank[r.state]) r.state = s;
  };

  (byKey.contracts ? byKey.contracts.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    const d = daysDiff(it.endDate);
    if (it.status !== '해지' && d !== null && d < 0) r.notes.push('계약 만료경과');
  });

  (byKey.stays ? byKey.stays.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    if (it.actualCheckOutDate) return; /* 퇴실완료 건은 공실 취급 */
    const dIn = daysDiff(it.checkInDate);
    const dOut = daysDiff(it.expectedCheckOutDate);
    const guest = it.guestName ? `(${it.guestName})` : '';
    if (dIn !== null && dIn > 0) { lift(r, 'blue'); r.notes.push(`입실 D-${dIn}${guest}`); return; }
    if (dOut !== null && dOut < 0) { lift(r, 'red'); r.notes.push(`퇴실 연체 ${Math.abs(dOut)}일${guest}`); return; }
    if (dOut === 0) { lift(r, 'yellow'); r.notes.push(`오늘 퇴실예정${guest}`); return; }
    lift(r, 'blue');
    r.notes.push(`재실중${guest}`);
  });

  (byKey.complaints ? byKey.complaints.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    if (it.status === '완료' || it.status === '보류') return;
    lift(r, badgeStateOf(byKey.complaints.config, it) === 'red' ? 'red' : 'yellow');
    r.notes.push(`민원 ${it.status || '접수'}`);
  });

  (byKey.defects ? byKey.defects.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    if (it.status === '완료' || it.status === '보류') return;
    lift(r, badgeStateOf(byKey.defects.config, it) === 'red' ? 'red' : 'yellow');
    r.notes.push(`하자 ${it.status || '접수'}`);
  });

  return [...rooms.values()]
    .map((r) => ({ ...r, tip: `${r.no}호 · ${r.notes.length ? r.notes.join(' · ') : '공실/특이사항 없음'}` }))
    .sort((a, b) => a.no.localeCompare(b.no, 'ko', { numeric: true }));
}

/* ── 일일 업무 보고서: 인쇄 전용 화면을 만들고 브라우저 인쇄(PDF 저장)를 연다 ── */

function openDailyReport(crudViews) {
  const today = todayStr();

  const summaryRows = crudViews.map((view) => {
    const items = view.store.getAll();
    const labels = MODULE_STATE_LABELS[view.config.key] || {};
    const counts = {};
    items.forEach((it) => {
      const s = badgeStateOf(view.config, it);
      counts[s] = (counts[s] || 0) + 1;
    });
    const parts = STATE_ORDER.filter((s) => counts[s]).map((s) => `${labels[s] || s} ${counts[s]}건`).join(' · ');
    return `<tr>
      <td>${escapeHtml(view.config.shortTitle)}</td>
      <td class="rp-num">${items.length}</td>
      <td>${parts || '-'}</td>
    </tr>`;
  }).join('');

  const itemRow = (view, it) => {
    /* 내용 칸에는 호실번호가 아닌 이름/제목 성격의 필드를 우선 사용 */
    const tf = view.config.fields.find((f) => f.searchable && f.name !== 'unitNo')
      || view.config.fields.find((f) => f.searchable) || view.config.fields[0];
    const b = view.config.computeBadge ? view.config.computeBadge(it) : null;
    return `<tr>
      <td>${escapeHtml(view.config.shortTitle)}</td>
      <td>${escapeHtml(it.unitNo || '-')}</td>
      <td>${escapeHtml(it[tf.name] || it.id)}</td>
      <td>${b ? escapeHtml(b.text) : '-'}</td>
    </tr>`;
  };

  const todayRows = crudViews.flatMap((view) => view.store.getAll()
    .filter((it) => (it.updatedAt || it.createdAt || '').slice(0, 10) === today)
    .map((it) => itemRow(view, it)));

  const urgentRows = crudViews.flatMap((view) => view.store.getAll()
    .filter((it) => badgeStateOf(view.config, it) === 'red')
    .map((it) => itemRow(view, it)));

  const itemsTable = (rows) => `
    <table class="rp-table">
      <thead><tr><th>구분</th><th>호실</th><th>내용</th><th>현황</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;

  let root = document.getElementById('printRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'printRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="report">
      <div class="rp-head">
        <h1>일일 업무 보고서</h1>
        <p>㈜블루오션자산관리 입주지원센터</p>
      </div>
      <table class="rp-meta">
        <tr>
          <th>보고일자</th><td>${escapeHtml(today)}</td>
          <th>작성자</th><td></td>
          <th>확인</th><td></td>
        </tr>
      </table>
      <h2>1. 업무 현황 요약</h2>
      <table class="rp-table">
        <thead><tr><th>구분</th><th>전체</th><th>현황별 건수</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
      <h2>2. 금일 처리 내역 (${todayRows.length}건)</h2>
      ${todayRows.length ? itemsTable(todayRows) : '<p class="rp-empty">금일 등록/수정된 내역이 없습니다.</p>'}
      <h2>3. 긴급/지연 항목 (${urgentRows.length}건)</h2>
      ${urgentRows.length ? itemsTable(urgentRows) : '<p class="rp-empty">긴급 또는 지연 중인 항목이 없습니다.</p>'}
      <div class="rp-sign">
        <div class="rp-sign-box">담당자<span>(인)</span></div>
        <div class="rp-sign-box">관리소장<span>(인)</span></div>
      </div>
      <p class="rp-footnote">본 보고서는 입주지원센터 관리 프로그램에서 ${escapeHtml(today)} 기준으로 자동 생성되었습니다.</p>
    </div>`;

  window.print();
}
