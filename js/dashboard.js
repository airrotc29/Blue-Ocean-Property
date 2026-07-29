/* 대시보드: 모듈별 현황 요약 + 최근 등록/수정 내역 */

function renderDashboard(container, crudViews) {
  const cardsHtml = crudViews.map((view) => {
    const items = view.store.getAll();
    const stats = view.config.dashboardStats(items);
    const statHtml = stats.map((s) => `
      <div class="stat ${s.danger ? 'stat-danger' : s.warn ? 'stat-warn' : ''}">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${escapeHtml(s.label)}</div>
      </div>`).join('');
    return `
      <div class="dash-card" data-route="${view.config.key}">
        <div class="dash-card-head">
          <span class="dash-card-icon">${view.config.icon}</span>
          <span class="dash-card-title">${escapeHtml(view.config.title)}</span>
        </div>
        <div class="dash-stats">${statHtml}</div>
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
    return `
      <li class="recent-item" data-route="${module.key}">
        <span class="recent-icon">${module.icon}</span>
        <span class="recent-text"><strong>${escapeHtml(module.shortTitle)}</strong> · ${escapeHtml(label)}</span>
        ${badge ? `<span class="badge ${badge.cls}">${escapeHtml(badge.text)}</span>` : ''}
      </li>`;
  }).join('') : '<li class="recent-empty">최근 등록된 항목이 없습니다.</li>';

  container.innerHTML = `
    <div class="view-header">
      <h2>🏨 블루오션 레지던스 호텔 입주지원센터</h2>
      <p class="view-desc">${escapeHtml(todayStr())} 기준 업무 현황입니다. (㈜블루오션자산관리)</p>
    </div>
    <div class="dash-grid">${cardsHtml}</div>
    <div class="dash-recent">
      <h3>최근 등록/수정</h3>
      <ul class="recent-list">${recentHtml}</ul>
    </div>
  `;

  container.querySelectorAll('[data-route]').forEach((el) => {
    el.addEventListener('click', () => {
      window.location.hash = `#${el.dataset.route}`;
    });
  });
}
