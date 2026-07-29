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
        ${total ? `<ul class="dist-legend">${legend}</ul>` : '<p class="dist-empty">등록된 항목이 없습니다.</p>'}
      </div>`;
  }).join('');

  /* 오늘 업무 호실판: 카테고리(모듈)별로 섹션을 나눠 호실 타일을 정렬 표시 */
  const roomStates = buildRoomBoard(crudViews).filter((r) => r.tasks.length > 0);
  const stateRank = { blue: 1, yellow: 2, red: 3 };
  const sectionData = {};
  crudViews.forEach((view) => {
    const key = view.config.key;
    sectionData[key] = roomStates
      .map((r) => {
        const tasks = r.tasks.filter((t) => t.key === key);
        if (!tasks.length) return null;
        const state = tasks.reduce((s, t) => (stateRank[t.state] > stateRank[s] ? t.state : s), tasks[0].state);
        return { no: r.no, tasks, state };
      })
      .filter(Boolean);
  });
  const sectionsHtml = crudViews.map((view) => {
    const key = view.config.key;
    const rooms = sectionData[key];
    if (!rooms.length) return '';
    const tiles = rooms.map((rm) => `
      <div class="room-tile"
        data-tip="${escapeHtml(`${rm.no}호 · ${summarizeTasks(rm.tasks)}`)}"
        data-key="${key}" data-room="${escapeHtml(rm.no)}">${escapeHtml(rm.no)}</div>`).join('');
    return `
      <div class="room-section">
        <div class="room-section-title">${view.config.icon} ${escapeHtml(view.config.shortTitle)}<span class="room-section-count">${rooms.length}</span></div>
        <div class="room-grid">${tiles}</div>
      </div>`;
  }).join('');

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
        <span class="recent-time">${escapeHtml(when || '-')}</span>
        <span class="recent-icon">${module.icon}</span>
        <span class="recent-text"><strong>${escapeHtml(module.shortTitle)}</strong> · ${escapeHtml(label)}</span>
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
        <h3>오늘 업무가 있는 호실</h3>
        ${roomStates.length ? sectionsHtml : '<p class="dist-empty">오늘 처리할 업무가 있는 호실이 없습니다. 🎉</p>'}
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

  /* 설정에서 업로드한 배경 사진 적용 (없으면 assets/hero.jpg → 그라데이션 순) */
  const heroData = localStorage.getItem('rsc_img_hero');
  if (heroData) {
    container.querySelector('.hero-media').style.backgroundImage = `url(${heroData})`;
  }

  container.querySelector('#dailyReportBtn').addEventListener('click', () => openDailyReport(crudViews));

  /* 호실 타일 클릭 → 해당 카테고리 업무가 1건이면 바로 상세 팝업, 여러 건이면 선택 모달 */
  container.querySelectorAll('.room-tile').forEach((el) => {
    el.addEventListener('click', () => {
      const rooms = sectionData[el.dataset.key] || [];
      const r = rooms.find((x) => x.no === el.dataset.room);
      if (!r || r.tasks.length === 0) return;
      if (r.tasks.length === 1) {
        openRoomTaskDetail(r.tasks[0], null);
        return;
      }
      openRoomTasks(r);
    });
  });

  attachVizTips(container);
}

/** 업무 목록을 짧은 요약 문구로: 같은 문구는 ×N 으로 묶고 최대 3가지만 표시 */
function summarizeTasks(tasks) {
  const counted = new Map();
  tasks.forEach((t) => counted.set(t.text, (counted.get(t.text) || 0) + 1));
  const parts = [...counted.entries()].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n));
  const shown = parts.slice(0, 3);
  const more = parts.length - shown.length;
  return parts.length ? shown.join(' · ') + (more > 0 ? ` 외 ${more}건` : '') : '업무 없음';
}

/** 모든 모듈의 호실번호를 모아 호실별 오늘 업무 목록(모듈 키·건 id·상태 포함)을 계산 */
function buildRoomBoard(crudViews) {
  const byKey = {};
  crudViews.forEach((v) => { byKey[v.config.key] = v; });
  const rooms = new Map();
  const room = (no) => {
    const k = String(no || '').trim();
    if (!k) return null;
    if (!rooms.has(k)) rooms.set(k, { no: k, tasks: [] });
    return rooms.get(k);
  };
  /* 업무 항목: 클릭 시 해당 건 상세를 열 수 있게 모듈 키/id 와 심각도 상태를 함께 기록 */
  const task = (r, key, it, text, state) => r.tasks.push({ key, id: it.id, icon: byKey[key].config.icon, text, state });

  (byKey.contracts ? byKey.contracts.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    const d = daysDiff(it.endDate);
    if (it.status === '해지') return;
    if (d !== null && d < 0) { task(r, 'contracts', it, `계약 만료 ${Math.abs(d)}일 경과`, 'red'); return; }
    if (d === 0) task(r, 'contracts', it, '계약 오늘 만료', 'yellow');
  });

  (byKey.stays ? byKey.stays.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    if (it.actualCheckOutDate) return; /* 퇴실완료 건은 업무 없음 */
    const dIn = daysDiff(it.checkInDate);
    const dOut = daysDiff(it.expectedCheckOutDate);
    const guest = it.guestName ? `(${it.guestName})` : '';
    if (dIn === 0) { task(r, 'stays', it, `오늘 입실예정${guest}`, 'blue'); return; }
    if (dIn !== null && dIn > 0) return; /* 향후 입실 예정: 오늘 업무 아님 */
    if (dOut !== null && dOut < 0) { task(r, 'stays', it, `퇴실 연체 ${Math.abs(dOut)}일${guest}`, 'red'); return; }
    if (dOut === 0) { task(r, 'stays', it, `오늘 퇴실예정${guest}`, 'yellow'); return; }
    /* 단순 재실중: 오늘 처리할 업무가 아니므로 표시하지 않음 */
  });

  (byKey.complaints ? byKey.complaints.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    if (it.status === '완료' || it.status === '보류') return;
    task(r, 'complaints', it, `민원 ${it.status || '접수'}${it.title ? `: ${it.title}` : ''}`,
      badgeStateOf(byKey.complaints.config, it) === 'red' ? 'red' : 'yellow');
  });

  (byKey.defects ? byKey.defects.store.getAll() : []).forEach((it) => {
    const r = room(it.unitNo);
    if (!r) return;
    if (it.status === '완료' || it.status === '보류') return;
    task(r, 'defects', it, `하자 ${it.status || '접수'}${it.content ? `: ${it.content}` : ''}`,
      badgeStateOf(byKey.defects.config, it) === 'red' ? 'red' : 'yellow');
  });

  return [...rooms.values()].sort((a, b) => a.no.localeCompare(b.no, 'ko', { numeric: true }));
}

/** 업무 건의 상세 내용을 대시보드 위 팝업으로 표시 (페이지 이동 없음) */
function openRoomTaskDetail(t, backRoom) {
  const view = crudViews.find((v) => v.config.key === t.key);
  const item = view ? view.store.get(t.id) : null;
  if (!view || !item) { showToast('항목을 찾을 수 없습니다.', 'error'); return; }
  const config = view.config;
  const badge = config.computeBadge ? config.computeBadge(item) : null;
  const rows = config.fields.map((f) => {
    let v = item[f.name];
    if (f.type === 'number') v = formatNumber(v);
    v = (v === undefined || v === null || v === '') ? '-' : String(v);
    return `
      <div class="detail-row${f.type === 'textarea' ? ' detail-row-full' : ''}">
        <dt>${escapeHtml(f.label)}</dt>
        <dd>${escapeHtml(v)}</dd>
      </div>`;
  }).join('');
  const meta = [
    item.createdAt ? `등록 ${formatDateTime(item.createdAt)}` : '',
    item.updatedAt ? `수정 ${formatDateTime(item.updatedAt)}` : '',
  ].filter(Boolean).join(' · ');

  openModal(`
    <div class="detail-head">
      <h3>${escapeHtml(config.shortTitle)} 상세</h3>
      ${badge ? `<span class="badge ${badge.cls}">${escapeHtml(badge.text)}</span>` : ''}
    </div>
    <dl class="detail-grid">${rows}</dl>
    ${meta ? `<p class="detail-meta">${escapeHtml(meta)}</p>` : ''}
    <div class="modal-actions">
      ${backRoom ? '<button type="button" class="btn btn-secondary" id="taskBackBtn">← 목록</button>' : ''}
      <span class="detail-actions-spacer"></span>
      <button type="button" class="btn btn-secondary" id="taskEditBtn">수정하기</button>
      <button type="button" class="btn btn-primary" id="taskCloseBtn">닫기</button>
    </div>`, (modalEl) => {
    modalEl.querySelector('#taskCloseBtn').addEventListener('click', closeModal);
    if (backRoom) {
      modalEl.querySelector('#taskBackBtn').addEventListener('click', () => openRoomTasks(backRoom));
    }
    /* 팝업에서 바로 수정 폼 열기 (저장하면 대시보드가 갱신됨) */
    modalEl.querySelector('#taskEditBtn').addEventListener('click', () => {
      view.openForm(item);
    });
  });
}

/** 호실에 업무가 여러 건이면 선택 모달을 띄운다 */
function openRoomTasks(r) {
  const rows = r.tasks.map((t, i) => `
    <li class="recent-item room-task" data-idx="${i}">
      <span class="recent-icon">${t.icon}</span>
      <span class="recent-text">${escapeHtml(t.text)}</span>
      <span class="room-task-go">›</span>
    </li>`).join('');
  openModal(`
    <div class="detail-head"><h3>${escapeHtml(r.no)}호 · 오늘 업무 ${r.tasks.length}건</h3></div>
    <ul class="recent-list">${rows}</ul>
    <div class="modal-actions">
      <button type="button" class="btn btn-primary" id="roomTasksClose">닫기</button>
    </div>`, (modalEl) => {
    modalEl.querySelector('#roomTasksClose').addEventListener('click', closeModal);
    modalEl.querySelectorAll('.room-task').forEach((li) => {
      li.addEventListener('click', () => {
        openRoomTaskDetail(r.tasks[Number(li.dataset.idx)], r);
      });
    });
  });
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
