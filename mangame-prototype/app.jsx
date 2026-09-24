const { useEffect, useMemo, useRef, useState } = React;
const SAMPLE_PHOTO = "assets/dorm-original-photo.png";
const COMIC_EXPORTS = { b: "assets/report-day-comic.png" };
const HOME_PHOTO_SOURCES = "assets/dorm-original-photo-home-480-v1.webp 480w, assets/dorm-original-photo-home-960-v1.webp 960w";
const HOME_COMIC_SOURCES = "assets/report-day-comic-home-480-v1.webp 480w, assets/report-day-comic-home-800-v1.webp 800w";
const SAMPLE_ANSWERS = [
  "大学报到的中午，我们在校门口吃了黄焖鸡米饭。",
  "我不太会铺床，是她主动来帮我。用半天时间把宿舍收拾好，那天下午辅导员为我们拍了合影。",
  "转眼，我们已经毕业4年了。",
];

const SvgIcon = ({ name, size = 22 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const paths = {
    arrow: <><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></>,
    back: <><path d="m15 18-6-6 6-6"></path></>,
    upload: <><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 20h14"></path></>,
    sparkle: <><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"></path><path d="m19 14 .7 2.3L22 17.5l-2.3 1.2L19 21l-.7-2.3-2.3-1.2 2.3-1.2L19 14Z"></path></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></>,
    check: <><path d="m5 12 4 4L19 6"></path></>,
    edit: <><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></>,
    share: <><circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="12" r="2"></circle><circle cx="18" cy="19" r="2"></circle><path d="m8 11 8-5"></path><path d="m8 13 8 5"></path></>,
    download: <><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></>,
    close: <><path d="m6 6 12 12"></path><path d="m18 6-12 12"></path></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z"></path><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z"></path></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
};

const PrimaryButton = ({ children, onClick, disabled = false, icon = "arrow", type = "button", className = "" }) => (
  <button className={`primary-button ${className}`} onClick={onClick} disabled={disabled} type={type}>
    <span>{children}</span><SvgIcon name={icon} size={20} />
  </button>
);

const GhostButton = ({ children, onClick, icon, className = "" }) => (
  <button className={`ghost-button ${className}`} onClick={onClick} type="button">
    {icon ? <SvgIcon name={icon} size={19} /> : null}<span>{children}</span>
  </button>
);

const Brand = ({ onClick }) => (
  <button className="brand" onClick={onClick} aria-label="返回 MangaMe 首页">
    <span className="brand-word">MangaMe</span>
    <span className="brand-cn">快乐连载中</span>
  </button>
);

const AppHeader = ({ screen, onHome, onBack }) => {
  const steps = ["upload", "observe", "interview", "style", "generating", "result"];
  const active = steps.indexOf(screen);
  return (
    <header className="app-header">
      <div className="header-side">
        {screen !== "landing" && screen !== "result" ? (
          <button className="icon-button" onClick={onBack} aria-label="返回上一步"><SvgIcon name="back" /></button>
        ) : null}
      </div>
      <Brand onClick={onHome} />
      <div className="header-side header-side-right">
        {active >= 0 && screen !== "result" ? <span className="step-count">{String(active + 1).padStart(2, "0")} / 05</span> : null}
      </div>
      {active >= 0 && screen !== "result" ? (
        <div className="progress-line"><span style={{ width: `${Math.min(100, ((active + 1) / 5) * 100)}%` }}></span></div>
      ) : null}
    </header>
  );
};

const imageFallback = (event, fallback) => {
  event.currentTarget.parentElement?.querySelectorAll("source").forEach((source) => source.remove());
  if (event.currentTarget.src !== new URL(fallback, window.location.href).href) event.currentTarget.src = fallback;
};

const PhotoFrame = ({ src, srcSet, sizes, width, height, comic = false, className = "", alt = "朋友合照" }) => (
  <div className={`photo-frame ${comic ? "comic-photo" : ""} ${className}`}>
    <picture>
      {srcSet ? <source type="image/webp" srcSet={srcSet} sizes={sizes} /> : null}
      <img src={src} alt={alt} width={width} height={height} decoding="async" onError={(event) => imageFallback(event, src)} />
    </picture>
    {comic ? <div className="halftone"></div> : null}
  </div>
);

function Landing({ photo, onStart, onSample }) {
  return (
    <main className="landing" data-screen-label="首页">
      <div className="hero-copy">
        <div className="live-pill"><span></span> 快乐连载中</div>
        <h1>把你的美好回忆，<br /><em>画成漫画。</em></h1>
        <p>上传一张照片，讲讲它之前和之后发生的事。MangaMe 会把这一瞬间展开成一篇细腻日漫。</p>
        <div className="hero-actions">
          <PrimaryButton onClick={onStart}>开始我的第一话</PrimaryButton>
          <GhostButton onClick={onSample} icon="book">直接体验示例</GhostButton>
        </div>
        <div className="promise-row">
          <span><SvgIcon name="check" size={16} /> 保留面部特征</span>
          <span><SvgIcon name="check" size={16} /> 故事由你确认</span>
          <span><SvgIcon name="check" size={16} /> 篇幅随故事决定</span>
        </div>
      </div>
      <div className="hero-visual" aria-label="从一张真实照片展开为多格漫画">
        <div className="hero-label label-photo">唯一原照片</div>
        <PhotoFrame src={photo} srcSet={HOME_PHOTO_SOURCES} sizes="(max-width: 720px) 46vw, 24vw" width="1448" height="1086" className="hero-photo-real" />
        <div className="hero-arrow"><SvgIcon name="arrow" size={28} /></div>
        <div className="hero-label label-comic">展开成第 01 话</div>
        <button className="hero-longcomic" onClick={onSample} aria-label="打开完整大学漫画示例">
          <picture>
            <source type="image/webp" srcSet={HOME_COMIC_SOURCES} sizes="(max-width: 720px) 67vw, 28vw" />
            <img src={COMIC_EXPORTS.b} width="941" height="1672" decoding="async" fetchPriority="high" onError={(event) => imageFallback(event, COMIC_EXPORTS.b)} alt="由一张宿舍合照展开的六格大学生活漫画，含中文旁白" />
          </picture>
        </button>
        <div className="hero-caption">
          <b>《报到第一天的合影》</b>
          <span>一顿午饭、一起铺床、第一次合影。转眼，已经毕业4年。</span>
        </div>
        <div className="burst burst-one">HA!</div>
        <div className="burst burst-two">TO BE CONTINUED</div>
      </div>
    </main>
  );
}

function ResultScreen({ photo, answers, onRestart }) {
  const edition = "b";
  const [showPhoto, setShowPhoto] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [status, setStatus] = useState("");
  const dialogRef = useRef(null);
  const isSample = photo === SAMPLE_PHOTO;
  const image = COMIC_EXPORTS[edition];
  useEffect(() => {
    if (zoom) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [zoom]);
  const share = async () => {
    setStatus("");
    try {
      const response = await fetch(image);
      if (!response.ok) throw new Error("image unavailable");
      const file = new File([await response.blob()], `MangaMe-${edition}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "报到第一天的合影" });
        setStatus("已完成系统分享操作。");
      } else setStatus("浏览器不支持图片分享。请下载 PNG 后发送给朋友；本地预览链接不能对外分享。");
    } catch (error) {
      if (error.name !== "AbortError") setStatus("未能分享图片，请尝试下载 PNG。");
    }
  };
  return (
    <main className="result-screen long-result" data-screen-label="完整漫画长图">
      <nav className="result-nav">
        <Brand onClick={onRestart} />
        <div className="result-actions"><PrimaryButton icon="share" onClick={share}>分享图片</PrimaryButton></div>
      </nav>
      <header className="long-heading">
        <span className="chapter-mark">一张照片 · 一整篇漫画</span>
        <h1>报到第一天的合影</h1>
        <p>黄焖鸡米饭、一起铺床、辅导员的快门。四年后，再看报到第一天。</p>
        <p className="prototype-disclosure">预生成示例 · 中文和画面均由图片模型生成，当前页面不调用生成接口。</p>
        {!isSample && <p className="custom-warning" role="status">下方是预先生成的大学故事示例，不是根据本次照片或 Prompt 实时生成的结果。</p>}
      </header>
      <div className="comic-workspace">
        <aside className="story-sidebar">
          <span className="rail-label">故事从这里开始</span>
          <img src={SAMPLE_PHOTO} alt="示例的唯一输入：宿舍合照" />
          <h2>只需要这一张合照</h2>
          <p>人物参考来自照片；午饭、铺床与合影的经历来自示例讲述。</p>
          <ol><li>校门口一起吃午饭</li><li>她主动帮我铺床</li><li>收拾好新宿舍</li><li>辅导员拍下合影</li><li>毕业四年后再回看</li></ol>
          <details><summary>查看本次讲述</summary>{answers.map((answer, index) => <p key={index}>{answer}</p>)}<small>修改讲述不会自动改变已经生成的长图。</small></details>
        </aside>
        <section className="longcomic-reader" aria-label="漫画长图阅读区">
          <div className="reader-toolbar">
            <span className="chapter-mark">原版叙事 · 效果示例</span>
            <button className="reader-action" aria-pressed={showPhoto} onClick={() => setShowPhoto(!showPhoto)}>{showPhoto ? "返回漫画" : "对照原照片"}</button>
          </div>
          <button className="longcomic-image" onClick={() => setZoom(true)} aria-label="放大阅读当前图片">
            <img src={showPhoto ? SAMPLE_PHOTO : image} alt={showPhoto ? "原始宿舍合照" : `报到第一天的合影，完整中文漫画`} />
          </button>
          <div className="reader-footer"><span>{showPhoto ? "原照片" : `效果示例 · PNG · 941 × 1672`} · 点击图片放大</span><button className="reader-action" onClick={() => setZoom(true)}>放大阅读</button></div>
          <p className="prototype-disclosure">图片中的中文已包含在 PNG 内，不是可编辑文本层；要修改字句，需要重新生成或制作独立文字层。</p>
          <div className="download-actions">
            <a className="primary-button" href={image} download={`MangaMe-报到第一天的合影-${edition.toUpperCase()}.png`}>下载示例 PNG <SvgIcon name="download" size={20} /></a>
            <GhostButton icon="book" onClick={onRestart}>开始我的故事</GhostButton>
          </div>
          {status && <p className="share-status" role="status">{status}</p>}
        </section>
      </div>
      <dialog ref={dialogRef} className="image-dialog" onCancel={() => setZoom(false)} onClose={() => setZoom(false)}>
        <button className="dialog-close" onClick={() => setZoom(false)}>关闭大图 <SvgIcon name="close" size={20} /></button>
        <img src={showPhoto ? SAMPLE_PHOTO : image} alt="可滚动查看的原尺寸大图" />
      </dialog>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState("landing");
  // Keep the conversation mounted while viewing the static example.
  const [liveStarted, setLiveStarted] = useState(false);
  function start(){setLiveStarted(true);setScreen("live");window.scrollTo(0,0);}
  function home(){setScreen("landing");window.scrollTo(0,0);}
  function example(){setScreen("result");window.scrollTo(0,0);}
  return <div className={`app app-${screen}`}>
    {screen==='landing'&&<><AppHeader screen="landing" onHome={home}/><Landing photo={SAMPLE_PHOTO} onStart={start} onSample={example}/></>}
    {liveStarted&&<div hidden={screen!=='live'}><window.LiveWorkflow onHome={home} onExample={example}/></div>}
    {screen==='result'&&<><ResultScreen photo={SAMPLE_PHOTO} answers={SAMPLE_ANSWERS} onRestart={start}/>{liveStarted&&<button className="return-live reader-action" onClick={start}>返回我的对话与 Prompt</button>}</>}
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
