const saved = JSON.parse(localStorage.getItem('roomie-state') || '{}');
const preferences = JSON.parse(localStorage.getItem('roomie-preferences') || '{}');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const seedTasks = [
  { id: 'kitchen', icon: '🫧', title: '厨房焕新计划', description: '擦灶台、清理水槽、拖一拖地面，大约 20 分钟。', kind: 'recurring', mode: 'rotate', proponent: '林夏', assignee: '林夏', due: '今天', period: '每周 · 成员轮班', points: 10, priority: 'high', estimateMinutes: 20, status: 'doing', active: true },
  { id: 'delivery', icon: '📦', title: '领取物业快递', description: '物业前台有一份公共区域收纳盒，请顺路带回家。', kind: 'temporary', mode: 'assign', proponent: 'Nina', assignee: '陈默', due: '今天 18:00 前', period: '一次性 · 指定任务', points: 5, priority: 'normal', estimateMinutes: 10, status: 'doing', active: true },
  { id: 'bathroom', icon: '🛁', title: '卫生间清洁', description: '镜子、台面和地面都已经清爽啦。', kind: 'recurring', mode: 'rotate', proponent: '小宇', assignee: 'Nina', due: '昨天', period: '每周 · 成员轮班', points: 10, priority: 'normal', estimateMinutes: 20, status: 'done', active: true },
  { id: 'fridge', icon: '🧊', title: '周日一起整理冰箱', description: '看看过期食物，也给下周的食材腾出一点空间。', kind: 'recurring', mode: 'claim', proponent: '陈默', assignee: null, due: '本周日', period: '每周 · 公开认领', points: 10, priority: 'low', estimateMinutes: 15, status: 'claim', active: true },
  { id: 'lamp', icon: '💡', title: '更换客厅灯泡', description: '客厅落地灯忽明忽暗，需要一只 E27 暖光灯泡。', kind: 'temporary', mode: 'claim', proponent: '林夏', assignee: null, due: '今天', period: '一次性 · 公开认领', points: 5, priority: 'high', estimateMinutes: 10, status: 'claim', active: true }
];

const taskDefaults = {
  kitchen: ['high', 20], delivery: ['normal', 10], bathroom: ['normal', 20], fridge: ['low', 15], lamp: ['high', 10]
};
const initialTasks = (saved.tasks ?? seedTasks).map(task => {
  const fallback = taskDefaults[task.id] || ['normal', 15];
  return { ...task, priority: task.priority ?? fallback[0], estimateMinutes: task.estimateMinutes ?? fallback[1] };
});
function migrateAlpacaState(previous) {
  if (!previous) return { yarnBalls: 4, lifetimeYarnBalls: 4, rewardModelVersion: 3 };
  if (previous.rewardModelVersion === 3) return {
    yarnBalls: Math.max(0, Number(previous.yarnBalls ?? 0)),
    lifetimeYarnBalls: Math.max(0, Number(previous.lifetimeYarnBalls ?? previous.yarnBalls ?? 0)),
    rewardModelVersion: 3
  };
  const migratedReward = Number(previous.brushProgress ?? 0) > 0 ? 1 : 0;
  const migratedTotal = Math.max(0, Number(previous.yarnBalls ?? 4)) + migratedReward + Math.max(0,Number(previous.pendingYarnBalls ?? 0));
  return {
    yarnBalls: migratedTotal,
    lifetimeYarnBalls: Math.max(0, Number(previous.lifetimeYarnBalls ?? previous.yarnBalls ?? 4)) + migratedReward,
    rewardModelVersion: 3
  };
}
const appState = {
  restocked: saved.restocked ?? false,
  paid: saved.paid ?? 0,
  ruleAgreed: saved.ruleAgreed ?? false,
  name: saved.name ?? '林夏',
  avatar: preferences.avatar ?? saved.avatar ?? 2,
  color: preferences.color ?? saved.color ?? '#55B8B3',
  house: {
    name: saved.house?.name ?? '晚风公寓',
    inviteCode: saved.house?.inviteCode ?? 'ROOMIE88',
    joinedCode: saved.house?.joinedCode ?? null
  },
  tasks: initialTasks,
  createdBills: saved.createdBills ?? [],
  createdSupplies: saved.createdSupplies ?? [],
  createdRules: saved.createdRules ?? [],
  alpaca: migrateAlpacaState(saved.alpaca),
  charity: saved.charity ?? { houseDonationCents: 0, selectedCause: null, receipts: [] },
  rewardedActionIds: saved.rewardedActionIds ?? []
};

let alpacaGame = null;

function persist() {
  localStorage.setItem('roomie-preferences', JSON.stringify({ avatar: appState.avatar, color: appState.color }));
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || '小屋暂时没有回应，请稍后再试');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function hydrate(state) {
  ['name','restocked','paid','ruleAgreed','house','tasks','alpaca','charity','rewardedActionIds','createdBills','createdSupplies','createdRules'].forEach(key => {
    if (state[key] !== undefined) appState[key] = state[key];
  });
}

function isMine(task) { return task.assignee === appState.name; }

function toast(message, points = 0, title) {
  $('#celebrationTitle').textContent = title || (points ? `暖心进度 +${points}` : '小屋有新动静');
  $('#celebrationText').textContent = message;
  $('#celebration').classList.add('show');
  persist();
  window.setTimeout(() => $('#celebration').classList.remove('show'), 2800);
}

function showPage(page) {
  $$('.page').forEach(item => item.classList.remove('active'));
  $(`#${page}Page`).classList.add('active');
  $$('[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(id) { $(`#${id}`).classList.add('open'); }
function closeModal(id) { $(`#${id}`).classList.remove('open'); }
function taskType(task) { return task.kind === 'recurring' ? '长期任务' : '临时任务'; }
function priorityLabel(priority) { return priority === 'high' ? '高优先' : priority === 'low' ? '可稍后' : '普通'; }
function priorityRank(priority) { return priority === 'high' ? 0 : priority === 'normal' ? 1 : 2; }
function taskStatus(task) {
  if (!task.active && task.kind === 'recurring') return '已暂停';
  if (task.status === 'done') return '已完成';
  if (task.status === 'claim') return '等待认领';
  return '进行中';
}

function taskCard(task) {
  const mine = isMine(task);
  const controls = task.status === 'done'
    ? '<span class="task-done">✓ 已完成</span>'
    : !task.active
      ? `<button class="soft-btn" data-task-action="resume" data-id="${task.id}">恢复计划</button>`
      : mine && task.status === 'doing'
        ? `<div class="task-controls"><button class="soft-btn" data-task-action="abandon" data-id="${task.id}">${task.mode === 'claim' ? '放弃认领' : '转交给小宇'}</button><button class="primary-btn" data-task-action="complete" data-id="${task.id}">完成打卡</button></div>`
        : task.id === 'kitchen' && mine
          ? `<button class="soft-btn" data-task-action="pause" data-id="${task.id}">暂停计划</button>`
          : `<span class="task-assignee">${task.assignee} 正在处理</span>`;
  return `<article class="card house-task ${task.status === 'done' ? 'is-done' : ''} ${!task.active ? 'is-paused' : ''}" data-task-id="${task.id}"><div class="task-symbol">${task.icon}</div><div class="task-copy"><div class="task-meta"><span class="kind-chip ${task.kind}">${taskType(task)}</span><span class="priority-chip ${task.priority}">${priorityLabel(task.priority)}</span><span>预计 ${task.estimateMinutes} 分钟</span><span>${task.period}</span></div><h2>${task.title}</h2><p>${task.description}</p><div class="task-foot"><span>${task.proponent} 提议</span><span>·</span><span>${task.assignee ? `本期由 ${task.assignee}` : '还没有人认领'}</span><span>·</span><span>${task.due}</span><b>完成得 1 个毛线球</b></div></div><div class="task-side"><span class="status-chip ${task.status}">${taskStatus(task)}</span>${controls}</div></article>`;
}

function claimCard(task) {
  return `<article class="card claim-card" data-task-id="${task.id}"><div class="claim-card-top"><span class="task-symbol">${task.icon}</span><div><span class="kind-chip ${task.kind}">${taskType(task)}</span><span class="priority-chip ${task.priority}">${priorityLabel(task.priority)}</span></div></div><h2>${task.title}</h2><p>${task.description}</p><div class="claim-meta"><span>${task.proponent} 提议</span><span>${task.due}</span><span>预计 ${task.estimateMinutes} 分钟</span></div><button class="primary-btn full" data-task-action="claim" data-id="${task.id}">我来做</button></article>`;
}

function renderHouse() {
  const yarnBalls = Math.min(appState.alpaca.yarnBalls, 5);
  const yarnText = $('#petYarnText');
  const progressFill = $('#petProgressFill');
  const petEntry = $('.pet-entry');
  if (yarnText) yarnText.textContent = `暖心毛线 ${appState.alpaca.yarnBalls}/5`;
  if (progressFill) progressFill.style.width = `${yarnBalls * 20}%`;
  if (petEntry) petEntry.setAttribute('aria-label', `进入小屋公益，暖心毛线 ${yarnBalls}/5`);
  syncProfile();
}

function renderHomeTasks() {
  const mine = appState.tasks.filter(task => isMine(task) && task.status === 'doing' && task.active).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const claimable = appState.tasks.filter(task => task.status === 'claim' && task.active).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const rows = mine.map(task => `<button class="task-row" data-task-action="complete" data-id="${task.id}"><span class="task-icon mint">${task.icon}</span><span><b>${task.title}</b><small><em class="priority-text ${task.priority}">${priorityLabel(task.priority)}</em> · 预计 ${task.estimateMinutes} 分钟 · ${task.due}</small></span><i>完成</i></button>`)
    .concat(claimable.map(task => `<button class="task-row" data-task-action="claim" data-id="${task.id}"><span class="task-icon yellow">${task.icon}</span><span><b>${task.title}</b><small><em class="priority-text ${task.priority}">${priorityLabel(task.priority)}</em> · 预计 ${task.estimateMinutes} 分钟 · ${task.proponent} 提议</small></span><i>我来做</i></button>`));
  const homeTaskList = $('#homeTasks');
  const isEmpty = rows.length === 0;
  homeTaskList.innerHTML = rows.slice(0, 5).join('') || '<p class="compact-empty">任务都完成啦，轻轻松松。</p>';
  homeTaskList.closest('.home-task-card').classList.toggle('is-empty', isEmpty);
  const actionable = appState.tasks.filter(task => (isMine(task) && task.status === 'doing' && task.active) || (task.status === 'claim' && task.active)).length;
  const taskCount = $('#taskCount');
  if (taskCount) taskCount.textContent = `${actionable} 件`;
}

function renderHomeBills() {
  const list = $('#homeBills');
  if (!list) return;
  const allPayButtons = $$('.pay-btn');
  const unpaid = allPayButtons
    .map((button, index) => ({ button, index, row: button.closest('.bill-row') }))
    .filter(item => !item.row.classList.contains('paid'))
    .slice(0, 2);
  const isEmpty = unpaid.length === 0;
  list.innerHTML = unpaid.map(({ index, row }) => {
    const icon = $('.bill-icon', row).textContent;
    const title = $('div:nth-child(2) b', row).textContent;
    const meta = $('div:nth-child(2) small', row).textContent;
    const price = $('.bill-price b', row).textContent;
    return `<div class="home-bill-row"><span class="bill-icon">${icon}</span><div><b>${title}</b><small>${meta}</small></div><strong>${price}</strong><button class="soft-btn" data-home-pay-index="${index}">结清</button></div>`;
  }).join('') || '<p class="compact-empty">账单都结清啦，轻轻松松。</p>';
  list.closest('.home-bill-card').classList.toggle('is-empty', isEmpty);
  const remainingAmounts = [86.5, 15, 0];
  $('#homeDueAmount').textContent = `¥${remainingAmounts[Math.min(appState.paid, 2)].toFixed(2)}`;
}

function renderHomeRule() {
  const agreed = appState.ruleAgreed;
  const homeStatus = $('#homeRuleStatus');
  const pageStatus = $('#rulePageStatus');
  [homeStatus, pageStatus].filter(Boolean).forEach(status => {
    status.textContent = agreed ? '已共同确认' : '等待你的确认';
    status.className = `tag ${agreed ? 'sage' : 'coral'}`;
  });
  const homeMe = $('.home-rule-me');
  if (homeMe) {
    homeMe.textContent = agreed ? appState.name[0] : '你';
    homeMe.className = `avatar home-rule-me${agreed ? ' avatar-linxia' : ''}`;
    homeMe.style.background = agreed ? appState.color : '#f0eee6';
  }
  const pageMe = $('#quietRule .signatures .empty, #quietRule .signatures .avatar-linxia:last-of-type');
  if (pageMe && agreed) {
    pageMe.className = 'avatar avatar-linxia';
    pageMe.textContent = appState.name[0];
    pageMe.style.background = appState.color;
  }
  const signatureText = $('#quietRule .signatures small');
  if (signatureText) signatureText.textContent = agreed ? '4 / 4 位 Roomie 已确认' : '3 / 4 位 Roomie 已确认';
  $('#quietRule').hidden = agreed;
  $('.confirmed-quiet-rule').hidden = !agreed;
  $('.home-rule-main').hidden = agreed;
  $('.home-confirmed-quiet').hidden = !agreed;
  $('#rulesPage .rules-layout').classList.toggle('all-confirmed', agreed);
  if (homeStatus && agreed) homeStatus.textContent = '3 条已生效';
  [['#agreeRule', '✓ 已成为我们的小屋约定'], ['#homeAgreeRule', '✓ 已确认']].forEach(([selector, doneText]) => {
    const button = $(selector);
    if (!button) return;
    button.textContent = agreed ? doneText : '我也同意';
    button.disabled = agreed;
  });
  syncProfile();
}

function renderTasks() {
  const schedule = appState.tasks.filter(task => task.assignee || task.status === 'done');
  const claims = appState.tasks.filter(task => task.status === 'claim' && task.active);
  $('#scheduleTasks').innerHTML = schedule.map(taskCard).join('') || '<p class="compact-empty">✓ 这周的小屋很轻松，暂时没有新的安排。</p>';
  $('#claimTasks').innerHTML = claims.map(claimCard).join('') || '<p class="compact-empty">✓ 所有小事都被接住啦，谢谢每一位 Roomie。</p>';
  $('#scheduleTasks').classList.toggle('is-empty', schedule.length === 0);
  $('#claimTasks').classList.toggle('is-empty', claims.length === 0);
  $('#scheduleCount').textContent = schedule.filter(task => task.status !== 'done').length;
  $('#claimCount').textContent = claims.length;
  $('#taskNavCount').textContent = claims.length;
  renderHomeTasks();
  renderHouse();
  persist();
}

function rewardRoomieAction(actionId, type, label) {
  if (!alpacaGame || appState.rewardedActionIds.includes(actionId)) return false;
  const accepted = alpacaGame.reward({ id: actionId, type, label });
  if (!accepted) return false;
  appState.rewardedActionIds.push(actionId);
  persist();
  if (!$('#charityExperienceModal').classList.contains('open')) toast('毛线球 +1，谢谢你照顾我们的小屋。', 0, `${label}已完成`);
  return true;
}

function completeTask(id) {
  const task = appState.tasks.find(item => item.id === id);
  if (!task || task.status === 'done') return;
  task.status = 'done';
  const actor = task.assignee || appState.name;
  renderTasks();
  const rewardId = `task:${task.id}`;
  const rewarded = rewardRoomieAction(rewardId, 'task', task.title);
  if (!rewarded) toast(`${actor} 完成了「${task.title}」。`, 0, '小事完成啦');
}

function claimTask(id) {
  const task = appState.tasks.find(item => item.id === id);
  if (!task || task.status !== 'claim') return;
  task.status = 'doing';
  task.assignee = appState.name;
  renderTasks();
  toast('这件小事交给你啦，完成后会得到 1 个毛线球。');
  $$('.task-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.taskView === 'schedule'));
  $$('.task-view').forEach(view => view.classList.toggle('active', view.id === 'scheduleView'));
}

function manageTask(action, id) {
  const task = appState.tasks.find(item => item.id === id);
  if (!task) return;
  if (action === 'claim') return claimTask(id);
  if (action === 'complete') return completeTask(id);
  if (action === 'pause') { task.active = false; toast('长期任务先安静休息一下，随时可以恢复。'); }
  if (action === 'resume') { task.active = true; toast('计划恢复啦，下一个周期会继续轮转。'); }
  if (action === 'abandon') {
    if (task.mode === 'claim') {
      task.status = 'claim';
      task.assignee = null;
      toast('已放回待认领池，等一位 Roomie 接住它。');
    } else {
      task.assignee = '小宇';
      toast('已经转交给小宇，记得和他打个招呼。');
    }
  }
  renderTasks();
}

$$('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.modal-backdrop.open').forEach(item => closeModal(item.id)); });
function closeProfileMenu() {
  $('#profileMenu').classList.remove('open');
  $('#openProfileMenu').setAttribute('aria-expanded', 'false');
}

$('#openProfileMenu').addEventListener('click', event => {
  event.stopPropagation();
  const isOpen = $('#profileMenu').classList.toggle('open');
  $('#openProfileMenu').setAttribute('aria-expanded', String(isOpen));
});
$('#profileMenu').addEventListener('click', event => event.stopPropagation());
document.addEventListener('click', closeProfileMenu);
$('#editAvatarAction').addEventListener('click', () => { closeProfileMenu(); openModal('avatarModal'); });
$('#houseJoinAction').addEventListener('click', () => { closeProfileMenu(); openHouseModal('create'); });
$('#houseSettingsAction').addEventListener('click', () => { closeProfileMenu(); openHouseModal('create', true); });
$('#openCharityExperience').addEventListener('click', () => openModal('charityExperienceModal'));
$('#addBillBtn').addEventListener('click', () => openModal('billModal'));
$('#openTaskModal').addEventListener('click', () => openModal('taskModal'));
$$('.task-tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.task-tab').forEach(item => item.classList.toggle('active', item === tab));
  $$('.task-view').forEach(view => view.classList.toggle('active', view.id === `${tab.dataset.taskView}View`));
}));
$$('.avatar-choice').forEach(button => button.addEventListener('click', () => {
  $$('.avatar-choice').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  appState.avatar = Number(button.dataset.avatar);
  $('#avatarPreview').className = `avatar-sprite avatar-sprite-${appState.avatar}`;
}));
$$('.color-options button').forEach(button => button.addEventListener('click', () => {
  $$('.color-options button').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  appState.color = button.dataset.color;
  $('.big-avatar').style.background = `linear-gradient(180deg,${appState.color}55,#f8e0b6)`;
}));

function setHouseMode(mode) {
  $$('[data-house-mode]').forEach(button => button.classList.toggle('active', button.dataset.houseMode === mode));
  $$('[data-house-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.housePanel === mode));
  $('#houseInviteResult').hidden = true;
}

function openHouseModal(mode = 'create', settings = false) {
  setHouseMode(mode);
  $('#houseModalTitle').textContent = settings ? '当前小屋设置' : '创建或加入小屋';
  $('#createHouseForm').elements.houseName.value = appState.house.name;
  openModal('houseModal');
}

$$('[data-house-mode]').forEach(button => button.addEventListener('click', () => setHouseMode(button.dataset.houseMode)));
$('#createHouseForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get('houseName').trim();
  if (!name) return;
  appState.house.name = name;
  appState.house.inviteCode = `RM${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  appState.house.joinedCode = null;
  $('#houseInviteCode').textContent = appState.house.inviteCode;
  $('#houseInviteResult').hidden = false;
  syncProfile();
  persist();
  toast(`${name} 已准备好，邀请室友一起来吧。`, 0, '小屋创建成功');
});
$('#joinHouseForm').addEventListener('submit', event => {
  event.preventDefault();
  const code = new FormData(event.currentTarget).get('inviteCode').trim().toUpperCase();
  if (!code) return;
  appState.house.joinedCode = code;
  appState.house.name = code === 'ROOMIE88' ? '晚风公寓' : 'Roomie 的新小屋';
  syncProfile();
  persist();
  closeModal('houseModal');
  toast(`已加入${appState.house.name}，一起把日子过好。`, 0, '欢迎回家');
});
$('#saveAvatar').addEventListener('click', () => {
  const previous = appState.name;
  appState.name = $('#nameInput').value.trim() || '林夏';
  appState.tasks.forEach(task => {
    if (task.assignee === previous) task.assignee = appState.name;
    if (task.proponent === previous) task.proponent = appState.name;
  });
  syncProfile();
  closeModal('avatarModal');
  renderTasks();
  renderHomeRule();
  toast('新形象已经住进小屋啦');
  persist();
});
$('#taskForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const kind = form.get('taskKind');
  const mode = form.get('taskMode');
  const assignee = mode === 'claim' ? null : mode === 'assign' ? form.get('taskAssignee') : appState.name;
  appState.tasks.unshift({
    id: `task-${Date.now()}`,
    icon: kind === 'recurring' ? '🪴' : '✦',
    title: form.get('taskTitle'),
    description: form.get('taskDescription') || '一件需要大家一起照看的小事。',
    kind,
    mode,
    proponent: appState.name,
    assignee,
    due: form.get('taskDue'),
    period: kind === 'recurring'
      ? `${form.get('taskCycle')} · ${mode === 'rotate' ? '成员轮班' : mode === 'claim' ? '公开认领' : '指定任务'}`
      : `一次性 · ${mode === 'claim' ? '公开认领' : '指定任务'}`,
    points: Number(form.get('taskPoints')),
    priority: form.get('taskPriority'),
    estimateMinutes: Number(form.get('taskEstimate')),
    status: mode === 'claim' ? 'claim' : 'doing',
    active: true
  });
  event.currentTarget.reset();
  closeModal('taskModal');
  renderTasks();
  const isClaim = mode === 'claim';
  toast(isClaim ? '任务已放进待认领池啦。' : '这件小事已经安排好啦。');
  $$('.task-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.taskView === (isClaim ? 'claim' : 'schedule')));
  $$('.task-view').forEach(view => view.classList.toggle('active', view.id === `${isClaim ? 'claim' : 'schedule'}View`));
});
const taskMode = $('#taskForm select[name="taskMode"]');
const taskKind = $('#taskForm select[name="taskKind"]');
function updateTaskForm() {
  $('#assigneeField').classList.toggle('hidden-field', taskMode.value !== 'assign');
  $('#cycleField').classList.toggle('hidden-field', taskKind.value !== 'recurring');
}
taskMode.addEventListener('change', updateTaskForm);
taskKind.addEventListener('change', updateTaskForm);
updateTaskForm();

document.addEventListener('click', event => {
  const action = event.target.closest('[data-task-action]');
  if (action) manageTask(action.dataset.taskAction, action.dataset.id);
  const homePay = event.target.closest('[data-home-pay-index]');
  if (homePay) {
    const target = $$('.pay-btn')[Number(homePay.dataset.homePayIndex)];
    if (target && !target.disabled) target.click();
  }
  if (event.target.closest('#supplyBillBtn')) { showPage('bills'); openModal('billModal'); }
});

function restock() {
  if (appState.restocked) { toast('垃圾袋已经补充好啦'); return; }
  appState.restocked = true;
  $('#trashSupply').classList.add('restocked');
  $('#trashSupply small').textContent = '刚刚补充完成';
  $('#trashSupply button').outerHTML = '<button class="soft-btn" id="supplyBillBtn">记一笔 AA 账单</button>';
  renderHomeTasks();
  persist();
  rewardRoomieAction('supply:trash-bags', 'supply', '补充垃圾袋');
}

$$('.restock-btn').forEach(button => button.addEventListener('click', restock));
$$('.pay-btn').forEach((button, index) => button.addEventListener('click', () => {
  if (button.closest('.bill-row').classList.contains('paid')) return;
  button.closest('.bill-row').classList.add('paid');
  button.textContent = '✓ 已结清';
  button.disabled = true;
  appState.paid++;
  const amounts = [86.5, 15, 0];
  $('#dueAmount').textContent = `¥${amounts[appState.paid].toFixed(2)}`;
  renderHomeTasks();
  renderHomeBills();
  persist();
  rewardRoomieAction(`bill:${index}`, 'bill', button.closest('.bill-row').querySelector('b').textContent);
}));
function agreeToRule() {
  if (appState.ruleAgreed) return;
  appState.ruleAgreed = true;
  renderHomeTasks();
  renderHomeRule();
  persist();
  rewardRoomieAction('rule:quiet-hours', 'rule', '确认安静时间公约');
}
$('#agreeRule').addEventListener('click', agreeToRule);
$('#homeAgreeRule').addEventListener('click', agreeToRule);
$('#billForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const amount = Number(form.get('amount'));
  closeModal('billModal');
  event.currentTarget.reset();
  toast(`${form.get('title')} 已按每人 ¥${(amount / 4).toFixed(2)} 分好`);
});

function syncProfile() {
  $('#greetingText').textContent = `下午好，${appState.name}`;
  $('#openProfileMenu b').textContent = appState.name;
  $('#profileMenuName').textContent = appState.name;
  $('#nameInput').value = appState.name;
  $('#avatarPreview').className = `avatar-sprite avatar-sprite-${appState.avatar}`;
  $$('.avatar-choice').forEach(item => item.classList.toggle('selected', Number(item.dataset.avatar) === appState.avatar));
  $('.big-avatar').style.background = `linear-gradient(180deg,${appState.color}55,#f8e0b6)`;
  const avatarPositions = ['0% 0%', '33.333% 0%', '66.666% 0%', '100% 0%', '0% 100%', '33.333% 100%', '66.666% 100%', '100% 100%'];
  $$('.avatar-linxia').forEach(item => {
    item.textContent = '';
    item.setAttribute('aria-label', appState.name);
    item.style.backgroundColor = appState.color;
    item.style.backgroundImage = "url('./assets/roomie-avatar-sprites.png')";
    item.style.backgroundSize = '400% 200%';
    item.style.backgroundPosition = avatarPositions[appState.avatar - 1] || avatarPositions[1];
  });
  $$('[data-house-name]').forEach(item => { item.textContent = appState.house.name; });
}

function renderCreatedRecords() {
  $$('.server-created').forEach(item => item.remove());
  const billHost = $('#billsPage .list-card');
  (appState.createdBills || []).forEach(bill => billHost.insertAdjacentHTML('beforeend', `<div class="bill-row server-created ${bill.paid ? 'paid' : ''}"><span class="bill-icon">🧾</span><div><b>${bill.title}</b><small>${bill.payer} 垫付 · 新建账单</small></div><div></div><div class="bill-price"><b>¥${Number(bill.amount).toFixed(2)}</b><small>总金额</small></div><button class="soft-btn server-pay" data-bill-id="${bill.id}" ${bill.paid ? 'disabled' : ''}>${bill.paid ? '✓ 已结清' : '结清'}</button></div>`));
  const supplyHost = $('#suppliesPage .shelf-grid');
  (appState.createdSupplies || []).forEach(item => supplyHost.insertAdjacentHTML('beforeend', `<article class="supply-item server-created ${item.status === 'empty' ? 'urgent' : item.status === 'low' ? 'low' : ''}"><span class="supply-emoji">📦</span><div><b>${item.name}</b><small>${item.note || (item.status === 'good' ? '库存充足' : '记得及时补充')}</small></div><span class="status-good">已登记</span></article>`));
  const ruleHost = $('#rulesPage .rule-list');
  (appState.createdRules || []).forEach(item => ruleHost.insertAdjacentHTML('beforeend', `<article class="card mini-rule server-created"><span>♡</span><div><small>${item.category}</small><h3>${item.title}</h3><p>${item.description || '等待大家一起确认'}</p></div><b>·</b></article>`));
}

async function remoteMutation(path, method, body, rewarded = false) {
  try {
    const payload = await api(path, { method, body: JSON.stringify(body || {}) });
    hydrate(payload.state);
    if (rewarded) sessionStorage.setItem('roomie-reward-feedback', '1');
    location.reload();
  } catch (error) { toast(error.message, 0, '还差一点点'); }
}

document.addEventListener('submit', event => {
  const form = event.target;
  if (!['billForm','taskForm','supplyForm','ruleForm'].includes(form.id)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const data = Object.fromEntries(new FormData(form));
  if (form.id === 'billForm') return remoteMutation('/api/bills','POST',{ title:data.title, amount:Number(data.amount), payer:data.payer });
  if (form.id === 'supplyForm') return remoteMutation('/api/supplies','POST',data);
  if (form.id === 'ruleForm') return remoteMutation('/api/rules','POST',data);
  const kind=data.taskKind, mode=data.taskMode;
  return remoteMutation('/api/tasks','POST',{ icon:kind==='recurring'?'🪴':'✦', title:data.taskTitle, description:data.taskDescription||'一件需要大家一起照看的小事。', kind, mode, proponent:appState.name, assignee:mode==='claim'?null:mode==='assign'?data.taskAssignee:appState.name, due:data.taskDue, period:kind==='recurring'?`${data.taskCycle} · ${mode==='rotate'?'成员轮班':mode==='claim'?'公开认领':'指定任务'}`:`一次性 · ${mode==='claim'?'公开认领':'指定任务'}`, points:5, priority:data.taskPriority, estimateMinutes:Number(data.taskEstimate), status:mode==='claim'?'claim':'doing', active:true });
}, true);

document.addEventListener('click', event => {
  const taskAction = event.target.closest('[data-task-action]');
  if (taskAction) { event.preventDefault(); event.stopImmediatePropagation(); return remoteMutation(`/api/tasks/${taskAction.dataset.id}`,'PATCH',{action:taskAction.dataset.taskAction},taskAction.dataset.taskAction==='complete'); }
  const serverPay = event.target.closest('[data-bill-id]');
  if (serverPay) { event.preventDefault(); event.stopImmediatePropagation(); return remoteMutation(`/api/bills/${serverPay.dataset.billId}/pay`,'PATCH',{},true); }
  const pay = event.target.closest('.pay-btn');
  if (pay) { event.preventDefault(); event.stopImmediatePropagation(); const id=pay.closest('#electricBill')?'electric':'tissue'; return remoteMutation(`/api/bills/${id}/pay`,'PATCH',{},true); }
  const restockButton = event.target.closest('.restock-btn');
  if (restockButton) { event.preventDefault(); event.stopImmediatePropagation(); return remoteMutation('/api/supplies/trash-bags','PATCH',{action:'restock'},true); }
  const agree = event.target.closest('#agreeRule,#homeAgreeRule');
  if (agree) { event.preventDefault(); event.stopImmediatePropagation(); return remoteMutation('/api/rules/quiet-hours/agree','PATCH',{},true); }
}, true);

function restore() {
  alpacaGame = window.RoomieAlpacaGame.init({
    container: '#alpacaGameMount',
    yarnBalls: appState.alpaca.yarnBalls,
    lifetimeYarnBalls: appState.alpaca.lifetimeYarnBalls,
    donationCents: appState.charity.houseDonationCents,
    selectedCause: appState.charity.selectedCause,
    receipts: appState.charity.receipts,
    causes: ['困境青年生活包', '留守儿童关怀', '女性专项支持'],
    onStateChange(nextState) {
      appState.alpaca = {
        yarnBalls: nextState.yarnBalls,
        lifetimeYarnBalls: nextState.lifetimeYarnBalls,
        rewardModelVersion: 3
      };
      appState.charity = {
        houseDonationCents: nextState.donationCents,
        selectedCause: nextState.selectedCause,
        receipts: nextState.receipts
      };
      persist();
      renderHouse();
    },
    onDonation(receipt) {
      api('/api/charity/donate', { method:'POST', body:JSON.stringify({ cause:receipt.cause }) }).catch(error => toast(error.message,0,'公益记录未保存'));
    }
  });
  syncProfile();
  if (appState.restocked) {
    $('#trashSupply').classList.add('restocked');
    $('#trashSupply small').textContent = '已经补充好啦';
    $('#trashSupply button').outerHTML = '<button class="soft-btn" id="supplyBillBtn">记一笔 AA 账单</button>';
  }
  $$('.pay-btn').forEach((button, index) => {
    if (index >= appState.paid) return;
    button.closest('.bill-row').classList.add('paid');
    button.textContent = '✓ 已结清';
    button.disabled = true;
  });
  renderTasks();
  renderCreatedRecords();
  renderHomeBills();
  renderHomeRule();
}

async function bootstrap() {
  $('#startupError').hidden = true;
  try {
    const payload = await api('/api/state');
    hydrate(payload.state);
    closeModal('demoLoginModal');
    restore();
    if (sessionStorage.getItem('roomie-reward-feedback')) {
      sessionStorage.removeItem('roomie-reward-feedback');
      toast('毛线球 +1，谢谢你照顾我们的小屋。',0,'小屋事务已完成');
    }
  } catch (error) {
    if (error.status === 401) $('#demoLoginModal').classList.add('open');
    else $('#startupError').hidden = false;
  }
}

$('#demoLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const nickname = new FormData(event.currentTarget).get('nickname').trim();
  try { await api('/api/demo/login',{method:'POST',body:JSON.stringify({nickname})}); location.reload(); }
  catch (error) { toast(error.message,0,'暂时进不了小屋'); }
});
$('#restartDemoAction').addEventListener('click', () => { closeProfileMenu(); $('#demoLoginModal').classList.add('open'); });
$('#retryStartup').addEventListener('click', bootstrap);
$('#addSupplyBtn').addEventListener('click', () => openModal('supplyModal'));
$('#addRuleBtn').addEventListener('click', () => openModal('ruleModal'));

bootstrap();

window.matchMedia('(max-width: 720px)').addEventListener('change', () => {
  if ($('#roomScene')) renderHouse();
});
