(function () {
  'use strict';

  const DEFAULT_CAUSES = ['困境青年生活包', '留守儿童关怀', '女性专项支持'];
  let root = null;
  let state = null;
  let options = {};
  let locked = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function normalize(input) {
    return {
      yarnBalls: Math.max(0, Number(input.yarnBalls ?? 4)),
      lifetimeYarnBalls: Math.max(0, Number(input.lifetimeYarnBalls ?? input.yarnBalls ?? 4)),
      donationCents: Math.max(0, Number(input.donationCents ?? 0)),
      selectedCause: input.selectedCause || null,
      receipts: Array.isArray(input.receipts) ? input.receipts : []
    };
  }

  function sceneMarkup() {
    return `
      <section class="rumi-game" aria-label="绒米暖心毛线计划">
        <header class="rumi-copy">
          <span class="rumi-kicker">ROOMIE 公益概念体验</span>
          <h1>照顾小屋，也为世界添一点暖</h1>
          <p>每完成一项合租事务，绒米就会收获一个暖心毛线球。</p>
        </header>
        <div class="rumi-stage" aria-hidden="true">
          <div class="rumi-shadow"></div>
          <div class="rumi-alpaca" data-rumi-character><img src="./assets/rumi-full.png" alt="" /></div>
          <div class="rumi-brush">▥</div>
          <div class="rumi-fluff"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="rumi-new-ball">〰</div>
        </div>
        <aside class="rumi-hud">
          <div class="rumi-name"><span>🦙</span><div><b>绒米 Rumi</b><small>晚风公寓的公益小室友</small></div></div>
          <div class="rumi-yarn-head"><span>暖心毛线球</span><strong data-yarn-label>4 / 5</strong></div>
          <div class="rumi-yarn-slots" data-yarn-slots></div>
          <p class="rumi-exchange">5 个毛线球 = ¥1 模拟公益金</p>
          <button class="rumi-donate" data-rumi-donate disabled>集齐 5 团，送出 ¥1 温暖</button>
          <div class="rumi-impact"><span>本小屋已送出</span><b data-donation>¥0</b><small>平台公益池 · 演示数据</small></div>
        </aside>
        <p class="rumi-disclaimer">公益玩法概念体验 · 当前金额与项目均为演示数据，不代表真实捐赠</p>
      </section>
      <div class="rumi-modal" data-rumi-modal role="dialog" aria-modal="true" aria-labelledby="rumiDonationTitle">
        <div class="rumi-modal-card">
          <button class="rumi-modal-close" data-rumi-close aria-label="关闭">×</button>
          <span class="rumi-kicker">5 团暖心毛线已集齐</span>
          <h2 id="rumiDonationTitle">把这 1 元温暖送去哪里？</h2>
          <p>由 Roomie 平台公益池模拟配捐，你来选择善意的方向。</p>
          <div class="rumi-causes" data-rumi-causes></div>
          <small class="rumi-modal-note">概念体验，不会产生真实扣款或捐赠。</small>
        </div>
      </div>
      <div class="rumi-receipt" data-rumi-receipt role="status" aria-live="polite"></div>`;
  }

  function causeIcon(cause) {
    if (cause.includes('青年')) return '🏠';
    if (cause.includes('儿童')) return '📚';
    return '🌷';
  }

  function bind() {
    root.querySelector('[data-rumi-donate]').addEventListener('click', openDonation);
    root.querySelector('[data-rumi-close]').addEventListener('click', closeDonation);
    root.querySelector('[data-rumi-modal]').addEventListener('click', event => {
      if (event.target.matches('[data-rumi-modal]')) closeDonation();
    });
    root.querySelector('[data-rumi-causes]').addEventListener('click', event => {
      const button = event.target.closest('[data-cause]');
      if (button) donate(button.dataset.cause);
    });
  }

  function update() {
    if (!root) return;
    root.querySelector('[data-yarn-label]').textContent = `${state.yarnBalls} / 5`;
    root.querySelector('[data-yarn-slots]').innerHTML = Array.from({ length: 5 }, (_, index) => `<i class="${index < Math.min(5,state.yarnBalls) ? 'filled' : ''}">〰</i>`).join('');
    const donateButton = root.querySelector('[data-rumi-donate]');
    donateButton.disabled = state.yarnBalls < 5;
    donateButton.textContent = state.yarnBalls >= 5 ? '送出 ¥1 温暖 →' : '集齐 5 团，送出 ¥1 温暖';
    root.querySelector('[data-donation]').textContent = `¥${(state.donationCents / 100).toFixed(0)}`;
  }

  function emit() {
    if (typeof options.onStateChange === 'function') options.onStateChange(clone(state));
  }

  function init(config) {
    options = config || {};
    root = typeof options.container === 'string' ? document.querySelector(options.container) : options.container;
    if (!root) throw new Error('RoomieAlpacaGame: container is required');
    state = normalize(options);
    root.innerHTML = sceneMarkup();
    const causes = options.causes?.length ? options.causes : DEFAULT_CAUSES;
    root.querySelector('[data-rumi-causes]').innerHTML = causes.map((cause, index) => `
      <button data-cause="${cause}" class="cause-${index + 1}"><span>${causeIcon(cause)}</span><b>${cause}</b><small>投入 1 元模拟公益金</small></button>`).join('');
    bind();
    update();
    return api;
  }

  function reward(action) {
    if (!root) return false;
    state.yarnBalls += 1;
    state.lifetimeYarnBalls += 1;
    update();
    emit();
    showReceipt('毛线球 +1，谢谢你照顾我们的小屋。');
    if (!locked) {
      locked = true;
      root.querySelector('.rumi-game').classList.add('is-rewarding');
    }
    window.setTimeout(() => {
      root.querySelector('.rumi-game')?.classList.remove('is-rewarding');
      locked = false;
    }, prefersReducedMotion() ? 350 : 3000);
    if (state.yarnBalls >= 5) window.setTimeout(openDonation, 450);
    return true;
  }

  function prefersReducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function openDonation() {
    if (!root || state.yarnBalls < 5) return false;
    root.querySelector('[data-rumi-modal]').classList.add('open');
    return true;
  }
  function closeDonation() { root?.querySelector('[data-rumi-modal]')?.classList.remove('open'); }

  function donate(cause) {
    if (state.yarnBalls < 5) return;
    state.yarnBalls -= 5;
    state.donationCents += 100;
    state.selectedCause = cause;
    const receipt = { id: `demo-${Date.now()}`, cause, amountCents: 100, createdAt: new Date().toISOString(), demo: true };
    state.receipts.unshift(receipt);
    closeDonation();
    update();
    emit();
    if (typeof options.onDonation === 'function') options.onDonation(clone(receipt));
    showReceipt(`本小屋已向「${cause}」送出 ¥1 模拟公益金`, true);
  }

  function showReceipt(message, celebration) {
    const receipt = root.querySelector('[data-rumi-receipt]');
    receipt.innerHTML = `${celebration ? '<span>✨</span>' : '<span>🧶</span>'}<div><b>${celebration ? '暖心凭证已生成' : '绒米有新动静'}</b><small>${message}</small></div>`;
    receipt.classList.add('show');
    window.setTimeout(() => receipt.classList.remove('show'), 3600);
  }

  function getState() { return clone(state); }
  function resetDemo() {
    state = normalize({ yarnBalls: 4, lifetimeYarnBalls: 4, donationCents: 0, receipts: [] });
    locked = false;
    closeDonation();
    update();
    emit();
    return getState();
  }

  const api = { init, reward, getState, openDonation, resetDemo };
  window.RoomieAlpacaGame = api;
})();
