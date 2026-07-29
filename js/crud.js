/* 공통 CRUD 화면 렌더러: 목록/검색/필터/등록/수정/삭제/CSV 내보내기 */

function createCrudView(config) {
  const store = new Store(config.key);
  let state = { search: '', statusFilter: '전체' };

  function filteredItems() {
    let items = store.getAll();
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      const searchFields = config.fields.filter((f) => f.searchable).map((f) => f.name);
      items = items.filter((it) => searchFields.some((name) => String(it[name] ?? '').toLowerCase().includes(q)));
    }
    if (state.statusFilter !== '전체') {
      items = items.filter((it) => it[config.statusField] === state.statusFilter);
    }
    const dir = config.sortDir === 'desc' ? -1 : 1;
    items = [...items].sort((a, b) => {
      const av = a[config.sortField] || '';
      const bv = b[config.sortField] || '';
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    return items;
  }

  function renderToolbar() {
    const statusOpts = ['전체', ...config.statusOptions]
      .map((s) => `<option value="${escapeHtml(s)}" ${state.statusFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`)
      .join('');
    return `
      <div class="toolbar">
        <input type="search" id="searchInput" class="search-input" placeholder="${escapeHtml(config.searchPlaceholder || '검색')}" value="${escapeHtml(state.search)}">
        <select id="statusFilter" class="status-filter">${statusOpts}</select>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-secondary" id="exportCsvBtn">CSV 내보내기</button>
        <button class="btn btn-primary" id="addBtn">+ 신규 등록</button>
      </div>`;
  }

  function renderTable(items) {
    const cols = config.fields.filter((f) => f.listShow);
    if (items.length === 0) {
      return `<div class="empty-state">등록된 항목이 없습니다. "+ 신규 등록" 버튼으로 추가해 보세요.</div>`;
    }
    const head = cols.map((f) => `<th>${escapeHtml(f.label)}</th>`).join('');
    const rows = items.map((it) => {
      const badge = config.computeBadge ? config.computeBadge(it) : null;
      const tds = cols.map((f) => {
        let v = it[f.name];
        if (f.type === 'number') v = formatNumber(v);
        else v = v || '-';
        return `<td data-label="${escapeHtml(f.label)}">${escapeHtml(v)}</td>`;
      }).join('');
      return `
        <tr data-id="${it.id}">
          ${tds}
          <td data-label="현황">${badge ? `<span class="badge ${badge.cls}">${escapeHtml(badge.text)}</span>` : ''}</td>
          <td data-label="작업" class="row-actions">
            <button class="btn-link edit-btn" data-id="${it.id}">수정</button>
            <button class="btn-link danger delete-btn" data-id="${it.id}">삭제</button>
          </td>
        </tr>`;
    }).join('');
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${head}<th>현황</th><th>작업</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderCount(items, total) {
    return `<div class="list-count">전체 ${total}건 중 ${items.length}건 표시</div>`;
  }

  function render(container) {
    const items = filteredItems();
    const total = store.count();
    container.innerHTML = `
      <div class="view-header">
        <h2>${config.icon} ${escapeHtml(config.title)}</h2>
        <p class="view-desc">${escapeHtml(config.description)}</p>
      </div>
      ${renderToolbar()}
      ${renderCount(items, total)}
      ${renderTable(items)}
    `;

    container.querySelector('#searchInput').addEventListener('input', debounce((e) => {
      state.search = e.target.value;
      render(container);
    }, 200));
    container.querySelector('#statusFilter').addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      render(container);
    });
    container.querySelector('#addBtn').addEventListener('click', () => openForm());
    container.querySelector('#exportCsvBtn').addEventListener('click', () => {
      const csv = toCSV(filteredItems(), config.fields);
      downloadFile(`${config.key}_${todayStr()}.csv`, csv, 'text/csv;charset=utf-8');
      showToast('CSV 파일을 내보냈습니다.');
    });
    container.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => openForm(store.get(btn.dataset.id)));
    });
    container.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = store.get(btn.dataset.id);
        const label = item ? (item[config.fields[0].name] || item.id) : btn.dataset.id;
        if (confirm(`'${label}' 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
          store.remove(btn.dataset.id);
          showToast('삭제되었습니다.');
          render(container);
        }
      });
    });
  }

  function fieldInputHtml(f, value) {
    const val = value ?? '';
    const req = f.required ? 'required' : '';
    if (f.type === 'select') {
      const opts = f.options.map((o) => `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
      return `<select name="${f.name}" ${req}><option value="">선택</option>${opts}</select>`;
    }
    if (f.type === 'textarea') {
      return `<textarea name="${f.name}" rows="3" ${req} placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(val)}</textarea>`;
    }
    return `<input type="${f.type}" name="${f.name}" value="${escapeHtml(val)}" ${req} placeholder="${escapeHtml(f.placeholder || '')}">`;
  }

  function openForm(item) {
    const isEdit = !!item;
    const formFields = config.fields.map((f) => `
      <div class="form-row">
        <label>${escapeHtml(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
        ${fieldInputHtml(f, item ? item[f.name] : undefined)}
      </div>`).join('');

    const html = `
      <form id="crudForm">
        <h3>${isEdit ? '수정' : '신규 등록'} · ${escapeHtml(config.title)}</h3>
        <div class="form-grid">${formFields}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="cancelBtn">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>`;

    openModal(html, (modalEl) => {
      modalEl.querySelector('#cancelBtn').addEventListener('click', closeModal);
      modalEl.querySelector('#crudForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {};
        config.fields.forEach((f) => {
          data[f.name] = fd.get(f.name) || '';
        });
        if (isEdit) {
          store.update(item.id, data);
          showToast('수정되었습니다.');
        } else {
          store.add({ id: uid(config.idPrefix), ...data, createdAt: nowISO(), updatedAt: nowISO() });
          showToast('등록되었습니다.');
        }
        closeModal();
        const container = document.getElementById('content');
        if (container) render(container);
      });
    });
  }

  return { config, store, render };
}
