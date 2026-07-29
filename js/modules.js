/* 업무 모듈 정의: 분양형 호텔 계약관리 / 장기 숙박객 입퇴실관리 / 입주지원·민원응대 / 하자 접수관리 */

const MODULES = [
  {
    key: 'contracts',
    idPrefix: 'CT',
    title: '분양형 호텔 계약관리',
    shortTitle: '계약관리',
    icon: '📄',
    description: '구분소유자(수분양자) 위탁운영·임대차 계약 현황을 관리합니다.',
    searchPlaceholder: '호실, 계약자명, 연락처로 검색',
    statusField: 'status',
    statusOptions: ['유효', '만료임박', '만료', '해지'],
    sortField: 'endDate',
    sortDir: 'asc',
    fields: [
      { name: 'unitNo', label: '호실번호', type: 'text', required: true, listShow: true, searchable: true, placeholder: '예: 1502' },
      { name: 'contractType', label: '계약구분', type: 'select', options: ['위탁운영계약', '임대차계약', '재계약', '기타'], listShow: true },
      { name: 'ownerName', label: '계약자명(소유자)', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'phone', label: '연락처', type: 'tel', searchable: true, placeholder: '010-0000-0000' },
      { name: 'startDate', label: '계약시작일', type: 'date', listShow: true },
      { name: 'endDate', label: '계약종료일', type: 'date', required: true, listShow: true },
      { name: 'amount', label: '계약금액/위탁료(원)', type: 'number' },
      { name: 'autoRenew', label: '자동갱신', type: 'select', options: ['Y', 'N'] },
      { name: 'status', label: '상태', type: 'select', options: ['유효', '만료임박', '만료', '해지'], listShow: true, required: true },
      { name: 'memo', label: '메모', type: 'textarea' },
    ],
    computeBadge(item) {
      if (item.status === '해지') return { text: '해지', cls: 'badge-gray' };
      const d = daysDiff(item.endDate);
      if (d === null) return { text: '-', cls: 'badge-gray' };
      if (d < 0) return { text: `만료 ${Math.abs(d)}일 경과`, cls: 'badge-red' };
      if (d <= 30) return { text: `만료 D-${d}`, cls: 'badge-yellow' };
      return { text: '유효', cls: 'badge-green' };
    },
    dashboardStats(items) {
      const valid = items.filter((it) => it.status !== '해지' && daysDiff(it.endDate) !== null && daysDiff(it.endDate) >= 0).length;
      const expiringSoon = items.filter((it) => it.status !== '해지' && daysDiff(it.endDate) !== null && daysDiff(it.endDate) >= 0 && daysDiff(it.endDate) <= 30).length;
      const expired = items.filter((it) => it.status !== '해지' && daysDiff(it.endDate) !== null && daysDiff(it.endDate) < 0).length;
      return [
        { label: '유효 계약', value: valid },
        { label: '만료임박(30일)', value: expiringSoon, warn: expiringSoon > 0 },
        { label: '만료(갱신필요)', value: expired, danger: expired > 0 },
      ];
    },
  },

  {
    key: 'stays',
    idPrefix: 'ST',
    title: '장기 숙박객 입퇴실관리',
    shortTitle: '입퇴실관리',
    icon: '🛎️',
    description: '장기 투숙객의 입실/퇴실 일정과 현황을 관리합니다.',
    searchPlaceholder: '호실, 투숙객명, 연락처로 검색',
    statusField: 'status',
    statusOptions: ['예정', '체크인', '연장', '체크아웃완료'],
    sortField: 'checkInDate',
    sortDir: 'desc',
    fields: [
      { name: 'unitNo', label: '호실번호', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'guestName', label: '투숙객명', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'phone', label: '연락처', type: 'tel', searchable: true, placeholder: '010-0000-0000' },
      { name: 'numGuests', label: '인원수', type: 'number' },
      { name: 'checkInDate', label: '입실일', type: 'date', required: true, listShow: true },
      { name: 'expectedCheckOutDate', label: '퇴실예정일', type: 'date', required: true, listShow: true },
      { name: 'actualCheckOutDate', label: '실제퇴실일', type: 'date', listShow: true },
      { name: 'status', label: '상태', type: 'select', options: ['예정', '체크인', '연장', '체크아웃완료'], listShow: true, required: true },
      { name: 'memo', label: '특이사항', type: 'textarea' },
    ],
    computeBadge(item) {
      if (item.actualCheckOutDate) return { text: '퇴실완료', cls: 'badge-gray' };
      const dIn = daysDiff(item.checkInDate);
      if (dIn !== null && dIn > 0) return { text: `입실 D-${dIn}`, cls: 'badge-blue' };
      const dOut = daysDiff(item.expectedCheckOutDate);
      if (dOut === null) return { text: '재실중', cls: 'badge-blue' };
      if (dOut < 0) return { text: `퇴실 연체 ${Math.abs(dOut)}일`, cls: 'badge-red' };
      if (dOut === 0) return { text: '오늘 퇴실예정', cls: 'badge-yellow' };
      return { text: '재실중', cls: 'badge-blue' };
    },
    dashboardStats(items) {
      const staying = items.filter((it) => !it.actualCheckOutDate && daysDiff(it.checkInDate) !== null && daysDiff(it.checkInDate) <= 0).length;
      const checkInToday = items.filter((it) => daysDiff(it.checkInDate) === 0).length;
      const checkOutToday = items.filter((it) => !it.actualCheckOutDate && daysDiff(it.expectedCheckOutDate) === 0).length;
      const overdue = items.filter((it) => !it.actualCheckOutDate && daysDiff(it.expectedCheckOutDate) !== null && daysDiff(it.expectedCheckOutDate) < 0).length;
      return [
        { label: '현재 재실', value: staying },
        { label: '오늘 체크인', value: checkInToday },
        { label: '오늘 체크아웃', value: checkOutToday },
        { label: '퇴실 연체', value: overdue, danger: overdue > 0 },
      ];
    },
  },

  {
    key: 'complaints',
    idPrefix: 'CP',
    title: '입주지원 업무 및 민원 응대',
    shortTitle: '민원응대',
    icon: '📞',
    description: '입주민·투숙객의 문의 및 민원 접수부터 처리까지 관리합니다.',
    searchPlaceholder: '호실, 민원인명, 제목으로 검색',
    statusField: 'status',
    statusOptions: ['접수', '처리중', '완료', '보류'],
    sortField: 'receivedDate',
    sortDir: 'desc',
    fields: [
      { name: 'receivedDate', label: '접수일', type: 'date', required: true, listShow: true },
      { name: 'channel', label: '접수경로', type: 'select', options: ['전화', '방문', '문자/카카오톡', '이메일', '기타'] },
      { name: 'unitNo', label: '호실번호', type: 'text', listShow: true, searchable: true },
      { name: 'name', label: '민원인명', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'phone', label: '연락처', type: 'tel', placeholder: '010-0000-0000' },
      { name: 'category', label: '유형', type: 'select', options: ['시설/설비', '소음', '주차', '청소/위생', '보안', '입주지원', '기타'], listShow: true },
      { name: 'title', label: '제목', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'content', label: '민원 내용', type: 'textarea', required: true },
      { name: 'priority', label: '우선순위', type: 'select', options: ['긴급', '보통', '낮음'] },
      { name: 'status', label: '처리상태', type: 'select', options: ['접수', '처리중', '완료', '보류'], listShow: true, required: true },
      { name: 'assignee', label: '담당자', type: 'text' },
      { name: 'resolution', label: '처리내용/답변', type: 'textarea' },
      { name: 'resolvedDate', label: '처리완료일', type: 'date' },
    ],
    computeBadge(item) {
      if (item.status === '완료') return { text: '완료', cls: 'badge-green' };
      if (item.status === '보류') return { text: '보류', cls: 'badge-gray' };
      const d = daysDiff(item.receivedDate);
      const elapsed = d === null ? null : -d;
      if (elapsed !== null && elapsed >= 3) return { text: `미처리 ${elapsed}일 경과`, cls: 'badge-red' };
      return { text: item.status || '접수', cls: 'badge-yellow' };
    },
    dashboardStats(items) {
      const open = items.filter((it) => it.status !== '완료').length;
      const overdue = items.filter((it) => it.status !== '완료' && it.status !== '보류' && daysDiff(it.receivedDate) !== null && -daysDiff(it.receivedDate) >= 3).length;
      const urgent = items.filter((it) => it.status !== '완료' && it.priority === '긴급').length;
      return [
        { label: '미처리 민원', value: open, warn: open > 0 },
        { label: '3일 이상 지연', value: overdue, danger: overdue > 0 },
        { label: '긴급 민원', value: urgent, danger: urgent > 0 },
      ];
    },
  },

  {
    key: 'defects',
    idPrefix: 'DF',
    title: '하자 요청접수 및 관리',
    shortTitle: '하자관리',
    icon: '🔧',
    description: '호실/공용부 하자 신고 접수부터 보수 완료까지 관리합니다.',
    searchPlaceholder: '호실, 신청인, 내용으로 검색',
    statusField: 'status',
    statusOptions: ['접수', '확인중', '수리중', '완료', '보류'],
    sortField: 'receivedDate',
    sortDir: 'desc',
    fields: [
      { name: 'receivedDate', label: '접수일', type: 'date', required: true, listShow: true },
      { name: 'unitNo', label: '호실번호', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'requester', label: '신청인', type: 'text', required: true, listShow: true, searchable: true },
      { name: 'phone', label: '연락처', type: 'tel', placeholder: '010-0000-0000' },
      { name: 'category', label: '하자유형', type: 'select', options: ['누수', '전기', '냉난방/설비', '마감/도장', '가구/집기', '기타'], listShow: true },
      { name: 'content', label: '하자 내용', type: 'textarea', required: true, searchable: true },
      { name: 'priority', label: '우선순위', type: 'select', options: ['긴급', '보통', '낮음'], listShow: true },
      { name: 'status', label: '처리상태', type: 'select', options: ['접수', '확인중', '수리중', '완료', '보류'], listShow: true, required: true },
      { name: 'assignee', label: '담당업체/담당자', type: 'text' },
      { name: 'completedDate', label: '처리완료일', type: 'date' },
      { name: 'cost', label: '처리비용(원)', type: 'number' },
      { name: 'memo', label: '메모', type: 'textarea' },
    ],
    computeBadge(item) {
      if (item.status === '완료') return { text: '완료', cls: 'badge-green' };
      if (item.status === '보류') return { text: '보류', cls: 'badge-gray' };
      if (item.priority === '긴급') return { text: '긴급 처리필요', cls: 'badge-red' };
      const d = daysDiff(item.receivedDate);
      const elapsed = d === null ? null : -d;
      if (elapsed !== null && elapsed >= 5) return { text: `지연 ${elapsed}일`, cls: 'badge-red' };
      return { text: item.status || '접수', cls: 'badge-yellow' };
    },
    dashboardStats(items) {
      const open = items.filter((it) => it.status !== '완료').length;
      const urgent = items.filter((it) => it.status !== '완료' && it.priority === '긴급').length;
      const delayed = items.filter((it) => it.status !== '완료' && it.status !== '보류' && daysDiff(it.receivedDate) !== null && -daysDiff(it.receivedDate) >= 5).length;
      return [
        { label: '미완료 하자', value: open, warn: open > 0 },
        { label: '긴급 하자', value: urgent, danger: urgent > 0 },
        { label: '5일 이상 지연', value: delayed, danger: delayed > 0 },
      ];
    },
  },
];

function getModule(key) {
  return MODULES.find((m) => m.key === key);
}
