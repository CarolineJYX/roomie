const saved = JSON.parse(localStorage.getItem('roomie-state') || '{}');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const HOUSE_UNLOCKS = [
  { id: 'plant', at: 10, label: '窗边绿植', blurb: '阳台终于有了呼吸感', icon: '🪴' },
  { id: 'lamp', at: 25, label: '暖光落地灯', blurb: '客厅不再忽明忽暗', icon: '💡' },
  { id: 'sofa', at: 40, label: '沙发小窝', blurb: '回家就能陷进去', icon: '🛋' },
  { id: 'kitchen', at: 55, label: '厨房焕新', blurb: '灶台亮晶晶，做饭也开心', icon: '🫧' },
  { id: 'frame', at: 75, label: '合照相框', blurb: '晚风公寓正式有了合影', icon: '🖼' }
];

const BUILD_GOAL = HOUSE_UNLOCKS[HOUSE_UNLOCKS.length - 1].at;

const seedTasks = [
  { id: 'kitchen', icon: '🫧', title: '厨房焕新计划', description: '擦灶台、清理水槽、拖一拖地面，大约 15 分钟。', kind: 'recurring', mode: 'rotate', proponent: '林夏', assignee: '林夏', due: '今天', period: '每周 · 成员轮班', points: 10, status: 'doing', active: true },
  { id: 'delivery', icon: '📦', title: '领取物业快递', description: '物业前台有一份公共区域收纳盒，请顺路带回家。', kind: 'temporary', mode: 'assign', proponent: 'Nina', assignee: '陈默', due: '今天 18:00 前', period: '一次性 · 指定任务', points: 5, status: 'doing', active: true },
  { id: 'bathroom', icon: '🛁', title: '卫生间清洁', description: '镜子、台面和地面都已经清爽啦。', kind: 'recurring', mode: 'rotate', proponent: '小宇', assignee: 'Nina', due: '昨天', period: '每周 · 成员轮班', points: 10, status: 'done', active: true },
  { id: 'fridge', icon: '🧊', title: '周日一起整理冰箱', description: '看看过期食物，也给下周的食材腾出一点空间。', kind: 'recurring', mode: 'claim', proponent: '陈默', assignee: null, due: '本周日', period: '每周 · 公开认领', points: 10, status: 'claim', active: true },
  { id: 'lamp', icon: '💡', title: '更换客厅灯泡', description: '客厅落地灯忽明忽暗，需要一只 E27 暖光灯泡。', kind: 'temporary', mode: 'claim', proponent: '林夏', assignee: null, due: '今天', period: '一次性 · 公开认领', points: 5, status: 'claim', active: true }
];

function bootstrapHouse(tasks) {
  const house = { points: 0, unlocked: [], contributions: [] };
  tasks.filter(task => task.status === 'done').forEach(task => {
    const name = task.assignee || 'Roomie';
    house.points += task.points;
    house.contributions.push({ name, points: task.points, title: task.title, at: Date.now() - 600000 });
  });
  HOUSE_UNLOCKS.forEach(item => { if (house.points >= item.at) house.unlocked.push(item.id); });
  return house;
}

const initialTasks = saved.tasks ?? seedTasks;
const appState = {
  restocked: saved.restocked ?? false,
  paid: saved.paid ?? 0,
  ruleAgreed: saved.ruleAgreed ?? false,
  name: saved.name ?? '林夏',
  avatar: saved.avatar ?? 2,
  color: saved.color ?? '#55B8B3',
  tasks: initialTasks,
  house: saved.house ? {
    points: saved.house.points ?? 0,
    unlocked: saved.house.unlocked ?? [],
    contributions: saved.house.contributions ?? []
  } : bootstrapHouse(initialTasks)
};

function persist() {
  localStorage.setItem('roomie-state', JSON.stringify(appState));
}

function isMine(task) { return task.assignee === appState.name; }

function nextUnlock(points = appState.house.points) {
  return HOUSE_UNLOCKS.find(item => !appState.house.unlocked.includes(item.id) && item.at > points) || null;
}

function stageMeta() {
  const count = appState.house.unlocked.length;
  if (count >= 5) return { label: '共建完成 · 温馨之家', status: '小屋已经很有家的味道', blurb: '合照相框挂上了，晚风公寓正式属于你们。', stage: 5 };
  if (count >= 4) return { label: '共建中 · 近乎完工', status: '只差一点点就圆满', blurb: '厨房焕新完成，合照相框还在等你们。', stage: 4 };
  if (count >= 3) return { label: '共建中 · 越来越暖', status: '沙发小窝已经就位', blurb: '完成更多任务，厨房也会亮起来。', stage: 3 };
  if (count >= 2) return { label: '共建中 · 有了灯光', status: '暖光把客厅点亮了', blurb: '再完成几件小事，就能添上沙发小窝。', stage: 2 };
  if (count >= 1) return { label: '共建中 · 有了绿意', status: '窗边绿植已安家', blurb: '继续完成任务，落地灯就会亮起来。', stage: 1 };
  return { label: '共建中 · 起步', status: '小屋刚起步', blurb: '完成任务就能添置家具，大家一起把小屋建起来。', stage: 0 };
}

function toast(message, points = 0, title) {
  $('#celebrationTitle').textContent = title || (points ? `建设值 +${points}` : '小屋有新动静');
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
  return `<article class="card house-task ${task.status === 'done' ? 'is-done' : ''} ${!task.active ? 'is-paused' : ''}" data-task-id="${task.id}"><div class="task-symbol">${task.icon}</div><div class="task-copy"><div class="task-meta"><span class="kind-chip ${task.kind}">${taskType(task)}</span><span>${task.period}</span></div><h2>${task.title}</h2><p>${task.description}</p><div class="task-foot"><span>${task.proponent} 提议</span><span>·</span><span>${task.assignee ? `本期由 ${task.assignee}` : '还没有人认领'}</span><span>·</span><span>${task.due}</span><b>+${task.points} 建设</b></div></div><div class="task-side"><span class="status-chip ${task.status}">${taskStatus(task)}</span>${controls}</div></article>`;
}

function claimCard(task) {
  return `<article class="card claim-card" data-task-id="${task.id}"><div class="claim-card-top"><span class="task-symbol">${task.icon}</span><span class="kind-chip ${task.kind}">${taskType(task)}</span></div><h2>${task.title}</h2><p>${task.description}</p><div class="claim-meta"><span>${task.proponent} 提议</span><span>${task.due}</span><span>+${task.points} 建设值</span></div><button class="primary-btn full" data-task-action="claim" data-id="${task.id}">我来做</button></article>`;
}

function renderHouse() {
  const house = appState.house;
  const meta = stageMeta();
  const upcoming = nextUnlock();
  const pct = Math.min(100, Math.round((house.points / BUILD_GOAL) * 100));
  $('#roomScene').dataset.stage = String(meta.stage);
  $('#houseStageLabel').textContent = meta.label;
  $('#buildValue').textContent = house.points;
  $('#buildBar').style.width = `${pct}%`;
  $('#buildHint').textContent = upcoming
    ? `再攒 ${upcoming.at - house.points} 建设值，解锁${upcoming.label}`
    : '小屋家具都点亮啦，继续完成任务也能照顾这个家';
  $$('#houseDecor .decor-item').forEach(item => {
    item.classList.toggle('is-on', house.unlocked.includes(item.dataset.unlock));
  });
  const unlockGrid = $('#unlockGrid');
  if (unlockGrid) {
    unlockGrid.innerHTML = HOUSE_UNLOCKS.map(item => {
      const unlocked = house.unlocked.includes(item.id);
      return `<article class="unlock-item ${unlocked ? 'is-on' : ''}"><span>${item.icon}</span><div><b>${item.label}</b><small>${unlocked ? '已共同点亮' : `${item.at} 建设值`}</small></div></article>`;
    }).join('');
  }
  const choreBtn = $('#sceneChoreBtn');
  const myDoing = appState.tasks.find(task => isMine(task) && task.status === 'doing' && task.active);
  const claimable = appState.tasks.find(task => task.status === 'claim' && task.active);
  const compact = window.matchMedia('(max-width: 720px)').matches;
  if (myDoing) {
    choreBtn.textContent = compact ? '去完成任务 →' : `去完成「${myDoing.title}」 →`;
    choreBtn.dataset.jump = 'complete';
    choreBtn.dataset.id = myDoing.id;
  } else if (claimable) {
    choreBtn.textContent = compact ? '去认领任务 →' : `去认领「${claimable.title}」 →`;
    choreBtn.dataset.jump = 'chores';
    delete choreBtn.dataset.id;
  } else {
    choreBtn.textContent = compact ? '去看任务 →' : '去看看小屋任务 →';
    choreBtn.dataset.jump = 'chores';
    delete choreBtn.dataset.id;
  }
  syncProfile();
}

function renderHomeTasks() {
  const rows = [];
  appState.tasks.filter(task => isMine(task) && task.status === 'doing' && task.active).forEach(task => {
    rows.push(`<button class="task-row" data-task-action="complete" data-id="${task.id}"><span class="task-icon mint">${task.icon}</span><span><b>${task.title}</b><small>本期由你 · 完成后建设值 +${task.points}</small></span><i>去完成</i></button>`);
  });
  appState.tasks.filter(task => task.status === 'claim' && task.active).forEach(task => {
    rows.push(`<button class="task-row" data-task-action="claim" data-id="${task.id}"><span class="task-icon yellow">${task.icon}</span><span><b>${task.title}</b><small>${task.proponent} 提议 · 等待认领</small></span><i>我来做</i></button>`);
  });
  if (!appState.ruleAgreed) {
    rows.push('<button class="task-row" data-page="rules"><span class="task-icon sage">♡</span><span><b>有一条约定等你确认</b><small>晚上 23:00 后保持安静</small></span><i>去确认</i></button>');
  }
  if (appState.paid < 2) {
    rows.push(`<button class="task-row" data-page="bills"><span class="task-icon coral">¥</span><span><b>结清 ${2 - appState.paid} 笔小账单</b><small>不着急，记得就好</small></span><i>去看看</i></button>`);
  }
  $('#homeTasks').innerHTML = rows.join('') || '<p class="empty-message">今天的小事都安顿好啦。</p>';
  const actionable = appState.tasks.filter(task => (isMine(task) && task.status === 'doing' && task.active) || (task.status === 'claim' && task.active)).length;
  $('#taskCount').textContent = `${actionable} 件`;
}

function renderTasks() {
  const schedule = appState.tasks.filter(task => task.assignee || task.status === 'done');
  const claims = appState.tasks.filter(task => task.status === 'claim' && task.active);
  $('#scheduleTasks').innerHTML = schedule.map(taskCard).join('') || '<p class="empty-message">这周的小屋很轻松，暂时没有安排。</p>';
  $('#claimTasks').innerHTML = claims.map(claimCard).join('') || '<p class="empty-message">所有小事都被好好接住啦。</p>';
  $('#scheduleCount').textContent = schedule.filter(task => task.status !== 'done').length;
  $('#claimCount').textContent = claims.length;
  $('#taskNavCount').textContent = claims.length;
  renderHomeTasks();
  renderHouse();
  persist();
}

function contributeBuild(name, points, title) {
  const house = appState.house;
  house.points += points;
  house.contributions.unshift({ name, points, title, at: Date.now() });
  const newly = HOUSE_UNLOCKS.filter(item => house.points >= item.at && !house.unlocked.includes(item.id));
  newly.forEach(item => house.unlocked.push(item.id));
  return newly;
}

function completeTask(id) {
  const task = appState.tasks.find(item => item.id === id);
  if (!task || task.status === 'done') return;
  task.status = 'done';
  const actor = task.assignee || appState.name;
  const unlocked = contributeBuild(actor, task.points, task.title);
  renderTasks();
  const unlockMsg = unlocked.length ? `解锁了${unlocked.map(item => item.label).join('、')}！` : '小屋建设值上涨啦。';
  toast(`${actor} 完成了「${task.title}」。${unlockMsg}`, task.points, unlocked.length ? `共建解锁 · ${unlocked[0].label}` : `建设值 +${task.points}`);
}

function claimTask(id) {
  const task = appState.tasks.find(item => item.id === id);
  if (!task || task.status !== 'claim') return;
  task.status = 'doing';
  task.assignee = appState.name;
  renderTasks();
  toast('这件小事交给你啦，完成后会推进小屋建设。');
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

function simulateRoommateHelp() {
  const helperTask = appState.tasks.find(task => task.status === 'doing' && task.active && task.assignee && task.assignee !== appState.name);
  if (!helperTask) {
    toast('室友手头暂时没有进行中的任务啦。');
    return;
  }
  helperTask.status = 'done';
  const unlocked = contributeBuild(helperTask.assignee, helperTask.points, helperTask.title);
  renderTasks();
  const unlockMsg = unlocked.length ? `还解锁了${unlocked.map(item => item.label).join('、')}！` : '';
  toast(`${helperTask.assignee} 帮忙完成了「${helperTask.title}」。${unlockMsg}`, helperTask.points, `室友共建 +${helperTask.points}`);
}

$$('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.modal-backdrop.open').forEach(item => closeModal(item.id)); });
$('#openAvatar').addEventListener('click', () => openModal('avatarModal'));
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
  if (event.target.closest('#sceneChoreBtn')) {
    const btn = $('#sceneChoreBtn');
    if (btn.dataset.jump === 'complete' && btn.dataset.id) completeTask(btn.dataset.id);
    else showPage('chores');
  }
  if (event.target.closest('#supplyBillBtn')) { showPage('bills'); openModal('billModal'); }
  if (event.target.closest('#roommateHelpBtn')) simulateRoommateHelp();
});

function restock() {
  if (appState.restocked) { toast('垃圾袋已经补充好啦'); return; }
  appState.restocked = true;
  $('#trashSupply').classList.add('restocked');
  $('#trashSupply small').textContent = '刚刚补充完成';
  $('#trashSupply button').outerHTML = '<button class="soft-btn" id="supplyBillBtn">记一笔 AA 账单</button>';
  toast('储物柜又充实起来啦');
  renderHomeTasks();
  persist();
}

$$('.restock-btn').forEach(button => button.addEventListener('click', restock));
$$('.pay-btn').forEach(button => button.addEventListener('click', () => {
  if (button.closest('.bill-row').classList.contains('paid')) return;
  button.closest('.bill-row').classList.add('paid');
  button.textContent = '✓ 已结清';
  button.disabled = true;
  appState.paid++;
  const amounts = [86.5, 15, 0];
  $('#dueAmount').textContent = `¥${amounts[appState.paid].toFixed(2)}`;
  toast('这一笔已经轻轻松松结清');
  renderHomeTasks();
  persist();
}));
$('#agreeRule').addEventListener('click', () => {
  if (appState.ruleAgreed) return;
  appState.ruleAgreed = true;
  const empty = $('#quietRule .empty');
  empty.className = 'avatar avatar-linxia';
  empty.textContent = appState.name[0];
  empty.style.background = appState.color;
  $('#quietRule .signatures small').textContent = '4 / 4 位 Roomie 已确认';
  $('#agreeRule').textContent = '✓ 已成为我们的小屋约定';
  $('#agreeRule').disabled = true;
  toast('大家都同意，约定正式生效啦');
  renderHomeTasks();
  persist();
});
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
  $('#openAvatar b').textContent = appState.name;
  $('#nameInput').value = appState.name;
  $('#avatarPreview').className = `avatar-sprite avatar-sprite-${appState.avatar}`;
  $$('.avatar-choice').forEach(item => item.classList.toggle('selected', Number(item.dataset.avatar) === appState.avatar));
  $('.big-avatar').style.background = `linear-gradient(180deg,${appState.color}55,#f8e0b6)`;
  $$('.avatar-linxia').forEach(item => {
    item.textContent = appState.name[0];
    item.style.background = appState.color;
  });
  const level = 1 + appState.house.unlocked.length;
  const levelEl = $('#openAvatar small');
  if (levelEl) levelEl.textContent = `Lv. ${level}`;
}

function restore() {
  syncProfile();
  if (appState.restocked) {
    $('#trashSupply').classList.add('restocked');
    $('#trashSupply small').textContent = '已经补充好啦';
    $('#trashSupply button').outerHTML = '<button class="soft-btn" id="supplyBillBtn">记一笔 AA 账单</button>';
  }
  if (appState.ruleAgreed) {
    const empty = $('#quietRule .empty');
    if (empty) {
      empty.className = 'avatar avatar-linxia';
      empty.textContent = appState.name[0];
      empty.style.background = appState.color;
    }
    $('#quietRule .signatures small').textContent = '4 / 4 位 Roomie 已确认';
    $('#agreeRule').textContent = '✓ 已成为我们的小屋约定';
    $('#agreeRule').disabled = true;
  }
  renderTasks();
}

restore();

window.matchMedia('(max-width: 720px)').addEventListener('change', () => {
  if ($('#roomScene')) renderHouse();
});
