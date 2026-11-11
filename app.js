'use strict';
/* Max Control · artes e feriados · v2 */
const $ = id => document.getElementById(id);
const K = { data:'maxcontrol_v5', meta:'maxcontrol_meta_v5', sync:'maxcontrol_sync_v1', active:'maxcontrol_active_v1', collapse:'max-control-client-list-collapsed-v1', old4:'max-control-campaigns-and-clients-v4', old1:'max-control-items-v1' };
const SEED = ['ACADEMIA MAX FIT','BORBOLETAS OUTLET','CENTRAL MAGAZINE','CLINICA DR. IANKY CAMPOS','CLÍNICA DR. IRAN CAMPOS','CLINICA DRA. JANINE SUASSUNA','DS DESIGNER','GALEGO DOS BONES','GATO A JATO','GC MOTOS'];
const RM = matchMedia('(prefers-reduced-motion:reduce)').matches, FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const LINES = ['#1d1d1f', '#a5a5aa', '#6a6a70'];

/* ───── utilidades ───── */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const cleanName = r => String(r || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('pt-BR').slice(0, 100);
const cleanCamp = r => String(r || '').replace(/\s+/g, ' ').trim().slice(0, 70);
const keyOf = n => String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const diffDays = s => Math.round((toDate(s) - toDate(today())) / 864e5);
const fmtD = s => isISO(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
const fmtDY = s => isISO(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
const fmtDT = ts => new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
const safeFile = s => cleanCamp(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55).toLowerCase() || 'campanha';
const initials = n => String(n).split(' ').filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const clone = o => JSON.parse(JSON.stringify(o));

/* ───── estado ───── */
const DEFAULT_CATS = () => [{ id:'lojas', name:'Loja', u:0 }, { id:'normal', name:'Normal', u:0 }];
let S = { clients:[], cats:DEFAULT_CATS(), campaigns:[], tomb:{}, ign:[], reviewed:false };
let activeId = null, meta = { lastBackupAt:null, lastChangeAt:null, syncedFor:null, dsLast:0 };
let U = { catF:'todos', statF:'todos', sort:'az', q:'', editing:null, selected:new Set(), vis:[], dlg:null, markFor:null, dsPending:null };
let undoStack = [];

function normMark(m) {
  if (!m || typeof m !== 'object') return null;
  return { d:m.d ? 1 : 0, o:m.o ? 1 : 0, due:isISO(m.due) ? m.due : '', n:typeof m.n === 'string' ? m.n.slice(0, 300) : '', u:Number(m.u) || 0 };
}
function normDoc(raw) {
  const o = { clients:[], cats:[], campaigns:[], tomb:{}, ign:[], reviewed:false };
  if (!raw || typeof raw !== 'object') return o;
  const seenC = new Set();
  (Array.isArray(raw.cats) ? raw.cats : []).forEach(c => { if (c && typeof c.id === 'string' && c.id && typeof c.name === 'string' && !seenC.has(c.id)) { seenC.add(c.id); o.cats.push({ id:c.id, name:cleanCamp(c.name).slice(0, 30) || 'Categoria', u:Number(c.u) || 0 }); } });
  if (!o.cats.length) o.cats = DEFAULT_CATS();
  const seen = new Set();
  (Array.isArray(raw.clients) ? raw.clients : []).forEach(c => {
    if (!c || typeof c.name !== 'string') return;
    const name = cleanName(c.name); if (!name) return;
    let id = typeof c.id === 'string' && c.id ? c.id : uid(); if (seen.has(id)) id = uid(); seen.add(id);
    const cat = o.cats.some(x => x.id === c.category) ? c.category : o.cats[0].id;
    o.clients.push({ id, name, category:cat, ds:typeof c.ds === 'string' ? c.ds : '', logo:typeof c.logo === 'string' && /^https?:\/\//.test(c.logo) ? c.logo : '', u:Number(c.u) || 0 });
  });
  const ids = new Set(o.clients.map(c => c.id)), seenK = new Set();
  (Array.isArray(raw.campaigns) ? raw.campaigns : []).forEach(c => {
    if (!c || typeof c.name !== 'string' || !cleanCamp(c.name)) return;
    let id = typeof c.id === 'string' && c.id ? c.id : uid(); if (seenK.has(id)) id = uid(); seenK.add(id);
    const marks = {};
    if (c.marks && typeof c.marks === 'object') Object.keys(c.marks).forEach(k => { if (ids.has(k)) { const m = normMark(c.marks[k]); if (m) marks[k] = m; } });
    else if (Array.isArray(c.doneIds)) c.doneIds.forEach(k => { if (ids.has(k)) marks[k] = { d:1, o:0, due:'', n:'', u:0 }; });
    o.campaigns.push({ id, name:cleanCamp(c.name), date:isISO(c.date) ? c.date : '', createdAt:typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(), marks, u:Number(c.u) || 0 });
  });
  if (raw.tomb && typeof raw.tomb === 'object') Object.keys(raw.tomb).forEach(k => { o.tomb[k] = Number(raw.tomb[k]) || 0; });
  o.ign = Array.isArray(raw.ign) ? [...new Set(raw.ign.filter(x => typeof x === 'string'))] : [];
  o.reviewed = !!raw.reviewed;
  return o;
}
const docOf = () => ({ v:5, clients:S.clients, cats:S.cats, campaigns:S.campaigns, tomb:S.tomb, ign:S.ign, reviewed:S.reviewed });
function canon(d) {
  const by = (a, b) => a.id < b.id ? -1 : 1;
  return JSON.stringify({
    c:[...d.clients].sort(by).map(c => [c.id, c.name, c.category, c.ds, c.logo, c.u]),
    k:[...d.cats].sort(by).map(c => [c.id, c.name, c.u]),
    p:[...d.campaigns].sort(by).map(c => [c.id, c.name, c.date, c.u, Object.keys(c.marks).sort().map(k => [k, c.marks[k].d, c.marks[k].o, c.marks[k].due, c.marks[k].n, c.marks[k].u])]),
    t:Object.keys(d.tomb).sort().map(k => [k, d.tomb[k]]), i:[...d.ign].sort(), r:d.reviewed });
}
function loadState() {
  try { const st = JSON.parse(localStorage.getItem(K.data)); if (st && Array.isArray(st.clients)) { S = normDoc(st); return false; } } catch (e) {}
  /* migração das versões antigas */
  let old = null;
  try { const v4 = JSON.parse(localStorage.getItem(K.old4)); if (v4 && Array.isArray(v4.clients)) old = { clients:v4.clients, campaigns:v4.campaigns, active:v4.activeCampaignId }; } catch (e) {}
  if (!old) try { const v1 = JSON.parse(localStorage.getItem(K.old1)); if (Array.isArray(v1)) old = { clients:v1, campaigns:[{ id:uid(), name:'Campanha anterior (importada)', doneIds:v1.filter(x => x.done).map(x => x.id) }] }; } catch (e) {}
  if (old) { S = normDoc(old); if (old.active) activeId = old.active; }
  if (!S.clients.length && !old) { S = normDoc({ clients:SEED.map((n, i) => ({ id:'seed-' + i, name:n, category:'lojas' })) }); }
  if (!S.campaigns.length) S.campaigns.push({ id:uid(), name:'Campanha inicial', date:'', createdAt:new Date().toISOString(), marks:{}, u:0 });
  return true;
}
const A = () => S.campaigns.find(c => c.id === activeId) || S.campaigns[0];
const catName = id => (S.cats.find(c => c.id === id) || { name:'—' }).name;
const mk = (c, cid) => c.marks[cid] || { d:0, o:0, due:'', n:'', u:0 };
function setMark(c, cid, patch) { const t = Date.now(), m = Object.assign({}, mk(c, cid), patch, { u:t }); c.marks[cid] = m; c.u = t; }
const partic = c => S.clients.filter(x => !mk(c, x.id).o);
const isDone = (c, cid) => !!mk(c, cid).d && !mk(c, cid).o;
const isLate = (c, cl) => { const m = mk(c, cl.id); return !m.d && !m.o && m.due && m.due < today(); };
function stats(c, cat) {
  const list = partic(c).filter(x => !cat || x.category === cat);
  return { done:list.filter(x => mk(c, x.id).d).length, total:list.length };
}

/* ───── persistência, desfazer ───── */
function persist(markChanged = true) {
  try {
    if (markChanged) meta.lastChangeAt = Date.now();
    localStorage.setItem(K.data, JSON.stringify(docOf()));
    localStorage.setItem(K.meta, JSON.stringify(meta));
    localStorage.setItem(K.active, activeId || '');
    return true;
  } catch (e) { toast('Não foi possível salvar neste navegador. Faça um backup.', 'err'); return false; }
}
function save(opts = {}) {
  if (U.editing && !S.clients.some(x => x.id === U.editing)) U.editing = null;
  persist(); renderAll(); scheduleSync();
}
function pushUndo() { undoStack.push(JSON.stringify(docOf())); if (undoStack.length > 25) undoStack.shift(); }
function undo() {
  const j = undoStack.pop(); if (!j) { toast('Nada para desfazer.'); return; }
  const prev = S, next = normDoc(JSON.parse(j)), t = Date.now();
  const had = (arr, id) => arr.find(x => x.id === id);
  next.clients.forEach(c => { const p = had(prev.clients, c.id); if (!p || JSON.stringify(p) !== JSON.stringify(c)) c.u = t; delete next.tomb[c.id]; });
  next.cats.forEach(c => { const p = had(prev.cats, c.id); if (!p || JSON.stringify(p) !== JSON.stringify(c)) c.u = t; delete next.tomb[c.id]; });
  next.campaigns.forEach(c => { const p = had(prev.campaigns, c.id); delete next.tomb[c.id];
    if (!p) { c.u = t; Object.values(c.marks).forEach(m => m.u = t); return; }
    if (p.name !== c.name || p.date !== c.date) c.u = t;
    Object.keys(c.marks).forEach(k => { if (JSON.stringify(p.marks[k]) !== JSON.stringify(c.marks[k])) c.marks[k].u = t; });
    Object.keys(p.marks).forEach(k => { if (!c.marks[k]) c.marks[k] = { d:0, o:0, due:'', n:'', u:t }; });
  });
  prev.clients.forEach(c => { if (!had(next.clients, c.id) && !next.tomb[c.id]) next.tomb[c.id] = t; });
  prev.campaigns.forEach(c => { if (!had(next.campaigns, c.id) && !next.tomb[c.id]) next.tomb[c.id] = t; });
  S = next; if (!S.campaigns.some(c => c.id === activeId)) activeId = S.campaigns[0]?.id;
  U.selected.clear(); save(); toast('Desfeito.');
}

/* ───── avisos ───── */
function toast(msg, type = 'ok', withUndo = false) {
  const z = $('toasts'), e = document.createElement('div');
  e.className = 'toast' + (type === 'err' ? ' err' : '');
  e.innerHTML = `<span>${esc(msg)}</span>${withUndo ? '<button type="button" data-undo>Desfazer</button>' : ''}`;
  while (z.children.length >= 2) z.firstChild.remove();
  z.appendChild(e);
  setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 250); }, withUndo ? 7000 : 3200);
}
$('toasts').addEventListener('click', e => { if (e.target.closest('[data-undo]')) { undo(); e.target.closest('.toast').remove(); } });

/* ───── feriados ───── */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function nthWeekday(y, m, wd, n) { const first = new Date(y, m, 1); const off = (wd - first.getDay() + 7) % 7; return new Date(y, m, 1 + off + 7 * (n - 1)); }
function holidays(y) {
  const E = easter(y), D = (m, d) => new Date(y, m - 1, d);
  return [['Ano Novo', D(1, 1)], ['Dia da Mulher', D(3, 8)], ['Dia do Consumidor', D(3, 15)], ['Carnaval', addDays(E, -47)], ['Sexta-feira Santa', addDays(E, -2)], ['Páscoa', E],
    ['Tiradentes', D(4, 21)], ['Dia do Trabalho', D(5, 1)], ['Dia das Mães', nthWeekday(y, 4, 0, 2)], ['Dia dos Namorados', D(6, 12)], ['Corpus Christi', addDays(E, 60)], ['São João', D(6, 24)],
    ['Dia do Amigo', D(7, 20)], ['Dia dos Avós', D(7, 26)], ['Dia dos Pais', nthWeekday(y, 7, 0, 2)], ['Independência do Brasil', D(9, 7)], ['Dia do Cliente', D(9, 15)],
    ['Dia das Crianças', D(10, 12)], ['Dia dos Professores', D(10, 15)], ['Halloween', D(10, 31)], ['Finados', D(11, 2)], ['Proclamação da República', D(11, 15)],
    ['Consciência Negra', D(11, 20)], ['Black Friday', nthWeekday(y, 10, 5, 4)], ['Natal', D(12, 25)], ['Réveillon', D(12, 31)]].map(([name, d]) => ({ name, date:iso(d), year:y }));
}
function upcoming(n = 10) {
  const y = new Date().getFullYear(), t = today();
  return [...holidays(y), ...holidays(y + 1)].filter(h => h.date >= t).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, n);
}
const campOf = h => S.campaigns.find(c => keyOf(c.name) === keyOf(`${h.name} ${h.year}`));

/* ───── campanhas ───── */
function newCampaign(name, date = '', marks = {}) {
  const t = Date.now();
  return { id:uid(), name:cleanCamp(name) || 'Campanha sem nome', date:isISO(date) ? date : '', createdAt:new Date().toISOString(), marks, u:t };
}
function createCampaign(name, date) {
  pushUndo(); const c = newCampaign(name, date); S.campaigns.push(c); activeId = c.id; resetFilters(); save(); toast(`Campanha “${c.name}” criada.`, 'ok', true);
}
function resetFilters() { U.catF = 'todos'; U.statF = 'todos'; U.q = ''; U.selected.clear(); U.editing = null; $('search').value = ''; $('statusSel').value = 'todos'; }
function switchCampaign(id) { if (id === activeId || !S.campaigns.some(c => c.id === id)) return; activeId = id; resetFilters(); persist(false); renderAll(); }

/* ───── desenho ───── */
function avatarHTML(c) {
  const ini = esc(initials(c.name));
  return c.logo
    ? `<span class="avw"><img class="av" src="${esc(c.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="av ini" style="display:none">${ini}</span></span>`
    : `<span class="avw"><span class="av ini">${ini}</span></span>`;
}
let firstPaint = true;
function setNum(id, val) {
  const el = $(id), first = el.dataset.v === undefined; el.dataset.v = val;
  if (first && !RM && val > 0) {
    const t0 = performance.now(), step = t => { if (el.dataset.v !== String(val)) { el.textContent = el.dataset.v; return; } const k = Math.min(1, (t - t0) / 800); el.textContent = Math.round(val * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  } else el.textContent = val;
}
function renderSidebar() {
  const counts = { todos:S.clients.length };
  S.cats.forEach(c => counts[c.id] = S.clients.filter(x => x.category === c.id).length);
  const dots = ['d1', 'd2', 'd3'];
  $('cats').innerHTML = `<button type="button" class="cat ${U.catF === 'todos' ? 'active' : ''}" data-cat="todos"><i class="dot d0"></i>Todos<b>${counts.todos}</b></button>` +
    S.cats.map((c, i) => `<button type="button" class="cat ${U.catF === c.id ? 'active' : ''}" data-cat="${esc(c.id)}"><i class="dot ${dots[i] || 'd2'}"></i>${esc(c.name)}<b>${counts[c.id]}</b></button>`).join('');
  $('catPills').innerHTML = [['todos', 'Todos'], ...S.cats.map(c => [c.id, c.name])].map(([id, n]) => `<button type="button" class="${U.catF === id ? 'active' : ''}" data-cat="${esc(id)}">${esc(n)}</button>`).join('');
  $('newCategory').innerHTML = S.cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  $('bulkCat').innerHTML = '<option value="">Mudar categoria…</option>' + S.cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}
function renderHero() {
  const c = A(), t = today(), st = stats(c), late = partic(c).filter(x => isLate(c, x)).length;
  $('heroName').textContent = c.name;
  let chip = '', when = '';
  if (c.date) {
    const d = diffDays(c.date);
    when = d === 0 ? 'É hoje!' : d > 0 ? `Faltam ${plural(d, 'dia', 'dias')}` : `Passou há ${plural(-d, 'dia', 'dias')}`;
    chip = `<span class="chip dark">${esc(fmtDY(c.date))}</span><span class="chip ${d >= 0 && d <= 7 ? 'warn' : ''}">${esc(when)}</span>`;
  } else chip = '<button type="button" class="chip btn" data-act="camp-date">＋ definir data do feriado</button>';
  if (late) chip += `<span class="chip alert">${plural(late, 'atrasada', 'atrasadas')}</span>`;
  chip += `<span class="chip">${st.done} de ${st.total} prontas</span>`;
  $('heroMeta').innerHTML = chip;
  $('deleteCampaignBtn').disabled = S.campaigns.length < 2;
  $('listTitle').textContent = `Lista de produção · ${c.name}`;
}
function renderHolidays() {
  const list = upcoming(10);
  $('holidayList').innerHTML = list.map(h => {
    const d = diffDays(h.date), ex = campOf(h), dt = toDate(h.date);
    const lab = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;
    return `<div class="hday ${ex ? 'has' : ''}${d <= 14 ? ' soon' : ''}"><div class="hd"><b>${pad(dt.getDate())}</b><span>${dt.toLocaleDateString('pt-BR', { month:'short' }).replace('.', '')}</span></div>
      <div class="hi"><strong>${esc(h.name)}</strong><em>${lab}</em></div>
      ${ex ? `<button type="button" class="hgo" data-hopen="${esc(ex.id)}" title="Abrir a campanha">Abrir</button>` : `<button type="button" class="hgo" data-hname="${esc(h.name)}" data-hdate="${h.date}" data-hyear="${h.year}" title="Criar campanha">＋ Criar</button>`}</div>`;
  }).join('');
}
function renderRing() {
  const c = A(), defs = [[null, 'Total', 52, LINES[0]], ...S.cats.slice(0, 2).map((k, i) => [k.id, k.name, 39 - i * 13, LINES[i + 1]])];
  let svg = '<svg viewBox="0 0 130 130" aria-hidden="true">', leg = '';
  defs.forEach(([cat, label, r, col]) => {
    const s = stats(c, cat), p = s.total ? Math.round(s.done / s.total * 100) : 0, len = 2 * Math.PI * r;
    svg += `<circle cx="65" cy="65" r="${r}" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="8"/><circle class="arc" cx="65" cy="65" r="${r}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(len * p / 100).toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 65 65)"/>`;
    leg += `<li><i style="background:${col}"></i><span>${esc(label)}</span><b>${s.done}/${s.total}</b></li>`;
  });
  const t = stats(c);
  svg += `<text x="65" y="66" text-anchor="middle" class="ring-n">${t.total ? Math.round(t.done / t.total * 100) : 0}%</text><text x="65" y="80" text-anchor="middle" class="ring-s">prontas</text></svg>`;
  $('ringBox').innerHTML = svg; $('ringLegend').innerHTML = leg;
}
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const a = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], b = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${a[0].toFixed(1)},${a[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const pctC = (c, cat) => { const s = stats(c, cat); return s.total ? Math.round(s.done / s.total * 100) : 0; };
function renderChart() {
  const list = S.campaigns.slice(-7), n = list.length, W = 340, H = 236, L = 34, R = 34, T = 30, B = 48, iw = W - L - R, ih = H - T - B;
  const x = i => n === 1 ? L + iw / 2 : L + iw * i / (n - 1), y = p => T + ih * (1 - p / 100), cats = S.cats.slice(0, 3);
  $('legend').innerHTML = cats.map((k, i) => `<li><i style="background:${LINES[i]}"></i>${esc(k.name)}</li>`).join('');
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progresso de cada categoria em cada campanha">`;
  [0, 50, 100].forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(0,0,0,.09)" stroke-dasharray="${v === 0 ? '0' : '3 4'}"/>`; });
  const draw = firstPaint && !RM ? ' class="draw"' : '';
  const pts = cats.map(k => list.map((c, i) => [x(i), y(pctC(c, k.id))]));
  for (let k = cats.length - 1; k >= 0; k--) s += `<path${draw} pathLength="1" d="${smooth(pts[k])}" fill="none" stroke="${LINES[k]}" stroke-width="${k === 0 ? 2.6 : 2.4}" stroke-linecap="round"/>`;
  list.forEach((c, i) => {
    const act = c.id === A().id, name = c.name.length > 10 ? c.name.slice(0, 9) + '…' : c.name;
    cats.forEach((k, j) => { s += `<circle cx="${pts[j][i][0]}" cy="${pts[j][i][1]}" r="${act ? 4.5 : 3}" fill="${act && j === 0 ? LINES[0] : '#fff'}" stroke="${LINES[j]}" stroke-width="2"/>`; });
    if (act) {
      const top = Math.min(...pts.map(p => p[i][1])) - 10, tx = Math.max(24, Math.min(W - 24, x(i)));
      s += `<g><rect x="${tx - 22}" y="${top - 17}" width="44" height="17" rx="6" fill="#1d1d1f"/><text x="${tx}" y="${top - 5}" text-anchor="middle" class="tip">${pctC(c, null)}%</text></g>`;
    }
    const lw = Math.max(34, name.length * 6.6 + 16);
    if (act) s += `<rect x="${x(i) - lw / 2}" y="${H - B + 14}" width="${lw}" height="22" rx="11" fill="#1d1d1f"/>`;
    s += `<text x="${x(i)}" y="${H - B + 29}" text-anchor="middle" class="xl ${act ? 'on' : ''}">${esc(name)}</text>`;
  });
  $('chartBox').innerHTML = s + '</svg>';
}
function renderDash() {
  const c = A(), t = stats(c);
  setNum('bigDone', t.done); setNum('bigCamps', S.campaigns.length);
  setNum('total', t.total); setNum('finished', t.done); setNum('remaining', t.total - t.done);
  $('progressFill').style.width = t.total ? Math.round(t.done / t.total * 100) + '%' : '0%';
  renderRing(); renderChart();
}
function renderCampaignTabs() {
  $('campaignTabs').innerHTML = S.campaigns.map(c => {
    const s = stats(c), p = s.total ? Math.round(s.done / s.total * 100) : 0, act = c.id === A().id;
    const sub = c.date ? (diffDays(c.date) >= 0 ? `${fmtD(c.date)} · em ${diffDays(c.date)}d` : `${fmtD(c.date)} · passou`) : `${s.done} de ${s.total} prontas`;
    return `<button type="button" class="campaign-tab ${act ? 'active' : ''}" role="tab" aria-selected="${act}" data-campaign="${esc(c.id)}" title="Abrir ${esc(c.name)}">
      <span class="mini-ring" style="--p:${p}"><b>${p}%</b></span><span class="campaign-tab-name">${esc(c.name)}</span><span class="campaign-tab-count">${esc(sub)}</span></button>`;
  }).join('') + '<button type="button" class="campaign-tab add-tile js-create"><span class="plus">＋</span><span class="campaign-tab-name">Nova campanha</span></button>';
}
function visibleClients() {
  const c = A(), q = U.q.toLocaleLowerCase('pt-BR');
  let list = S.clients.filter(x => (U.catF === 'todos' || x.category === U.catF) && x.name.toLocaleLowerCase('pt-BR').includes(q));
  list = list.filter(x => {
    const m = mk(c, x.id);
    switch (U.statF) { case 'pend': return !m.d && !m.o; case 'pronta': return m.d && !m.o; case 'atras': return isLate(c, x); case 'fora': return !!m.o; default: return true; }
  });
  const by = (a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity:'base' });
  if (U.sort === 'za') list.sort((a, b) => by(b, a));
  else if (U.sort === 'pend') list.sort((a, b) => (mk(c, a.id).d - mk(c, b.id).d) || by(a, b));
  else if (U.sort === 'prazo') list.sort((a, b) => { const da = mk(c, a.id).due || '9999', db = mk(c, b.id).due || '9999'; return da < db ? -1 : da > db ? 1 : by(a, b); });
  else list.sort(by);
  return list;
}
function renderList() {
  const c = A(), list = visibleClients(); U.vis = list.map(x => x.id);
  U.selected = new Set([...U.selected].filter(id => S.clients.some(x => x.id === id)));
  $('shownCount').textContent = plural(list.length, 'cliente', 'clientes');
  $('selectVisible').disabled = !list.length || clientListCollapsed;
  if (!list.length) {
    const none = !S.clients.length;
    $('items').innerHTML = `<div class="empty"><svg viewBox="0 0 64 64" class="eart" aria-hidden="true"><rect x="8" y="14" width="48" height="38" rx="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M8 26h48M22 8v10M42 8v10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="m24 40 6 6 12-13" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <strong>${none ? 'Nenhum cliente ainda' : 'Nada por aqui'}</strong><span>${none ? 'Entre na conta e clique em “Atualizar do DS Gestão”, ou adicione um cliente.' : 'Tente outra busca ou outro filtro.'}</span></div>`;
    return;
  }
  $('items').innerHTML = list.map(x => {
    const m = mk(c, x.id), done = !!m.d && !m.o, out = !!m.o, editing = U.editing === x.id, sel = U.selected.has(x.id);
    const late = isLate(c, x);
    let dueChip = '';
    if (m.due && !out) { const dd = diffDays(m.due); dueChip = done ? `<span class="chip sm">Entrega ${fmtD(m.due)}</span>` : late ? `<span class="chip sm alert">Atrasada · ${fmtD(m.due)}</span>` : dd === 0 ? '<span class="chip sm warn">Entrega hoje</span>' : `<span class="chip sm">Entrega ${fmtD(m.due)}</span>`; }
    const st = out ? 'Fora da campanha' : done ? 'Pronta' : 'Pendente';
    const nameBlock = editing
      ? `<input class="edit-input" data-action="edit-input" value="${esc(x.name)}" maxlength="100" aria-label="Editar nome"><span class="edit-hint">Enter salva · Esc cancela</span>`
      : `<div class="who">${avatarHTML(x)}<h3 class="name">${esc(x.name)}</h3></div>${m.n ? `<p class="note" title="${esc(m.n)}">${esc(m.n)}</p>` : ''}`;
    const actions = editing
      ? '<button class="icon ok" title="Salvar nome" data-action="save-edit">✓</button><button class="icon" title="Cancelar" data-action="cancel-edit">×</button>'
      : `<select class="catsel" data-action="category" aria-label="Categoria de ${esc(x.name)}">${S.cats.map(k => `<option value="${esc(k.id)}" ${k.id === x.category ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
         <button class="icon" title="Prazo, observação e participação" data-action="details"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg></button>
         ${x.ds ? '' : '<button class="icon" title="Editar nome em todas as campanhas" data-action="edit">✎</button>'}
         <button class="icon del" title="Excluir cliente de todas as campanhas" data-action="delete">×</button>`;
    return `<article class="row ${done ? 'done' : ''} ${out ? 'out' : ''} ${late ? 'late' : ''} ${sel ? 'selected' : ''}" data-id="${esc(x.id)}" tabindex="0">
      <div class="row-top"><label class="pick" title="Selecionar"><input type="checkbox" class="sel" data-action="select" aria-label="Selecionar ${esc(x.name)}" ${sel ? 'checked' : ''}></label>
        <span class="kind">${esc(catName(x.category))}</span>${x.ds ? '<span class="kind ds" title="Vem do DS Gestão">DS</span>' : ''}${dueChip}<span class="status">${st}</span></div>
      <div class="info">${nameBlock}</div>
      <div class="row-bottom"><label class="toggle" title="Marcar como pronta somente nesta campanha"><input type="checkbox" data-action="check" aria-label="Marcar ${esc(x.name)} como pronta" ${done ? 'checked' : ''} ${out ? 'disabled' : ''}><span class="box" aria-hidden="true"></span><span class="tl">${out ? 'Fora' : done ? 'Pronta' : 'Marcar pronta'}</span></label>
        <div class="actions">${actions}</div></div></article>`;
  }).join('');
}
function renderBackup() {
  const pend = meta.lastChangeAt && (!meta.lastBackupAt || meta.lastChangeAt > meta.lastBackupAt);
  $('backupText').textContent = !meta.lastBackupAt ? 'Ainda não há backup. Baixe um arquivo para proteger todas as campanhas.' : pend ? `Há mudanças desde o último backup (${fmtDT(meta.lastBackupAt)}).` : `Backup em dia, feito em ${fmtDT(meta.lastBackupAt)}.`;
  $('backupStatus').classList.toggle('warn', !meta.lastBackupAt || pend);
}
function updateBulk() {
  const n = U.selected.size;
  $('bulkbar').classList.toggle('hidden', n === 0 || clientListCollapsed);
  $('bulkCount').textContent = plural(n, 'selecionado', 'selecionados');
}
let clientListCollapsed = false;
try { clientListCollapsed = localStorage.getItem(K.collapse) === '1'; } catch (e) {}
function renderCollapse() {
  $('items').classList.toggle('list-collapsed', clientListCollapsed);
  $('toggleClientList').setAttribute('aria-expanded', String(!clientListCollapsed));
  $('toggleClientListIcon').textContent = clientListCollapsed ? '⌄' : '⌃';
  $('toggleClientListText').textContent = clientListCollapsed ? 'Expandir lista' : 'Recolher lista';
}
function renderAll() {
  if (!S.campaigns.length) S.campaigns.push(newCampaign('Campanha inicial'));
  if (!S.campaigns.some(c => c.id === activeId)) activeId = S.campaigns[0].id;
  renderSidebar(); renderHero(); renderHolidays(); renderDash(); renderCampaignTabs(); renderList(); renderBackup(); renderCollapse(); updateBulk(); renderSyncPill();
  firstPaint = false;
}

/* ───── eventos: lista ───── */
$('items').addEventListener('change', e => {
  const row = e.target.closest('.row'); if (!row) return;
  const act = e.target.dataset.action, id = row.dataset.id, c = A();
  if (act === 'select') { e.target.checked ? U.selected.add(id) : U.selected.delete(id); row.classList.toggle('selected', e.target.checked); updateBulk(); return; }
  const cl = S.clients.find(x => x.id === id); if (!cl) return;
  if (act === 'check') { pushUndo(); setMark(c, id, { d:e.target.checked ? 1 : 0 }); save(); }
  if (act === 'category') { pushUndo(); cl.category = e.target.value; cl.u = Date.now(); save(); }
});
$('items').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.tagName === 'INPUT' || btn.tagName === 'SELECT') return;
  const row = btn.closest('.row'); if (!row) return;
  const cl = S.clients.find(x => x.id === row.dataset.id); if (!cl) return;
  switch (btn.dataset.action) {
    case 'edit': U.editing = cl.id; renderList(); { const i = document.querySelector('[data-action="edit-input"]'); if (i) { i.focus(); i.select(); } } break;
    case 'save-edit': {
      const input = row.querySelector('[data-action="edit-input"]'), name = cleanName(input.value);
      if (!name) { input.focus(); return; }
      const dup = S.clients.find(x => x.id !== cl.id && keyOf(x.name) === keyOf(name));
      if (dup) { toast(`Já existe “${dup.name}”.`, 'err'); input.focus(); return; }
      cl.name = name; cl.u = Date.now(); U.editing = null; save(); break;
    }
    case 'cancel-edit': U.editing = null; renderList(); break;
    case 'details': openMark(cl.id); break;
    case 'delete':
      if (confirm(`Excluir “${cl.name}” do cadastro e de TODAS as campanhas?`)) { pushUndo(); removeClients([cl.id]); U.selected.delete(cl.id); save(); toast('Cliente excluído.', 'ok', true); }
      break;
  }
});
$('items').addEventListener('keydown', e => {
  if (e.target.dataset.action === 'edit-input') {
    if (e.key === 'Enter') { e.preventDefault(); e.target.closest('.row').querySelector('[data-action="save-edit"]').click(); }
    if (e.key === 'Escape') { U.editing = null; renderList(); }
    return;
  }
  if (e.target.classList.contains('row') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault(); const id = e.target.dataset.id, c = A();
    if (mk(c, id).o) return; pushUndo(); setMark(c, id, { d:mk(c, id).d ? 0 : 1 }); save();
    const again = document.querySelector(`.row[data-id="${CSS.escape(id)}"]`); if (again) again.focus();
  }
});
function removeClients(ids) {
  const t = Date.now(), set = new Set(ids);
  S.clients.filter(x => set.has(x.id)).forEach(x => { S.tomb[x.id] = t; if (x.ds && !S.ign.includes(x.ds)) S.ign.push(x.ds); });
  S.clients = S.clients.filter(x => !set.has(x.id));
  S.campaigns.forEach(c => { ids.forEach(id => delete c.marks[id]); c.u = t; });
}
$('selectVisible').addEventListener('click', () => { U.vis.forEach(id => U.selected.add(id)); renderList(); updateBulk(); });
$('bulkbar').addEventListener('click', e => {
  const b = e.target.closest('[data-bulk]'); if (!b) return;
  const ids = [...U.selected], c = A(), act = b.dataset.bulk;
  if (act === 'clear') { U.selected.clear(); renderList(); updateBulk(); return; }
  if (!ids.length) return;
  pushUndo();
  if (act === 'done') ids.forEach(id => !mk(c, id).o && setMark(c, id, { d:1 }));
  if (act === 'pending') ids.forEach(id => setMark(c, id, { d:0 }));
  if (act === 'out') ids.forEach(id => setMark(c, id, { o:1 }));
  if (act === 'in') ids.forEach(id => setMark(c, id, { o:0 }));
  if (act === 'delete') { if (!confirm(`Excluir ${ids.length} clientes do cadastro e de TODAS as campanhas?`)) { undoStack.pop(); return; } removeClients(ids); }
  U.selected.clear(); save(); toast('Feito.', 'ok', true);
});
$('bulkCat').addEventListener('change', e => {
  const v = e.target.value; if (!v) return; pushUndo(); const t = Date.now();
  S.clients.filter(x => U.selected.has(x.id)).forEach(x => { x.category = v; x.u = t; }); U.selected.clear(); e.target.value = ''; save(); toast('Categoria alterada.', 'ok', true);
});
$('addForm').addEventListener('submit', e => {
  e.preventDefault(); const name = cleanName($('newName').value); if (!name) return;
  const dup = S.clients.find(x => keyOf(x.name) === keyOf(name));
  if (dup && !confirm(`Já existe “${dup.name}”. Adicionar “${name}” mesmo assim?`)) return;
  pushUndo(); S.clients.push({ id:uid(), name, category:$('newCategory').value, ds:'', logo:'', u:Date.now() });
  $('newName').value = ''; resetFilters(); save(); toast('Cliente adicionado.', 'ok', true);
});
$('search').addEventListener('input', e => { U.q = e.target.value; renderList(); });
$('statusSel').addEventListener('change', e => { U.statF = e.target.value; renderList(); });
$('sortSel').addEventListener('change', e => { U.sort = e.target.value; renderList(); });
document.addEventListener('click', e => {
  const cb = e.target.closest('[data-cat]'); if (cb) { U.catF = cb.dataset.cat; renderSidebar(); renderList(); }
});
$('toggleClientList').addEventListener('click', () => { clientListCollapsed = !clientListCollapsed; try { localStorage.setItem(K.collapse, clientListCollapsed ? '1' : '0'); } catch (e) {} renderCollapse(); renderList(); updateBulk(); });

/* ───── eventos: campanhas ───── */
$('campaignTabs').addEventListener('click', e => {
  if (e.target.closest('.js-create')) { openCamp('create'); return; }
  const b = e.target.closest('[data-campaign]'); if (b) switchCampaign(b.dataset.campaign);
});
document.querySelectorAll('.js-create').forEach(b => b.addEventListener('click', () => openCamp('create')));
$('holidayList').addEventListener('click', e => {
  const o = e.target.closest('[data-hopen]'); if (o) { switchCampaign(o.dataset.hopen); $('painel').scrollIntoView({ behavior:'smooth' }); return; }
  const g = e.target.closest('[data-hname]'); if (g) createCampaign(`${g.dataset.hname} ${g.dataset.hyear}`, g.dataset.hdate);
});
$('renameCampaignBtn').addEventListener('click', () => openCamp('edit'));
$('dupCampaignBtn').addEventListener('click', () => openCamp('dup'));
document.addEventListener('click', e => { if (e.target.closest('[data-act="camp-date"]')) openCamp('edit'); });
$('deleteCampaignBtn').addEventListener('click', () => {
  if (S.campaigns.length <= 1) return; const c = A();
  if (!confirm(`Excluir a campanha “${c.name}” e todas as suas marcações?\n\nOs clientes e as outras campanhas ficam preservados.`)) return;
  pushUndo(); S.tomb[c.id] = Date.now(); S.campaigns = S.campaigns.filter(x => x.id !== c.id); activeId = S.campaigns[0].id; U.selected.clear(); save(); toast('Campanha excluída.', 'ok', true);
});
function openDlg(id) { const d = $(id); if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }
function closeDlg(id) { const d = $(id); if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) closeDlg(d.id); }));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDlg(b.closest('dialog').id)));
let campMode = 'create';
function openCamp(mode) {
  campMode = mode; const c = A(), edit = mode === 'edit', dup = mode === 'dup';
  $('campTitle').textContent = edit ? 'Editar campanha' : dup ? 'Duplicar campanha' : 'Criar campanha';
  $('campHint').textContent = edit ? 'Mude o nome ou a data do feriado. As marcações ficam preservadas.' : dup ? 'A nova campanha começa com tudo pendente, com os mesmos clientes.' : 'Exemplo: Proclamação da República 2026. A nova campanha recebe todos os clientes.';
  $('campSave').textContent = edit ? 'Salvar' : dup ? 'Duplicar' : 'Criar campanha';
  $('campName').value = edit ? c.name : dup ? `${c.name} (cópia)` : '';
  $('campDate').value = edit || dup ? c.date : '';
  $('dupRow').classList.toggle('hidden', !dup); $('keepOut').checked = true;
  openDlg('campDialog'); $('campName').focus(); if (edit) $('campName').select();
}
$('campForm').addEventListener('submit', e => {
  e.preventDefault(); const name = cleanCamp($('campName').value), date = $('campDate').value;
  if (!name) { $('campName').focus(); return; }
  const other = S.campaigns.find(c => keyOf(c.name) === keyOf(name) && (campMode !== 'edit' || c.id !== A().id));
  if (other) { toast(`Já existe a campanha “${other.name}”.`, 'err'); return; }
  closeDlg('campDialog');
  if (campMode === 'edit') { const c = A(); c.name = name; c.date = isISO(date) ? date : ''; c.u = Date.now(); save(); return; }
  if (campMode === 'dup') {
    pushUndo(); const src = A(), marks = {}, t = Date.now();
    if ($('keepOut').checked) Object.keys(src.marks).forEach(k => { if (src.marks[k].o) marks[k] = { d:0, o:1, due:'', n:'', u:t }; });
    const c = newCampaign(name, date, marks); S.campaigns.push(c); activeId = c.id; resetFilters(); save(); toast('Campanha duplicada.', 'ok', true); return;
  }
  createCampaign(name, date);
});

/* detalhes do cliente na campanha */
function openMark(cid) {
  const cl = S.clients.find(x => x.id === cid), m = mk(A(), cid); U.markFor = cid;
  $('markWho').textContent = cl.name; $('markDue').value = m.due; $('markNote').value = m.n; $('markOut').checked = !!m.o;
  openDlg('markDialog'); $('markDue').focus();
}
$('markForm').addEventListener('submit', e => {
  e.preventDefault(); const cid = U.markFor; if (!cid) return;
  setMark(A(), cid, { due:$('markDue').value, n:$('markNote').value.trim().slice(0, 300), o:$('markOut').checked ? 1 : 0 }); closeDlg('markDialog'); save();
});

/* categorias */
function renderCatList() {
  $('catEdit').innerHTML = S.cats.map(c => `<div class="catrow"><input data-ce="${esc(c.id)}" value="${esc(c.name)}" maxlength="30" aria-label="Nome da categoria"><span class="catn">${S.clients.filter(x => x.category === c.id).length} clientes</span><button type="button" class="icon del" data-cd="${esc(c.id)}" title="Excluir categoria" ${S.cats.length < 2 ? 'disabled' : ''}>×</button></div>`).join('');
}
$('catManage').addEventListener('click', () => { renderCatList(); openDlg('catDialog'); });
$('catEdit').addEventListener('change', e => {
  const id = e.target.dataset.ce; if (!id) return; const c = S.cats.find(x => x.id === id), name = cleanCamp(e.target.value).slice(0, 30);
  if (!name) { e.target.value = c.name; return; } c.name = name; c.u = Date.now(); save();
});
$('catEdit').addEventListener('click', e => {
  const id = e.target.closest('[data-cd]')?.dataset.cd; if (!id || S.cats.length < 2) return;
  const c = S.cats.find(x => x.id === id), n = S.clients.filter(x => x.category === id).length;
  if (!confirm(`Excluir a categoria “${c.name}”?${n ? `\n\n${plural(n, 'cliente passa', 'clientes passam')} para outra categoria.` : ''}`)) return;
  pushUndo(); const t = Date.now(), dest = S.cats.find(x => x.id !== id).id;
  S.clients.forEach(x => { if (x.category === id) { x.category = dest; x.u = t; } });
  S.cats = S.cats.filter(x => x.id !== id); S.tomb[id] = t; if (U.catF === id) U.catF = 'todos'; save(); renderCatList();
});
$('catAdd').addEventListener('submit', e => {
  e.preventDefault(); const name = cleanCamp($('catNew').value).slice(0, 30); if (!name) return;
  if (S.cats.some(c => keyOf(c.name) === keyOf(name))) { toast('Essa categoria já existe.', 'err'); return; }
  S.cats.push({ id:'c-' + uid().slice(0, 8), name, u:Date.now() }); $('catNew').value = ''; save(); renderCatList();
});

/* ───── exportar, imprimir, backup ───── */
function download(name, content, type) {
  const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function buildPrint() {
  const c = A(), list = visibleClients(), st = stats(c), all = partic(c), late = all.filter(x => isLate(c, x)).length;
  const p = st.total ? Math.round(st.done / st.total * 100) : 0, flt = [];
  if (U.catF !== 'todos') flt.push(catName(U.catF));
  if (U.statF !== 'todos') flt.push({ pend:'Pendentes', pronta:'Prontas', atras:'Atrasadas', fora:'Fora da campanha' }[U.statF]);
  if (U.q) flt.push('Busca: ' + U.q);
  const item = x => {
    const m = mk(c, x.id), tag = m.o ? 'fora' : m.d ? 'ok' : isLate(c, x) ? 'late' : 'pend';
    const info = [m.o ? 'Fora da campanha' : '', m.due && !m.o ? 'Entrega ' + fmtD(m.due) : '', m.n].filter(Boolean).join(' · ');
    return `<li class="pi ${tag}"><i class="pb">${m.d && !m.o ? '✓' : m.o ? '–' : ''}</i><span class="pn">${esc(x.name)}${info ? `<em>${esc(info)}</em>` : ''}</span></li>`;
  };
  const groups = U.catF === 'todos' ? S.cats.map(k => [k.name, list.filter(x => x.category === k.id)]).filter(g => g[1].length) : [[catName(U.catF), list]];
  $('printDoc').innerHTML = `<header class="ph"><img src="logo.png" alt="Max Control"><div class="pt"><small>Lista de produção</small><h1>${esc(c.name)}</h1>
    <p>${c.date ? fmtDY(c.date) + ' · ' : ''}Gerado em ${fmtDT(Date.now())}${flt.length ? ' · ' + esc(flt.join(' · ')) : ''}</p></div></header>
    <div class="ps"><div><b>${st.total}</b><span>No total</span></div><div><b>${st.done}</b><span>Prontas</span></div><div><b>${st.total - st.done}</b><span>Faltam</span></div>${late ? `<div class="al"><b>${late}</b><span>Atrasadas</span></div>` : ''}<div class="pp"><b>${p}%</b><i><u style="width:${p}%"></u></i></div></div>
    ${groups.map(([n, l]) => `<section><h2>${esc(n)} <span>${l.filter(x => mk(c, x.id).d && !mk(c, x.id).o).length}/${l.filter(x => !mk(c, x.id).o).length}</span></h2><ul>${l.map(item).join('')}</ul></section>`).join('') || '<p>Nenhum cliente nesta lista.</p>'}
    <footer>Max Control · Artes &amp; Feriados</footer>`;
}
$('printBtn').addEventListener('click', () => { buildPrint(); window.print(); });
$('printTop').addEventListener('click', () => $('printBtn').click());
const csvCell = v => { let s = String(v); if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s; return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
$('exportCsvBtn').addEventListener('click', () => {
  const c = A(), rows = [...S.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(x => { const m = mk(c, x.id); return [c.name, fmtDY(c.date), x.name, catName(x.category), m.o ? 'Fora da campanha' : m.d ? 'Pronta' : 'Pendente', fmtDY(m.due), m.n]; });
  const csv = '﻿' + [['Campanha', 'Data do feriado', 'Nome', 'Categoria', 'Status', 'Entrega', 'Observação'], ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
  download(`max-control-${safeFile(c.name)}-${today()}.csv`, csv, 'text/csv;charset=utf-8');
});
$('backupBtn').addEventListener('click', () => {
  download(`max-control-todas-campanhas-${today()}.json`, JSON.stringify({ app:'max-control', version:5, exportedAt:new Date().toISOString(), ...docOf(), activeCampaignId:activeId }, null, 2), 'application/json');
  meta.lastBackupAt = Date.now(); meta.lastChangeAt = meta.lastBackupAt; persist(false); renderBackup();
});
$('restoreBtn').addEventListener('click', () => $('restoreFile').click());
$('restoreFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text()); let doc;
    if (data && Array.isArray(data.clients) && Array.isArray(data.campaigns)) doc = normDoc(data);
    else { const list = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : null); if (!list) throw new Error('formato inválido'); doc = normDoc({ clients:list, campaigns:[{ id:uid(), name:'Campanha restaurada (backup antigo)', doneIds:list.filter(x => x.done).map(x => x.id) }] }); }
    if (!doc.clients.length) throw new Error('o arquivo não tem clientes válidos');
    if (!confirm(`Restaurar backup com ${doc.clients.length} clientes e ${doc.campaigns.length} campanhas?\n\nIsso SUBSTITUI o cadastro e as campanhas atuais (dá para desfazer logo depois).`)) return;
    pushUndo(); const t = Date.now();
    doc.clients.forEach(c => c.u = t); doc.cats.forEach(c => c.u = t); doc.campaigns.forEach(c => { c.u = t; Object.values(c.marks).forEach(m => m.u = t); });
    S.clients.forEach(c => { if (!doc.clients.some(x => x.id === c.id)) doc.tomb[c.id] = t; });
    S.campaigns.forEach(c => { if (!doc.campaigns.some(x => x.id === c.id)) doc.tomb[c.id] = t; });
    doc.tomb = Object.assign({}, S.tomb, doc.tomb); doc.clients.forEach(c => delete doc.tomb[c.id]); doc.campaigns.forEach(c => delete doc.tomb[c.id]); doc.cats.forEach(c => delete doc.tomb[c.id]);
    S = doc; if (!S.campaigns.length) S.campaigns.push(newCampaign('Campanha inicial'));
    activeId = S.campaigns.some(c => c.id === data.activeCampaignId) ? data.activeCampaignId : S.campaigns[0].id; meta.lastBackupAt = null; resetFilters(); save(); toast('Backup restaurado.', 'ok', true);
  } catch (err) { toast('Não foi possível restaurar: ' + (err.message || 'arquivo inválido.'), 'err'); }
});
$('clearMarksBtn').addEventListener('click', () => {
  const c = A(); if (!confirm(`Limpar TODAS as marcações da campanha “${c.name}”?\n\n(Prazos e observações também são limpos. Dá para desfazer.)`)) return;
  pushUndo(); const t = Date.now(); Object.keys(c.marks).forEach(k => { c.marks[k] = { d:0, o:0, due:'', n:'', u:t }; }); c.u = t; save(); toast('Marcações limpas.', 'ok', true);
});

/* ───── conta e sincronização (Supabase) ───── */
let sync = null, syncBusy = false, syncTimer = null, syncStatus = 'local', syncErr = '';
try { sync = JSON.parse(localStorage.getItem(K.sync)); } catch (e) {}
const saveSync = () => { try { sync ? localStorage.setItem(K.sync, JSON.stringify(sync)) : localStorage.removeItem(K.sync); } catch (e) {} };
function renderSyncPill() {
  const map = { local:'Salvo neste dispositivo', sync:'Sincronizando…', ok:'Sincronizado', off:'Sem conexão · salvo aqui', err:'Erro ao sincronizar', login:'Entrar para sincronizar' };
  const p = $('savedPill'); p.querySelector('span').textContent = map[syncStatus] || map.local; p.dataset.s = syncStatus; p.title = syncStatus === 'err' ? syncErr : 'Conta e sincronização';
  const on = !!sync?.session;
  $('syOff').classList.toggle('hidden', on); $('syOn').classList.toggle('hidden', !on);
  if (on) $('syInfo').textContent = `Conectado como ${sync.email || ''}${sync.last ? ' · ' + new Date(sync.last).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''}`;
}
async function sb(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  if (auth) await ensureToken();
  const r = await fetch(sync.url.replace(/\/+$/, '') + path, { method, headers:{ apikey:sync.key, 'Content-Type':'application/json', ...(auth ? { Authorization:'Bearer ' + sync.session.access_token } : {}), ...headers }, body:body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const t = await r.text().catch(() => ''); const e = new Error(t || 'HTTP ' + r.status); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json().catch(() => null);
}
function storeSession(j) { sync.session = { access_token:j.access_token, refresh_token:j.refresh_token, expires_at:Date.now() + (j.expires_in || 3600) * 1000, user_id:j.user?.id || sync.session?.user_id }; saveSync(); }
async function ensureToken() { if (sync.session.expires_at - 60000 > Date.now()) return; storeSession(await sb('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token:sync.session.refresh_token }, auth:false })); }
function scheduleSync(ms = 1500) { if (!sync?.session) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), ms); }
function mergeDocs(L, R, first) {
  L = clone(L); R = normDoc(R); const idmap = {}, cmap = {};
  if (first) {
    const rc = new Map(R.clients.map(c => [keyOf(c.name), c.id])), rk = new Map(R.campaigns.map(c => [keyOf(c.name), c.id]));
    L.clients.forEach(c => { const rid = rc.get(keyOf(c.name)); if (rid && rid !== c.id) { idmap[c.id] = rid; c.id = rid; } });
    L.campaigns.forEach(c => { const rid = rk.get(keyOf(c.name)); if (rid && rid !== c.id) { cmap[c.id] = rid; c.id = rid; } c.marks = Object.fromEntries(Object.entries(c.marks).map(([k, v]) => [idmap[k] || k, v])); });
  }
  const tomb = Object.assign({}, R.tomb); Object.keys(L.tomb).forEach(k => { tomb[k] = Math.max(tomb[k] || 0, L.tomb[k]); });
  const ml = (a, b) => { const m = new Map(); [...b, ...a].forEach(x => { const e = m.get(x.id); if (!e || (x.u || 0) > (e.u || 0)) m.set(x.id, x); }); return [...m.values()].filter(x => !(tomb[x.id] && tomb[x.id] >= (x.u || 0))); };
  const cats = ml(L.cats, R.cats), clients = ml(L.clients, R.clients), ids = new Set(clients.map(c => c.id));
  const ca = new Map(); [...R.campaigns, ...L.campaigns].forEach(c => {
    const e = ca.get(c.id);
    if (!e) { ca.set(c.id, { ...c, marks:{ ...c.marks } }); return; }
    const base = (c.u || 0) > (e.u || 0) ? c : e; const marks = {};
    new Set([...Object.keys(e.marks), ...Object.keys(c.marks)]).forEach(k => { const a = e.marks[k], b = c.marks[k]; marks[k] = !a ? b : !b ? a : ((b.u || 0) >= (a.u || 0) ? b : a); });
    ca.set(c.id, { id:c.id, name:base.name, date:base.date, createdAt:e.createdAt < c.createdAt ? e.createdAt : c.createdAt, u:Math.max(e.u || 0, c.u || 0), marks });
  });
  const campaigns = [...ca.values()].filter(c => !(tomb[c.id] && tomb[c.id] >= (c.u || 0))).map(c => { Object.keys(c.marks).forEach(k => { if (!ids.has(k)) delete c.marks[k]; }); return c; });
  const cut = Date.now() - 120 * 864e5; Object.keys(tomb).forEach(k => { if (tomb[k] < cut) delete tomb[k]; });
  const cl2 = clients.map(c => ({ ...c, category:cats.some(k => k.id === c.category) ? c.category : cats[0]?.id }));
  return { doc:{ clients:cl2, cats:cats.length ? cats : DEFAULT_CATS(), campaigns, tomb, ign:[...new Set([...L.ign, ...R.ign])], reviewed:L.reviewed || R.reviewed }, cmap };
}
async function syncNow(quiet) {
  if (!sync?.session || syncBusy) return; syncBusy = true; syncStatus = 'sync'; renderSyncPill();
  try {
    if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline:true });
    const rows = await sb('/rest/v1/maxcontrol_dados?select=dados&limit=1'), remote = rows && rows[0] ? rows[0].dados : null, first = meta.syncedFor !== sync.session.user_id;
    if (remote) {
      const { doc, cmap } = mergeDocs(docOf(), remote, first), cur = normDoc(docOf());
      if (canon(normDoc(doc)) !== canon(cur)) { S = normDoc(doc); if (cmap[activeId]) activeId = cmap[activeId]; persist(false); renderAll(); }
    }
    const need = !remote || canon(normDoc(docOf())) !== canon(normDoc(remote));
    if (need) await sb('/rest/v1/maxcontrol_dados?on_conflict=user_id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:{ user_id:sync.session.user_id, dados:docOf(), atualizado_em:new Date().toISOString() } });
    meta.syncedFor = sync.session.user_id; persist(false); sync.last = Date.now(); saveSync(); syncStatus = 'ok';
    renderSyncPill();
    if (Date.now() - (meta.dsLast || 0) > 180000) dsPull(false);
  } catch (e) {
    if (e.status === 401 || (e.status === 400 && /refresh|token|JWT/i.test(e.message))) { syncStatus = 'login'; syncErr = 'Entre de novo'; }
    else if (e.offline || e instanceof TypeError) syncStatus = 'off';
    else { syncStatus = 'err'; syncErr = String(e.message).slice(0, 120); if (!quiet) toast('Falha ao sincronizar: ' + syncErr, 'err'); }
  } finally { syncBusy = false; renderSyncPill(); }
}
$('fSync').addEventListener('submit', async e => {
  e.preventDefault(); const url = $('sUrl').value.trim(), key = $('sKey').value.trim(), email = $('sMail').value.trim(), pass = $('sPass').value, msg = $('syMsg');
  if (!/^https:\/\/[^\s/]+/.test(url) || !key || !email || !pass) { msg.textContent = 'Preencha URL (https://…), chave, e-mail e senha.'; msg.style.color = '#c0392b'; return; }
  sync = { url, key, email, session:null }; msg.textContent = 'Entrando…'; msg.style.color = ''; $('syBtn').disabled = true;
  try { storeSession(await sb('/auth/v1/token?grant_type=password', { method:'POST', body:{ email, password:pass }, auth:false })); $('sPass').value = ''; msg.textContent = ''; closeDlg('syncDialog'); toast('Conectado.'); await syncNow(false); }
  catch (err) { sync.session = null; saveSync(); let m = ''; try { const j = JSON.parse(err.message); m = j.error_description || j.msg || j.message || j.error || ''; } catch (x) { m = String(err.message || ''); }
    msg.textContent = 'Não entrou: ' + (err instanceof TypeError ? 'não consegui falar com o Supabase (confira a URL e a internet)' : /invalid login/i.test(m) ? 'e-mail ou senha não conferem' : /api key|apikey|jwt/i.test(m) ? 'a chave pública está errada' : m.slice(0, 90)); msg.style.color = '#c0392b'; }
  finally { $('syBtn').disabled = false; renderSyncPill(); }
});
function openSync() {
  if (!sync?.session) { try { $('sUrl').value = sync?.url || localStorage.getItem('ds_sb_url') || ''; $('sKey').value = sync?.key || localStorage.getItem('ds_sb_key') || ''; $('sMail').value = sync?.email || ''; } catch (x) {} }
  renderSyncPill(); openDlg('syncDialog');
}
$('savedPill').addEventListener('click', openSync); $('accountBtn').addEventListener('click', openSync);
$('syNow').addEventListener('click', () => syncNow(false));
$('syOut').addEventListener('click', () => { sync = null; saveSync(); syncStatus = 'local'; renderSyncPill(); toast('Desconectado. Os dados continuam neste aparelho.'); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(300); });
addEventListener('online', () => scheduleSync(500));
setInterval(() => { if (!document.hidden) scheduleSync(0); }, 60000);

/* ───── clientes do DS Gestão ───── */
const words = s => new Set(String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['CLINICA', 'LOJA', 'DRA', 'LTDA'].includes(w)));
const sim = (a, b) => { const x = words(a), y = words(b); if (!x.size || !y.size) return 0; let n = 0; x.forEach(w => { if (y.has(w)) n++; }); return n / Math.max(x.size, y.size); };
async function dsPull(manual) {
  if (!sync?.session) { if (manual) { toast('Entre na conta para ler os clientes do DS Gestão.'); openSync(); } return; }
  try {
    const rows = await sb('/rest/v1/clientes?select=id,empresa,responsavel,telefone,logo_url,status&order=empresa.asc') || [];
    meta.dsLast = Date.now(); persist(false);
    const ds = rows.map(r => ({ id:String(r.id), name:cleanName(r.empresa || r.responsavel), logo:/^https?:\/\//.test(r.logo_url || '') ? r.logo_url : '', active:!r.status || r.status === 'ativo' })).filter(r => r.name);
    let changed = false, linked = 0, created = 0, upd = 0; const t = Date.now();
    ds.forEach(d => {
      let c = S.clients.find(x => x.ds === d.id);
      if (!c) { c = S.clients.find(x => !x.ds && keyOf(x.name) === keyOf(d.name)); if (c) { c.ds = d.id; c.u = t; linked++; changed = true; } }
      if (c) { if (c.name !== d.name || (d.logo && c.logo !== d.logo)) { c.name = d.name; if (d.logo) c.logo = d.logo; c.u = t; upd++; changed = true; } }
    });
    const pendDS = ds.filter(d => d.active && !S.clients.some(x => x.ds === d.id) && !S.ign.includes(d.id));
    const pendLocal = S.clients.filter(x => !x.ds);
    if (pendDS.length && pendLocal.length && !S.reviewed) { if (changed) save(); openLink(pendDS, pendLocal); return; }
    pendDS.forEach(d => { S.clients.push({ id:uid(), name:d.name, category:S.cats[0].id, ds:d.id, logo:d.logo, u:t }); created++; changed = true; });
    if (changed) save();
    if (manual || created) toast(created || linked || upd ? `DS Gestão: ${created} novo(s), ${linked} ligado(s), ${upd} atualizado(s).` : 'Clientes já estão em dia com o DS Gestão.');
  } catch (e) { if (manual) toast('Não foi possível ler o DS Gestão agora.', 'err'); }
}
$('dsPullBtn').addEventListener('click', () => dsPull(true));
function openLink(pendDS, pendLocal) {
  U.dsPending = pendDS;
  $('linkBody').innerHTML = pendLocal.map(c => {
    let best = null, bs = 0; pendDS.forEach(d => { const s = sim(c.name, d.name); if (s > bs) { bs = s; best = d; } });
    return `<div class="linkrow"><strong>${esc(c.name)}</strong><select data-lc="${esc(c.id)}"><option value="">Manter só aqui (sem DS)</option>${pendDS.map(d => `<option value="${esc(d.id)}" ${best && bs >= .5 && best.id === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>`;
  }).join('');
  $('linkCount').textContent = `${plural(pendLocal.length, 'cliente daqui ainda não tem', 'clientes daqui ainda não têm')} par no DS Gestão. Confira as sugestões e aplique.`;
  openDlg('linkDialog');
}
$('linkApply').addEventListener('click', () => {
  const t = Date.now(); pushUndo(); const used = new Set();
  $('linkBody').querySelectorAll('select').forEach(s => {
    const c = S.clients.find(x => x.id === s.dataset.lc), d = (U.dsPending || []).find(x => x.id === s.value);
    if (c && d && !used.has(d.id)) { used.add(d.id); c.ds = d.id; c.name = d.name; if (d.logo) c.logo = d.logo; c.u = t; }
  });
  (U.dsPending || []).filter(d => !used.has(d.id) && !S.clients.some(x => x.ds === d.id)).forEach(d => S.clients.push({ id:uid(), name:d.name, category:S.cats[0].id, ds:d.id, logo:d.logo, u:t }));
  S.reviewed = true; closeDlg('linkDialog'); save(); toast('Clientes ligados ao DS Gestão.', 'ok', true);
});
$('linkSkip').addEventListener('click', () => { S.reviewed = true; closeDlg('linkDialog'); persist(); toast('Tudo bem. Use “Vincular clientes” quando quiser.'); });
$('linkBtn').addEventListener('click', () => { S.reviewed = false; dsPull(true); });

/* ───── atalhos, busca, menu, efeitos ───── */
$('searchBtn').addEventListener('click', () => { if (clientListCollapsed) { clientListCollapsed = false; renderCollapse(); renderList(); } $('clientes').scrollIntoView({ behavior:'smooth', block:'start' }); setTimeout(() => $('search').focus(), 420); });
document.addEventListener('keydown', e => {
  const ae = document.activeElement, typing = /TEXTAREA|SELECT/.test(ae.tagName) || (ae.tagName === 'INPUT' && !/checkbox|radio|button/.test(ae.type)), dlg = document.querySelector('dialog[open]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing && !dlg) { e.preventDefault(); undo(); return; }
  if (typing || dlg || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('searchBtn').click(); }
  else if (e.key.toLowerCase() === 'n') { e.preventDefault(); $('newName').scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(() => $('newName').focus(), 300); }
  else if (e.key.toLowerCase() === 'c') { e.preventDefault(); openCamp('create'); }
});
(function () {
  const links = [...document.querySelectorAll('.side-nav a')];
  links.forEach(a => a.addEventListener('click', () => links.forEach(l => l.classList.toggle('active', l === a))));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id)); }), { rootMargin:'-35% 0px -55% 0px' });
    ['painel', 'campanhas', 'clientes', 'backup'].forEach(id => { const el = $(id); if (el) io.observe(el); });
  }
})();
const itemsEl = $('items');
itemsEl.addEventListener('pointermove', e => {
  if (!FINE || RM) return; const c = e.target.closest('.row'); if (!c) return;
  const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  c.style.setProperty('--mx', x + 'px'); c.style.setProperty('--my', y + 'px');
  c.style.setProperty('--ry', ((x / r.width - .5) * 5).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((y / r.height - .5) * -5).toFixed(2) + 'deg');
});
itemsEl.addEventListener('pointerout', e => { const c = e.target.closest('.row'); if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });

/* ───── início ───── */
const migrated = loadState();
try { meta = Object.assign(meta, JSON.parse(localStorage.getItem(K.meta)) || {}); } catch (e) {}
try { activeId = localStorage.getItem(K.active) || activeId; } catch (e) {}
if (migrated) { meta.lastBackupAt = null; meta.lastChangeAt = Date.now(); }
if (!S.campaigns.length) S.campaigns.push(newCampaign('Campanha inicial'));
syncStatus = sync?.session ? 'sync' : 'local';
persist(false); renderAll();
if (sync?.session) syncNow(true);
setTimeout(() => { const sp = $('splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 450); } }, 250);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__mc = { S: () => S, mergeDocs, normDoc, canon, holidays, easter, docOf };
