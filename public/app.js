/* Орбита — интерфейс. Работает с API сервера. */
(function () {
'use strict';
const ICON = {
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
  return j;
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
const ROLES = [['worker','Сотрудник'],['manager','Руководитель отдела'],['director','Директор'],['founder','Учредитель']];
const roleName = u => u.level==='owner' ? 'Владелец' : (ROLES.find(r=>r[0]===u.level)||['',''])[1];
const roleSelect = (id, sel) => `<select id="${id}">${ROLES.map(([v,l])=>`<option value="${v}" ${v===sel?'selected':''}>${l}</option>`).join('')}</select>`;
const bossOptions = (except, sel) => S.users.filter(x=>x.role==='manager' && x.id!==except).map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(x.name)}${x.title?' — '+esc(x.title):''}</option>`).join('');
const late = t => t.status!=='done' && t.due && t.due < TODAY;
const deptColor = name => { const d = S.depts.find(x=>x.name===name); return d ? d.color : '#9AA3C7'; };
const AVC = c => c==='#FFD23F' ? '#141729' : c;
const av = (u,size) => `<span class="av" style="background:${AVC(u.deptColor||deptColor(u.dept))};${size?`width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px`:''}" aria-hidden="true">${esc((u.name||'?').slice(0,1))}</span>`;
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
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${dpath}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${dot||'#fff'}" stroke="${color}" stroke-width="2.2"/></svg>`;
}
const series = fn => Array.from({length:8},(_,i)=>fn(addDays(TODAY,i-7)));
const activeOn = (ts,day) => ts.filter(t=>t.created<=day && (!t.doneAt || t.doneAt>day)).length;
const lateOn = (ts,day) => ts.filter(t=>t.due<day && t.created<=day && (!t.doneAt || t.doneAt>day)).length;
const doneWeek = (ts,day) => ts.filter(t=>t.doneAt && t.doneAt<=day && t.doneAt>addDays(day,-7)).length;
function avgPlan(ids,day){ const v = ids.map(id=>planPct(id,day)).filter(x=>x!=null); return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length) : null; }
function ring(p, size){
  const r=size/2-8, c=2*Math.PI*r, off=c*(1-(p||0)/100);
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#E3E7F7" stroke-width="10"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--blue)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
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
async function screenJoin(code){
  let inv; try { inv = await api('GET','/api/invite/'+code); } catch(e){ inv = {error:e.message}; }
  $('root').innerHTML = authShell(`${brand()}${inv.error?`<div class="err">${esc(inv.error)}</div><a class="btn" href="/">Открыть Орбиту</a>`:
    `<h1>Приглашение в «${esc(inv.company)}»</h1><p>${esc(inv.inviter||'Руководитель')} приглашает вас в команду${inv.dept?` · отдел «${esc(inv.dept)}»`:''}${inv.title?` · ${esc(inv.title)}`:''}.</p>
     <p>Вы вошли как <b>${esc(ME.user.name)}</b>.</p><button class="btn primary" data-act="accept" data-code="${esc(code)}" style="align-self:flex-start;padding:12px 18px">Присоединиться к команде</button>`}`);
  startConstellation(true);
}
function screenOnboard(another){
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
  return isMgr()
    ? [['overview','Обзор'],['tasks','Задачи'],['plans','Мои планы'],['team','Команда'],['alerts','Уведомления']]
    : [['tasks','Мои задачи'],['plans','Мои планы'],['team','Команда'],['alerts','Уведомления']];
}
function current(){ const h = location.hash.replace('#',''); const r = routes().map(x=>x[0]); return r.includes(h) ? h : r[0]; }
const AREA = {
  overview:()=>['Команда', `${scope().length} чел. · ${new Set(scope().map(u=>u.dept)).size} отд.`],
  tasks:()=>isMgr()?['Задачи', `${scopeTasks().filter(t=>t.status!=='done').length} в работе · ${scopeTasks().filter(late).length} просрочено`]:['Задачи', `${S.tasks.filter(t=>t.assignee===S.me&&t.status!=='done').length} в работе`],
  plans:()=>['Планы', 'личный план и привычки'],
  team:()=>['Люди', `${S.users.length} в компании`],
  alerts:()=>['Бот', myUnread()?`${myUnread()} новых сообщений`:'все сообщения прочитаны']
};
function shell(){
  $('root').innerHTML = `<div class="app"><aside class="side">
      <div class="ws"><div class="logo">${esc(initials(S.company.name))}</div><div><b>${esc(S.company.name)}</b><small>Орбита · Бизнес</small></div></div>
      <div class="area" id="area"></div><nav class="nav" id="nav"></nav>
      <div class="me-box" id="mebox"></div>
    </aside><main class="main" id="main"></main></div><nav class="tabbar" id="tabbar"></nav>`;
}
const coSwitch = id => `<select id="${id}" class="coswitch" aria-label="Компания">${ME.companies.map(c=>`<option value="${c.member_id}" ${c.member_id===S.me?'selected':''}>${esc(c.name)}${c.role==='owner'?' · владелец':''}</option>`).join('')}<option value="new">+ Создать новую компанию…</option></select>`;
const initials = s => (s||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
function renderNav(){
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
function header(crumb, title, action){
  const d = new Date(TODAY+'T12:00:00');
  return `<div class="head"><div><div class="crumbs">${esc(S.company.name)}<span>›</span>${crumb}</div><h1>${title}</h1></div>
    <div class="tools">
      <label class="search">${ICON.search}<input id="gsearch" placeholder="Поиск задач, людей…" aria-label="Поиск" value="${esc(F.q)}"><kbd>⌘K</kbd></label>
      <span class="datechip"><i></i>${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}<span>· Неделя ${week(TODAY)}</span></span>
      <a class="iconbtn" href="#alerts" aria-label="Уведомления">${ICON.bell}${myUnread()?'<i class="dot"></i>':''}</a>
      ${action||''}
    </div></div>`;
}

/* ---------- Обзор ---------- */
let CF = 'all', VIEW = 'orbit';
function vOverview(){
  const ts = scopeTasks(), ids = scopeIds();
  const act = ts.filter(t=>t.status!=='done'), over = ts.filter(late);
  const sAct = series(d=>activeOn(ts,d)), sLate = series(d=>lateOn(ts,d)), sDone = series(d=>doneWeek(ts,d)), sPlan = series(d=>avgPlan(ids,d)||0);
  const dAct = sAct[7]-sAct[0], dDone = sDone[7]-sDone[0];
  const depts = [...new Set(scope().map(u=>u.dept))];
  const days10 = Array.from({length:10},(_,i)=>addDays(TODAY,i-9));
  const heat = depts.map(dp => { const us = scope().filter(u=>u.dept===dp).map(u=>u.id);
      return `<span class="rl">${esc(dp)}</span>` + days10.map(d=>{ const p = avgPlan(us,d); const a = p==null ? .06 : .14 + (p/100)*.86; return `<span class="c" title="${esc(dp)}, ${fmt(d)}: ${p==null?'нет планов':p+'%'}" style="background:rgba(47,85,228,${a.toFixed(2)})"></span>`; }).join(''); }).join('')
    + '<span></span>' + days10.map(d=>`<span class="dl">${new Date(d+'T12:00:00').getDate()}</span>`).join('');
  const teamPlan = avgPlan(ids, TODAY), prevPlan = avgPlan(ids, addDays(TODAY,-1));
  const rows = scope().filter(u=>u.id!==S.me).map(u => {
    const mine = S.tasks.filter(t=>t.assignee===u.id), a = mine.filter(t=>t.status!=='done').length, od = mine.filter(late).length;
    const p = planPct(u.id,TODAY);
    return `<tr><td><div class="person">${av(u)}<div>${esc(u.name)}<small>${esc(u.title)}</small></div></div></td><td class="hide-s">${esc(u.dept)}</td>
      <td class="n num">${a}</td><td class="n num" style="color:${od?'var(--bad)':'inherit'};font-weight:${od?700:500}">${od}</td>
      <td>${p==null?'<span class="note">нет плана</span>':`<div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:${p}%"></i></div><span class="num" style="font-size:12px;font-weight:600">${p}%</span></div>`}</td></tr>`; }).join('');
  const attention = [...over, ...act.filter(t=>t.due===TODAY && !late(t))];
  const counts = depts.map(dp=>[dp, scope().filter(u=>u.dept===dp).length]);
  const alone = scope().length <= 1;
  return header('Команда<span>›</span>Обзор', 'Обзор команды', `<button class="btn primary" data-act="new">${ICON.plus}Поставить задачу</button>`) + `
  ${alone?`<div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>В команде пока только вы.</b><div class="note">Пригласите сотрудников — они войдут через Telegram по ссылке.</div></div><button class="btn y" data-act="invite">${ICON.plus}Пригласить сотрудника</button></div>`:''}
  <div class="grid kpis">
    <div class="card kpi hero"><div class="lab"><span class="ic">${ICON.flame}</span>Задач в работе<span class="delta">${dAct>=0?'↗':'↘'} ${Math.abs(dAct)} за неделю</span></div>
      <div class="row"><div><div class="v num">${act.length}</div><div class="sub">${ts.filter(t=>t.created>=addDays(TODAY,-7)).length} новых за 7 дней</div></div>${spark(sAct,'#141729','#FFD23F')}</div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.alert}</span>Просрочено<span class="delta" style="${over.length?'background:var(--bad-soft);color:var(--bad)':''}">${over.length?'нужно внимание':'всё в срок'}</span></div>
      <div class="row"><div><div class="v num ${over.length?'bad':''}">${over.length}</div><div class="sub">${act.filter(t=>t.due===TODAY).length} со сроком сегодня</div></div>${spark(sLate,'#E0483D')}</div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.done}</span>Выполнено · 7 дней<span class="delta">${dDone>=0?'↗':'↘'} ${Math.abs(dDone)}</span></div>
      <div class="row"><div><div class="v num">${sDone[7]}</div><div class="sub">закрыто задач за неделю</div></div>${spark(sDone,'#2F55E4')}</div></div>
    <div class="card kpi"><div class="lab"><span class="ic">${ICON.target}</span>Личные планы<span class="delta">${teamPlan==null||prevPlan==null?'сегодня':(teamPlan>=prevPlan?'↗ ':'↘ ')+(teamPlan==null||prevPlan==null?'':Math.abs(teamPlan-prevPlan)+' п.')}</span></div>
      <div class="row"><div><div class="v num">${teamPlan==null?'—':teamPlan}<small>${teamPlan==null?'':'%'}</small></div><div class="sub">${teamPlan==null?'планы на сегодня ещё не записаны':'средний план дня команды'}</div></div>${spark(sPlan,'#2F55E4')}</div></div>
  </div>
  <div class="grid ov-grid">
    <section class="live" id="live" aria-label="Созвездие команды">
      <canvas id="cv" aria-hidden="true"></canvas>
      <div class="live-top"><div><span class="tag"><i></i>Живая карта команды</span><h3>Созвездие команды</h3><p>${scope().length} чел. · точки на орбите — открытые задачи, красные просрочены</p></div>
        <div class="seg"><button class="${VIEW==='orbit'?'on':''}" data-view="orbit">${ICON.orbit}Созвездие</button><button class="${VIEW==='org'?'on':''}" data-view="org">${ICON.org}Оргсхема</button></div></div>
      <div class="chips"><button class="${CF==='all'?'on':''}" data-cf="all">Все <em>${scope().length}</em></button>${counts.map(([dp,c])=>`<button class="${CF===dp?'on':''}" data-cf="${esc(dp)}"><i style="background:${deptColor(dp)}"></i>${esc(dp)} <em>${c}</em></button>`).join('')}</div>
      ${VIEW==='org'?orgChart():''}
      <div class="foot"><span>Наведите на точку, чтобы увидеть человека</span><span><b class="num">${act.length}</b> открытых задач · <b class="num" style="color:#FF9A92">${over.length}</b> просрочено</span></div>
    </section>
    <div class="card"><div class="card-h"><div><h3>Пульс дисциплины</h3><p>Выполнение личных планов · 10 дней</p></div><div style="text-align:right"><div class="bigstat"><b class="num">${teamPlan==null?'—':teamPlan+'%'}</b></div>${teamPlan!=null&&prevPlan!=null?`<span class="pill ${teamPlan>=prevPlan?'ok':'bad'}">${teamPlan>=prevPlan?'↗':'↘'} ${Math.abs(teamPlan-prevPlan)} к вчера</span>`:''}</div></div>
      <div class="heat">${heat}</div>
      <div class="legend">меньше <i style="background:rgba(47,85,228,.15)"></i><i style="background:rgba(47,85,228,.4)"></i><i style="background:rgba(47,85,228,.7)"></i><i style="background:rgba(47,85,228,1)"></i> больше</div>
    </div>
  </div>
  <div class="grid low-grid">
    <div class="card"><div class="card-h"><div><h3>Сотрудники</h3><p>Задачи и план дня каждого</p></div>${isMgr()?`<button class="btn sm" data-act="invite">${ICON.plus}Пригласить</button>`:''}</div>
      ${rows?`<div class="scroll"><table class="tbl"><thead><tr><th>Сотрудник</th><th class="hide-s">Отдел</th><th class="n">В работе</th><th class="n">Просрочено</th><th>План дня</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Здесь появятся ваши сотрудники</div>'}</div>
    <div class="card"><div class="card-h"><div><h3>Требует внимания</h3><p>Просрочено и срок сегодня</p></div><span class="pill bad num">${attention.length}</span></div>
      <div>${attention.length ? attention.map(taskRow).join('') : '<div class="empty">Просрочек и задач на сегодня нет</div>'}</div></div>
  </div>`;
}
function orgChart(){
  const sc = scope();
  const top = sc.filter(u=>!sc.some(x=>x.id===u.boss));
  const lvl = arr => arr.map(u=>`<div class="nd"><b>${esc(u.name)}</b><small>${esc(u.title||u.dept)}</small></div>`).join('');
  let html = `<div class="org"><div class="lvl">${lvl(top)}</div>`;
  const mids = sc.filter(u=>top.some(t=>t.id===u.boss) && (CF==='all'||u.dept===CF));
  if(mids.length) html += `<div class="lvl">${lvl(mids)}</div>`;
  const low = sc.filter(u=>mids.some(m=>m.id===u.boss));
  if(low.length) html += `<div class="lvl">${lvl(low)}</div>`;
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
    people = scope();
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
  const pos = (nd, t) => {
    if(nd.isTop && !(nd.u.boss)) { const tops = nodes.filter(n=>n.isTop); if(tops.length===1) return [cx(), cy()]; }
    const base = (nd.di/Math.max(1,depts.length)) * Math.PI*2 - Math.PI/2;
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
        ctx.fillStyle = dim ? 'rgba(10,15,60,.4)' : 'rgba(10,15,60,.85)'; ctx.font = `700 ${nd.isTop?12:r>8?10:9}px Onest, system-ui, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(nd.u.name.slice(0,1), x, y+.5);
        if(!dim && (nd.isTop || nd.u.role==='manager' || W>700)){ ctx.fillStyle='rgba(232,236,255,.75)'; ctx.font='600 10.5px Onest, system-ui, sans-serif'; ctx.fillText(nd.u.name.split(' ')[0], x, y+r+13+(nd.tasks.length?6:0)); }
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
      <div class="meta"><span>${esc(a.name)}</span><span>Срок: ${t.due===TODAY?'сегодня':fmt(t.due)}</span><span class="p-${t.priority}">${PRIO[t.priority]}</span>${t.remind?`<span>⏰ ${fmtDT(t.remind)}</span>`:''}${t.comments.length?`<span>💬 ${t.comments.length}</span>`:''}</div></div>
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
  const bgcols = days.map((d,i)=>{ const x=new Date(d+'T12:00:00'); return (x.getDay()===0||x.getDay()===6) ? `<span class="bgcol" style="left:${i*cw}%;width:${cw}%;background:rgba(238,240,247,.7)"></span>` : ''; }).join('');
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
        <div class="cap"><svg viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true"><path d="${capPath}" fill="none" stroke="#D5DBF5" stroke-width="5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((p,i)=>i<N-1&&(dueCount[i]||dueCount[i+1])?`<path d="M${p[0]} ${p[1]} L${pts[i+1][0]} ${pts[i+1][1]}" stroke="#2F55E4" stroke-width="5" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`:'').join('')}</svg>
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
  DAY = DAY || TODAY;
  const items = plansFor(S.me, DAY), p = planPct(S.me, DAY);
  const days = Array.from({length:7},(_,i)=>addDays(TODAY,i-6));
  const hs = S.habits;
  const dlabel = DAY===TODAY ? 'Сегодня' : DAY===addDays(TODAY,1) ? 'Завтра' : DAY===addDays(TODAY,-1) ? 'Вчера' : fmt(DAY);
  const streak = hs.length ? Math.round(hs.reduce((a,h)=>a+days.filter(d=>h.days[d]).length,0)/(hs.length*7)*100) : 0;
  return header('Планы', 'Мои планы') + `
  <div class="grid plans">
    <div class="card">
      <div class="card-h"><div><h3>План на день</h3><p>Вечером бот напомнит, что осталось</p></div><div class="daynav"><button data-act="day-" aria-label="Предыдущий день">‹</button><span>${dlabel}</span><button data-act="day+" aria-label="Следующий день">›</button></div></div>
      <div class="ringrow">${ring(p,84)}<div><b class="num">${p==null?'—':p+'%'}</b><small>${items.filter(x=>x.done).length} из ${items.length} выполнено</small></div></div>
      ${items.map(it=>`<div class="plan-item ${it.done?'done':''}"><button class="check ${it.done?'on':''}" data-plan="${it.id}" data-done="${it.done?1:0}" aria-label="Отметить">${ICON.tick}</button><span>${esc(it.text)}</span><button class="del" data-pdel="${it.id}" aria-label="Удалить">✕</button></div>`).join('') || '<div class="empty">На этот день планов нет — добавьте первый пункт.</div>'}
      <form class="add" id="add-plan"><input id="plan-text" placeholder="Например: встреча с поставщиком в 15:00" aria-label="Новый пункт плана" autocomplete="off"><button class="btn primary" type="submit">Добавить</button></form>
    </div>
    <div class="card">
      <div class="card-h"><div><h3>Привычки</h3><p>Последние 7 дней</p></div><span class="pill blue num">${streak}% недели</span></div>
      <div class="scroll"><table class="habits"><thead><tr><th>Привычка</th>${days.map(d=>{const x=new Date(d+'T12:00:00');return `<th class="${d===TODAY?'today':''}">${WD[x.getDay()]}<br><span class="num">${x.getDate()}</span></th>`}).join('')}<th></th></tr></thead>
      <tbody>${hs.map(h=>`<tr><td>${esc(h.name)}</td>${days.map(d=>`<td><button class="hb ${h.days[d]?'on':''}" data-hab="${h.id}|${d}" aria-label="${esc(h.name)} ${d}">${ICON.tick}</button></td>`).join('')}<td><button class="del" style="opacity:.5" data-hdel="${h.id}" aria-label="Удалить привычку">✕</button></td></tr>`).join('') || `<tr><td colspan="9" class="empty">Привычек пока нет. Например: «Чтение 20 минут» или «Спорт».</td></tr>`}</tbody></table></div>
      <form class="add" id="add-habit"><input id="habit-text" placeholder="Новая привычка" aria-label="Новая привычка" autocomplete="off"><button class="btn" type="submit">Добавить</button></form>
    </div>
  </div>`;
}

/* ---------- команда ---------- */
function vTeam(){
  const list = S.users.filter(u => !F.q || (u.name+u.title+u.dept).toLowerCase().includes(F.q.toLowerCase()));
  const vis = id => S.scope.includes(id);
  return header('Команда<span>›</span>Люди', 'Команда', isMgr()?`<button class="btn primary" data-act="invite">${ICON.plus}Пригласить</button>`:'') + `<div class="grid team">${list.map(u=>{
    const mine=S.tasks.filter(t=>t.assignee===u.id), a=mine.filter(t=>t.status!=='done').length, od=mine.filter(late).length, dn=mine.filter(t=>t.status==='done').length;
    const p=planPct(u.id,TODAY), boss = u.boss ? U(u.boss).name : null;
    return `<div class="card tc"><div class="person">${av(u,42)}<div><b>${esc(u.name)}</b><small>${esc(u.title||roleName(u))} · ${esc(u.dept)}</small>${u.title&&roleName(u)?`<small>Роль: ${esc(roleName(u))}</small>`:''}${boss?`<small>Руководитель: ${esc(boss)}</small>`:''}</div></div>
      ${vis(u.id)?`<div class="stats"><div><b class="num">${a}</b><small>в работе</small></div><div><b class="num" style="color:${od?'var(--bad)':'inherit'}">${od}</b><small>просрочено</small></div><div><b class="num">${dn}</b><small>готово</small></div></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span>План дня</span><span class="num" style="color:var(--ink);font-weight:700">${p==null?'—':p+'%'}</span></div>
      <div class="bar"><i style="width:${p||0}%"></i></div>`:'<p class="note">Задачи этого сотрудника видит его руководитель.</p>'}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:8px;flex-wrap:wrap"><span class="chip ${u.tg?'s-progress':'s-new'}">${u.tg?'Telegram подключён':'Уведомления выключены'}</span>
      <span style="display:flex;gap:6px">${isOwner()&&u.id!==S.me?`<button class="btn sm" data-act="editm" data-id="${u.id}">Изменить</button>`:''}${vis(u.id)&&u.id!==S.me&&isMgr()?`<button class="btn sm" data-act="new" data-for="${u.id}">${ICON.plus}Задача</button>`:''}</span></div></div>`; }).join('')}</div>`;
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
      <div class="card"><div class="card-h"><div><h3>Профиль</h3><p>${esc(me().name)} · ${esc(S.company.name)}</p></div></div>
        <div class="field"><label for="switchco2">Компания</label>${coSwitch('switchco2')}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="profile">Изменить имя${isOwner()?' и компанию':''}</button><button class="btn sm" data-act="logout">Выйти</button></div></div>
    </div>
  </div>`;
}

/* ---------- окна ---------- */
const modal = html => { $('modal').innerHTML = `<div class="ov" data-close="1">${html}</div>`; };
function closeModal(){ $('modal').innerHTML=''; }
function openNew(forUser){
  const mgr = isMgr(), pool = mgr ? scope() : [me()];
  const opts = pool.map(u=>`<option value="${u.id}" ${String(u.id)===String(forUser||(mgr?'':S.me))?'selected':''}>${esc(u.name)}${u.title?' — '+esc(u.title):''}</option>`).join('');
  modal(`<form class="modal" id="new-task" role="dialog" aria-label="Новая задача">
    <h2>${mgr?'Поставить задачу':'Личная задача'}</h2>
    <div class="field"><label for="n-title">Что нужно сделать</label><input id="n-title" required placeholder="Что нужно сделать" autocomplete="off"></div>
    <div class="field"><label for="n-desc">Подробности</label><textarea id="n-desc" placeholder="Необязательно"></textarea></div>
    <div class="frow"><div class="field"><label for="n-who">Исполнитель</label><select id="n-who" required>${mgr&&!forUser?'<option value="" disabled selected>Выберите</option>':''}${opts}</select></div>
    <div class="field"><label for="n-prio">Приоритет</label><select id="n-prio"><option value="high">Высокий</option><option value="medium" selected>Средний</option><option value="low">Низкий</option></select></div></div>
    <div class="frow"><div class="field"><label for="n-due">Срок</label><input type="date" id="n-due" value="${addDays(TODAY,1)}" required></div>
    <div class="field"><label for="n-rem">Напомнить в Telegram</label><input type="datetime-local" id="n-rem"></div></div>
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
    <dl class="dl"><dt>Исполнитель</dt><dd>${esc(a.name)}${a.title?' · '+esc(a.title):''}</dd><dt>Поставил</dt><dd>${esc(au.name)}</dd><dt>Срок</dt><dd>${fmt(t.due)}</dd><dt>Приоритет</dt><dd class="p-${t.priority}">${PRIO[t.priority]}</dd><dt>Напоминание</dt><dd>${t.remind?fmtDT(t.remind):'нет'}</dd></dl>
    ${canStatus?`<div class="field"><label>Статус</label></div><div class="stat-row">${Object.keys(STATUS).map(s=>`<button type="button" class="${t.status===s?'sel':''}" data-status="${t.id}|${s}">${STATUS[s]}</button>`).join('')}</div>`:''}
    <div class="field"><label>Комментарии</label></div>
    ${t.comments.map(c=>`<div class="cm"><b>${esc(U(c.u).name)}</b><time>${fmtDT(c.at)}</time><div>${esc(c.t)}</div></div>`).join('') || '<div class="note" style="margin-bottom:8px">Пока нет комментариев</div>'}
    <form class="add" id="add-cm" data-id="${t.id}"><input id="cm-text" placeholder="Написать комментарий" aria-label="Комментарий" autocomplete="off"><button class="btn" type="submit">Отправить</button></form>
    <div class="mact">${t.author===S.me||isOwner()?`<button type="button" class="btn" data-delete="${t.id}" style="color:var(--bad)">Удалить задачу</button>`:''}<button type="button" class="btn" data-close="1">Закрыть</button></div>
  </div>`);
}
function deptOptions(sel){ return S.depts.map(d=>`<option value="${d.id}" ${String(sel)===String(d.id)?'selected':''}>${esc(d.name)}</option>`).join('') + '<option value="new">+ Новый отдел…</option>'; }
function openInvite(){
  const myDept = me().deptId;
  modal(`<form class="modal" id="invite-form" role="dialog" aria-label="Пригласить сотрудника">
    <h2>Пригласить сотрудника</h2>
    <p class="note" style="margin:-6px 0 14px">Создадим ссылку. Отправьте её сотруднику в Telegram — он войдёт и сразу попадёт в вашу команду.</p>
    <div class="frow"><div class="field"><label for="i-title">Должность</label><input id="i-title" placeholder="Должность сотрудника"></div>
    <div class="field"><label for="i-dept">Отдел</label><select id="i-dept">${deptOptions(isOwner()?'':myDept)}</select></div></div>
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
    <div class="frow"><div class="field"><label for="e-title">Должность</label><input id="e-title" value="${esc(u.title)}"></div>
    <div class="field"><label for="e-dept">Отдел</label><select id="e-dept">${deptOptions(u.deptId)}</select></div></div>
    <div class="field" id="e-newdept-f" hidden><label for="e-newdept">Название нового отдела</label><input id="e-newdept"></div>
    <div class="frow">${u.owner?'':`<div class="field"><label for="e-role">Роль</label>${roleSelect('e-role',u.level)}</div>`}
    <div class="field" id="e-boss-f" ${u.level==='founder'?'hidden':''}><label for="e-boss">Подчиняется</label><select id="e-boss"><option value="">—</option>${bossOptions(id, u.boss)}</select></div></div>
    <div class="mact">${u.owner?'':`<button type="button" class="btn" data-act="deactivate" data-id="${id}" style="color:var(--bad);margin-right:auto">Убрать из команды</button>`}<button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div>
  </form>`);
}
function openProfile(){
  modal(`<form class="modal" id="profile-form" role="dialog" aria-label="Профиль"><h2>Ваш профиль</h2>
    <div class="field"><label for="p-name">Имя и фамилия</label><input id="p-name" value="${esc(me().name)}" required></div>
    ${isOwner()?`<div class="field"><label for="p-co">Название компании</label><input id="p-co" value="${esc(S.company.name)}" required></div>`:''}
    <div class="mact"><button type="button" class="btn" data-close="1">Отмена</button><button class="btn primary" type="submit">Сохранить</button></div></form>`);
}

/* ---------- рендер ---------- */
function render(){
  if(!S) return;
  if(!$('nav')) shell();
  renderNav();
  const r = current();
  $('main').innerHTML = {overview:vOverview, tasks:vTasks, plans:vPlans, team:vTeam, alerts:vAlerts}[r]();
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
  shell(); render();
}

/* ---------- события ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-open],[data-tick],[data-plan],[data-pdel],[data-hdel],[data-hab],[data-status],[data-close],[data-delete],[data-sw],[data-cf],[data-view],[data-mode]');
  if(!el) return;
  if(el.dataset.close && e.target !== el && !e.target.closest('button[data-close]')) return;
  if(el.dataset.tick){ e.stopPropagation(); const t=S.tasks.find(x=>x.id===Number(el.dataset.tick)); const ns = t.status==='done'?'progress':'done';
    return act(()=>api('PATCH','/api/tasks/'+t.id,{status:ns}), ns==='done'?(t.author&&t.author!==S.me?'Готово — '+U(t.author).name+' получит уведомление':'Готово'):'Задача снова в работе'); }
  if(el.dataset.open) return openTask(Number(el.dataset.open));
  if(el.dataset.close) return closeModal();
  if(el.dataset.cf){ CF = el.dataset.cf; return render(); }
  if(el.dataset.view){ VIEW = el.dataset.view; return render(); }
  if(el.dataset.mode){ F.mode = el.dataset.mode; return render(); }
  if(el.dataset.status){ const [id,s]=el.dataset.status.split('|'); return act(async()=>{ await api('PATCH','/api/tasks/'+id,{status:s}); }, 'Статус: '+STATUS[s]).then(()=>openTask(Number(id))); }
  if(el.dataset.delete){ const id = el.dataset.delete; if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно удалить?'; return; } closeModal(); return act(()=>api('DELETE','/api/tasks/'+id),'Задача удалена'); }
  if(el.dataset.plan) return act(()=>api('PATCH','/api/plans/'+el.dataset.plan,{done: el.dataset.done!=='1'}));
  if(el.dataset.pdel) return act(()=>api('DELETE','/api/plans/'+el.dataset.pdel));
  if(el.dataset.hdel){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.style.opacity=1; el.style.color='var(--bad)'; el.textContent='Удалить?'; return; } return act(()=>api('DELETE','/api/habits/'+el.dataset.hdel),'Привычка удалена'); }
  if(el.dataset.hab){ const [hid,d]=el.dataset.hab.split('|'); return act(()=>api('POST','/api/habits/'+hid+'/toggle',{day:d})); }
  if(el.dataset.sw){ const k=el.dataset.sw; const cur = mySettings()[k]!==false; return act(()=>api('PATCH','/api/settings',{[k]:!cur}),'Настройка сохранена'); }
  const a = el.dataset.act;
  if(a==='new') return openNew(el.dataset.for);
  if(a==='invite') return openInvite();
  if(a==='editm') return openEditMember(Number(el.dataset.id));
  if(a==='profile') return openProfile();
  if(a==='deactivate'){ if(el.dataset.confirm!=='1'){ el.dataset.confirm='1'; el.textContent='Точно убрать?'; return; } closeModal(); return act(()=>api('PATCH','/api/members/'+el.dataset.id,{active:false}),'Сотрудник убран из команды'); }
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
      await api('POST','/api/tasks',{title, desc:$('n-desc').value, assignee:Number(who), priority:$('n-prio').value, due:$('n-due').value, remind:$('n-rem').value||null});
      closeModal(); await reload(); render(); return toast(Number(who)!==S.me ? `Задача поставлена — ${U(Number(who)).name} получит уведомление` : 'Задача добавлена');
    }
    if(f.id==='add-plan'){ const v=$('plan-text').value.trim(); if(!v) return; await api('POST','/api/plans',{day:DAY,text:v}); await reload(); render(); $('plan-text')?.focus(); return; }
    if(f.id==='add-habit'){ const v=$('habit-text').value.trim(); if(!v) return; await api('POST','/api/habits',{name:v}); await reload(); return render(); }
    if(f.id==='add-cm'){ const v=$('cm-text').value.trim(); if(!v) return; await api('POST','/api/tasks/'+f.dataset.id+'/comments',{text:v}); await reload(); render(); openTask(Number(f.dataset.id)); return toast('Комментарий отправлен'); }
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
      await api('PATCH','/api/members/'+f.dataset.id, body); closeModal(); await reload(); render(); return toast('Сохранено');
    }
    if(f.id==='profile-form'){ await api('PATCH','/api/profile',{name:$('p-name').value}); if($('p-co')) await api('PATCH','/api/company',{name:$('p-co').value}); closeModal(); ME = await api('GET','/api/me'); await reload(); shell(); render(); return toast('Сохранено'); }
    if(f.id==='newco'){ await api('POST','/api/company',{name:$('co-name').value, title:$('co-title').value, myName:$('co-me').value}); return boot(); }
    if(f.id==='devlogin'){ await api('POST','/api/auth/dev',{name:$('devname').value}); return boot(); }
  } catch(err){ toast(err.message); }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if(id==='f-who'){ F.who = e.target.value; return render(); }
  if(id==='i-dept') $('i-newdept-f').hidden = e.target.value!=='new';
  if(id==='e-dept') $('e-newdept-f').hidden = e.target.value!=='new';
  if(id==='i-role'){ const f = e.target.value==='founder'; $('i-boss-f').hidden = f; $('i-founder-note').hidden = !f; }
  if(id==='e-role') $('e-boss-f').hidden = e.target.value==='founder';
  if(id==='switchco' || id==='switchco2'){ if(e.target.value==='new'){ S=null; return screenOnboard(true); } return (async()=>{ await api('POST','/api/switch',{memberId:Number(e.target.value)}); location.hash=''; ME = await api('GET','/api/me'); await reload(); shell(); render(); toast('Компания: '+S.company.name); })(); }
  if(id==='s-morning'||id==='s-evening'||id==='s-before') return act(()=>api('PATCH','/api/settings',{[id.slice(2)]: e.target.value}),'Настройка сохранена');
});
document.addEventListener('keydown', e => {
  if(e.key==='Escape') closeModal();
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); $('gsearch')?.focus(); }
  if(e.key==='Enter' && e.target.id==='gsearch'){ F.q = e.target.value.trim(); if(current()!=='team' && current()!=='tasks') location.hash='tasks'; render(); }
});
window.addEventListener('hashchange', render);
// обновление данных раз в 30 секунд, пока вкладка открыта и нет открытого окна
setInterval(async () => { if(!S || document.hidden || $('modal').innerHTML || document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return; try { await reload(); render(); } catch(e){} }, 30000);
boot();
})();
