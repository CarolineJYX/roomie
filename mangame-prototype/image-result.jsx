const IMAGE_STYLE_NOTE='参考图用途：第一张图片是本次人物和身份的唯一参考。第二张图片若附带，只用于画风、美化程度、线稿和光影参考，不能复制其中的人物身份、服装、场景或故事。';
function ImageResult({session,config,prompt,photo,disabled,onBusy}) {
  const [draft,setDraft]=React.useState(prompt+'\n\n'+IMAGE_STYLE_NOTE+'\n输出规格：一张1024×1536的PNG竖版多格漫画。');
  const [quality,setQuality]=React.useState('high');
  const [useStyle,setUseStyle]=React.useState(true);
  const [confirmed,setConfirmed]=React.useState(false);
  const [job,setJob]=React.useState(null);
  const [pending,setPending]=React.useState(false);
  const [networkError,setNetworkError]=React.useState('');
  const [resultUrl,setResultUrl]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [zoom,setZoom]=React.useState(false);
  const [copy,setCopy]=React.useState(false);
  const request=React.useRef(null), timer=React.useRef(null),mounted=React.useRef(true),inflight=React.useRef(false),urlRef=React.useRef(''),dialog=React.useRef(null),parent=React.useRef(onBusy),previousPrompt=React.useRef(prompt);
  parent.current=onBusy;
  React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(timer.current);if(urlRef.current)URL.revokeObjectURL(urlRef.current);};},[]);
  React.useEffect(()=>{if(previousPrompt.current!==prompt){previousPrompt.current=prompt;setDraft(prompt+'\n\n'+IMAGE_STYLE_NOTE+'\n输出规格：一张1024×1536的PNG竖版多格漫画。');setConfirmed(false);setNotice('GPT-5 已更新脚本。已生成的图片不会跟着改变；再次生图会单独计费。');}},[prompt]);
  React.useEffect(()=>{if(zoom)dialog.current?.showModal();else dialog.current?.close();},[zoom]);
  function lock(value){setPending(value);parent.current(value);}
  async function api(path,body){
    const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),20000);
    try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-MangaMe-Token':config.csrf},body:JSON.stringify(body),signal:ctl.signal});const d=await r.json();if(!r.ok){const error=new Error(d.error||'本地生图请求失败。');error.httpStatus=r.status;throw error;}return d;}
    finally{clearTimeout(timeout);}
  }
  async function content(d){
    try{
      const body=await api('/api/image-content',{session,request_id:d.request_id});
      if(!mounted.current)return;
      const bytes=Uint8Array.from(atob(body.image_base64),c=>c.charCodeAt(0));
      const blob=new Blob([bytes],{type:'image/png'});const url=URL.createObjectURL(blob);
      if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=url;setResultUrl(url);setNetworkError('');
    }catch(e){if(mounted.current)setNetworkError('图片已完成，但读取失败。点击“重新读取结果”，不会重新生图。');}
  }
  async function accept(d){
    if(!mounted.current)return;
    setJob(d);setNetworkError('');
    if(d.status==='generating'){lock(true);clearTimeout(timer.current);timer.current=setTimeout(()=>poll(d.request_id),2500);}
    else {lock(false);setConfirmed(false);if(d.status==='ready')await content(d);}
  }
  async function poll(id){
    try{await accept(await api('/api/image-status',{session,request_id:id}));}
    catch(e){if(mounted.current){setNetworkError('暂时无法查询状态，请检查本地后端。点击“查询当前任务”只查询，不重复提交生图。');lock(true);}}
  }
  async function submit(recover=false){
    if(inflight.current||(!recover&&(disabled||pending||!confirmed||!draft.trim())))return;
    if(!recover){
      if(!window.confirm(`将使用当前照片和下方完整 Prompt，生成1张${quality==='high'?'高':'中'}质量漫画。此操作会产生OpenAI生图费用，确认继续？`))return;
      request.current={session,request_id:crypto.randomUUID(),prompt:draft,quality,use_style:useStyle,confirm_cost:true};
      setResultUrl('');if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current='';}setJob(null);
    }
    if(!request.current)return;
    inflight.current=true;lock(true);setNetworkError('');setNotice('');
    try{await accept(await api('/api/image-generate',request.current));}
    catch(e){if(mounted.current){if(e.httpStatus&&e.httpStatus<500){lock(false);setConfirmed(false);setNotice('本地后端拒绝提交：'+e.message+' 本次未创建新的生图任务。');}else setNetworkError('提交结果未确认：'+e.message+'。请先查询当前任务；若需重发，将使用同一请求编号避免重复生成。');}}
    finally{inflight.current=false;}
  }
  const frozen=disabled||pending;
  async function copyDraft(){try{await navigator.clipboard.writeText(draft);setCopy(true);}catch(_){setNotice('复制失败，请下载TXT或手动复制。');}}
  function saveDraft(){const u=URL.createObjectURL(new Blob([draft],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='MangaMe-image-prompt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  return <section className="image-studio" aria-label="真实漫画生成">
    <span className="chapter-mark">确认脚本，画出这一话</span><h2>从你的故事，生成你的漫画</h2>
    <p>下方是即将发送给 Image2 的完整 Prompt，可以修改。不会使用固定示例脚本，也不会自动生图。</p>
    <label htmlFor="image-prompt">发送给图片模型的完整 Prompt</label>
    <textarea id="image-prompt" value={draft} disabled={frozen} maxLength={30000} rows={16} onChange={e=>{setDraft(e.target.value);setConfirmed(false);setCopy(false);}}/>
    <div className="live-actions"><button type="button" className="reader-action" onClick={copyDraft}>{copy?'已复制':'复制最终 Prompt'}</button><button type="button" className="reader-action" onClick={saveDraft}>下载最终 Prompt</button></div>
    <div className="image-reference"><figure><img src={photo} alt="本次人物参考原照片"/><figcaption>本次照片 · 人物参考</figcaption></figure><figure><img src="assets/manga-style-preview-v2.png" alt="第二版日漫画风参考"/><figcaption>第二版样张 · 仅参考画风</figcaption></figure></div>
    <div className="image-options"><label>输出质量<select value={quality} disabled={frozen} onChange={e=>{setQuality(e.target.value);setConfirmed(false);}}><option value="high">高质量 · 推荐效果测试</option><option value="medium">中质量 · 快速测试</option></select></label><label className="live-consent"><input type="checkbox" checked={useStyle} disabled={frozen} onChange={e=>{setUseStyle(e.target.checked);setConfirmed(false);}}/><span>附上第二版画风参考（只控制画风，不替换本次人物）</span></label></div>
    <p className="prototype-disclosure">gpt-image-2 · 1024×1536 · 1张 PNG。高质量通常比中质量费用高、等待更久，实际费用以 OpenAI 账单为准。原版叙事 Prompt 与三轮提问规则不变。</p>
    <label className="live-consent"><input type="checkbox" checked={confirmed} disabled={frozen} onChange={e=>setConfirmed(e.target.checked)}/><span>我已核对 Prompt 和参考图片，同意将它们发送至 OpenAI 并产生一次生图费用。每会话最多2次生图尝试，不自动重试。</span></label>
    <button className="primary-button" type="button" disabled={frozen||!confirmed||!draft.trim()||!config?.image_supported||(job?.image_calls>=2)} onClick={()=>submit(false)}>{job?'确认重新生成（再次计费）':'生成我的漫画'}</button>
    {!config?.image_supported&&<p className="live-error">当前后端还未加载完整生图功能，请重启 prompt_server.py 后刷新页面。</p>}
    {pending&&<p role="status">{job?.status==='generating'?'Image2 正在生成漫画……':'正在确认生图任务……'}没有真实百分比可显示，请等待。不要重启后端或关闭页面，结果目前只保存在内存。</p>}
    {networkError&&<div className="live-error" role="alert"><p>{networkError}</p><div className="live-actions">{job?.status==='ready'?<button className="reader-action" onClick={()=>content(job)}>重新读取结果</button>:<><button className="reader-action" onClick={()=>poll(request.current?.request_id)}>查询当前任务</button>{!job&&<button className="reader-action" onClick={()=>submit(true)}>重发同一请求（保持原编号）</button>}</>}</div></div>}
    {job&&<><p className="prototype-disclosure">状态：{job.status} · 生图尝试 {job.image_calls}/2 · 后端累计 {job.image_total}/5 · {job.seconds??0}秒</p>{['failed','uncertain'].includes(job.status)&&<p className="live-error" role="alert">{job.error||'生图没有完成。'}{job.status==='uncertain'?'上游可能已经计费。新的生图请求可能再次计费，请勿连续重试。':''}</p>}<details><summary>核对本次生图实际输入</summary><p>模型：{job.model} · 质量：{job.quality} · 尺寸：{job.size} · 画风参考：{job.use_style?'开启':'关闭'}</p><p>请求编号：{job.request_id}</p><p className="hash">Prompt SHA256：{job.prompt_sha256}</p><pre>{job.prompt}</pre><p>输入 tokens：{job.usage?.input_tokens??'未返回'} · 输出 tokens：{job.usage?.output_tokens??'未返回'}</p></details></>}
    {resultUrl&&<section className="actual-comic"><span className="chapter-mark">本次真实生成结果 · 非示例</span><h2>你的这一话，画好了。</h2><p>请检查人物、中文文字和事件顺序。确认满意后下载保存；刷新页面或重启服务可能丢失当前结果。</p><button className="actual-image" onClick={()=>setZoom(true)} aria-label="放大本次生成的漫画"><img src={resultUrl} alt="Image2 根据本次原照片和确认Prompt实际生成的漫画"/></button><div className="live-actions"><a className="primary-button" href={resultUrl} download="MangaMe-my-comic.png">下载本次漫画 PNG</a><button className="reader-action" onClick={()=>setZoom(true)}>放大查看</button></div>{job?.prompt!==draft&&<p className="prototype-disclosure">你已修改编辑框。上面的图片仍对应“本次生图实际输入”中的旧 Prompt。</p>}</section>}
    {notice&&<p role="status">{notice}</p>}
    <dialog ref={dialog} className="image-dialog" onCancel={()=>setZoom(false)} onClose={()=>setZoom(false)}><button className="dialog-close" onClick={()=>setZoom(false)}>关闭大图</button>{resultUrl&&<img src={resultUrl} alt="本次生成漫画原图"/>}</dialog>
  </section>;
}
window.ImageResult=ImageResult;
