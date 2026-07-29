/* localStorage 기반 데이터 저장소 */

class Store {
  constructor(key) {
    this.key = `rsc_${key}`;
  }

  getAll() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('저장소 읽기 오류', this.key, e);
      return [];
    }
  }

  saveAll(list) {
    localStorage.setItem(this.key, JSON.stringify(list));
  }

  get(id) {
    return this.getAll().find((it) => it.id === id) || null;
  }

  add(item) {
    const list = this.getAll();
    list.push(item);
    this.saveAll(list);
    return item;
  }

  update(id, patch) {
    const list = this.getAll();
    const idx = list.findIndex((it) => it.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, updatedAt: nowISO() };
    this.saveAll(list);
    return list[idx];
  }

  remove(id) {
    const list = this.getAll().filter((it) => it.id !== id);
    this.saveAll(list);
  }

  count() {
    return this.getAll().length;
  }
}
