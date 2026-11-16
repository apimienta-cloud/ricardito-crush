/* =====================================================================
   Ricardito Crush — lógica del juego (match-3)
   ===================================================================== */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const fmt = n => n.toLocaleString('es-UY');

/* ------------------------------------------------------------------
   Persistencia
------------------------------------------------------------------ */
const SAVE_KEY = 'ricardito-crush-v1';
let save = { progress: {}, muted: false };
try { const s = localStorage.getItem(SAVE_KEY); if (s) save = Object.assign(save, JSON.parse(s)); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

/* ------------------------------------------------------------------
   Sonido (sintetizado, sin archivos)
------------------------------------------------------------------ */
const Sound = {
  ctx: null,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type = 'sine', vol = .18, delay = 0, slide = 0) {
    if (!this.ctx || save.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + .02);
  },
  play(name, n = 0) {
    switch (name) {
      case 'click':   this.tone(600, .08, 'triangle', .12); break;
      case 'swap':    this.tone(420, .1, 'triangle', .12, 0, 120); break;
      case 'bad':     this.tone(200, .15, 'sawtooth', .1, 0, -80); break;
      case 'pop':     this.tone(520 + Math.min(n, 6) * 70, .14, 'triangle', .16, 0, 200); this.tone(260, .1, 'sine', .1); break;
      case 'oblea':   this.tone(180, .12, 'square', .08, 0, -60); break;
      case 'special': this.tone(700, .25, 'sawtooth', .12, 0, 500); this.tone(350, .3, 'triangle', .1, .05, 300); break;
      case 'bomb':    for (let i = 0; i < 6; i++) this.tone(300 + i * 90, .3, 'triangle', .1, i * .05, 400); break;
      case 'win':     [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, .35, 'triangle', .16, i * .11)); break;
      case 'lose':    [440, 392, 330, 262].forEach((f, i) => this.tone(f, .4, 'sine', .14, i * .22)); break;
      case 'shuffle': for (let i = 0; i < 8; i++) this.tone(300 + rnd(400), .08, 'triangle', .08, i * .05); break;
    }
  }
};

/* ------------------------------------------------------------------
   Pantallas
------------------------------------------------------------------ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

/* --- Inicio: Ricarditos flotando --- */
(function floaters() {
  const box = $('.floaters');
  const keys = Object.keys(FLAVORS);
  for (let i = 0; i < 12; i++) {
    const im = document.createElement('img');
    im.src = FLAVORS[keys[i % keys.length]].img;
    im.style.left = (i * 8.3 + rnd(5)) + '%';
    im.style.width = (46 + rnd(50)) + 'px';
    im.style.animationDuration = (12 + rnd(14)) + 's';
    im.style.animationDelay = (-rnd(20)) + 's';
    box.appendChild(im);
  }
})();

/* --- Mapa de niveles --- */
function unlockedCount() {
  let n = 0;
  while (n < LEVELS.length && save.progress[n]) n++;
  return Math.min(n + 1, LEVELS.length); // niveles jugables: 0..n
}
function renderMap() {
  const wrap = $('#worlds'); wrap.innerHTML = '';
  const playable = unlockedCount();
  let total = 0; Object.values(save.progress).forEach(s => total += s);
  $('#total-stars').textContent = total;
  WORLDS.forEach(w => {
    const el = document.createElement('div'); el.className = 'world';
    el.innerHTML = `<div class="world-head"><img src="${w.deco}" alt=""><div><h2>${w.name}</h2><p>${w.sub}</p></div></div><div class="levels"></div>`;
    const grid = el.querySelector('.levels');
    LEVELS.forEach((lv, i) => {
      if (lv.world !== w.id) return;
      const b = document.createElement('button');
      const stars = save.progress[i] || 0;
      const locked = i >= playable;
      b.className = 'level-node' + (locked ? ' locked' : '') + (i === playable - 1 && !save.progress[i] ? ' current' : '');
      b.innerHTML = `<span>${i + 1}</span><span class="stars">${[1, 2, 3].map(k => k <= stars ? '<b>★</b>' : '★').join('')}</span>`;
      b.disabled = locked;
      b.addEventListener('click', () => { Sound.init(); Sound.play('click'); startLevel(i); });
      grid.appendChild(b);
    });
    wrap.appendChild(el);
  });
}

/* ------------------------------------------------------------------
   Estado del juego
------------------------------------------------------------------ */
const boardEl = $('#board'), fxEl = $('#fx-layer'), shoutEl = $('#shout');
let L = null, levelIdx = 0;
let grid = [];           // grid[r][c] = { r, c, hole, oblea, tile, el }
let cols = 0, rows = 0, cell = 64;
let score = 0, moves = 0, collected = {}, obleaLeft = 0;
let busy = false, over = false, tileSeq = 0;
let selected = null, drag = null, hintTimer = null, hinted = [];
let gen = 0; // generación del tablero: cambia en cada buildBoard para cortar flujos viejos

const SPECIALS = ['striped-h', 'striped-v', 'wrapped', 'bomb'];
const BADGE = { 'striped-h': '↔', 'striped-v': '↕', 'wrapped': '???', 'bomb': '' };

function startLevel(i) {
  levelIdx = i; L = LEVELS[i];
  showScreen('screen-game');
  document.body.style.backgroundImage = `url(${(WORLDS.find(w => w.id === L.world) || WORLDS[0]).bg})`;
  buildBoard();
  showIntro();
}

function buildBoard() {
  cols = L.cols; rows = L.rows; gen++;
  score = 0; moves = L.moves; collected = {}; obleaLeft = 0; over = false; busy = false; selected = null; drag = null;
  clearHint();
  grid = [];
  boardEl.innerHTML = ''; fxEl.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const hole = L.mask ? L.mask[r][c] !== '#' : false;
      const oblea = (!hole && L.oblea) ? +L.oblea[r][c] : 0;
      const cl = { r, c, hole, oblea, tile: null, el: null };
      if (!hole) {
        const el = document.createElement('div'); el.className = 'cell';
        el.style.transform = ''; el.style.left = (c * 100 / cols) + '%'; el.style.top = (r * 100 / rows) + '%';
        boardEl.appendChild(el); cl.el = el; updateCellEl(cl);
        if (oblea) obleaLeft++;
      }
      grid[r][c] = cl;
    }
  }
  layout();
  // llenar sin combinaciones iniciales y con al menos un movimiento posible
  do {
    forEachCell(cl => { if (cl.tile) { cl.tile.el.remove(); cl.tile = null; } });
    forEachCell(cl => {
      let f;
      do { f = pick(L.flavors); } while (makesMatchAt(cl.r, cl.c, f));
      placeTile(makeTile(f), cl.r, cl.c, true);
    });
  } while (!findMove());
  updateHUD();
}

function layout() {
  const wrap = $('.board-wrap');
  const w = wrap.clientWidth - 20, h = wrap.clientHeight - 20;
  cell = Math.max(28, Math.floor(Math.min(w / cols, h / rows, 78)));
  boardEl.style.setProperty('--cols', cols); boardEl.style.setProperty('--rows', rows); boardEl.style.setProperty('--cell', cell + 'px');
  forEachCell(cl => { if (cl.tile) setPos(cl.tile, cl.r, cl.c, true); });
}
window.addEventListener('resize', () => { if (L && $('#screen-game').classList.contains('active')) layout(); });

function forEachCell(fn) { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!grid[r][c].hole) fn(grid[r][c]); }
const inside = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && !grid[r][c].hole;
const tileAt = (r, c) => inside(r, c) ? grid[r][c].tile : null;

function updateCellEl(cl) {
  if (!cl.el) return;
  cl.el.className = 'cell' + (cl.oblea ? ' oblea' : '') + (cl.oblea === 2 ? ' oblea2' : '');
}

/* --- Fichas --- */
function makeTile(flavor, special = null) {
  const el = document.createElement('div'); el.className = 'tile';
  const img = document.createElement('div'); img.className = 'img';
  img.style.backgroundImage = `url(${FLAVORS[flavor].img})`;
  el.style.setProperty('--mask', `url(${new URL(FLAVORS[flavor].img, location.href).href})`);
  el.appendChild(img);
  const t = { id: ++tileSeq, flavor, special: null, el, img, r: -1, c: -1 };
  if (special) setSpecial(t, special);
  boardEl.appendChild(el);
  return t;
}
function setSpecial(t, s) {
  t.special = s;
  SPECIALS.forEach(k => t.el.classList.remove(k));
  const old = t.el.querySelector('.badge'); if (old) old.remove();
  if (s) {
    t.el.classList.add(s);
    if (BADGE[s]) { const b = document.createElement('span'); b.className = 'badge'; b.textContent = BADGE[s]; t.el.appendChild(b); }
  }
}
function setPos(t, r, c, immediate = false) {
  t.r = r; t.c = c;
  if (immediate) { t.el.style.transition = 'none'; }
  t.el.style.transform = `translate(${c * cell}px, ${r * cell}px)`;
  if (immediate) { void t.el.offsetHeight; t.el.style.transition = ''; }
}
function placeTile(t, r, c, immediate) { grid[r][c].tile = t; setPos(t, r, c, immediate); }
function removeTile(t) { if (t.r >= 0 && grid[t.r][t.c].tile === t) grid[t.r][t.c].tile = null; t.el.remove(); }

/* ------------------------------------------------------------------
   Detección de combinaciones
------------------------------------------------------------------ */
function makesMatchAt(r, c, f) {
  const same = (rr, cc) => { const t = tileAt(rr, cc); return t && t.flavor === f; };
  return (same(r, c - 1) && same(r, c - 2)) || (same(r - 1, c) && same(r - 2, c));
}

function findRuns() {
  const runs = [];
  const scan = (dir) => {
    const outer = dir === 'h' ? rows : cols, inner = dir === 'h' ? cols : rows;
    for (let a = 0; a < outer; a++) {
      let b = 0;
      while (b < inner) {
        const r = dir === 'h' ? a : b, c = dir === 'h' ? b : a;
        const t = tileAt(r, c);
        if (!t) { b++; continue; }
        let len = 1;
        while (true) {
          const rr = dir === 'h' ? a : b + len, cc = dir === 'h' ? b + len : a;
          const n = tileAt(rr, cc);
          if (n && n.flavor === t.flavor) len++; else break;
        }
        if (len >= 3) {
          const cells = [];
          for (let k = 0; k < len; k++) cells.push(dir === 'h' ? grid[a][b + k] : grid[b + k][a]);
          runs.push({ dir, flavor: t.flavor, cells });
        }
        b += len;
      }
    }
  };
  scan('h'); scan('v');
  return runs;
}

/* Decide qué celdas se limpian y qué especiales nacen a partir de las corridas */
function analyzeRuns(runs, swapCells = []) {
  const clear = new Set(), spawns = [];
  const byCell = new Map();
  runs.forEach(run => run.cells.forEach(cl => { clear.add(cl); if (!byCell.has(cl)) byCell.set(cl, []); byCell.get(cl).push(run); }));
  const used = new Set();
  const choose = (cands) => cands.find(cl => swapCells.includes(cl)) || cands[Math.floor(cands.length / 2)];
  // 5 en línea -> Caja (bomba de sabor)
  runs.forEach(run => { if (run.cells.length >= 5) { spawns.push({ cell: choose(run.cells), special: 'bomb', flavor: run.flavor }); used.add(run); } });
  // L / T -> Misterio
  byCell.forEach((rs, cl) => {
    if (rs.length >= 2 && !rs.some(r => used.has(r))) { spawns.push({ cell: cl, special: 'wrapped', flavor: rs[0].flavor }); rs.forEach(r => used.add(r)); }
  });
  // 4 en línea -> Rayado
  runs.forEach(run => {
    if (used.has(run) || run.cells.length !== 4) return;
    spawns.push({ cell: choose(run.cells), special: run.dir === 'h' ? 'striped-h' : 'striped-v', flavor: run.flavor }); used.add(run);
  });
  return { clear, spawns };
}

/* Expande el conjunto de celdas con los especiales que se activan en cadena */
function expandSpecials(clear, extraFx = []) {
  const fx = extraFx.slice();
  const queue = [];
  clear.forEach(cl => { if (cl.tile && cl.tile.special) queue.push(cl); });
  const done = new Set();
  const add = (r, c) => { if (inside(r, c)) { const cl = grid[r][c]; if (!clear.has(cl)) { clear.add(cl); if (cl.tile && cl.tile.special && !done.has(cl)) queue.push(cl); } } };
  while (queue.length) {
    const cl = queue.shift(); if (done.has(cl)) continue; done.add(cl);
    const t = cl.tile; if (!t) continue;
    if (t.special === 'striped-h') { fx.push({ type: 'row', r: cl.r }); for (let c = 0; c < cols; c++) add(cl.r, c); }
    else if (t.special === 'striped-v') { fx.push({ type: 'col', c: cl.c }); for (let r = 0; r < rows; r++) add(r, cl.c); }
    else if (t.special === 'wrapped') { fx.push({ type: 'boom', r: cl.r, c: cl.c, size: 3 }); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(cl.r + dr, cl.c + dc); }
    else if (t.special === 'bomb') {
      // activada en cadena: limpia el sabor más abundante
      const count = {}; forEachCell(x => { if (x.tile && !clear.has(x)) count[x.tile.flavor] = (count[x.tile.flavor] || 0) + 1; });
      const f = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
      fx.push({ type: 'bomb', r: cl.r, c: cl.c });
      if (f) forEachCell(x => { if (x.tile && x.tile.flavor === f) add(x.r, x.c); });
    }
  }
  return { clear, fx, specialsFired: done.size };
}

/* ------------------------------------------------------------------
   Entrada (toque / mouse)
------------------------------------------------------------------ */
function cellFromEvent(e) {
  const rect = boardEl.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) / cell), r = Math.floor((e.clientY - rect.top) / cell);
  return inside(r, c) ? grid[r][c] : null;
}
boardEl.addEventListener('pointerdown', e => {
  if (busy || over) return;
  Sound.init();
  const cl = cellFromEvent(e); if (!cl || !cl.tile) return;
  clearHint();
  drag = { cell: cl, x: e.clientX, y: e.clientY, moved: false };
  boardEl.setPointerCapture(e.pointerId);
});
boardEl.addEventListener('pointermove', e => {
  if (!drag || drag.moved || busy) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) < cell * .35) return;
  drag.moved = true;
  const horiz = Math.abs(dx) > Math.abs(dy);
  const r = drag.cell.r + (horiz ? 0 : Math.sign(dy)), c = drag.cell.c + (horiz ? Math.sign(dx) : 0);
  select(null);
  if (inside(r, c) && grid[r][c].tile) trySwap(drag.cell, grid[r][c]);
  drag = null;
});
boardEl.addEventListener('pointerup', e => {
  if (!drag) return;
  const cl = drag.cell; drag = null;
  if (busy) return;
  if (selected && selected !== cl && Math.abs(selected.r - cl.r) + Math.abs(selected.c - cl.c) === 1) {
    const a = selected; select(null); trySwap(a, cl);
  } else { select(selected === cl ? null : cl); }
});
boardEl.addEventListener('pointercancel', () => { drag = null; });
function select(cl) {
  if (selected && selected.tile) selected.tile.el.classList.remove('selected');
  selected = cl;
  if (cl && cl.tile) { cl.tile.el.classList.add('selected'); Sound.play('click'); }
}

/* ------------------------------------------------------------------
   Intercambio y resolución
------------------------------------------------------------------ */
function swapTiles(a, b) {
  const ta = a.tile, tb = b.tile;
  a.tile = tb; b.tile = ta;
  if (ta) setPos(ta, b.r, b.c);
  if (tb) setPos(tb, a.r, a.c);
}

async function trySwap(a, b) {
  if (busy || over || !a.tile || !b.tile) return;
  const myGen = gen;
  setBusy(true);
  try {
    Sound.play('swap');
    swapTiles(a, b);
    await sleep(200);
    if (myGen !== gen) return;
    const ta = a.tile, tb = b.tile; // ya intercambiados
    const combo = comboFor(ta, tb);
    if (combo) {
      moves--; updateHUD();
      await runCombo(combo, a, b);
      await resolve(1, [a, b]);
      if (myGen !== gen) return;
      await endOfMove();
      return;
    }
    const runs = findRuns();
    if (!runs.length) {
      Sound.play('bad');
      ta.el.classList.add('shake'); tb.el.classList.add('shake');
      swapTiles(a, b);
      await sleep(250);
      ta.el.classList.remove('shake'); tb.el.classList.remove('shake');
      if (myGen !== gen) return;
      setBusy(false); scheduleHint();
      return;
    }
    moves--; updateHUD();
    await resolve(0, [a, b]);
    if (myGen !== gen) return;
    await endOfMove();
  } catch (err) {
    // red de seguridad: nunca dejar el tablero bloqueado
    console.error('Ricardito Crush:', err);
    if (myGen === gen && !over) { await settleBoard(); setBusy(false); scheduleHint(); }
  }
}

/* Repara el tablero si algo quedó inconsistente (celdas vacías o fichas huérfanas) */
async function settleBoard() {
  const alive = new Set(); forEachCell(cl => { if (cl.tile) alive.add(cl.tile.el); });
  boardEl.querySelectorAll('.tile').forEach(el => { if (!alive.has(el)) el.remove(); });
  forEachCell(cl => { if (cl.tile) setPos(cl.tile, cl.r, cl.c, true); });
  await applyGravity();
  await resolve(0);
}

function comboFor(ta, tb) {
  const sa = ta.special, sb = tb.special;
  if (!sa && !sb) return null;
  if (sa === 'bomb' || sb === 'bomb') {
    const bomb = sa === 'bomb' ? ta : tb, other = sa === 'bomb' ? tb : ta;
    if (other.special === 'bomb') return { type: 'bomb+bomb' };
    if (other.special === 'wrapped' || other.special === 'striped-h' || other.special === 'striped-v') return { type: 'bomb+special', bomb, other };
    return { type: 'bomb+flavor', bomb, other };
  }
  if (sa && sb) return { type: 'special+special', ta, tb };
  return null; // especial + normal: resuelve como combinación común
}

async function runCombo(combo, a, b) {
  const clear = new Set(); const fx = [];
  const all = () => forEachCell(cl => { if (cl.tile) clear.add(cl); });
  const flavorCells = f => { const out = []; forEachCell(cl => { if (cl.tile && cl.tile.flavor === f) out.push(cl); }); return out; };
  if (combo.type === 'bomb+bomb') {
    Sound.play('bomb'); shout('¡Uruguay nomá!'); fx.push({ type: 'bomb', r: a.r, c: a.c }); all();
    combo.noChain = true;
  } else if (combo.type === 'bomb+flavor') {
    Sound.play('bomb'); fx.push({ type: 'bomb', r: combo.bomb.r, c: combo.bomb.c });
    clear.add(grid[combo.bomb.r][combo.bomb.c]);
    flavorCells(combo.other.flavor).forEach(cl => clear.add(cl));
  } else if (combo.type === 'bomb+special') {
    Sound.play('bomb'); shout('¡Merengue!'); fx.push({ type: 'bomb', r: combo.bomb.r, c: combo.bomb.c });
    clear.add(grid[combo.bomb.r][combo.bomb.c]);
    const s = combo.other.special;
    flavorCells(combo.other.flavor).forEach(cl => { if (!cl.tile.special) setSpecial(cl.tile, s === 'wrapped' ? 'wrapped' : (rnd(2) ? 'striped-h' : 'striped-v')); clear.add(cl); });
  } else if (combo.type === 'special+special') {
    const { ta, tb } = combo; const r = ta.r, c = ta.c;
    const ws = [ta.special, tb.special].filter(s => s === 'wrapped').length;
    Sound.play('special');
    // quitar los especiales para que no se encadenen con su efecto normal
    const cellA = grid[ta.r][ta.c], cellB = grid[tb.r][tb.c];
    setSpecial(ta, null); setSpecial(tb, null); clear.add(cellA); clear.add(cellB);
    if (ws === 2) { // Misterio + Misterio: 5x5
      shout('¡Dulce!'); fx.push({ type: 'boom', r, c, size: 5 });
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (inside(r + dr, c + dc)) clear.add(grid[r + dr][c + dc]);
    } else if (ws === 1) { // Rayado + Misterio: 3 filas y 3 columnas
      shout('¡Tremendo!');
      for (let d = -1; d <= 1; d++) { fx.push({ type: 'row', r: r + d }); fx.push({ type: 'col', c: c + d }); for (let i = 0; i < cols; i++) if (inside(r + d, i)) clear.add(grid[r + d][i]); for (let i = 0; i < rows; i++) if (inside(i, c + d)) clear.add(grid[i][c + d]); }
    } else { // Rayado + Rayado: cruz
      fx.push({ type: 'row', r }); fx.push({ type: 'col', c });
      for (let i = 0; i < cols; i++) if (inside(r, i)) clear.add(grid[r][i]);
      for (let i = 0; i < rows; i++) if (inside(i, c)) clear.add(grid[i][c]);
    }
  }
  const ex = combo.noChain ? { clear, fx, specialsFired: 2 } : expandSpecials(clear, fx);
  const pts = ex.clear.size * 30 + 300;
  addScore(pts, a.r, a.c);
  await clearCells(ex.clear, [], ex.fx);
  await applyGravity();
}

async function resolve(cascade = 0, swapCells = []) {
  while (true) {
    const runs = findRuns();
    if (!runs.length) break;
    const { clear, spawns } = analyzeRuns(runs, swapCells);
    const ex = expandSpecials(clear);
    const mult = 1 + cascade * .5;
    let pts = 0;
    runs.forEach(run => pts += 60 + (run.cells.length - 3) * 60);
    pts += Math.max(0, ex.clear.size - runs.reduce((n, r) => n + r.cells.length, 0)) * 20;
    pts += ex.specialsFired * 100;
    pts = Math.round(pts * mult);
    const mid = runs[0].cells[Math.floor(runs[0].cells.length / 2)];
    addScore(pts, mid.r, mid.c);
    Sound.play(ex.specialsFired ? 'special' : 'pop', cascade);
    if (cascade === 1) shout('¡Dulce!'); else if (cascade === 2) shout('¡Merengue!'); else if (cascade >= 3) shout('¡Uruguay nomá!');
    await clearCells(ex.clear, spawns, ex.fx);
    await applyGravity();
    cascade++;
    swapCells = [];
  }
}

async function clearCells(clear, spawns, fx) {
  fx.forEach(f => drawFx(f));
  const spawnMap = new Map(spawns.map(s => [s.cell, s]));
  let obleaHit = false;
  clear.forEach(cl => {
    const t = cl.tile;
    if (cl.oblea) { cl.oblea--; obleaLeft -= cl.oblea === 0 ? 1 : 0; updateCellEl(cl); cl.el.classList.add('oblea-eat'); setTimeout(() => cl.el.classList.remove('oblea-eat'), 350); obleaHit = true; }
    if (!t) return;
    const sp = spawnMap.get(cl);
    if (sp) { // la ficha se transforma en especial en lugar de desaparecer
      setSpecial(t, sp.special); t.el.classList.add('spawn'); setTimeout(() => t.el.classList.remove('spawn'), 300);
      return;
    }
    collected[t.flavor] = (collected[t.flavor] || 0) + 1;
    t.el.classList.add('pop');
    particles(cl.r, cl.c, FLAVORS[t.flavor].color);
    cl.tile = null;
    setTimeout(() => t.el.remove(), 330);
  });
  if (obleaHit) Sound.play('oblea');
  updateHUD();
  await sleep(300);
}

async function applyGravity() {
  let maxDist = 0;
  for (let c = 0; c < cols; c++) {
    const valid = [];
    for (let r = 0; r < rows; r++) if (!grid[r][c].hole) valid.push(r);
    if (!valid.length) continue;
    const tiles = [];
    for (let i = valid.length - 1; i >= 0; i--) { const t = grid[valid[i]][c].tile; if (t) tiles.push(t); grid[valid[i]][c].tile = null; }
    // acomodar desde abajo
    let k = valid.length - 1;
    tiles.forEach(t => {
      const r = valid[k--]; const dist = r - t.r; maxDist = Math.max(maxDist, dist);
      grid[r][c].tile = t; t.r = r;
      if (dist > 0) { t.el.classList.add('falling'); t.el.style.transitionDuration = (120 + dist * 55) + 'ms'; }
      t.el.style.transform = `translate(${c * cell}px, ${r * cell}px)`;
    });
    // nuevas fichas desde arriba
    let spawnIdx = 1;
    while (k >= 0) {
      const r = valid[k--];
      const t = makeTile(pick(L.flavors));
      setPos(t, valid[0] - spawnIdx, c, true);
      grid[r][c].tile = t; t.r = r; t.c = c;
      const dist = r - (valid[0] - spawnIdx); maxDist = Math.max(maxDist, dist);
      t.el.classList.add('falling'); t.el.style.transitionDuration = (120 + dist * 55) + 'ms';
      t.el.style.transform = `translate(${c * cell}px, ${r * cell}px)`;
      spawnIdx++;
    }
  }
  if (maxDist > 0) await sleep(140 + maxDist * 55);
  forEachCell(cl => { if (cl.tile) { cl.tile.el.classList.remove('falling'); cl.tile.el.style.transitionDuration = ''; } });
}

/* ------------------------------------------------------------------
   Fin de movimiento, objetivos, mezcla
------------------------------------------------------------------ */
function goalDone() {
  const g = L.goal;
  if (g.type === 'score') return score >= g.target;
  if (g.type === 'oblea') return obleaLeft <= 0;
  if (g.type === 'collect') return Object.keys(g.targets).every(f => (collected[f] || 0) >= g.targets[f]);
  return false;
}

async function endOfMove() {
  if (goalDone()) { await winLevel(); return; }
  if (moves <= 0) { await loseLevel(); return; }
  if (!findMove()) {
    shout('¡Mezclando!'); Sound.play('shuffle');
    await sleep(500); await shuffleBoard();
  }
  setBusy(false); scheduleHint();
}

function findMove() {
  const tryAt = (r, c, r2, c2) => {
    if (!inside(r2, c2)) return null;
    const a = grid[r][c], b = grid[r2][c2];
    if (!a.tile || !b.tile) return null;
    if (a.tile.special === 'bomb' || b.tile.special === 'bomb') return [a, b];
    if (a.tile.special && b.tile.special) return [a, b];
    const ta = a.tile, tb = b.tile; a.tile = tb; b.tile = ta;
    const ok = makesAnyMatch(r, c) || makesAnyMatch(r2, c2);
    a.tile = ta; b.tile = tb;
    return ok ? [a, b] : null;
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c].hole) continue;
    const m = tryAt(r, c, r, c + 1) || tryAt(r, c, r + 1, c);
    if (m) return m;
  }
  return null;
}
function makesAnyMatch(r, c) {
  const t = tileAt(r, c); if (!t) return false;
  const f = t.flavor;
  const run = (dr, dc) => { let n = 0; let rr = r + dr, cc = c + dc; while (true) { const x = tileAt(rr, cc); if (x && x.flavor === f) { n++; rr += dr; cc += dc; } else break; } return n; };
  return run(0, 1) + run(0, -1) >= 2 || run(1, 0) + run(-1, 0) >= 2;
}

async function shuffleBoard() {
  const cells = []; forEachCell(cl => { if (cl.tile) cells.push(cl); });
  const tiles = cells.map(cl => cl.tile);
  for (let attempt = 0; attempt < 60; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) { const j = rnd(i + 1); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    cells.forEach((cl, i) => { cl.tile = tiles[i]; tiles[i].r = cl.r; tiles[i].c = cl.c; });
    if (!findRuns().length && findMove()) break;
  }
  cells.forEach(cl => setPos(cl.tile, cl.r, cl.c));
  await sleep(350);
}

async function winLevel() {
  over = true;
  shout('¡Ricardito Crush!'); Sound.play('win');
  await sleep(900);
  // bonus por movimientos restantes
  while (moves > 0) {
    moves--; addScore(150, rnd(rows), rnd(cols)); updateHUD(); Sound.play('pop', moves % 5); await sleep(90);
  }
  await sleep(400);
  const stars = starsFor(score);
  save.progress[levelIdx] = Math.max(save.progress[levelIdx] || 0, stars); persist();
  const last = levelIdx >= LEVELS.length - 1;
  openModal(`
    <h2>¡Nivel ${levelIdx + 1} superado!</h2>
    <img class="modal-img" src="assets/caja_3d.png" alt="">
    <div class="big-stars">${[1, 2, 3].map(k => k <= stars ? '<b>★</b>' : '★').join('')}</div>
    <div class="score-final">${fmt(score)} puntos</div>
    <p>Chocolate por fuera, merengue de corazón.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-act="map">Mapa</button>
      <button class="btn btn-ghost" data-act="retry">Repetir</button>
      ${last ? '' : '<button class="btn btn-primary" data-act="next">Siguiente ›</button>'}
    </div>
    ${last ? '<p class="tip">¡Terminaste todos los niveles! ¡Uruguay nomá!</p>' : ''}
  `);
}
async function loseLevel() {
  over = true; Sound.play('lose');
  await sleep(500);
  openModal(`
    <h2 class="lose">¡Sin movimientos!</h2>
    <img class="modal-img sad" src="assets/tile_clasico.png" alt="">
    <p>Te quedaste sin movimientos antes de cumplir el objetivo.</p>
    <div class="score-final">${fmt(score)} puntos</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-act="map">Mapa</button>
      <button class="btn btn-primary" data-act="retry">Reintentar</button>
    </div>
  `);
}
function starsFor(s) { return s >= L.stars[2] ? 3 : s >= L.stars[1] ? 2 : s >= L.stars[0] ? 1 : 1; }

/* ------------------------------------------------------------------
   HUD / puntaje / efectos
------------------------------------------------------------------ */
function addScore(pts, r, c) {
  score += pts;
  const el = document.createElement('div'); el.className = 'float-score'; el.textContent = '+' + pts;
  const rect = boardEl.getBoundingClientRect(), wrap = $('.board-wrap').getBoundingClientRect();
  el.style.left = (rect.left - wrap.left + c * cell + cell / 2 - 20) + 'px';
  el.style.top = (rect.top - wrap.top + r * cell) + 'px';
  fxEl.appendChild(el); setTimeout(() => el.remove(), 800);
  updateHUD();
}
function updateHUD() {
  $('#hud-level').textContent = levelIdx + 1;
  $('#hud-moves').textContent = moves; $('#hud-moves').classList.toggle('low', moves <= 5);
  $('#hud-score').textContent = fmt(score);
  $('#hud-goal').innerHTML = goalHTML();
  const max = L.stars[2];
  $('#score-fill').style.width = Math.min(100, score / max * 100) + '%';
  document.querySelectorAll('.score-stars i').forEach((i, k) => { i.style.left = (L.stars[k] / max * 100) + '%'; i.classList.toggle('on', score >= L.stars[k]); });
}
function goalHTML() {
  const g = L.goal;
  if (g.type === 'score') return `<div class="goal-item ${score >= g.target ? 'done' : ''}"><span class="goal-score">🎯 ${fmt(g.target)} pts</span></div>`;
  if (g.type === 'oblea') return `<div class="goal-item ${obleaLeft <= 0 ? 'done' : ''}"><span class="oblea-icon"></span><span>${Math.max(0, obleaLeft)}</span></div>`;
  return Object.keys(g.targets).map(f => { const left = Math.max(0, g.targets[f] - (collected[f] || 0)); return `<div class="goal-item ${left === 0 ? 'done' : ''}"><img src="${FLAVORS[f].img}" alt="${FLAVORS[f].name}"><span>${left}</span></div>`; }).join('');
}
function setBusy(b) { busy = b; boardEl.classList.toggle('busy', b); }

function shout(text) {
  shoutEl.textContent = text; shoutEl.classList.remove('show'); void shoutEl.offsetWidth; shoutEl.classList.add('show');
}
function boardOffset() { const rect = boardEl.getBoundingClientRect(), wrap = $('.board-wrap').getBoundingClientRect(); return { x: rect.left - wrap.left, y: rect.top - wrap.top }; }
function particles(r, c, color) {
  const o = boardOffset(); const cx = o.x + c * cell + cell / 2, cy = o.y + r * cell + cell / 2;
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('div'); p.className = 'particle';
    const ang = Math.random() * Math.PI * 2, d = cell * (.5 + Math.random() * .8);
    p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = i % 3 === 0 ? '#5a2d12' : color;
    p.style.setProperty('--dx', Math.cos(ang) * d + 'px'); p.style.setProperty('--dy', Math.sin(ang) * d + 'px');
    fxEl.appendChild(p); setTimeout(() => p.remove(), 650);
  }
}
function drawFx(f) {
  const o = boardOffset();
  const el = document.createElement('div');
  if (f.type === 'row') { el.className = 'beam'; el.style.left = o.x + 'px'; el.style.top = (o.y + f.r * cell + cell * .3) + 'px'; el.style.width = cols * cell + 'px'; el.style.height = cell * .4 + 'px'; }
  else if (f.type === 'col') { el.className = 'beam v'; el.style.top = o.y + 'px'; el.style.left = (o.x + f.c * cell + cell * .3) + 'px'; el.style.height = rows * cell + 'px'; el.style.width = cell * .4 + 'px'; }
  else if (f.type === 'boom' || f.type === 'bomb') { el.className = 'boom'; const s = (f.size || 4) * cell; el.style.width = el.style.height = s + 'px'; el.style.left = (o.x + f.c * cell + cell / 2 - s / 2) + 'px'; el.style.top = (o.y + f.r * cell + cell / 2 - s / 2) + 'px'; if (f.type === 'bomb') el.style.borderColor = '#ffd66b'; }
  fxEl.appendChild(el); setTimeout(() => el.remove(), 500);
}

/* --- pistas --- */
function scheduleHint() { clearHint(); hintTimer = setTimeout(() => { const m = findMove(); if (m && !busy && !over) { hinted = m; m.forEach(cl => cl.tile && cl.tile.el.classList.add('hint')); } }, 6000); }
function clearHint() { clearTimeout(hintTimer); hinted.forEach(cl => cl.tile && cl.tile.el.classList.remove('hint')); hinted = []; }

/* ------------------------------------------------------------------
   Modales
------------------------------------------------------------------ */
const modal = $('#modal'), modalCard = $('#modal-card');
function openModal(html) { modalCard.innerHTML = html; modal.classList.remove('hidden'); }
function closeModal() { modal.classList.add('hidden'); }
modalCard.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  Sound.init(); Sound.play('click');
  const act = b.dataset.act;
  closeModal();
  if (act === 'start') { setBusy(false); scheduleHint(); }
  else if (act === 'retry') { clearHint(); startLevel(levelIdx); }
  else if (act === 'next') { clearHint(); startLevel(Math.min(levelIdx + 1, LEVELS.length - 1)); }
  else if (act === 'map') { clearHint(); goMap(); }
  else if (act === 'close') {}
});

function showIntro() {
  setBusy(true);
  const g = L.goal;
  let goalTxt = g.type === 'score' ? `Llegá a <b>${fmt(g.target)}</b> puntos` : g.type === 'oblea' ? `Comé todas las <b>obleas</b> (${obleaLeft})` : 'Juntá estos Ricarditos';
  openModal(`
    <h2>Nivel ${levelIdx + 1}</h2>
    <p>${goalTxt} en <b>${L.moves}</b> movimientos</p>
    <div class="goal-preview">${goalHTML()}</div>
    ${L.tip ? `<p class="tip">💡 ${L.tip}</p>` : ''}
    <div class="modal-actions"><button class="btn btn-primary btn-big" data-act="start">¡Dale!</button></div>
  `);
}

function showHowTo() {
  openModal(`
    <h2>¿Cómo se juega?</h2>
    <ul class="howto">
      <li><span class="k">Deslizá</span> o tocá dos Ricarditos vecinos para intercambiarlos y juntar <span class="k">3 o más iguales</span>.</li>
      <li><img src="assets/tile_menta.png" alt=""> Cada nivel tiene un objetivo: puntos, juntar sabores o comer <span class="k">obleas</span>.</li>
      <li><span class="k">4 en línea</span> → Ricardito <span class="k">Rayado</span> (↔ ↕): limpia una fila o columna entera.</li>
      <li><span class="k">Forma de L o T</span> → Ricardito <span class="k">Misterio</span> (???): explota todo alrededor.</li>
      <li><span class="sp b"></span> <span class="k">5 en línea</span> → <span class="k">Caja Ricardito</span>: cambiala con cualquier ficha y elimina todo ese sabor.</li>
      <li>Combiná dos especiales entre sí para efectos gigantes. ¡Uruguay nomá!</li>
    </ul>
    <div class="modal-actions"><button class="btn btn-primary" data-act="close">¡Entendido!</button></div>
  `);
}

/* ------------------------------------------------------------------
   Navegación
------------------------------------------------------------------ */
function goMap() { document.body.style.backgroundImage = `url(assets/bg_light.jpg)`; renderMap(); showScreen('screen-map'); }
$('#btn-play').addEventListener('click', () => { Sound.init(); Sound.play('click'); goMap(); });
$('#btn-howto').addEventListener('click', () => { Sound.init(); Sound.play('click'); showHowTo(); });
$('#btn-map-home').addEventListener('click', () => { Sound.play('click'); document.body.style.backgroundImage = ''; showScreen('screen-home'); });
// mientras hay una animación en curso (y no hay modal abierto) se ignoran para no cortar el flujo a la mitad
const midAnimation = () => busy && !over && modal.classList.contains('hidden');
$('#btn-back').addEventListener('click', () => { if (midAnimation()) return; Sound.play('click'); clearHint(); closeModal(); goMap(); });
$('#btn-restart').addEventListener('click', () => { if (midAnimation()) return; Sound.play('click'); clearHint(); closeModal(); startLevel(levelIdx); });
const soundBtn = $('#btn-sound');
const syncSound = () => soundBtn.textContent = save.muted ? '🔇' : '🔊';
soundBtn.addEventListener('click', () => { save.muted = !save.muted; persist(); syncSound(); Sound.init(); Sound.play('click'); });
syncSound();

// hooks de desarrollo
window.__rc = { findMove, trySwap, state: () => ({ score, moves, collected, obleaLeft, busy, over, grid }), setSpecial, grid: () => grid, FLAVORS };
// atajo para desarrollo: ?level=N abre ese nivel
const q = new URLSearchParams(location.search);
if (q.has('level')) startLevel(Math.max(0, Math.min(LEVELS.length - 1, +q.get('level') - 1)));
if (q.has('unlock')) { LEVELS.forEach((_, i) => save.progress[i] = save.progress[i] || 1); }

})();
