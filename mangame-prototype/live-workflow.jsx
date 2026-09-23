const {useState: useLiveState, useEffect: useLiveEffect, useRef: useLiveRef} = React;
const AUTO_STYLE_NOTE='参考图用途：第一张图片是本次人物和身份的唯一参考。第二张图片若附带，只用于画风、美化程度、线稿和光影参考，不复制其中人物、服装、场景和故事。输出规格：一张1024×1536的PNG竖版多格漫画。';
function createRequestId(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function LiveWorkflow({onHome,onExample}) {
  const [stage,setStage]=useLiveState('upload');
  const [config,setConfig]=useLiveState(null),[photo,setPhoto]=useLiveState(''),[consent,setConsent]=useLiveState(false);
  const [quality,setQuality]=useLiveState('high'),[style,setStyle]=useLiveState(true);
  const [session,setSession]=useLiveState(null),[messages,setMessages]=useLiveState([]),[rounds,setRounds]=useLiveState(0),[answer,setAnswer]=useLiveState('');
  const [busy,setBusy]=useLiveState(false),[voiceBusy,setVoiceBusy]=useLiveState(false),[error,setError]=useLiveState('');
  const [prompt,setPrompt]=useLiveState(''),[job,setJob]=useLiveState(null),[imageUrl,setImageUrl]=useLiveState('');
  const [operation,setOperation]=useLiveState('script'),[seconds,setSeconds]=useLiveState(0),[notice,setNotice]=useLiveState('');
  const [zoom,setZoom]=useLiveState(false),[compare,setCompare]=useLiveState(false);
  const cfg=useLiveRef(null),sid=useLiveRef(null),request=useLiveRef(null),lock=useLiveRef(false),alive=useLiveRef(true),timer=useLiveRef(null),started=useLiveRef(0),pendingReply=useLiveRef(''),url=useLiveRef(''),dialog=useLiveRef(null),chat=useLiveRef(null),answerRef=useLiveRef('');
  answerRef.current=answer;
  useLiveEffect(()=>{alive.current=true;fetch('/api/config').then(r=>{if(!r.ok)throw Error();return r.json();}).then(c=>{if(!alive.current)return;cfg.current=c;setConfig(c);if(!c.image_supported)setError('请重启本地后端，当前服务还未加载完整生图功能。');}).catch(()=>{if(alive.current)setError('请通过 http://127.0.0.1:4180 打开本地后端。');});return()=>{alive.current=false;clearTimeout(timer.current);if(url.current)URL.revokeObjectURL(url.current);};},[]);
  useLiveEffect(()=>{if(stage!=='generating')return;const t=setInterval(()=>setSeconds(Math.floor((Date.now()-started.current)/1000)),1000);return()=>clearInterval(t);},[stage]);
  useLiveEffect(()=>{if(chat.current)chat.current.scrollTop=chat.current.scrollHeight;},[messages,busy]);
  useLiveEffect(()=>{if(zoom)dialog.current?.showModal();else dialog.current?.close();},[zoom]);
  useLiveEffect(()=>{function prevent(e){if(stage==='generating'||busy||voiceBusy){e.preventDefault();e.returnValue='';}}window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[stage,busy,voiceBusy]);
  async function api(path,body,timeout=180000){
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);
    try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-MangaMe-Token':cfg.current.csrf},body:JSON.stringify(body),signal:ctl.signal});const d=await r.json();if(d.session){sid.current=d.session;setSession(d.session);}if(!r.ok|| (d.error&&!d.status)){const e=Error(d.error||'请求失败');e.httpStatus=r.status;throw e;}return d;}finally{clearTimeout(t);}
  }
  async function choose(file){
    if(!file)return;if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('请选择8 MB以内的JPG、PNG或WebP图片。');return;}
    setBusy(true);setError('');try{const v=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});setPhoto(v);setConsent(false);}catch(_){setError('读取照片失败，请重新选择。');}finally{setBusy(false);}
  }
  async function sample(){try{const r=await fetch('assets/dorm-original-photo.png');if(!r.ok)throw Error();await choose(new File([await r.blob()],'sample.png',{type:'image/png'}));}catch(_){setError('示例照片未能加载。');}}
  async function start(){
    if(lock.current||!consent||!photo||!config?.key_configured||!config?.image_supported)return;
    lock.current=true;setBusy(true);setError('');setStage('chat');
    try{const d=await api('/api/start',{image:photo,session:sid.current});if(alive.current)setMessages([{role:'assistant',text:d.text}]);}
    catch(e){setError('看图未完成：'+e.message+'。不会自动重试。');}finally{lock.current=false;setBusy(false);}
  }
  function generation(){started.current=Date.now();setSeconds(0);setStage('generating');setOperation('script');}
  async function reply(retry=false){
    if(lock.current||voiceBusy||rounds>=3)return;
    const text=retry?pendingReply.current:answer.trim();if(!text)return;
    pendingReply.current=text;lock.current=true;setBusy(true);setError('');
    if(rounds===2)generation();
    try{
      const d=await api('/api/reply',{session:sid.current,text});
      if(!alive.current)return;
      setMessages(m=>[...m,{role:'user',text},...(d.mode==='chat'?[{role:'assistant',text:d.text}]:[])]);setAnswer('');setRounds(d.answered_rounds);
      if(d.mode==='prompt'){setPrompt(d.text);await generate(d.text,false);}else setStage('chat');
    }catch(e){setError(e.message+'。原回答已保留，失败或超时可能已计费。');}
    finally{lock.current=false;setBusy(false);}
  }
  const submittingImage=useLiveRef(false);
  async function generate(text,retry){
    if(submittingImage.current)return;
    if(retry&&!confirm('重新生成会新增一次Image2付费调用。确认继续？'))return;
    submittingImage.current=true;
    try{const body={session:sid.current,request_id:createRequestId(),prompt:text+'\n\n'+AUTO_STYLE_NOTE,quality,use_style:style,confirm_cost:true};
    request.current=body;setJob(null);setError('');setOperation('submitting');
    if(retry)generation();await accept(await api('/api/image-generate',body,20000));}
    catch(e){setError('尚未确认生图任务：'+e.message+'。请先查询任务，不要重新生成。');}
    finally{submittingImage.current=false;}
  }
  async function resend(){if(lock.current||!request.current)return;lock.current=true;setBusy(true);setError('');try{await accept(await api('/api/image-generate',request.current,20000));}catch(e){setError(e.message+'。保留原请求编号，不自动重试。');}finally{lock.current=false;setBusy(false);}}
  async function accept(d){
    if(!alive.current)return;setJob(d);setError('');
    if(d.status==='generating'){setOperation('image');clearTimeout(timer.current);timer.current=setTimeout(()=>poll(d.request_id),2500);}
    else if(d.status==='ready'){setOperation('loading');await content(d);}
    else {setOperation('failed');setError(d.error||'生成未完成。');}
  }
  async function poll(id=request.current?.request_id){try{await accept(await api('/api/image-status',{session:sid.current,request_id:id},20000));}catch(e){if(alive.current)setError('暂时无法查询进度，任务可能仍在运行：'+e.message);}}
  async function content(d=job){
    try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),120000);let response;try{response=await fetch('/api/image-content',{method:'POST',headers:{'Content-Type':'application/json','X-MangaMe-Token':config.csrf},body:JSON.stringify({session:sid.current,request_id:d.request_id}),signal:controller.signal});}finally{clearTimeout(timeout);}if(!response.ok){const detail=await response.json().catch(()=>({}));throw new Error(detail.error||`读取失败（${response.status}）`);}const blob=await response.blob();if(!alive.current)return;if(url.current)URL.revokeObjectURL(url.current);url.current=URL.createObjectURL(blob);setImageUrl(url.current);setStage('result');setError('');window.scrollTo(0,0);}
    catch(e){setOperation('loading');setError('漫画已完成，但读取失败。重新读取不会重复生图。');}
  }
  async function reset(){if(busy||voiceBusy)return;if(!confirm('开始新故事会清空当前内容。请先保存漫画，继续吗？'))return;try{if(sid.current)await api('/api/clear',{session:sid.current});sid.current=null;setSession(null);request.current=null;setMessages([]);setRounds(0);setAnswer('');setPhoto('');setConsent(false);setPrompt('');setJob(null);setImageUrl('');if(url.current)URL.revokeObjectURL(url.current);url.current='';setError('');setStage('upload');}catch(e){setError(e.message);}}
  async function share(){try{const blob=await(await fetch(imageUrl)).blob();const file=new File([blob],'MangaMe.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'我的生活漫画'});}else setNotice('此浏览器不支持图片分享，请先保存PNG，再发给朋友。');}catch(e){if(e.name!=='AbortError')setNotice('分享未完成，请下载图片后分享。');}}
  function append(text){const next=answerRef.current+(answerRef.current.trim()?'\n':'')+text;if(next.length>2000)return false;answerRef.current=next;setAnswer(next);return true;}
  const steps=['选照片','聊故事','画漫画','看成果'],index=['upload','chat','generating','result'].indexOf(stage);
  const loadingLines=['你的故事，马上就有画面了。','今天，你是漫画主角。','普通的一天，也值得认真画下来。','等这一话画好，一起翻开看看。'];
  return <main className={'journey journey-'+stage}>
    <nav className="journey-nav"><button onClick={onHome} disabled={busy||voiceBusy||stage==='generating'} className="journey-brand">MangaMe <small>快乐连载中</small></button><div className="journey-steps">{steps.map((s,i)=><span key={s} className={i===index?'active':i<index?'done':''}>{i+1}<em>{s}</em></span>)}</div></nav>
    {stage==='upload'&&<section className="upload-scene"><div className="scene-copy"><span className="chapter-mark">生活漫画 · 从你开始</span><h1>这一话，<br/>从哪张照片开始？</h1><p>选一个忘不掉的瞬间。<br/>聊三个问题，把照片背后的故事画下来。</p><div className="upload-spec">一张照片 · 三轮对话 · 一篇漫画</div></div><div className="upload-sheet"><div className="journey-photo">{photo?<img src={photo} alt="选中的原照片"/>:<div><b>＋</b><p>合照、旅行照，或普通的一天</p></div>}</div><label className="file-choice">{photo?'换一张照片':'选择照片'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>choose(e.target.files[0])}/></label><button className="text-action" onClick={sample} disabled={busy}>用示例照片试试</button><p className="fine-print">JPG / PNG / WebP · 8 MB以内</p><details><summary>高级设置</summary><label>画面质量<select disabled={busy} value={quality} onChange={e=>{setQuality(e.target.value);setConsent(false);}}><option value="high">高质量</option><option value="medium">中质量</option></select></label><label className="journey-consent"><input type="checkbox" checked={style} onChange={e=>{setStyle(e.target.checked);setConsent(false);}}/>使用第二版日漫画风参考</label></details><label className="journey-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>我有权使用照片，同意发送照片、录音（如使用）及讲述至OpenAI，并在第三轮回答后自动生成一张漫画。对话、转写和生图会产生API费用。</span></label><button className="primary-button" disabled={busy||!photo||!consent||!config?.key_configured||!config?.image_supported} onClick={start}>聊聊这张照片 <span>→</span></button>{config&&!config.key_configured&&<p className="journey-error">请在配置密钥的终端启动后端。</p>}</div></section>}
    {stage==='chat'&&<section className="chat-scene"><aside className="chat-photo"><img src={photo} alt="这段故事的照片"/><button className="text-action" disabled={busy||voiceBusy} onClick={reset}>重新选照片</button></aside><div className="conversation-sheet"><header><div><h2>聊聊这张照片</h2></div><span className="round-pill">{Math.min(rounds+1,3)} / 3</span></header><div className="journey-messages" ref={chat} aria-live="polite">{messages.map((m,i)=><article className={'bubble '+m.role} key={i}><b>{m.role==='assistant'?'MangaMe':'你'}</b><p>{m.text}</p></article>)}{busy&&<p className="thinking" role="status">{messages.length?'在认真听你的故事……':'正在看照片，准备和你聊聊……'}</p>}</div>{messages.length>0&&<form className="journey-composer" onSubmit={e=>{e.preventDefault();reply();}}><label htmlFor="story-answer" className="sr-only">输入回答</label><textarea id="story-answer" value={answer} disabled={busy||voiceBusy} maxLength={2000} rows={2} placeholder="说点什么…" onChange={e=>setAnswer(e.target.value)}/><div className="composer-send"><small>{rounds===2?'发送后开始画漫画':''}{answer.length>1800?' · '+answer.length+'/2000':''}</small><div className="composer-icons"><window.VoiceInput session={session} csrf={config?.csrf} disabled={busy} available={!!config?.voice_supported} authorized={consent} onText={append} onBusy={setVoiceBusy} resetKey={session}/><button className="send-icon" disabled={busy||voiceBusy||!answer.trim()} type="submit" aria-label={rounds===2?'说完啦，开始画':'发送回答'} title={rounds===2?'说完啦，开始画':'发送回答'}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div></div></form>}{!messages.length&&!busy&&<button className="reader-action" onClick={start}>手动重试看图</button>}</div></section>}
    {stage==='generating'&&<section className="generation-scene"><div className="drawing-book" aria-hidden="true"><div><img src={photo} alt=""/></div><div className="book-sketch"><i></i><i></i><i></i><span><svg viewBox="0 0 24 24"><path d="M12 1 15 9 23 12 15 15 12 23 9 15 1 12 9 9Z" fill="currentColor"/></svg></span></div></div><span className="chapter-mark">快乐连载中</span><h1>{operation==='script'?'把你的故事，整理成漫画。':operation==='loading'?'画好了，正在打开。':operation==='failed'?'这一话还没有画好。':'正在画你的这一话。'}</h1><p className="loading-line">{error?'请先查看下面的状态说明。':seconds>90?'这次绘制需要久一点，任务仍在处理中。请先不要关闭页面。':loadingLines[Math.floor(seconds/6)%loadingLines.length]}</p><div className="elapsed">已等待 {seconds} 秒 <span>·</span> {operation==='script'?'整理脚本':operation==='loading'?'读取图片':'Image2 绘制'}</div><p className="fine-print">结果只保存在当前本地会话，请勿刷新、关闭页面或重启后端。失败不会自动重新付费生成。</p>{prompt&&<details className="generation-details"><summary>查看本次绘画指令</summary><pre>{request.current?.prompt||prompt}</pre></details>}{error&&<div className="recovery-actions">{operation==='script'?<button className="reader-action" disabled={busy} onClick={()=>reply(true)}>重试脚本整理（可能再次计费）</button>:operation==='loading'?<button className="reader-action" onClick={()=>content()}>重新读取图片</button>:operation==='failed'?<button className="reader-action" disabled={job?.image_calls>=2} onClick={()=>generate(prompt,true)}>重新生成（再次计费）</button>:<><button className="reader-action" onClick={()=>poll()}>查询当前任务</button>{!job&&<button className="reader-action" disabled={busy} onClick={resend}>恢复提交（同一请求编号）</button>}</>}</div>}</section>}
    {stage==='result'&&<section className="result-scene"><header><span className="chapter-mark">你的生活 · 新的一话</span><h1>你的这一话，画好了。</h1><p>把它存下来，也分享给故事里的人。</p></header><div className="result-layout"><button className="finished-comic" onClick={()=>setZoom(true)} aria-label="放大我的漫画"><img src={compare?photo:imageUrl} alt={compare?'原照片':'本次真实生成的完整漫画'}/></button><aside className="result-tools"><div className="result-primary"><a className="primary-button" href={imageUrl} download="MangaMe-my-comic.png">保存漫画 ↓</a><button className="reader-action" onClick={share}>分享给朋友</button></div><button className="text-action" onClick={()=>setCompare(!compare)}>{compare?'返回漫画':'对照原照片'}</button><button className="text-action" onClick={()=>setZoom(true)}>放大阅读</button><button className="text-action" onClick={reset}>再画一篇</button><details><summary>查看完整 Prompt</summary><pre>{job?.prompt||prompt}</pre><p className="fine-print">{job?.model} · {job?.quality} · {job?.size} · 生图用时 {job?.seconds} 秒</p></details><p className="fine-print">这是本次真实生成结果。保存后再离开，图片尚未持久保存到服务器。</p>{notice&&<p role="status">{notice}</p>}</aside></div></section>}
    {error&&<p className="journey-error" role="alert">{error}</p>}
    <dialog ref={dialog} className="image-dialog" onCancel={()=>setZoom(false)} onClose={()=>setZoom(false)}><button className="dialog-close" onClick={()=>setZoom(false)}>关闭大图</button>{imageUrl&&<img src={compare?photo:imageUrl} alt="原尺寸图片"/>}</dialog>
  </main>;
}
window.LiveWorkflow=LiveWorkflow;
