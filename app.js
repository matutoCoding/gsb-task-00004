/* ===== 合同条款评审看板（纯前端 / localStorage） ===== */
const STORE_KEY = 'contract_review_board_v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nowISO = () => new Date().toISOString();
const D = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const isOverdue = v => v && v.deadline && new Date().toISOString().slice(0, 10) > v.deadline;
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#4f46e5', '#ca8a04'];
const colorOf = id => AVATAR_COLORS[(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initials = name => name.slice(0, 1);
const avatarHTML = (p, cls = '') => `<span class="avatar ${cls}" style="background:${colorOf(p.id)}">${esc(initials(p.name))}</span>`;

let state = null;

/* ---------- 演示数据 ---------- */
function seedState() {
  const people = [
    { id: 'p1', name: '李雯', role: '法务' },
    { id: 'p2', name: '周凯', role: '业务部门' },
    { id: 'p3', name: '陈静', role: '财务' },
    { id: 'p4', name: '王磊', role: '采购' },
    { id: 'p5', name: '赵宁', role: '审计' },
  ];
  const versions = [
    { id: 'v1', name: 'V1', createdAt: '2026-09-10T09:00:00+08:00', deadline: '2026-09-14', note: '对方初稿' },
    { id: 'v2', name: 'V2', createdAt: '2026-09-18T09:00:00+08:00', deadline: '2026-09-24', note: '业务反馈后修订版' },
  ];
  const mk = (no, title, t1, t2, deps = []) => ({
    id: 'c' + no, no, title, deps,
    texts: { v1: t1, v2: t2 ?? t1 }, decision: null, history: [],
  });
  const clauses = [
    mk(1, '付款方式',
      '合同签订后甲方预付30%货款，货到后30日内支付剩余70%。',
      '合同签订后甲方预付20%货款，到货验收合格后30日内支付80%余款。'),
    mk(2, '验收标准',
      '货物到厂后由甲方自行验收，验收期为15日。',
      '货物到厂后由甲方初验，初验签字即视为验收合格，异议期7日。'),
    mk(3, '违约责任',
      '一方违约应赔偿对方因此遭受的全部损失。',
      '一方违约应赔偿对方直接损失，赔偿上限为合同总额的20%。', ['c2']),
    mk(4, '保密期限',
      '双方对合同内容负有保密义务，期限为合同终止后2年。',
      '双方对合同内容及技术资料负有保密义务，期限为合同终止后3年。'),
    mk(5, '知识产权',
      '履行合同产生的知识产权归甲方所有。',
      '履行合同产生的知识产权归甲方所有，乙方保留背景技术的权利。'),
    mk(6, '争议解决',
      '因本合同产生的争议提交甲方所在地人民法院诉讼解决。',
      '因本合同产生的争议先协商，协商不成提交甲方所在地仲裁委员会仲裁。', ['c2']),
  ];
  const op = (id, clauseId, versionId, personId, kind, proposal, reason, at, extra = {}) =>
    ({ id, clauseId, versionId, personId, kind, proposal: proposal || '', reason: reason || '', at, ...extra });
  const opinions = [
    // 第1条：李雯前后两版不一致；当前版有反对
    op('o101', 'c1', 'v1', 'p1', 'modify', '预付10%，验收后付80%，质保期满付10%。', '质保金能约束售后。', '2026-09-11T10:00:00+08:00'),
    op('o102', 'c1', 'v1', 'p2', 'modify', '建议按季度分四期付款。', '与对方现金流安排匹配。', '2026-09-11T14:00:00+08:00'),
    op('o103', 'c1', 'v2', 'p1', 'modify', '预付20%，到货验收合格后付80%。', '对方资金压力大，法务重新评估后让步。', '2026-09-18T15:00:00+08:00'),
    op('o104', 'c1', 'v2', 'p3', 'object', '建议预付不超过10%。', '20%预付款占公司现金流比例过高，且无担保。', '2026-09-19T09:30:00+08:00'),
    op('o105', 'c1', 'v2', 'p4', 'approve', '', '同意V2表述。', '2026-09-19T11:00:00+08:00'),
    // 第2条：完全冲突 → 冻结；v1 有一条挂起意见
    op('o201', 'c2', 'v1', 'p2', 'modify', '验收应由双方共同签字确认，验收期10日。', '单方验收对我方不利。', '2026-09-11T16:00:00+08:00'),
    op('o202', 'c2', 'v2', 'p4', 'modify', '以甲方初验签字为准，7日内提出书面异议。', '初验效率高，符合采购惯例。', '2026-09-18T16:00:00+08:00', { conflictTag: 'c2acc' }),
    op('o203', 'c2', 'v2', 'p2', 'object', '验收必须以第三方检测报告为准，不能只靠初验签字。', '设备质量需要中立检测，初验不能替代。', '2026-09-19T10:00:00+08:00', { conflictTag: 'c2acc' }),
    // 第4条：已定稿（采纳）
    op('o401', 'c4', 'v2', 'p1', 'modify', '保密义务覆盖合同内容及技术资料，期限延长至合同终止后3年。', '技术资料泄露风险更高。', '2026-09-18T17:00:00+08:00'),
    op('o402', 'c4', 'v2', 'p2', 'approve', '', '3年可以接受。', '2026-09-19T09:00:00+08:00'),
    // 第5条：待定，有催办与跳过
    op('o501', 'c5', 'v2', 'p3', 'modify', '新增：背景技术仍归乙方所有，甲方仅获得使用许可。', '避免误伤乙方已有专利。', '2026-09-19T10:30:00+08:00'),
    op('o502', 'c5', 'v2', 'p4', 'approve', '', '认可财务这条修改。', '2026-09-19T11:20:00+08:00'),
  ];
  const conflicts = [
    { id: 'cf1', clauseId: 'c2', versionId: 'v2', a: 'o203', b: 'o202', status: 'frozen', frozenAt: '2026-09-19T10:05:00+08:00', resolution: null },
  ];
  const rulings = [
    { id: 'ru1', clauseId: 'c1', personId: 'p1', status: 'pending', raisedAt: '2026-09-19T12:00:00+08:00', decision: null },
  ];
  // 第4条已定稿
  clauses[3].decision = {
    type: 'adopt', opIds: ['o401'], mergedText: '双方对合同内容及技术资料负有保密义务，期限为合同终止后3年。',
    rationale: '采纳法务意见，3年保密期与公司其他合同一致。', by: 'p1', at: '2026-09-20T10:00:00+08:00',
  };
  opinions.filter(o => o.clauseId === 'c4').forEach(o => { o.consumed = true; o.consumedHow = o.id === 'o401' ? 'picked' : 'rejected'; o.consumedReason = o.id === 'o401' ? '' : '定稿采纳李雯意见，本条无异议空间。'; });
  const reminders = [
    { id: 'r1', clauseId: 'c5', versionId: 'v2', personId: 'p1', type: 'remind', by: 'p1', at: '2026-09-20T09:00:00+08:00', note: '临近截止，请今天反馈。' },
    { id: 'r2', clauseId: 'c5', versionId: 'v2', personId: 'p5', type: 'skip', by: 'p1', at: '2026-09-20T09:05:00+08:00', note: '审计本周出差，先跳过并记录，回来补。' },
  ];
  const activities = [
    { id: 'a0', type: 'freeze', text: '<b>李雯</b>对第1条的意见在 V1、V2 两版不一致，已提交<b>评审组裁定以哪次为准</b>。', at: '2026-09-19T12:00:00+08:00' },
    { id: 'a1', type: 'freeze', text: '第2条因<b>周凯（反对）</b>与<b>王磊（修改）</b>意见完全冲突，已<b>冻结</b>；依赖它的第3、6条已连带标记。', at: '2026-09-19T10:05:00+08:00' },
    { id: 'a2', type: 'decide', text: '第4条定稿：<b>采纳李雯的修改</b>（保密期延长至3年）。', at: '2026-09-20T10:00:00+08:00' },
    { id: 'a3', type: 'remind', text: '已催办<b>李雯</b>对第5条反馈；<b>赵宁</b>暂未回复，已<b>跳过并记录</b>。', at: '2026-09-20T09:05:00+08:00' },
    { id: 'a4', type: 'version', text: '<b>V2</b> 版本导入，V1 未处理完的意见已挂起到对应条款。', at: '2026-09-18T09:00:00+08:00' },
  ];
  return {
    contract: { name: '设备采购合同（2026-Q4）', party: '甲方：星河制造 / 乙方：恒远设备', owner: 'p1' },
    people, versions, currentVersionId: 'v2', clauses, opinions, conflicts,
    rulings, reminders, activities,
    finalized: false, finalizedAt: null,
    ui: { clauseId: 'c1', versionTab: 'current' },
  };
}

function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { state = JSON.parse(raw); return; } } catch (e) {}
  state = seedState(); save();
}
let saveTimer = null;
function save(silent) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  if (!silent) {
    const el = $('#saveState'); if (!el) return;
    el.textContent = '✓ 已自动保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    clearTimeout(saveTimer); saveTimer = setTimeout(() => { el.textContent = ''; }, 2500);
  }
}
function log(type, html) {
  state.activities.unshift({ id: uid('a'), type, text: html, at: nowISO() });
}

/* ---------- 派生查询 ---------- */
const curVer = () => state.versions.find(v => v.id === state.currentVersionId);
const person = id => state.people.find(p => p.id === id);
const clause = id => state.clauses.find(c => c.id === id);
const clauseOps = (cid, vid) => state.opinions.filter(o => o.clauseId === cid && o.versionId === vid);
const activeConflict = cid => state.conflicts.find(cf => cf.clauseId === cid && cf.status === 'frozen');
const ruling = cid => state.rulings.find(r => r.clauseId === cid && r.status === 'pending');

// 某人在某条款上：当前版最新意见 与 之前版本最新未消费意见 是否不一致
function inconsistencyFor(cid, pid) {
  const cur = clauseOps(cid, state.currentVersionId)
    .filter(o => o.personId === pid && !o.consumed)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!cur) return null;
  const older = state.opinions
    .filter(o => o.clauseId === cid && o.personId === pid && o.versionId !== state.currentVersionId && !o.consumed)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!older) return null;
  // 口径：同一人在两版都给出过明确“修改文本”，且文本相反/实质不同（非简单同意/反对分类差异）。
  if (cur.kind !== 'modify' || older.kind !== 'modify') return null;
  if (!cur.proposal.trim() || !older.proposal.trim()) return null;
  if (cur.proposal.trim() === older.proposal.trim()) return null;
  return { older, current: cur };
}
function hasInconsistency(cid) {
  return state.people.some(p => inconsistencyFor(cid, p.id));
}

// 依赖：谁冻结会连带哪些条款 / 本条款被谁连带
function dependentsOf(cid) {
  const out = [];
  const walk = (root, seen) => {
    state.clauses.filter(c => c.deps.includes(root)).forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); out.push(c.id); walk(c.id, seen); }
    });
  };
  walk(cid, new Set([cid]));
  return out;
}
function blockedBy(cid) {
  const chains = [];
  const walk = (node, path) => {
    const c = clause(node);
    for (const d of c.deps || []) {
      const p2 = [...path, d];
      if (activeConflict(d) || state.clauses.find(x => x.id === d)?._hardFreeze) chains.push(p2);
      else walk(d, p2);
    }
  };
  walk(cid, [cid]);
  return chains;
}
function hardFrozenClauses() {
  return state.clauses.filter(c => activeConflict(c.id)).map(c => c.id);
}
function softBlockedClauses() {
  const frozen = new Set(hardFrozenClauses());
  const blocked = new Set();
  frozen.forEach(f => dependentsOf(f).forEach(d => { if (!frozen.has(d)) blocked.add(d); }));
  return [...blocked];
}
const isHardFrozen = cid => !!activeConflict(cid);
const isSoftBlocked = cid => softBlockedClauses().includes(cid);
const isBlocked = cid => isHardFrozen(cid) || isSoftBlocked(cid);
const isPendingRuling = cid => !!ruling(cid);

// 当前版“有效意见”（未消费）
const activeOps = cid => clauseOps(cid, state.currentVersionId).filter(o => !o.consumed);
// 旧版挂起意见：条款未定稿 + 旧版本 + 未消费
const suspendedOps = cid => state.opinions.filter(o =>
  o.clauseId === cid && o.versionId !== state.currentVersionId && !o.consumed);

// 还没在当前版表态的人（已跳过的标注出来）
function pendingPeople(cid) {
  const responded = new Set(clauseOps(cid, state.currentVersionId).map(o => o.personId));
  const skips = new Map();
  state.reminders.filter(r => r.clauseId === cid && r.versionId === state.currentVersionId && r.type === 'skip')
    .forEach(r => skips.set(r.personId, r));
  return state.people.map(p => ({
    person: p, responded: responded.has(p.id), skipped: skips.has(p.id), skipRec: skips.get(p.id),
  }));
}

// 卡点原因（用于总览 / 侧边栏）
function blockReason(cid) {
  const c = clause(cid);
  if (c.decision) return null;
  if (isHardFrozen(cid)) return { level: 'red', text: '意见完全冲突，条款已冻结' };
  if (isSoftBlocked(cid)) {
    const chain = blockedBy(cid)[0] || [];
    const names = chain.filter(id => isHardFrozen(id)).map(id => '第' + clause(id).no + '条');
    return { level: 'red', text: '依赖条款冻结，连带卡住' + (names.length ? '（' + names.join('、') + '）' : '') };
  }
  if (isPendingRuling(cid)) return { level: 'purple', text: '同一人前后意见不一致，待评审组裁定' };
  const misses = pendingPeople(cid).filter(x => !x.responded && !x.skipped);
  const unhandled = activeOps(cid).length + suspendedOps(cid).length;
  if (misses.length) return { level: 'amber', text: `还差 ${misses.map(x => x.person.name).join('、')} 表态` };
  if (unhandled) return { level: 'amber', text: '还有意见未处理' };
  return null;
}

function clauseStatus(c) {
  if (c.decision) return 'done';
  if (isHardFrozen(c.id)) return 'frozen';
  if (isSoftBlocked(c.id)) return 'blocked';
  if (isPendingRuling(c.id)) return 'ruling';
  return 'pending';
}

// 未处理意见（会阻止定稿 / 导出标红）
function unresolvedOps(cid) {
  if (clause(cid).decision) return [];
  return [...activeOps(cid), ...suspendedOps(cid)];
}
function contractBlockers() {
  return state.clauses
    .filter(c => !c.decision)
    .map(c => ({ clause: c, reason: blockReason(c.id) }));
}

/* ---------- 渲染 ---------- */
function render() {
  renderSidebar();
  renderMain();
  renderLog();
  $('#contractTitle').textContent = state.contract.name;
  $('#contractSub').textContent = `${state.contract.party} · 当前版本 ${curVer().name} · 截止 ${curVer().deadline || '未定'}`;
  $('#finalizedBadge').classList.toggle('hidden', !state.finalized);
}

function renderSidebar() {
  const list = $('#clauseList');
  list.innerHTML = state.clauses.slice().sort((a, b) => a.no - b.no).map(c => {
    const st = clauseStatus(c);
    const r = blockReason(c.id);
    const cls = { done: 'dot-done', frozen: 'dot-frozen', blocked: 'dot-frozen', ruling: 'dot-ruling', pending: 'dot-pending' }[st];
    const miss = pendingPeople(c.id).filter(x => !x.responded && !x.skipped).length;
    const meta = c.decision ? '已定稿'
      : isHardFrozen(c.id) ? '冻结'
      : isSoftBlocked(c.id) ? '连带卡住'
      : isPendingRuling(c.id) ? (miss ? `待裁定 · 差${miss}人` : '待裁定')
      : (miss ? `差 ${miss} 人未表态` : '待定稿');
    const extra = st === 'pending' ? ' · ' + activeOps(c.id).length + ' 条意见' : '';
    return `<div class="clause-item ${state.ui.clauseId === c.id ? 'active' : ''}" data-action="pick-clause" data-id="${c.id}">
      <span class="dot ${cls}"></span>
      <div class="ci-body">
        <div class="ci-name">第${c.no}条 · ${esc(c.title)}</div>
        <div class="ci-meta">${esc(meta)}${extra}</div>
      </div>
    </div>`;
  }).join('');
}

function renderLog() {
  $('#activityLog').innerHTML = state.activities.slice(0, 40).map(a =>
    `<div class="log-item log-${a.type}">${a.text}<span class="log-time">${D(a.at)}</span></div>`).join('')
    || '<div class="log-item">暂无记录</div>';
}

function renderMain() {
  const cid = state.ui.clauseId;
  const c = clause(cid);
  const main = $('#mainPane');
  if (!c) { main.innerHTML = '<div class="empty"><div class="big">📄</div>请选择左侧条款</div>'; return; }
  const v = state.ui.versionTab === 'current' ? curVer() : state.versions.find(x => x.id === state.ui.versionTab);
  const isCurrent = v.id === state.currentVersionId;
  const text = c.texts[v.id] ?? Object.values(c.texts).slice(-1)[0];
  main.innerHTML = `${resumeBannerHTML()}${versionTabsHTML(c)}
  <div class="clause-head">
    <div>
      <h2><span class="clause-no">第${c.no}条</span>${esc(c.title)}</h2>
      <div class="clause-tags">${statusTagsHTML(c, isCurrent)}</div>
    </div>
    <div>
      ${isCurrent && !c.decision ? `<button class="btn btn-sm" data-action="edit-text" data-id="${c.id}">✏️ 改条款文字</button><button class="btn btn-sm" data-action="edit-deps" data-id="${c.id}">🔗 依赖条款</button>` : ''}
    </div>
  </div>
  <div class="card">
    <div class="card-title">${esc(v.name)} 条款原文 <span class="sub">${esc(v.note || '')} · ${D(v.createdAt)}</span></div>
    <div class="clause-text">${esc(text)}</div>
    ${depsHTML(c)}
  </div>
  ${isCurrent ? currentVersionHTML(c) : oldVersionHTML(c, v)}`;
  attachOpHandlers(main, c, isCurrent);
}

function resumeBannerHTML() {
  const undecided = state.clauses.find(c => !c.decision && blockReason(c.id));
  if (!undecided) {
    return state.finalized ? '<div class="resume-banner"><div>✅ 合同已定稿，所有条款均有结论。可在导出中查看完整修改对照。</div></div>' : '';
  }
  const r = blockReason(undecided.id);
  return `<div class="resume-banner">
    <div>📌 接着上次：<b>第${undecided.no}条 · ${esc(undecided.title)}</b> 尚未决定（${esc(r?.text || '待处理意见')}）。</div>
    <button class="btn btn-sm btn-primary" data-action="pick-clause" data-id="${undecided.id}">继续处理</button>
  </div>`;
}

function versionTabsHTML(c) {
  return `<div class="ver-tabs">
    ${state.versions.map(v => {
      const active = state.ui.versionTab === 'current' ? v.id === state.currentVersionId : state.ui.versionTab === v.id;
      const old = v.id !== state.currentVersionId;
      return `<button class="ver-tab ${active ? 'active' : ''}" data-action="ver-tab" data-id="${v.id}">${esc(v.name)}${old ? '<span class="ver-old">历史</span>' : ''}</button>`;
    }).join('')}
  </div>`;
}

function statusTagsHTML(c, isCurrent) {
  const tags = [];
  if (c.decision) tags.push('<span class="tag tag-final">✓ 条款已定稿</span>');
  else {
    if (isHardFrozen(c.id)) tags.push('<span class="tag tag-frozen">❄ 已冻结（冲突）</span>');
    if (isSoftBlocked(c.id)) tags.push('<span class="tag tag-blocked">⛔ 连带卡住</span>');
    if (isPendingRuling(c.id)) tags.push('<span class="tag tag-ruling">⚖ 待评审组裁定</span>');
    if (!c.decision && !isBlocked(c.id) && !isPendingRuling(c.id)) tags.push('<span class="tag tag-pending">待定稿</span>');
  }
  const misses = pendingPeople(c.id).filter(x => !x.responded && !x.skipped);
  if (misses.length) tags.push(`<span class="tag tag-pending">差 ${misses.length} 人未表态</span>`);
  if (!isCurrent) tags.push('<span class="tag tag-skip">历史版本只读</span>');
  if (state.finalized) tags.push('<span class="tag tag-final">合同已定稿</span>');
  return tags.join('');
}

function depsHTML(c) {
  if (!c.deps || !c.deps.length) return '';
  return `<div class="dep-line">🔗 依赖：${c.deps.map(id => {
    const d = clause(id);
    const fz = isHardFrozen(id);
    return `<a data-action="pick-clause" data-id="${id}" style="${fz ? 'color:var(--red);font-weight:700' : ''}">第${d.no}条${fz ? '（冻结中）' : ''}</a>`;
  }).join('、')}；上游冻结时本条不能定稿。</div>`;
}

function currentVersionHTML(c) {
  const cid = c.id;
  const cf = activeConflict(cid);
  const rr = ruling(cid);
  let alerts = '';
  if (state.finalized && !c.decision) alerts += alertHTML('alert-finalized', '📝 合同已定稿后又有新意见，需回到评审流程处理本条；此前定稿内容已保留。');
  if (cf) {
    const a = state.opinions.find(o => o.id === cf.a), b = state.opinions.find(o => o.id === cf.b);
    alerts += alertHTML('alert-freeze',
      `❄ <b>条款已冻结</b>：${person(a.personId).name} 与 ${person(b.personId).name} 对本条意见完全冲突，冻结于 ${D(cf.frozenAt)}。冲突解决前本条不能定稿；下游条款也连带卡住。
       <div class="op-actions" style="margin-top:9px">
         <button class="btn btn-sm btn-primary" data-action="resolve-conflict" data-id="${cf.id}">去讨论并解冻</button>
       </div>`);
  }
  if (!cf && isSoftBlocked(cid)) {
    const chain = blockedBy(cid)[0] || [];
    const names = chain.filter(id => isHardFrozen(id)).map(id => `第${clause(id).no}条(${clause(id).title})`).join('、');
    alerts += alertHTML('alert-dep', `⛔ 本条依赖的 <b>${esc(names)}</b> 正处于冻结状态，需先解冻上游，本条才能定稿，避免带着冲突往下走。`);
  }
  if (rr) {
    const inc = inconsistencyFor(cid, rr.personId);
    alerts += alertHTML('alert-ruling',
      `⚖ <b>同一人意见前后不一致，需评审组定以哪次为准</b>：${person(rr.personId).name} 在旧版与当前版提出了不同意见。
       <div class="op-actions" style="margin-top:9px">
         <button class="btn btn-sm btn-primary" data-action="open-ruling" data-id="${rr.id}">评审组裁定</button>
       </div>${inc ? `<div style="margin-top:8px;font-size:12px">旧版：${esc((inc.older.proposal || inc.older.kind))}　→　当前：${esc(inc.current.proposal || inc.current.kind)}</div>` : ''}`);
  }
  if (c.decision) alerts += decisionHTML(c);
  const suspended = suspendedOps(cid);
  const sHTML = suspended.length ? `
  <div class="card">
    <div class="card-title">⏸ 旧版挂起意见 <span class="sub">共 ${suspended.length} 条 · 属于 ${[...new Set(suspended.map(o => state.versions.find(v => v.id === o.versionId)?.name))].join('、')}，不会串到当前版正文</span></div>
    <div class="suspend-list">${suspended.map(opSuspendHTML).join('')}</div>
  </div>` : '';
  return alerts + peopleCardHTML(c) + opinionsCardHTML(c) + sHTML;
}

function alertHTML(cls, body) { return `<div class="alert ${cls}">${body}</div>`; }

function decisionHTML(c) {
  const d = c.decision;
  const label = { adopt: '采纳了一种改法', merge: '合并了两种改法', reject_all: '均不采纳', approve: '直接定稿原文' }[d.type];
  const who = d.by ? person(d.by)?.name : '';
  return `<div class="alert alert-finalized">✅ 本条已定稿：<b>${label}</b>${who ? '（' + esc(who) + ' 决定）' : ''}
    ${d.mergedText ? `<div class="merged-note">定稿文字：${esc(d.mergedText)}</div>` : ''}
    ${d.rationale ? `<div style="margin-top:6px;font-size:12px">理由：${esc(d.rationale)}</div>` : ''}
    <div class="op-actions" style="margin-top:8px">
      <button class="btn btn-sm" data-action="reopen-clause" data-id="${c.id}">↩ 重新讨论本条</button>
    </div>
  </div>`;
}

function peopleCardHTML(c) {
  const rows = pendingPeople(c.id);
  const overdue = isOverdue(curVer());
  return `<div class="card">
    <div class="card-title">本轮表态情况 <span class="sub">${esc(curVer().name)} · 截止 ${esc(curVer().deadline || '未定')}${overdue ? '（已超时）' : ''}</span></div>
    <div class="people-row">
      ${rows.map(x => {
        const p = x.person;
        const lastReminder = state.reminders.filter(r => r.clauseId === c.id && r.versionId === state.currentVersionId && r.personId === p.id)
          .sort((a, b) => b.at.localeCompare(a.at))[0];
        let right = '';
        if (!x.responded && !x.skipped) right = `<span class="mini-act" data-action="remind" data-pid="${p.id}">催一下</span><span class="mini-act warn" data-action="skip" data-pid="${p.id}">先跳过</span>`;
        else if (x.skipped) right = `<span class="mini-act" data-action="undo-skip" data-pid="${p.id}">撤销跳过</span>`;
        const stateTxt = x.responded ? '已表态' : (x.skipped ? '已跳过（待补）' : (overdue ? '超时未回' : '未表态'));
        return `<span class="person-chip ${!x.responded && !x.skipped ? 'miss' : ''} ${x.skipped ? 'skipped' : ''}">
          ${avatarHTML(p)}<span>${esc(p.name)}·${esc(p.role)}</span><span style="color:var(--ink2)">${stateTxt}</span>${right}
        </span>`;
      }).join('')}
    </div>
    ${rows.some(x => x.skipped) ? `<div class="skip-note">⏱ 跳过记录：${rows.filter(x => x.skipped).map(x => {
      const r = x.skipRec;
      return `${x.person.name} ${D(r.at)}${r.note ? '（' + esc(r.note) + '）' : ''}`;
    }).join('；')}</div>` : ''}
  </div>`;
}

function opinionsCardHTML(c) {
  const cid = c.id;
  const ops = clauseOps(cid, state.currentVersionId);
  const cf = activeConflict(cid);
  const sel = state.ui.sel && state.ui.sel[cid] || [];
  const canDecide = !c.decision && !isBlocked(cid) && !isPendingRuling(cid);
  const body = ops.length ? `<div class="op-grid">${ops.map(o => opCardHTML(o, cf, sel.includes(o.id))).join('')}</div>`
    : '<div style="color:var(--ink2);font-size:13px">当前版本暂无意见。</div>';
  const bar = canDecide ? `
    <div class="decision-bar" style="margin-top:13px">
      <span class="hint">勾选后可：</span>
      <button class="btn btn-sm btn-primary" data-action="decide-adopt" ${sel.length !== 1 ? 'disabled' : ''}>采纳选中的一种</button>
      <button class="btn btn-sm" data-action="decide-merge" ${sel.length !== 2 ? 'disabled' : ''}>合并选中的两种</button>
      <button class="btn btn-sm" data-action="decide-reject">都不采纳（写理由）</button>
      <button class="btn btn-sm" data-action="decide-approve" ${ops.length ? '' : ''}>无修改，定稿原文</button>
    </div>` : (c.decision ? '' : `<div class="decision-bar" style="margin-top:13px"><span class="hint">请先处理上方冻结/裁定/连带问题，再做定稿决定。</span></div>`);
  return `<div class="card">
    <div class="card-title">各成员的修改意见（并排） <span class="sub">共 ${ops.length} 条 · 相同改法可只选一种，不同改法可合并</span></div>
    ${body}${bar}
    <div style="margin-top:12px"><button class="btn btn-sm" data-action="add-op" data-id="${cid}">＋ 补充意见</button></div>
  </div>`;
}

const KIND_LABEL = { modify: '建议修改', approve: '同意', object: '反对' };

function opCardHTML(o, cf, selected) {
  const p = person(o.personId);
  const vName = state.versions.find(x => x.id === o.versionId)?.name;
  const inConflict = cf && (cf.a === o.id || cf.b === o.id);
  const inc = inconsistencyFor(o.clauseId, o.personId);
  const flag = inc && inc.current.id === o.id ? '<span class="inconsistent-flag">与本人旧版意见不一致·待裁定</span>' : '';
  const consumed = o.consumed ? `<span class="op-badge ${o.consumedHow === 'picked' ? 'ob-picked' : o.consumedHow === 'merged' ? 'ob-merged' : 'ob-rejected'}">${{ picked: '已采纳', merged: '已合并', rejected: '未采纳' }[o.consumedHow] || '已处理'}</span>` : '';
  const proposal = o.kind === 'approve' ? '<div class="op-reason">未提出文字修改。</div>' : `<div class="op-proposal">${esc(o.proposal)}</div>`;
  const cb = !o.consumed && !activeConflict(o.clauseId) ? `<label style="font-size:12px;display:flex;align-items:center;gap:5px;margin-top:2px"><input type="checkbox" data-opcheck="${o.id}" ${selected ? 'checked' : ''}> 选中这条改法</label>` : '';
  return `<div class="op-card kind-${o.kind} ${inConflict ? 'conflict-a' : ''} ${selected ? 'selected' : ''} ${o.consumed ? 'consumed' : ''}">
    ${consumed}
    <div class="op-head">${avatarHTML(p)}
      <div><div class="op-who">${esc(p.name)}</div><div class="op-role">${esc(p.role)}</div></div>
      <span class="op-kind kind-tag-${o.kind}">${KIND_LABEL[o.kind]}</span>
      <span class="op-time">${vName}<br>${D(o.at)}</span>
    </div>
    ${proposal}
    ${o.reason ? `<div class="op-reason">💬 ${esc(o.reason)}</div>` : ''}
    ${flag}
    ${o.consumedReason ? `<div class="op-reason">处理：${esc(o.consumedReason)}</div>` : ''}
    ${cb}
  </div>`;
}

function opSuspendHTML(o) {
  const p = person(o.personId);
  const vName = state.versions.find(x => x.id === o.versionId)?.name;
  return `<div class="suspend-item">
    <div class="si-top">${avatarHTML(p)}<b>${esc(p.name)}（${esc(p.role)}）</b>
      <span class="op-kind kind-tag-${o.kind}">${KIND_LABEL[o.kind]}</span>
      <span style="color:var(--ink2);font-size:12px">挂自 ${esc(vName)} · ${D(o.at)}</span>
    </div>
    ${o.proposal ? `<div class="op-proposal">${esc(o.proposal)}</div>` : ''}
    ${o.reason ? `<div class="op-reason">💬 ${esc(o.reason)}</div>` : ''}
    <div class="si-actions op-actions">
      <button class="btn btn-sm btn-primary" data-action="suspend-carry" data-id="${o.id}">提到当前版讨论</button>
      <button class="btn btn-sm" data-action="suspend-keep">仅在旧版保留</button>
      <button class="btn btn-sm" data-action="suspend-archive" data-id="${o.id}">确认作废并留痕</button>
    </div>
  </div>`;
}

function oldVersionHTML(c, v) {
  const ops = clauseOps(c.id, v.id);
  const hist = (c.history || []).filter(h => h.versionId === v.id);
  const dec = hist.length ? `<div class="alert alert-finalized">${esc(v.name)} 时${hist[0].type === 'adopt' ? '曾采纳意见定稿' : '曾有定稿结论'}：${esc(hist[0].mergedText || hist[0].rationale || '')}（后续被新版本替代）</div>` : '';
  return `${dec}
  <div class="card">
    <div class="card-title">${esc(v.name)} 意见留痕 <span class="sub">只读 · 共 ${ops.length} 条，未处理意见在当前版显示为“挂起”</span></div>
    ${ops.length ? `<div class="op-grid">${ops.map(o => opCardHTML(o, null, false)).join('')}</div>` : '<div style="color:var(--ink2);font-size:13px">该版本暂无意见记录。</div>'}
  </div>
  <div class="card" style="background:#fafbfc">
    <div class="card-title">说明</div>
    <div style="font-size:13px;color:var(--ink2);line-height:1.8">历史版本的意见固定挂在它所属的版本与条款上，<b>不会串入新版本正文</b>。未处理完的意见，在当前版本对应条款下以“旧版挂起意见”呈现，必须逐条处置（提到当前版 / 仅保留 / 作废留痕），定稿与导出时不得遗漏。</div>
  </div>`;
}

function attachOpHandlers(main, c, isCurrent) {
  if (!isCurrent) return;
  $$('input[data-opcheck]', main).forEach(cb => cb.addEventListener('change', e => {
    const cid = c.id, oid = e.target.dataset.opcheck;
    state.ui.sel = state.ui.sel || {};
    let arr = state.ui.sel[cid] || [];
    arr = e.target.checked ? [...arr, oid].slice(-2) : arr.filter(x => x !== oid);
    state.ui.sel[cid] = arr; save(); renderMain();
  }));
}

/* ---------- 操作动作 ---------- */
function consumeOps(cid, opIds, howMap) {
  clauseOps(cid, state.currentVersionId).forEach(o => {
    if (opIds.includes(o.id)) { o.consumed = true; o.consumedHow = howMap[o.id] || 'picked'; }
  });
}
function finishClause(cid, decision, consumedMap, logHtml) {
  const c = clause(cid);
  // 当前版所有未消费意见必须有交代（默认记为 rejected）
  clauseOps(cid, state.currentVersionId).forEach(o => {
    if (o.consumed) return;
    o.consumed = true;
    o.consumedHow = consumedMap[o.id] || 'rejected';
    o.consumedReason = consumedMap[o.id + '_reason'] || decision.rationale || '随本条定稿处理。';
  });
  c.decision = decision;
  log('decide', logHtml);
  save(); render();
}

function decideAdopt() {
  const cid = state.ui.clauseId, c = clause(cid);
  if (isBlocked(cid) || isPendingRuling(cid) || c.decision) return toast('当前条款尚不能定稿');
  const sel = (state.ui.sel || {})[cid] || [];
  if (sel.length !== 1) return toast('请勾选要采纳的一种改法');
  const o = state.opinions.find(x => x.id === sel[0]);
  openRationale('采纳一种改法', `采纳 <b>${person(o.personId).name}</b> 的修改作为定稿。`, (rationale, finalText) => {
    const map = {};
    map[o.id] = 'picked';
    const text = (finalText || o.proposal || c.texts[state.currentVersionId]).trim();
    c.texts[state.currentVersionId] = text;
    finishClause(cid,
      { type: 'adopt', opIds: [o.id], mergedText: text, rationale, by: state.contract.owner, at: nowISO() },
      map, `第${c.no}条定稿：<b>采纳 ${person(o.personId).name} 的改法</b>。`);
    toast('已采纳并定稿本条');
  }, o.proposal || c.texts[state.currentVersionId]);
}

function decideMerge() {
  const cid = state.ui.clauseId, c = clause(cid);
  if (isBlocked(cid) || isPendingRuling(cid) || c.decision) return;
  const sel = (state.ui.sel || {})[cid] || [];
  if (sel.length !== 2) return toast('请勾选要合并的两种改法');
  const [o1, o2] = sel.map(id => state.opinions.find(x => x.id === id));
  openMerge(o1, o2, (text, rationale) => {
    if (!text.trim()) return toast('请填写合并后的文字');
    c.texts[state.currentVersionId] = text.trim();
    const map = { [o1.id]: 'merged', [o2.id]: 'merged' };
    finishClause(cid,
      { type: 'merge', opIds: sel, mergedText: text.trim(), rationale, by: state.contract.owner, at: nowISO() },
      map, `第${c.no}条定稿：<b>合并 ${person(o1.personId).name}、${person(o2.personId).name} 的两种改法</b>。`);
    toast('已合并并定稿本条');
  });
}

function decideReject() {
  const cid = state.ui.clauseId, c = clause(cid);
  if (isBlocked(cid) || isPendingRuling(cid) || c.decision) return;
  openRationale('均不采纳', '保留条款原文，需要写明不采纳的理由（会随对照导出）。', (rationale) => {
    if (!rationale.trim()) return toast('必须填写不采纳理由');
    finishClause(cid,
      { type: 'reject_all', mergedText: c.texts[state.currentVersionId], rationale, by: state.contract.owner, at: nowISO() },
      {}, `第${c.no}条定稿：<b>所有改法均不采纳</b>，理由：${esc(rationale)}`);
    toast('已记录理由并定稿');
  }, c.texts[state.currentVersionId]);
}

function decideApprove() {
  const cid = state.ui.clauseId, c = clause(cid);
  if (isBlocked(cid) || isPendingRuling(cid) || c.decision) return;
  openRationale('无修改，定稿原文', '确认当前版条款原文即为定稿。', (rationale) => {
    finishClause(cid,
      { type: 'approve', mergedText: c.texts[state.currentVersionId], rationale: rationale || '各方无实质异议。', by: state.contract.owner, at: nowISO() },
      {}, `第${c.no}条定稿：<b>无修改，确认原文</b>。`);
    toast('本条已定稿');
  }, c.texts[state.currentVersionId]);
}

function reopenClause(cid) {
  const c = clause(cid);
  openConfirm('重新讨论本条',
    `回到评审后，<b>第${c.no}条</b>原定稿结论会保存在版本留痕中，不会被冲掉；成员可继续补充意见并重新定稿。${state.finalized ? '<br><br>合同已定稿：本条将单独回到评审，其他条款的定稿状态不变。' : ''}`,
    () => {
      const d = c.decision;
      c.history.push({ ...d, versionId: state.currentVersionId, reopenedAt: nowISO() });
      c.decision = null;
      clauseOps(cid, state.currentVersionId).forEach(o => { o.consumed = false; delete o.consumedHow; delete o.consumedReason; });
      if (state.finalized) log('decide', `合同定稿后，<b>第${c.no}条</b>因新意见回到评审，原定稿内容已留痕保留。`);
      else log('decide', `<b>第${c.no}条</b>重新进入评审，原结论已保留在留痕中。`);
      save(); render(); toast('已回到评审');
    }, '回到评审');
}

/* 催办 / 跳过 */
function remind(pid) {
  const cid = state.ui.clauseId, p = person(pid), c = clause(cid);
  openPrompt('催办反馈', `向 <b>${p.name}（${p.role}）</b> 发送催办，截止 ${curVer().deadline || '未定'}。`, '附言（可选）', note => {
    state.reminders.push({ id: uid('r'), clauseId: cid, versionId: state.currentVersionId, personId: pid, type: 'remind', by: state.contract.owner, at: nowISO(), note: note || '' });
    log('remind', `已催办 <b>${p.name}</b> 对第${c.no}条反馈。${note ? '（' + esc(note) + '）' : ''}`);
    save(); renderMain(); renderLog(); toast('已记录催办');
  });
}
function skipPerson(pid) {
  const cid = state.ui.clauseId, p = person(pid), c = clause(cid);
  openPrompt('先跳过并留记录', `可暂时不等 <b>${p.name}</b>，但必须写明原因；导出对照中会显示“未表态（已跳过）”，不会被略过。`, '跳过原因', note => {
    if (!note.trim()) return toast('请填写跳过原因');
    state.reminders.push({ id: uid('r'), clauseId: cid, versionId: state.currentVersionId, personId: pid, type: 'skip', by: state.contract.owner, at: nowISO(), note: note.trim() });
    log('remind', `<b>${p.name}</b> 对第${c.no}条暂未回复，<b>先跳过</b>（${esc(note.trim())}）。`);
    save(); render(); toast('已跳过并记录');
  });
}
function undoSkip(pid) {
  const cid = state.ui.clauseId;
  const recs = state.reminders.filter(r => r.clauseId === cid && r.versionId === state.currentVersionId && r.personId === pid && r.type === 'skip');
  recs.forEach(r => r.undone = true);
  state.reminders = state.reminders.filter(r => !r.undone);
  log('remind', `撤销对 <b>${person(pid).name}</b> 的跳过，继续等待其对第${clause(cid).no}条表态。`);
  save(); render();
}

/* 冲突冻结与解冻 */
function detectAndFreezeConflicts() {
  // 同一当前版、同一条款：带相同 conflictTag 且立场对立（object vs modify，或两 modify 标记冲突）
  const ops = activeOps(state.ui.clauseId);
  const tags = {};
  ops.forEach(o => { if (o.conflictTag) (tags[o.conflictTag] = tags[o.conflictTag] || []).push(o); });
  Object.values(tags).forEach(group => {
    const opposing = group.filter(o => o.kind === 'object' || o.kind === 'modify');
    const hasObj = opposing.some(o => o.kind === 'object');
    if (opposing.length >= 2 && (hasObj || group.length >= 2)) {
      const a = opposing.find(o => o.kind === 'object') || opposing[0];
      const b = opposing.find(o => o.id !== a.id);
      if (b && !state.conflicts.some(cf => cf.clauseId === a.clauseId && cf.status === 'frozen' &&
        [cf.a, cf.b].includes(a.id) && [cf.a, cf.b].includes(b.id))) {
        state.conflicts.push({ id: uid('cf'), clauseId: a.clauseId, versionId: state.currentVersionId, a: a.id, b: b.id, status: 'frozen', frozenAt: nowISO(), resolution: null });
        const c = clause(a.clauseId);
        log('freeze', `第${c.no}条出现<b>完全冲突</b>（${person(a.personId).name} ↔ ${person(b.personId).name}），条款<b>冻结</b>，下游连带条款已标出。`);
      }
    }
  });
}

function resolveConflict(cfId) {
  const cf = state.conflicts.find(x => x.id === cfId);
  const c = clause(cf.clauseId);
  const a = state.opinions.find(o => o.id === cf.a), b = state.opinions.find(o => o.id === cf.b);
  openModal(`讨论并解冻：第${c.no}条`,
    `<div class="field"><label>冲突双方</label>
      <div class="op-grid">
        <div class="op-card kind-${a.kind} conflict-a"><div class="op-head">${avatarHTML(person(a.personId))}<div><div class="op-who">${person(a.personId).name}</div><div class="op-role">${person(a.personId).role} · ${KIND_LABEL[a.kind]}</div></div></div><div class="op-proposal">${esc(a.proposal || '（无文字）')}</div></div>
        <div class="op-card kind-${b.kind} conflict-a"><div class="op-head">${avatarHTML(person(b.personId))}<div><div class="op-who">${person(b.personId).name}</div><div class="op-role">${person(b.personId).role} · ${KIND_LABEL[b.kind]}</div></div></div><div class="op-proposal">${esc(b.proposal || '（无文字）')}</div></div>
      </div></div>
    <div class="field"><label>讨论结论</label>
      <div class="radio-row">
        <label><input type="radio" name="cfres" value="a" checked>采纳 ${person(a.personId).name} 的意见</label>
        <label><input type="radio" name="cfres" value="b">采纳 ${person(b.personId).name} 的意见</label>
        <label><input type="radio" name="cfres" value="merge">合并为新文字</label>
        <label><input type="radio" name="cfres" value="keep">继续冻结（暂不解）</label>
      </div>
    </div>
    <div class="field" id="cfTextField"><label>解冻后定稿文字</label><textarea id="cfText">${esc(a.proposal || c.texts[state.currentVersionId])}</textarea></div>
    <div class="field"><label>讨论纪要</label><textarea id="cfNote" placeholder="记录双方达成一致的理由"></textarea></div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: '确认结论并解冻', cls: 'btn-primary', onClick: () => {
        const mode = $('input[name=cfres]:checked').value;
        const note = $('#cfNote').value.trim();
        if (mode === 'keep') { closeModal(); return; }
        if (mode === 'merge') { $('#cfText').value.trim(); }
        const text = $('#cfText').value.trim();
        if (!text && mode !== 'keep') return toast('请确认定稿文字');
        cf.status = 'resolved'; cf.resolution = { mode, note, text, at: nowISO() };
        if (mode === 'a' || mode === 'b') {
          const win = mode === 'a' ? a : b, lose = mode === 'a' ? b : a;
          win.consumed = true; win.consumedHow = 'picked'; win.consumedReason = '冲突讨论后采纳';
          lose.consumed = true; lose.consumedHow = 'rejected'; lose.consumedReason = '冲突讨论后不采纳：' + (note || '见讨论纪要');
          clauseOps(cf.clauseId, state.currentVersionId).forEach(o => { if (!o.consumed) { o.consumed = true; o.consumedHow = 'rejected'; o.consumedReason = '随冲突结论处理'; } });
          c.texts[state.currentVersionId] = text;
          c.decision = { type: 'adopt', opIds: [win.id], mergedText: text, rationale: '冲突讨论结论：' + (note || '达成一致'), by: state.contract.owner, at: nowISO() };
        } else if (mode === 'merge') {
          [a, b].forEach(o => { o.consumed = true; o.consumedHow = 'merged'; });
          clauseOps(cf.clauseId, state.currentVersionId).forEach(o => { if (!o.consumed) { o.consumed = true; o.consumedHow = 'rejected'; o.consumedReason = '随冲突结论处理'; } });
          c.texts[state.currentVersionId] = text;
          c.decision = { type: 'merge', opIds: [a.id, b.id], mergedText: text, rationale: '冲突后合并：' + (note || ''), by: state.contract.owner, at: nowISO() };
        }
        log('resolve', `第${c.no}条冲突<b>已讨论解冻</b>（${{ a: '采纳' + person(a.personId).name, b: '采纳' + person(b.personId).name, merge: '合并双方意见' }[mode]}），下游条款解除连带。`);
        closeModal(); save(); render(); toast('冲突已解决');
      } },
    ]);
  $('input[name=cfres]').forEach(r => r.addEventListener('change', () => {
    const m = $('input[name=cfres]:checked').value;
    $('#cfTextField').style.display = m === 'keep' ? 'none' : 'block';
    if (m === 'a') $('#cfText').value = a.proposal || c.texts[state.currentVersionId];
    if (m === 'b') $('#cfText').value = b.proposal || c.texts[state.currentVersionId];
    if (m === 'merge') $('#cfText').value = [a.proposal, b.proposal].filter(Boolean).join('\n');
  }));
}

/* 同一人前后不一致 → 评审组裁定 */
function ensureRuling(cid, pid) {
  if (state.rulings.some(r => r.clauseId === cid && r.status === 'pending')) return;
  state.rulings.push({ id: uid('ru'), clauseId: cid, personId: pid, status: 'pending', raisedAt: nowISO(), decision: null });
  const c = clause(cid);
  log('freeze', `<b>${person(pid).name}</b> 对第${c.no}条的意见前后两版不一致，已提交<b>评审组裁定以哪次为准</b>。`);
}
function openRuling(rid) {
  const r = state.rulings.find(x => x.id === rid);
  const c = clause(r.clauseId), inc = inconsistencyFor(r.clauseId, r.personId);
  if (!inc) { r.status = 'resolved'; r.decision = 'none'; save(); render(); return toast('不一致已消除'); }
  openModal(`评审组裁定：第${c.no}条 · ${person(r.personId).name}`,
    `<div class="field"><label>两次不一致的意见</label>
      <div class="op-grid">
        <div class="op-card"><div class="op-who">旧版意见（${state.versions.find(v=>v.id===inc.older.versionId)?.name}）</div><div class="op-proposal">${esc(inc.older.proposal || KIND_LABEL[inc.older.kind])}</div><label style="font-size:12px"><input type="radio" name="ruse" value="older"> 以旧版这次为准</label></div>
        <div class="op-card"><div class="op-who">当前版意见（${state.versions.find(v=>v.id===inc.current.versionId)?.name}）</div><div class="op-proposal">${esc(inc.current.proposal || KIND_LABEL[inc.current.kind])}</div><label style="font-size:12px"><input type="radio" name="ruse" value="current" checked> 以当前这次为准</label></div>
      </div></div>
    <div class="field"><label>裁定说明（评审组）</label><textarea id="rNote" placeholder="为何采用其中一次；另一次如何处理"></textarea></div>
    <div class="field help">被否定的一次将标记为“评审组裁定不予采用”，全程留痕，不会静默删除。</div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: '确认裁定', cls: 'btn-primary', onClick: () => {
        const use = $('input[name=ruse]:checked').value;
        const note = $('#rNote').value.trim();
        const keep = use === 'current' ? inc.current : inc.older;
        const drop = use === 'current' ? inc.older : inc.current;
        drop.consumed = true; drop.consumedHow = 'rejected'; drop.consumedReason = '评审组裁定：以' + (use === 'current' ? '当前版' : '旧版') + '意见为准。' + (note || '');
        r.status = 'resolved'; r.decision = use; r.note = note; r.at = nowISO();
        log('resolve', `评审组裁定第${c.no}条<b>以${person(r.personId).name}${use === 'current' ? '当前版' : '旧版'}意见为准</b>，另一次留痕不予采用。`);
        closeModal(); save(); render(); toast('已按评审组裁定处理');
      } },
    ]);
}

/* 补充意见 */
function addOpinion() {
  const cid = state.ui.clauseId, c = clause(cid);
  if (isHardFrozen(cid)) return toast('条款已冻结，请先在冲突讨论中解冻');
  openModal(`补充意见：第${c.no}条`,
    `<div class="field"><label>提意见的人</label><select id="opPerson">${state.people.map(p => `<option value="${p.id}" ${p.id === state.contract.owner ? 'selected' : ''}>${p.name}（${p.role}）</option>`).join('')}</select></div>
     <div class="field"><label>意见类型</label><div class="radio-row">
       <label><input type="radio" name="opkind" value="modify" checked> 建议修改</label>
       <label><input type="radio" name="opkind" value="approve"> 同意当前版</label>
       <label><input type="radio" name="opkind" value="object"> 反对</label>
     </div></div>
     <div class="field" id="opPropField"><label>修改后的条款文字</label><textarea id="opProposal"></textarea></div>
     <div class="field"><label>理由 / 说明</label><textarea id="opReason"></textarea></div>
     <div class="field"><label>冲突标记（可选）</label><select id="opTag"><option value="">无</option><option value="c2acc">与同条反对意见完全冲突 → 自动冻结</option></select><div class="help">演示可用：在第2条新增带冲突标记的修改意见可看到自动冻结。</div></div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: '提交意见', cls: 'btn-primary', onClick: () => {
        const pid = $('#opPerson').value, kind = $('input[name=opkind]:checked').value;
        const proposal = $('#opProposal').value.trim(), reason = $('#opReason').value.trim(), tag = $('#opTag').value;
        if (kind !== 'approve' && !proposal) return toast('请填写修改后的文字（或选择“同意”）');
        if (c.decision) {
          c.history.push({ ...c.decision, versionId: state.currentVersionId, reopenedAt: nowISO() });
          c.decision = null;
          clauseOps(cid, state.currentVersionId).forEach(o => { o.consumed = false; delete o.consumedHow; delete o.consumedReason; });
          if (state.finalized) log('decide', `定稿后 <b>${person(pid).name}</b> 对第${c.no}条提出新意见，该条<b>回到评审</b>，原定稿留痕保留。`);
        }
        const o = { id: uid('o'), clauseId: cid, versionId: state.currentVersionId, personId: pid, kind, proposal, reason, at: nowISO() };
        if (tag) o.conflictTag = tag;
        state.opinions.push(o);
        // 同一人前后不一致
        if (inconsistencyFor(cid, pid)) ensureRuling(cid, pid);
        log('other', `<b>${person(pid).name}</b> 对第${c.no}条提交了${KIND_LABEL[kind]}意见。`);
        detectAndFreezeConflicts();
        closeModal(); save(); render(); toast('意见已记录');
      } },
    ]);
  $('input[name=opkind]').forEach(r => r.addEventListener('change', () => {
    $('#opPropField').style.display = $('input[name=opkind]:checked').value === 'approve' ? 'none' : 'block';
  }));
}

/* 旧版挂起意见处置 */
function carrySuspended(oid) {
  const o = state.opinions.find(x => x.id === oid), c = clause(o.clauseId);
  openConfirm('提到当前版讨论',
    `把 <b>${person(o.personId).name}</b> 在旧版的意见复制一份到当前版参与并排比较；原意见保留在旧版留痕，不会移动或丢失。`,
    () => {
      state.opinions.push({ ...o, id: uid('o'), versionId: state.currentVersionId, at: nowISO(), carriedFrom: o.id, consumed: false });
      o.consumed = true; o.consumedHow = 'rejected'; o.consumedReason = '已提到当前版讨论，此处保留留痕。';
      if (inconsistencyFor(o.clauseId, o.personId)) ensureRuling(o.clauseId, o.personId);
      detectAndFreezeConflicts();
      log('other', `第${c.no}条旧版中 <b>${person(o.personId).name}</b> 的挂起意见已提到当前版讨论。`);
      save(); render(); toast('已提到当前版');
    }, '提到当前版');
}
function archiveSuspended(oid) {
  const o = state.opinions.find(x => x.id === oid), c = clause(o.clauseId);
  openPrompt('确认作废并留痕', `作废 <b>${person(o.personId).name}</b> 的旧版意见，需写明原因；该意见仍会出现在导出对照的“作废意见”清单中。`, '作废原因', note => {
    if (!note.trim()) return toast('请写作废原因');
    o.consumed = true; o.consumedHow = 'rejected'; o.consumedReason = '旧版意见确认作废：' + note.trim();
    log('other', `第${c.no}条一条旧版挂起意见<b>作废留痕</b>（${person(o.personId).name}）。`);
    save(); render(); toast('已作废并记录');
  });
}

/* 改条款文字 / 依赖 */
function editClauseText(cid) {
  const c = clause(cid);
  if (c.decision || isBlocked(cid) || isPendingRuling(cid)) return;
  openModal(`修改条款文字：第${c.no}条`,
    `<div class="field"><label>${curVer().name} 正文</label><textarea id="ctText" style="min-height:130px">${esc(c.texts[state.currentVersionId])}</textarea><div class="help">此处改动会记入版本正文并体现在导出的修改对照中。</div></div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: '保存文字', cls: 'btn-primary', onClick: () => {
        c.texts[state.currentVersionId] = $('#ctText').value;
        log('other', `第${c.no}条当前版正文有文字修订。`);
        closeModal(); save(); render(); toast('已保存');
      } },
    ]);
}
function editDeps(cid) {
  const c = clause(cid);
  openModal(`依赖条款：第${c.no}条`,
    `<div class="field"><label>本条定稿依赖哪些上游条款（上游冻结时本条连带卡住）</label>
      <div class="check-list">${state.clauses.filter(x => x.id !== cid).map(x =>
        `<label><input type="checkbox" class="dep-cb" value="${x.id}" ${c.deps.includes(x.id) ? 'checked' : ''}> 第${x.no}条 · ${esc(x.title)} ${isHardFrozen(x.id) ? '<span style="color:var(--red)">（冻结中）</span>' : ''}</label>`).join('')}</div>
      <div class="help">依赖会传递：A冻结 → 依赖A的B、依赖B的C都会被标出。</div></div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: '保存依赖', cls: 'btn-primary', onClick: () => {
        const deps = $$('.dep-cb').filter(cb => cb.checked).map(cb => cb.value);
        if (createsCycle(cid, deps)) return toast('不能形成循环依赖');
        c.deps = deps;
        closeModal(); save(); render(); toast('依赖已更新');
      } },
    ]);
}
function createsCycle(cid, newDeps) {
  const adj = {};
  state.clauses.forEach(c => { adj[c.id] = c.id === cid ? [...newDeps] : [...c.deps]; });
  const visit = (node, stack) => {
    if (stack.has(node)) return true;
    stack.add(node);
    for (const d of adj[node] || []) if (visit(d, new Set(stack))) return true;
    return false;
  };
  return visit(cid, new Set());
}

/* 新版本导入：老意见挂起，不串版 */
function newVersion() {
  const nextNo = state.versions.length + 1;
  openModal(`导入新版本（当前：${curVer().name}）`,
    `<div class="field"><label>新版本号</label><input id="nvName" value="V${nextNo}"></div>
     <div class="field"><label>反馈截止日</label><input id="nvDeadline" type="date" value=""></div>
     <div class="field"><label>版本说明</label><input id="nvNote" placeholder="如：对方第二轮修订"></div>
     <div class="field"><label>各条款新版本正文</label><div class="help">默认复制当前版文字，可逐条粘贴对方新稿。</div>
       <div id="nvTexts" style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
       ${state.clauses.map(c => `<div><label style="font-size:12px;color:var(--ink2)">第${c.no}条 · ${esc(c.title)}</label><textarea class="nv-text" data-cid="${c.id}" style="min-height:56px">${esc(c.texts[state.currentVersionId])}</textarea></div>`).join('')}
       </div></div>
     <div class="alert alert-dep">导入后，当前版没处理完的意见会自动<b>挂起到原条款</b>（标明所属旧版本），并在“还差谁”里继续跟踪；它们不会出现在新版本正文中。</div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: '导入新版本', cls: 'btn-primary', onClick: () => {
        const name = $('#nvName').value.trim() || ('V' + nextNo);
        const nv = { id: uid('v'), name, createdAt: nowISO(), deadline: $('#nvDeadline').value, note: $('#nvNote').value.trim() };
        state.versions.push(nv);
        $$('.nv-text').forEach(t => { const c = clause(t.dataset.cid); c.texts[nv.id] = t.value; });
        // 已定稿条款：把结论快照进历史，当前清出决定（等待新版复核），但保留为已处理
        state.clauses.forEach(c => {
          if (c.decision) { c.history.push({ ...c.decision, versionId: state.currentVersionId }); }
          // 未消费旧意见保持未消费 → 自动成为“挂起意见”
        });
        state.currentVersionId = nv.id;
        state.ui.versionTab = 'current';
        // 已冻结冲突随旧版保留；在新版本不再冻结，但挂起意见仍在
        state.conflicts.forEach(cf => { if (cf.status === 'frozen' && cf.versionId !== nv.id) cf.carried = true; });
        log('version', `导入 <b>${name}</b>：老版本未处理意见已挂起到对应条款，标明尚未表态/未处理的人。`);
        closeModal(); save(); render(); toast('新版本已导入，旧意见已挂起');
      } },
    ]);
}

/* ---------- 通用弹窗 ---------- */
function openModal(title, bodyHTML, buttons) {
  closeModal();
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-mask"><div class="modal">
    <div class="modal-head"><span>${title}</span><button class="modal-x" data-modal-x>✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
    <div class="modal-foot">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-bi="${i}">${b.text}</button>`).join('')}</div>
  </div></div>`;
  buttons.forEach((b, i) => { const btn = $(`[data-bi="${i}"]`, root); if (btn) btn.onclick = () => b.onClick && b.onClick(); });
  $('[data-modal-x]', root).onclick = closeModal;
  $('.modal-mask', root).addEventListener('click', e => { if (e.target === $('.modal-mask', root)) closeModal(); });
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function openConfirm(title, body, onOk, okText = '确认') {
  openModal(title, `<div style="font-size:13px;line-height:1.8">${body}</div>`,
    [{ text: '取消', cls: '', onClick: closeModal }, { text: okText, cls: 'btn-primary', onClick: onOk }]);
}
function openPrompt(title, body, label, onOk, placeholder = '') {
  openModal(title, `<div style="font-size:13px;line-height:1.8;margin-bottom:10px">${body}</div>
    <div class="field"><label>${label}</label><textarea id="mpText" placeholder="${esc(placeholder)}"></textarea></div>`,
    [{ text: '取消', cls: '', onClick: closeModal },
     { text: '确认', cls: 'btn-primary', onClick: () => onOk($('#mpText').value.trim()) }]);
}
function openRationale(title, body, onOk, defaultText) {
  openModal(title, `<div style="font-size:13px;line-height:1.8;margin-bottom:10px">${body}</div>
    <div class="field"><label>定稿文字</label><textarea id="mrText" style="min-height:110px">${esc(defaultText || '')}</textarea></div>
    <div class="field"><label>理由 / 说明（导出对照中可见）</label><textarea id="mrWhy"></textarea></div>`,
    [{ text: '取消', cls: '', onClick: closeModal },
     { text: '确认定稿', cls: 'btn-primary', onClick: () => onOk($('#mrWhy').value.trim(), $('#mrText').value.trim()) }]);
}
function openMerge(o1, o2, onOk) {
  openModal('合并两种改法',
    `<div class="field"><label>两种原始改法</label>
      <div class="op-grid">
        <div class="op-card"><div class="op-who">${person(o1.personId).name}</div><div class="op-proposal">${esc(o1.proposal || KIND_LABEL[o1.kind])}</div></div>
        <div class="op-card"><div class="op-who">${person(o2.personId).name}</div><div class="op-proposal">${esc(o2.proposal || KIND_LABEL[o2.kind])}</div></div>
      </div></div>
    <div class="field"><label>合并后的定稿文字（可编辑）</label><textarea id="mmText" style="min-height:130px">${esc([o1.proposal, o2.proposal].filter(Boolean).join('\n'))}</textarea></div>
    <div class="field"><label>合并说明</label><textarea id="mmWhy" placeholder="如何取舍两条意见"></textarea></div>`,
    [{ text: '取消', cls: '', onClick: closeModal },
     { text: '确认合并定稿', cls: 'btn-primary', onClick: () => onOk($('#mmText').value, $('#mmWhy').value.trim()) }]);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* 卡点总览 */
function openDashboard() {
  const total = state.clauses.length;
  const done = state.clauses.filter(c => c.decision).length;
  const frozen = state.clauses.filter(c => isHardFrozen(c.id)).length;
  const blocked = softBlockedClauses().length;
  const rulingN = state.clauses.filter(c => isPendingRuling(c.id)).length;
  const waitingPeople = state.clauses.reduce((n, c) => !c.decision ? n + pendingPeople(c.id).filter(x => !x.responded && !x.skipped).length : n, 0);
  const blockers = contractBlockers();
  const rows = blockers.map(({ clause: c, reason }) =>
    `<div class="block-row" data-action="pick-clause" data-id="${c.id}">
      <span class="dot ${reason.level === 'red' ? 'dot-frozen' : reason.level === 'purple' ? 'dot-ruling' : 'dot-pending'}"></span>
      <div class="br-main"><div class="br-t">第${c.no}条 · ${esc(c.title)}</div><div class="br-d">${esc(reason.text)}</div></div>
      <span style="color:var(--ink2);font-size:12px">去处理 →</span>
    </div>`).join('') || '<div style="color:var(--green);font-size:13px">🎉 所有条款都已定稿。</div>';
  openModal('合同卡点总览',
    `<div class="dash-stat">
      <div class="stat-box s-green"><div class="n">${done}/${total}</div><div class="l">已定稿条款</div></div>
      <div class="stat-box s-red"><div class="n">${frozen}</div><div class="l">冲突冻结条款</div></div>
      <div class="stat-box s-red"><div class="n">${blocked}</div><div class="l">连带卡住条款</div></div>
      <div class="stat-box s-purple"><div class="n">${rulingN}</div><div class="l">待评审组裁定</div></div>
    </div>
    <div class="dash-stat" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-box s-amber"><div class="n">${waitingPeople}</div><div class="l">未表态人次（可催办/跳过）</div></div>
      <div class="stat-box s-amber"><div class="n">${blockers.length}</div><div class="l">未定稿条款</div></div>
      <div class="stat-box"><div class="n">${state.reminders.filter(r => r.type === 'skip').length}</div><div class="l">跳过留痕次数</div></div>
    </div>
    <div class="card-title" style="margin-top:14px">卡在哪一条 / 哪个人</div>${rows}`,
    [{ text: '关闭', cls: '', onClick: closeModal }]);
}

/* 合同定稿 */
function finalizeContract() {
  const problems = [];
  state.clauses.forEach(c => {
    if (c.decision) return;
    if (isHardFrozen(c.id)) problems.push(`第${c.no}条 处于冲突冻结状态，不能带着冲突定稿`);
    else if (isSoftBlocked(c.id)) problems.push(`第${c.no}条 依赖的上游条款仍冻结`);
    else if (isPendingRuling(c.id)) problems.push(`第${c.no}条 同一人前后意见不一致，评审组尚未裁定`);
    else {
      const ao = activeOps(c.id), so = suspendedOps(c.id);
      const misses = pendingPeople(c.id).filter(x => !x.responded && !x.skipped);
      if (ao.length || so.length) problems.push(`第${c.no}条 还有 ${ao.length + so.length} 条意见未处理（含旧版挂起 ${so.length} 条）`);
      if (misses.length) problems.push(`第${c.no}条 ${misses.map(x => x.person.name).join('、')} 尚未表态`);
    }
  });
  openModal('合同定稿',
    `${state.finalized ? '<div class="alert alert-finalized">合同已定稿；定稿后若有新意见，对应条款会单独回到评审。</div>' : ''}
     ${problems.length ? `<div class="alert alert-freeze" style="flex-direction:column;align-items:stretch">
       <b>定稿前还有 ${problems.length} 项必须处理（未处理的意见不能被略过）：</b>
       <ul style="margin:8px 0 0;padding-left:18px">${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`
       : '<div class="alert alert-finalized">✅ 所有条款均已定稿，所有意见都有处理结论，可以定稿。</div>'}
     <div class="field" id="forceWrap" ${problems.length ? '' : 'style="display:none"'}>
       <label style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" id="forceFinalize"> 我已知悉仍有未决事项，仍要标记为“带保留事项定稿”，并在导出报告首页列明。</label>
     </div>`,
    [
      { text: '取消', cls: '', onClick: closeModal },
      { text: problems.length ? '带保留事项定稿' : '确认定稿', cls: problems.length ? 'btn-danger' : 'btn-primary', onClick: () => {
        if (problems.length && !$('#forceFinalize').checked) return toast('请勾选确认知悉保留事项');
        state.finalized = true; state.finalizedAt = nowISO();
        log('resolve', problems.length ? `合同<b>带保留事项定稿</b>，${problems.length} 项未决已列入导出报告。` : '合同<b>已定稿</b>，所有条款与意见均已闭环。');
        closeModal(); save(); render(); toast(problems.length ? '已带保留事项定稿' : '合同已定稿');
      } },
    ]);
}

/* ---------- 事件分发 ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action, id = t.dataset.id;
  const pid = t.dataset.pid;
  const needRenderPick = () => { save(); render(); };
  switch (action) {
    case 'pick-clause': state.ui.clauseId = id; state.ui.versionTab = 'current'; save(); render(); break;
    case 'ver-tab': state.ui.versionTab = id === state.currentVersionId ? 'current' : id; save(); renderMain(); break;
    case 'open-dashboard': openDashboard(); break;
    case 'new-version': newVersion(); break;
    case 'export-report': exportReport(); break;
    case 'finalize-contract': finalizeContract(); break;
    case 'reset-demo': resetDemo(); break;
    case 'edit-text': editClauseText(id); break;
    case 'edit-deps': editDeps(id); break;
    case 'add-op': addOpinion(); break;
    case 'decide-adopt': decideAdopt(); break;
    case 'decide-merge': decideMerge(); break;
    case 'decide-reject': decideReject(); break;
    case 'decide-approve': decideApprove(); break;
    case 'reopen-clause': reopenClause(id); break;
    case 'remind': remind(pid); break;
    case 'skip': skipPerson(pid); break;
    case 'undo-skip': undoSkip(pid); break;
    case 'resolve-conflict': resolveConflict(id); break;
    case 'open-ruling': openRuling(id); break;
    case 'suspend-carry': carrySuspended(id); break;
    case 'suspend-keep': toast('已保留在旧版留痕中'); break;
    case 'suspend-archive': archiveSuspended(id); break;
  }
});
function resetDemo() {
  openConfirm('重置演示数据', '将清空当前全部内容并恢复内置演示数据，确定吗？', () => {
    state = seedState(); save(); closeModal(); render(); toast('已恢复演示数据');
  }, '重置');
}

/* ---------- 导出修改对照 ---------- */
function lineDiff(oldT, newT) {
  const oldL = (oldT || '').split('\n'), newL = (newT || '').split('\n');
  const n = Math.max(oldL.length, newL.length), out = [];
  for (let i = 0; i < n; i++) {
    const a = oldL[i], b = newL[i];
    if (a === b && a !== undefined) out.push({ t: '  ' + a });
    else {
      if (a !== undefined) out.push({ t: '- ' + a, k: 'del' });
      if (b !== undefined) out.push({ t: '+ ' + b, k: 'add' });
    }
  }
  return out;
}

function reportData() {
  const first = state.versions[0], cur = curVer();
  const unresolved = [];
  state.clauses.forEach(c => {
    if (c.decision) return;
    activeOps(c.id).forEach(o => unresolved.push({ c, o, why: '当前版未处理意见' }));
    suspendedOps(c.id).forEach(o => unresolved.push({ c, o, why: '旧版挂起未处置' }));
    pendingPeople(c.id).filter(x => !x.responded && !x.skipped).forEach(x =>
      unresolved.push({ c, who: x.person, why: '截止前未表态' }));
    state.reminders.filter(r => r.clauseId === c.id && r.type === 'skip' && !r.undone).forEach(r =>
      unresolved.push({ c, person: person(r.personId), why: '已跳过待补：' + r.note }));
    if (isHardFrozen(c.id)) unresolved.push({ c, why: '冲突冻结未解' });
    if (isPendingRuling(c.id)) unresolved.push({ c, why: '前后意见不一致待评审组裁定' });
  });
  return { first, cur, unresolved };
}

function buildMarkdown() {
  const { first, cur, unresolved } = reportData();
  const L = [];
  L.push(`# ${state.contract.name} — 修改对照报告`);
  L.push('');
  L.push(`${state.contract.party}`);
  L.push(`版本范围：${first.name} → ${cur.name}　生成时间：${new Date().toLocaleString('zh-CN')}`);
  L.push(`合同状态：${state.finalized ? (unresolved.length ? '带保留事项定稿' : '已定稿') : '评审中'}`);
  L.push('');
  if (unresolved.length) {
    L.push(`> ⚠ 尚有 ${unresolved.length} 项未处理/未闭环（定稿时不得忽略）：`);
    [...new Set(unresolved.map(u => '> - 第' + u.c.no + '条 ' + u.c.title + '：' + u.why + (u.o ? '（' + person(u.o.personId).name + '）' : u.who ? '（' + u.who.name + '）' : '')))]
      .forEach(x => L.push(x));
    L.push('');
  }
  state.clauses.slice().sort((a, b) => a.no - b.no).forEach(c => {
    const oldT = c.texts[first.id] ?? Object.values(c.texts)[0];
    const newT = c.texts[cur.id] ?? oldT;
    L.push(`## 第${c.no}条 ${c.title}　【${c.decision ? '已定稿' : '未定稿'}】`);
    const diff = lineDiff(oldT, newT);
    L.push('```diff');
    diff.forEach(d => L.push(d.t));
    L.push('```');
    if (c.decision) {
      const label = { adopt: '采纳改法', merge: '合并改法', reject_all: '均不采纳', approve: '无修改确认原文' }[c.decision.type];
      L.push(`- 处理结论：${label}`);
      L.push(`- 定稿文字：${c.decision.mergedText || newT}`);
      if (c.decision.rationale) L.push(`- 理由：${c.decision.rationale}`);
      L.push(`- 决定人/时间：${person(c.decision.by)?.name || '评审组'} / ${D(c.decision.at)}`);
    } else {
      L.push('- ⚠ 本条未定稿，上述文字非正式结论。');
    }
    const allOps = state.opinions.filter(o => o.clauseId === c.id);
    if (allOps.length) {
      L.push('- 意见处置清单：');
      allOps.forEach(o => {
        const vn = state.versions.find(v => v.id === o.versionId)?.name;
        const status = o.consumed ? ({ picked: '已采纳', merged: '已合并', rejected: '不予采纳/作废' }[o.consumedHow] || '已处理') : '⚠ 未处理';
        L.push(`  - [${vn}] ${person(o.personId).name}（${KIND_LABEL[o.kind]}）：${o.proposal || '无文字修改'} → ${status}${o.consumedReason ? '（' + o.consumedReason + '）' : ''}`);
      });
    }
    const skips = state.reminders.filter(r => r.clauseId === c.id && r.type === 'skip' && !r.undone);
    skips.forEach(r => L.push(`- 跳过记录：${person(r.personId).name} 于 ${D(r.at)} 被跳过，原因：${r.note}`));
    (c.history || []).forEach(h => L.push(`- 历史结论（${state.versions.find(v => v.id === h.versionId)?.name || ''}，后被新版本替代/重开）：${h.rationale || ''}`));
    L.push('');
  });
  L.push('## 操作记录');
  state.activities.slice(0, 60).forEach(a => L.push(`- ${D(a.at)} ${a.text.replace(/<[^>]+>/g, '')}`));
  return L.join('\n');
}

function exportReport() {
  const { first, cur, unresolved } = reportData();
  const clausesHTML = state.clauses.slice().sort((a, b) => a.no - b.no).map(c => {
    const oldT = c.texts[first.id] ?? Object.values(c.texts)[0];
    const newT = c.texts[cur.id] ?? oldT;
    const diffHTML = lineDiff(oldT, newT).map(d =>
      `<div class="${d.k === 'add' ? 'd-add' : d.k === 'del' ? 'd-del' : ''}">${esc(d.t)}</div>`).join('');
    const d = c.decision;
    const ops = state.opinions.filter(o => o.clauseId === c.id).map(o => {
      const vn = state.versions.find(v => v.id === o.versionId)?.name;
      const st = o.consumed ? ({ picked: '已采纳', merged: '已合并', rejected: '不予采纳/作废' }[o.consumedHow] || '已处理') : '<b style="color:var(--red)">⚠ 未处理</b>';
      return `<tr><td>${vn}</td><td>${person(o.personId).name}</td><td>${KIND_LABEL[o.kind]}</td><td>${esc(o.proposal || '—')}</td><td>${st}${o.consumedReason ? `<div style="color:var(--ink2)">${esc(o.consumedReason)}</div>` : ''}</td></tr>`;
    }).join('');
    return `<div class="rp-clause">
      <h3>第${c.no}条 ${esc(c.title)}　${c.decision ? '【已定稿】' : '【未定稿】'}</h3>
      <div class="diffbox">${diffHTML}</div>
      ${d ? `<div style="margin-top:8px"><b>结论：</b>${{ adopt: '采纳改法', merge: '合并改法', reject_all: '均不采纳', approve: '无修改确认原文' }[d.type]}；<b>定稿文字：</b>${esc(d.mergedText || newT)}<br><b>理由：</b>${esc(d.rationale || '')}　（${person(d.by)?.name || ''} ${D(d.at)}）</div>`
        : '<div style="color:var(--red);margin-top:6px">⚠ 本条未定稿，以上非正式结论。</div>'}
      ${ops ? `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;margin-top:8px;width:100%;font-size:12px"><tr style="background:#f1f5f9"><th>版本</th><th>提意见人</th><th>类型</th><th>修改文字</th><th>处置</th></tr>${ops}</table>` : ''}
    </div>`;
  }).join('');
  const warnHTML = unresolved.length ? `<div class="warnbox"><b>⚠ 尚有 ${unresolved.length} 项未闭环，定稿不得忽略：</b><ul style="margin:8px 0 0;padding-left:18px">
    ${[...new Set(unresolved.map(u => `第${u.c.no}条 ${u.c.title}：${u.why}${u.o ? '（' + person(u.o.personId).name + '）' : u.who ? '（' + u.who.name + '）' : ''}`))].map(x => `<li>${esc(x)}</li>`).join('')}
  </ul></div>` : '<div class="alert alert-finalized">✅ 全部意见均已闭环。</div>';
  openModal('导出修改对照',
    `<div class="report">
      <h2 style="margin-top:0">${esc(state.contract.name)} — 修改对照</h2>
      <div>${esc(state.contract.party)}<br>版本范围：${first.name} → ${cur.name}　状态：${state.finalized ? (unresolved.length ? '带保留事项定稿' : '已定稿') : '评审中'}</div>
      ${warnHTML}
      ${clausesHTML}
    </div>`,
    [
      { text: '关闭', cls: '', onClick: closeModal },
      { text: '下载 Markdown', cls: '', onClick: () => {
        const blob = new Blob([buildMarkdown()], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${state.contract.name}-修改对照.md`; a.click(); URL.revokeObjectURL(a.href);
      } },
      { text: '打印 / 存为PDF', cls: 'btn-primary', onClick: () => setTimeout(() => window.print(), 100) },
    ]);
  document.querySelector('#modalRoot .modal').classList.add('wide');
}

/* ---------- 启动 ---------- */
load();
state.ui.sel = state.ui.sel || {};
// 回到上次：记忆上次查看的条款，否则由顶部“接着上次”横幅引导
if (!clause(state.ui.clauseId)) state.ui.clauseId = state.clauses[0].id;
render();
