/* Local microphone capture only. Audio is sent after an explicit finish action. */
function VoiceInput({session, csrf, disabled, available, onText, onBusy, resetKey, authorized=false}) {
  const [phase,setPhase]=React.useState('idle');
  const [seconds,setSeconds]=React.useState(0);
  const [error,setError]=React.useState('');
  const [recording,setRecording]=React.useState(null);
  const [preview,setPreview]=React.useState('');
  const [calls,setCalls]=React.useState(0);
  const [total,setTotal]=React.useState(0);
  const [transcript,setTranscript]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [agree,setAgree]=React.useState(false);
  const resources=React.useRef({});
  const alive=React.useRef(true);
  const epoch=React.useRef(0);
  const locked=React.useRef(false);
  const callbacks=React.useRef({onText,onBusy});
  callbacks.current={onText,onBusy};
  function release(){
    const r=resources.current;
    clearInterval(r.timer);
    if(r.processor){r.processor.onaudioprocess=null;r.processor.disconnect();}
    if(r.source)r.source.disconnect();
    if(r.gain)r.gain.disconnect();
    if(r.stream)r.stream.getTracks().forEach(t=>t.stop());
    if(r.context&&r.context.state!=='closed')r.context.close().catch(()=>{});
    resources.current={};
  }
  React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;release();};},[]);
  React.useEffect(()=>{
    if(!recording){setPreview('');return;}
    const url=URL.createObjectURL(recording);setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[recording]);
  React.useEffect(()=>{setRecording(null);setTranscript('');setCalls(0);setTotal(0);setError('');setNotice('');setAgree(false);},[resetKey]);
  function wav(chunks,inputRate){
    const count=chunks.reduce((n,c)=>n+c.length,0), all=new Float32Array(count);
    let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
    const n=Math.min(60*16000,Math.floor(count*16000/inputRate));
    if(n<1600)throw Error('录音太短，请至少说一句话。');
    const buffer=new ArrayBuffer(44+n*2),view=new DataView(buffer);
    function str(at,s){for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));}
    str(0,'RIFF');view.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,n*2,true);
    for(let i=0;i<n;i++){
      const start=Math.floor(i*inputRate/16000),end=Math.max(start+1,Math.floor((i+1)*inputRate/16000));
      let sample=0;for(let j=start;j<Math.min(end,count);j++)sample+=all[j];
      sample=Math.max(-1,Math.min(1,sample/(Math.min(end,count)-start)));
      view.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true);
    }
    return new Blob([buffer],{type:'audio/wav'});
  }
  async function transcribe(blob){
    locked.current=true;callbacks.current.onBusy(true);setPhase('transcribing');setError('');
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
      const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'application/json','X-MangaMe-Token':csrf},body:JSON.stringify({session,audio:data})});
      const result=await response.json();if(!alive.current)return;
      if(result.voice_calls!==undefined)setCalls(result.voice_calls);
      if(result.voice_total!==undefined)setTotal(result.voice_total);
      if(!response.ok||result.error)throw Error(result.error||'转写失败。');
      if(!result.text?.trim())throw Error('没有识别出文字，请检查录音后重试。');
      setTranscript(result.text);
      if(callbacks.current.onText(result.text)){
        setTranscript('');setRecording(null);setPhase('idle');setNotice('已追加到输入框，请核对人名和金额后手动发送。');
      }else{setPhase('review');setNotice('追加后超过2000字，完整转写保留在下方。请精简后手动加入，未截断文字。');}
    }catch(e){if(alive.current){setError(e.message==='Failed to fetch'?'连接失败，可能已计费。录音仍保留，可手动重试。':e.message);setPhase('recorded');}}
    finally{locked.current=false;if(alive.current)callbacks.current.onBusy(false);}
  }
  async function stop(send){
    if(!locked.current)return;
    epoch.current++;
    const r=resources.current;
    release();
    if(!send||!r.chunks){locked.current=false;setPhase('idle');callbacks.current.onBusy(false);setNotice('录音已取消，未上传。');return;}
    try{const blob=wav(r.chunks,r.rate);setRecording(blob);await transcribe(blob);}
    catch(e){locked.current=false;setError(e.message);setPhase('idle');callbacks.current.onBusy(false);}
  }
  async function start(){
    if(disabled||locked.current||!(agree||authorized)||!available||calls>=6)return;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setError('当前浏览器无法录音，请在本机 Chrome 打开 http://127.0.0.1:4180，或继续打字。');return;}
    locked.current=true;callbacks.current.onBusy(true);setPhase('requesting');setError('');setNotice('');setSeconds(0);const ticket=++epoch.current;
    try{
      const context=new (window.AudioContext||window.webkitAudioContext)();resources.current={context};await context.resume();
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(ticket!==epoch.current||!alive.current){stream.getTracks().forEach(t=>t.stop());return;}
      const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1),gain=context.createGain();gain.gain.value=0;
      const r={context,stream,source,processor,gain,chunks:[],rate:context.sampleRate,frames:0,started:performance.now()};resources.current=r;
      processor.onaudioprocess=(e)=>{
        const remaining=Math.max(0,Math.floor(60*r.rate)-r.frames);
        if(remaining){const samples=e.inputBuffer.getChannelData(0).slice(0,remaining);r.chunks.push(samples);r.frames+=samples.length;}
        if(r.frames>=60*r.rate)stop(true);
      };
      source.connect(processor);processor.connect(gain);gain.connect(context.destination);
      r.timer=setInterval(()=>{setSeconds(Math.min(60,Math.floor((performance.now()-r.started)/1000)));if(performance.now()-r.started>=60000)stop(true);},200);
      setPhase('recording');
    }catch(e){
      if(ticket!==epoch.current||!alive.current)return;
      release();locked.current=false;callbacks.current.onBusy(false);setPhase('idle');setError(e.name==='NotAllowedError'?'麦克风权限未允许。请在地址栏开启权限，或继续打字。':'无法启动麦克风，请检查设备是否可用。');
    }
  }
  function discard(){setRecording(null);setTranscript('');setNotice('录音和转写已丢弃。');setError('');setPhase('idle');}
  const mic=<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>;
  const recordingNow=phase==='recording';
  return <section className="voice-input compact-voice" aria-label="语音输入">
    {phase==='idle'&&<button type="button" className="mic-icon" disabled={disabled||!available||calls>=6} title={calls>=6?'本次语音次数已用完':!available?'语音暂不可用':'语音输入（最长60秒）'} aria-label="语音输入" onClick={()=>{if(authorized||agree)start();else setPhase('consent');}}>{mic}</button>}
    {phase==='consent'&&<div className="voice-popover"><p>录音将发送至 OpenAI 转文字，可能计费。</p><label><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>同意语音转写</label><button type="button" disabled={!agree||disabled} onClick={start}>开始录音</button><button type="button" onClick={()=>setPhase('idle')}>取消</button></div>}
    {phase==='requesting'&&<div className="voice-strip"><span role="status">等待麦克风权限</span><button type="button" onClick={()=>stop(false)} aria-label="取消录音">取消</button></div>}
    {recordingNow&&<div className="voice-strip"><span className="record-dot"/><span role="status">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span><button type="button" onClick={()=>stop(true)} className="finish-record" aria-label="结束并转文字" title="结束并转文字"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg></button><button type="button" onClick={()=>stop(false)} aria-label="取消录音">取消</button></div>}
    {phase==='transcribing'&&<span className="voice-transcribing" role="status">转文字中…</span>}
    {(phase==='recorded'||phase==='review')&&<div className="voice-popover">
      {recording&&<audio controls src={preview} aria-label="本次录音回放"/>}
      {phase==='recorded'&&<button type="button" disabled={disabled||calls>=6||!(agree||authorized)} onClick={()=>transcribe(recording)}>重试转写（可能再次计费）</button>}
      {transcript&&<><label>转写过长，请精简后加入<textarea value={transcript} onChange={e=>setTranscript(e.target.value)} disabled={disabled}/></label><button type="button" disabled={disabled||!transcript.trim()} onClick={()=>{if(callbacks.current.onText(transcript)){setTranscript('');setRecording(null);setPhase('idle');setNotice('已转为文字');}else setNotice('超过2000字，请继续精简。');}}>加入回答</button></>}
      <button type="button" disabled={disabled} onClick={discard}>丢弃录音</button>
    </div>}
    {error&&<p className="voice-inline-error" role="alert">{error}<button type="button" aria-label="关闭语音错误提示" onClick={()=>setError('')}>×</button></p>}
    <span className="sr-only" role="status">{notice}</span>
  </section>;
}
window.VoiceInput=VoiceInput;
