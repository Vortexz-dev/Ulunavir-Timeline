/* Etiket Ağı (3D tag network + list mode) and Genel Arama (site-wide search).
   Also exposes window.__ulvNav (card / tag / era / place navigation) used by Kâtip Pirdeviz's links. */
(function(){
'use strict';
var D = window.TIMELINE || {events:[], chapters:[]}, INFO = window.TAGINFO || {};
var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function lite(){ return RM || document.body.classList.contains('fx-lite'); }
function U(){ return window.__ulv || {}; }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var FM = {'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','â':'a','î':'i','û':'u','é':'e','è':'e','ë':'e','ä':'a','á':'a','à':'a','í':'i','ó':'o','ú':'u','ñ':'n','æ':'a','ø':'o','å':'a'};
// length-preserving fold (so match offsets map back onto the original label)
function fold(s){
  s = String(s || ''); var o = '';
  for (var i = 0; i < s.length; i++){
    var c = s[i], l = c === 'I' ? 'ı' : c === 'İ' ? 'i' : c.toLowerCase();
    if (l.length !== 1) l = c;
    l = FM[l] || l;
    if (/['’`´‘]/.test(l)) l = ' ';
    o += l;
  }
  return o;
}
function slug(s){
  return String(s).replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
var EV = D.events || [], EVO = {}; EV.forEach(function(e){ EVO[e.o] = e; });
var CH = {}; (D.chapters || []).forEach(function(c){ CH[c.id] = c; });
var TAGS = Object.keys(INFO), SLUG = {};
TAGS.forEach(function(k){ SLUG[slug(k)] = k; });

// ================================================================ navigation
function flash(t){ t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); setTimeout(function(){ t.classList.remove('flash'); }, 2600); }
function scrollToEl(t, frac){
  var y = t.getBoundingClientRect().top + window.scrollY - innerHeight * frac;
  window.scrollTo({top: Math.max(0, y), behavior: RM ? 'auto' : 'smooth'});
}
function closeOverlays(keepKatip){
  try { if (U().TagCard && U().TagCard.isOpen()) U().TagCard.close(); } catch(e){}
  Net.close(true); Search.close(true);
  try { if (window.__ulvMap && window.__ulvMap.isOpen && window.__ulvMap.isOpen()) window.__ulvMap.close(); } catch(e){}
  if (!keepKatip && window.__katip) window.__katip.close();
}
function typeOf(k){ var i = INFO[k]; return i ? i.t : 'f'; }
var Nav = {
  card: function(o, opt){
    var t = document.querySelector('.ev[data-o="' + (+o) + '"]'); if (!t) return false;
    closeOverlays(opt && opt.keepKatip);
    scrollToEl(t, 0.22);
    // GSAP reveals cards as they enter; flash once the scroll has settled
    setTimeout(function(){ flash(t); }, RM ? 30 : 650);
    return true;
  },
  tag: function(name, from){
    var k = SLUG[name] || (INFO[name] ? name : null) || name;
    var tc = U().TagCard; if (!tc) return false;
    tc.open(typeOf(k), k, from || null); return true;
  },
  era: function(id){
    var s = document.querySelector('section.era[data-era="' + id + '"]'); if (!s) return false;
    closeOverlays(); scrollToEl(s, 0.12); return true;
  },
  place: function(p){
    var M = window.__ulvMap; if (!M) return false;
    closeOverlays();
    if (M.focusPlace) { M.focusPlace(p.id || p.name); return true; }
    M.open();
    var n = 0, iv = setInterval(function(){
      n++; var st = M.stats && M.stats();
      if ((st && st.loaded) || n > 50){ clearInterval(iv);
        try { if (p.x != null && M.zoomTo){ var v = M.view(); M.zoomTo(Math.max(v.s, v.fit * 3.2), p.x, p.y); } } catch(e){}
        try { if (M.showPlace && p.id) M.showPlace(p.id); } catch(e){} }
    }, 120);
    return true;
  },
  slug: slug, fold: fold,
  tagBySlug: function(s){ return SLUG[s] || null; },
  hasCard: function(o){ return !!EVO[+o]; }
};
window.__ulvNav = Nav;
// jumping from a tag card to an event should also close our overlays
document.addEventListener('click', function(ev){ if (ev.target.closest && ev.target.closest('.tc [data-go]')){ Net.close(true); Search.close(true); } }, true);

// ================================================================ graph data
var KIND = {c:'Karakter', p:'Mekân', f:'Topluluk', r:'Irk & halk'};
var KIND_PL = {c:'Karakterler', p:'Mekânlar', f:'Topluluklar & örgütler', r:'Irklar & halklar'};
var COL = {c:[244,196,98], p:[96,214,196], f:[178,128,255], r:[255,122,140]};
function kindOf(k){
  var i = INFO[k] || {}; if (i.t !== 'f') return i.t || 'f';
  return /\bırk|halk|varlık|yaratık|elfleri\b/i.test(i.sub || '') || /^(Elfler|İnsanlar|Cüceler|Orclar|Goblinler|Hobbitler|Devler|Entler|Koboldlar|Druidler|Elementaller)$/.test(k) ? 'r' : 'f';
}
var G = null;
function graph(){
  if (G) return G;
  var tc = U().TagCard, idx = {}, nodes = TAGS.map(function(k, i){ idx[k] = i; return {i:i, k:k, t:kindOf(k), w:0, deg:0, nb:{}, ev:0}; });
  var E = {};
  function link(a, b, w){ if (a === b) return; var x = Math.min(a, b), y = Math.max(a, b), key = x * 4096 + y; E[key] = (E[key] || 0) + w; }
  EV.forEach(function(e){
    var s = {};
    ['chars', 'places', 'factions'].forEach(function(f){ (e[f] || []).forEach(function(n){ var r = tc && tc.resolve(n); var k = r ? r.key : (INFO[n] ? n : null); if (k != null && idx[k] != null) s[idx[k]] = 1; }); });
    var ids = Object.keys(s).map(Number);
    ids.forEach(function(a){ nodes[a].ev++; });
    var w = (e.major ? 1.3 : 1) / Math.max(1, Math.sqrt(ids.length / 4));
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) link(ids[i], ids[j], w);
  });
  // explicit relations: a tag's bio/sub/facts naming another tag
  var names = [];
  TAGS.forEach(function(k, i){ [k].concat(INFO[k].alias || []).forEach(function(a){ var f = fold(a).replace(/\s*\(.*\)\s*/, ' ').trim(); if (f.length >= 4) names.push([' ' + f, i]); }); });
  TAGS.forEach(function(k, i){
    var v = INFO[k], txt = ' ' + fold([v.sub || ''].concat(v.bio || [], (v.facts || []).map(function(f){ return f[1]; })).join(' ')).replace(/[^a-z0-9]+/g, ' ') + ' ';
    var seen = {};
    names.forEach(function(n){ if (n[1] !== i && !seen[n[1]] && txt.indexOf(n[0].replace(/[^a-z0-9]+/g, ' ') + ' ') >= 0){ seen[n[1]] = 1; link(i, n[1], 1.6); } });
  });
  var edges = [];
  for (var key in E){ var a = Math.floor(key / 4096), b = key % 4096, w = E[key]; edges.push([a, b, w]);
    nodes[a].w += w; nodes[b].w += w; nodes[a].deg++; nodes[b].deg++; nodes[a].nb[b] = w; nodes[b].nb[a] = w; }
  var maxW = 1; nodes.forEach(function(n){ if (n.w > maxW) maxW = n.w; });
  nodes.forEach(function(n){ n.imp = Math.sqrt(n.w / maxW); });
  G = {nodes:nodes, edges:edges, idx:idx};
  G.comm = communities(G);
  G.fam = families();
  return G;
}
// one-level Louvain (local modularity moves) -> related clusters for the list mode
function communities(g){
  var N = g.nodes.length, c = [], tot = [], m2 = 0, k = [];
  g.nodes.forEach(function(n, i){ c[i] = i; k[i] = n.w; tot[i] = n.w; m2 += n.w; });
  if (!m2) return c;
  var res = 1.15, moved = true, pass = 0, order = g.nodes.map(function(n){ return n.i; });
  while (moved && pass++ < 12){
    moved = false;
    for (var oi = 0; oi < N; oi++){
      var i = order[oi], ci = c[i], nb = g.nodes[i].nb, wc = {};
      for (var j in nb){ wc[c[j]] = (wc[c[j]] || 0) + nb[j]; }
      tot[ci] -= k[i];
      var best = ci, bg = (wc[ci] || 0) - res * tot[ci] * k[i] / m2;
      for (var cc in wc){ var gain = wc[cc] - res * tot[cc] * k[i] / m2; if (gain > bg + 1e-9){ bg = gain; best = +cc; } }
      tot[best] += k[i]; if (best !== ci){ c[i] = best; moved = true; }
    }
  }
  return c;
}
// name families: tags whose name or subtitle mentions another tag's name (Ark Armatech, Vahidan, Herkenoff, Julius…), 3+ members
function families(){
  var STOPW = {prens:1, profesor:1, doktor:1, kommisar:1, beyaz:1, secilen:1, aday:1, dusmus:1, oburluk:1, melankoli:1, prof:1, olum:1};
  var cands = [];
  TAGS.forEach(function(k){
    var v = INFO[k], fs = [k].concat(v.alias || []).map(function(a){ return fold(a).replace(/\(.*\)/, '').replace(/[^a-z0-9]+/g, ' ').trim(); });
    if (v.t === 'c') fs.push(fs[0].split(' ')[0]);
    var seen = {};
    fs.forEach(function(f){ if (f.length >= 4 && !seen[f] && !STOPW[f.split(' ')[0]]){ seen[f] = 1; cands.push([f, k]); } });
  });
  var hay = {}; TAGS.forEach(function(k){ hay[k] = ' ' + fold(k + ' ' + (INFO[k].sub || '')).replace(/[^a-z0-9]+/g, ' ') + ' '; });
  var groups = {};
  cands.forEach(function(c){ var f = ' ' + c[0] + ' ', mem = groups[c[1]] || (groups[c[1]] = {}); mem[c[1]] = 1;
    TAGS.forEach(function(k){ if (hay[k].indexOf(f) >= 0) mem[k] = 1; }); });
  var out = [], sig = {};
  for (var k in groups){ var ks = Object.keys(groups[k]); if (ks.length < 3) continue;
    var sg = ks.slice().sort().join('|'); if (sig[sg]) continue; sig[sg] = 1;
    ks.sort(function(a, b){ return (a === k ? -1 : b === k ? 1 : 0); }); out.push({name: k, keys: ks}); }
  out.sort(function(a, b){ return b.keys.length - a.keys.length; });
  return out.slice(0, 28);
}

// ================================================================ buttons
var ICON_NET = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 4.5L5.5 9M12 4.5l6.5 4.5M5.5 9l1.8 8.5M18.5 9l-1.8 8.5M7.3 17.5h9.4M12 4.5l-.3 7.3M5.5 9l6.2 2.8M18.5 9l-6.8 2.8M7.3 17.5l4.4-5.7M16.7 17.5l-5-5.7" stroke-opacity=".75"/></g><g fill="currentColor"><circle cx="12" cy="4.5" r="2"/><circle cx="5.5" cy="9" r="1.7"/><circle cx="18.5" cy="9" r="1.7"/><circle cx="7.3" cy="17.5" r="1.7"/><circle cx="16.7" cy="17.5" r="1.7"/><circle cx="11.7" cy="11.8" r="1.4"/></g></svg>';
var ICON_SRCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.2 15.2L20 20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
var ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function mkBtn(cls, label, icon){
  var b = document.createElement('button'); b.type = 'button'; b.className = 'xb ' + cls; b.title = label;
  b.setAttribute('aria-label', label); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
  b.innerHTML = icon + '<span class="xb-ring" aria-hidden="true"></span>'; document.body.appendChild(b); return b;
}
var netBtn = mkBtn('xb-net', 'Etiket ağı', ICON_NET), srchBtn = mkBtn('xb-srch', 'Ara (Ctrl+K)', ICON_SRCH);
// sit to the left of the map button whatever its size/position
function placeBtns(){
  var m = document.getElementById('mapBtn'); if (!m) return;
  var r = m.getBoundingClientRect(); if (!r.width) return;
  var gap = innerWidth <= 860 ? 8 : 10, w = r.width;
  [netBtn, srchBtn].forEach(function(b, i){ b.style.width = b.style.height = w + 'px'; b.style.top = r.top + 'px';
    b.style.right = (innerWidth - r.left + gap + i * (w + gap)) + 'px'; });
}
placeBtns(); addEventListener('resize', placeBtns); addEventListener('load', function(){ placeBtns(); setTimeout(placeBtns, 600); });
if (!document.getElementById('mapBtn')) setTimeout(placeBtns, 50);

// ================================================================ TAG NETWORK
var Net = (function(){
  var ov = document.createElement('div'); ov.className = 'tn'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Etiket ağı');
  ov.innerHTML = '<div class="tn-neb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
    '<canvas class="tn-cv"></canvas>' +
    '<div class="tn-list" hidden><div class="tn-lhead"><div class="tn-seg" role="tablist"><button type="button" class="on" data-g="type" role="tab" aria-selected="true">Türe göre</button><button type="button" data-g="clu" role="tab" aria-selected="false">İlişki kümeleri</button></div></div><div class="tn-lbody"></div></div>' +
    '<header class="tn-top"><div class="tn-title"><span class="tn-k">Ulunavir Arşivi</span><b>Etiket Ağı</b><span class="tn-n"></span></div>' +
    '<label class="tn-find">' + ICON_SRCH + '<input type="search" placeholder="Etiket süz…" aria-label="Etiketleri süz" autocomplete="off" spellcheck="false"></label>' +
    '<button type="button" class="tn-mode" aria-pressed="false"><span class="m-list">Liste görünümü</span><span class="m-net">Ağ görünümü</span></button>' +
    '<button type="button" class="tn-x" aria-label="Kapat (Esc)">' + ICON_X + '</button></header>' +
    '<div class="tn-legend"></div><div class="tn-hint">Sürükle: döndür · Tekerlek / iki parmak: yakınlaş · Tıkla: bilgi kartı</div>' +
    '<div class="tn-tip" hidden></div>';
  document.body.appendChild(ov);
  var cv = ov.querySelector('.tn-cv'), ctx = cv.getContext('2d'), tip = ov.querySelector('.tn-tip'), listEl = ov.querySelector('.tn-list'),
      lbody = ov.querySelector('.tn-lbody'), find = ov.querySelector('.tn-find input'), modeB = ov.querySelector('.tn-mode');
  var g = null, P = null, built = false, raf = 0, W = 0, H = 0, DPR = 1, iter = 0, ITER = 260, temp = 1;
  var R = [1,0,0, 0,1,0, 0,0,1], zoom = 1, vx = 0, vy = 0, idleT = 0, hover = -1, sel = -1, match = null, listMode = false, grouping = 'type';
  var sprites = {}, proj = [], order = [], last = 0, closeT = 0, opener = null;

  function rnd(seed){ return function(){ seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function build(){
    g = graph(); var N = g.nodes.length, r = rnd(1234567);
    P = new Float32Array(N * 3);
    g.nodes.forEach(function(n, i){ var u = r() * 2 - 1, th = r() * Math.PI * 2, rr = 0.6 + r() * 0.4, s = Math.sqrt(1 - u * u);
      P[i*3] = rr * s * Math.cos(th); P[i*3+1] = rr * u; P[i*3+2] = rr * s * Math.sin(th); });
    ov.querySelector('.tn-n').textContent = N + ' etiket · ' + g.edges.length + ' bağ';
    var lg = ''; ['c', 'p', 'f', 'r'].forEach(function(t){ var n = g.nodes.filter(function(x){ return x.t === t; }).length; if (n) lg += '<span><i style="--c:rgb(' + COL[t] + ')"></i>' + KIND_PL[t] + ' <em>' + n + '</em></span>'; });
    ov.querySelector('.tn-legend').innerHTML = lg;
    for (var t in COL) sprites[t] = sprite(COL[t]);
    built = true; iter = 0; temp = 1;
  }
  function sprite(c){
    var s = document.createElement('canvas'), z = 64; s.width = s.height = z; var x = s.getContext('2d');
    var gr = x.createRadialGradient(z/2, z/2, 0, z/2, z/2, z/2);
    gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.16, 'rgba(' + c + ',1)'); gr.addColorStop(0.34, 'rgba(' + c + ',.55)');
    gr.addColorStop(0.62, 'rgba(' + c + ',.12)'); gr.addColorStop(1, 'rgba(' + c + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, z, z); return s;
  }
  // 3D force layout, run progressively so the web visibly unfolds
  function relax(steps){
    var N = g.nodes.length, F = new Float32Array(N * 3), E = g.edges, k = 0.32;
    for (var s = 0; s < steps && iter < ITER; s++, iter++){
      F.fill(0);
      for (var i = 0; i < N; i++){ var xi = P[i*3], yi = P[i*3+1], zi = P[i*3+2];
        for (var j = i + 1; j < N; j++){ var dx = xi - P[j*3], dy = yi - P[j*3+1], dz = zi - P[j*3+2], d2 = dx*dx + dy*dy + dz*dz + 0.002;
          var f = k * k * 0.06 / d2; F[i*3] += dx*f; F[i*3+1] += dy*f; F[i*3+2] += dz*f; F[j*3] -= dx*f; F[j*3+1] -= dy*f; F[j*3+2] -= dz*f; } }
      for (var e = 0; e < E.length; e++){ var a = E[e][0], b = E[e][1], w = Math.log(1 + E[e][2]);
        var ex = P[b*3] - P[a*3], ey = P[b*3+1] - P[a*3+1], ez = P[b*3+2] - P[a*3+2], d = Math.sqrt(ex*ex + ey*ey + ez*ez) + 1e-4;
        var fa = (d - k * 0.7) * 0.035 * w / d; F[a*3] += ex*fa; F[a*3+1] += ey*fa; F[a*3+2] += ez*fa; F[b*3] -= ex*fa; F[b*3+1] -= ey*fa; F[b*3+2] -= ez*fa; }
      var t = 0.06 * temp;
      for (var n = 0; n < N; n++){ var px = P[n*3], py = P[n*3+1], pz = P[n*3+2], rr = Math.sqrt(px*px + py*py + pz*pz);
        var gv = 0.012 * (1 + (g.nodes[n].deg ? 0 : 2)); F[n*3] -= px*gv*rr; F[n*3+1] -= py*gv*rr; F[n*3+2] -= pz*gv*rr;
        var fl = Math.sqrt(F[n*3]*F[n*3] + F[n*3+1]*F[n*3+1] + F[n*3+2]*F[n*3+2]) + 1e-9, m = Math.min(fl, t) / fl;
        P[n*3] += F[n*3]*m; P[n*3+1] += F[n*3+1]*m; P[n*3+2] += F[n*3+2]*m; }
      temp = Math.max(0.05, temp * 0.988);
    }
    // normalise radius so the web fills the view
    var ds = []; for (var q = 0; q < N; q++) ds.push(Math.sqrt(P[q*3]*P[q*3] + P[q*3+1]*P[q*3+1] + P[q*3+2]*P[q*3+2]));
    ds.sort(function(a, b){ return a - b; }); var r90 = ds[Math.floor(N * 0.92)] || 1, sc = 1 / r90;
    if (Math.abs(sc - 1) > 0.01) for (var z = 0; z < N * 3; z++) P[z] *= sc;
  }
  function rot(ax, ay){   // premultiply rotation about screen X (ax) and Y (ay)
    var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    var A = [cy, 0, sy, sx*sy, cx, -sx*cy, -cx*sy, sx, cx*cy], B = R.slice();
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) R[i*3+j] = A[i*3]*B[j] + A[i*3+1]*B[3+j] + A[i*3+2]*B[6+j];
  }
  function resize(){
    DPR = Math.min(devicePixelRatio || 1, lite() ? 1 : matchMedia('(pointer:coarse)').matches ? 1.5 : 2);
    W = ov.clientWidth; H = ov.clientHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  function frame(t){
    raf = 0; if (ov.hidden || listMode) return;
    var dt = last ? Math.min(50, t - last) : 16; last = t;
    if (iter < ITER) relax(lite() ? 10 : 4);
    if (!drag){
      vx *= 0.94; vy *= 0.94;
      if (t - idleT > 1600 && !RM) { vy += (0.00009 * dt - vy) * 0.03; }
      if (Math.abs(vx) + Math.abs(vy) > 1e-6) rot(vx, vy);
    }
    draw(t);
    raf = requestAnimationFrame(frame);
  }
  function kick(){ if (!raf && !ov.hidden && !listMode) raf = requestAnimationFrame(frame); }
  var BUCK = 5;
  function draw(t){
    var N = g.nodes.length, S = Math.min(W, H) * (W < 700 ? 0.45 : 0.40) * zoom, NS = Math.max(0.62, Math.min(1, Math.min(W, H) * 0.4 / 330)), cx = W / 2, cy = H / 2 + (W < 700 ? 10 : 0), cam = 3.2;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < N; i++){ var x = P[i*3], y = P[i*3+1], z = P[i*3+2];
      var X = R[0]*x + R[1]*y + R[2]*z, Y = R[3]*x + R[4]*y + R[5]*z, Z = R[6]*x + R[7]*y + R[8]*z;
      var s = cam / (cam - Z); proj[i] = {x: cx + X * S * s, y: cy - Y * S * s, z: Z, s: s}; }
    var focus = sel >= 0 ? sel : hover, nb = focus >= 0 ? g.nodes[focus].nb : null, lt = lite();
    // edges, batched into colour x alpha buckets
    var paths = {};
    for (var e = 0; e < g.edges.length; e++){ var E = g.edges[e], a = proj[E[0]], b = proj[E[1]];
      var depth = ((a.z + b.z) / 2 + 1.3) / 2.6, al = Math.min(1, 0.18 + Math.log(1 + E[2]) * 0.35) * (0.25 + depth * 0.75);
      var hl = focus >= 0 && (E[0] === focus || E[1] === focus);
      if (focus >= 0 && !hl) al *= 0.22; if (match && !hl && !(match[E[0]] && match[E[1]])) al *= 0.15;
      if (lt && !hl && al < 0.25) continue;
      var lvl = hl ? BUCK : Math.min(BUCK - 1, Math.floor(al * BUCK)), ty = g.nodes[hl ? focus : (a.z > b.z ? E[0] : E[1])].t, key = ty + lvl;
      var p = paths[key] || (paths[key] = {t: ty, l: lvl, a: []}); p.a.push(a.x, a.y, b.x, b.y); }
    ctx.lineCap = 'round';
    for (var kk in paths){ var pp = paths[kk], c = COL[pp.t], arr = pp.a;
      ctx.strokeStyle = 'rgba(' + c + ',' + (pp.l === BUCK ? 0.75 : (0.03 + pp.l * 0.065)) + ')'; ctx.lineWidth = pp.l === BUCK ? 1.4 : 0.8;
      ctx.beginPath(); for (var q = 0; q < arr.length; q += 4){ ctx.moveTo(arr[q], arr[q+1]); ctx.lineTo(arr[q+2], arr[q+3]); } ctx.stroke(); }
    // nodes back to front
    order.length = 0; for (var o = 0; o < N; o++) order.push(o);
    order.sort(function(a, b){ return proj[a].z - proj[b].z; });
    var tw = t * 0.0016, labels = [];
    for (var m = 0; m < N; m++){ var n = order[m], P2 = proj[n], nd = g.nodes[n];
      var dim = focus >= 0 ? (n !== focus && !(nb && nb[n])) : !!(match && !match[n]);
      var depth2 = (P2.z + 1.3) / 2.6, r = (4 + nd.imp * 13) * NS * P2.s * Math.sqrt(zoom) * (n === focus ? 1.5 : 1);
      if (!lt) r *= 1 + 0.06 * Math.sin(tw + n * 1.7);
      ctx.globalAlpha = dim ? 0.13 : (0.35 + depth2 * 0.65);
      ctx.drawImage(sprites[nd.t], P2.x - r * 2, P2.y - r * 2, r * 4, r * 4);
      if (!dim && (n === focus || (nb && nb[n]) || (match && match[n] && matchN < 40) || (nd.imp > 0.42 && P2.z > -0.35) || (zoom > 1.6 && nd.imp > 0.22 && P2.z > 0)))
        labels.push([n, P2, r, n === focus ? 2 : (nb && nb[n]) ? 1 : 0]); }
    ctx.globalAlpha = 1;
    // labels (front-most first, skip overlaps)
    labels.sort(function(a, b){ return b[3] - a[3] || b[1].z - a[1].z; });
    var boxes = [];
    for (var l = 0; l < labels.length && l < 70; l++){ var L = labels[l], nd2 = g.nodes[L[0]], big = L[3] === 2;
      ctx.font = (big ? '700 15px' : (nd2.imp > 0.6 ? '600 12.5px' : '600 11px')) + ' Cinzel, Georgia, serif';
      var tx = L[1].x, ty2 = L[1].y - L[2] * 1.05 - 6, wdt = ctx.measureText(nd2.k).width, bx = [tx - wdt / 2 - 3, ty2 - 12, wdt + 6, 15];
      if (!big && boxes.some(function(b){ return bx[0] < b[0] + b[2] && bx[0] + bx[2] > b[0] && bx[1] < b[1] + b[3] && bx[1] + bx[3] > b[1]; })) continue;
      boxes.push(bx); ctx.textAlign = 'center';
      ctx.globalAlpha = big ? 1 : Math.max(0.35, Math.min(1, 0.5 + L[1].z * 0.6));
      ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(8,5,14,.85)'; ctx.strokeText(nd2.k, tx, ty2);
      ctx.fillStyle = big ? '#fff3d0' : 'rgba(' + COL[nd2.t].map(function(v){ return Math.min(255, v + 50); }) + ',1)'; ctx.fillText(nd2.k, tx, ty2); }
    ctx.globalAlpha = 1;
  }
  function pick(x, y){
    var best = -1, bd = 1e9; if (!proj.length) return -1;
    for (var i = 0; i < proj.length; i++){ var p = proj[i], r = Math.max(9, (4 + g.nodes[i].imp * 13) * p.s * Math.sqrt(zoom)) + 3;
      var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < r * r && (d - p.z * 40) < bd){ bd = d - p.z * 40; best = i; } }
    return best;
  }
  // ---- input: drag rotate, wheel / pinch zoom, click
  var drag = false, ptrs = {}, sx = 0, sy = 0, lx = 0, ly = 0, moved = 0, pinch0 = 0, zoom0 = 1;
  cv.addEventListener('pointerdown', function(ev){
    ptrs[ev.pointerId] = [ev.clientX, ev.clientY]; cv.setPointerCapture(ev.pointerId);
    var ids = Object.keys(ptrs);
    if (ids.length === 2){ var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = zoom; }
    drag = true; sx = lx = ev.clientX; sy = ly = ev.clientY; moved = 0; vx = vy = 0; idleT = performance.now(); kick();
  });
  cv.addEventListener('pointermove', function(ev){
    var rc = cv.getBoundingClientRect(), x = ev.clientX - rc.left, y = ev.clientY - rc.top;
    if (ptrs[ev.pointerId]) ptrs[ev.pointerId] = [ev.clientX, ev.clientY];
    var ids = Object.keys(ptrs);
    if (ids.length === 2 && pinch0){ var a = ptrs[ids[0]], b = ptrs[ids[1]]; zoom = Math.max(0.45, Math.min(4.5, zoom0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0)); moved = 99; kick(); return; }
    if (drag){ var dx = ev.clientX - lx, dy = ev.clientY - ly; lx = ev.clientX; ly = ev.clientY; moved += Math.abs(dx) + Math.abs(dy);
      vy = dx * 0.0062; vx = dy * 0.0062; rot(vx, vy); idleT = performance.now(); kick(); hideTip(); return; }
    if (ev.pointerType === 'mouse'){ var h = pick(x, y); if (h !== hover){ hover = h; cv.style.cursor = h >= 0 ? 'pointer' : 'grab'; kick(); }
      if (h >= 0) showTip(h, x, y); else hideTip(); }
  });
  function up(ev){
    delete ptrs[ev.pointerId]; if (Object.keys(ptrs).length < 2) pinch0 = 0;
    if (!drag) return; if (Object.keys(ptrs).length) return; drag = false;
    if (moved < 6){ var rc = cv.getBoundingClientRect(), n = pick(ev.clientX - rc.left, ev.clientY - rc.top);
      if (n >= 0) select(n, true); else if (sel >= 0){ sel = -1; kick(); } }
  }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', function(){ if (hover >= 0 && !drag){ hover = -1; kick(); } hideTip(); });
  cv.addEventListener('wheel', function(ev){ ev.preventDefault(); zoom = Math.max(0.45, Math.min(4.5, zoom * Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0012)))); idleT = performance.now(); kick(); }, {passive:false});
  function showTip(n, x, y){
    var nd = g.nodes[n], i = INFO[nd.k] || {};
    tip.innerHTML = '<b>' + esc(nd.k) + '</b><span>' + esc(KIND[nd.t]) + (i.sub ? ' · ' + esc(i.sub) : '') + '</span><em>' + nd.deg + ' bağ · ' + nd.ev + ' olay</em>';
    tip.hidden = false; tip.style.transform = 'translate(' + Math.min(W - 240, x + 16) + 'px,' + Math.min(H - 70, y + 14) + 'px)';
  }
  function hideTip(){ tip.hidden = true; }
  function select(n, openCard){
    sel = n; kick(); hideTip();
    if (openCard){ var k = g.nodes[n].k; try { U().TagCard.open(INFO[k] ? INFO[k].t : 'f', k, netBtn); } catch(e){} }
  }
  // ---- filter
  var matchN = 0;
  find.addEventListener('input', function(){
    var q = fold(find.value).trim(); if (!g) return;
    if (!q){ match = null; matchN = 0; } else { match = {}; matchN = 0;
      g.nodes.forEach(function(n){ var hay = fold([n.k].concat((INFO[n.k] || {}).alias || [], (INFO[n.k] || {}).sub || '').join(' | '));
        if (hay.indexOf(q) >= 0){ match[n.i] = 1; matchN++; } }); }
    if (listMode) renderList(); else kick();
  });
  find.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter'){ ev.preventDefault(); if (!match || listMode) return; var ids = Object.keys(match); if (ids.length){ var best = ids.map(Number).sort(function(a, b){ return g.nodes[b].imp - g.nodes[a].imp; })[0]; select(best, true); } }
  });
  // ---- list mode
  function item(k){ var n = g.nodes[g.idx[k]], i = INFO[k] || {};
    return '<button type="button" class="tn-it" data-k="' + esc(k) + '" style="--c:rgb(' + COL[n.t] + ')"><i></i><b>' + esc(k) + '</b>' + (i.sub ? '<span>' + esc(i.sub) + '</span>' : '') + '</button>'; }
  function ok(k){ return !match || match[g.idx[k]]; }
  function renderList(){
    var h = '';
    if (grouping === 'type'){
      ['c', 'p', 'f', 'r'].forEach(function(t){ var ks = g.nodes.filter(function(n){ return n.t === t && ok(n.k); }).sort(function(a, b){ return b.imp - a.imp; }).map(function(n){ return n.k; });
        if (ks.length) h += '<section class="tn-grp"><h3 style="--c:rgb(' + COL[t] + ')">' + KIND_PL[t] + ' <em>' + ks.length + '</em></h3><div class="tn-its">' + ks.map(item).join('') + '</div></section>'; });
    } else {
      g.fam.forEach(function(f){ var ks = f.keys.filter(ok); if (ks.length) h += '<section class="tn-grp"><h3>' + esc(f.name) + ' çevresi <em>' + ks.length + '</em></h3><div class="tn-its">' + ks.map(item).join('') + '</div></section>'; });
      var by = {}; g.nodes.forEach(function(n){ (by[g.comm[n.i]] = by[g.comm[n.i]] || []).push(n); });
      var cl = Object.keys(by).map(function(c){ return by[c].sort(function(a, b){ return b.w - a.w; }); }).filter(function(a){ return a.length > 1; }).sort(function(a, b){ return b.length - a.length; });
      var loners = []; Object.keys(by).forEach(function(c){ if (by[c].length === 1) loners.push(by[c][0]); });
      cl.forEach(function(a){ var ks = a.filter(function(n){ return ok(n.k); }).map(function(n){ return n.k; }); if (!ks.length) return;
        h += '<section class="tn-grp"><h3>' + esc(a[0].k) + (a[1] ? ' · ' + esc(a[1].k) : '') + ' kümesi <em>' + ks.length + '</em></h3><div class="tn-its">' + ks.map(item).join('') + '</div></section>'; });
      var lk = loners.filter(function(n){ return ok(n.k); }).map(function(n){ return n.k; });
      if (lk.length) h += '<section class="tn-grp"><h3>Bağımsız kayıtlar <em>' + lk.length + '</em></h3><div class="tn-its">' + lk.map(item).join('') + '</div></section>';
    }
    lbody.innerHTML = h || '<p class="tn-empty">Bu süzgece uyan etiket yok.</p>';
  }
  listEl.addEventListener('click', function(ev){
    var s = ev.target.closest('.tn-seg button');
    if (s){ grouping = s.dataset.g; listEl.querySelectorAll('.tn-seg button').forEach(function(b){ var on = b === s; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); renderList(); lbody.scrollTop = 0; return; }
    var it = ev.target.closest('.tn-it'); if (it){ var k = it.dataset.k; sel = g.idx[k]; try { U().TagCard.open(INFO[k].t, k, it); } catch(e){} }
  });
  lbody.addEventListener('wheel', function(ev){ ev.stopPropagation(); }, {passive:true});
  function setMode(l){
    listMode = l; ov.classList.toggle('list', l); modeB.setAttribute('aria-pressed', l); listEl.hidden = !l;
    if (l){ renderList(); listEl.classList.remove('in'); void listEl.offsetWidth; listEl.classList.add('in'); } else { resize(); kick(); }
    try { localStorage.setItem('ulv-tn-mode', l ? 'list' : 'net'); } catch(e){}
  }
  modeB.addEventListener('click', function(){ setMode(!listMode); });
  // ---- open / close
  function open(){
    Search.close(true); clearTimeout(closeT);
    if (!built) build();
    opener = document.activeElement;
    ov.hidden = false; ov.classList.remove('out'); document.body.classList.add('tn-open'); netBtn.setAttribute('aria-expanded', 'true');
    ov.classList.toggle('lite', lite());
    var m = 'net'; try { m = localStorage.getItem('ulv-tn-mode') || 'net'; } catch(e){}
    resize(); setMode(m === 'list');
    requestAnimationFrame(function(){ ov.classList.add('on'); });
    last = 0; idleT = performance.now() - 1200; kick();
    setTimeout(function(){ (matchMedia('(pointer:fine)').matches ? find : ov.querySelector('.tn-x')).focus({preventScroll:true}); }, 60);
  }
  function close(quick){
    if (ov.hidden) return;
    ov.classList.remove('on'); ov.classList.add('out'); document.body.classList.remove('tn-open'); netBtn.setAttribute('aria-expanded', 'false');
    closeT = setTimeout(function(){ ov.hidden = true; ov.classList.remove('out'); if (raf){ cancelAnimationFrame(raf); raf = 0; } }, quick || lite() ? 0 : 380);
    if (!quick && opener && opener.focus) opener.focus({preventScroll:true});
  }
  ov.querySelector('.tn-x').addEventListener('click', function(){ close(); });
  netBtn.addEventListener('click', function(){ ov.hidden ? open() : close(); });
  addEventListener('resize', function(){ if (!ov.hidden){ resize(); kick(); } });
  document.addEventListener('keydown', function(ev){
    if (ov.hidden || ev.key !== 'Escape') return;
    try { if (U().TagCard && U().TagCard.isOpen()) return; } catch(e){}
    if (find.value && document.activeElement === find){ find.value = ''; find.dispatchEvent(new Event('input')); return; }
    close();
  });
  return {open:open, close:close, isOpen:function(){ return !ov.hidden; }, _state:function(){ return {iter:iter, nodes:g && g.nodes.length, edges:g && g.edges.length, sel:sel, list:listMode, fam:g && g.fam.map(function(f){ return f.name + ':' + f.keys.length; })}; }};
})();

// ================================================================ SEARCH
var Search = (function(){
  var ov = document.createElement('div'); ov.className = 'sr'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Arşivde ara');
  ov.innerHTML = '<div class="sr-box"><div class="sr-bar">' + ICON_SRCH + '<input type="search" class="sr-in" placeholder="Arşivde ara: kişi, yer, olay, çağ…" aria-label="Arşivde ara" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="srList" aria-autocomplete="list">' +
    '<kbd class="sr-kbd">Esc</kbd><button type="button" class="sr-x" aria-label="Kapat">' + ICON_X + '</button></div>' +
    '<div class="sr-res" id="srList" role="listbox"></div><div class="sr-foot"><span><kbd>↑</kbd><kbd>↓</kbd> gez</span><span><kbd>Enter</kbd> aç</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>/</kbd> arama</span></div></div>';
  document.body.appendChild(ov);
  var inp = ov.querySelector('.sr-in'), res = ov.querySelector('.sr-res'), box = ov.querySelector('.sr-box');
  var IDX = null, PLACES = null, cur = [], act = -1, closeT = 0, opener = null;
  var GI = {tag:'Etiketler', era:'Çağlar ve bölümler', card:'Olaylar', place:'Haritadaki yerler'};
  function strip(s){ return String(s || '').replace(/\s+/g, ' '); }
  function mk(o){ o.f = o.keys.map(fold); o.fw = o.f.map(function(s){ return s.split(/[^a-z0-9]+/).filter(Boolean); }); o.fb = o.body ? fold(o.body) : ''; return o; }
  function index(){
    if (IDX) return IDX; IDX = [];
    TAGS.forEach(function(k){ var i = INFO[k]; IDX.push(mk({k:'tag', id:k, label:k, sub:(KIND[kindOf(k)] || '') + (i.sub ? ' · ' + i.sub : ''), keys:[k].concat(i.alias || []), body:(i.bio || []).join(' '), t:kindOf(k), boost:6 + Math.min(4, (graph().nodes[graph().idx[k]].ev || 0) / 4)})); });
    (D.chapters || []).forEach(function(c){ if (!document.querySelector('section.era[data-era="' + c.id + '"]')) return;
      IDX.push(mk({k:'era', id:c.id, label:c.name, sub:c.sub || 'Bölüm', keys:[c.name, c.sub || ''], body:c.sum || '', boost:5})); });
    EV.forEach(function(e){ IDX.push(mk({k:'card', id:e.o, label:e.title, sub:(function(cn){ return cn && fold(cn).indexOf(fold(String(e.date))) === 0 ? cn : e.date + (cn ? ' · ' + cn : ''); })((CH[e.era] || {}).name || ''), date:e.big, keys:[e.title, String(e.date)],
      body:strip([e.sum, typeof e.det === 'string' ? e.det : (e.det || []).join(' '), e.cons].join(' ')), boost:e.major ? 2 : 0})); });
    return IDX;
  }
  function loadPlaces(){
    if (PLACES) return; PLACES = [];
    fetch('assets/map/places.json', {cache:'no-cache'}).then(function(r){ return r.ok ? r.json() : []; }).then(function(a){
      if (a && !Array.isArray(a)) a = a.places; if (!Array.isArray(a) || !a.length) return; index();
      a.forEach(function(p){ var nm = p.name || p.n || p.title; if (!nm) return; PLACES.push(p);
        IDX.push(mk({k:'place', id:p.id || nm, label:nm, sub:'Harita' + (p.sub ? ' · ' + p.sub : (p.rank || p.type) ? ' · ' + ({capital:'başkent', city:'şehir', town:'kasaba', village:'köy', castle:'kale', ruin:'harabe', region:'bölge', sea:'deniz', landmark:'simge yapı', poi:'önemli yer'}[p.rank || p.type] || p.rank || p.type) : ''), keys:[nm].concat(p.alias || []), body:[].concat(p.description || p.desc || []).join(' '), p:p, boost:3})); });
      if (!ov.hidden && inp.value) run();
    }).catch(function(){});
  }
  // edit distance <= 1 (with transposition) between a and the same-length prefix of b
  function near(a, b){
    if (b.length < a.length - 1) return false; b = b.slice(0, a.length + 1);
    var best = 9; [a.length - 1, a.length, a.length + 1].forEach(function(L){ if (L < 1 || L > b.length) return; var d = lev(a, b.slice(0, L)); if (d < best) best = d; });
    return best <= (a.length >= 7 ? 2 : 1);
  }
  function lev(a, b){ var m = a.length, n = b.length, p = [], c, i, j; for (j = 0; j <= n; j++) p[j] = j;
    for (i = 1; i <= m; i++){ c = [i]; for (j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j-1] + 1, p[j-1] + (a[i-1] === b[j-1] ? 0 : 1)); p = c; } return p[n]; }
  function score(o, q, qt){
    var best = 0, at = -1, ki = 0;
    for (var i = 0; i < o.f.length; i++){ var s = o.f[i]; if (!s) continue; var sc = 0, pos = -1;
      if (s === q){ sc = 120; pos = 0; }
      else if (s.indexOf(q) === 0){ sc = 100 - Math.min(20, (s.length - q.length) / 3); pos = 0; }
      else { var wi = -1, ws = o.fw[i];
        for (var w = 0; w < ws.length; w++) if (ws[w].indexOf(qt[0]) === 0){ wi = w; break; }
        if (wi >= 0 && qt.every(function(t){ return ws.some(function(x){ return x.indexOf(t) === 0; }); })){ sc = 82 - wi * 2; pos = s.indexOf(qt[0]); while (pos > 0 && /[a-z0-9]/.test(s[pos-1])) pos = s.indexOf(qt[0], pos + 1); }
        else if (q.length >= 2 && (pos = s.indexOf(q)) >= 0) sc = 58;
        else if (q.length >= 4 && qt.every(function(t){ return t.length < 3 ? ws.some(function(x){ return x.indexOf(t) === 0; }) : ws.some(function(x){ return x.indexOf(t) === 0 || (x.length >= 4 && t.indexOf(x) === 0 && t.length - x.length <= 5) || near(t, x); }); })) sc = 44; }
      if (i > 0) sc *= 0.92;   // aliases/subtitles rank a touch lower than the main name
      if (sc > best){ best = sc; at = pos; ki = i; } }
    var snip = null;
    if (best < 58 && q.length >= 4 && o.fb){ var bp = o.fb.indexOf(q); if (bp >= 0){ if (22 > best){ best = 22; snip = bp; } } }
    if (!best) return null;
    return {o:o, s:best + o.boost, at:ki === 0 ? at : -1, snip:snip};
  }
  function hl(label, at, len){
    if (at < 0 || fold(label).length !== label.length) return esc(label);
    return esc(label.slice(0, at)) + '<mark>' + esc(label.slice(at, at + len)) + '</mark>' + esc(label.slice(at + len));
  }
  function snippet(body, p, len){
    var a = Math.max(0, p - 40), b = Math.min(body.length, p + len + 60);
    if (fold(body).length !== body.length) return esc(body.slice(a, b));
    return (a ? '…' : '') + esc(body.slice(a, p)) + '<mark>' + esc(body.slice(p, p + len)) + '</mark>' + esc(body.slice(p + len, b)) + (b < body.length ? '…' : '');
  }
  var ICO = {tag:{c:'☉', p:'⌂', f:'⚑', r:'❦'}, era:'⧗', card:'✦', place:'⚲'};
  function run(){
    var q = fold(inp.value).replace(/\s+/g, ' ').trim(); index();
    if (!q){ idle(); return; }
    var qt = q.split(' ').filter(Boolean), hits = [];
    IDX.forEach(function(o){ var r = score(o, q, qt); if (r) hits.push(r); });
    hits.sort(function(a, b){ return b.s - a.s; });
    var groups = {}, gorder = [];
    hits.forEach(function(h){ var k = h.o.k; if (!groups[k]){ groups[k] = []; gorder.push(k); } if (groups[k].length < (k === 'card' ? 24 : 16)) groups[k].push(h); });
    cur = []; var html = '';
    gorder.forEach(function(k){
      html += '<div class="sr-g" role="presentation"><div class="sr-gh">' + GI[k] + ' <em>' + groups[k].length + (hits.filter(function(h){ return h.o.k === k; }).length > groups[k].length ? '+' : '') + '</em></div>';
      groups[k].forEach(function(h){ var o = h.o, n = cur.length; cur.push(o);
        var ic = o.k === 'tag' ? ICO.tag[o.t] : ICO[o.k], col = o.k === 'tag' ? 'rgb(' + COL[o.t] + ')' : o.k === 'card' ? '#e2b45a' : o.k === 'era' ? '#c9a2ff' : '#7fd6c8';
        html += '<div class="sr-r" role="option" id="sr' + n + '" data-n="' + n + '" style="--c:' + col + '"><span class="sr-ic" aria-hidden="true">' + ic + '</span><span class="sr-tx"><b>' + hl(o.label, h.at, q.length) + '</b>' +
          '<span class="sr-sub">' + (h.snip != null ? snippet(o.body, h.snip, q.length) : esc(o.sub)) + '</span></span>' + (o.k === 'card' ? '<span class="sr-date">' + esc(o.date) + '</span>' : '') + '</div>'; });
      html += '</div>';
    });
    res.innerHTML = html || '<p class="sr-empty">“' + esc(inp.value.trim()) + '” için kayıtlarda bir iz bulunamadı.</p>';
    setAct(cur.length ? 0 : -1, true);
  }
  function idle(){
    cur = []; var top = graph().nodes.slice().sort(function(a, b){ return b.w - a.w; }).slice(0, 12);
    var h = '<div class="sr-g"><div class="sr-gh">Sık geçenler</div><div class="sr-chips">';
    top.forEach(function(n){ var o = IDX.filter(function(x){ return x.k === 'tag' && x.id === n.k; })[0]; var i = cur.length; cur.push(o);
      h += '<button type="button" class="sr-chip sr-r" data-n="' + i + '" id="sr' + i + '" style="--c:rgb(' + COL[n.t] + ')">' + esc(n.k) + '</button>'; });
    h += '</div></div><p class="sr-tipx">Bir harf bile yeter: “a”, “neb”, “ark”… Türkçe karakterler fark etmez (ş = s, ı = i).</p>';
    res.innerHTML = h; act = -1;
  }
  function setAct(n, noScroll){
    var els = res.querySelectorAll('.sr-r'); if (act >= 0 && els[act]) els[act].classList.remove('on');
    act = n; if (n >= 0 && els[n]){ els[n].classList.add('on'); inp.setAttribute('aria-activedescendant', 'sr' + n); if (!noScroll) els[n].scrollIntoView({block:'nearest'}); }
  }
  function choose(n){
    var o = cur[n]; if (!o) return;
    if (o.k === 'tag'){ close(true); Nav.tag(o.id, srchBtn); }
    else if (o.k === 'card') Nav.card(o.id);
    else if (o.k === 'era') Nav.era(o.id);
    else if (o.k === 'place') Nav.place(o.p);
  }
  var qT = 0;
  inp.addEventListener('input', function(){ clearTimeout(qT); qT = setTimeout(run, 40); });
  inp.addEventListener('keydown', function(ev){
    var n = res.querySelectorAll('.sr-r').length;
    if (ev.key === 'ArrowDown'){ ev.preventDefault(); if (n) setAct((act + 1) % n); }
    else if (ev.key === 'ArrowUp'){ ev.preventDefault(); if (n) setAct((act - 1 + n) % n); }
    else if (ev.key === 'Enter'){ ev.preventDefault(); clearTimeout(qT); if (inp.value.trim() && act < 0) run(); if (act >= 0) choose(act); }
    else if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); if (inp.value){ inp.value = ''; run(); } else close(); }
  });
  res.addEventListener('click', function(ev){ var r = ev.target.closest('.sr-r'); if (r) choose(+r.dataset.n); });
  res.addEventListener('mousemove', function(ev){ var r = ev.target.closest('.sr-r'); if (r && +r.dataset.n !== act) setAct(+r.dataset.n, true); });
  res.addEventListener('wheel', function(ev){ ev.stopPropagation(); }, {passive:true});
  ov.addEventListener('click', function(ev){ if (ev.target.closest('.sr-x') || !ev.target.closest('.sr-box')) close(); });
  function open(){
    Net.close(true); clearTimeout(closeT); index(); loadPlaces();
    opener = document.activeElement;
    ov.hidden = false; ov.classList.remove('out'); document.body.classList.add('sr-open'); srchBtn.setAttribute('aria-expanded', 'true');
    var r = srchBtn.getBoundingClientRect(); box.style.setProperty('--ox', (r.left + r.width / 2 - box.getBoundingClientRect().left) + 'px');
    requestAnimationFrame(function(){ ov.classList.add('on'); });
    if (inp.value) { inp.select(); run(); } else idle();
    inp.focus({preventScroll:true});
  }
  function close(quick){
    if (ov.hidden) return;
    ov.classList.remove('on'); ov.classList.add('out'); document.body.classList.remove('sr-open'); srchBtn.setAttribute('aria-expanded', 'false');
    closeT = setTimeout(function(){ ov.hidden = true; ov.classList.remove('out'); }, quick || lite() ? 0 : 260);
    if (!quick && opener && opener.focus && opener !== document.body) opener.focus({preventScroll:true});
  }
  srchBtn.addEventListener('click', function(){ ov.hidden ? open() : close(); });
  document.addEventListener('keydown', function(ev){
    var t = ev.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')){ ev.preventDefault(); ov.hidden ? open() : (inp.focus(), inp.select()); return; }
    if (ev.key === '/' && !typing && ov.hidden && !ev.ctrlKey && !ev.metaKey){
      try { if (U().TagCard.isOpen() || (window.__ulvMap && window.__ulvMap.isOpen())) return; } catch(e){}
      ev.preventDefault(); open(); }
  });
  return {open:open, close:close, isOpen:function(){ return !ov.hidden; }, query:function(s){ inp.value = s; run(); return cur.map(function(o){ return o.k + ':' + o.label; }); }};
})();
window.__ulvExplore = {Net:Net, Search:Search};
})();
