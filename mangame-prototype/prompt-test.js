'use strict';
const $ = (id) => document.getElementById(id);
let csrf = '', session = null, image = null, previewUrl = null, busy = false, keyReady = false, calls = 0;
let hasUserReply = false, rounds = 0, outputDialogue = null;
function controls() {
  $('start').textContent = session && !hasUserReply && !$('chat').querySelector('.message') ? '手动重试开场（可能再次计费）' : '看图，开始聊天';
  $('start').disabled = busy || !keyReady || !image || !$('consent').checked || (!!session && !!$('chat').querySelector('.message')) || calls >= 12;
  $('reply').disabled = busy || !session || calls >= 12 || rounds >= 3;
  $('send').disabled = busy || !session || !$('reply').value.trim() || calls >= 12 || rounds >= 3;
  $('send').textContent = rounds === 2 ? '发送最后回答并整理 Prompt' : '发送回答';
  $('finish').disabled = busy || !session || !hasUserReply || calls >= 12;
  for (const id of ['photo', 'sample', 'clear', 'consent', 'allow-dialogue']) $(id).disabled = busy;
  $('working').hidden = !busy;
}
function failure(message) { $('error').textContent = message; $('error').hidden = false; }
async function request(path, data) {
  const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json','X-MangaMe-Token':csrf}, body:JSON.stringify(data)});
  const result = await response.json();
  if (result.session) session = result.session;
  if (result.calls !== undefined) calls = result.calls;
  if (result.answered_rounds !== undefined) rounds = result.answered_rounds;
  if (!response.ok || result.error) throw new Error(result.error || '本地请求失败。');
  return result;
}
function addMessage(role, text) {
  const empty = $('chat').querySelector('.empty'); if (empty) empty.remove();
  const item = document.createElement('div'); item.className = 'message ' + role;
  const label = document.createElement('strong'); label.textContent = role === 'user' ? '你' : 'MangaMe · GPT-5';
  item.append(label, document.createTextNode(text)); $('chat').append(item);
  $('chat').scrollTop = $('chat').scrollHeight;
}
async function run(path, body, userText) {
  busy = true; $('error').hidden = true; controls();
  try {
    const result = await request(path, {...body, allow_dialogue: $('allow-dialogue').checked});
    if (userText) { addMessage('user', userText); $('reply').value = ''; hasUserReply = true; }
    if (result.mode === 'prompt') { outputDialogue = result.allow_dialogue; updateOutputMode(); $('prompt').textContent = result.text; $('output').hidden = false; $('prompt').focus(); }
    else { addMessage('assistant', result.text); $('output').hidden = true; }
    const usage = result.usage || {};
    $('usage').textContent = `已回答 ${rounds}/3 轮 · 会话调用 ${result.calls}/12 · 本次启动 ${result.total_calls}/50 · ${result.seconds} 秒 · 输入 ${usage.input_tokens ?? '未知'} / 输出 ${usage.output_tokens ?? '未知'} token（输出可含推理 token）`;
    $('debug').textContent = `模型：${result.model}\n接口：OpenAI Responses\nstore: false\nreasoning.effort: low\nmax_output_tokens: ${result.mode === 'prompt' ? 6000 : 2000}\n\n系统指令：\n${result.instructions}`;
  } catch (error) {
    failure(error.message === 'Failed to fetch' ? '本地连接中断。上游可能仍在处理，不会自动重试。请检查后端终端。' : error.message);
    $('usage').textContent = `本会话已尝试 ${calls}/12 次调用。失败或超时也可能计费。`;
  } finally { busy = false; controls(); }
}
async function clearSession() {
  if (session) await request('/api/clear', {session});
  session = null; calls = 0; hasUserReply = false; rounds = 0; outputDialogue = null; $('output-mode').textContent = ''; $('chat').replaceChildren();
  $('reply').value = ''; $('output').hidden = true; $('prompt').textContent = ''; $('debug').textContent = '尚未调用。';
  $('error').hidden = true; $('usage').textContent = '会话已清空；尚未调用模型。'; controls();
}
async function selectFile(file) {
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    failure('请选择不超过 8 MB 的 JPEG、PNG 或 WebP 图片。'); return;
  }
  if (session && !confirm('更换照片会清空当前对话，继续吗？')) return;
  busy = true; controls();
  try {
    await clearSession();
    image = await new Promise((resolve,reject) => {const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file);});
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file); $('preview').src = previewUrl; $('preview').hidden=false; $('consent').checked=false;
  } catch (_) { failure('无法读取照片或清空会话，请检查本地服务。'); }
  finally { busy=false; controls(); }
}
$('photo').addEventListener('change', (event)=>selectFile(event.target.files[0]));
$('sample').addEventListener('click', async ()=>{
  try { const r=await fetch('/sample.png'); if(!r.ok) throw new Error(); await selectFile(new File([await r.blob()], 'sample.png', {type:'image/png'})); }
  catch(_){failure('示例照片加载失败。');}
});
function updateOutputMode() {
  if (outputDialogue === null) return;
  const mode = outputDialogue ? '允许自然对白改编' : '仅使用用户原话';
  $('output-mode').textContent = `当前结果采用：${mode}。` + (outputDialogue !== $('allow-dialogue').checked ? '选项已改变，旧结果未变；点击“整理漫画 Prompt”重新生成会产生一次 API 调用。' : '');
}
$('allow-dialogue').addEventListener('change', updateOutputMode);
$('consent').addEventListener('change', controls);
$('reply').addEventListener('input', controls);
$('start').addEventListener('click', ()=>run('/api/start',{image,session}));
$('reply-form').addEventListener('submit', (event)=>{event.preventDefault(); const text=$('reply').value.trim(); if(text && !busy && rounds < 3) run('/api/reply',{session,text},text);});
$('finish').addEventListener('click', ()=>{
  if ($('reply').value.trim()) { failure('输入框里还有未发送的回答，请先发送或清空后再整理 Prompt。'); return; }
  run('/api/prompt',{session});
});
$('clear').addEventListener('click', async ()=>{
  busy=true; controls();
  try {await clearSession(); image=null; $('photo').value=''; $('preview').hidden=true; $('preview').removeAttribute('src'); if(previewUrl) URL.revokeObjectURL(previewUrl); previewUrl=null; $('consent').checked=false;}
  catch(_){failure('清空失败，请重试或停止后端清空全部内存。');}
  finally {busy=false;controls();}
});
$('copy').addEventListener('click', async ()=>{try{await navigator.clipboard.writeText($('prompt').textContent); $('copy-status').textContent='已复制。';}catch(_){$('copy-status').textContent='复制失败，请手动选择文本复制。';}});
$('save').addEventListener('click', ()=>{const url=URL.createObjectURL(new Blob([$ ('prompt').textContent],{type:'text/plain;charset=utf-8'})); const a=document.createElement('a'); a.href=url;a.download='MangaMe-comic-prompt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
fetch('/api/config').then(r=>r.json()).then(config=>{csrf=config.csrf;keyReady=config.key_configured;$('connection').textContent=keyReady?'本地后端已就绪 · 密钥已配置，尚未验证有效性。':'后端未读取到密钥，请在原终端设置后重新启动。';controls();}).catch(()=>failure('无法连接本地后端。请启动 prompt_server.py，并访问 http://127.0.0.1:4180。'));
