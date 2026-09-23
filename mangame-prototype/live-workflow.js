const {
  useState: useLiveState,
  useEffect: useLiveEffect,
  useRef: useLiveRef
} = React;
const AUTO_STYLE_NOTE = '参考图用途：第一张图片是本次人物和身份的唯一参考。第二张图片若附带，只用于画风、美化程度、线稿和光影参考，不复制其中人物、服装、场景和故事。输出规格：一张1024×1536的PNG竖版多格漫画。';
function createRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function LiveWorkflow({
  onHome,
  onExample
}) {
  const [stage, setStage] = useLiveState('upload');
  const [config, setConfig] = useLiveState(null),
    [photo, setPhoto] = useLiveState(''),
    [consent, setConsent] = useLiveState(false);
  const [quality, setQuality] = useLiveState('high'),
    [style, setStyle] = useLiveState(true);
  const [session, setSession] = useLiveState(null),
    [messages, setMessages] = useLiveState([]),
    [rounds, setRounds] = useLiveState(0),
    [answer, setAnswer] = useLiveState('');
  const [busy, setBusy] = useLiveState(false),
    [voiceBusy, setVoiceBusy] = useLiveState(false),
    [error, setError] = useLiveState('');
  const [prompt, setPrompt] = useLiveState(''),
    [job, setJob] = useLiveState(null),
    [imageUrl, setImageUrl] = useLiveState('');
  const [operation, setOperation] = useLiveState('script'),
    [seconds, setSeconds] = useLiveState(0),
    [notice, setNotice] = useLiveState('');
  const [zoom, setZoom] = useLiveState(false),
    [compare, setCompare] = useLiveState(false);
  const cfg = useLiveRef(null),
    sid = useLiveRef(null),
    request = useLiveRef(null),
    lock = useLiveRef(false),
    alive = useLiveRef(true),
    timer = useLiveRef(null),
    started = useLiveRef(0),
    pendingReply = useLiveRef(''),
    url = useLiveRef(''),
    dialog = useLiveRef(null),
    chat = useLiveRef(null),
    answerRef = useLiveRef('');
  answerRef.current = answer;
  useLiveEffect(() => {
    alive.current = true;
    fetch('/api/config').then(r => {
      if (!r.ok) throw Error();
      return r.json();
    }).then(c => {
      if (!alive.current) return;
      cfg.current = c;
      setConfig(c);
      if (!c.image_supported) setError('请重启本地后端，当前服务还未加载完整生图功能。');
    }).catch(() => {
      if (alive.current) setError('请通过 http://127.0.0.1:4180 打开本地后端。');
    });
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  useLiveEffect(() => {
    if (stage !== 'generating') return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [stage]);
  useLiveEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [messages, busy]);
  useLiveEffect(() => {
    if (zoom) dialog.current?.showModal();else dialog.current?.close();
  }, [zoom]);
  useLiveEffect(() => {
    function prevent(e) {
      if (stage === 'generating' || busy || voiceBusy) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [stage, busy, voiceBusy]);
  async function api(path, body, timeout = 180000) {
    const ctl = new AbortController(),
      t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MangaMe-Token': cfg.current.csrf
        },
        body: JSON.stringify(body),
        signal: ctl.signal
      });
      const d = await r.json();
      if (d.session) {
        sid.current = d.session;
        setSession(d.session);
      }
      if (!r.ok || d.error && !d.status) {
        const e = Error(d.error || '请求失败');
        e.httpStatus = r.status;
        throw e;
      }
      return d;
    } finally {
      clearTimeout(t);
    }
  }
  async function choose(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('请选择8 MB以内的JPG、PNG或WebP图片。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const v = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setPhoto(v);
      setConsent(false);
    } catch (_) {
      setError('读取照片失败，请重新选择。');
    } finally {
      setBusy(false);
    }
  }
  async function sample() {
    try {
      const r = await fetch('assets/dorm-original-photo.png');
      if (!r.ok) throw Error();
      await choose(new File([await r.blob()], 'sample.png', {
        type: 'image/png'
      }));
    } catch (_) {
      setError('示例照片未能加载。');
    }
  }
  async function start() {
    if (lock.current || !consent || !photo || !config?.key_configured || !config?.image_supported) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setStage('chat');
    try {
      const d = await api('/api/start', {
        image: photo,
        session: sid.current
      });
      if (alive.current) setMessages([{
        role: 'assistant',
        text: d.text
      }]);
    } catch (e) {
      setError('看图未完成：' + e.message + '。不会自动重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function generation() {
    started.current = Date.now();
    setSeconds(0);
    setStage('generating');
    setOperation('script');
  }
  async function reply(retry = false) {
    if (lock.current || voiceBusy || rounds >= 3) return;
    const text = retry ? pendingReply.current : answer.trim();
    if (!text) return;
    pendingReply.current = text;
    lock.current = true;
    setBusy(true);
    setError('');
    if (rounds === 2) generation();
    try {
      const d = await api('/api/reply', {
        session: sid.current,
        text
      });
      if (!alive.current) return;
      setMessages(m => [...m, {
        role: 'user',
        text
      }, ...(d.mode === 'chat' ? [{
        role: 'assistant',
        text: d.text
      }] : [])]);
      setAnswer('');
      setRounds(d.answered_rounds);
      if (d.mode === 'prompt') {
        setPrompt(d.text);
        await generate(d.text, false);
      } else setStage('chat');
    } catch (e) {
      setError(e.message + '。原回答已保留，失败或超时可能已计费。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const submittingImage = useLiveRef(false);
  async function generate(text, retry) {
    if (submittingImage.current) return;
    if (retry && !confirm('重新生成会新增一次Image2付费调用。确认继续？')) return;
    submittingImage.current = true;
    try {
      const body = {
        session: sid.current,
        request_id: createRequestId(),
        prompt: text + '\n\n' + AUTO_STYLE_NOTE,
        quality,
        use_style: style,
        confirm_cost: true
      };
      request.current = body;
      setJob(null);
      setError('');
      setOperation('submitting');
      if (retry) generation();
      await accept(await api('/api/image-generate', body, 20000));
    } catch (e) {
      setError('尚未确认生图任务：' + e.message + '。请先查询任务，不要重新生成。');
    } finally {
      submittingImage.current = false;
    }
  }
  async function resend() {
    if (lock.current || !request.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await accept(await api('/api/image-generate', request.current, 20000));
    } catch (e) {
      setError(e.message + '。保留原请求编号，不自动重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function accept(d) {
    if (!alive.current) return;
    setJob(d);
    setError('');
    if (d.status === 'generating') {
      setOperation('image');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => poll(d.request_id), 2500);
    } else if (d.status === 'ready') {
      setOperation('loading');
      await content(d);
    } else {
      setOperation('failed');
      setError(d.error || '生成未完成。');
    }
  }
  async function poll(id = request.current?.request_id) {
    try {
      await accept(await api('/api/image-status', {
        session: sid.current,
        request_id: id
      }, 20000));
    } catch (e) {
      if (alive.current) setError('暂时无法查询进度，任务可能仍在运行：' + e.message);
    }
  }
  async function content(d = job) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      let response;
      try {
        response = await fetch('/api/image-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MangaMe-Token': config.csrf
          },
          body: JSON.stringify({
            session: sid.current,
            request_id: d.request_id
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `读取失败（${response.status}）`);
      }
      const blob = await response.blob();
      if (!alive.current) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      setImageUrl(url.current);
      setStage('result');
      setError('');
      window.scrollTo(0, 0);
    } catch (e) {
      setOperation('loading');
      setError('漫画已完成，但读取失败。重新读取不会重复生图。');
    }
  }
  async function reset() {
    if (busy || voiceBusy) return;
    if (!confirm('开始新故事会清空当前内容。请先保存漫画，继续吗？')) return;
    try {
      if (sid.current) await api('/api/clear', {
        session: sid.current
      });
      sid.current = null;
      setSession(null);
      request.current = null;
      setMessages([]);
      setRounds(0);
      setAnswer('');
      setPhoto('');
      setConsent(false);
      setPrompt('');
      setJob(null);
      setImageUrl('');
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = '';
      setError('');
      setStage('upload');
    } catch (e) {
      setError(e.message);
    }
  }
  async function share() {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], 'MangaMe.png', {
        type: 'image/png'
      });
      if (navigator.canShare?.({
        files: [file]
      })) {
        await navigator.share({
          files: [file],
          title: '我的生活漫画'
        });
      } else setNotice('此浏览器不支持图片分享，请先保存PNG，再发给朋友。');
    } catch (e) {
      if (e.name !== 'AbortError') setNotice('分享未完成，请下载图片后分享。');
    }
  }
  function append(text) {
    const next = answerRef.current + (answerRef.current.trim() ? '\n' : '') + text;
    if (next.length > 2000) return false;
    answerRef.current = next;
    setAnswer(next);
    return true;
  }
  const steps = ['选照片', '聊故事', '画漫画', '看成果'],
    index = ['upload', 'chat', 'generating', 'result'].indexOf(stage);
  const loadingLines = ['你的故事，马上就有画面了。', '今天，你是漫画主角。', '普通的一天，也值得认真画下来。', '等这一话画好，一起翻开看看。'];
  return /*#__PURE__*/React.createElement("main", {
    className: 'journey journey-' + stage
  }, /*#__PURE__*/React.createElement("nav", {
    className: "journey-nav"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onHome,
    disabled: busy || voiceBusy || stage === 'generating',
    className: "journey-brand"
  }, "MangaMe ", /*#__PURE__*/React.createElement("small", null, "\u5FEB\u4E50\u8FDE\u8F7D\u4E2D")), /*#__PURE__*/React.createElement("div", {
    className: "journey-steps"
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: s,
    className: i === index ? 'active' : i < index ? 'done' : ''
  }, i + 1, /*#__PURE__*/React.createElement("em", null, s))))), stage === 'upload' && /*#__PURE__*/React.createElement("section", {
    className: "upload-scene"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scene-copy"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u751F\u6D3B\u6F2B\u753B \xB7 \u4ECE\u4F60\u5F00\u59CB"), /*#__PURE__*/React.createElement("h1", null, "\u8FD9\u4E00\u8BDD\uFF0C", /*#__PURE__*/React.createElement("br", null), "\u4ECE\u54EA\u5F20\u7167\u7247\u5F00\u59CB\uFF1F"), /*#__PURE__*/React.createElement("p", null, "\u9009\u4E00\u4E2A\u5FD8\u4E0D\u6389\u7684\u77AC\u95F4\u3002", /*#__PURE__*/React.createElement("br", null), "\u804A\u4E09\u4E2A\u95EE\u9898\uFF0C\u628A\u7167\u7247\u80CC\u540E\u7684\u6545\u4E8B\u753B\u4E0B\u6765\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "upload-spec"
  }, "\u4E00\u5F20\u7167\u7247 \xB7 \u4E09\u8F6E\u5BF9\u8BDD \xB7 \u4E00\u7BC7\u6F2B\u753B")), /*#__PURE__*/React.createElement("div", {
    className: "upload-sheet"
  }, /*#__PURE__*/React.createElement("div", {
    className: "journey-photo"
  }, photo ? /*#__PURE__*/React.createElement("img", {
    src: photo,
    alt: "\u9009\u4E2D\u7684\u539F\u7167\u7247"
  }) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "\uFF0B"), /*#__PURE__*/React.createElement("p", null, "\u5408\u7167\u3001\u65C5\u884C\u7167\uFF0C\u6216\u666E\u901A\u7684\u4E00\u5929"))), /*#__PURE__*/React.createElement("label", {
    className: "file-choice"
  }, photo ? '换一张照片' : '选择照片', /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/jpeg,image/png,image/webp",
    disabled: busy,
    onChange: e => choose(e.target.files[0])
  })), /*#__PURE__*/React.createElement("button", {
    className: "text-action",
    onClick: sample,
    disabled: busy
  }, "\u7528\u793A\u4F8B\u7167\u7247\u8BD5\u8BD5"), /*#__PURE__*/React.createElement("p", {
    className: "fine-print"
  }, "JPG / PNG / WebP \xB7 8 MB\u4EE5\u5185"), /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", null, "\u9AD8\u7EA7\u8BBE\u7F6E"), /*#__PURE__*/React.createElement("label", null, "\u753B\u9762\u8D28\u91CF", /*#__PURE__*/React.createElement("select", {
    disabled: busy,
    value: quality,
    onChange: e => {
      setQuality(e.target.value);
      setConsent(false);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "high"
  }, "\u9AD8\u8D28\u91CF"), /*#__PURE__*/React.createElement("option", {
    value: "medium"
  }, "\u4E2D\u8D28\u91CF"))), /*#__PURE__*/React.createElement("label", {
    className: "journey-consent"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: style,
    onChange: e => {
      setStyle(e.target.checked);
      setConsent(false);
    }
  }), "\u4F7F\u7528\u7B2C\u4E8C\u7248\u65E5\u6F2B\u753B\u98CE\u53C2\u8003")), /*#__PURE__*/React.createElement("label", {
    className: "journey-consent"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: consent,
    onChange: e => setConsent(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", null, "\u6211\u6709\u6743\u4F7F\u7528\u7167\u7247\uFF0C\u540C\u610F\u53D1\u9001\u7167\u7247\u3001\u5F55\u97F3\uFF08\u5982\u4F7F\u7528\uFF09\u53CA\u8BB2\u8FF0\u81F3OpenAI\uFF0C\u5E76\u5728\u7B2C\u4E09\u8F6E\u56DE\u7B54\u540E\u81EA\u52A8\u751F\u6210\u4E00\u5F20\u6F2B\u753B\u3002\u5BF9\u8BDD\u3001\u8F6C\u5199\u548C\u751F\u56FE\u4F1A\u4EA7\u751FAPI\u8D39\u7528\u3002")), /*#__PURE__*/React.createElement("button", {
    className: "primary-button",
    disabled: busy || !photo || !consent || !config?.key_configured || !config?.image_supported,
    onClick: start
  }, "\u804A\u804A\u8FD9\u5F20\u7167\u7247 ", /*#__PURE__*/React.createElement("span", null, "\u2192")), config && !config.key_configured && /*#__PURE__*/React.createElement("p", {
    className: "journey-error"
  }, "\u8BF7\u5728\u914D\u7F6E\u5BC6\u94A5\u7684\u7EC8\u7AEF\u542F\u52A8\u540E\u7AEF\u3002"))), stage === 'chat' && /*#__PURE__*/React.createElement("section", {
    className: "chat-scene"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "chat-photo"
  }, /*#__PURE__*/React.createElement("img", {
    src: photo,
    alt: "\u8FD9\u6BB5\u6545\u4E8B\u7684\u7167\u7247"
  }), /*#__PURE__*/React.createElement("button", {
    className: "text-action",
    disabled: busy || voiceBusy,
    onClick: reset
  }, "\u91CD\u65B0\u9009\u7167\u7247")), /*#__PURE__*/React.createElement("div", {
    className: "conversation-sheet"
  }, /*#__PURE__*/React.createElement("header", null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "\u804A\u804A\u8FD9\u5F20\u7167\u7247")), /*#__PURE__*/React.createElement("span", {
    className: "round-pill"
  }, Math.min(rounds + 1, 3), " / 3")), /*#__PURE__*/React.createElement("div", {
    className: "journey-messages",
    ref: chat,
    "aria-live": "polite"
  }, messages.map((m, i) => /*#__PURE__*/React.createElement("article", {
    className: 'bubble ' + m.role,
    key: i
  }, /*#__PURE__*/React.createElement("b", null, m.role === 'assistant' ? 'MangaMe' : '你'), /*#__PURE__*/React.createElement("p", null, m.text))), busy && /*#__PURE__*/React.createElement("p", {
    className: "thinking",
    role: "status"
  }, messages.length ? '在认真听你的故事……' : '正在看照片，准备和你聊聊……')), messages.length > 0 && /*#__PURE__*/React.createElement("form", {
    className: "journey-composer",
    onSubmit: e => {
      e.preventDefault();
      reply();
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "story-answer",
    className: "sr-only"
  }, "\u8F93\u5165\u56DE\u7B54"), /*#__PURE__*/React.createElement("textarea", {
    id: "story-answer",
    value: answer,
    disabled: busy || voiceBusy,
    maxLength: 2000,
    rows: 2,
    placeholder: "\u8BF4\u70B9\u4EC0\u4E48\u2026",
    onChange: e => setAnswer(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "composer-send"
  }, /*#__PURE__*/React.createElement("small", null, rounds === 2 ? '发送后开始画漫画' : '', answer.length > 1800 ? ' · ' + answer.length + '/2000' : ''), /*#__PURE__*/React.createElement("div", {
    className: "composer-icons"
  }, /*#__PURE__*/React.createElement(window.VoiceInput, {
    session: session,
    csrf: config?.csrf,
    disabled: busy,
    available: !!config?.voice_supported,
    authorized: consent,
    onText: append,
    onBusy: setVoiceBusy,
    resetKey: session
  }), /*#__PURE__*/React.createElement("button", {
    className: "send-icon",
    disabled: busy || voiceBusy || !answer.trim(),
    type: "submit",
    "aria-label": rounds === 2 ? '说完啦，开始画' : '发送回答',
    title: rounds === 2 ? '说完啦，开始画' : '发送回答'
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 19V5m-6 6 6-6 6 6"
  })))))), !messages.length && !busy && /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: start
  }, "\u624B\u52A8\u91CD\u8BD5\u770B\u56FE"))), stage === 'generating' && /*#__PURE__*/React.createElement("section", {
    className: "generation-scene"
  }, /*#__PURE__*/React.createElement("div", {
    className: "drawing-book",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("img", {
    src: photo,
    alt: ""
  })), /*#__PURE__*/React.createElement("div", {
    className: "book-sketch"
  }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 1 15 9 23 12 15 15 12 23 9 15 1 12 9 9Z",
    fill: "currentColor"
  }))))), /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u5FEB\u4E50\u8FDE\u8F7D\u4E2D"), /*#__PURE__*/React.createElement("h1", null, operation === 'script' ? '把你的故事，整理成漫画。' : operation === 'loading' ? '画好了，正在打开。' : operation === 'failed' ? '这一话还没有画好。' : '正在画你的这一话。'), /*#__PURE__*/React.createElement("p", {
    className: "loading-line"
  }, error ? '请先查看下面的状态说明。' : seconds > 90 ? '这次绘制需要久一点，任务仍在处理中。请先不要关闭页面。' : loadingLines[Math.floor(seconds / 6) % loadingLines.length]), /*#__PURE__*/React.createElement("div", {
    className: "elapsed"
  }, "\u5DF2\u7B49\u5F85 ", seconds, " \u79D2 ", /*#__PURE__*/React.createElement("span", null, "\xB7"), " ", operation === 'script' ? '整理脚本' : operation === 'loading' ? '读取图片' : 'Image2 绘制'), /*#__PURE__*/React.createElement("p", {
    className: "fine-print"
  }, "\u7ED3\u679C\u53EA\u4FDD\u5B58\u5728\u5F53\u524D\u672C\u5730\u4F1A\u8BDD\uFF0C\u8BF7\u52FF\u5237\u65B0\u3001\u5173\u95ED\u9875\u9762\u6216\u91CD\u542F\u540E\u7AEF\u3002\u5931\u8D25\u4E0D\u4F1A\u81EA\u52A8\u91CD\u65B0\u4ED8\u8D39\u751F\u6210\u3002"), prompt && /*#__PURE__*/React.createElement("details", {
    className: "generation-details"
  }, /*#__PURE__*/React.createElement("summary", null, "\u67E5\u770B\u672C\u6B21\u7ED8\u753B\u6307\u4EE4"), /*#__PURE__*/React.createElement("pre", null, request.current?.prompt || prompt)), error && /*#__PURE__*/React.createElement("div", {
    className: "recovery-actions"
  }, operation === 'script' ? /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    disabled: busy,
    onClick: () => reply(true)
  }, "\u91CD\u8BD5\u811A\u672C\u6574\u7406\uFF08\u53EF\u80FD\u518D\u6B21\u8BA1\u8D39\uFF09") : operation === 'loading' ? /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => content()
  }, "\u91CD\u65B0\u8BFB\u53D6\u56FE\u7247") : operation === 'failed' ? /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    disabled: job?.image_calls >= 2,
    onClick: () => generate(prompt, true)
  }, "\u91CD\u65B0\u751F\u6210\uFF08\u518D\u6B21\u8BA1\u8D39\uFF09") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => poll()
  }, "\u67E5\u8BE2\u5F53\u524D\u4EFB\u52A1"), !job && /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    disabled: busy,
    onClick: resend
  }, "\u6062\u590D\u63D0\u4EA4\uFF08\u540C\u4E00\u8BF7\u6C42\u7F16\u53F7\uFF09")))), stage === 'result' && /*#__PURE__*/React.createElement("section", {
    className: "result-scene"
  }, /*#__PURE__*/React.createElement("header", null, /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u4F60\u7684\u751F\u6D3B \xB7 \u65B0\u7684\u4E00\u8BDD"), /*#__PURE__*/React.createElement("h1", null, "\u4F60\u7684\u8FD9\u4E00\u8BDD\uFF0C\u753B\u597D\u4E86\u3002"), /*#__PURE__*/React.createElement("p", null, "\u628A\u5B83\u5B58\u4E0B\u6765\uFF0C\u4E5F\u5206\u4EAB\u7ED9\u6545\u4E8B\u91CC\u7684\u4EBA\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "result-layout"
  }, /*#__PURE__*/React.createElement("button", {
    className: "finished-comic",
    onClick: () => setZoom(true),
    "aria-label": "\u653E\u5927\u6211\u7684\u6F2B\u753B"
  }, /*#__PURE__*/React.createElement("img", {
    src: compare ? photo : imageUrl,
    alt: compare ? '原照片' : '本次真实生成的完整漫画'
  })), /*#__PURE__*/React.createElement("aside", {
    className: "result-tools"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-primary"
  }, /*#__PURE__*/React.createElement("a", {
    className: "primary-button",
    href: imageUrl,
    download: "MangaMe-my-comic.png"
  }, "\u4FDD\u5B58\u6F2B\u753B \u2193"), /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: share
  }, "\u5206\u4EAB\u7ED9\u670B\u53CB")), /*#__PURE__*/React.createElement("button", {
    className: "text-action",
    onClick: () => setCompare(!compare)
  }, compare ? '返回漫画' : '对照原照片'), /*#__PURE__*/React.createElement("button", {
    className: "text-action",
    onClick: () => setZoom(true)
  }, "\u653E\u5927\u9605\u8BFB"), /*#__PURE__*/React.createElement("button", {
    className: "text-action",
    onClick: reset
  }, "\u518D\u753B\u4E00\u7BC7"), /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", null, "\u67E5\u770B\u5B8C\u6574 Prompt"), /*#__PURE__*/React.createElement("pre", null, job?.prompt || prompt), /*#__PURE__*/React.createElement("p", {
    className: "fine-print"
  }, job?.model, " \xB7 ", job?.quality, " \xB7 ", job?.size, " \xB7 \u751F\u56FE\u7528\u65F6 ", job?.seconds, " \u79D2")), /*#__PURE__*/React.createElement("p", {
    className: "fine-print"
  }, "\u8FD9\u662F\u672C\u6B21\u771F\u5B9E\u751F\u6210\u7ED3\u679C\u3002\u4FDD\u5B58\u540E\u518D\u79BB\u5F00\uFF0C\u56FE\u7247\u5C1A\u672A\u6301\u4E45\u4FDD\u5B58\u5230\u670D\u52A1\u5668\u3002"), notice && /*#__PURE__*/React.createElement("p", {
    role: "status"
  }, notice)))), error && /*#__PURE__*/React.createElement("p", {
    className: "journey-error",
    role: "alert"
  }, error), /*#__PURE__*/React.createElement("dialog", {
    ref: dialog,
    className: "image-dialog",
    onCancel: () => setZoom(false),
    onClose: () => setZoom(false)
  }, /*#__PURE__*/React.createElement("button", {
    className: "dialog-close",
    onClick: () => setZoom(false)
  }, "\u5173\u95ED\u5927\u56FE"), imageUrl && /*#__PURE__*/React.createElement("img", {
    src: compare ? photo : imageUrl,
    alt: "\u539F\u5C3A\u5BF8\u56FE\u7247"
  })));
}
window.LiveWorkflow = LiveWorkflow;
