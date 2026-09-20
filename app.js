const STORAGE_KEY = "contract-review-desk-v1";

const PEOPLE = [
  { id: "legal", name: "林法务", role: "法务" },
  { id: "finance", name: "周财务", role: "财务" },
  { id: "business", name: "陈商务", role: "商务" },
  { id: "purchaser", name: "赵采购", role: "采购" },
  { id: "risk", name: "吴风控", role: "风控" }
];

const CLAUSE_DEFS = [
  { id: "c1", number: "第1条", title: "合同标的与交付", dependsOn: [], required: ["legal", "business", "purchaser"] },
  { id: "c2", number: "第2条", title: "价款与付款节点", dependsOn: [], required: ["finance", "business", "purchaser"] },
  { id: "c3", number: "第3条", title: "验收标准", dependsOn: ["c1"], required: ["legal", "business", "purchaser"] },
  { id: "c4", number: "第4条", title: "发票与税务", dependsOn: ["c2"], required: ["finance", "legal"] },
  { id: "c5", number: "第5条", title: "违约责任", dependsOn: ["c2", "c4"], required: ["legal", "finance", "risk"] },
  { id: "c6", number: "第6条", title: "知识产权与保密", dependsOn: ["c1"], required: ["legal", "business", "risk"] },
  { id: "c7", number: "第7条", title: "争议解决", dependsOn: ["c5", "c6"], required: ["legal", "risk", "business"] }
];

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "pending", label: "待决定" },
  { id: "frozen", label: "冻结" },
  { id: "blocked", label: "依赖阻塞" },
  { id: "waiting", label: "等人回复" },
  { id: "ruling", label: "前后矛盾" },
  { id: "done", label: "已处理" }
];

let state;
let ui = { versionId: "v2", filter: "all", query: "" };

function seedState() {
  return {
    nextId: 30,
    people: PEOPLE,
    versions: [
      {
        id: "v1",
        label: "V1 初稿",
        status: "superseded",
        deadline: "2026-09-15T18:00+08:00",
        createdAt: "2026-09-10T09:00+08:00",
        reopenedFromFinal: true,
        note: "供应商初稿，评审组曾完成一轮，定稿后又收到补充意见。"
      },
      {
        id: "v2",
        label: "V2 修订稿",
        status: "active",
        deadline: "2026-09-24T18:00+08:00",
        createdAt: "2026-09-18T10:30+08:00",
        note: "V1 未处理意见已挂起；当前评审版本。"
      }
    ],
    clauseTexts: {
      v1: {
        c1: "乙方交付系统软件及三年维保，具体范围以附件一为准。",
        c2: "合同总价为人民币 1,200,000 元，合同签署后 30 日内一次性支付。",
        c3: "甲方应在交付后 7 日内完成验收，逾期视为验收通过。",
        c4: "乙方在收款后提供增值税普通发票。",
        c5: "任一方违约，应赔偿对方全部损失，赔偿比例不设上限。",
        c6: "项目成果知识产权归乙方所有，甲方仅享有内部使用权。",
        c7: "争议提交乙方所在地法院管辖。"
      },
      v2: {
        c1: "乙方交付系统软件、接口适配及三年维保，具体范围以附件一、附件二为准。",
        c2: "合同总价为人民币 1,200,000 元，按预付款、到货款、验收款三笔支付。",
        c3: "甲方应在交付后 10 个工作日内完成验收，逾期视为验收通过。",
        c4: "乙方应在每笔付款前提供等额合规增值税专用发票。",
        c5: "任一方违约，应赔偿对方直接损失，赔偿上限为合同总价的 30%。",
        c6: "定制开发成果知识产权归甲方所有，乙方保留通用组件权利并承担保密义务。",
        c7: "争议提交合同签订地有管辖权的人民法院解决。"
      }
    },
    opinions: seedOpinions(),
    decisions: seedDecisions(),
    conflictPairs: [
      { id: "cf1", versionId: "v2", clauseId: "c2", opinionIds: ["o21", "o22"], status: "open", reason: "付款节点和资金风险立场完全冲突。", createdAt: nowOffset(-24), resolvedAt: null, resolution: null }
    ],
    rulings: {},
    nonResponses: seedNonResponses(),
    activities: seedActivities()
  };
}

function seedOpinions() {
  return [
    opinion("o11", "v1", "c1", "legal", "将“三年维保”改为“三年免费维保并约定响应 SLA”。", "2026-09-11T10:00+08:00"),
    opinion("o12", "v1", "c1", "business", "附件一需列明接口、培训、上线陪跑三项服务。", "2026-09-11T11:20+08:00"),
    opinion("o13", "v1", "c1", "purchaser", "保留现有范围，但增加交付物清单作为附件。", "2026-09-11T15:00+08:00"),
    opinion("o14", "v2", "c1", "legal", "维保 SLA 仍需写入正文，不能只放附件。", "2026-09-19T09:10+08:00"),
    opinion("o15", "v2", "c1", "business", "接受附件二，但接口清单要作为付款到货款条件。", "2026-09-19T10:00+08:00"),

    opinion("o21", "v2", "c2", "finance", "取消预付款；验收合格后支付 90%，质保金 10% 满一年支付。", "2026-09-19T11:00+08:00"),
    opinion("o22", "v2", "c2", "business", "签署后预付 30%，到货 40%，验收 30%，否则供应商不排产。", "2026-09-19T11:30+08:00"),
    opinion("o23", "v2", "c2", "purchaser", "预付 10% 可接受，但必须加入银行保函。", "2026-09-19T14:00+08:00"),

    opinion("o31", "v1", "c3", "business", "7 日太短，建议 15 个工作日。", "2026-09-12T09:00+08:00"),
    opinion("o32", "v2", "c3", "business", "10 个工作日可以接受，但需区分初验和终验。", "2026-09-19T16:00+08:00", false, true),

    opinion("o41", "v2", "c4", "finance", "先票后款可以，但发票不合规时付款期限自动顺延。", "2026-09-20T09:30+08:00"),

    opinion("o51", "v1", "c5", "finance", "赔偿上限设为合同总价 20%。", "2026-09-13T10:00+08:00"),
    opinion("o52", "v1", "c5", "risk", "间接损失不赔，但泄密和知识产权违约不应受限。", "2026-09-13T13:00+08:00"),
    opinion("o53", "v2", "c5", "finance", "直接损失上限 30% 可接受。", "2026-09-19T17:00+08:00"),
    opinion("o54", "v2", "c5", "risk", "30% 上限不能覆盖泄密、故意和重大过失。", "2026-09-20T10:00+08:00"),

    opinion("o61", "v1", "c6", "legal", "定制成果应归甲方，乙方只能保留通用组件。", "2026-09-14T09:00+08:00"),
    opinion("o62", "v1", "c6", "business", "建议共有，避免乙方后续项目无法复用。", "2026-09-14T10:00+08:00"),
    opinion("o63", "v1", "c6", "risk", "定稿后补充：保密期限应明确为十年。", "2026-09-19T08:00+08:00", true),
    opinion("o64", "v2", "c6", "legal", "定制成果归甲方已采纳，还需写清通用组件清单。", "2026-09-20T11:00+08:00"),

    opinion("o71", "v1", "c7", "risk", "乙方所在地管辖风险过高，建议甲方所在地。", "2026-09-14T15:00+08:00")
  ];
}

function opinion(id, versionId, clauseId, personId, text, at, afterFinal = false, inconsistent = false) {
  return { id, versionId, clauseId, personId, text, at, afterFinal, inconsistent, supersededNotice: false };
}

function seedDecisions() {
  return [
    {
      id: "d1",
      versionId: "v1",
      clauseId: "c1",
      type: "merge",
      opinionIds: ["o11", "o12"],
      finalText: "三年免费维保并写入响应 SLA；附件一列明接口、培训、上线陪跑及交付物清单。",
      reason: "法务和商务意见互补，采购意见被清单要求吸收。",
      decidedBy: "评审组",
      at: "2026-09-16T10:00+08:00",
      history: []
    },
    {
      id: "d2",
      versionId: "v1",
      clauseId: "c2",
      type: "custom",
      opinionIds: [],
      finalText: "一次性付款口径曾暂留，待 V2 付款节点重新评审。",
      reason: "新版重开付款安排，旧临时结论只作为历史记录。",
      decidedBy: "评审组",
      at: "2026-09-16T11:00+08:00",
      history: []
    },
    {
      id: "d3",
      versionId: "v1",
      clauseId: "c6",
      type: "merge",
      opinionIds: ["o61", "o62"],
      finalText: "定制开发成果归甲方；乙方保留预先存在的通用组件权利，通用组件列入清单。",
      reason: "兼顾甲方资产归属和乙方复用空间。",
      decidedBy: "评审组",
      at: "2026-09-17T15:00+08:00",
      history: []
    }
  ];
}

function seedNonResponses() {
  return [
    { id: "nr1", versionId: "v1", clauseId: "c3", personId: "legal", status: "skipped", reason: "先处理新版验收口径，老版意见暂挂。", at: "2026-09-18T10:35+08:00", reminders: [{ at: "2026-09-18T09:00+08:00", by: "系统" }] },
    { id: "nr2", versionId: "v1", clauseId: "c3", personId: "purchaser", status: "pending", reason: "", at: "2026-09-18T10:35+08:00", reminders: [] },
    { id: "nr3", versionId: "v2", clauseId: "c4", personId: "legal", status: "pending", reason: "", at: nowOffset(-20), reminders: [{ at: nowOffset(-2), by: "林法务的助理" }] },
    { id: "nr4", versionId: "v2", clauseId: "c7", personId: "legal", status: "pending", reason: "", at: nowOffset(-18), reminders: [] },
    { id: "nr5", versionId: "v2", clauseId: "c7", personId: "business", status: "pending", reason: "", at: nowOffset(-18), reminders: [] },
    { id: "nr6", versionId: "v2", clauseId: "c7", personId: "risk", status: "skipped", reason: "争议解决条款等待第5、6条解除冻结后再表态。", at: nowOffset(-5), reminders: [] }
  ];
}

function seedActivities() {
  return [
    { id: "a1", at: "2026-09-17T17:00+08:00", text: "V1 曾标记为可定稿；旧版决策均保留。" },
    { id: "a2", at: "2026-09-18T10:30+08:00", text: "V2 到达，V1 未处理意见自动挂起，不串入新版。" },
    { id: "a3", at: "2026-09-19T08:00+08:00", text: "吴风控在 V1 定稿后补充第6条意见，V1 回到评审且不覆盖旧结论。" },
    { id: "a4", at: nowOffset(-24), text: "第2条财务与商务意见完全冲突，条款已冻结。" },
    { id: "a5", at: nowOffset(-20), text: "第4条依赖第2条，因上游冻结被标为阻塞。" },
    { id: "a6", at: nowOffset(-18), text: "第7条因依赖第5条、第6条而阻塞，进入待讨论队列。" }
  ];
}

function nowOffset(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? JSON.parse(saved) : seedState();
  } catch (error) {
    state = seedState();
  }
}

function saveState(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (message) toast(message);
}

function resetState() {
  state = seedState();
  ui = { versionId: "v2", filter: "all", query: "" };
  saveState("演示数据已重置。");
}

function byId(list, id) {
  return list.find(item => item.id === id);
}
const person = id => byId(state.people, id);
const versionMeta = id => byId(state.versions, id);
const clauseMeta = id => byId(CLAUSE_DEFS, id);
const currentVersion = () => versionMeta(ui.versionId);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function fmtDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

function fmtDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function isOverdue(deadline) {
  return new Date(deadline).getTime() < Date.now();
}

function nextId(prefix) {
  const id = `${prefix}${state.nextId}`;
  state.nextId += 1;
  return id;
}

function addActivity(text) {
  state.activities.unshift({ id: nextId("a"), at: new Date().toISOString(), text });
}

function sortByTime(items) {
  return [...items].sort((a, b) => new Date(a.at) - new Date(b.at) || a.id.localeCompare(b.id));
}

function opinionsFor(versionId, clauseId) {
  return sortByTime(state.opinions.filter(item => item.versionId === versionId && item.clauseId === clauseId));
}

function nonResponsesFor(versionId, clauseId) {
  return state.nonResponses.filter(item => item.versionId === versionId && item.clauseId === clauseId);
}

function respondedPeople(versionId, clauseId) {
  return new Set(opinionsFor(versionId, clauseId).map(item => item.personId));
}

function missingPeople(versionId, clauseId) {
  const responded = respondedPeople(versionId, clauseId);
  return clauseMeta(clauseId).required
    .filter(personId => !responded.has(personId))
    .map(personId => {
      const record = nonResponsesFor(versionId, clauseId).find(item => item.personId === personId);
      return { personId, record };
    });
}

function pendingMissing(versionId, clauseId) {
  return missingPeople(versionId, clauseId).filter(item => !item.record || item.record.status !== "skipped");
}

function decisionsFor(versionId, clauseId) {
  return state.decisions
    .filter(item => item.versionId === versionId && item.clauseId === clauseId)
    .sort((a, b) => new Date(b.at) - new Date(a.at) || b.id.localeCompare(a.id));
}

function latestDecision(versionId, clauseId) {
  return decisionsFor(versionId, clauseId)[0] || null;
}

function activeConflicts() {
  return state.conflictPairs.filter(item => item.status === "open");
}

function frozenClauseIds() {
  const ids = new Set();
  const visit = clauseId => {
    if (ids.has(clauseId)) return;
    ids.add(clauseId);
    CLAUSE_DEFS.filter(item => item.dependsOn.includes(clauseId)).forEach(item => visit(item.id));
  };
  activeConflicts().forEach(item => visit(item.clauseId));
  return ids;
}

function dependencyBlockers(versionId, clauseId) {
  const hardBlocked = [
    ...activeConflicts().map(item => ({ clauseId: item.clauseId, kind: "冻结", reason: item.reason })),
    ...getRulingIssues().map(item => ({ clauseId: item.clauseId, kind: "裁定", reason: "同一人前后意见不一致，尚未确认以哪次为准。" }))
  ].filter(item => item.clauseId !== clauseId);
  return hardBlocked.filter(item => {
    const stack = [...clauseMeta(clauseId).dependsOn];
    const seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      if (id === item.clauseId) return true;
      stack.push(...clauseMeta(id).dependsOn);
    }
    return false;
  });
}

function normalizedText(value) {
  return value.replace(/\s+/g, "").replace(/[。；;：:，,、“”"'（）()]/g, "");
}

function getRulingIssues() {
  const issues = [];
  for (const clauseDef of CLAUSE_DEFS) {
    for (const personRecord of state.people) {
      const personOpinions = sortByTime(state.opinions.filter(item =>
        item.clauseId === clauseDef.id && item.personId === personRecord.id
      ));
      for (let index = 1; index < personOpinions.length; index += 1) {
        const previous = personOpinions[index - 1];
        const current = personOpinions[index];
        if (!current.inconsistent) continue;
        const key = [personRecord.id, clauseDef.id, previous.id, current.id].join("|");
        if (!state.rulings[key]) {
          issues.push({ key, clauseId: clauseDef.id, personId: personRecord.id, previous, current });
        }
      }
    }
  }
  return issues;
}

function rulingIssueFor(versionId, clauseId) {
  return getRulingIssues().find(item =>
    item.clauseId === clauseId && (item.previous.versionId === versionId || item.current.versionId === versionId)
  );
}

function uncoveredOpinions(versionId, clauseId) {
  const decision = latestDecision(versionId, clauseId);
  if (!decision) return opinionsFor(versionId, clauseId);
  return opinionsFor(versionId, clauseId).filter(item => !decision.opinionIds.includes(item.id));
}

function unresolvedNonResponses(versionId, clauseId) {
  return nonResponsesFor(versionId, clauseId).filter(item => item.status !== "skipped" && !respondedPeople(versionId, clauseId).has(item.personId));
}

function getClauseStatus(versionId, clauseId) {
  const versionRecord = versionMeta(versionId);
  if (activeConflicts().some(item => item.clauseId === clauseId)) return "frozen";
  const ruling = rulingIssueFor(versionId, clauseId);
  if (ruling) return "ruling";
  if (dependencyBlockers(versionId, clauseId).length) return "blocked";
  const decision = latestDecision(versionId, clauseId);
  const hasOpinion = opinionsFor(versionId, clauseId).length > 0;
  const waiting = unresolvedNonResponses(versionId, clauseId).length > 0;
  if (decision) {
    if (decision.type === "reopened" || opinionsFor(versionId, clauseId).some(item => item.afterFinal)) return "reopened";
    if (waiting) return "waiting";
    if (versionRecord.status === "final") return "done";
    return "done";
  }
  if (versionRecord.status === "superseded" && hasOpinion) return "suspended";
  return waiting || !hasOpinion ? "waiting" : "pending";
}

function isActionable(versionId, clauseId) {
  return !["frozen", "blocked", "ruling"].includes(getClauseStatus(versionId, clauseId));
}

function render() {
  renderDashboard();
  renderVersions();
  renderFilters();
  renderClauses();
}

function renderDashboard() {
  const selected = currentVersion();
  const clauseStatuses = CLAUSE_DEFS.map(item => ({ clause: item, status: getClauseStatus(selected.id, item.id) }));
  const missing = CLAUSE_DEFS.flatMap(item =>
    pendingMissing(selected.id, item.id).map(entry => ({ ...entry, clauseId: item.id }))
  );
  const stuck = CLAUSE_DEFS.flatMap(item =>
    state.versions
      .map(versionItem => ({ clause: item, status: getClauseStatus(versionItem.id, item.id), versionId: versionItem.id }))
      .filter(entry => ["frozen", "blocked", "ruling"].includes(entry.status))
  );
  const reopened = state.versions.flatMap(item =>
    CLAUSE_DEFS.filter(clauseItem => getClauseStatus(item.id, clauseItem.id) === "reopened").map(clauseItem => ({ version: item, clause: clauseItem }))
  );
  const metrics = [
    { value: CLAUSE_DEFS.length, label: "当前版本条款", tone: "" },
    { value: stuck.length, label: "跨版本冻结/阻塞/裁定", tone: "danger" },
    { value: activeConflicts().length, label: "完全冲突", tone: "danger" },
    { value: getRulingIssues().length, label: "前后意见不一致", tone: "purple" },
    { value: missing.length, label: "还差人回复", tone: "warning" },
    { value: reopened.length, label: "定稿后回到评审", tone: "warning" }
  ];
  document.getElementById("dashboard").innerHTML = `
    ${metrics.map(item => `<div class="metric ${item.tone}"><strong>${item.value}</strong><span>${item.label}</span></div>`).join("")}
    <div class="metric ${stuck.length ? "danger" : "success"}">
      <strong>${stuck.length ? [...new Set(stuck.map(item => item.clause.number))].join("、") : "无"}</strong>
      <span>当前卡点卡在这里</span>
    </div>
  `;
}

function renderVersions() {
  const selected = currentVersion();
  document.getElementById("version-tabs").innerHTML = state.versions.map(item => {
    const unresolved = CLAUSE_DEFS.filter(clauseItem =>
      !["done"].includes(getClauseStatus(item.id, clauseItem.id))
    ).length;
    return `
      <button type="button" class="version-tab ${item.id === selected.id ? "active" : ""}" data-version="${item.id}">
        <strong>${esc(item.label)}</strong>
        <span>${versionStatusLabel(item.status)} · ${unresolved} 条未闭环</span>
      </button>
    `;
  }).join("");

  const missing = CLAUSE_DEFS.flatMap(item =>
    pendingMissing(selected.id, item.id).map(entry => ({ ...entry, clauseId: item.id }))
  );
  document.getElementById("version-meta").innerHTML = `
    <h2>${esc(selected.label)}</h2>
    <p>${esc(selected.note)}</p>
    <p>创建：${fmtDate(selected.createdAt)}　截止：${fmtDate(selected.deadline)} ${isOverdue(selected.deadline) ? '<span class="badge danger">已到截止</span>' : ""}</p>
    <p>未表态：${missing.length ? missing.map(item => `${clauseMeta(item.clauseId).number} ${person(item.personId).name}`).join("；") : "无"}</p>
  `;
}

function renderFilters() {
  document.getElementById("filter-tabs").innerHTML = FILTERS.map(item =>
    `<button type="button" class="filter-tab ${ui.filter === item.id ? "active" : ""}" data-filter="${item.id}">${item.label}</button>`
  ).join("");
  document.getElementById("search").value = ui.query;
}

function versionStatusLabel(status) {
  return { active: "评审中", superseded: "已被替代/挂起", final: "已定稿", reopened: "定稿后重开" }[status] || status;
}

function statusLabel(status) {
  return {
    pending: "待决定", frozen: "冲突冻结", blocked: "依赖阻塞", ruling: "待评审组裁定",
    waiting: "等人回复", suspended: "老版挂起", done: "已处理", reopened: "定稿后重开"
  }[status];
}

function statusTone(status) {
  return {
    frozen: "danger", blocked: "warning", ruling: "purple", waiting: "warning",
    suspended: "", done: "success", reopened: "purple", pending: "info"
  }[status] || "";
}

function renderClauses() {
  const selected = currentVersion();
  const query = ui.query.trim().toLowerCase();
  const visible = CLAUSE_DEFS.filter(item => {
    const status = getClauseStatus(selected.id, item.id);
    const filterMap = {
      pending: ["pending"], frozen: ["frozen"], blocked: ["blocked"], waiting: ["waiting"],
      ruling: ["ruling"], done: ["done"], reopened: ["reopened"], suspended: ["suspended"]
    };
    if (ui.filter !== "all" && !filterMap[ui.filter]?.includes(status)) return false;
    if (!query) return true;
    const haystack = [item.number, item.title, state.clauseTexts[selected.id]?.[item.id] || "",
      ...opinionsFor(selected.id, item.id).map(op => `${person(op.personId).name} ${op.text}`),
      ...item.required.map(id => person(id).name)].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const root = document.getElementById("clauses");
  if (!visible.length) {
    root.innerHTML = `<div class="empty">没有符合筛选的条款。</div>`;
    return;
  }
  root.innerHTML = visible.map(item => renderClause(selected.id, item)).join("");
}

function renderClause(versionId, clauseDef) {
  const status = getClauseStatus(versionId, clauseDef.id);
  const opinions = opinionsFor(versionId, clauseDef.id);
  const decision = latestDecision(versionId, clauseDef.id);
  const conflicts = activeConflicts().filter(item => item.clauseId === clauseDef.id);
  const blockers = dependencyBlockers(versionId, clauseDef.id);
  const ruling = rulingIssueFor(versionId, clauseDef);
  const missing = missingPeople(versionId, clauseDef.id);
  const canAct = isActionable(versionId, clauseDef.id);
  const text = state.clauseTexts[versionId]?.[clauseDef.id] || "";

  return `
    <article class="clause-card ${esc(status)}" id="clause-${clauseDef.id}">
      <div class="clause-head">
        <div>
          <div class="clause-title">
            <h2>${clauseDef.number} ${esc(clauseDef.title)}</h2>
            <span class="badge ${statusTone(status)}">${statusLabel(status)}</span>
            ${versionMeta(versionId).status === "superseded" ? `<span class="badge">新版到达后挂起</span>` : ""}
            ${versionMeta(versionId).status === "reopened" ? `<span class="badge purple">定稿后重开</span>` : ""}
          </div>
          <p class="clause-original">${esc(text)}</p>
        </div>
        <div class="clause-actions">
          <button class="btn small" data-action="add-opinion" data-clause="${clauseDef.id}" ${versionMeta(versionId).status === "final" ? "" : ""}>追加意见</button>
          ${decision ? `<button class="btn small" data-action="revise" data-clause="${clauseDef.id}" ${canAct ? "" : "disabled"}>修订结论</button>` : ""}
          <button class="btn small danger" data-action="freeze" data-clause="${clauseDef.id}" ${conflicts.length || blockers.length || ruling ? "disabled" : ""}>标记完全冲突</button>
        </div>
      </div>
      ${renderWarnings(versionId, clauseDef, { conflicts, blockers, ruling, missing })}
      <div class="meta-line">
        <span>依赖：${clauseDef.dependsOn.length ? clauseDef.dependsOn.map(id => clauseMeta(id).number).join("、") : "无"}</span>
        <span>应表态：${clauseDef.required.map(id => person(id).name).join("、")}</span>
        <span>意见数：${opinions.length}</span>
      </div>
      <div class="proposal-grid">
        ${opinions.map(item => renderProposal(versionId, clauseDef, item, { status, canAct, conflicts })).join("") || `<div class="small-note">暂无版本内意见。</div>`}
      </div>
      ${renderDecisionBox(versionId, clauseDef, decision, status, canAct)}
      ${renderMissing(versionId, clauseDef, missing)}
      ${renderTimeline(versionId, clauseDef)}
    </article>
  `;
}

function renderWarnings(versionId, clauseDef, data) {
  const notes = [];
  data.conflicts.forEach(item => notes.push({ tone: "danger", title: "条款已冻结", text: `${item.reason} 冲突解除前，不允许定稿或覆盖下游条款。`, action: `<button class="btn small" data-action="resolve-conflict" data-conflict="${item.id}">记录讨论结果并解冻</button>` }));
  data.blockers.forEach(item => {
    notes.push({ tone: item.kind === "裁定" ? "purple" : "warning", title: `上游 ${clauseMeta(item.clauseId).number} ${item.kind}`, text: item.reason || "依赖条款存在未决硬阻断。" });
  });
  if (data.ruling) {
    const p = person(data.ruling.personId);
    notes.push({ tone: "purple", title: `${p.name} 前后两次意见不一致`, text: `需评审组裁定以哪次为准：${data.ruling.previous.versionId.toUpperCase()} vs ${data.ruling.current.versionId.toUpperCase()}。`, action: `<button class="btn small" data-action="resolve-ruling" data-ruling="${data.ruling.key}">提交评审组裁定</button>` });
  }
  const skipped = data.missing.filter(item => item.record?.status === "skipped");
  if (["superseded", "reopened"].includes(versionMeta(versionId).status)) {
    notes.push({ tone: "", title: "版本隔离", text: "本条意见只归属当前查看版本；未处理完的内容保持挂起，定稿后补充意见也不会冲掉旧结论。" });
  }
  skipped.forEach(item => notes.push({ tone: "warning", title: `${person(item.personId).name} 已跳过`, text: item.record.reason || "已记录为暂不表态。" }));
  return notes.map(note => `
    <div class="decision-box ${note.tone}">
      <h3>${esc(note.title)}</h3>
      <p>${esc(note.text)}</p>
      ${note.action || ""}
    </div>
  `).join("");
}

function renderProposal(versionId, clauseDef, item, context) {
  const conflictOpinionIds = context.conflicts.flatMap(conflict => conflict.opinionIds);
  const decision = latestDecision(versionId, clauseDef.id);
  const selected = decision?.opinionIds.includes(item.id);
  return `
    <section class="proposal ${selected ? "selected" : ""} ${conflictOpinionIds.includes(item.id) ? "conflict" : ""} ${item.afterFinal ? "suspended" : ""}">
      <div class="proposal-head">
        <div>
          <div class="proposal-author">${esc(person(item.personId).name)}</div>
          <div class="proposal-meta">${person(item.personId).role} · ${fmtDateTime(item.at)}</div>
        </div>
        ${item.afterFinal ? `<span class="badge purple">定稿后补充</span>` : selected ? `<span class="badge success">已纳入</span>` : ""}
      </div>
      <p>${esc(item.text)}</p>
      ${context.canAct ? `<label><input type="checkbox" name="merge-${clauseDef.id}" value="${item.id}"> 纳入本次处理</label>` : `<div class="small-note">冻结、阻塞或裁定期间仅可查看。</div>`}
    </section>
  `;
}

function renderDecisionBox(versionId, clauseDef, decision, status, canAct) {
  if (!decision) {
    return `
      <div class="decision-box warning">
        <h3>尚未形成评审结论</h3>
        <p>可勾选一种或两种改法后处理；如果都不采纳，必须写明理由。</p>
        ${canAct ? `
          <div class="clause-actions">
            <button class="btn small" data-action="decide-selected" data-clause="${clauseDef.id}">采纳一种</button>
            <button class="btn small" data-action="decide-merge" data-clause="${clauseDef.id}">合并勾选</button>
            <button class="btn small danger" data-action="decide-reject" data-clause="${clauseDef.id}">均不采纳</button>
          </div>` : `<p class="small-note">当前状态禁止继续定稿。</p>`}
      </div>`;
  }
  const typeLabel = { select: "采纳一种", merge: "合并采纳", reject: "均不采纳", custom: "评审组改定", reopened: "重开评审" }[decision.type] || decision.type;
  const uncovered = uncoveredOpinions(versionId, clauseDef.id);
  return `
    <div class="decision-box ${status === "reopened" ? "danger" : "success"}">
      <h3>当前结论：${typeLabel} <span class="small-note">${fmtDateTime(decision.at)} · ${esc(decision.decidedBy)}</span></h3>
      <p><b>定稿文本：</b>${esc(decision.finalText)}</p>
      ${decision.reason ? `<p><b>理由：</b>${esc(decision.reason)}</p>` : ""}
      ${uncovered.length ? `<p class="small-note"><b>未覆盖意见：</b>${uncovered.map(item => person(item.personId).name).join("、")}；导出时会列入未处理清单。</p>` : ""}
      ${decision.history?.length ? `<p class="small-note">已有 ${decision.history.length} 次历史修订，全部保留在导出记录中。</p>` : ""}
      <div class="clause-actions">
        <button class="btn small" data-action="decide-selected" data-clause="${clauseDef.id}" ${canAct ? "" : "disabled"}>采纳一种</button>
        <button class="btn small" data-action="decide-merge" data-clause="${clauseDef.id}" ${canAct ? "" : "disabled"}>合并勾选</button>
        <button class="btn small danger" data-action="decide-reject" data-clause="${clauseDef.id}" ${canAct ? "" : "disabled"}>均不采纳</button>
      </div>
    </div>`;
}

function renderMissing(versionId, clauseDef, missing) {
  if (!missing.length) return `<div class="people-row"><span class="badge success">应表态人员均已回复</span></div>`;
  return `
    <div class="people-row">
      ${missing.map(item => {
        const skipped = item.record?.status === "skipped";
        return `
          <span class="person-chip ${skipped ? "" : "overdue"}">
            ${person(item.personId).name} · ${skipped ? "已跳过" : "未回复"}
            ${!skipped ? `<button class="btn small" data-action="remind" data-clause="${clauseDef.id}" data-person="${item.personId}">催办</button>` : ""}
            <button class="btn small" data-action="skip-person" data-clause="${clauseDef.id}" data-person="${item.personId}">${skipped ? "修改跳过记录" : "先跳过"}</button>
          </span>`;
      }).join("")}
    </div>`;
}

function renderTimeline(versionId, clauseDef) {
  const decisions = state.decisions.filter(item => item.versionId === versionId && item.clauseId === clauseDef.id);
  const conflicts = state.conflictPairs.filter(item => item.versionId === versionId && item.clauseId === clauseDef.id);
  const records = nonResponsesFor(versionId, clauseDef.id);
  const items = [
    ...decisions.map(item => ({ at: item.at, html: `<b>${item.decidedBy}</b> 形成结论：${esc(item.finalText)}` })),
    ...conflicts.map(item => ({ at: item.createdAt, html: item.status === "open" ? `<b>冲突冻结</b>：${esc(item.reason)}` : `<b>冲突解除</b>：${esc(item.resolution || "")}` })),
    ...records.flatMap(item => [
      ...item.reminders.map(reminder => ({ at: reminder.at, html: `催办 <b>${person(item.personId).name}</b>，操作人：${esc(reminder.by)}` })),
      ...(item.status === "skipped" ? [{ at: item.at, html: `<b>${person(item.personId).name}</b> 暂不表态：${esc(item.reason)}` }] : [])
    ])
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5);
  if (!items.length) return "";
  return `<div class="timeline">${items.map(item => `<div class="timeline-item">${fmtDateTime(item.at)} · ${item.html}</div>`).join("")}</div>`;
}

function openModal({ title, fields, submitLabel = "确认", onSubmit }) {
  const backdrop = document.getElementById("modal-backdrop");
  document.getElementById("modal-title").textContent = title;
  const form = document.getElementById("modal-form");
  form.innerHTML = `
    ${fields.map(field => {
      if (field.type === "info") return `<div class="decision-box ${field.tone || ""}"><p>${esc(field.value)}</p></div>`;
      if (field.type === "select") {
        return `<div class="field"><label>${esc(field.label)}</label>
          <select name="${field.name}" ${field.required ? "required" : ""}>
            ${field.options.map(option => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("")}
          </select>${field.hint ? `<div class="hint">${esc(field.hint)}</div>` : ""}</div>`;
      }
      if (field.type === "checkbox") {
        return `<div class="field"><label><input type="checkbox" name="${field.name}" value="true"> ${esc(field.label)}</label>${field.hint ? `<div class="hint">${esc(field.hint)}</div>` : ""}</div>`;
      }
      const input = field.type === "textarea"
        ? `<textarea name="${field.name}" ${field.required ? "required" : ""} placeholder="${esc(field.placeholder || "")}">${esc(field.value || "")}</textarea>`
        : `<input name="${field.name}" type="${field.type || "text"}" value="${esc(field.value || "")}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""} />`;
      return `<div class="field"><label>${esc(field.label)}</label>${input}${field.hint ? `<div class="hint">${esc(field.hint)}</div>` : ""}</div>`;
    }).join("")}
    <div class="modal-actions">
      <button type="button" class="btn" data-modal-close>取消</button>
      <button type="submit" class="btn primary">${esc(submitLabel)}</button>
    </div>`;
  form.onsubmit = event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const missingRequired = fields.some(field => field.required && !String(data[field.name] || "").trim());
    if (missingRequired) {
      form.reportValidity();
      return;
    }
    if (onSubmit(data) === false) return;
    closeModal();
  };
  backdrop.hidden = false;
}

function closeModal() {
  document.getElementById("modal-backdrop").hidden = true;
  document.getElementById("modal-form").onsubmit = null;
}

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3200);
}

document.addEventListener("click", event => {
  const close = event.target.closest("[data-modal-close]");
  if (close) {
    closeModal();
    return;
  }
  const versionTab = event.target.closest("[data-version]");
  if (versionTab) {
    ui.versionId = versionTab.dataset.version;
    render();
    return;
  }
  const filterTab = event.target.closest("[data-filter]");
  if (filterTab) {
    ui.filter = filterTab.dataset.filter;
    render();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const clauseId = action.dataset.clause;
  switch (action.dataset.action) {
    case "resume": resumeReview(); break;
    case "reset": resetState(); break;
    case "export": exportReport(); break;
    case "finalize": finalizeVersion(); break;
    case "new-version": createNewVersion(); break;
    case "add-opinion": addOpinion(clauseId); break;
    case "freeze": freezeClause(clauseId); break;
    case "resolve-conflict": resolveConflict(action.dataset.conflict); break;
    case "resolve-ruling": resolveRuling(action.dataset.ruling); break;
    case "revise":
    case "decide-selected": decideClause(clauseId, "select"); break;
    case "decide-merge": decideClause(clauseId, "merge"); break;
    case "decide-reject": decideClause(clauseId, "reject"); break;
    case "remind": remind(clauseId, action.dataset.person); break;
    case "skip-person": skipPerson(clauseId, action.dataset.person); break;
  }
});

document.getElementById("modal-backdrop").addEventListener("click", event => {
  if (event.target.id === "modal-backdrop") closeModal();
});

document.getElementById("search").addEventListener("input", event => {
  ui.query = event.target.value;
  renderClauses();
});

function addOpinion(clauseId) {
  const versionId = ui.versionId;
  const versionRecord = versionMeta(versionId);
  const required = clauseId ? [clauseMeta(clauseId).required] : CLAUSE_DEFS.map(item => item.required);
  const clauseOptions = CLAUSE_DEFS.map(item => ({ value: item.id, label: `${item.number} ${item.title}` }));
  openModal({
    title: "追加条款意见",
    fields: [
      ...(versionRecord.status !== "active" ? [{
        type: "info",
        tone: "warning",
        value: versionRecord.status === "final"
          ? "该版本已定稿：新意见会把相关条款回到评审，旧决定保留为历史，不会被冲掉。"
          : versionRecord.status === "reopened"
            ? "该版本定稿后已重开：继续保留旧结论和新意见的完整链路。"
            : "该版本已被新版替代：意见会明确挂在当前老版本下，不会串入新版本。"
      }] : []),
      ...(clauseId ? [] : [{ name: "clauseId", label: "选择条款", type: "select", required: true, options: clauseOptions }]),
      { name: "personId", label: "提意见人", type: "select", required: true, options: state.people.map(item => ({ value: item.id, label: `${item.name}（${item.role}）` })) },
      { name: "text", label: "修改意见", type: "textarea", required: true, placeholder: "写清建议改法或不能接受的点。" },
      { name: "inconsistent", label: "与该人上一轮意见实质冲突，需要评审组裁定以哪次为准", type: "checkbox" }
    ],
    submitLabel: "提交意见",
    onSubmit: data => {
      const targetClauseId = clauseId || data.clauseId;
      const afterFinal = ["final", "reopened"].includes(versionRecord.status);
      const newOpinion = {
        id: nextId("o"),
        versionId,
        clauseId: targetClauseId,
        personId: data.personId,
        text: data.text.trim(),
        at: new Date().toISOString(),
        afterFinal,
        inconsistent: Boolean(data.inconsistent),
        supersededNotice: versionRecord.status === "superseded"
      };
      state.opinions.push(newOpinion);
      state.nonResponses = state.nonResponses.filter(item =>
        !(item.versionId === versionId && item.clauseId === targetClauseId && item.personId === data.personId)
      );
      if (afterFinal) {
        reopenDecision(versionId, targetClauseId, newOpinion);
      }
      addActivity(`${person(data.personId).name} 对 ${versionRecord.label} ${clauseMeta(targetClauseId).number} 追加意见。`);
      saveState("意见已按版本和条款归档。");
    }
  });
}

function reopenDecision(versionId, clauseId, newOpinion) {
  const current = latestDecision(versionId, clauseId);
  const decision = current || {
    id: nextId("d"),
    versionId,
    clauseId,
    opinionIds: [],
    decidedBy: "系统",
    history: []
  };
  if (current) {
    decision.history.push({
      type: current.type,
      finalText: current.finalText,
      reason: current.reason,
      decidedBy: current.decidedBy,
      at: current.at
    });
  }
  Object.assign(decision, {
    type: "reopened",
    opinionIds: Array.from(new Set([...(decision.opinionIds || []), newOpinion.id])),
    finalText: current?.finalText || "原条款无独立结论，等待评审组处理定稿后意见。",
    reason: "定稿后出现新意见，条款回到评审；旧结论保留为历史。",
    decidedBy: "评审组",
    at: new Date().toISOString()
  });
  if (!current) state.decisions.push(decision);
  if (versionMeta(versionId).status === "final") {
    versionMeta(versionId).status = "reopened";
    versionMeta(versionId).reopenedFromFinal = true;
  }
}

function checkedOpinions(clauseId) {
  return [...document.querySelectorAll(`input[name="merge-${clauseId}"]:checked`)].map(input => input.value);
}

function decideClause(clauseId, type) {
  const versionId = ui.versionId;
  if (!isActionable(versionId, clauseId)) {
    toast("条款冻结、依赖阻塞或待裁定，不能继续定稿。");
    return;
  }
  const opinions = opinionsFor(versionId, clauseId);
  const selectedIds = type === "reject" ? [] : checkedOpinions(clauseId);
  if (type === "select" && selectedIds.length !== 1) {
    toast("采纳一种时，请且仅勾选一种改法。");
    return;
  }
  if (type === "merge" && selectedIds.length < 2) {
    toast("合并至少勾选两种改法。");
    return;
  }
  const selectedOpinions = opinions.filter(item => selectedIds.includes(item.id));
  const defaultText = type === "reject"
    ? state.clauseTexts[versionId][clauseId]
    : selectedOpinions.map(item => item.text).join("\n");
  openModal({
    title: { select: "采纳一种改法", merge: "合并改法", reject: "均不采纳" }[type],
    fields: [
      ...(type === "reject"
        ? [{ type: "info", tone: "warning", value: "均不采纳必须写理由；导出对照会显示被驳回的每个意见。" }]
        : selectedOpinions.map(item => ({ type: "info", value: `${person(item.personId).name}：${item.text}` }))),
      { name: "finalText", label: "拟写入合同的最终文本", type: "textarea", required: true, value: defaultText },
      { name: "reason", label: type === "reject" ? "不采纳理由" : "处理说明", type: "textarea", required: type === "reject", placeholder: "说明取舍、合并口径或驳回原因。" }
    ],
    submitLabel: "保存结论",
    onSubmit: data => {
      const current = latestDecision(versionId, clauseId);
      const history = current ? [{
        type: current.type,
        opinionIds: current.opinionIds,
        finalText: current.finalText,
        reason: current.reason,
        decidedBy: current.decidedBy,
        at: current.at
      }, ...(current.history || [])] : [];
      const record = {
        id: nextId("d"),
        versionId,
        clauseId,
        type,
        opinionIds: selectedIds,
        finalText: data.finalText.trim(),
        reason: data.reason.trim(),
        decidedBy: "评审组",
        at: new Date().toISOString(),
        history
      };
      state.decisions.push(record);
      addActivity(`${clauseMeta(clauseId).number} 形成“${type}”结论。`);
      saveState("结论已保存，旧意见仍可追踪。");
    }
  });
}

function freezeClause(clauseId) {
  const versionId = ui.versionId;
  if (!isActionable(versionId, clauseId)) {
    toast("条款处于冻结、上游阻塞或待裁定状态，不能重复标记冲突。");
    return;
  }
  const opinions = opinionsFor(versionId, clauseId);
  const peopleWithOpinions = [...new Set(opinions.map(item => item.personId))];
  if (peopleWithOpinions.length < 2) {
    toast("至少需要两个人在该版本该条款下发表意见，才能标记完全冲突。");
    return;
  }
  openModal({
    title: `冻结 ${clauseMeta(clauseId).number}`,
    fields: [
      { type: "info", tone: "danger", value: "完全冲突的条款会先冻结；依赖它的条款也会标为阻塞，不能只卡一条后继续定稿。" },
      { name: "firstPerson", label: "冲突方 A", type: "select", required: true, options: state.people.filter(item => peopleWithOpinions.includes(item.id)).map(item => ({ value: item.id, label: item.name })) },
      { name: "secondPerson", label: "冲突方 B", type: "select", required: true, options: state.people.filter(item => peopleWithOpinions.includes(item.id)).map(item => ({ value: item.id, label: item.name })) },
      { name: "reason", label: "冲突说明", type: "textarea", required: true, placeholder: "说明哪两种立场无法同时成立。" }
    ],
    submitLabel: "冻结条款",
    onSubmit: data => {
      if (data.firstPerson === data.secondPerson) {
        toast("请选择两个不同的冲突方。");
        return false;
      }
      const firstOpinion = opinions.filter(item => item.personId === data.firstPerson).pop();
      const secondOpinion = opinions.filter(item => item.personId === data.secondPerson).pop();
      if (!firstOpinion || !secondOpinion) return;
      state.conflictPairs.push({
        id: nextId("cf"),
        versionId,
        clauseId,
        opinionIds: [firstOpinion.id, secondOpinion.id],
        status: "open",
        reason: data.reason.trim(),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolution: null
      });
      addActivity(`${clauseMeta(clauseId).number} 因完全冲突冻结，下游条款同步标记阻塞。`);
      saveState("条款已冻结，下游依赖已标出。");
    }
  });
}

function resolveConflict(conflictId) {
  const record = byId(state.conflictPairs, conflictId);
  if (!record) return;
  const opinions = record.opinionIds.map(id => byId(state.opinions, id));
  openModal({
    title: `讨论后解冻 ${clauseMeta(record.clauseId).number}`,
    fields: [
      ...opinions.map(item => ({ type: "info", value: `${person(item.personId).name}：${item.text}` })),
      { name: "resolution", label: "讨论结果", type: "textarea", required: true, placeholder: "记录共识、让步条件或评审组决定。" },
      { name: "finalText", label: "解冻后拟写入文本", type: "textarea", required: true }
    ],
    submitLabel: "解除冻结并落结论",
    onSubmit: data => {
      record.status = "resolved";
      record.resolvedAt = new Date().toISOString();
      record.resolution = data.resolution.trim();
      state.decisions.push({
        id: nextId("d"),
        versionId: record.versionId,
        clauseId: record.clauseId,
        type: "custom",
        opinionIds: record.opinionIds,
        finalText: data.finalText.trim(),
        reason: `冲突讨论结果：${data.resolution.trim()}`,
        decidedBy: "评审组",
        at: new Date().toISOString(),
        history: []
      });
      addActivity(`${clauseMeta(record.clauseId).number} 冲突解除，下游阻塞同步释放。`);
      saveState("冲突已解除并形成结论。");
    }
  });
}

function resolveRuling(rulingKey) {
  const issue = getRulingIssues().find(item => item.key === rulingKey);
  if (!issue) return;
  openModal({
    title: `裁定 ${person(issue.personId).name} 的有效意见`,
    fields: [
      { type: "info", tone: "purple", value: `前次（${issue.previous.versionId.toUpperCase()} ${fmtDateTime(issue.previous.at)}）：${issue.previous.text}` },
      { type: "info", tone: "purple", value: `后次（${issue.current.versionId.toUpperCase()} ${fmtDateTime(issue.current.at)}）：${issue.current.text}` },
      {
        name: "authoritativeId",
        label: "评审组确认以哪次为准",
        type: "select",
        required: true,
        options: [
          { value: issue.previous.id, label: "以前次意见为准" },
          { value: issue.current.id, label: "以后次意见为准" }
        ]
      },
      { name: "reason", label: "裁定理由", type: "textarea", required: true }
    ],
    submitLabel: "保存裁定",
    onSubmit: data => {
      state.rulings[issue.key] = {
        authoritativeId: data.authoritativeId,
        reason: data.reason.trim(),
        at: new Date().toISOString(),
        by: "评审组"
      };
      addActivity(`${clauseMeta(issue.clauseId).number}：${person(issue.personId).name} 前后矛盾已由评审组裁定。`);
      saveState("裁定已保存。");
    }
  });
}

function remind(clauseId, personId) {
  const versionId = ui.versionId;
  openModal({
    title: `催办 ${person(personId).name}`,
    fields: [
      { type: "info", value: `${versionMeta(versionId).label} ${clauseMeta(clauseId).number} 截止 ${fmtDateTime(versionMeta(versionId).deadline)}。` },
      { name: "message", label: "催办留言", type: "textarea", required: true, value: `请在本轮截止前反馈 ${clauseMeta(clauseId).title} 的修改意见。` }
    ],
    submitLabel: "发送催办",
    onSubmit: data => {
      let record = state.nonResponses.find(item =>
        item.versionId === versionId && item.clauseId === clauseId && item.personId === personId
      );
      if (!record) {
        record = {
          id: nextId("nr"),
          versionId,
          clauseId,
          personId,
          status: "pending",
          reason: "",
          at: new Date().toISOString(),
          reminders: []
        };
        state.nonResponses.push(record);
      }
      record.reminders.push({ at: new Date().toISOString(), by: "当前评审协调人", message: data.message.trim() });
      addActivity(`已催办 ${person(personId).name} 回复 ${clauseMeta(clauseId).number}。`);
      saveState("催办已记录。");
    }
  });
}

function skipPerson(clauseId, personId) {
  const versionId = ui.versionId;
  const existing = state.nonResponses.find(item =>
    item.versionId === versionId && item.clauseId === clauseId && item.personId === personId
  );
  openModal({
    title: `暂不等待 ${person(personId).name}`,
    fields: [
      { type: "info", tone: "warning", value: "可以先跳过，但必须留记录；导出定稿对照时会显示跳过对象与原因，不能悄悄略过。" },
      { name: "reason", label: "跳过原因", type: "textarea", required: true, value: existing?.reason || "" }
    ],
    submitLabel: "保存跳过记录",
    onSubmit: data => {
      if (existing) {
        existing.status = "skipped";
        existing.reason = data.reason.trim();
        existing.at = new Date().toISOString();
      } else {
        state.nonResponses.push({
          id: nextId("nr"),
          versionId,
          clauseId,
          personId,
          status: "skipped",
          reason: data.reason.trim(),
          at: new Date().toISOString(),
          reminders: []
        });
      }
      addActivity(`${person(personId).name} 在 ${clauseMeta(clauseId).number} 的回复被暂时跳过。`);
      saveState("跳过已留痕。");
    }
  });
}

function versionBlockers(versionId) {
  const result = [];
  CLAUSE_DEFS.forEach(clauseDef => {
    const status = getClauseStatus(versionId, clauseDef.id);
    if (activeConflicts().some(item => item.clauseId === clauseDef.id)) {
      result.push({ clauseId: clauseDef.id, severity: "冻结", text: "存在完全冲突，必须讨论解冻。" });
    }
    const upstreamBlockers = dependencyBlockers(versionId, clauseDef.id);
    if (upstreamBlockers.length) {
      result.push({ clauseId: clauseDef.id, severity: "依赖", text: `等待上游：${upstreamBlockers.map(item => `${clauseMeta(item.clauseId).number}（${item.kind}）`).join("、")}。` });
    }
    if (rulingIssueFor(versionId, clauseDef.id)) {
      result.push({ clauseId: clauseDef.id, severity: "裁定", text: "同一人前后意见不一致，评审组尚未确认以哪次为准。" });
    }
    if (pendingMissing(versionId, clauseDef.id).length) {
      result.push({
        clauseId: clauseDef.id,
        severity: "缺人",
        text: `还差：${pendingMissing(versionId, clauseDef.id).map(item => person(item.personId).name).join("、")}。`
      });
    }
    const uncovered = uncoveredOpinions(versionId, clauseDef.id);
    if (uncovered.length) {
      result.push({
        clauseId: clauseDef.id,
        severity: "意见",
        text: `未纳入任何结论：${uncovered.map(item => `${person(item.personId).name}（${item.versionId.toUpperCase()}）`).join("、")}。`
      });
    }
    if (status === "reopened") {
      result.push({ clauseId: clauseDef.id, severity: "重开", text: "定稿后新增意见尚未重新处理。" });
    }
  });
  return result;
}

function createNewVersion() {
  const latestVersion = state.versions[state.versions.length - 1];
  const defaultLabel = `V${state.versions.length + 1} 修订稿`;
  openModal({
    title: "生成新合同版本",
    fields: [
      { type: "info", tone: "warning", value: "新版本只复制条款文本；老版本未处理意见继续挂在老版本对应条款下，不自动迁入新版。" },
      { name: "label", label: "版本名称", required: true, value: defaultLabel },
      { name: "deadline", label: "本轮截止时间", type: "datetime-local", required: true },
      { name: "note", label: "版本说明", type: "textarea", required: false, value: "请逐条确认旧版未决意见是否仍适用于新版。" }
    ],
    submitLabel: "生成版本",
    onSubmit: data => {
      const id = `v${state.versions.length + 1}`;
      state.versions.forEach(item => {
        if (["active", "reopened"].includes(item.status)) item.status = "superseded";
      });
      state.versions.push({
        id,
        label: data.label.trim(),
        status: "active",
        deadline: new Date(data.deadline).toISOString(),
        createdAt: new Date().toISOString(),
        note: data.note.trim()
      });
      state.clauseTexts[id] = { ...state.clauseTexts[latestVersion.id] };
      state.opinions.forEach(item => {
        if (item.versionId !== id && uncoveredOpinions(item.versionId, item.clauseId).some(op => op.id === item.id)) {
          item.supersededNotice = true;
        }
      });
      ui.versionId = id;
      ui.filter = "pending";
      addActivity(`${data.label.trim()} 到达，老版未处理意见保持版本隔离并挂起。`);
      saveState("新版本已创建。");
    }
  });
}

function finalizeVersion() {
  const versionRecord = currentVersion();
  const blockers = versionBlockers(versionRecord.id);
  if (blockers.length) {
    openModal({
      title: `不能定稿：${versionRecord.label}`,
      fields: [
        { type: "info", tone: "danger", value: `还有 ${blockers.length} 项阻断。请逐项处理，或显式跳过并留痕后再尝试。` },
        ...blockers.slice(0, 10).map(item => ({
          type: "info",
          tone: item.severity === "冻结" ? "danger" : "warning",
          value: `${clauseMeta(item.clauseId).number}【${item.severity}】${item.text}`
        }))
      ],
      submitLabel: "知道了",
      onSubmit: () => {
        const first = blockers[0];
        ui.filter = first.severity === "冻结" ? "frozen" : first.severity === "裁定" ? "ruling" : "pending";
        render();
        document.getElementById(`clause-${first.clauseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    return;
  }
  openModal({
    title: `定稿 ${versionRecord.label}`,
    fields: [
      { type: "info", tone: "success", value: "所有意见均有结论，缺人均已回复或有跳过记录，冲突和裁定均已闭环。" },
      { name: "confirm", label: "输入“确认定稿”", required: true, placeholder: "确认定稿" }
    ],
    submitLabel: "定稿",
    onSubmit: data => {
      if (data.confirm.trim() !== "确认定稿") return false;
      versionRecord.status = "final";
      versionRecord.reopenedFromFinal = false;
      versionRecord.finalizedAt = new Date().toISOString();
      addActivity(`${versionRecord.label} 已定稿。定稿后再提意见将自动回到评审。`);
      saveState("版本已定稿。");
    }
  });
}

function resumeReview() {
  const priority = ["frozen", "blocked", "ruling", "reopened", "pending", "waiting", "suspended", "done"];
  const candidates = state.versions.flatMap(versionItem =>
    CLAUSE_DEFS.map(clauseDef => ({
      versionId: versionItem.id,
      clauseId: clauseDef.id,
      status: getClauseStatus(versionItem.id, clauseDef.id)
    }))
  ).filter(item => item.status !== "done");
  candidates.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status));
  const target = candidates[0];
  if (!target) {
    toast("所有条款均已闭环。");
    return;
  }
  ui.versionId = target.versionId;
  ui.filter = target.status === "frozen" ? "frozen" : target.status === "blocked" ? "blocked" : target.status === "ruling" ? "ruling" : "pending";
  render();
  setTimeout(() => document.getElementById(`clause-${target.clauseId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  toast(`继续处理 ${clauseMeta(target.clauseId).number}（${statusLabel(target.status)}）。`);
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function exportReport() {
  const lines = [];
  lines.push("# 合同修改对照与意见处理报告", "");
  lines.push(`导出时间：${fmtDateTime(new Date().toISOString())}`, "");

  const allBlockers = state.versions.flatMap(item =>
    versionBlockers(item.id).map(block => ({ ...block, versionId: item.id }))
  );
  lines.push("## 定稿前阻断摘要", "");
  if (allBlockers.length) {
    lines.push("| 版本 | 条款 | 类型 | 未处理事项 |", "| --- | --- | --- | --- |");
    allBlockers.forEach(item => {
      lines.push(`| ${mdCell(versionMeta(item.versionId).label)} | ${mdCell(clauseMeta(item.clauseId).number)} | ${mdCell(item.severity)} | ${mdCell(item.text)} |`);
    });
  } else {
    lines.push("无阻断事项。");
  }
  lines.push("");

  state.versions.forEach(versionRecord => {
    lines.push(`## ${versionRecord.label}`, "");
    lines.push(`- 状态：${versionStatusLabel(versionRecord.status)}`);
    lines.push(`- 创建时间：${fmtDateTime(versionRecord.createdAt)}`);
    lines.push(`- 截止时间：${fmtDateTime(versionRecord.deadline)}${isOverdue(versionRecord.deadline) ? "（已到截止）" : ""}`);
    lines.push(`- 未处理阻断：${versionBlockers(versionRecord.id).length} 项`, "");

    CLAUSE_DEFS.forEach(clauseDef => {
      const opinions = opinionsFor(versionRecord.id, clauseDef.id);
      const decision = latestDecision(versionRecord.id, clauseDef.id);
      const status = getClauseStatus(versionRecord.id, clauseDef.id);
      const conflicts = state.conflictPairs.filter(item => item.versionId === versionRecord.id && item.clauseId === clauseDef.id);
      const missing = missingPeople(versionRecord.id, clauseDef.id);
      const ruling = getRulingIssues().find(item => item.clauseId === clauseDef.id &&
        (item.previous.versionId === versionRecord.id || item.current.versionId === versionRecord.id));

      lines.push(`### ${clauseDef.number} ${clauseDef.title}`, "");
      lines.push(`- 当前状态：${statusLabel(status)}`);
      lines.push(`- 原文：${state.clauseTexts[versionRecord.id]?.[clauseDef.id] || ""}`);
      lines.push(`- 最终文本：${decision ? decision.finalText : "**尚未形成结论**"}`);
      lines.push(`- 依赖条款：${clauseDef.dependsOn.length ? clauseDef.dependsOn.map(id => clauseMeta(id).number).join("、") : "无"}`, "");

      lines.push("| 提意见人 | 时间 | 意见 | 处理 |", "| --- | --- | --- | --- |");
      if (opinions.length) {
        opinions.forEach(item => {
          const handled = decision?.opinionIds.includes(item.id);
          const afterFinal = item.afterFinal ? "（定稿后补充）" : "";
          const treatment = handled ? `已纳入 ${decision.type}` : "**未被当前结论覆盖**";
          lines.push(`| ${mdCell(person(item.personId).name)}${afterFinal} | ${fmtDateTime(item.at)} | ${mdCell(item.text)} | ${mdCell(treatment)} |`);
        });
      } else {
        lines.push("| — | — | 无版本内意见 | — |");
      }
      lines.push("");

      if (decision) {
        lines.push(`- 结论类型：${decision.type}`);
        lines.push(`- 决定人：${decision.decidedBy}`);
        lines.push(`- 理由：${decision.reason || "—"}`);
        if (decision.history?.length) {
          lines.push("- 历史结论：");
          decision.history.forEach(history => lines.push(`  - ${fmtDateTime(history.at)}：${history.finalText}`));
        }
      }

      if (conflicts.length) {
        conflicts.forEach(item => {
          lines.push(`- 冲突记录：${item.status === "open" ? "**仍冻结**" : "已解除"}；${item.reason}`);
          if (item.resolution) lines.push(`- 解冻结论：${item.resolution}`);
        });
      }
      if (ruling) {
        const record = state.rulings[ruling.key];
        lines.push(`- 前后矛盾：${person(ruling.personId).name} 两次意见不一致；${record ? `裁定以 ${record.authoritativeId === ruling.previous.id ? "前次" : "后次"}为准：${record.reason}` : "**尚未裁定**"}`);
      }
      if (missing.length) {
        missing.forEach(item => {
          const recordText = item.record
            ? `${item.record.status === "skipped" ? `已跳过：${item.record.reason}` : "未回复"}；催办 ${item.record.reminders.length} 次`
            : "未回复；无催办记录";
          lines.push(`- 未表态人员：${person(item.personId).name}（${recordText}）`);
        });
      }
      lines.push("");
    });
  });

  lines.push("## 未处理意见与跳过记录（不得略过）", "");
  const uncovered = state.versions.flatMap(versionRecord =>
    CLAUSE_DEFS.flatMap(clauseDef =>
      uncoveredOpinions(versionRecord.id, clauseDef.id).map(item => ({ version: versionRecord, clauseDef, item }))
    )
  );
  if (uncovered.length) {
    lines.push("| 版本 | 条款 | 提意见人 | 未处理意见 |", "| --- | --- | --- | --- |");
    uncovered.forEach(row => lines.push(`| ${mdCell(row.version.label)} | ${mdCell(row.clauseDef.number)} | ${mdCell(person(row.item.personId).name)} | ${mdCell(row.item.text)} |`));
  } else {
    lines.push("所有意见均已被结论覆盖。");
  }
  lines.push("");

  const skipped = state.nonResponses.filter(item => item.status === "skipped");
  if (skipped.length) {
    lines.push("### 已跳过但保留责任记录", "");
    skipped.forEach(item => lines.push(`- ${versionMeta(item.versionId).label} ${clauseMeta(item.clauseId).number}：${person(item.personId).name}，原因：${item.reason}`));
  }

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `合同修改对照-${new Date().toISOString().slice(0, 10)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  addActivity("已导出修改对照和未处理意见报告。");
  saveState("导出已生成。");
}

loadState();
render();
