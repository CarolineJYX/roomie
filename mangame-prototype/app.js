const {
  useEffect,
  useMemo,
  useRef,
  useState
} = React;
const SAMPLE_PHOTO = "assets/dorm-original-photo.png";
const COMIC_EXPORTS = {
  b: "assets/report-day-comic.png"
};
const SAMPLE_ANSWERS = ["大学报到的中午，我们在校门口吃了黄焖鸡米饭。", "我不太会铺床，是她主动来帮我。用半天时间把宿舍收拾好，那天下午辅导员为我们拍了合影。", "转眼，我们已经毕业4年了。"];
const SvgIcon = ({
  name,
  size = 22
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true
  };
  const paths = {
    arrow: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M5 12h14"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m13 6 6 6-6 6"
    })),
    back: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m15 18-6-6 6-6"
    })),
    upload: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 16V4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m7 9 5-5 5 5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 20h14"
    })),
    sparkle: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m19 14 .7 2.3L22 17.5l-2.3 1.2L19 21l-.7-2.3-2.3-1.2 2.3-1.2L19 14Z"
    })),
    mic: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "3",
      width: "6",
      height: "12",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 11a7 7 0 0 0 14 0"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 18v3"
    })),
    check: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m5 12 4 4L19 6"
    })),
    edit: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 20h9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"
    })),
    share: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "5",
      r: "2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "12",
      r: "2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "19",
      r: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m8 11 8-5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m8 13 8 5"
    })),
    download: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 3v12"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m7 10 5 5 5-5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 21h14"
    })),
    close: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "m6 6 12 12"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m18 6-12 12"
    })),
    book: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z"
    }))
  };
  return /*#__PURE__*/React.createElement("svg", common, paths[name]);
};
const PrimaryButton = ({
  children,
  onClick,
  disabled = false,
  icon = "arrow",
  type = "button",
  className = ""
}) => /*#__PURE__*/React.createElement("button", {
  className: `primary-button ${className}`,
  onClick: onClick,
  disabled: disabled,
  type: type
}, /*#__PURE__*/React.createElement("span", null, children), /*#__PURE__*/React.createElement(SvgIcon, {
  name: icon,
  size: 20
}));
const GhostButton = ({
  children,
  onClick,
  icon,
  className = ""
}) => /*#__PURE__*/React.createElement("button", {
  className: `ghost-button ${className}`,
  onClick: onClick,
  type: "button"
}, icon ? /*#__PURE__*/React.createElement(SvgIcon, {
  name: icon,
  size: 19
}) : null, /*#__PURE__*/React.createElement("span", null, children));
const Brand = ({
  onClick
}) => /*#__PURE__*/React.createElement("button", {
  className: "brand",
  onClick: onClick,
  "aria-label": "\u8FD4\u56DE MangaMe \u9996\u9875"
}, /*#__PURE__*/React.createElement("span", {
  className: "brand-word"
}, "MangaMe"), /*#__PURE__*/React.createElement("span", {
  className: "brand-cn"
}, "\u5FEB\u4E50\u8FDE\u8F7D\u4E2D"));
const AppHeader = ({
  screen,
  onHome,
  onBack
}) => {
  const steps = ["upload", "observe", "interview", "style", "generating", "result"];
  const active = steps.indexOf(screen);
  return /*#__PURE__*/React.createElement("header", {
    className: "app-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "header-side"
  }, screen !== "landing" && screen !== "result" ? /*#__PURE__*/React.createElement("button", {
    className: "icon-button",
    onClick: onBack,
    "aria-label": "\u8FD4\u56DE\u4E0A\u4E00\u6B65"
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    name: "back"
  })) : null), /*#__PURE__*/React.createElement(Brand, {
    onClick: onHome
  }), /*#__PURE__*/React.createElement("div", {
    className: "header-side header-side-right"
  }, active >= 0 && screen !== "result" ? /*#__PURE__*/React.createElement("span", {
    className: "step-count"
  }, String(active + 1).padStart(2, "0"), " / 05") : null), active >= 0 && screen !== "result" ? /*#__PURE__*/React.createElement("div", {
    className: "progress-line"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: `${Math.min(100, (active + 1) / 5 * 100)}%`
    }
  })) : null);
};
const PhotoFrame = ({
  src,
  comic = false,
  className = "",
  alt = "朋友合照"
}) => /*#__PURE__*/React.createElement("div", {
  className: `photo-frame ${comic ? "comic-photo" : ""} ${className}`
}, /*#__PURE__*/React.createElement("img", {
  src: src,
  alt: alt
}), comic ? /*#__PURE__*/React.createElement("div", {
  className: "halftone"
}) : null);
function Landing({
  photo,
  onStart,
  onSample
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: "landing",
    "data-screen-label": "\u9996\u9875"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-copy"
  }, /*#__PURE__*/React.createElement("div", {
    className: "live-pill"
  }, /*#__PURE__*/React.createElement("span", null), " \u5FEB\u4E50\u8FDE\u8F7D\u4E2D"), /*#__PURE__*/React.createElement("h1", null, "\u628A\u4F60\u7684\u7F8E\u597D\u56DE\u5FC6\uFF0C", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", null, "\u753B\u6210\u6F2B\u753B\u3002")), /*#__PURE__*/React.createElement("p", null, "\u4E0A\u4F20\u4E00\u5F20\u7167\u7247\uFF0C\u8BB2\u8BB2\u5B83\u4E4B\u524D\u548C\u4E4B\u540E\u53D1\u751F\u7684\u4E8B\u3002MangaMe \u4F1A\u628A\u8FD9\u4E00\u77AC\u95F4\u5C55\u5F00\u6210\u4E00\u7BC7\u7EC6\u817B\u65E5\u6F2B\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "hero-actions"
  }, /*#__PURE__*/React.createElement(PrimaryButton, {
    onClick: onStart
  }, "\u5F00\u59CB\u6211\u7684\u7B2C\u4E00\u8BDD"), /*#__PURE__*/React.createElement(GhostButton, {
    onClick: onSample,
    icon: "book"
  }, "\u76F4\u63A5\u4F53\u9A8C\u793A\u4F8B")), /*#__PURE__*/React.createElement("div", {
    className: "promise-row"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(SvgIcon, {
    name: "check",
    size: 16
  }), " \u4FDD\u7559\u9762\u90E8\u7279\u5F81"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(SvgIcon, {
    name: "check",
    size: 16
  }), " \u6545\u4E8B\u7531\u4F60\u786E\u8BA4"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(SvgIcon, {
    name: "check",
    size: 16
  }), " \u7BC7\u5E45\u968F\u6545\u4E8B\u51B3\u5B9A"))), /*#__PURE__*/React.createElement("div", {
    className: "hero-visual",
    "aria-label": "\u4ECE\u4E00\u5F20\u771F\u5B9E\u7167\u7247\u5C55\u5F00\u4E3A\u591A\u683C\u6F2B\u753B"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-label label-photo"
  }, "\u552F\u4E00\u539F\u7167\u7247"), /*#__PURE__*/React.createElement(PhotoFrame, {
    src: photo,
    className: "hero-photo-real"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-arrow"
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    name: "arrow",
    size: 28
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-label label-comic"
  }, "\u5C55\u5F00\u6210\u7B2C 01 \u8BDD"), /*#__PURE__*/React.createElement("button", {
    className: "hero-longcomic",
    onClick: onSample,
    "aria-label": "\u6253\u5F00\u5B8C\u6574\u5927\u5B66\u6F2B\u753B\u793A\u4F8B"
  }, /*#__PURE__*/React.createElement("img", {
    src: COMIC_EXPORTS.b,
    alt: "\u7531\u4E00\u5F20\u5BBF\u820D\u5408\u7167\u5C55\u5F00\u7684\u516D\u683C\u5927\u5B66\u751F\u6D3B\u6F2B\u753B\uFF0C\u542B\u4E2D\u6587\u65C1\u767D"
  })), /*#__PURE__*/React.createElement("div", {
    className: "hero-caption"
  }, /*#__PURE__*/React.createElement("b", null, "\u300A\u62A5\u5230\u7B2C\u4E00\u5929\u7684\u5408\u5F71\u300B"), /*#__PURE__*/React.createElement("span", null, "\u4E00\u987F\u5348\u996D\u3001\u4E00\u8D77\u94FA\u5E8A\u3001\u7B2C\u4E00\u6B21\u5408\u5F71\u3002\u8F6C\u773C\uFF0C\u5DF2\u7ECF\u6BD5\u4E1A4\u5E74\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "burst burst-one"
  }, "HA!"), /*#__PURE__*/React.createElement("div", {
    className: "burst burst-two"
  }, "TO BE CONTINUED")));
}
function ResultScreen({
  photo,
  answers,
  onRestart
}) {
  const edition = "b";
  const [showPhoto, setShowPhoto] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [status, setStatus] = useState("");
  const dialogRef = useRef(null);
  const isSample = photo === SAMPLE_PHOTO;
  const image = COMIC_EXPORTS[edition];
  useEffect(() => {
    if (zoom) dialogRef.current?.showModal();else dialogRef.current?.close();
  }, [zoom]);
  const share = async () => {
    setStatus("");
    try {
      const response = await fetch(image);
      if (!response.ok) throw new Error("image unavailable");
      const file = new File([await response.blob()], `MangaMe-${edition}.png`, {
        type: "image/png"
      });
      if (navigator.canShare?.({
        files: [file]
      })) {
        await navigator.share({
          files: [file],
          title: "报到第一天的合影"
        });
        setStatus("已完成系统分享操作。");
      } else setStatus("浏览器不支持图片分享。请下载 PNG 后发送给朋友；本地预览链接不能对外分享。");
    } catch (error) {
      if (error.name !== "AbortError") setStatus("未能分享图片，请尝试下载 PNG。");
    }
  };
  return /*#__PURE__*/React.createElement("main", {
    className: "result-screen long-result",
    "data-screen-label": "\u5B8C\u6574\u6F2B\u753B\u957F\u56FE"
  }, /*#__PURE__*/React.createElement("nav", {
    className: "result-nav"
  }, /*#__PURE__*/React.createElement(Brand, {
    onClick: onRestart
  }), /*#__PURE__*/React.createElement("div", {
    className: "result-actions"
  }, /*#__PURE__*/React.createElement(PrimaryButton, {
    icon: "share",
    onClick: share
  }, "\u5206\u4EAB\u56FE\u7247"))), /*#__PURE__*/React.createElement("header", {
    className: "long-heading"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u4E00\u5F20\u7167\u7247 \xB7 \u4E00\u6574\u7BC7\u6F2B\u753B"), /*#__PURE__*/React.createElement("h1", null, "\u62A5\u5230\u7B2C\u4E00\u5929\u7684\u5408\u5F71"), /*#__PURE__*/React.createElement("p", null, "\u9EC4\u7116\u9E21\u7C73\u996D\u3001\u4E00\u8D77\u94FA\u5E8A\u3001\u8F85\u5BFC\u5458\u7684\u5FEB\u95E8\u3002\u56DB\u5E74\u540E\uFF0C\u518D\u770B\u62A5\u5230\u7B2C\u4E00\u5929\u3002"), /*#__PURE__*/React.createElement("p", {
    className: "prototype-disclosure"
  }, "\u9884\u751F\u6210\u793A\u4F8B \xB7 \u4E2D\u6587\u548C\u753B\u9762\u5747\u7531\u56FE\u7247\u6A21\u578B\u751F\u6210\uFF0C\u5F53\u524D\u9875\u9762\u4E0D\u8C03\u7528\u751F\u6210\u63A5\u53E3\u3002"), !isSample && /*#__PURE__*/React.createElement("p", {
    className: "custom-warning",
    role: "status"
  }, "\u4E0B\u65B9\u662F\u9884\u5148\u751F\u6210\u7684\u5927\u5B66\u6545\u4E8B\u793A\u4F8B\uFF0C\u4E0D\u662F\u6839\u636E\u672C\u6B21\u7167\u7247\u6216 Prompt \u5B9E\u65F6\u751F\u6210\u7684\u7ED3\u679C\u3002")), /*#__PURE__*/React.createElement("div", {
    className: "comic-workspace"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "story-sidebar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rail-label"
  }, "\u6545\u4E8B\u4ECE\u8FD9\u91CC\u5F00\u59CB"), /*#__PURE__*/React.createElement("img", {
    src: SAMPLE_PHOTO,
    alt: "\u793A\u4F8B\u7684\u552F\u4E00\u8F93\u5165\uFF1A\u5BBF\u820D\u5408\u7167"
  }), /*#__PURE__*/React.createElement("h2", null, "\u53EA\u9700\u8981\u8FD9\u4E00\u5F20\u5408\u7167"), /*#__PURE__*/React.createElement("p", null, "\u4EBA\u7269\u53C2\u8003\u6765\u81EA\u7167\u7247\uFF1B\u5348\u996D\u3001\u94FA\u5E8A\u4E0E\u5408\u5F71\u7684\u7ECF\u5386\u6765\u81EA\u793A\u4F8B\u8BB2\u8FF0\u3002"), /*#__PURE__*/React.createElement("ol", null, /*#__PURE__*/React.createElement("li", null, "\u6821\u95E8\u53E3\u4E00\u8D77\u5403\u5348\u996D"), /*#__PURE__*/React.createElement("li", null, "\u5979\u4E3B\u52A8\u5E2E\u6211\u94FA\u5E8A"), /*#__PURE__*/React.createElement("li", null, "\u6536\u62FE\u597D\u65B0\u5BBF\u820D"), /*#__PURE__*/React.createElement("li", null, "\u8F85\u5BFC\u5458\u62CD\u4E0B\u5408\u5F71"), /*#__PURE__*/React.createElement("li", null, "\u6BD5\u4E1A\u56DB\u5E74\u540E\u518D\u56DE\u770B")), /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", null, "\u67E5\u770B\u672C\u6B21\u8BB2\u8FF0"), answers.map((answer, index) => /*#__PURE__*/React.createElement("p", {
    key: index
  }, answer)), /*#__PURE__*/React.createElement("small", null, "\u4FEE\u6539\u8BB2\u8FF0\u4E0D\u4F1A\u81EA\u52A8\u6539\u53D8\u5DF2\u7ECF\u751F\u6210\u7684\u957F\u56FE\u3002"))), /*#__PURE__*/React.createElement("section", {
    className: "longcomic-reader",
    "aria-label": "\u6F2B\u753B\u957F\u56FE\u9605\u8BFB\u533A"
  }, /*#__PURE__*/React.createElement("div", {
    className: "reader-toolbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chapter-mark"
  }, "\u539F\u7248\u53D9\u4E8B \xB7 \u6548\u679C\u793A\u4F8B"), /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    "aria-pressed": showPhoto,
    onClick: () => setShowPhoto(!showPhoto)
  }, showPhoto ? "返回漫画" : "对照原照片")), /*#__PURE__*/React.createElement("button", {
    className: "longcomic-image",
    onClick: () => setZoom(true),
    "aria-label": "\u653E\u5927\u9605\u8BFB\u5F53\u524D\u56FE\u7247"
  }, /*#__PURE__*/React.createElement("img", {
    src: showPhoto ? SAMPLE_PHOTO : image,
    alt: showPhoto ? "原始宿舍合照" : `报到第一天的合影，完整中文漫画`
  })), /*#__PURE__*/React.createElement("div", {
    className: "reader-footer"
  }, /*#__PURE__*/React.createElement("span", null, showPhoto ? "原照片" : `效果示例 · PNG · 941 × 1672`, " \xB7 \u70B9\u51FB\u56FE\u7247\u653E\u5927"), /*#__PURE__*/React.createElement("button", {
    className: "reader-action",
    onClick: () => setZoom(true)
  }, "\u653E\u5927\u9605\u8BFB")), /*#__PURE__*/React.createElement("p", {
    className: "prototype-disclosure"
  }, "\u56FE\u7247\u4E2D\u7684\u4E2D\u6587\u5DF2\u5305\u542B\u5728 PNG \u5185\uFF0C\u4E0D\u662F\u53EF\u7F16\u8F91\u6587\u672C\u5C42\uFF1B\u8981\u4FEE\u6539\u5B57\u53E5\uFF0C\u9700\u8981\u91CD\u65B0\u751F\u6210\u6216\u5236\u4F5C\u72EC\u7ACB\u6587\u5B57\u5C42\u3002"), /*#__PURE__*/React.createElement("div", {
    className: "download-actions"
  }, /*#__PURE__*/React.createElement("a", {
    className: "primary-button",
    href: image,
    download: `MangaMe-报到第一天的合影-${edition.toUpperCase()}.png`
  }, "\u4E0B\u8F7D\u793A\u4F8B PNG ", /*#__PURE__*/React.createElement(SvgIcon, {
    name: "download",
    size: 20
  })), /*#__PURE__*/React.createElement(GhostButton, {
    icon: "book",
    onClick: onRestart
  }, "\u5F00\u59CB\u6211\u7684\u6545\u4E8B")), status && /*#__PURE__*/React.createElement("p", {
    className: "share-status",
    role: "status"
  }, status))), /*#__PURE__*/React.createElement("dialog", {
    ref: dialogRef,
    className: "image-dialog",
    onCancel: () => setZoom(false),
    onClose: () => setZoom(false)
  }, /*#__PURE__*/React.createElement("button", {
    className: "dialog-close",
    onClick: () => setZoom(false)
  }, "\u5173\u95ED\u5927\u56FE ", /*#__PURE__*/React.createElement(SvgIcon, {
    name: "close",
    size: 20
  })), /*#__PURE__*/React.createElement("img", {
    src: showPhoto ? SAMPLE_PHOTO : image,
    alt: "\u53EF\u6EDA\u52A8\u67E5\u770B\u7684\u539F\u5C3A\u5BF8\u5927\u56FE"
  })));
}
function App() {
  const [screen, setScreen] = useState("landing");
  // Keep the conversation mounted while viewing the static example.
  const [liveStarted, setLiveStarted] = useState(false);
  function start() {
    setLiveStarted(true);
    setScreen("live");
    window.scrollTo(0, 0);
  }
  function home() {
    setScreen("landing");
    window.scrollTo(0, 0);
  }
  function example() {
    setScreen("result");
    window.scrollTo(0, 0);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: `app app-${screen}`
  }, screen === 'landing' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppHeader, {
    screen: "landing",
    onHome: home
  }), /*#__PURE__*/React.createElement(Landing, {
    photo: SAMPLE_PHOTO,
    onStart: start,
    onSample: example
  })), liveStarted && /*#__PURE__*/React.createElement("div", {
    hidden: screen !== 'live'
  }, /*#__PURE__*/React.createElement(window.LiveWorkflow, {
    onHome: home,
    onExample: example
  })), screen === 'result' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ResultScreen, {
    photo: SAMPLE_PHOTO,
    answers: SAMPLE_ANSWERS,
    onRestart: start
  }), liveStarted && /*#__PURE__*/React.createElement("button", {
    className: "return-live reader-action",
    onClick: start
  }, "\u8FD4\u56DE\u6211\u7684\u5BF9\u8BDD\u4E0E Prompt")));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));