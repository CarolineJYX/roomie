const IMAGE_STYLE_NOTE = '参考图用途：第一张图片是本次人物和身份的唯一参考。第二张图片若附带，只用于画风、美化程度、线稿和光影参考，不能复制其中的人物身份、服装、场景或故事。';
function ImageResult({
  session,
  config,
  prompt,
  photo,
  disabled,
  onBusy
}) {
  const [draft, setDraft] = React.useState(prompt + '\n\n' + IMAGE_STYLE_NOTE + '\n输出规格：一张1024×1536的PNG竖版多格漫画。');
  const [quality, setQuality] = React.useState('high');
  const [useStyle, setUseStyle] = React.useState(true);
  const [confirmed, setConfirmed] = React.useState(false);
  const [job, setJob] = React.useState(null);
  const [pending, setPending] = React.useState(false);
  const [networkError, setNetworkError] = React.useState('');
  const [resultUrl, setResultUrl] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [zoom, setZoom] = React.useState(false);
  const [copy, setCopy] = React.useState(false);
  const request = React.useRef(null),
    timer = React.useRef(null),
    mounted = React.useRef(true),
    inflight = React.useRef(false),
    urlRef = React.useRef(''),
    dialog = React.useRef(null),
    parent = React.useRef(onBusy),
    previousPrompt = React.useRef(prompt);
  parent.current = onBusy;
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);
  React.useEffect(() => {
    if (previousPrompt.current !== prompt) {
      previousPrompt.current = prompt;
      setDraft(prompt + '\n\n' + IMAGE_STYLE_NOTE + '\n输出规格：一张1024×1536的PNG竖版多格漫画。');
      setConfirmed(false);
      setNotice('GPT-5 已更新脚本。已生成的图片不会跟着改变；再次生图会单独计费。');
    }
  }, [prompt]);
  React.useEffect(() => {
    if (zoom) dialog.current?.showModal();else dialog.current?.close();
  }, [zoom]);
  function lock(value) {
    setPending(value);
    parent.current(value);
  }
  async function api(path, body) {
    const ctl = new AbortController(),
      timeout = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MangaMe-Token': config.csrf
        },
        body: JSON.stringify(body),
        signal: ctl.signal
      });
      const d = await r.json();
      if (!r.ok) {
        const error = new Error(d.error || '本地生图请求失败。');
        error.httpStatus = r.status;
        throw error;
      }
      return d;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function content(d) {
    try {
      const body = await api('/api/image-content', {
        session,
        request_id: d.request_id
      });
      if (!mounted.current) return;
      const bytes = Uint8Array.from(atob(body.image_base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: 'image/png'
      });
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setResultUrl(url);
      setNetworkError('');
    } catch (e) {
      if (mounted.current) setNetworkError('图片已完成，但读取失败。点击“重新读取结果”，不会重新生图。');
    }
  }
  async function accept(d) {
    if (!mounted.current) return;
    setJob(d);
    setNetworkError('');
    if (d.status === 'generating') {
      lock(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => poll(d.request_id), 2500);
    } else {
      lock(false);
      setConfirmed(false);
      if (d.status === 'ready') await content(d);
    }
  }
  async function poll(id) {
    try {
      await accept(await api('/api/image-status', {
        session,
        request_id: id
      }));
    } catch (e) {
      if (mounted.current) {
        setNetworkError('暂时无法查询状态，请检查本地后端。点击“查询当前任务”只查询，不重复提交生图。');
        lock(true);
      }
    }
  }
  async function submit(recover = false) {
    if (inflight.current || !recover && (disabled || pending || !confirmed || !draft.trim())) return;
    if (!recover) {
      if (!window.confirm(`将使用当前照片和下方完整 Prompt，生成1张${quality === 'high' ? '高' : '中'}质量漫画。此操作会产生OpenAI生图费用，确认继续？`)) return;
      request.current = {
        session,
        request_id: crypto.randomUUID(),
        prompt: draft,
        quality,
        use_style: useStyle,
        confirm_cost: true
      };
      setResultUrl('');
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = '';
      }
      setJob(null);
    }
    if (!request.current) return;
    inflight.current = true;
    lock(true);
    setNetworkError('');
    setNotice('');
    try {
      await accept(await api('/api/image-generate', request.current));
    } catch (e) {
      if (mounted.current) {
        if (e.httpStatus && e.httpStatus < 500) {
          lock(false);
          setConfirmed(false);
          setNotice('本地后端拒绝提交：' + e.message + ' 本次未创建新的生图任务。');
        } else setNetworkError('提交结果未确认：' + e.message + '。请先查询当前任务；若需重发，将使用同一请求编号避免重复生成。');
      }
    } finally {
      inflight.current = false;
    }
  }
  const frozen = disabled || pending;
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopy(true);
    } catch (_) {
      setNotice('复制失败，请下载TXT或手动复制。');
    }
  }
  function saveDraft() {
    const u = URL.createObjectURL(new Blob([draft], {
      type: 'text/plain;charset=utf-8'
    }));
    const a = document.createElement('a');
    a.href = u;
    a.download = 'MangaMe-image-prompt.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "image-studio",
    "aria-label": "\u771F\u5B9E\u6F2B\u753B\u751F\u6210"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u786E\u8BA4\u811A\u672C\uFF0C\u753B\u51FA\u8FD9\u4E00\u8BDD"), /*#__PURE__*/React.createElement("h2", null, "\u4ECE\u4F60\u7684\u6545\u4E8B\uFF0C\u751F\u6210\u4F60\u7684\u6F2B\u753B"), /*#__PURE__*/React.createElement("p", null, "\u4E0B\u65B9\u662F\u5373\u5C06\u53D1\u9001\u7ED9 Image2 \u7684\u5B8C\u6574 Prompt\uFF0C\u53EF\u4EE5\u4FEE\u6539\u3002\u4E0D\u4F1A\u4F7F\u7528\u56FA\u5B9A\u793A\u4F8B\u811A\u672C\uFF0C\u4E5F\u4E0D\u4F1A\u81EA\u52A8\u751F\u56FE\u3002"), /*#__PURE__*/React.createElement("label", {
    htmlFor: "image-prompt"
  }, "\u53D1\u9001\u7ED9\u56FE\u7247\u6A21\u578B\u7684\u5B8C\u6574 Prompt"), /*#__PURE__*/React.createElement("textarea", {
    id: "image-prompt",
    value: draft,
    disabled: frozen,
    maxLength: 30000,
    rows: 16,
    onChange: e => {
      setDraft(e.target.value);
      setConfirmed(false);
      setCopy(false);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "live-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "reader-action",
    onClick: copyDraft
  }, copy ? '已复制' : '复制最终 Prompt'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "reader-action",
    onClick: saveDraft
  }, "\u4E0B\u8F7D\u6700\u7EC8 Prompt")), /*#__PURE__*/React.createElement("div", {
    className: "image-reference"
  }, /*#__PURE__*/React.createElement("figure", null, /*#__PURE__*/React.createElement("img", {
    src: photo,
    alt: "\u672C\u6B21\u4EBA\u7269\u53C2\u8003\u539F\u7167\u7247"
  }), /*#__PURE__*/React.createElement("figcaption", null, "\u672C\u6B21\u7167\u7247 \xB7 \u4EBA\u7269\u53C2\u8003")), /*#__PURE__*/React.createElement("figure", null, /*#__PURE__*/React.createElement("img", {
    src: "assets/manga-style-preview-v2.png",
    alt: "\u7B2C\u4E8C\u7248\u65E5\u6F2B\u753B\u98CE\u53C2\u8003"
  }), /*#__PURE__*/React.createElement("figcaption", null, "\u7B2C\u4E8C\u7248\u6837\u5F20 \xB7 \u4EC5\u53C2\u8003\u753B\u98CE"))), /*#__PURE__*/React.createElement("div", {
    className: "image-options"
  }, /*#__PURE__*/React.createElement("label", null, "\u8F93\u51FA\u8D28\u91CF", /*#__PURE__*/React.createElement("select", {
    value: quality,
    disabled: frozen,
    onChange: e => {
      setQuality(e.target.value);
      setConfirmed(false);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "high"
  }, "\u9AD8\u8D28\u91CF \xB7 \u63A8\u8350\u6548\u679C\u6D4B\u8BD5"), /*#__PURE__*/React.createElement("option", {
    value: "medium"
  }, "\u4E2D\u8D28\u91CF \xB7 \u5FEB\u901F\u6D4B\u8BD5"))), /*#__PURE__*/React.createElement("label", {
    className: "live-consent"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: useStyle,
    disabled: frozen,
    onChange: e => {
      setUseStyle(e.target.checked);
      setConfirmed(false);
    }
  }), /*#__PURE__*/React.createElement("span", null, "\u9644\u4E0A\u7B2C\u4E8C\u7248\u753B\u98CE\u53C2\u8003\uFF08\u53EA\u63A7\u5236\u753B\u98CE\uFF0C\u4E0D\u66FF\u6362\u672C\u6B21\u4EBA\u7269\uFF09"))), /*#__PURE__*/React.createElement("p", {
    className: "prototype-disclosure"
  }, "gpt-image-2 \xB7 1024\xD71536 \xB7 1\u5F20 PNG\u3002\u9AD8\u8D28\u91CF\u901A\u5E38\u6BD4\u4E2D\u8D28\u91CF\u8D39\u7528\u9AD8\u3001\u7B49\u5F85\u66F4\u4E45\uFF0C\u5B9E\u9645\u8D39\u7528\u4EE5 OpenAI \u8D26\u5355\u4E3A\u51C6\u3002\u539F\u7248\u53D9\u4E8B Prompt \u4E0E\u4E09\u8F6E\u63D0\u95EE\u89C4\u5219\u4E0D\u53D8\u3002"), /*#__PURE__*/React.createElement("label", {
    className: "live-consent"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: confirmed,
    disabled: frozen,
    onChange: e => setConfirmed(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", null, "\u6211\u5DF2\u6838\u5BF9 Prompt \u548C\u53C2\u8003\u56FE\u7247\uFF0C\u540C\u610F\u5C06\u5B83\u4EEC\u53D1\u9001\u81F3 OpenAI \u5E76\u4EA7\u751F\u4E00\u6B21\u751F\u56FE\u8D39\u7528\u3002\u6BCF\u4F1A\u8BDD\u6700\u591A2\u6B21\u751F\u56FE\u5C1D\u8BD5\uFF0C\u4E0D\u81EA\u52A8\u91CD\u8BD5\u3002")), /*#__PURE__*/React.createElement("button", {
    className: "primary-button",
    type: "button",
    disabled: frozen || !confirmed || !draft.trim() || !config?.image_supported || job?.image_calls >= 2,
    onClick: () => submit(false)
  }, job ? '确认重新生成（再次计费）' : '生成我的漫画'), !config?.image_supported && /*#__PURE__*/React.createElement("p", {
    className: "live-error"
  }, "\u5F53\u524D\u540E\u7AEF\u8FD8\u672A\u52A0\u8F7D\u5B8C\u6574\u751F\u56FE\u529F\u80FD\uFF0C\u8BF7\u91CD\u542F prompt_server.py \u540E\u5237\u65B0\u9875\u9762\u3002"), pending && /*#__PURE__*/React.createElement("p", {
    role: "status"
  }, job?.status === 'generating' ? 'Image2 正在生成漫画……' : '正在确认生图任务……', "\u6CA1\u6709\u771F\u5B9E\u767E\u5206\u6BD4\u53EF\u663E\u793A\uFF0C\u8BF7\u7B49\u5F85\u3002\u4E0D\u8981\u91CD\u542F\u540E\u7AEF\u6216\u5173\u95ED\u9875\u9762\uFF0C\u7ED3\u679C\u76EE\u524D\u53EA\u4FDD\u5B58\u5728\u5185\u5B58\u3002"), networkError && /*#__PURE__*/React.createElement("div", {
    className: "live-error",
    role: "alert"
  }, /*#__PURE__*/React.createElement("p", null, networkError), /*#__PURE__*/React.createElement("div", {
    className: "live-actions"
  }, job?.status === 'ready' ? /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => content(job)
  }, "\u91CD\u65B0\u8BFB\u53D6\u7ED3\u679C") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => poll(request.current?.request_id)
  }, "\u67E5\u8BE2\u5F53\u524D\u4EFB\u52A1"), !job && /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => submit(true)
  }, "\u91CD\u53D1\u540C\u4E00\u8BF7\u6C42\uFF08\u4FDD\u6301\u539F\u7F16\u53F7\uFF09")))), job && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "prototype-disclosure"
  }, "\u72B6\u6001\uFF1A", job.status, " \xB7 \u751F\u56FE\u5C1D\u8BD5 ", job.image_calls, "/2 \xB7 \u540E\u7AEF\u7D2F\u8BA1 ", job.image_total, "/5 \xB7 ", job.seconds ?? 0, "\u79D2"), ['failed', 'uncertain'].includes(job.status) && /*#__PURE__*/React.createElement("p", {
    className: "live-error",
    role: "alert"
  }, job.error || '生图没有完成。', job.status === 'uncertain' ? '上游可能已经计费。新的生图请求可能再次计费，请勿连续重试。' : ''), /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", null, "\u6838\u5BF9\u672C\u6B21\u751F\u56FE\u5B9E\u9645\u8F93\u5165"), /*#__PURE__*/React.createElement("p", null, "\u6A21\u578B\uFF1A", job.model, " \xB7 \u8D28\u91CF\uFF1A", job.quality, " \xB7 \u5C3A\u5BF8\uFF1A", job.size, " \xB7 \u753B\u98CE\u53C2\u8003\uFF1A", job.use_style ? '开启' : '关闭'), /*#__PURE__*/React.createElement("p", null, "\u8BF7\u6C42\u7F16\u53F7\uFF1A", job.request_id), /*#__PURE__*/React.createElement("p", {
    className: "hash"
  }, "Prompt SHA256\uFF1A", job.prompt_sha256), /*#__PURE__*/React.createElement("pre", null, job.prompt), /*#__PURE__*/React.createElement("p", null, "\u8F93\u5165 tokens\uFF1A", job.usage?.input_tokens ?? '未返回', " \xB7 \u8F93\u51FA tokens\uFF1A", job.usage?.output_tokens ?? '未返回'))), resultUrl && /*#__PURE__*/React.createElement("section", {
    className: "actual-comic"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u672C\u6B21\u771F\u5B9E\u751F\u6210\u7ED3\u679C \xB7 \u975E\u793A\u4F8B"), /*#__PURE__*/React.createElement("h2", null, "\u4F60\u7684\u8FD9\u4E00\u8BDD\uFF0C\u753B\u597D\u4E86\u3002"), /*#__PURE__*/React.createElement("p", null, "\u8BF7\u68C0\u67E5\u4EBA\u7269\u3001\u4E2D\u6587\u6587\u5B57\u548C\u4E8B\u4EF6\u987A\u5E8F\u3002\u786E\u8BA4\u6EE1\u610F\u540E\u4E0B\u8F7D\u4FDD\u5B58\uFF1B\u5237\u65B0\u9875\u9762\u6216\u91CD\u542F\u670D\u52A1\u53EF\u80FD\u4E22\u5931\u5F53\u524D\u7ED3\u679C\u3002"), /*#__PURE__*/React.createElement("button", {
    className: "actual-image",
    onClick: () => setZoom(true),
    "aria-label": "\u653E\u5927\u672C\u6B21\u751F\u6210\u7684\u6F2B\u753B"
  }, /*#__PURE__*/React.createElement("img", {
    src: resultUrl,
    alt: "Image2 \u6839\u636E\u672C\u6B21\u539F\u7167\u7247\u548C\u786E\u8BA4Prompt\u5B9E\u9645\u751F\u6210\u7684\u6F2B\u753B"
  })), /*#__PURE__*/React.createElement("div", {
    className: "live-actions"
  }, /*#__PURE__*/React.createElement("a", {
    className: "primary-button",
    href: resultUrl,
    download: "MangaMe-my-comic.png"
  }, "\u4E0B\u8F7D\u672C\u6B21\u6F2B\u753B PNG"), /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => setZoom(true)
  }, "\u653E\u5927\u67E5\u770B")), job?.prompt !== draft && /*#__PURE__*/React.createElement("p", {
    className: "prototype-disclosure"
  }, "\u4F60\u5DF2\u4FEE\u6539\u7F16\u8F91\u6846\u3002\u4E0A\u9762\u7684\u56FE\u7247\u4ECD\u5BF9\u5E94\u201C\u672C\u6B21\u751F\u56FE\u5B9E\u9645\u8F93\u5165\u201D\u4E2D\u7684\u65E7 Prompt\u3002")), notice && /*#__PURE__*/React.createElement("p", {
    role: "status"
  }, notice), /*#__PURE__*/React.createElement("dialog", {
    ref: dialog,
    className: "image-dialog",
    onCancel: () => setZoom(false),
    onClose: () => setZoom(false)
  }, /*#__PURE__*/React.createElement("button", {
    className: "dialog-close",
    onClick: () => setZoom(false)
  }, "\u5173\u95ED\u5927\u56FE"), resultUrl && /*#__PURE__*/React.createElement("img", {
    src: resultUrl,
    alt: "\u672C\u6B21\u751F\u6210\u6F2B\u753B\u539F\u56FE"
  })));
}
window.ImageResult = ImageResult;