/* Орбита — интерфейс. Работает с API сервера. */
(function () {
'use strict';
const ICON = {
  admin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2"/><path d="M21 9h-6a3 3 0 000 6h6z"/><circle cx="16" cy="12" r=".8" fill="currentColor"/></svg>',
  overview:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
  tasks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
  plans:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 15l2 2 4-4" stroke-linejoin="round"/></svg>',
  team:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.4.2 4 1.8 4.5 4.5"/></svg>',
  alerts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4L3 11l6 2.5L11.5 20 14 15l5 4z"/><path d="M9 13.5L21 4"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  tick:'<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0112 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 004 0"/></svg>',
  flame:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5 4.5 5 9.5a5 5 0 01-10 0C7 9 9.5 7 9.5 7S10 10 12 10.5C12 7 12 3 12 3z"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  done:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
  orbit:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/></svg>',
  org:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="5" rx="1.5"/><rect x="3" y="16" width="6" height="5" rx="1.5"/><rect x="15" y="16" width="6" height="5" rx="1.5"/><path d="M12 8v4M6 16v-4h12v4"/></svg>',
  tg:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3l-3.2 15.1c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9-8.2c.4-.4-.1-.6-.6-.2L6.3 13 1.5 11.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.4 1.5z"/></svg>'
};
const STATUS = {new:'Новая', progress:'В работе', review:'На проверке', done:'Выполнено'};
const PRIO = {high:'Высокий', medium:'Средний', low:'Низкий'};
const MON = ['янв.','февр.','марта','апр.','мая','июня','июля','авг.','сент.','окт.','нояб.','дек.'];
const MONN = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WD = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

const pad = n => String(n).padStart(2,'0');
const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addDays = (s,n) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return iso(d); };
const diff = (a,b) => Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00'))/864e5);
let TODAY = iso(new Date());
const fmt = s => { if(!s) return '—'; const d = new Date(String(s).slice(0,10)+'T12:00:00'); return d.getDate()+' '+MON[d.getMonth()]; };
const fmtDT = s => { if(!s) return '—'; const [d,t] = String(s).split('T'); return fmt(d)+(t?', '+t.slice(0,5):''); };
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const week = s => { const d = new Date(s+'T12:00:00'); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const y = new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y)/864e5+1)/7); };
function rnd(seed){ let x = seed; return () => { x = (x*1664525 + 1013904223) % 4294967296; return x/4294967296; }; }
const $ = id => document.getElementById(id);

/* ---------- API ---------- */
async function api(method, url, body){
  const r = await fetch(url, {method, headers: body?{'content-type':'application/json'}:{}, body: body?JSON.stringify(body):undefined, credentials:'same-origin'});
  let j = {}; try { j = await r.json(); } catch(e){}
  if(!r.ok){ const err = new Error(j.error || 'Не получилось. Проверьте интернет и попробуйте ещё раз.'); err.status = r.status; throw err; }
  if(method !== 'GET') LAST_MUT = Date.now();
  return j;
}
/* ---------- синхронизация в реальном времени (SSE) ---------- */
let LAST_MUT = 0, ES = null, SYNC_T = null, SYNC_PENDING = false;
const busy = () => !!document.querySelector('#modal .modal') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.value);
async function liveRefresh(){
  if(busy()){ SYNC_PENDING = true; return; }
  SYNC_PENDING = false;
  try { await reload(); if(current()==='wallet' && WM) { WAL = null; await loadWallet(); return; } render(); } catch(e){}
}
function startLive(){
  if(ES || !window.EventSource) return;
  ES = new EventSource('/api/events');
  ES.onmessage = () => {
    if(Date.now() - LAST_MUT < 1500) return;          // своё же изменение — интерфейс уже обновлён
    clearTimeout(SYNC_T); SYNC_T = setTimeout(liveRefresh, 400);
  };
  ES.onerror = () => {};                                // браузер переподключится сам
  setInterval(()=>{ if(SYNC_PENDING && !busy()) liveRefresh(); }, 2000);
}
function toast(msg){ const el = document.createElement('div'); el.className='toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(()=>el.remove(), 2600); }
async function act(fn, okMsg){ try { await fn(); await reload(); render(); if(okMsg) toast(okMsg); } catch(e){ toast(e.message); } }

/* ---------- состояние ---------- */
let ME = null, S = null;
async function reload(){ S = await api('GET','/api/state'); TODAY = S.today || TODAY; }

const U = id => (S.users.find(u=>u.id===id) || {name:'Бывший сотрудник',dept:'',title:'',deptColor:'#9AA3C7'});
const me = () => U(S.me);
const isMgr = () => S.myRole !== 'worker';
const isOwner = () => Boolean(S.isAdmin);   // учредитель, владелец или директор
const ROLES = [['worker','Работник'],['manager','Руководитель отдела'],['director','Директор'],['founder','Учредитель']];
const roleName = u => u.level==='owner' ? (u.pos==='director'?'Директор · владелец':'Учредитель · владелец') : (ROLES.find(r=>r[0]===u.level)||['',''])[1];
const roleSelect = (id, sel) => `<select id="${id}">${ROLES.map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('')}</select>`;
const bossOptions = (except, sel) => S.users.filter(x=>x.role==='manager' && x.id!==except).map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)}${x.title?' — '+esc(x.title):''}</option>`).join('');
const fileSize = n => n>=1048576 ? (n/1048576).toFixed(1).replace('.',',')+' МБ' : Math.max(1,Math.round(n/1024))+' КБ';
const fileIcon = m => /pdf/.test(m)?'📕':/sheet|excel|csv/.test(m)?'📊':/word|document/.test(m)?'📄':/image/.test(m)?'🖼':/video/.test(m)?'🎬':/zip|rar|7z/.test(m)?'🗜':'📎';
const attachView = a => `<a class="attfile" href="/api/files/${a.id}" target="_blank" rel="noopener">${/^image\//.test(a.mime)?`<img src="/api/files/${a.id}?inline=1" alt="" loading="lazy">`:`<span class="ai">${fileIcon(a.mime)}</span>`}<span class="an"><b>${esc(a.name)}</b><small>${fileSize(a.size)} · скачать</small></span></a>`;
const REPEAT_RU = {daily:'каждый день', weekdays:'по будням', days:'по дням недели', monthly:'каждый месяц'};
const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
const late = t => t.status!=='done' && t.due && (t.due < TODAY || (t.due===TODAY && t.dueTime && nowHM() >= t.dueTime));
const dueText = t => (t.due===TODAY?'сегодня':fmt(t.due)) + (t.dueTime?' до '+t.dueTime:'');
const canExtend = t => t.status!=='done' && (t.author===S.me || isOwner() || (isMgr() && t.assignee!==S.me));
const deptColor = name => { const d = S.depts.find(x=>x.name===name); return d ? d.color : '#9AA3C7'; };
const CV = n => (getComputedStyle(document.documentElement).getPropertyValue('--'+n)||'').trim() || '#888';
const ARGB = a => `rgba(${CV('accent-rgb')},${a})`;
const AVC = c => c==='#FFD23F' ? '#141729' : c;
const av = (u,size) => `<span class="av" style="background:${AVC(u.deptColor||deptColor(u.dept))};${size?`width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px`:''}" aria-hidden="true">${esc((u.name||'?').replace(/^Демо:\s*/,'').slice(0,1))}</span>`;
const myUnread = () => S.notifs.filter(n=>!n.read).length;
const statusChip = t => late(t) ? `<span class="chip overdue">Просрочено</span>` : `<span class="chip s-${t.status}">${STATUS[t.status]}</span>`;
const plansFor = (u,day) => ((S.plans[u]||{})[day]||[]);
const planPct = (u,day) => { const p = plansFor(u,day); return p.length ? Math.round(p.filter(x=>x.done).length/p.length*100) : null; };
const scope = () => S.users.filter(u=>S.scope.includes(u.id));
const scopeIds = () => S.scope;
const scopeTasks = () => S.tasks.filter(t=>S.scope.includes(t.assignee));
const mySettings = () => S.settings[S.me] || {};

/* ---------- графики ---------- */
function spark(vals, color, dot){
  const w=96,h=38,mx=Math.max(...vals,1),mn=Math.min(...vals,0), rg=(mx-mn)||1;
  const pts = vals.map((v,i)=>[i*(w/(vals.length-1)), h-4-((v-mn)/rg)*(h-10)]);
  const dpath = pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const last = pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${dpath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${dot||CV('surface')}" stroke="${color}" stroke-width="2.2"/></svg>`;
}
const series = fn => Array.from({length:8},(_,i)=>fn(addDays(TODAY,i-7)));
const activeOn = (ts,day) => ts.filter(t=>t.created<=day && (!t.doneAt || t.doneAt>day)).length;
const lateOn = (ts,day) => ts.filter(t=>t.due<day && t.created<=day && (!t.doneAt || t.doneAt>day)).length;
const doneWeek = (ts,day) => ts.filter(t=>t.doneAt && t.doneAt<=day && t.doneAt>addDays(day,-7)).length;
function avgPlan(ids,day){ const v = ids.map(id=>planPct(id,day)).filter(x=>x!=null); return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : null; }
function ring(p, size){
  const r=size/2-8, c=2*Math.PI*r, off=c*(1-(p||0)/100);
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${CV('line')}" stroke-width="10"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--blue)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
}

/* ---------- экраны входа ---------- */
const brand = (sub) => `<div class="ws"><div class="logo" style="background:var(--navy)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none"><circle cx="12" cy="12" r="4" fill="#FFD23F"/><ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="#fff" stroke-width="1.8"/></svg></div><div><b>Орбита</b><small>${sub||'задачи и планы команды'}</small></div></div>`;
function authShell(left){
  return `<div class="auth"><div class="auth-card"><div class="auth-l">${left}</div>
    <section class="live auth-r"><canvas id="cv" aria-hidden="true"></canvas><div class="live-top"><div><span class="tag"><i></i>Живая карта команды</span><h3>Вся команда на одной орбите</h3><p>Задачи, сроки и личные планы — и напоминания в Telegram</p></div></div>
      <div class="feat"><div>📌 Руководитель ставит задачу — сотрудник сразу получает её в Telegram</div><div>✅ Отметить «выполнено» можно прямо в боте</div><div>☀️ Утренняя сводка и 🌙 вечерние итоги личного плана</div></div></section></div></div>`;
}
let LOGIN = null, pollTimer = null;
async function screenLogin(){
  const join = location.pathname.startsWith('/join/') ? location.pathname.split('/')[2] : null;
  let inv = null;
  if(join){ try { inv = await api('GET','/api/invite/'+join); } catch(e){ inv = {error:e.message}; } }
  const invText = inv && !inv.error ? `<div class="pill blue" style="align-self:flex-start;padding:6px 12px;font-size:12.5px">${esc(inv.inviter||'Руководитель')} приглашает вас в «${esc(inv.company)}»</div>` : (inv && inv.error ? `<div class="err">${esc(inv.error)}</div>` : '');
  let btn = '';
  if(!ME.botReady){ btn = `<div class="err">Telegram-бот ещё не подключён на сервере. Администратору нужно добавить BOT_TOKEN в настройки.</div>`; }
  else {
    try { LOGIN = await api('POST','/api/auth/start', join ? {join} : {}); btn = `<a class="tgbtn" href="${esc(LOGIN.link)}" target="_blank" rel="noopener" id="tglogin">${ICON.tg}Войти через Telegram</a><div class="wait" id="wait" hidden><span class="spin"></span>Ждём подтверждения в Telegram… Нажмите «Start» в боте. Если страница не откроется сама — нажмите в боте кнопку «🔐 Войти в Орбиту».</div>`; }
    catch(e){ btn = `<div class="err">${esc(e.message)}</div>`; }
  }
  const dev = ME.devLogin ? `<form id="devlogin" class="add" style="margin-top:4px"><input id="devname" placeholder="Тестовый вход: имя" aria-label="Имя для тестового входа"><button class="btn" type="submit">Войти</button></form>` : '';
  $('root').innerHTML = authShell(`${brand()}${invText}<h1>Задачи, планы и дисциплина команды — в одном месте</h1><p>Войдите через Telegram: без паролей и SMS. В этот же Telegram будут приходить задачи и напоминания.</p>${btn}${dev}${new URLSearchParams(location.search).get('login')==='expired'?'<div class="err">Кнопка входа устарела. Отправьте боту /login и нажмите новую кнопку.</div>':''}<p class="note">Нажимая «Войти», вы соглашаетесь получать сообщения от бота «Орбиты». Отключить их можно в настройках.</p>`);
  startConstellation(true);
  const a = $('tglogin');
  clearInterval(pollTimer);
  if(a){ pollTimer = setInterval(checkLogin, 2500); a.addEventListener('click', () => { $('wait').hidden = false; }); }
}
async function checkLogin(){
  if(!LOGIN) return;
  try { const r = await api('GET','/api/auth/poll?nonce='+encodeURIComponent(LOGIN.nonce)); if(r.ok){ clearInterval(pollTimer); boot(); } }
  catch(e){ clearInterval(pollTimer); toast(e.message); screenLogin(); }
}
// поля «Фамилия» и «Имя»: если имени нет — подставляем то, что есть (ник из Telegram — как имя)
const nameFields = (pref, first, last) => `<div class="frow"><div class="field"><label for="${pref}-last">Фамилия</label><input id="${pref}-last" value="${esc(last||'')}" placeholder="Например: Каримов" autocomplete="family-name" maxlength="30" required></div>
  <div class="field"><label for="${pref}-first">Имя</label><input id="${pref}-first" value="${esc(first||'')}" placeholder="Например: Азиз" autocomplete="given-name" maxlength="30" required></div></div>`;
const realPart = v => /^[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ'’-]{2,30}( [A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ'’-]{2,30})?$/.test(String(v||'').trim()) ? v : '';
const splitName = u => u && (u.first || u.first_name) ? [u.first || u.first_name, u.last || u.last_name] : [String((u&&u.name)||'').split(' ')[0] || '', String((u&&u.name)||'').split(' ').slice(1).join(' ')];
function nameGate(){
  if(!ME || !ME.user || ME.user.name_ok || ME.viewingAs || $('namegate')) return;
  const [f,l] = splitName(ME.user).map(realPart);
  const g = document.createElement('div'); g.id = 'namegate'; g.className = 'ov';
  g.innerHTML = `<form class="modal" id="namegate-form" role="dialog" aria-modal="true" aria-label="Фамилия и имя"><h2>Как вас зовут?</h2>
    <p class="note" style="margin:-4px 0 14px">Сейчас вы в «Орбите» как <b>${esc(ME.user.name)}</b> — это ник из Telegram. Укажите настоящие фамилию и имя: так вас увидят руководитель и коллеги в задачах и структуре компании.</p>
    ${nameFields('ng', f, l)}<div class="mact"><button class="btn primary" type="submit">Сохранить</button></div></form>`;
  document.body.appendChild(g); setTimeout(()=>$('ng-last')&&$('ng-last').focus(), 50);
}
async function screenJoin(code){
  let inv; try { inv = await api('GET','/api/invite/'+code); } catch(e){ inv = {error:e.message}; }
  $('root').innerHTML = authShell(`${brand()}${inv.error?`<div class="err">${esc(inv.error)}</div><a class="btn" href="/">Открыть Орбиту</a>`:
    `<h1>Приглашение в «${esc(inv.company)}»</h1><p>${esc(inv.inviter||'Руководитель')} приглашает вас в команду${inv.dept?` · отдел «${esc(inv.dept)}»`:''}${inv.title?` · ${esc(inv.title)}`:''}.</p>
     <form id="join-form" data-code="${esc(code)}" style="display:flex;flex-direction:column;gap:4px;margin-top:4px"><p style="margin:0 0 8px">Укажите фамилию и имя — так вас увидят в команде.</p>
     ${(([f,l])=>nameFields('j', ME.user.name_ok?f:(ME.user.first_name||realPart(splitName(ME.user)[0])), ME.user.name_ok?l:(ME.user.last_name||'')))(splitName(ME.user))}
     <button class="btn primary" type="submit" style="align-self:flex-start;padding:12px 18px">Присоединиться к команде</button></form>`}`);
  startConstellation(true);
}
function screenOnboard(another){
  if(!ME.canCreateCompany){
    $('root').innerHTML = authShell(`${brand()}<h1>Вас ещё не добавили в команду</h1><p>Вы вошли как <b>${esc(ME.user.name)}</b>. Чтобы начать работу, попросите руководителя прислать ссылку-приглашение и откройте её — компания появится сама.</p><p class="note">Подключить новую компанию к «Орбите» можно через администратора.</p>${another?'<button class="linkbtn" data-act="back">← Вернуться в мою компанию</button>':'<button class="linkbtn" data-act="logout">Выйти</button>'}`);
    return startConstellation(true);
  }
  $('root').innerHTML = authShell(`${brand()}<h1>${another?'Новая компания':'Создайте свою компанию'}</h1><p>Вы станете владельцем: сможете приглашать руководителей и сотрудников и ставить задачи.</p>
    <form id="newco" style="display:flex;flex-direction:column;gap:2px">
      <div class="field"><label for="co-me">Как вас подписать</label><input id="co-me" value="${esc(ME.user.name)}" required></div>
      <div class="field"><label for="co-name">Название компании</label><input id="co-name" placeholder="Название вашей компании" required></div>
      <div class="field"><label for="co-title">Ваша должность</label><input id="co-title" value="Директор"></div>
      <button class="btn primary" type="submit" style="align-self:flex-start;padding:12px 18px">Создать компанию</button>
    </form><p class="note">Если вас пригласили в компанию — откройте ссылку-приглашение от руководителя.</p>${another?'<button class="linkbtn" data-act="back">← Вернуться в мою компанию</button>':'<button class="linkbtn" data-act="logout">Выйти</button>'}`);
  startConstellation(true);
}

/* ---------- навигация ---------- */
function routes(){
  const adm = S && S.billing && S.billing.platformAdmin ? [['admin','Админка']] : [];
  return [...baseRoutes(), ...adm];
}
function baseRoutes(){
  return isMgr()
    ? [['overview','Обзор'],['tasks','Задачи'],['plans','Мои планы'],['wallet','Кошелёк'],['team','Команда'],['alerts','Уведомления']]
    : [['tasks','Мои задачи'],['plans','Мои планы'],['wallet','Кошелёк'],['team','Команда'],['alerts','Уведомления']];
}
function current(){ const h = location.hash.replace('#',''); const r = routes().map(x=>x[0]); return r.includes(h) ? h : r[0]; }
const AREA = {
  overview:()=>['Команда', `${scope().length} чел. · ${new Set(scope().map(u=>u.dept)).size} отд.`],
  tasks:()=>isMgr()?['Задачи', `${scopeTasks().filter(t=>t.status!=='done').length} в работе · ${scopeTasks().filter(late).length} просрочено`]:['Задачи', `${S.tasks.filter(t=>t.assignee===S.me&&t.status!=='done').length} в работе`],
  plans:()=>['Планы', 'личный план и привычки'],
  wallet:()=>['Кошелёк', 'личные расходы — видите только вы'],
  admin:()=>['Админка', 'оплаты и тарифы клиентов'],
  team:()=>['Люди', `${S.users.length} в компании`],
  alerts:()=>['Бот', myUnread()?`${myUnread()} новых сообщений`:'все сообщения прочитаны']
};
function shell(){
  $('root').innerHTML = `<div class="app"><aside class="side">
      <div class="ws">${coLogo()}<div><b>${esc(S.company.name)}</b><small>Орбита · Бизнес</small></div></div>
      <div class="area" id="area"></div><nav class="nav" id="nav"></nav>
      <div class="me-box" id="mebox"></div>
    </aside><main class="main"><div id="viewbar"></div><div id="main"></div></main></div><nav class="tabbar" id="tabbar"></nav>`;
}
const coSwitch = id => `<select id="${id}" class="coswitch" aria-label="Компания">${ME.companies.map(c=>`<option value="${c.member_id}" ${c.member_id===S.me?'selected':''}>${esc(c.name)}${c.role==='owner'?' · владелец':''}</option>`).join('')}${ME.canCreateCompany?'<option value="new">+ Создать новую компанию…</option>':''}</select>`;
const coLogo = () => {
  const inner = S.company.logo!=null ? `<img src="/api/company/${S.company.id}/logo?v=${S.company.logo}" alt="Логотип ${esc(S.company.name)}">` : esc(initials(S.company.name));
  return isOwner()
    ? `<label class="logo ${S.company.logo!=null?'img':''}" for="logo-input" title="${S.company.logo!=null?'Сменить логотип':'Загрузить логотип компании'}" style="cursor:pointer">${inner}<input type="file" id="logo-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>`
    : `<div class="logo ${S.company.logo!=null?'img':''}">${inner}</div>`;
};
const initials = s => (s||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
function renderViewbar(){ const v=$('viewbar'); if(!v) return; v.innerHTML = ME && ME.viewingAs ? `<div class="viewbar">👁 Вы смотрите «Орбиту» как <b>${esc(me().name)}</b> (${esc(me().title||'')}). Действия выполняются от его имени.<button class="btn sm y" data-act="viewback">Вернуться к себе</button></div>` : ''; }
function renderNav(){
  renderViewbar();
  const cur = current(), unread = myUnread();
  const mineT = isMgr()?scopeTasks():S.tasks.filter(t=>t.assignee===S.me);
  const lateN = mineT.filter(late).length;
  const [an, as] = AREA[cur]();
  $('area').innerHTML = `<div class="eyebrow">Раздел</div><h2>${an}</h2><p>${as}</p>`;
  $('nav').innerHTML = routes().map(([k,l]) => {
    let c = '';
    if(k==='alerts' && unread) c = `<span class="cnt y">${unread}</span>`;
    if(k==='tasks') c = lateN ? `<span class="cnt r">${lateN}</span>` : `<span class="cnt">${mineT.filter(t=>t.status!=='done').length}</span>`;
    if(k==='team') c = `<span class="cnt">${S.users.length}</span>`;
    return `<a href="#${k}" ${k===cur?'aria-current="page"':''}>${ICON[k]}<span>${l}</span>${c}</a>`;
  }).join('');
  $('tabbar').innerHTML = routes().map(([k,l]) => `<a href="#${k}" ${k===cur?'aria-current="page"':''}>${ICON[k]}<span>${l.replace('Мои ','')}</span>${k==='alerts'&&unread?'<i class="dot"></i>':''}</a>`).join('');
  const u = me();
  $('mebox').innerHTML = `<div class="person">${av(u,32)}<div><b>${esc(u.name)}</b><small>${esc(u.title|| roleName(u))}</small></div></div>
    ${coSwitch('switchco')}
    <div style="display:flex;justify-content:space-between;gap:8px"><button class="linkbtn" data-act="profile">Изменить имя</button><button class="linkbtn" data-act="logout">Выйти</button></div>`;
}
let F = {who:'all', q:'', mode:'timeline', off:0};
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z"/></svg>';
function themeToggle(){
  const dark = document.documentElement.dataset.theme !== 'light';
  return `<div class="daynight" role="group" aria-label="Оформление"><button type="button" class="${dark?'':'on'}" data-theme-set="light" aria-pressed="${!dark}" title="Дневной режим">${SUN}<span>День</span></button><button type="button" class="${dark?'on':''}" data-theme-set="dark" aria-pressed="${dark}" title="Ночной режим">${MOON}<span>Ночь</span></button></div>`;
}
function header(crumb, title, action){
  const d = new Date(TODAY+'T12:00:00');
  return `<div class="head"><div><div class="crumbs">${esc(S.company.name)}<span>›</span>${crumb}</div><h1>${title}</h1></div>
    <div class="tools">
      <label class="search">${ICON.search}<input id="gsearch" placeholder="Поиск задач, людей…" aria-label="Поиск" value="${esc(F.q)}"><kbd>⌘K</kbd></label>
      <span class="datechip"><i></i>${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}<span>· Неделя ${week(TODAY)}</span></span>
      ${themeToggle()}
      <a class="iconbtn" href="#alerts" aria-label="Уведомления">${ICON.bell}${myUnread()?'<i class="dot"></i>':''}</a>
      ${action||''}
    </div></div>`;
}

/* ---------- Обзор ---------- */
let CF = 'all', VIEW = 'org';   // на обзоре — только структура компании
function vOverview(){
  const ts = scopeTasks(), ids = scopeIds();
  const act = ts.filter(t=>t.status!=='done'), over = ts.filter(late);
  const sAct = series(d=>activeOn(ts,d)), sLate = series(d=>lateOn(ts,d)), sDone = series(d=>doneWeek(ts,d)), sPlan = series(d=>avgPlan(ids,d)||0);
  const dAct = sAct[7]-sAct[0], dDone = sDone[7]-sDone[0];
  const depts = [...new Set(scope().map(u=>u.dept))];
  const days10 = Array.from({length:10},(_,i)=>addDays(TODAY,i-9));
  const heat = depts.map(dp => { const us = scope().filter(u=>u.dept===dp).map(u=>u.id);
      return `<span class="rl">${esc(dp)}</span>` + days10.map(d=>{ const p = avgPlan(us,d); const a = p==null ? .06 : .14 + (p/100)*.86; return `<span class="c" title="${esc(dp)}, ${fmt(d)}: ${p==null?'нет планов':p+'%'}" style="background:${ARGB(a.toFixed(2))}"></span>`; }).join(''); }).join('')
    + '<span></span>' + days10.map(d=>`<span class="dl">${new Date(d+'T12:00:00').getDate()}</span>`).join('');
  const teamPlan = avgPlan(ids, TODAY), prevPlan = avgPlan(ids, addDays(TODAY,-1));
  const rows = scope().filter(u=>u.id!==S.me).map(u => {
    const mine = S.tasks.filter(t=>t.assignee===u.id), a = mine.filter(t=>t.status!=='done').length, od = mine.filter(late).length;
    const p = planPct(u.id,TODAY);
    return `<tr><td><div class="person">${av(u)}<div>${esc(u.name)}<small>${esc(u.title)}</small></div></div></td><td class="hide-s">${esc(u.dept)}</td>
      <td class="n num">${a}</td><td class="n num" style="color:${od?'var(--bad)':'inherit'};font-weight:${od?700:500}">${od}</td>
      <td>${p==null?'<span class="note">нет плана</span>':`<div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:${p}%"></i></div><span class="num" style="font-size:12px;font-weight:600">${p}%</span></div>`}</td></tr>`; }).join('');
  const attention = [...over, ...act.filter(t=>t.due===TODAY && !late(t))];
  const counts = groups(scope()).map(g=>[g, scope().filter(u=>grp(u)===g).length]);
  const alone = scope().length <= 1;
  const teamDisc = scope().filter(u=>u.id!==S.me).map(u=>discipline(u.id)).reduce((a,d)=>({onTime:a.onTime+d.onTime,lateDone:a.lateDone+d.lateDone,over:a.over+d.over,total:a.total+d.total}),{onTime:0,lateDone:0,over:0,total:0});
  teamDisc.pct = teamDisc.total ? Math.round(teamDisc.onTime/teamDisc.total*100) : null;
  return header('Команда<span>›</span>Командный центр', 'Командный центр', `<button class="btn primary" data-act="new">${ICON.plus}Поставить задачу</button>`) + `
  ${alone?`<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>В команде пока только вы.</b><div class="note">Пригласите сотрудников — они войдут через Telegram по ссылке.</div></div><span style="display:flex;gap:8px;flex-wrap:wrap">${isOwner()?'<button class="btn" data-act="demo-add">Показать на демо-сотрудниках</button>':''}<button class="btn y" data-act="invite">${ICON.plus}Пригласить сотрудника</button></span></div>`:''}
  <div class="grid kpis">
    <div class="card kpi hero"><div class="lab"><span class="ic">${ICON.flame}</span>Задач в работе<span class="delta">${dAct>=0?'↗':'↘'} ${Math.abs(dAct)} за неделю</span></div>
      <div class="row"><div><div class="v num">${act.length}</div><div class="sub">${ts.filter(t=>t.created>=addDays(TODAY,-7)).length} новых за 7 дней</div></div>${spark(sAct,CV('ink'),CV('yellow'))}</div></div>
    <div class="card kpi ${over.length?'alarm':''}"><div class="lab"><span class="ic">${ICON.alert}</span>Горит<span class="delta" style="${over.length?'background:var(--bad-soft);color:var(--bad)':''}">${over.length?'нужно внимание':'всё в срок'}</span></div>
      <div class="row"><div><div class="v num ${over.length?'bad':''}">${over.length}</div><div class="sub">${act.filter(t=>t.due===TODAY).length} со сроком сегодня</div></div>${spark(sLate,CV('bad'))}</div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.done}</span>Вовремя · 30 дней<span class="delta">${sDone[7]} за 7 дн.</span></div>
      <div class="row"><div><div class="v num" style="color:${teamDisc.pct==null?'inherit':teamDisc.pct>=80?'var(--ok)':teamDisc.pct>=50?'var(--warn)':'var(--bad)'}">${teamDisc.pct==null?'—':teamDisc.pct}<small>${teamDisc.pct==null?'':'%'}</small></div><div class="sub">${teamDisc.total?`${teamDisc.onTime} вовремя · ${teamDisc.lateDone} с опозданием · ${teamDisc.over} горит`:'появится, когда будут задачи со сроком'}</div></div>${spark(sDone,CV('blue'))}</div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.target}</span>Личные планы<span class="delta">${teamPlan==null||prevPlan==null?'сегодня':(teamPlan>=prevPlan?'↗ ':'↘ ')+(teamPlan==null||prevPlan==null?'':Math.abs(teamPlan-prevPlan)+' п.')}</span></div>
      <div class="row"><div><div class="v num">${teamPlan==null?'—':teamPlan}<small>${teamPlan==null?'':'%'}</small></div><div class="sub">${teamPlan==null?'планы на сегодня ещё не записаны':'средний план дня команды'}</div></div>${spark(sPlan,CV('blue'))}</div></div>
  </div>
  <div class="grid low-grid" style="margin-top:16px">${disciplineCard()}${feedCard()}</div>
  <div class="grid ov-grid">
    <section class="live" id="live" aria-label="Структура компании">
      <div class="live-top"><div><span class="tag"><i></i>Команда</span><h3>Структура компании</h3><p>${scope().length} чел. · учредитель → директор → отделы</p></div>
        ${isOwner()?`<a class="btn sm" href="#team" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2);text-decoration:none">Изменить структуру</a>`:''}</div>
      <div class="chips"><button class="${CF==='all'?'on':''}" data-cf="all">Все <em>${scope().length}</em></button>${counts.map(([dp,c])=>`<button class="${CF===dp?'on':''}" data-cf="${esc(dp)}"><i style="background:${grpColor(dp)}"></i>${esc(dp)} <em>${c}</em></button>`).join('')}</div>
      ${orgChart()}
      <div class="foot"><span>${(n=>`${n} ${n%10===1&&n%100!==11?'отдел':[2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?'отдела':'отделов'}`)(groups(scope()).filter(g=>g!=='Руководство'&&g!=='Без отдела').length)}</span><span><b class="num">${act.length}</b> открытых задач · <b class="num" style="color:#FF9A92">${over.length}</b> просрочено</span></div>
    </section>
    <div class="card"><div class="card-h"><div><h3>Пульс дисциплины</h3><p>Выполнение личных планов · 10 дней</p></div><div style="text-align:right"><div class="bigstat"><b class="num">${teamPlan==null?'—':teamPlan+'%'}</b></div>${teamPlan!=null&&prevPlan!=null?`<span class="pill ${teamPlan>=prevPlan?'ok':'bad'}">${teamPlan>=prevPlan?'↗':'↘'} ${Math.abs(teamPlan-prevPlan)} к вчера</span>`:''}</div></div>
      <div class="heat">${heat}</div>
      <div class="legend">меньше <i style="background:${ARGB(.15)}"></i><i style="background:${ARGB(.4)}"></i><i style="background:${ARGB(.7)}"></i><i style="background:${ARGB(1)}"></i> больше</div>
    </div>
  </div>
  <div class="grid low-grid">
    <div class="card"><div class="card-h"><div><h3>Сотрудники</h3><p>Задачи и план дня каждого</p></div>${isMgr()?`<button class="btn sm" data-act="invite">${ICON.plus}Пригласить</button>`:''}</div>
      ${rows?`<div class="scroll"><table class="tbl"><thead><tr><th>Сотрудник</th><th class="hide-s">Отдел</th><th class="n">В работе</th><th class="n">Просрочено</th><th>План дня</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Здесь появятся ваши сотрудники</div>'}</div>
    ${decisionCard(attention)}
  </div>
  <div class="grid low-grid"><div class="card"><div class="card-h"><div><h3>Повторяющиеся задачи</h3><p>Создаются сами в нужные дни</p></div></div>${seriesList()}</div><div class="card"><div class="card-h"><div><h3>Срок сегодня</h3><p>Задачи команды на сегодня</p></div></div>${(()=>{ const td = scopeTasks().filter(t=>t.status!=='done' && t.due===TODAY && !late(t)); return td.length ? td.map(taskRow).join('') : '<div class="empty">На сегодня задач со сроком нет</div>'; })()}</div></div>`;
}
function seriesList(){
  const seen = new Map(); S.tasks.filter(t=>t.series && t.series.active).forEach(t=>{ if(!seen.has(t.series.id) || seen.get(t.series.id).due < t.due) seen.set(t.series.id, t); });
  const arr = [...seen.values()];
  return arr.length ? arr.map(t=>`<div class="wrow" data-open="${t.id}" role="button" tabindex="0"><span class="wc-ic" style="background:var(--blue-soft)">🔁</span><div style="flex:1;min-width:0"><b>${esc(t.title)}</b><small>${esc(U(t.assignee).name)} · ${esc(REPEAT_RU[t.series.repeat]||'')}${t.dueTime?' · до '+t.dueTime:''}</small></div></div>`).join('')
    : '<div class="empty">Нет. При создании задачи выберите «Повторять: каждый день» — например, открытие точки или ежедневный отчёт.</div>';
}


/* ---------- командный центр: лента и решения ---------- */
function feedCard(){
  const ids = new Set(scopeIds());
  const ev = [];
  for(const t of S.tasks){ if(!ids.has(t.assignee) && !ids.has(t.author)) continue;
    for(const c of t.comments) ev.push({at:c.at, who:U(c.u).name, text:c.t.replace(/\s+/g,' ').slice(0,80), task:t, bad:/Попросил|истёк/.test(c.t)});
    if(late(t)) ev.push({at:(t.due+'T'+(t.dueTime||'23:59')), who:U(t.assignee).name, text:'срок истёк', task:t, bad:true});
    if(t.status==='done' && t.doneAt) ev.push({at:t.doneAt+'T00:00', who:U(t.assignee).name, text:'выполнил(а)', task:t});
  }
  ev.sort((a,b)=>b.at.localeCompare(a.at));
  const tm = at => at.slice(0,10)===TODAY ? (at.slice(11,16)==='00:00'?'сегодня':at.slice(11,16)) : fmt(at.slice(0,10));
  return `<div class="card"><div class="card-h"><div><h3>Лента</h3><p>Что происходит в команде</p></div><span class="live-dot">● live</span></div>
    ${ev.length ? ev.slice(0,7).map(e=>`<div class="feed-row ${e.bad?'bad':''}" data-open="${e.task.id}" role="button" tabindex="0" style="cursor:pointer"><time>${esc(tm(e.at))}</time><span><b>${esc(e.who)}</b> · ${esc(e.text)} <span class="note">— ${esc(e.task.title.slice(0,40))}</span></span></div>`).join('')
      : '<div class="empty">Здесь появятся комментарии, фото-отчёты и выполненные задачи</div>'}</div>`;
}
function decisionCard(attention){
  const asks = scopeTasks().filter(t=>t.status!=='done' && t.comments.some(c=>/Попросил\(а\) больше времени/.test(c.t)) && !t.comments.some((c,i,arr)=>/Срок продлён/.test(c.t) && i > arr.findIndex(x=>/Попросил/.test(x.t))));
  const lateT = attention.filter(t=>late(t) && !asks.includes(t));
  const can = t => canExtend(t);
  const box = (t, sub, hot) => `<div class="dec ${hot?'hot':''}"><b>${esc(t.title)}</b><small>${sub}</small><div class="acts">${can(t)?`<button class="btn sm" data-ext="${t.id}|2h">+2 ч</button><button class="btn sm" data-ext="${t.id}|1d">+1 день</button><button class="btn sm" data-ext="${t.id}|3d">+3 дня</button>`:''}<button class="btn sm" data-open="${t.id}">Открыть</button></div></div>`;
  const items = [...asks.map(t=>box(t, `${esc(U(t.assignee).name)} просит больше времени · срок ${esc(dueText(t))}`, true)), ...lateT.map(t=>box(t, `${esc(U(t.assignee).name)} · просрочено, срок был ${esc(dueText(t))}`, true))];
  return `<div class="card"><div class="card-h"><div><h3>Требует решения</h3><p>Просьбы о времени и просрочки</p></div><span class="pill bad num">${items.length}</span></div>
    ${items.length ? items.slice(0,6).join('') : '<div class="empty">Всё под контролем — решений не требуется</div>'}</div>`;
}

/* ---------- дисциплина: выполнено вовремя за 30 дней ---------- */
function discipline(uid){
  const from = addDays(TODAY,-30);
  const ts = S.tasks.filter(t=>t.assignee===uid && t.due>=from && t.due<=TODAY && t.author!==t.assignee);
  const onTime = ts.filter(t=>t.status==='done' && t.doneAt && t.doneAt<=t.due).length;
  const lateDone = ts.filter(t=>t.status==='done' && t.doneAt && t.doneAt>t.due).length;
  const over = ts.filter(late).length;
  const total = onTime+lateDone+over;
  return {onTime, lateDone, over, total, pct: total ? Math.round(onTime/total*100) : null};
}
function disciplineCard(){
  const list = scope().filter(u=>u.id!==S.me).map(u=>({u, d:discipline(u.id)})).filter(x=>x.d.total).sort((a,b)=>b.d.pct-a.d.pct || b.d.total-a.d.total);
  return `<div class="card"><div class="card-h"><div><h3>Дисциплина по задачам</h3><p>Выполнено вовремя · последние 30 дней</p></div></div>
    ${list.length ? list.map(({u,d},i)=>`<div class="drow"><span class="dpos num">${i+1}</span>${av(u,28)}<div class="dmain"><div class="dtop"><b>${esc(u.name)}</b><span class="num" style="color:${d.pct>=80?'var(--ok)':d.pct>=50?'var(--warn)':'var(--bad)'};font-weight:800">${d.pct}%</span></div>
      <div class="bar"><i style="width:${d.pct}%;background:${d.pct>=80?'var(--ok)':d.pct>=50?'var(--warn)':'var(--bad)'}"></i></div><small>${d.onTime} вовремя · ${d.lateDone} с опозданием · ${d.over} просрочено</small></div></div>`).join('')
      : '<div class="empty">Появится, когда у сотрудников будут задачи со сроком</div>'}</div>`;
}

// группа человека в структуре: руководство компании, его отдел или «Без отдела»
const LEAD = u => u.level==='owner'||u.level==='founder'||u.level==='director';
const isFounderLvl = u => u.level==='founder' || (u.level==='owner' && u.pos!=='director');
const isDirLvl = u => u.level==='director' || (u.level==='owner' && u.pos==='director');
const grp = u => LEAD(u) ? 'Руководство' : (u.deptId && S.depts.some(d=>d.id===u.deptId) ? u.dept : 'Без отдела');
const grpColor = g => g==='Руководство' ? '#FFD23F' : g==='Без отдела' ? '#9AA3C7' : ((S.depts.find(d=>d.name===g)||{}).color || deptColor(g));
function groups(list){ const order = [...new Set(['Руководство', ...S.depts.map(d=>d.name), 'Без отдела'])]; return order.filter(g=>list.some(u=>grp(u)===g)); }
function orgChart(){
  const sc = scope();
  const nd = u => `<div class="nd"><b>${esc(u.name)}</b><small>${esc(u.title||roleName(u))}</small></div>`;
  const founders = sc.filter(isFounderLvl), dirs = sc.filter(isDirLvl);
  const gs = groups(sc).filter(g=>g!=='Руководство' && (CF==='all'||CF===g));
  let html = `<div class="org">`;
  if(founders.length) html += `<div class="lvl">${founders.map(nd).join('')}</div>`;
  if(dirs.length) html += `<div class="lvl">${dirs.map(nd).join('')}</div>`;
  if(gs.length) html += `<div class="ocols">${gs.map(g=>{ const ppl = sc.filter(u=>grp(u)===g), heads = ppl.filter(u=>u.level==='manager'), ws = ppl.filter(u=>u.level==='worker');
    return `<div class="ocol" style="--dc:${grpColor(g)}"><div class="oct"><i></i>${esc(g)}<em>${ppl.length}</em></div>${heads.map(u=>nd(u).replace('class="nd"','class="nd hd"')).join('')}${ws.map(nd).join('')}</div>`; }).join('')}</div>`;
  return html + '</div>';
}

/* ---------- созвездие ---------- */
let raf = null;
function hexA(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function startConstellation(demo){
  cancelAnimationFrame(raf);
  const cv = $('cv'); if(!cv) return;
  const live = cv.parentElement;
  if(!demo && VIEW!=='orbit'){ cv.style.display='none'; return; }
  const ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio||1);
  let W=0,H=0;
  const size = () => { const r = live.getBoundingClientRect(); W=r.width; H=r.height; cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
  size();
  const R = rnd(42);
  let people, getTasks;
  if(demo){
    const D = [['Руководство','#FFD23F'],['Продажи','#6F8BFF'],['Сервис','#FF8A4C'],['Финансы','#3FD3A8']];
    people = [{id:1,name:'',dept:'Руководство',deptColor:'#FFD23F',role:'manager',boss:null}];
    let id=2; D.slice(1).forEach(([d,c])=>{ const mid=id++; people.push({id:mid,name:'',dept:d,deptColor:c,role:'manager',boss:1}); for(let k=0;k<3;k++) people.push({id:id++,name:'',dept:d,deptColor:c,role:'worker',boss:mid}); });
    getTasks = u => Array.from({length:(u.id*7)%4}, (_,i)=>({late: (u.id+i)%5===0}));
  } else {
    people = scope().map(u=>({...u, deptColor: grpColor(grp(u)), dept: grp(u)}));
    getTasks = u => S.tasks.filter(t=>t.assignee===u.id && t.status!=='done').map(t=>({late:late(t)}));
  }
  const depts = [...new Set(people.map(u=>u.dept))].filter(d=>people.some(u=>u.dept===d && people.some(x=>x.id===u.boss)));
  const stars = Array.from({length:90},()=>({x:R(),y:R(),r:R()*1.2+.2,a:R()*.6+.1}));
  const TOPY = () => demo ? 100 : (W<560?170:140), BOTY = () => demo ? H-190 : H-46;
  const cx = () => W*.5, cy = () => (TOPY()+BOTY())/2;
  const nodes = people.map(u => {
    const isTop = !people.some(x=>x.id===u.boss);
    const mates = people.filter(x=>x.dept===u.dept && x.role!=='manager' || x.id===u.id);
    return {u, isTop, di: Math.max(0,depts.indexOf(u.dept)), k: mates.findIndex(x=>x.id===u.id), n: Math.max(1,mates.length), tasks: getTasks(u), ph: R()*Math.PI*2};
  });
  // реальная команда: учредитель в центре, директор рядом, отделы секторами: руководитель отдела ближе, работники — дальше
  if(!demo){
    const F0 = people.filter(isFounderLvl), D0 = people.filter(isDirLvl);
    const centre = F0.length ? F0 : D0, ring = F0.length ? D0 : [];
    const gs = [...new Set(people.filter(u=>!LEAD(u)).map(u=>u.dept))];
    const G = Math.max(1, gs.length), sector = Math.PI*2/G;
    nodes.forEach(nd=>{ const u = nd.u;
      nd.isTop = centre.includes(u); nd.u = {...u, role: LEAD(u)||u.level==='manager' ? 'manager' : 'worker'};
      if(nd.isTop){ nd.slot = {k:'c', i:centre.indexOf(u), n:centre.length}; return; }
      if(ring.includes(u)){ nd.slot = {k:'d', i:ring.indexOf(u), n:ring.length}; return; }
      const gi = gs.indexOf(u.dept), mates = people.filter(x=>x.dept===u.dept && x.level==='worker');
      nd.slot = u.level==='manager' ? {k:'h', base: -Math.PI/2 + (gi+.5)*sector, j: people.filter(x=>x.dept===u.dept&&x.level==='manager').indexOf(u)}
        : {k:'w', base: -Math.PI/2 + (gi+.5)*sector, i: mates.indexOf(u), n: mates.length};
    });
    var place = (nd, t) => {
      const s = nd.slot, rx = Math.min(W*.44, 440), ry = Math.max(40,(BOTY()-TOPY())/2 - 16), wob = reduce ? 0 : Math.sin(t*.00025 + nd.ph)*.025;
      const clamp = ([x,y]) => [Math.max(26, Math.min(W-26, x)), Math.max(TOPY()+10, Math.min(BOTY()-14, y))];
      if(s.k==='c') return [cx() + (s.i-(s.n-1)/2)*Math.min(120, rx*.32), cy() + (ring.length ? Math.min(28, ry*.25) : 0)];
      if(s.k==='d') return [cx() + (s.i-(s.n-1)/2)*Math.min(130, rx*.35) + wob*40, cy() - Math.max(46, ry*.55)];
      // точка отдела: руководитель на средней орбите; работники — веером наружу от него
      const ang = s.base, ux = Math.cos(ang), uy = Math.sin(ang), hx = cx() + ux*rx*.5, hy = cy() + uy*ry*.55;
      if(s.k==='h') return clamp([hx + s.j*34, hy + s.j*22 + wob*20]);
      const dist = Math.min(rx*.42, 150), gap = Math.max(34, Math.min(52, (ry*2-20)/Math.max(1,s.n))), off = (s.i-(s.n-1)/2)*gap;
      // перпендикуляр к направлению отдела; для боковых отделов это вертикаль
      const px = -uy, py = ux, sx = Math.abs(ux) > .6 ? 0 : px, sy = Math.abs(ux) > .6 ? 1 : py;
      return clamp([hx + ux*dist + sx*off + wob*30, hy + uy*dist*.6 + sy*off]);
    };
  }
  const pos = (nd, t) => {
    if(!demo) return place(nd, t);
    if(nd.isTop && !(nd.u.boss)) { const tops = nodes.filter(n=>n.isTop); if(tops.length===1) return [cx(), cy()]; }
    const base = depts.length===1 ? 0 : (nd.di/Math.max(1,depts.length)) * Math.PI*2 - Math.PI/2;
    const f = nd.u.role==='manager' ? .62 : .97;
    const rx = Math.min(W*.42, 420) * f, ry = Math.max(30,((BOTY()-TOPY())/2 - 18)) * f;
    const spread = nd.u.role==='manager' ? 0 : ((nd.k - (nd.n-1)/2) * .36);
    const ang = base + spread + Math.sin(t*.00025 + nd.ph)*.04 + (nd.isTop ? nd.ph : 0);
    return [cx() + Math.cos(ang)*rx, cy() + Math.sin(ang)*ry];
  };
  let mouse = null, tip = null;
  live.onmousemove = e => { const r = cv.getBoundingClientRect(); mouse = [e.clientX-r.left, e.clientY-r.top]; };
  live.onmouseleave = () => { mouse = null; if(tip){ tip.remove(); tip=null; } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(t){
    if(!document.body.contains(cv)) return;
    ctx.clearRect(0,0,W,H);
    stars.forEach(s=>{ ctx.fillStyle=`rgba(220,228,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, 7); ctx.fill(); });
    const P = new Map(nodes.map(nd=>[nd.u.id, pos(nd,t)]));
    nodes.forEach(nd => { const b = P.get(nd.u.boss); if(!b) return; const p = P.get(nd.u.id); const dim = CF!=='all' && nd.u.dept!==CF;
      ctx.strokeStyle = dim ? 'rgba(160,175,255,.06)' : 'rgba(160,175,255,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b[0],b[1]); ctx.lineTo(p[0],p[1]); ctx.stroke(); });
    let hover = null;
    nodes.forEach(nd => {
      const [x,y] = P.get(nd.u.id), dim = !demo && CF!=='all' && nd.u.dept!==CF && !nd.isTop, col = nd.u.deptColor || '#6F8BFF';
      const r = nd.isTop ? 14 : nd.u.role==='manager' ? 10 : 7;
      if(!dim) nd.tasks.forEach((tk,i)=>{ const a = (reduce?0:t*.0006) + i*(Math.PI*2/nd.tasks.length) + nd.ph; const orx = r+12, ory = (r+12)*.55;
        ctx.fillStyle = tk.late ? '#FF7B72' : 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x + Math.cos(a)*orx, y + Math.sin(a)*ory, 2.2, 0, 7); ctx.fill(); });
      const g = ctx.createRadialGradient(x,y,0,x,y,r*3.2); g.addColorStop(0, hexA(col, dim?.12:.55)); g.addColorStop(1, hexA(col,0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r*3.2,0,7); ctx.fill();
      ctx.fillStyle = dim ? hexA(col,.3) : col; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
      if(nd.u.name){
        ctx.fillStyle = dim ? 'rgba(10,15,60,.4)' : 'rgba(10,15,60,.85)'; ctx.font = `700 ${nd.isTop?12:r>8?10:9}px Onest, system-ui, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(nd.u.name.replace(/^Демо:\s*/,'').slice(0,1), x, y+.5);
        if(!dim && (nd.isTop || nd.u.role==='manager' || W>700)){ ctx.fillStyle='rgba(232,236,255,.75)'; ctx.font='600 10.5px Onest, system-ui, sans-serif'; ctx.fillText(nd.u.name.replace(/^Демо:\s*/,'').split(' ')[0], x, y+r+13+(nd.tasks.length?6:0)); }
      }
      if(!demo && mouse && Math.hypot(mouse[0]-x, mouse[1]-y) < r+8) hover = {nd,x,y};
    });
    if(hover){
      if(!tip){ tip = document.createElement('div'); tip.className='tip'; live.appendChild(tip); }
      const u = hover.nd.u, lt = hover.nd.tasks.filter(x=>x.late).length;
      tip.innerHTML = `<b>${esc(u.name)}</b><small>${esc(u.title||'')} · ${esc(u.dept)}</small><small>${hover.nd.tasks.length} задач в работе${lt?` · <span style="color:var(--bad)">${lt} просрочено</span>`:''}</small>`;
      tip.style.left = Math.min(W-190, hover.x+14)+'px'; tip.style.top = (hover.y-10)+'px';
    } else if(tip){ tip.remove(); tip=null; }
    if(!reduce) raf = requestAnimationFrame(frame);
  }
  window.onresize = () => { size(); if(reduce) frame(0); };
  raf = requestAnimationFrame(frame);
}

/* ---------- задачи ---------- */
function taskRow(t){
  const a = U(t.assignee), canTick = t.assignee===S.me || isMgr();
  return `<div class="task ${t.status==='done'?'done':''}" data-open="${t.id}">
    ${canTick?`<button class="check ${t.status==='done'?'on':''}" data-tick="${t.id}" aria-label="Отметить выполненной">${ICON.tick}</button>`:'<span></span>'}
    <div style="min-width:0"><div class="t">${esc(t.title)}</div>
      <div class="meta"><span>${esc(a.name)}</span><span${late(t)?' style="color:var(--bad);font-weight:600"':''}>Срок: ${dueText(t)}</span><span class="p-${t.priority}">${PRIO[t.priority]}</span>${t.remind?`<span>⏰ ${fmtDT(t.remind)}</span>`:''}${t.comments.length?`<span>💬 ${t.comments.length}</span>`:''}</div></div>
    <div class="right">${statusChip(t)}</div></div>`;
}
function filtered(){ return S.tasks.filter(t => (S.scope.includes(t.assignee) || t.author===S.me) && (F.who==='all' || t.assignee===Number(F.who)) && (!F.q || (t.title+' '+U(t.assignee).name).toLowerCase().includes(F.q.toLowerCase()))); }
function vTimeline(list){
  const start = addDays(TODAY, -9 + F.off), N = 28, days = Array.from({length:N},(_,i)=>addDays(start,i));
  const ti = diff(start, TODAY);
  const dueCount = days.map(d=>list.filter(t=>t.status!=='done' && t.due===d).length);
  const mx = Math.max(...dueCount,0), peakI = mx ? dueCount.indexOf(mx) : -1;
  const cw = 100/N;
  const pts = dueCount.map((v,i)=>[(i+.5)*cw, 46-(v/Math.max(mx,1))*36]);
  const capPath = pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(1)).join(' ');
  const people = S.users.filter(u=>list.some(t=>t.assignee===u.id));
  const dayHead = days.map(d=>{ const x=new Date(d+'T12:00:00'), we=x.getDay()===0||x.getDay()===6; return `<div class="d ${we?'we':''} ${d===TODAY?'today':''}">${WD[x.getDay()].slice(0,1)}<b class="num">${x.getDate()}</b></div>`; }).join('');
  const bgcols = days.map((d,i)=>{ const x=new Date(d+'T12:00:00'); return (x.getDay()===0||x.getDay()===6) ? `<span class="bgcol" style="left:${i*cw}%;width:${cw}%"></span>` : ''; }).join('');
  const lanes = people.map(u => {
    const rows = [];
    list.filter(t=>t.assignee===u.id).sort((a,b)=>a.created.localeCompare(b.created)).forEach(t => {
      const s = Math.max(0, diff(start, t.created)), endD = late(t) ? TODAY : t.due, e = Math.min(N-1, diff(start, endD));
      if(e < 0 || s > N-1 || e < s) return;
      let r = rows.findIndex(row => row.every(x => x.e < s || x.s > e)); if(r<0){ rows.push([]); r = rows.length-1; }
      rows[r].push({t,s,e});
    });
    const h = Math.max(1, rows.length)*30 + 4;
    const bars = rows.flatMap((row,ri)=>row.map(({t,s,e})=>{ const cls = late(t)?'late':t.status; const len = diff(t.created, t.due)+1;
      return `<div class="tb ${cls}" data-open="${t.id}" style="left:calc(${s*cw}% + 2px);width:calc(${(e-s+1)*cw}% - 4px);top:${6+ri*30}px" title="${esc(t.title)}">${esc(t.title)} · ${late(t)?'просрочено':len+' дн.'}</div>`; })).join('');
    return `<div class="tl-row"><div class="who">${av(u,24)}<div>${esc(u.name)}<br><small>${esc(u.dept)}</small></div></div>
      <div class="lane" style="height:${h}px">${bgcols}${ti>=0&&ti<N?`<span class="todayline" style="left:calc(${(ti+.5)*cw}% - 1px)"></span>`:''}${bars}</div></div>`;
  }).join('');
  const m1 = new Date(start+'T12:00:00'), m2 = new Date(addDays(start,N-1)+'T12:00:00');
  const mlabel = m1.getMonth()===m2.getMonth() ? `${MONN[m1.getMonth()]} ${m1.getFullYear()}` : `${MONN[m1.getMonth()]} — ${MONN[m2.getMonth()]}`;
  const open = list.filter(t=>t.status!=='done');
  return `<div class="card">
    <div class="tl-top"><div class="mnav"><button data-act="tl-" aria-label="Назад">‹</button><span>${mlabel}</span><button data-act="tl+" aria-label="Вперёд">›</button></div>
      <span class="st"><b class="num y">${open.filter(t=>t.due===TODAY).length}</b>срок сегодня</span>
      <span class="st"><b class="num">${open.filter(t=>t.due>=TODAY && t.due<=addDays(TODAY,6)).length}</b>на этой неделе</span>
      <span class="st"><b class="num" style="color:var(--bad)">${open.filter(late).length}</b>просрочено</span>
      <div class="lg"><span><i style="border-color:#6F8BF0;background:#EEF2FF"></i>В работе</span><span><i style="border-color:#C9CEE0"></i>Новая</span><span><i style="border-color:#F2B84B;background:#FFF5DC"></i>На проверке</span><span><i style="border-color:#F08A82;background:var(--bad-soft)"></i>Просрочено</span><span><i style="border-color:#9BD8C2;background:var(--ok-soft)"></i>Готово</span></div></div>
    <div class="tl"><div class="tl-in">
      <div class="tl-row"><div class="who" style="flex-direction:column;align-items:flex-start;gap:0"><span class="eyebrow" style="color:var(--muted)">Нагрузка по срокам</span><small style="color:var(--muted);font-size:11px">${mx?`пик: ${mx} · ${fmt(days[peakI])}`:'сроков нет'}</small></div>
        <div class="cap"><svg viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true"><path d="${capPath}" fill="none" stroke="${CV('line')}" stroke-width="5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p,i)=>i<N-1&&(dueCount[i]||dueCount[i+1])?`<path d="M${p[0]} ${p[1]} L${pts[i+1][0]} ${pts[i+1][1]}" stroke="${CV('blue')}" stroke-width="5" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`:'').join('')}</svg>
        ${mx>0?`<span style="position:absolute;left:calc(${(peakI+.5)*cw}% - 22px);top:-6px;background:var(--ink);color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 7px">${mx} срок.</span>`:''}</div></div>
      <div class="tl-row"><div class="who"><span class="eyebrow" style="color:var(--muted)">Сотрудник</span></div><div class="tl-days" style="--n:${N}">${dayHead}</div></div>
      ${lanes || '<div class="empty">Нет задач в этом периоде. Нажмите «Поставить задачу».</div>'}
    </div></div>
  </div>`;
}
function vBoard(list){
  return `<div class="board">${['new','progress','review','done'].map(s => { const items = list.filter(t=>t.status===s).sort((a,b)=>(a.due||'').localeCompare(b.due||''));
    return `<div class="col"><h4><span>${STATUS[s]}</span><span class="num">${items.length}</span></h4>${items.map(t=>{ const a=U(t.assignee); return `<div class="bcard ${late(t)?'late':''}" data-open="${t.id}"><div class="t">${esc(t.title)}</div>
      <div class="row"><span class="person" style="gap:6px">${av(a,22)}<span>${esc(a.name)}</span></span><span style="color:${late(t)?'var(--bad)':'inherit'};font-weight:${late(t)?700:500}">${t.due===TODAY?'сегодня':fmt(t.due)}</span></div></div>`; }).join('') || '<div class="note" style="padding:6px 4px">Пусто</div>'}</div>`; }).join('')}</div>`;
}
function vTasks(){
  if(isMgr()){
    const list = filtered();
    return header('Задачи<span>›</span>'+(F.mode==='timeline'?'Сроки':'Доска'), 'Задачи команды', `<button class="btn primary" data-act="new">${ICON.plus}Поставить задачу</button>`) + `
      <div class="filters"><div class="tabs"><button class="${F.mode==='timeline'?'on':''}" data-mode="timeline">Сроки</button><button class="${F.mode==='board'?'on':''}" data-mode="board">Доска</button></div>
        <select id="f-who" aria-label="Исполнитель"><option value="all">Все сотрудники</option>${scope().map(u=>`<option value="${u.id}" ${String(F.who)===String(u.id)?'selected':''}>${esc(u.name)}</option>`).join('')}</select>
        ${F.q?`<span class="pill blue">Поиск: ${esc(F.q)} <button data-act="clearq" style="border:0;background:none;padding:0 0 0 4px;color:inherit" aria-label="Сбросить поиск">✕</button></span>`:''}</div>
      ${F.mode==='timeline' ? vTimeline(list) : vBoard(list)}`;
  }
  const mine = S.tasks.filter(t=>t.assignee===S.me && (!F.q || t.title.toLowerCase().includes(F.q.toLowerCase())));
  const groups = [['Просрочено', mine.filter(late), 'var(--bad)'], ['Сегодня', mine.filter(t=>!late(t)&&t.status!=='done'&&t.due===TODAY), 'var(--warn)'],
    ['Скоро', mine.filter(t=>t.status!=='done'&&t.due>TODAY).sort((a,b)=>a.due.localeCompare(b.due)), 'var(--blue)'], ['Выполнено', mine.filter(t=>t.status==='done'), 'var(--ok)']];
  const open = mine.filter(t=>t.status!=='done'), p = planPct(S.me,TODAY);
  return header('Мои задачи', 'Мои задачи', `<button class="btn primary" data-act="new">${ICON.plus}Личная задача</button>`) + `
    <div class="grid kpis" style="margin-bottom:16px">
      <div class="card kpi hero"><div class="lab"><span class="ic">${ICON.flame}</span>В работе</div><div class="row"><div><div class="v num">${open.length}</div><div class="sub">${open.filter(t=>t.due===TODAY).length} со сроком сегодня</div></div></div></div>
      <div class="card kpi"><div class="lab"><span class="ic">${ICON.alert}</span>Просрочено</div><div class="row"><div class="v num ${mine.filter(late).length?'bad':''}">${mine.filter(late).length}</div></div></div>
      <div class="card kpi"><div class="lab"><span class="ic">${ICON.done}</span>Выполнено</div><div class="row"><div class="v num">${mine.filter(t=>t.status==='done').length}</div></div></div>
      <div class="card kpi"><div class="lab"><span class="ic">${ICON.target}</span>План дня</div><div class="row"><div class="v num">${p==null?'—':p}<small>${p==null?'':'%'}</small></div></div></div>
    </div>
    <div class="card">${mine.length ? groups.filter(g=>g[1].length).map(([h,arr,c]) => `<div class="group-h" style="color:${c}">${h} <span class="num" style="color:var(--muted)">${arr.length}</span></div>${arr.map(taskRow).join('')}`).join('') : '<div class="empty">Задач пока нет. Когда руководитель поставит задачу, она появится здесь и придёт в Telegram.</div>'}</div>`;
}

/* ---------- планы ---------- */
let DAY = null;
function vPlans(){
  if(!feat('plans')) return lockView('plans');
  DAY = DAY || TODAY;
  const items = plansFor(S.me, DAY), p = planPct(S.me, DAY);
  const days = Array.from({length:7},(_,i)=>addDays(TODAY,i-6));
  const hs = S.habits;
  const dlabel = DAY===TODAY ? 'Сегодня' : DAY===addDays(TODAY,1) ? 'Завтра' : DAY===addDays(TODAY,-1) ? 'Вчера' : fmt(DAY);
  const cells = hs.reduce((a,h)=>a+days.filter(d=>hScheduled(h,d)).length,0);
  const streak = cells ? Math.round(hs.reduce((a,h)=>a+days.filter(d=>hScheduled(h,d)&&h.days[d]).length,0)/cells*100) : 0;
  return header('Планы', 'Мои планы') + `
  <div class="grid plans">
    <div class="card">
      <div class="card-h"><div><h3>План на день</h3><p>Вечером бот напомнит, что осталось</p></div><div class="daynav"><button data-act="day-" aria-label="Предыдущий день">‹</button><span>${dlabel}</span><button data-act="day+" aria-label="Следующий день">›</button></div></div>
      <div class="ringrow">${ring(p,84)}<div><b class="num">${p==null?'—':p+'%'}</b><small>${items.filter(x=>x.done).length} из ${items.length} выполнено</small></div></div>
      ${items.map(it=>`<div class="plan-item ${it.done?'done':''} ${it.important?'imp':''}"><button class="check ${it.done?'on':''}" data-plan="${it.id}" data-done="${it.done?1:0}" aria-label="Отметить">${ICON.tick}</button>
        <div class="pi-body" data-pedit="${it.id}" role="button" tabindex="0" title="Открыть и изменить">
          <div class="pi-top">${it.time?`<span class="pi-time num">${esc(it.time)}</span>`:''}${it.important?'<span class="pi-star" title="Важное">★</span>':''}<span class="pi-text">${esc(it.text)}</span></div>
          ${it.note||it.repeat||it.remind?`<div class="pi-meta">${it.repeat?`<span title="Повторяется">↻ ${REPEAT_SHORT[it.repeat]||'повтор'}</span>`:''}${it.remind?'<span title="Напоминание в Telegram">🔔 напомню</span>':''}${it.note?`<span class="pi-note">📝 ${esc(it.note.length>90?it.note.slice(0,90)+'…':it.note)}</span>`:''}</div>`:''}
        </div></div>`).join('') || '<div class="empty">На этот день планов нет — добавьте первый пункт.</div>'}
      <form class="add" id="add-plan"><input id="plan-text" placeholder="Новый пункт плана" aria-label="Новый пункт плана" autocomplete="off"><button class="btn" type="button" data-act="plan-more" title="Дата, время, повтор, заметка">Подробнее…</button><button class="btn primary" type="submit">Добавить</button></form>
    </div>
    <div class="card">
      <div class="card-h"><div><h3>Привычки</h3><p>Последние 7 дней</p></div><span class="pill blue num">${streak}% недели</span></div>
      <div class="scroll"><table class="habits"><thead><tr><th>Привычка</th>${days.map(d=>{const x=new Date(d+'T12:00:00');return `<th class="${d===TODAY?'today':''}">${WD[x.getDay()]}<br><span class="num">${x.getDate()}</span></th>`}).join('')}</tr></thead>
      <tbody>${hs.map(h=>{ const st=hStreak(h); return `<tr><td><div class="h-name" data-hedit="${h.id}" role="button" tabindex="0" title="Открыть и изменить"><b>${esc(h.name)}</b>
        <small>${esc(hSchedText(h))}${h.time?` · ${h.remind?'🔔 ':''}${esc(h.time)}`:''}${h.note?` · 🎯 ${esc(h.note)}`:''}${h.until?` · до ${fmt(h.until)}`:''}</small>${st>1?`<small class="h-streak">🔥 ${st} подряд</small>`:''}</div></td>
        ${days.map(d=>hScheduled(h,d)?`<td><button class="hb ${h.days[d]?'on':''}" data-hab="${h.id}|${d}" aria-label="${esc(h.name)} ${d}">${ICON.tick}</button></td>`:`<td><span class="hb off" title="Не по расписанию">·</span></td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="8" class="empty">Привычек пока нет. Например: «Чтение 20 минут» или «Спорт».</td></tr>`}</tbody></table></div>
      <form class="add" id="add-habit"><input id="habit-text" placeholder="Новая привычка" aria-label="Новая привычка" autocomplete="off"><button class="btn" type="button" data-act="habit-more" title="Расписание, время, срок, цель">Подробнее…</button><button class="btn primary" type="submit">Добавить</button></form>
    </div>
  </div>`;
}

/* ---------- команда ---------- */
function vTeam(){
  const list = S.users.filter(u => !F.q || (u.name+u.title+u.dept).toLowerCase().includes(F.q.toLowerCase()));
  const vis = id => S.scope.includes(id);
  const hasDemo = S.users.some(u=>u.demo);
  const demoBtn = isOwner() ? (hasDemo ? `<button class="btn" data-act="demo-del">Удалить демо</button>` : `<button class="btn" data-act="demo-add">Добавить демо-сотрудников</button>`) : '';
  const tv = teamView();
  const tabs = `<div class="filters teamtabs"><div class="tabs" role="tablist"><button class="${tv==='org'?'on':''}" data-tv="org" role="tab" aria-selected="${tv==='org'}">Структура</button><button class="${tv==='people'?'on':''}" data-tv="people" role="tab" aria-selected="${tv==='people'}">Люди</button></div></div>`;
  const head = header('Команда<span>›</span>'+(tv==='org'?'Структура':'Люди'), 'Команда', (tv==='org'&&isOwner()?`<button class="btn" data-act="dept-new">${ICON.plus}Отдел</button>`:'') + demoBtn + (isMgr()?`<button class="btn primary" data-act="invite">${ICON.plus}Пригласить</button>`:'')) + tabs;
  if(tv==='org') return head + vOrg() + (isOwner() ? billingCard() : '');
  return head +
    (isOwner() ? billingCard() : '') +
    (isOwner() && hasDemo ? `<div class="card demo-note"><b>Демо-режим.</b> Нажмите «Войти как» у демо-сотрудника, чтобы увидеть «Орбиту» его глазами: его задачи, план, отметки. Демо-сотрудникам уведомления в Telegram не уходят.</div>` : '') +
    `<div class="grid team">${list.map(u=>{
    const mine=S.tasks.filter(t=>t.assignee===u.id), a=mine.filter(t=>t.status!=='done').length, od=mine.filter(late).length, dn=mine.filter(t=>t.status==='done').length;
    const p=planPct(u.id,TODAY), boss = u.boss ? U(u.boss).name : null;
    return `<div class="card tc"><div class="person">${av(u,42)}<div><b>${esc(u.name)}</b><small>${esc(u.title||roleName(u))} · ${esc(u.dept)}</small>${u.title&&roleName(u)?`<small>Роль: ${esc(roleName(u))}</small>`:''}${boss?`<small>Руководитель: ${esc(boss)}</small>`:''}</div></div>
      ${vis(u.id)?`<div class="stats"><div><b class="num">${a}</b><small>в работе</small></div><div><b class="num" style="color:${od?'var(--bad)':'inherit'}">${od}</b><small>просрочено</small></div><div><b class="num">${dn}</b><small>готово</small></div></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span>План дня</span><span class="num" style="color:var(--ink);font-weight:700">${p==null?'—':p+'%'}</span></div>
      <div class="bar"><i style="width:${p||0}%"></i></div>${(()=>{ const d=discipline(u.id); return d.total&&u.id!==S.me?`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin:10px 0 0"><span>Дисциплина · 30 дней</span><span class="num" style="font-weight:700;color:${d.pct>=80?'var(--ok)':d.pct>=50?'var(--warn)':'var(--bad)'}">${d.pct}%</span></div>`:''; })()}`:'<p class="note">Задачи этого сотрудника видит его руководитель.</p>'}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:8px;flex-wrap:wrap">${u.demo?'<span class="chip s-review">Демо</span>':`<span class="chip ${u.tg?'s-progress':'s-new'}">${u.tg?'Telegram подключён':'Уведомления выключены'}</span>`}
      <span style="display:flex;gap:6px;flex-wrap:wrap">${u.demo&&isOwner()?`<button class="btn sm primary" data-act="viewas" data-id="${u.id}">Войти как</button>`:''}${isOwner()?`<button class="btn sm" data-act="editm" data-id="${u.id}">Изменить</button>`:''}${vis(u.id)&&u.id!==S.me&&isMgr()?`<button class="btn sm" data-act="new" data-for="${u.id}">${ICON.plus}Задача</button>`:''}</span></div></div>`; }).join('')}</div>`;
}

/* ---------- структура компании ---------- */
function teamView(){ try { return localStorage.getItem('orb_tv') || 'org'; } catch(e){ return 'org'; } }
function orgNode(u, cls=''){
  const sub = (isOwner() && !u.nameOk && !u.demo ? '⚠ без фамилии · ' : '') + (u.title || roleName(u));
  return `<${isOwner()?`button type="button" data-act="editm" data-id="${u.id}" title="Изменить"`:'div'} class="onode ${cls}">${av(u,32)}<span><b>${esc(u.name)}</b><small>${esc(sub)}</small></span></${isOwner()?'button':'div'}>`;
}
function vOrg(){
  const lead = S.users.filter(isFounderLvl);
  const dirs = S.users.filter(isDirLvl);
  const rest = S.users.filter(u=>u.level==='manager'||u.level==='worker');
  const shown = S.depts.filter(d => d.name!=='Руководство' || rest.some(u=>u.deptId===d.id));
  const noDept = rest.filter(u=>!u.deptId || !shown.some(d=>d.id===u.deptId));
  const pick = (id, label, list) => list.length ? `<select class="osel" data-${id}="1" aria-label="${label}"><option value="">${label}</option>${list.map(u=>`<option value="${u.id}">${esc(u.name)}${u.dept&&u.dept!=='Без отдела'?' · '+esc(u.dept):''}</option>`).join('')}</select>` : '';
  const level = (title, people, hint) => `<div class="olevel"><div class="olab">${title}</div><div class="orow">${people.length?people.map(u=>orgNode(u,'otop')).join(''):`<span class="note">${hint}</span>`}</div></div>`;
  const deptCard = d => {
    const heads = rest.filter(u=>u.deptId===d.id && u.level==='manager'), ws = rest.filter(u=>u.deptId===d.id && u.level==='worker');
    const others = rest.filter(u=>u.deptId!==d.id);
    return `<div class="card odept" style="--dc:${d.color}"><div class="odh"><i></i><b>${esc(d.name)}</b><small>${heads.length+ws.length} чел.</small>
        ${isOwner()?`<span class="odact"><button class="btn sm" data-act="dept-ren" data-id="${d.id}" title="Переименовать" aria-label="Переименовать отдел">✎</button><button class="btn sm" data-act="dept-del" data-id="${d.id}" title="Удалить отдел" aria-label="Удалить отдел">✕</button></span>`:''}</div>
      <div class="olab">Руководитель отдела</div>
      ${heads.length?heads.map(u=>orgNode(u,'ohead')).join(''):`<p class="note" style="margin:2px 0 8px">Не назначен</p>`}
      ${isOwner()?pick('dhead', heads.length?'Сменить руководителя…':'Назначить руководителя…', rest.filter(u=>!heads.includes(u))).replace('data-dhead="1"',`data-dhead="${d.id}"`):''}
      <div class="olab" style="margin-top:12px">Работники · ${ws.length}</div>
      <div class="olist">${ws.length?ws.map(u=>orgNode(u)).join(''):'<p class="note" style="margin:2px 0">Пока никого</p>'}</div>
      ${isOwner()?`<div class="odfoot"><button class="btn sm primary" data-act="invite-dept" data-id="${d.id}">${ICON.plus}Пригласить в отдел</button>${pick('dmove','Перевести сюда…', others).replace('data-dmove="1"',`data-dmove="${d.id}"`)}</div>`:''}
    </div>`;
  };
  return `<div class="ostruct">
    ${level('Учредитель', lead, 'Не указан')}
    <div class="oline"></div>
    ${level('Директор', dirs, isOwner()?'Директора пока нет':'Директора пока нет')}
    ${isOwner()?`<div style="display:flex;justify-content:center;margin-top:6px"><div style="width:min(320px,100%)">${pick('dirset', dirs.length?'Назначить другого директора…':'Назначить директора…', S.users.filter(u=>!isFounderLvl(u)&&!isDirLvl(u)))}</div></div>`:''}
    <div class="oline"></div>
    <div class="olab" style="text-align:center">Отделы</div>
    ${shown.length ? `<div class="odepts">${shown.map(deptCard).join('')}</div>` : `<div class="card empty" style="text-align:center">Отделов пока нет.${isOwner()?` <button class="btn sm primary" data-act="dept-new">${ICON.plus}Создать первый отдел</button>`:''}</div>`}
    ${noDept.length?`<div class="card odept" style="--dc:#9AA3C7;margin-top:14px"><div class="odh"><i></i><b>Без отдела</b><small>${noDept.length} чел.</small></div><div class="olist">${noDept.map(u=>orgNode(u)).join('')}</div>${isOwner()?'<p class="note" style="margin:8px 0 0">Распределите их: в карточке отдела «Перевести сюда…»</p>':''}</div>`:''}
  </div>`;
}
function openDept(id){
  const d = id ? S.depts.find(x=>x.id===id) : null;
  modal(`<form class="modal" id="dept-form" data-id="${id||''}" role="dialog" aria-label="Отдел"><h2>${d?'Переименовать отдел':'Новый отдел'}</h2>
    <div class="field"><label for="d-name">Название отдела</label><input id="d-name" value="${d?esc(d.name):''}" placeholder="Например: Отдел продаж" maxlength="40" required></div>
    ${d?'':'<p class="note" style="margin:-4px 0 12px">Потом назначьте руководителя отдела и добавьте работников — структура соберётся сама.</p>'}
    <div class="mact"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">${d?'Сохранить':'Создать отдел'}</button></div></form>`);
  setTimeout(()=>$('d-name')&&$('d-name').focus(),50);
}

/* ---------- уведомления ---------- */
function vAlerts(){
  const st = mySettings(), bot = S.bot;
  return header('Бот<span>›</span>Уведомления', 'Уведомления', S.notifs.some(n=>!n.read)?'<button class="btn" data-act="readall">Прочитать всё</button>':'') + `
  <div class="grid alerts">
    <div class="chat" aria-label="Сообщения бота">
      <div class="chat-h"><span class="av" style="background:var(--navy)"><svg viewBox="0 0 24 24" width="17" height="17" fill="none"><circle cx="12" cy="12" r="4" fill="#FFD23F"/><ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="#fff" stroke-width="1.8"/></svg></span><div><b>Орбита бот</b><small>${bot?'@'+esc(bot):''} · ${st.tg!==false?'сообщения приходят в Telegram':'Telegram выключен — сообщения только здесь'}</small></div></div>
      ${S.notifs.length ? S.notifs.map(n=>`<div class="bubble ${n.read?'':'unread'}">${esc(n.text)}<time>${fmtDT(n.at)}</time></div>`).join('') : '<div class="empty">Сообщений пока нет</div>'}
    </div>
    <div class="grid" style="align-content:start">
      <section class="live" style="min-height:0"><span class="tag"><i></i>Telegram</span>
        <h3>${st.tg!==false?'Бот подключён':'Сообщения в Telegram выключены'}</h3><p style="margin-bottom:14px">${bot?`Сообщения приходят от <b>@${esc(bot)}</b>. В боте есть команды /tasks и /plan.`:'Бот ещё не настроен на сервере.'}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${st.tg!==false?`<button class="btn y sm" data-act="testmsg">Проверить связь</button><button class="btn sm" data-sw="tg" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2)">Выключить</button>`:`<button class="btn y sm" data-sw="tg">Включить</button>`}${bot?`<a class="btn sm" href="https://t.me/${esc(bot)}" target="_blank" rel="noopener" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2)">Открыть бота</a>`:''}</div></section>
      <div class="card"><div class="card-h"><div><h3>Что присылать</h3><p>Время по Ташкенту</p></div></div>
        <div class="set"><div>Утренняя сводка задач<small>просрочки, сроки сегодня и завтра</small></div><input type="time" id="s-morning" value="${esc(st.morning||'08:00')}"></div>
        <div class="set"><div>Вечерние итоги плана<small>что осталось невыполненным</small></div><input type="time" id="s-evening" value="${esc(st.evening||'21:00')}"></div>
        <div class="set"><div>Напоминание до срока<small>срок задачи — 18:00 в день срока</small></div><select id="s-before">${[['1','за 1 час'],['2','за 2 часа'],['24','за день']].map(([v,l])=>`<option value="${v}" ${String(st.before||'2')===v?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="set"><div>Новая задача от руководителя</div><button class="switch ${st.onAssign!==false?'on':''}" data-sw="onAssign" aria-label="Новая задача" aria-pressed="${st.onAssign!==false}"></button></div>
        <div class="set"><div>${isMgr()?'Сотрудник выполнил задачу, комментарии':'Изменения и комментарии по моим задачам'}</div><button class="switch ${st.onDone!==false?'on':''}" data-sw="onDone" aria-label="Выполнение" aria-pressed="${st.onDone!==false}"></button></div>
      </div>
      ${aiCard()}
      <div class="card"><div class="card-h"><div><h3>Профиль</h3><p>${esc(me().name)} · ${esc(S.company.name)}</p></div></div>
        <div class="field"><label>Оформление</label><div class="themesw" role="group" aria-label="Оформление"><button type="button" class="${document.documentElement.dataset.theme!=='light'?'on':''}" data-theme-set="dark">Тёмная</button><button type="button" class="${document.documentElement.dataset.theme==='light'?'on':''}" data-theme-set="light">Светлая</button></div></div>
        <div class="field"><label for="switchco2">Компания</label>${coSwitch('switchco2')}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="profile">Изменить имя${isOwner()?' и компанию':''}</button><button class="btn sm" data-act="logout">Выйти</button></div></div>
    </div>
  </div>`;
}



/* ---------- тарифы ---------- */
const B_ = () => (S && S.billing) || {};
const feat = f => !B_().features || B_().features[f] !== false;
const money = n => sum(n) + ' сум';
const payText = () => B_().pay ? `Оплата: ${esc(B_().pay)}` : 'Для оплаты напишите администратору «Орбиты».';
function lockView(f){
  const name = f==='plans' ? 'Мои планы' : 'Кошелёк';
  const what = f==='plans' ? 'личный план на день, привычки, напоминания в Telegram' : 'учёт личных расходов и доходов, дашборд за месяц, запись голосом через бота';
  return header(name, name, '') + `<div class="card lock"><div class="lock-ic">🔒</div><h3>«${name}» пока не подключён</h3>
    <p>${what}.</p><p>Подключает руководитель компании в разделе «Команда» — <b>${money(12000)}</b> в месяц за сотрудника.</p>
    <p class="note">Задачи, комментарии и уведомления работают как обычно.</p></div>`;
}
function billingCard(){
  const c = B_().company; if(!c) return '';
  const status = c.paid ? `<span class="chip s-done">Оплачено до ${fmt(c.paidUntil)}</span>` : c.inTrial ? `<span class="chip s-progress">Пробный период до ${fmt(c.trialUntil)}</span>` : `<span class="chip s-late">Не оплачено</span>`;
  return `<div class="card bill"><div class="card-h"><div><h3>Тариф и счёт</h3><p>Руководство — бесплатно. Платите только за работников и подключённые разделы.</p></div>${status}</div>
    <div class="bill-grid">
      <div class="bill-lines">${c.lines.length ? c.lines.map(l=>`<div><span>${esc(l.name)} × ${l.n}</span><span class="num">${money(l.total)}</span></div>`).join('') : '<div class="note">Работников пока нет — счёт 0 сум. Пригласите сотрудников, чтобы ставить им задачи.</div>'}
        <div class="bill-total"><span>Итого в месяц</span><b class="num">${money(c.sum)}</b></div></div>
      <div class="bill-info"><div>👤 Работник — <b>${money(12000)}</b> в месяц: задачи, бот, ИИ-помощник (20 мин голоса), «Мои планы», «Кошелёк»</div><div>🎁 С 26-го по 100-й работник — <b>бесплатно</b></div><div>➕ С 101-го — <b>${money(6000)}</b></div>
        <div class="note">${c.inTrial ? 'В пробный период всё включено для всех. ' : ''}${!c.active ? 'Пока счёт не оплачен, у работников отключён ИИ-помощник — всё остальное работает. ' : ''}</div>
        ${c.sum ? `<div class="paybar"><select id="pay-months" aria-label="Срок оплаты">${[[1,'1 месяц'],[3,'3 месяца'],[6,'6 месяцев'],[12,'12 месяцев']].map(([v,l])=>`<option value="${v}">${l} — ${money(c.sum*v)}</option>`).join('')}</select><button class="btn primary sm" data-pay="company">Оплатить по QR</button></div>` : ''}</div>
    </div></div>`;
}
function aiCard(){
  const a = B_().ai; if(!a) return '';
  const SRC = {trial:'Пробный месяц', solo:'ИИ-помощник оплачен', lead:'Входит в тариф компании', worker:'Входит в тариф компании'};
  const pm = a.limitMin ? Math.min(100, a.usedMin/a.limitMin*100) : 0, pq = a.limitMsgs ? Math.min(100, a.usedMsgs/a.limitMsgs*100) : 0;
  const sub = a.on ? (a.src==='trial' ? (a.trialStarted ? `до ${fmt(a.trialEnds)}` : 'начнётся с первого голосового') : a.src==='solo' ? `до ${fmt(a.paidUntil)}` : esc(a.company||'')) : 'выключен';
  return `<div class="card"><div class="card-h"><div><h3>🤖 ИИ-помощник</h3><p>${a.on ? SRC[a.src] : 'Не активен'} · ${sub}</p></div>${a.on?'<span class="chip s-done">Включён</span>':'<span class="chip s-new">Выключен</span>'}</div>
    ${a.on ? `<div class="aiu"><div><span>Голосовые</span><span class="num">${String(a.usedMin).replace('.',',')} из ${a.limitMin} мин</span></div><div class="bar"><i style="width:${pm}%;background:${pm>90?'var(--bad)':'var(--blue)'}"></i></div>
      <div><span>Сообщения ИИ</span><span class="num">${a.usedMsgs} из ${a.limitMsgs}</span></div><div class="bar"><i style="width:${pq}%;background:${pq>90?'var(--bad)':'var(--blue)'}"></i></div></div>
      <p class="note" style="margin-top:8px">Лимит обновляется 1-го числа.${a.canPay&&a.src==='trial'?` После пробного месяца — ${money(a.price.solo)} в месяц.`:''}</p>
      ${!a.canPay?'':`<div class="paybar">${a.src==='trial'||a.src==='solo'?`<button class="btn sm primary" data-pay="ai">${a.src==='solo'?'Продлить':'Оплатить'} ИИ — ${money(a.price.solo)}</button>`:''}<button class="btn sm" data-pay="pack">+${a.price.packMin} мин — ${money(a.price.pack)}</button></div>`}`
    : !a.canPay ? `<p style="margin:0 0 6px">Голосом: «Мадине до завтра подготовить отчёт», «потратил 50 тысяч на такси».</p><p class="note">ИИ-помощник входит в тариф компании и включится, когда руководство его продлит. Обратитесь к руководителю.</p>`
    : `<p style="margin:0 0 6px">Голосом: «Мадине до завтра подготовить отчёт», «потратил 50 тысяч на такси».</p><p class="note">${a.trialStarted?'Пробный месяц закончился. ':''}ИИ-помощник — <b>${money(a.price.solo)}</b> в месяц (60 мин голоса, 500 сообщений). В команде ИИ входит в тариф компании.</p><div class="paybar"><button class="btn sm primary" data-pay="ai">Оплатить по QR — ${money(a.price.solo)}</button></div>`}
  </div>`;
}
/* ---------- онлайн-оплата по QR ---------- */
let PAYT = null;
async function openPay(kind){
  let inv;
  try { inv = await api('POST','/api/pay/invoice',{kind, months: kind==='company' ? Number(($('pay-months')||{}).value||1) : 1}); } catch(e){ return toast(e.message); }
  const ps = [['payme','Payme','#33CCCC'],['click','Click','#0F8BFF']].filter(([k])=>inv.links[k]);
  const qr = k => `<div class="payqr" data-pq="${k}" ${k!==ps[0][0]?'hidden':''}><img src="/api/pay/qr?u=${encodeURIComponent(inv.links[k])}" alt="QR-код для оплаты через ${k==='payme'?'Payme':'Click'}" width="220" height="220"><p class="note">Отсканируйте камерой телефона или приложением ${k==='payme'?'Payme':'Click'}</p><a class="btn primary" href="${esc(inv.links[k])}" target="_blank" rel="noopener">Открыть ${k==='payme'?'Payme':'Click'}</a></div>`;
  modal(`<div class="modal" role="dialog" aria-label="Оплата">
    <h2>Оплата</h2>
    <div class="payhead"><div><b>${esc(inv.name)}</b><small>${inv.kind==='pack'?'на этот месяц':inv.months+' мес.'} · счёт №${inv.id}</small></div><b class="num">${money(inv.amount)}</b></div>
    ${ps.length ? `<div class="tabs paytabs">${ps.map(([k,l],i)=>`<button type="button" class="${i?'':'on'}" data-pt="${k}">${l}</button>`).join('')}</div>${ps.map(([k])=>qr(k)).join('')}
      <p class="note paywait" id="pay-wait">⏳ Ждём подтверждение оплаты… Тариф продлится автоматически.</p>`
    : `<p>Онлайн-оплата ещё подключается.</p><p class="note">${B_().pay ? 'Оплатить можно сейчас: '+esc(B_().pay) : 'Напишите администратору «Орбиты» — после оплаты тариф продлят вручную.'}</p>`}
    <div class="mact"><button type="button" class="btn" data-close="1">Закрыть</button></div></div>`);
  clearInterval(PAYT);
  if(ps.length) PAYT = setInterval(async()=>{
    if(!document.querySelector('.payqr')) return clearInterval(PAYT);
    try { const r = await api('GET','/api/pay/invoice/'+inv.id); if(r.status==='paid'){ clearInterval(PAYT); closeModal(); toast('✅ Оплата получена — спасибо!'); await reload(); render(); } } catch(e){}
  }, 3000);
}

/* ---------- админка платформы ---------- */
let ADM = null, ADQ = '', ADF = [];
async function loadAdmin(){ try { ADM = await api('GET','/api/admin/overview'); } catch(e){ ADM = {error:e.message}; } if(current()==='admin') render(); }
function vAdmin(){
  if(!ADM) return header('Админка','Админка','') + '<div class="card empty">Загружаю…</div>';
  if(ADM.error) return header('Админка','Админка','') + `<div class="card empty">${esc(ADM.error)}</div>`;
  const total = ADM.companies.filter(c=>c.paid).reduce((a,c)=>a+c.sum,0);
  return header('Админка','Админка', '<button class="btn" data-act="adm-reload">Обновить</button>') + `
  <div class="grid kpis">
    <div class="card kpi hero"><div class="lab"><span class="ic">${ICON.admin}</span>Компаний</div><div class="row"><div><div class="v num">${ADM.companies.length}</div><div class="sub">${ADM.companies.filter(c=>c.paid).length} оплачено · ${ADM.companies.filter(c=>c.inTrial).length} на пробном</div></div></div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.done}</span>Работников в счетах</div><div class="row"><div><div class="v num">${ADM.companies.reduce((a,c)=>a+c.workers,0)}</div><div class="sub">единица = ${money(ADM.price.unit)}</div></div></div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.wallet}</span>Оплаченные счета / мес</div><div class="row"><div><div class="v num">${sumC(total)}</div><div class="sub">сум, компании</div></div></div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.flame}</span>ИИ у одиночек</div><div class="row"><div><div class="v num">${ADM.users.filter(u=>u.src==='solo').length}</div><div class="sub">оплачено · ${ADM.users.filter(u=>u.src==='trial').length} на пробном</div></div></div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-h"><div><h3>Компании</h3><p>Отметьте оплату после получения денег — срок продлится от текущей даты окончания</p></div></div>
    <div class="tblw"><table class="tbl"><thead><tr><th>Компания</th><th>Владелец</th><th class="n">Работников</th><th class="n">Счёт / мес</th><th>Статус</th><th></th></tr></thead><tbody>
    ${ADM.companies.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.owner||'—')}${c.ownerUsername?` <a href="https://t.me/${esc(c.ownerUsername)}" target="_blank" rel="noopener">@${esc(c.ownerUsername)}</a>`:''}</td><td class="n num">${c.workers}</td><td class="n num"><b>${sum(c.sum)}</b></td>
      <td>${c.paid?`<span class="chip s-done">до ${fmt(c.paidUntil)}</span>`:c.inTrial?`<span class="chip s-progress">пробный до ${fmt(c.trialUntil)}</span>`:'<span class="chip s-late">не оплачено</span>'}</td>
      <td><button class="btn sm" data-admpay="company|${c.id}|1">+1 мес</button> <button class="btn sm" data-admpay="company|${c.id}|12">+год</button></td></tr>`).join('') || '<tr><td colspan="6" class="note">Компаний пока нет</td></tr>'}</tbody></table></div></div>
  <div class="grid low-grid">
    <div class="card"><div class="card-h"><div><h3>ИИ-помощник у пользователей</h3><p>${money(ADM.price.solo)} / мес · пакет +60 мин — ${money(ADM.price.pack)}</p></div></div>
      <form class="add" id="adm-find" style="margin-bottom:10px"><input id="adm-q" value="${esc(ADQ)}" placeholder="Найти по имени или @username" autocomplete="off"><button class="btn" type="submit">Найти</button></form>
      ${ADF.length?`<div class="note" style="margin-bottom:6px">Найдено:</div>${ADF.map(u=>`<div class="wrow" style="cursor:default"><div style="flex:1;min-width:0"><b>${esc(u.name)}</b><small>${u.username?'@'+esc(u.username):''} ${u.ai_paid_until?'· оплачено до '+fmt(u.ai_paid_until):''}</small></div><button class="btn sm" data-admpay="ai|${u.id}|1">ИИ +1 мес</button></div>`).join('')}`:''}
      <div class="tblw"><table class="tbl"><thead><tr><th>Пользователь</th><th>Доступ</th><th class="n">Голос</th><th class="n">Сообщ.</th><th></th></tr></thead><tbody>
      ${ADM.users.map(u=>`<tr><td><b>${esc(u.name)}</b>${u.username?`<br><small class="note">@${esc(u.username)}</small>`:''}</td><td>${u.src==='solo'?`оплачено до ${fmt(u.paidUntil)}`:u.src==='trial'?`пробный до ${fmt(u.trialEnds)}`:u.src?'через компанию':'<span style="color:var(--bad)">нет</span>'}</td>
        <td class="n num">${String(u.usedMin).replace('.',',')}/${u.limitMin}</td><td class="n num">${u.usedMsgs}/${u.limitMsgs}</td><td style="white-space:nowrap"><button class="btn sm" data-admpay="ai|${u.id}|1">+1 мес</button> <button class="btn sm" data-admpay="pack|${u.id}|1">+60 мин</button></td></tr>`).join('') || '<tr><td colspan="5" class="note">Пока никто не пользовался ИИ</td></tr>'}</tbody></table></div></div>
    <div class="card"><div class="card-h"><div><h3>Последние оплаты</h3><p>Журнал отметок</p></div></div>
      ${ADM.payments.length?ADM.payments.map(p=>`<div class="wrow" style="cursor:default"><div style="flex:1;min-width:0"><b>${esc(p.company||p.user||'—')}</b><small>${p.kind==='company'?'Тариф компании':p.kind==='ai'?'ИИ-помощник':'Пакет +60 мин'}${p.months?' · '+p.months+' мес':''} · ${fmtDT(String(p.at).slice(0,16))}</small></div><b class="num">${sum(p.amount)}</b></div>`).join(''):'<div class="empty">Оплат пока нет</div>'}</div>
  </div>`;
}

/* ---------- кошелёк ---------- */
let WAL = null, WM = null, WK = 'expense', WCAT = '', WBUD = null;
const CAT_COLORS = ['#2F55E4','#FF8A4C','#1F9D74','#FFC629','#C77DFF','#E0483D','#52C7EA','#8E6CEF','#F08A82','#3FD3A8','#B4A02A','#FF6B9A','#6F8BFF','#9AA3C7'];
const sum = n => Math.round(Number(n)||0).toLocaleString('ru-RU').replace(/ /g,' ');
const sumC = n => { n = Math.round(Number(n)||0); const a = Math.abs(n); return a>=1e9 ? (n/1e9).toFixed(1).replace('.',',')+' млрд' : a>=1e6 ? (n/1e6).toFixed(a>=1e7?0:1).replace('.',',')+' млн' : a>=1e4 ? Math.round(n/1e3)+' тыс' : sum(n); };
const MONN_GEN = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const mLabel = m => { const [y,mo] = m.split('-').map(Number); return MONN[mo-1]+' '+y; };
const mShift = (m,k) => { let [y,mo] = m.split('-').map(Number); mo += k; while(mo<1){mo+=12;y--;} while(mo>12){mo-=12;y++;} return y+'-'+String(mo).padStart(2,'0'); };
const daysIn = m => { const [y,mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
async function loadWallet(){ WM = WM || TODAY.slice(0,7); try { WAL = await api('GET','/api/wallet?month='+WM); } catch(e){ toast(e.message); return; } if(current()==='wallet') render(); }
function catIcon(name, kind){ const c = WAL && (WAL.cats[kind||'expense'].find(x=>x.name===name) || WAL.cats.income.find(x=>x.name===name) || WAL.cats.expense.find(x=>x.name===name)); return c ? c.icon : '📦'; }
function catColor(name){ const i = WAL ? WAL.cats.expense.findIndex(x=>x.name===name) : -1; return CAT_COLORS[(i<0?13:i) % CAT_COLORS.length]; }
function donut(parts, total){
  const R=70, C=2*Math.PI*R; let off=0;
  const segs = parts.map(p=>{ const len = total? C*p.v/total : 0; const el = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${p.c}" stroke-width="22" stroke-dasharray="${Math.max(0,len-2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(p.n)}: ${sum(p.v)} сум</title></circle>`; off += len; return el; }).join('');
  return `<svg viewBox="0 0 180 180" class="donut" aria-hidden="true"><circle cx="90" cy="90" r="${R}" fill="none" stroke="${CV('soft')}" stroke-width="22"/>${segs}<text x="90" y="84" text-anchor="middle" class="d-l">расходы</text><text x="90" y="106" text-anchor="middle" class="d-v">${esc(sumC(total))}</text></svg>`;
}
function dailyBars(m, byDay){
  const N = daysIn(m), vals = Array.from({length:N},(_,i)=>byDay[i+1]||0), mx = Math.max(...vals,1);
  const W=innerWidth<700?380:700,H=innerWidth<700?150:170,pl=44,pb=22,bw=(W-pl-6)/N;
  const isCur = m===TODAY.slice(0,7), td = Number(TODAY.slice(8,10));
  const passed = isCur ? td : N, avg = vals.slice(0,passed).reduce((a,b)=>a+b,0)/Math.max(1,passed);
  const y = v => H-pb-(v/mx)*(H-pb-12);
  const ticks = [0, mx/2, mx];
  return `<svg viewBox="0 0 ${W} ${H}" class="bars" aria-hidden="true">
    ${ticks.map(t=>`<line x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="${CV('soft')}"/><text x="${pl-6}" y="${y(t)+4}" text-anchor="end" class="ax">${esc(sumC(t))}</text>`).join('')}
    ${vals.map((v,i)=>{ const x=pl+i*bw+bw*.15, h=H-pb-y(v); const cls = isCur && i+1===td ? '#FFC629' : (isCur && i+1>td ? CV('line') : CV('blue')); return `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw*.7).toFixed(1)}" height="${Math.max(0,h).toFixed(1)}" rx="3" fill="${cls}"><title>${i+1}: ${sum(v)} сум</title></rect>${(i+1)%5===0||i===0?`<text x="${(x+bw*.35).toFixed(1)}" y="${H-6}" text-anchor="middle" class="ax">${i+1}</text>`:''}`; }).join('')}
    ${avg>0?`<line x1="${pl}" x2="${W}" y1="${y(avg)}" y2="${y(avg)}" stroke="#E0483D" stroke-dasharray="5 4"/><text x="${W-4}" y="${y(avg)-5}" text-anchor="end" class="ax" fill="#E0483D">в среднем ${esc(sumC(avg))}/день</text>`:''}
  </svg>`;
}
function trend(hist, m){
  const months = Array.from({length:6},(_,i)=>mShift(m,i-5));
  const get = (mm,k) => (hist.find(h=>h.m===mm&&h.kind===k)||{s:0}).s;
  const mx = Math.max(1,...months.flatMap(mm=>[get(mm,'expense'),get(mm,'income')]));
  return `<div class="trend">${months.map(mm=>{ const e=get(mm,'expense'), inc=get(mm,'income'); return `<div class="tcol ${mm===m?'cur':''}"><div class="tbars"><i style="height:${(inc/mx*100).toFixed(1)}%" class="ti" title="Доходы ${sum(inc)}"></i><i style="height:${(e/mx*100).toFixed(1)}%" class="te" title="Расходы ${sum(e)}"></i></div><small>${MONN[Number(mm.slice(5))-1].slice(0,3)}</small></div>`; }).join('')}</div>
  <div class="legend" style="justify-content:flex-start"><i style="background:#1F9D74"></i> доходы <i style="background:#2F55E4;margin-left:10px"></i> расходы</div>`;
}
function vWallet(){
  if(!feat('wallet')) return lockView('wallet');
  WM = WM || TODAY.slice(0,7);
  const nav = `<div class="daynav"><button data-act="wm-" aria-label="Предыдущий месяц">‹</button><span style="min-width:120px">${mLabel(WM)}</span><button data-act="wm+" aria-label="Следующий месяц">›</button></div>`;
  if(!WAL || WAL.month!==WM) return header('Кошелёк', 'Мой кошелёк', nav) + `<div class="card empty">Загружаю…</div>`;
  const tx = WAL.tx, ex = tx.filter(t=>t.kind==='expense'), inc = tx.filter(t=>t.kind==='income');
  const E = ex.reduce((a,t)=>a+t.amount,0), I = inc.reduce((a,t)=>a+t.amount,0);
  const isCur = WM===TODAY.slice(0,7), passed = isCur ? Number(TODAY.slice(8,10)) : daysIn(WM);
  const pe = WAL.prev.expense, dE = pe ? Math.round((E-pe)/pe*100) : null;
  const byCat = {}; ex.forEach(t=>byCat[t.category]=(byCat[t.category]||0)+t.amount);
  const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const byDay = {}; ex.forEach(t=>{ const d=Number(t.day.slice(8,10)); byDay[d]=(byDay[d]||0)+t.amount; });
  const parts = cats.map(([n,v])=>({n,v,c:catColor(n)}));
  const budCats = WAL.cats.expense.filter(c=>byCat[c.name] || (c.name in WAL.budgets));
  const totalBudget = Object.values(WAL.budgets).reduce((a,b)=>a+b,0);
  const groups = {}; tx.forEach(t=>(groups[t.day] ||= []).push(t));
  const kindCats = WAL.cats[WK];
  return header('Кошелёк', 'Мой кошелёк', nav) + `
  <div class="grid kpis">
    <div class="card kpi hero"><div class="lab"><span class="ic">${ICON.wallet}</span>Расходы за месяц${dE!=null?`<span class="delta">${dE>0?'↗ +':'↘ '}${dE}% к прошлому</span>`:''}</div><div class="row"><div><div class="v num">${esc(sumC(E))}</div><div class="sub">${sum(E)} сум${totalBudget?` · бюджет ${sumC(totalBudget)}`:''}</div></div></div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.done}</span>Доходы</div><div class="row"><div><div class="v num" style="color:var(--ok)">${esc(sumC(I))}</div><div class="sub">${inc.length} поступл.</div></div></div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.target}</span>Остаток</div><div class="row"><div><div class="v num ${I-E<0?'bad':''}">${esc(sumC(I-E))}</div><div class="sub">доходы минус расходы</div></div></div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.flame}</span>В среднем в день</div><div class="row"><div><div class="v num">${esc(sumC(E/Math.max(1,passed)))}</div><div class="sub">${isCur?`прогноз на месяц ≈ ${sumC(E/Math.max(1,passed)*daysIn(WM))}`:`за ${passed} дн.`}</div></div></div></div>
  </div>
  <div class="grid w-grid">
    <form class="card" id="wallet-form">
      <div class="card-h"><div><h3>Записать</h3><p>${WAL.bot?`Или напишите боту <b>@${esc(WAL.bot)}</b>: «45000 такси»`:'Сумма, категория, заметка'}</p></div>
        <div class="tabs"><button type="button" class="${WK==='expense'?'on':''}" data-wk="expense">Расход</button><button type="button" class="${WK==='income'?'on':''}" data-wk="income">Доход</button></div></div>
      <div class="field"><label for="w-amount">Сумма, сум</label><input id="w-amount" class="w-amount num" inputmode="numeric" autocomplete="off" placeholder="0" required></div>
      <div class="field"><label>Категория</label><div class="wcats">${kindCats.map(c=>`<button type="button" class="wcat ${WCAT===c.name?'on':''}" data-wcat="${esc(c.name)}"><span>${c.icon}</span>${esc(c.name)}</button>`).join('')}</div></div>
      <div class="frow"><div class="field"><label for="w-day">Дата</label><input type="date" id="w-day" value="${isCur?TODAY:WM+'-01'}"></div>
      <div class="field"><label for="w-note">Заметка</label><input id="w-note" placeholder="На что потратили" autocomplete="off"></div></div>
      <button class="btn primary" type="submit" style="width:100%;justify-content:center;padding:12px">${WK==='income'?'Записать доход':'Записать расход'}</button>
    </form>
    <div class="card"><div class="card-h"><div><h3>Куда уходят деньги</h3><p>${mLabel(WM)}</p></div></div>
      ${cats.length?`<div class="donut-wrap">${donut(parts,E)}<div class="dleg">${parts.slice(0,8).map(p=>`<div><i style="background:${p.c}"></i><span>${catIcon(p.n)} ${esc(p.n)}</span><b class="num">${Math.round(p.v/E*100)}%</b></div>`).join('')}${parts.length>8?`<div class="note">и ещё ${parts.length-8}</div>`:''}</div></div>`:'<div class="empty">Расходов за этот месяц пока нет. Запишите первый слева или напишите боту.</div>'}
    </div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-h"><div><h3>Расходы по дням</h3><p>Жёлтым — сегодня, пунктир — средний расход в день</p></div><div style="text-align:right"><div class="note">6 месяцев</div></div></div>
    <div class="w-bars">${dailyBars(WM, byDay)}<div>${trend(WAL.history, WM)}</div></div></div>
  <div class="grid low-grid">
    <div class="card"><div class="card-h"><div><h3>Категории и бюджет</h3><p>Нажмите «лимит», чтобы задать бюджет на месяц</p></div></div>
      ${budCats.length?`<table class="tbl"><thead><tr><th>Категория</th><th class="n">Потрачено</th><th class="n hide-s">К прошлому</th><th>Бюджет</th></tr></thead><tbody>${budCats.sort((a,b)=>(byCat[b.name]||0)-(byCat[a.name]||0)).map(c=>{ const v=byCat[c.name]||0, b=WAL.budgets[c.name], pv=WAL.prevCats[c.name]||0, d = pv? Math.round((v-pv)/pv*100) : null, pct = b? Math.min(100, v/b*100) : 0;
        return `<tr><td><span class="wc-ic" style="background:${catColor(c.name)}22">${c.icon}</span> ${esc(c.name)}</td><td class="n num">${sum(v)}</td><td class="n num hide-s" style="color:${d==null?'var(--muted)':d>0?'var(--bad)':'var(--ok)'}">${d==null?'—':(d>0?'+':'')+d+'%'}</td>
          <td>${WBUD===c.name?`<form class="add" id="bud-form" data-cat="${esc(c.name)}" style="margin:0"><input id="bud-amount" inputmode="numeric" value="${b||''}" placeholder="Сумма" style="padding:6px 8px"><button class="btn sm primary">OK</button></form>`
            : b?`<div class="budbar" data-bud="${esc(c.name)}" role="button" tabindex="0" title="Изменить лимит"><div class="bar" style="flex:1"><i style="width:${pct}%;background:${v>b?'var(--bad)':pct>80?'var(--warn)':'var(--ok)'}"></i></div><small class="num">${Math.round(v/b*100)}% из ${sumC(b)}</small></div>`
            : `<button class="linkbtn" data-bud="${esc(c.name)}">лимит</button>`}</td></tr>`; }).join('')}</tbody></table>`:'<div class="empty">Здесь появятся категории ваших расходов</div>'}
      <div style="margin-top:10px"><select id="bud-add" aria-label="Добавить бюджет для категории"><option value="">+ Бюджет для категории…</option>${WAL.cats.expense.filter(c=>!budCats.includes(c)).map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></div>
    </div>
    <div class="card"><div class="card-h"><div><h3>Записи</h3><p>${tx.length} за месяц · нажмите, чтобы изменить</p></div></div>
      <div class="wlist">${Object.keys(groups).length?Object.entries(groups).map(([d,arr])=>`<div class="group-h" style="color:var(--muted)">${d===TODAY?'Сегодня':d===addDays(TODAY,-1)?'Вчера':fmt(d)} <span class="num">${sumC(arr.filter(t=>t.kind==='expense').reduce((a,t)=>a+t.amount,0))}</span></div>${arr.map(t=>`<div class="wrow" data-wedit="${t.id}" role="button" tabindex="0"><span class="wc-ic" style="background:${t.kind==='income'?'#1F9D7422':catColor(t.category)+'22'}">${catIcon(t.category,t.kind)}</span><div style="min-width:0;flex:1"><b>${esc(t.category)}</b>${t.note?`<small>${esc(t.note)}</small>`:''}</div><b class="num" style="color:${t.kind==='income'?'var(--ok)':'var(--ink)'}">${t.kind==='income'?'+':'−'}${sum(t.amount)}</b></div>`).join('')}`).join(''):'<div class="empty">Записей пока нет</div>'}</div>
    </div>
  </div>`;
}
function openWalletEdit(id){
  const t = WAL.tx.find(x=>x.id===id); if(!t) return;
  const cats = WAL.cats[t.kind];
  modal(`<form class="modal" id="wedit-form" data-id="${id}" role="dialog" aria-label="Запись">
    <h2>${t.kind==='income'?'Доход':'Расход'}</h2>
    <input type="hidden" id="we-kind" value="${t.kind}">
    <div class="field"><label for="we-amount">Сумма, сум</label><input id="we-amount" class="w-amount num" inputmode="numeric" value="${sum(t.amount)}" required></div>
    <div class="frow"><div class="field"><label for="we-cat">Категория</label><select id="we-cat">${cats.map(c=>`<option ${c.name===t.category?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="we-day">Дата</label><input type="date" id="we-day" value="${t.day}"></div></div>
    <div class="field"><label for="we-note">Заметка</label><input id="we-note" value="${esc(t.note||'')}"></div>
    <div class="mact" style="justify-content:space-between"><button type="button" class="btn" data-wdel="${id}" style="color:var(--bad)">Удалить</button><span style="display:flex;gap:6px"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Сохранить</button></span></div>
  </form>`);
}

/* ---------- окна ---------- */
const modal = html => { $('modal').innerHTML = `<div class="ov" data-close="1">${html}</div>`; };
function closeModal(){ $('modal').innerHTML=''; if(SYNC_PENDING) setTimeout(liveRefresh, 50); }
function openNew(forUser){
  const mgr = isMgr(), pool = mgr ? scope() : [me()];
  const opts = pool.map(u=>`<option value="${u.id}" ${String(u.id)===String(forUser||(mgr?'':S.me))?'selected':''}>${esc(u.name)}${u.title?' — '+esc(u.title):''}</option>`).join('');
  modal(`<form class="modal" id="new-task" role="dialog" aria-label="Новая задача">
    <h2>${mgr?'Поставить задачу':'Личная задача'}</h2>
    ${mgr && pool.length<=1 ? `<div class="demo-note card" style="margin-bottom:14px">В команде пока только вы, поэтому исполнителем можно выбрать только себя. ${isOwner()?'<button type="button" class="btn sm" data-act="demo-add-close">Добавить демо-сотрудников</button> ':''}<button type="button" class="btn sm" data-act="invite">Пригласить сотрудника</button></div>` : ''}
    <div class="field"><label for="n-title">Что нужно сделать</label><input id="n-title" required placeholder="Что нужно сделать" autocomplete="off"></div>
    <div class="field"><label for="n-desc">Подробности</label><textarea id="n-desc" placeholder="Необязательно"></textarea></div>
    <div class="frow"><div class="field"><label for="n-who">Исполнитель</label><select id="n-who" required>${mgr&&!forUser?'<option value="" disabled selected>Выберите</option>':''}${opts}</select></div>
    <div class="field"><label for="n-prio">Приоритет</label><select id="n-prio"><option value="high">Высокий</option><option value="medium" selected>Средний</option><option value="low">Низкий</option></select></div></div>
    <div class="frow"><div class="field"><label for="n-due" id="n-due-l">Срок</label><input type="date" id="n-due" value="${addDays(TODAY,1)}" required></div>
    <div class="field"><label for="n-due-time">До какого времени</label><input type="time" id="n-due-time"><small class="note">Пусто — до конца дня</small></div></div>
    <div class="frow"><div class="field"><label for="n-rep">Повторять</label><select id="n-rep"><option value="">Не повторять</option><option value="daily">Каждый день</option><option value="weekdays">По будням (Пн–Пт)</option><option value="days">По дням недели</option><option value="monthly">Каждый месяц (в число срока)</option></select></div>
    <div class="field"><label for="n-rem">Напомнить в Telegram</label><input type="datetime-local" id="n-rem"></div></div>
    <div class="field" id="n-days-f" hidden><label>Дни недели</label><div class="wdchips">${WD_ORDER.map(d=>`<label class="wdc"><input type="checkbox" name="n-wd" value="${d}" ${d>=1&&d<=5?'checked':''}><span>${WD[d]}</span></label>`).join('')}</div></div>
    <div class="field"><label for="n-check">Чек-лист <span class="note">(необязательно, каждый пункт с новой строки)</span></label><textarea id="n-check" rows="3" placeholder="Открыть кассу&#10;Проверить остатки&#10;Отправить отчёт"></textarea></div>
    <div class="opts"><label class="opt"><input type="checkbox" id="n-photo"><span>📎 Нужен отчёт о выполнении (фото или файл)</span></label></div>
    <div class="mact"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">${mgr?'Поставить и уведомить':'Добавить'}</button></div>
  </form>`);
  setTimeout(()=>$('n-title').focus(),30);
}
function openTask(id){
  const t = S.tasks.find(x=>x.id===id); if(!t) return;
  const a = U(t.assignee), au = U(t.author), canStatus = t.assignee===S.me || isMgr() || t.author===S.me;
  modal(`<div class="modal" role="dialog" aria-label="Задача">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><h2 style="margin:0 0 6px">${esc(t.title)}</h2>${statusChip(t)}</div>
    ${t.desc?`<p style="margin:0 0 12px;color:var(--muted);white-space:pre-line">${esc(t.desc)}</p>`:''}
    <dl class="dl"><dt>Исполнитель</dt><dd>${esc(a.name)}${a.title?' · '+esc(a.title):''}</dd><dt>Поставил</dt><dd>${esc(au.name)}</dd><dt>Срок</dt><dd${late(t)?' style="color:var(--bad);font-weight:700"':''}>${dueText(t)}${t.ext?` <span class="note">· продлевали ${t.ext} раз</span>`:''}</dd><dt>Приоритет</dt><dd class="p-${t.priority}">${PRIO[t.priority]}</dd>${t.remind?`<dt>Напомнить в</dt><dd>${fmtDT(t.remind)}</dd>`:''}</dl>
    ${t.series?`<div class="serbox">🔁 Повторяется: <b>${esc(REPEAT_RU[t.series.repeat]||'')}</b>${t.series.active?'':' · остановлено'}${t.series.active&&(t.author===S.me||isOwner())?` <button type="button" class="linkbtn" data-stopser="${t.series.id}">Остановить повтор</button>`:''}</div>`:''}
    ${t.photo?`<div class="serbox">📎 Нужен отчёт — фото или файл. Задача закроется, когда исполнитель его приложит.</div>`:''}
    ${t.checklist.length?`<div class="field"><label>Чек-лист · ${t.checklist.filter(c=>c.d).length} из ${t.checklist.length}</label></div><div class="cklist">${t.checklist.map((c,i)=>`<label class="ck ${c.d?'on':''}"><input type="checkbox" data-ck="${t.id}|${i}" ${c.d?'checked':''} ${canStatus?'':'disabled'}><span>${esc(c.t)}</span></label>`).join('')}</div>`:''}
    ${t.assignee===S.me&&t.author!==S.me&&t.status!=='done'?`<div style="margin:0 0 10px"><button type="button" class="btn sm" data-more="${t.id}">⏳ Нужно больше времени</button></div>`:''}
    ${t.status!=='done'&&(t.assignee===S.me||t.author===S.me)?`<div class="serbox remrow"><span>${t.remindOff?'🔕 Напоминания выключены':t.snoozeUntil?`⏰ Напомню ${t.snoozeUntil.slice(0,10)===TODAY?'сегодня':fmt(t.snoozeUntil)} в ${t.snoozeUntil.slice(11,16)}`:'🔔 Напоминание перед сроком включено'}${t.seenAt?` · 👀 видел(а) ${t.seenAt.slice(0,10)===TODAY?'':fmt(t.seenAt)+' '}${t.seenAt.slice(11,16)}`:''}</span>
      <span class="remacts">${[['15','+15 мин'],['60','+1 час'],['tm','Завтра 9:00']].map(([v,l])=>`<button type="button" class="btn sm" data-snz="${t.id}|${v}">${l}</button>`).join('')}<button type="button" class="btn sm" data-roff="${t.id}|${t.remindOff?0:1}">${t.remindOff?'🔔 Включить':'🔕 Выключить'}</button></span></div>`:''}
    ${canExtend(t)?`<div class="extbox ${late(t)?'late':''}"><div class="field" style="margin:0 0 8px"><label>${late(t)?'Срок истёк — добавить время':'Продлить срок'}</label></div>
      <div class="extrow">${[['2h','+2 часа'],['1d','+1 день'],['3d','+3 дня'],['7d','+неделя']].map(([c,l])=>`<button type="button" class="btn sm" data-ext="${t.id}|${c}">${l}</button>`).join('')}</div>
      <form class="extrow" id="ext-form" data-id="${t.id}" style="margin-top:8px"><input type="date" id="ext-due" value="${t.due>=TODAY?addDays(t.due,1):addDays(TODAY,1)}" min="${TODAY}" aria-label="Новая дата"><input type="time" id="ext-time" value="${t.dueTime||''}" aria-label="Время (необязательно)"><button class="btn sm primary" type="submit">Назначить срок</button></form></div>`:''}
    ${canStatus?`<div class="field"><label>Статус</label></div><div class="stat-row">${Object.keys(STATUS).map(s=>`<button type="button" class="${t.status===s?'sel':''}" data-status="${t.id}|${s}">${STATUS[s]}</button>`).join('')}</div>`:''}
    <div class="field"><label>Комментарии</label></div>
    ${t.comments.map(c=>`<div class="cm"><b>${esc(U(c.u).name)}</b><time>${fmtDT(c.at)}</time>${c.a && c.t.replace(/^📎\s*/,'')===c.a.name ? '' : `<div>${esc(c.a ? c.t.replace(/^📎\s*/,'').replace(c.a.name+' — ','') : c.t)}</div>`}${c.f?`<a href="/api/comments/${c.id}/file" target="_blank" rel="noopener"><img class="cm-img" src="/api/comments/${c.id}/file" alt="Фото к задаче" loading="lazy"></a>`:''}${c.a?attachView(c.a):''}</div>`).join('') || '<div class="note" style="margin-bottom:8px">Пока нет комментариев</div>'}
    <div class="attbar"><label class="btn sm" for="att-input">📎 Прикрепить файл</label><input type="file" id="att-input" data-task="${t.id}" multiple hidden><span class="note">до 20 МБ: документ, таблица, PDF, фото, видео${t.status!=='done'&&t.assignee===S.me?' · можно сдать задачу с файлом':''}</span></div>
    <form class="add" id="add-cm" data-id="${t.id}"><input id="cm-text" placeholder="Написать комментарий" aria-label="Комментарий" autocomplete="off"><button class="btn" type="submit">Отправить</button></form>
    <div class="mact">${t.author===S.me||isOwner()?`<button type="button" class="btn" data-delete="${t.id}" style="color:var(--bad)">Удалить задачу</button>`:''}<button type="button" class="btn" data-close="1">Закрыть</button></div>
  </div>`);
}
const REPEAT = [['','Не повторять'],['daily','Каждый день'],['weekdays','По будням (Пн–Пт)'],['weekly','Раз в неделю'],['days','По выбранным дням']];
const REPEAT_SHORT = {daily:'каждый день', weekdays:'по будням', weekly:'раз в неделю', days:'по дням недели'};
const WD_ORDER = [1,2,3,4,5,6,0];
const hScheduled = (h,d) => { if(h.start && d < h.start) return false; if(h.until && d > h.until) return false; return (h.wdays||'0123456').includes(String(new Date(d+'T12:00:00').getDay())); };
const hSchedText = h => { const w = h.wdays||'0123456'; return w==='0123456'?'каждый день': w==='12345'?'по будням': WD_ORDER.filter(d=>w.includes(String(d))).map(d=>WD[d]).join(', '); };
function hStreak(h){ let n=0, d=TODAY; if(!h.days[d]) d=addDays(d,-1); for(let i=0;i<120;i++){ if(hScheduled(h,d)){ if(h.days[d]) n++; else break; } d=addDays(d,-1); if(h.start && d<h.start) break; } return n; }
function openHabit(id, name){
  const h = id ? S.habits.find(x=>x.id===id) : {name:name||'', wdays:'0123456', start:TODAY, until:null, time:null, remind:false, note:''};
  if(!h) return;
  const w = h.wdays||'0123456', mode = w==='0123456'?'daily':w==='12345'?'weekdays':'days';
  modal(`<form class="modal" id="habit-form" data-id="${id||''}" role="dialog" aria-label="Привычка">
    <h2>${id?'Привычка':'Новая привычка'}</h2>
    <div class="field"><label for="hf-name">Название</label><input id="hf-name" required value="${esc(h.name)}" placeholder="Например: чтение, спорт, ранний подъём" autocomplete="off"></div>
    <div class="field"><label for="hf-note">Цель или заметка</label><input id="hf-note" value="${esc(h.note||'')}" placeholder="Например: 20 минут, 10 страниц, 5 км" autocomplete="off"></div>
    <div class="frow"><div class="field"><label for="hf-mode">Расписание</label><select id="hf-mode"><option value="daily" ${mode==='daily'?'selected':''}>Каждый день</option><option value="weekdays" ${mode==='weekdays'?'selected':''}>По будням (Пн–Пт)</option><option value="days" ${mode==='days'?'selected':''}>По выбранным дням</option></select></div>
    <div class="field"><label for="hf-time">Время (необязательно)</label><input type="time" id="hf-time" value="${esc(h.time||'')}"></div></div>
    <div class="field" id="hf-days-f" ${mode==='days'?'':'hidden'}><label>Дни недели</label><div class="wdchips">${WD_ORDER.map(d=>`<label class="wdc"><input type="checkbox" name="hf-wd" value="${d}" ${w.includes(String(d))?'checked':''}><span>${WD[d]}</span></label>`).join('')}</div></div>
    <div class="frow"><div class="field"><label for="hf-start">Начать с</label><input type="date" id="hf-start" value="${esc(h.start||TODAY)}"></div>
    <div class="field"><label for="hf-until">До какого числа</label><input type="date" id="hf-until" value="${esc(h.until||'')}"><small class="note">Пусто — без срока</small></div></div>
    <div class="opts"><label class="opt"><input type="checkbox" id="hf-remind" ${h.remind?'checked':''} ${h.time?'':'disabled'}><span>🔔 Напомнить в Telegram, если ещё не отмечено</span></label></div>
    <p class="note" id="hf-hint">${h.time?'':'Чтобы получать напоминание, укажите время.'}</p>
    <div class="mact" style="justify-content:space-between"><span>${id?`<button type="button" class="btn" data-hdel="${id}" style="color:var(--bad)">Удалить привычку</button>`:''}</span>
      <span style="display:flex;gap:6px"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">${id?'Сохранить':'Добавить привычку'}</button></span></div>
  </form>`);
  setTimeout(()=>$('hf-name').focus(),30);
}
function openPlanNew(text){
  const wd = new Date((DAY||TODAY)+'T12:00:00').getDay();
  modal(`<form class="modal" id="plan-form" role="dialog" aria-label="Новый пункт плана">
    <h2>Новый пункт плана</h2>
    <div class="field"><label for="pf-text">Что сделать</label><input id="pf-text" required value="${esc(text||'')}" autocomplete="off"></div>
    <div class="frow"><div class="field"><label for="pf-day">Дата</label><input type="date" id="pf-day" value="${DAY||TODAY}" required></div>
    <div class="field"><label for="pf-time">Время (необязательно)</label><input type="time" id="pf-time"></div></div>
    <div class="frow"><div class="field"><label for="pf-repeat">Повтор</label><select id="pf-repeat">${REPEAT.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="field" id="pf-until-f" hidden><label for="pf-until">До какого числа</label><input type="date" id="pf-until" value="${addDays(DAY||TODAY,29)}"></div></div>
    <div class="field" id="pf-days-f" hidden><label>Дни недели</label><div class="wdchips">${WD_ORDER.map(d=>`<label class="wdc"><input type="checkbox" name="pf-wd" value="${d}" ${d===wd?'checked':''}><span>${WD[d]}</span></label>`).join('')}</div></div>
    <div class="field"><label for="pf-note">Заметка</label><textarea id="pf-note" placeholder="Детали, адрес, контакт, что взять с собой…"></textarea></div>
    <div class="opts"><label class="opt"><input type="checkbox" id="pf-remind"><span>🔔 Напомнить в Telegram в указанное время</span></label>
    <label class="opt"><input type="checkbox" id="pf-imp"><span>★ Важное</span></label></div>
    <p class="note" id="pf-hint"></p>
    <div class="mact"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Добавить в план</button></div>
  </form>`);
  setTimeout(()=>{ $('pf-text').focus(); planHint(); },30);
}
function planHint(){
  const r = $('pf-repeat') && $('pf-repeat').value, h = $('pf-hint'); if(!h) return;
  $('pf-until-f').hidden = !r; $('pf-days-f').hidden = r!=='days';
  const t = $('pf-time').value; $('pf-remind').disabled = !t; if(!t) $('pf-remind').checked = false;
  h.textContent = !t ? 'Чтобы получить напоминание в Telegram, укажите время.' : (r ? `Пункт появится в плане ${REPEAT_SHORT[r]} с ${fmt($('pf-day').value)} по ${fmt($('pf-until').value)}.` : '');
}
function openPlanEdit(id){
  const it = plansFor(S.me, DAY).find(x=>x.id===id); if(!it) return;
  modal(`<form class="modal" id="plan-edit" data-id="${id}" role="dialog" aria-label="Пункт плана">
    <h2>Пункт плана</h2>
    <div class="field"><label for="pe-text">Что сделать</label><input id="pe-text" required value="${esc(it.text)}" autocomplete="off"></div>
    <div class="frow"><div class="field"><label for="pe-day">Дата</label><input type="date" id="pe-day" value="${DAY}" ${it.series?'':''}></div>
    <div class="field"><label for="pe-time">Время</label><input type="time" id="pe-time" value="${esc(it.time||'')}"></div></div>
    <div class="field"><label for="pe-note">Заметка</label><textarea id="pe-note">${esc(it.note||'')}</textarea></div>
    <div class="opts"><label class="opt"><input type="checkbox" id="pe-remind" ${it.remind?'checked':''} ${it.time?'':'disabled'}><span>🔔 Напомнить в Telegram в указанное время</span></label>
    <label class="opt"><input type="checkbox" id="pe-imp" ${it.important?'checked':''}><span>★ Важное</span></label></div>
    ${it.series?`<div class="field"><label>Это повторяющийся пункт (${REPEAT_SHORT[it.repeat]||'повтор'})</label><div class="opts"><label class="opt"><input type="radio" name="pe-scope" value="one" checked><span>Изменить только этот день</span></label><label class="opt"><input type="radio" name="pe-scope" value="series"><span>Изменить этот и все следующие</span></label></div></div>`:''}
    <div class="mact" style="justify-content:space-between"><span style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn" data-pdel="${id}" style="color:var(--bad)">Удалить${it.series?' день':''}</button>${it.series?`<button type="button" class="btn" data-pdel="${id}" data-series="1" style="color:var(--bad)">Удалить серию</button>`:''}</span>
      <span style="display:flex;gap:6px"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Сохранить</button></span></div>
  </form>`);
}
function deptOptions(sel){ return S.depts.map(d=>`<option value="${d.id}" ${String(sel)===String(d.id)?'selected':''}>${esc(d.name)}</option>`).join('') + '<option value="new">+ Новый отдел…</option>'; }
function openInvite(presetDept){
  const myDept = presetDept || me().deptId;
  modal(`<form class="modal" id="invite-form" role="dialog" aria-label="Пригласить сотрудника">
    <h2>Пригласить сотрудника</h2>
    <p class="note" style="margin:-6px 0 14px">Создадим ссылку. Отправьте её сотруднику в Telegram — он войдёт и сразу попадёт в вашу команду.</p>
    <div class="frow"><div class="field"><label for="i-title">Должность</label><input id="i-title" placeholder="Должность сотрудника"></div>
    <div class="field"><label for="i-dept">Отдел</label><select id="i-dept">${deptOptions(isOwner()&&!presetDept?'':myDept)}</select></div></div>
    <div class="field" id="i-newdept-f" hidden><label for="i-newdept">Название нового отдела</label><input id="i-newdept" placeholder="Название отдела"></div>
    ${isOwner()?`<div class="frow"><div class="field"><label for="i-role">Роль</label>${roleSelect('i-role','worker')}</div>
    <div class="field" id="i-boss-f"><label for="i-boss">Подчиняется</label><select id="i-boss">${bossOptions(null, S.me)}</select></div></div>
    <p class="note" id="i-founder-note" hidden style="margin:-4px 0 10px">Учредитель никому не подчиняется и видит всю компанию.</p>`:''}
    <div id="i-result"></div>
    <div class="mact"><button type="button" class="btn" data-close="1">Закрыть</button><button class="btn primary" type="submit" id="i-submit">Создать ссылку</button></div>
  </form>`);
}
function openEditMember(id){
  const u = U(id);
  modal(`<form class="modal" id="edit-member" data-id="${id}" role="dialog" aria-label="Сотрудник">
    <h2>${esc(u.name)}</h2>
    ${!u.demo?nameFields('e', ...splitName(u)):''}${!u.nameOk&&!u.demo?'<p class="note" style="margin:-6px 0 10px;color:var(--warn,#C98A00)">⚠ Сотрудник вошёл под ником Telegram — укажите его фамилию и имя.</p>':''}
    <div class="frow"><div class="field"><label for="e-title">Должность</label><input id="e-title" value="${esc(u.title)}"></div>
    <div class="field"><label for="e-dept">Отдел</label><select id="e-dept">${deptOptions(u.deptId)}</select></div></div>
    <div class="field" id="e-newdept-f" hidden><label for="e-newdept">Название нового отдела</label><input id="e-newdept"></div>
    <div class="frow">${u.owner?`<div class="field"><label for="e-role">В структуре — вы</label><select id="e-role"><option value="founder" ${u.pos!=='director'?'selected':''}>Учредитель (владелец)</option><option value="director" ${u.pos==='director'?'selected':''}>Директор (владелец)</option></select></div>`:u.id===S.me?'':`<div class="field"><label for="e-role">Роль</label>${roleSelect('e-role',u.level)}</div>`}
    <div class="field" id="e-boss-f" ${u.level==='founder'||(u.owner&&u.pos!=='director')?'hidden':''}><label for="e-boss">Подчиняется</label><select id="e-boss"><option value="">—</option>${bossOptions(id, u.boss)}</select></div></div>
    <div class="mact">${u.owner||u.id===S.me?'':`<button type="button" class="btn" data-act="deactivate" data-id="${id}" style="color:var(--bad);margin-right:auto">Убрать из команды</button>`}<button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div>
  </form>`);
}
function openProfile(){
  modal(`<form class="modal" id="profile-form" role="dialog" aria-label="Профиль"><h2>Ваш профиль</h2>
    ${nameFields('p', ...splitName(ME.user))}
    ${isOwner()?`<div class="field"><label for="p-co">Название компании</label><input id="p-co" value="${esc(S.company.name)}" required></div>
    <div class="field"><label>Логотип компании</label><div class="logorow"><span class="ws">${coLogo().replace('id="logo-input"','id="logo-input2"').replace('for="logo-input"','for="logo-input2"')}</span><label class="btn sm" for="logo-input2">${S.company.logo!=null?'Сменить':'Загрузить'}</label>${S.company.logo!=null?'<button type="button" class="btn sm" data-act="logo-del" style="color:var(--bad)">Убрать</button>':''}<span class="note">PNG, JPG, WEBP · до 2 МБ · лучше квадратный</span></div></div>`:''}
    <div class="mact"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div></form>`);
}

/* ---------- рендер ---------- */
function render(){
  if(!S) return;
  if(!$('nav')) shell();
  renderNav();
  const r = current();
  $('main').innerHTML = {overview:vOverview, tasks:vTasks, plans:vPlans, wallet:vWallet, team:vTeam, alerts:vAlerts, admin:vAdmin}[r]();
  if(r==='wallet' && feat('wallet') && (!WAL || WAL.month!==WM)) loadWallet();
  if(r==='admin' && !ADM) loadAdmin();
  if(r==='overview') startConstellation(false); else cancelAnimationFrame(raf);
  if(r==='alerts' && S.notifs.some(n=>!n.read)) setTimeout(()=>api('POST','/api/notifs/read').catch(()=>{}), 4000);
}
async function boot(){
  try {
    ME = await api('GET','/api/me');
  } catch(e){ $('root').innerHTML = `<div class="auth"><div class="err">Сервер недоступен. Обновите страницу через минуту.</div></div>`; return; }
  const join = location.pathname.startsWith('/join/') ? location.pathname.split('/')[2] : null;
  if(!ME.user) return screenLogin();
  if(join) return screenJoin(join);
  if(!ME.member) return screenOnboard();
  await reload();
  shell(); render(); startLive(); nameGate();
}

/* ---------- события ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-snz],[data-roff],[data-tv],[data-theme-set],[data-stopser],[data-more],[data-pay],[data-pt],[data-addon],[data-admpay],[data-ext],[data-wk],[data-wcat],[data-wedit],[data-wdel],[data-bud],[data-act],[data-open],[data-tick],[data-plan],[data-pdel],[data-pedit],[data-hedit],[data-hdel],[data-hab],[data-status],[data-close],[data-delete],[data-sw],[data-cf],[data-view],[data-mode]');
  if(!el) return;
  if(el.dataset.close && e.target !== el && !e.target.closest('button[data-close]')) return;
  if(el.dataset.snz || el.dataset.roff){ const [id,v] = (el.dataset.snz||el.dataset.roff).split('|'); const body = el.dataset.snz ? {snooze:v} : {off: v==='1'};
    return (async()=>{ try { await api('POST',`/api/tasks/${id}/remind`, body); await reload(); render(); openTask(Number(id)); toast(el.dataset.snz ? 'Напомню позже — в боте тоже' : (v==='1' ? 'Напоминания выключены' : 'Напоминания включены')); } catch(err){ toast(err.message); } })(); }
  if(el.dataset.tv){ try{ localStorage.setItem('orb_tv', el.dataset.tv); }catch(err){} return render(); }
  if(el.dataset.themeSet){ document.documentElement.dataset.theme = el.dataset.themeSet; try{ localStorage.setItem('orb-theme', el.dataset.themeSet); }catch(err){} return render(); }
  if(el.dataset.pay) return openPay(el.dataset.pay);
  if(el.dataset.more){ const id=Number(el.dataset.more); return (async()=>{ try { await api('POST',`/api/tasks/${id}/more`); await reload(); render(); openTask(id); toast('Запрос отправлен — руководитель сможет продлить срок'); } catch(err){ toast(err.message); } })(); }
  if(el.dataset.stopser){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно остановить?'; return; } return act(()=>api('DELETE','/api/series/'+el.dataset.stopser),'Повтор остановлен — новые задачи создаваться не будут').then(()=>closeModal()); }
  if(el.dataset.pt){ document.querySelectorAll('[data-pt]').forEach(b=>b.classList.toggle('on', b===el)); document.querySelectorAll('[data-pq]').forEach(d=>d.hidden = d.dataset.pq!==el.dataset.pt); return; }
  if(el.dataset.addon){ const [id,k] = el.dataset.addon.split('|'); const u = U(Number(id)); const on = !u[k];
    return act(()=>api('PATCH','/api/members/'+id,{[k]:on}), `${k==='plansOn'?'«Мои планы»':'«Кошелёк»'} ${on?'подключён':'отключён'} — ${u.name}`); }
  if(el.dataset.admpay){ const [kind,id,m] = el.dataset.admpay.split('|');
    if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Деньги получены?'; return; }
    return (async()=>{ try { if(kind==='company') await api('POST',`/api/admin/company/${id}/paid`,{months:Number(m)}); else await api('POST',`/api/admin/user/${id}/ai`, kind==='pack'?{pack:true}:{months:Number(m)}); ADM=null; ADF=[]; toast('Оплата отмечена'); await reload(); await loadAdmin(); } catch(err){ toast(err.message); } })(); }
  if(el.dataset.ext){ const [id,code] = el.dataset.ext.split('|'); return (async()=>{ try { const r = await api('POST','/api/tasks/'+id+'/extend',{code}); const inModal = !!document.querySelector('#modal .modal'); await reload(); render(); if(inModal) openTask(Number(id)); toast('Срок продлён до '+r.label+' — исполнитель получит уведомление'); } catch(err){ toast(err.message); } })(); }
  if(el.dataset.wk){ WK = el.dataset.wk; WCAT=''; const a=$('w-amount')?.value, n=$('w-note')?.value; render(); if($('w-amount')){ $('w-amount').value=a||''; $('w-note').value=n||''; } return; }
  if(el.dataset.wcat){ WCAT = WCAT===el.dataset.wcat ? '' : el.dataset.wcat; document.querySelectorAll('.wcat').forEach(b=>b.classList.toggle('on', b.dataset.wcat===WCAT)); return; }
  if(el.dataset.wedit) return openWalletEdit(Number(el.dataset.wedit));
  if(el.dataset.wdel){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно удалить?'; return; } closeModal(); return (async()=>{ await api('DELETE','/api/wallet/'+el.dataset.wdel); await loadWallet(); toast('Запись удалена'); })(); }
  if(el.dataset.bud){ WBUD = el.dataset.bud; render(); setTimeout(()=>$('bud-amount')?.focus(),20); return; }
  if(el.dataset.tick){ e.stopPropagation(); const t=S.tasks.find(x=>x.id===Number(el.dataset.tick)); const ns = t.status==='done'?'progress':'done';
    return act(()=>api('PATCH','/api/tasks/'+t.id,{status:ns}), ns==='done'?(t.author&&t.author!==S.me?'Готово — '+U(t.author).name+' получит уведомление':'Готово'):'Задача снова в работе'); }
  if(el.dataset.open) return openTask(Number(el.dataset.open));
  if(el.dataset.close) return closeModal();
  if(el.dataset.cf){ CF = el.dataset.cf; return render(); }
  if(el.dataset.view){ VIEW = el.dataset.view; return render(); }
  if(el.dataset.mode){ F.mode = el.dataset.mode; return render(); }
  if(el.dataset.status){ const [id,s]=el.dataset.status.split('|'); return act(async()=>{ await api('PATCH','/api/tasks/'+id,{status:s}); }, 'Статус: '+STATUS[s]).then(()=>openTask(Number(id))); }
  if(el.dataset.delete){ const id = el.dataset.delete; if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно удалить?'; return; } closeModal(); return act(()=>api('DELETE','/api/tasks/'+id),'Задача удалена'); }
  if(el.dataset.pedit) return openPlanEdit(Number(el.dataset.pedit));
  if(el.dataset.plan) return act(()=>api('PATCH','/api/plans/'+el.dataset.plan,{done: el.dataset.done!=='1'}));
  if(el.dataset.pdel){ const ser = el.dataset.series==='1'; if(el.closest('.modal') && el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent = ser?'Удалить все следующие?':'Точно удалить?'; return; } closeModal(); return act(()=>api('DELETE','/api/plans/'+el.dataset.pdel+(ser?'?series=1':'')), ser?'Серия удалена с этого дня':'Пункт удалён'); }
  if(el.dataset.hedit) return openHabit(Number(el.dataset.hedit));
  if(el.dataset.hdel){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно удалить? Отметки тоже удалятся'; return; } closeModal(); return act(()=>api('DELETE','/api/habits/'+el.dataset.hdel),'Привычка удалена'); }
  if(el.dataset.hab){ const [hid,d]=el.dataset.hab.split('|'); return act(()=>api('POST','/api/habits/'+hid+'/toggle',{day:d})); }
  if(el.dataset.sw){ const k=el.dataset.sw; const cur = mySettings()[k]!==false; return act(()=>api('PATCH','/api/settings',{[k]:!cur}),'Настройка сохранена'); }
  const a = el.dataset.act;
  if(a==='new') return openNew(el.dataset.for);
  if(a==='logo-del') return (async()=>{ await api('DELETE','/api/company/logo'); LAST_MUT=Date.now(); await reload(); shell(); render(); closeModal(); toast('Логотип убран'); })().catch(err=>toast(err.message));
  if(a==='invite') return openInvite();
  if(a==='invite-dept'){ const did=Number(el.dataset.id); openInvite(did); const h=S.users.find(u=>u.deptId===did&&u.level==='manager'); if(h&&$('i-boss')) $('i-boss').value=h.id; return; }
  if(a==='dept-new') return openDept();
  if(a==='dept-ren') return openDept(Number(el.dataset.id));
  if(a==='dept-del'){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Удалить?'; el.style.color='var(--bad)'; return; } return act(()=>api('DELETE','/api/depts/'+el.dataset.id),'Отдел удалён — люди перешли в «Без отдела»'); }
  if(a==='demo-add-close'){ closeModal(); return act(()=>api('POST','/api/demo'),'Добавлены 3 демо-сотрудника — теперь им можно ставить задачи').then(()=>openNew()); }
  if(a==='demo-add') return act(()=>api('POST','/api/demo'),'Добавлены 3 демо-сотрудника с задачами').then(()=>{ location.hash='team'; });
  if(a==='demo-del'){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно удалить демо?'; return; } return act(()=>api('DELETE','/api/demo'),'Демо-сотрудники удалены'); }
  if(a==='viewas') return (async()=>{ try { await api('POST','/api/view-as',{memberId:Number(el.dataset.id)}); location.hash=''; await boot(); toast('Вы вошли как '+me().name); } catch(err){ toast(err.message); } })();
  if(a==='viewback') return (async()=>{ await api('POST','/api/view-back'); location.hash='team'; await boot(); toast('Вы вернулись к себе'); })();
  if(a==='habit-more') return openHabit(null, $('habit-text') ? $('habit-text').value.trim() : '');
  if(a==='plan-more') return openPlanNew($('plan-text') ? $('plan-text').value.trim() : '');
  if(a==='editm') return openEditMember(Number(el.dataset.id));
  if(a==='profile') return openProfile();
  if(a==='deactivate'){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно убрать?'; return; } closeModal(); return act(()=>api('PATCH','/api/members/'+el.dataset.id,{active:false}),'Сотрудник убран из команды'); }
  if(a==='adm-reload'){ ADM=null; render(); return loadAdmin(); }
  if(a==='wm-'){ WM = mShift(WM,-1); WAL=null; render(); return loadWallet(); }
  if(a==='wm+'){ WM = mShift(WM,1); WAL=null; render(); return loadWallet(); }
  if(a==='day-'){ DAY=addDays(DAY,-1); return render(); }
  if(a==='day+'){ DAY=addDays(DAY,1); return render(); }
  if(a==='tl-'){ F.off-=7; return render(); }
  if(a==='tl+'){ F.off+=7; return render(); }
  if(a==='clearq'){ F.q=''; return render(); }
  if(a==='readall') return act(()=>api('POST','/api/notifs/read'));
  if(a==='testmsg') return act(()=>api('POST','/api/test-message'),'Отправлено — проверьте Telegram');
  if(a==='copy'){ const v = el.dataset.v; navigator.clipboard.writeText(v).then(()=>toast('Ссылка скопирована')).catch(()=>{ const c = el.parentElement.querySelector('code'); const r = document.createRange(); r.selectNodeContents(c); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Выделено — скопируйте'); }); return; }
  if(a==='accept'){ return (async()=>{ try { await api('POST','/api/invite/'+el.dataset.code+'/accept'); history.replaceState(null,'','/'); toast('Добро пожаловать в команду!'); boot(); } catch(err){ toast(err.message); } })(); }
  if(a==='back') return boot();
  if(a==='logout'){ return (async()=>{ await api('POST','/api/logout').catch(()=>{}); S=null; history.replaceState(null,'','/'); boot(); })(); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    if(f.id==='new-task'){
      const title = $('n-title').value.trim(), who = $('n-who').value;
      if(!title || !who) return toast('Заполните задачу и исполнителя');
      const created = await api('POST','/api/tasks',{title, desc:$('n-desc').value, assignee:Number(who), priority:$('n-prio').value, due:$('n-due').value, dueTime:$('n-due-time').value||null, remind:$('n-rem').value||null, repeat:$('n-rep').value||null, wdays:[...document.querySelectorAll('input[name=n-wd]:checked')].map(i=>Number(i.value)), checklist:$('n-check').value, requiresPhoto:$('n-photo').checked});
      closeModal(); await reload(); render();
      if(created.series && !created.id) return toast('Повтор настроен — первая задача появится в ближайший подходящий день в 06:00');
      return toast(created.series ? 'Повторяющаяся задача создана — задача на сегодня уже у исполнителя' : Number(who)!==S.me ? `Задача поставлена — ${U(Number(who)).name} получит уведомление` : 'Задача добавлена');
    }
    if(f.id==='add-plan'){ const v=$('plan-text').value.trim(); if(!v) return; await api('POST','/api/plans',{day:DAY,text:v}); await reload(); render(); $('plan-text')?.focus(); return; }
    if(f.id==='adm-find'){ ADQ=$('adm-q').value.trim(); ADF = ADQ ? await api('GET','/api/admin/find-user?q='+encodeURIComponent(ADQ)) : []; if(!ADF.length) toast('Никого не нашёл'); return render(); }
    if(f.id==='ext-form'){ const id=Number(f.dataset.id); const r = await api('POST','/api/tasks/'+id+'/extend',{due:$('ext-due').value, dueTime:$('ext-time').value||null}); await reload(); render(); openTask(id); return toast('Срок продлён до '+r.label); }
    if(f.id==='wallet-form'){
      const amount = Number($('w-amount').value.replace(/[^\d]/g,''));
      if(!amount) return toast('Введите сумму');
      const body = {kind:WK, amount, category:WCAT, note:$('w-note').value, day:$('w-day').value};
      await api('POST','/api/wallet', body); WCAT=''; const day=$('w-day').value; await loadWallet(); if($('w-day')) $('w-day').value=day; $('w-amount')?.focus();
      return toast((WK==='income'?'Доход':'Расход')+' записан: '+sum(amount)+' сум');
    }
    if(f.id==='wedit-form'){
      const body = {kind:$('we-kind').value, amount:Number($('we-amount').value.replace(/[^\d]/g,'')), category:$('we-cat').value, note:$('we-note').value, day:$('we-day').value};
      await api('PATCH','/api/wallet/'+f.dataset.id, body); closeModal(); await loadWallet(); return toast('Сохранено');
    }
    if(f.id==='bud-form'){ await api('PUT','/api/wallet/budgets',{category:f.dataset.cat, amount:Number($('bud-amount').value.replace(/[^\d]/g,''))}); WBUD=null; await loadWallet(); return toast('Бюджет сохранён'); }
    if(f.id==='plan-form'){
      const body = {text:$('pf-text').value, day:$('pf-day').value, time:$('pf-time').value||null, note:$('pf-note').value, repeat:$('pf-repeat').value||null,
        until:$('pf-until').value, days:[...document.querySelectorAll('input[name=pf-wd]:checked')].map(x=>Number(x.value)), remind:$('pf-remind').checked, important:$('pf-imp').checked};
      const r = await api('POST','/api/plans', body); closeModal(); DAY = r.from || body.day; await reload(); render();
      return toast(r.count>1 ? `Добавлено в план: ${r.count} дн. (${fmt(r.from)} — ${fmt(r.to)})` : 'Добавлено в план на '+fmt(body.day));
    }
    if(f.id==='plan-edit'){
      const sc = document.querySelector('input[name=pe-scope]:checked');
      const body = {text:$('pe-text').value, day:$('pe-day').value, time:$('pe-time').value||null, note:$('pe-note').value, remind:$('pe-remind').checked, important:$('pe-imp').checked, scope: sc?sc.value:'one'};
      await api('PATCH','/api/plans/'+f.dataset.id, body); closeModal(); await reload(); render(); return toast(body.scope==='series'?'Изменено для всех следующих дней':'Сохранено');
    }
    if(f.id==='habit-form'){
      const mode = $('hf-mode').value, wdays = mode==='daily'?[0,1,2,3,4,5,6]: mode==='weekdays'?[1,2,3,4,5]: [...document.querySelectorAll('input[name=hf-wd]:checked')].map(x=>Number(x.value));
      if(!wdays.length) return toast('Выберите хотя бы один день недели');
      const body = {name:$('hf-name').value, note:$('hf-note').value, wdays, start:$('hf-start').value, until:$('hf-until').value||null, time:$('hf-time').value||null, remind:$('hf-remind').checked};
      if(f.dataset.id) await api('PATCH','/api/habits/'+f.dataset.id, body); else await api('POST','/api/habits', body);
      closeModal(); await reload(); render(); return toast(f.dataset.id?'Привычка сохранена':'Привычка добавлена');
    }
    if(f.id==='add-habit'){ const v=$('habit-text').value.trim(); if(!v) return; await api('POST','/api/habits',{name:v}); await reload(); return render(); }
    if(f.id==='add-cm'){ const v=$('cm-text').value.trim(); if(!v) return; await api('POST','/api/tasks/'+f.dataset.id+'/comments',{text:v}); await reload(); render(); openTask(Number(f.dataset.id)); return toast('Комментарий отправлен'); }
    if(f.id==='dept-form'){ const id=f.dataset.id, name=$('d-name').value.trim(); if(!name) return toast('Введите название отдела');
      await api(id?'PATCH':'POST', id?'/api/depts/'+id:'/api/depts', {name}); closeModal(); await reload(); render(); return toast(id?'Отдел переименован':'Отдел «'+name+'» создан'); }
    if(f.id==='invite-form'){
      const dept = $('i-dept').value;
      const body = {title:$('i-title').value, deptId: dept==='new'?null:Number(dept), newDept: dept==='new'?$('i-newdept').value:'', role: $('i-role')?$('i-role').value:'worker', bossId: $('i-role')&&$('i-role').value==='founder' ? null : ($('i-boss')?Number($('i-boss').value):S.me)};
      if(dept==='new' && !body.newDept.trim()) return toast('Напишите название отдела');
      const r = await api('POST','/api/invites', body);
      $('i-result').innerHTML = `<div class="field"><label>Ссылка-приглашение (действует 14 дней, на одного человека)</label><div class="copyrow"><code>${esc(r.link)}</code><button type="button" class="btn sm primary" data-act="copy" data-v="${esc(r.link)}">Копировать</button></div></div>`;
      $('i-submit').textContent = 'Создать ещё одну'; await reload(); return;
    }
    if(f.id==='edit-member'){
      const dept = $('e-dept').value, body = {title:$('e-title').value, deptId: dept==='new'?null:Number(dept), newDept: dept==='new'?$('e-newdept').value:'', bossId: ($('e-role')&&$('e-role').value==='founder') || !$('e-boss').value ? null : Number($('e-boss').value)};
      if($('e-role')) body.role = $('e-role').value;
      if($('e-first')){ body.firstName = $('e-first').value; body.lastName = $('e-last').value; }
      await api('PATCH','/api/members/'+f.dataset.id, body); closeModal(); await reload(); render(); return toast('Сохранено');
    }
    if(f.id==='namegate-form'){ const r = await api('POST','/api/profile/name',{firstName:$('ng-first').value, lastName:$('ng-last').value}); $('namegate').remove(); ME = await api('GET','/api/me'); await reload(); shell(); render(); return toast('Спасибо, '+r.name+'!'); }
    if(f.id==='join-form'){ await api('POST','/api/invite/'+f.dataset.code+'/accept',{firstName:$('j-first').value, lastName:$('j-last').value}); history.replaceState(null,'','/'); toast('Добро пожаловать в команду!'); return boot(); }
    if(f.id==='profile-form'){ await api('POST','/api/profile/name',{firstName:$('p-first').value, lastName:$('p-last').value}); if($('p-co')) await api('PATCH','/api/company',{name:$('p-co').value}); closeModal(); ME = await api('GET','/api/me'); await reload(); shell(); render(); return toast('Сохранено'); }
    if(f.id==='newco'){ await api('POST','/api/company',{name:$('co-name').value, title:$('co-title').value, myName:$('co-me').value}); return boot(); }
    if(f.id==='devlogin'){ await api('POST','/api/auth/dev',{name:$('devname').value}); return boot(); }
  } catch(err){ toast(err.message); }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if(e.target.dataset && e.target.dataset.ck){ const [tid,ix]=e.target.dataset.ck.split('|'); return (async()=>{ try { await api('POST',`/api/tasks/${tid}/check`,{idx:Number(ix)}); await reload(); render(); openTask(Number(tid)); } catch(err){ toast(err.message); } })(); }
  if((id==='logo-input'||id==='logo-input2') && e.target.files.length){ const f=e.target.files[0]; return (async()=>{
    if(f.size > 2*1048576) return toast('Логотип больше 2 МБ — выберите картинку поменьше');
    const r = await fetch('/api/company/logo', {method:'POST', headers:{'content-type': f.type||'application/octet-stream'}, body: f, credentials:'same-origin'});
    const j = await r.json().catch(()=>({})); if(!r.ok) return toast(j.error||'Не удалось загрузить логотип');
    LAST_MUT = Date.now(); await reload(); shell(); render(); if(id==='logo-input2') closeModal(); toast('Логотип компании обновлён');
  })(); }
  if(id==='att-input' && e.target.files.length){ const tid = Number(e.target.dataset.task); const files=[...e.target.files]; return (async()=>{
    for(const f of files){
      if(f.size > 20*1048576){ toast(`«${f.name}» больше 20 МБ`); continue; }
      toast(`Загружаю «${f.name}»…`);
      try { const r = await fetch(`/api/tasks/${tid}/files`, {method:'POST', headers:{'content-type': f.type||'application/octet-stream', 'x-file-name': encodeURIComponent(f.name)}, body: f, credentials:'same-origin'});
        const j = await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Не удалось загрузить файл'); LAST_MUT = Date.now();
        toast(j.closed ? '✅ Файл принят как отчёт — задача выполнена' : `📎 «${f.name}» прикреплён`);
      } catch(err){ toast(err.message); }
    }
    await reload(); render(); openTask(tid); })(); }
  if(id==='n-rep'){ const v=e.target.value; $('n-days-f').hidden = v!=='days'; $('n-due-l').textContent = v ? 'Начать с' : 'Срок'; if(v && $('n-due').value===addDays(TODAY,1)) $('n-due').value = TODAY; return; }
  if(id==='bud-add' && e.target.value){ WBUD = e.target.value; WAL.budgets[WBUD] = WAL.budgets[WBUD] || 0; render(); setTimeout(()=>$('bud-amount')?.focus(),20); return; }
  if(id==='f-who'){ F.who = e.target.value; return render(); }
  if(id==='i-dept') $('i-newdept-f').hidden = e.target.value!=='new';
  if(id==='e-dept') $('e-newdept-f').hidden = e.target.value!=='new';
  if(['pf-repeat','pf-time','pf-day','pf-until'].includes(id)) planHint();
  if(id==='hf-mode') $('hf-days-f').hidden = e.target.value!=='days';
  if(id==='hf-time'){ $('hf-remind').disabled = !e.target.value; if(!e.target.value) $('hf-remind').checked=false; else $('hf-remind').checked=true; $('hf-hint').textContent = e.target.value?'':'Чтобы получать напоминание, укажите время.'; }
  if(id==='pe-time'){ $('pe-remind').disabled = !e.target.value; if(!e.target.value) $('pe-remind').checked=false; }
  if(id==='i-role'){ const f = e.target.value==='founder'; $('i-boss-f').hidden = f; $('i-founder-note').hidden = !f; }
  if(id==='e-role') $('e-boss-f').hidden = e.target.value==='founder';
  if(e.target.dataset && e.target.dataset.dirset && e.target.value){ const f = S.users.find(isFounderLvl);
    return act(()=>api('PATCH','/api/members/'+e.target.value,{role:'director', title:'Директор', bossId: f?f.id:null}),'Директор назначен'); }
  if(e.target.dataset && (e.target.dataset.dhead || e.target.dataset.dmove) && e.target.value){ const t=e.target, head=Boolean(t.dataset.dhead), did=t.dataset.dhead||t.dataset.dmove;
    return act(()=>api('POST',`/api/depts/${did}/${head?'head':'members'}`,{memberId:Number(t.value)}), head?'Руководитель отдела назначен':'Сотрудник переведён в отдел'); }
  if(id==='switchco' || id==='switchco2'){ if(e.target.value==='new'){ S=null; return screenOnboard(true); } return (async()=>{ await api('POST','/api/switch',{memberId:Number(e.target.value)}); location.hash=''; ME = await api('GET','/api/me'); await reload(); shell(); render(); toast('Компания: '+S.company.name); })(); }
  if(id==='s-morning'||id==='s-evening'||id==='s-before') return act(()=>api('PATCH','/api/settings',{[id.slice(2)]: e.target.value}),'Настройка сохранена');
});
document.addEventListener('input', e => {
  if(e.target.classList && e.target.classList.contains('w-amount')){ const d = e.target.value.replace(/[^\d]/g,''); e.target.value = d ? sum(Number(d)) : ''; }
});
document.addEventListener('keydown', e => {
  if(e.key==='Enter' && e.target.dataset && e.target.dataset.wedit){ openWalletEdit(Number(e.target.dataset.wedit)); }
  if(e.key==='Escape') closeModal();
  if(e.key==='Enter' && e.target.dataset && e.target.dataset.pedit){ openPlanEdit(Number(e.target.dataset.pedit)); }
  if(e.key==='Enter' && e.target.dataset && e.target.dataset.hedit){ openHabit(Number(e.target.dataset.hedit)); }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); $('gsearch')?.focus(); }
  if(e.key==='Enter' && e.target.id==='gsearch'){ F.q = e.target.value.trim(); if(current()!=='team' && current()!=='tasks') location.hash='tasks'; render(); }
});
window.addEventListener('hashchange', render);
// обновление данных раз в 30 секунд, пока вкладка открыта и нет открытого окна
setInterval(async () => { if(!S || document.hidden || $('modal').innerHTML || document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return; try { await reload(); render(); } catch(e){} }, 30000);
boot();
})();
