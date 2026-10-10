/* Horaghfus — interactive 2D world map (v1)
   Tile pyramid on Canvas2D + WebGL atmosphere (fog from a precomputed coast-distance field,
   parallax clouds with shadows, sea shimmer) + SVG route tool. Self-contained: no app.js edits.
   Data: assets/map/{config,tiles,places,roads}.json */
(function(){
  'use strict';
  var BASE = 'assets/map/';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICON_MAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5l5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity=".7"/></svg>';
  var I = {
    hand:'<svg viewBox="0 0 24 24"><path d="M12 2.5l2.6 3.2h-1.8v5.5h5.5V9.4L21.5 12l-3.2 2.6v-1.8h-5.5v5.5h1.8L12 21.5l-2.6-3.2h1.8v-5.5H5.7v1.8L2.5 12l3.2-2.6v1.8h5.5V5.7H9.4z" fill="currentColor"/></svg>',
    route:'<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2.3" fill="currentColor"/><circle cx="19" cy="6" r="2.3" fill="currentColor"/><path d="M6.5 16.5C10 14 7 10 11 9s5 1 6.5-1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.6 2.4" stroke-linecap="round"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    minus:'<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    fit:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    undo:'<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5M4.5 12H15a5 5 0 010 10h-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  // ---------------------------------------------------------------- DOM
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'map-btn'; btn.id = 'mapBtn';
  btn.setAttribute('aria-label', 'Horaghfus haritasını aç'); btn.title = 'Harita';
  btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = ICON_MAP + '<span class="map-btn-ring" aria-hidden="true"></span>';
  document.body.appendChild(btn);

  var ov = document.createElement('div');
  ov.className = 'mapx'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Horaghfus haritası');
  ov.innerHTML =
    '<div class="mapx-panel">' +
      '<div class="mapx-stage">' +
        '<canvas class="mapx-tiles"></canvas>' +
        '<canvas class="mapx-fx"></canvas>' +
        '<svg class="mapx-svg" xmlns="http://www.w3.org/2000/svg"><g class="mapx-roads"></g><g class="mapx-route"><path class="r-glow"/><path class="r-ink"/><path class="r-dash"/><g class="r-segs"></g><g class="r-nodes"></g></g></svg>' +
        '<div class="mapx-labels"></div>' +
        '<div class="mapx-vig" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="mapx-tools" role="toolbar" aria-label="Harita araçları">' +
        '<button type="button" class="mt-nav on" data-tool="nav" aria-pressed="true" title="Gezinme (sürükle, tekerlekle yakınlaş)">' + I.hand + '</button>' +
        '<button type="button" class="mt-route" data-tool="route" aria-pressed="false" title="Rota ölç (tıkla: nokta ekle)">' + I.route + '</button>' +
        '<i class="mt-sep"></i>' +
        '<button type="button" class="mt-in" title="Yakınlaş">' + I.plus + '</button>' +
        '<button type="button" class="mt-out" title="Uzaklaş">' + I.minus + '</button>' +
        '<button type="button" class="mt-fit" title="Tüm harita">' + I.fit + '</button>' +
      '</div>' +
      '<div class="mapx-rt" hidden>' +
        '<div class="rt-main"><span class="rt-km">—</span><span class="rt-t"><b class="rt-walk">—</b> yaya · <b class="rt-horse">—</b> atlı</span></div>' +
        '<div class="rt-sub"><span class="rt-hint">Haritaya tıklayarak durak ekle</span><span class="rt-est">ölçek tahmini</span></div>' +
        '<div class="rt-btns"><button type="button" class="rt-undo" title="Son durağı geri al (Backspace)">' + I.undo + '</button><button type="button" class="rt-clear" title="Rotayı temizle">' + I.trash + '</button></div>' +
      '</div>' +
      '<div class="mapx-pop" hidden></div>' +
      '<div class="mapx-load" aria-hidden="true"><i></i></div>' +
      '<button type="button" class="mapx-x" aria-label="Haritayı kapat" title="Kapat (Esc)">' + I.x + '</button>' +
    '</div>';
  document.body.appendChild(ov);

  var panel = ov.querySelector('.mapx-panel'), stage = ov.querySelector('.mapx-stage');
  var cvT = ov.querySelector('.mapx-tiles'), cvF = ov.querySelector('.mapx-fx');
  var svg = ov.querySelector('.mapx-svg'), gRoads = svg.querySelector('.mapx-roads');
  var rGlow = svg.querySelector('.r-glow'), rInk = svg.querySelector('.r-ink'), rDash = svg.querySelector('.r-dash'), gSegs = svg.querySelector('.r-segs'), gNodes = svg.querySelector('.r-nodes');
  var labels = ov.querySelector('.mapx-labels'), rt = ov.querySelector('.mapx-rt'), pop = ov.querySelector('.mapx-pop');
  var ctx = cvT.getContext('2d');

  // ---------------------------------------------------------------- state
  var CFG = null, TL = null, PLACES = [], ROADS = [], loaded = false, loading = null;
  var W = 5112, H = 4920;
  var vw = 0, vh = 0, dpr = 1;
  var view = {s: 0.2, x: 0, y: 0}, minS = 0.1, maxS = 2.5;
  var anim = null;          // smooth zoom target {s, ax, ay}
  var vel = {x: 0, y: 0}, inertia = false;
  var tool = 'nav', route = [], isOpen = false, dirty = true, raf = 0;
  var tiles = {}, tileCount = 0, baseImg = null;

  function lite(){ return document.body.classList.contains('fx-lite') || autoLite; }
  var autoLite = false;

  function getJSON(u){ return fetch(BASE + u, {cache: 'no-cache'}).then(function(r){ if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  function load(){
    if (loading) return loading;
    loading = Promise.all([getJSON('config.json'), getJSON('tiles.json'),
      getJSON('places.json').catch(function(){ return []; }), getJSON('roads.json').catch(function(){ return []; })])
    .then(function(r){
      CFG = r[0]; TL = r[1]; PLACES = Array.isArray(r[2]) ? r[2] : []; ROADS = Array.isArray(r[3]) ? r[3] : [];
      W = TL.width; H = TL.height; maxS = CFG.maxZoom || 2.5;
      rt.querySelector('.rt-est').hidden = !CFG.scaleIsEstimate;
      buildPlaces(); buildRoads();
      return new Promise(function(res){ baseImg = new Image(); baseImg.decoding = 'async'; baseImg.onload = baseImg.onerror = function(){ res(); }; baseImg.src = BASE + 'base.webp'; });
    }).then(function(){ loaded = true; ov.classList.add('ready'); FXL.init(); resize(true); });
    return loading;
  }

  // ---------------------------------------------------------------- view math
  function fitScale(){ return Math.min(vw / W, vh / H); }
  function clampView(){
    view.s = Math.max(minS, Math.min(maxS, view.s));
    var mw = W * view.s, mh = H * view.s, pad = 0;
    if (mw <= vw) view.x = (vw - mw) / 2; else view.x = Math.min(pad, Math.max(vw - mw - pad, view.x));
    if (mh <= vh) view.y = (vh - mh) / 2; else view.y = Math.min(pad, Math.max(vh - mh - pad, view.y));
  }
  function toWorld(px, py){ return {x: (px - view.x) / view.s, y: (py - view.y) / view.s}; }
  function toScreen(wx, wy){ return {x: wx * view.s + view.x, y: wy * view.s + view.y}; }
  function zoomAt(ns, ax, ay){
    ns = Math.max(minS, Math.min(maxS, ns));
    var w = toWorld(ax, ay); view.s = ns; view.x = ax - w.x * ns; view.y = ay - w.y * ns; clampView(); dirty = true;
  }
  function smoothZoom(ns, ax, ay){
    ns = Math.max(minS, Math.min(maxS, ns));
    if (reduce){ zoomAt(ns, ax, ay); return; }
    anim = {s: ns, ax: ax, ay: ay}; inertia = false; kick();
  }
  function resize(first){
    var r = stage.getBoundingClientRect(); if (!r.width) return;
    var oldFit = vw ? fitScale() : 0, cx = vw / 2, cy = vh / 2, cw = vw ? toWorld(cx, cy) : null;
    vw = r.width; vh = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    cvT.width = Math.round(vw * dpr); cvT.height = Math.round(vh * dpr);
    minS = fitScale() * 0.92;
    if (first || !cw){ view.s = fitScale(); view.x = 0; view.y = 0; }
    else { view.s = Math.max(minS, view.s * (oldFit ? fitScale() / oldFit : 1)); view.x = vw / 2 - cw.x * view.s; view.y = vh / 2 - cw.y * view.s; }
    clampView(); FXL.resize(); dirty = true; kick();
  }

  // ---------------------------------------------------------------- tiles
  function levelFor(){
    var need = view.s * dpr, L = TL.levels, best = L[L.length - 1];
    for (var i = 0; i < L.length; i++){ if (1 / L[i].scale >= need * 0.9){ best = L[i]; break; } }
    return best;
  }
  function getTile(z, x, y){
    var k = z + '/' + x + '_' + y, t = tiles[k];
    if (t){ t.used = performance.now(); return t.ok ? t.img : null; }
    t = tiles[k] = {img: new Image(), ok: false, used: performance.now()}; tileCount++;
    t.img.decoding = 'async';
    t.img.onload = function(){ t.ok = true; dirty = true; kick(); };
    t.img.onerror = function(){ t.err = true; };
    t.img.src = BASE + 'tiles/' + k + '.webp';
    if (tileCount > 260) evict();
    return null;
  }
  function evict(){
    var ks = Object.keys(tiles).sort(function(a, b){ return tiles[a].used - tiles[b].used; });
    for (var i = 0; i < ks.length - 180; i++){ if (ks[i].indexOf('0/') === 0) continue; tiles[ks[i]].img.src = ''; delete tiles[ks[i]]; tileCount--; }
  }
  function drawLevel(lv, x0, y0, x1, y1, onlyReady){
    var T = TL.tile, sc = lv.scale, all = true;
    var tx0 = Math.max(0, Math.floor(x0 / sc / T)), ty0 = Math.max(0, Math.floor(y0 / sc / T));
    var tx1 = Math.min(lv.nx - 1, Math.floor(x1 / sc / T)), ty1 = Math.min(lv.ny - 1, Math.floor(y1 / sc / T));
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++){
      var img = getTile(lv.z, tx, ty);
      if (!img){ all = false; continue; }
      var wx = tx * T * sc, wy = ty * T * sc, ww = img.naturalWidth * sc, wh = img.naturalHeight * sc;
      var sx = wx * view.s + view.x, sy = wy * view.s + view.y;
      // +0.5px overlap hides hairline seams between tiles
      ctx.drawImage(img, Math.floor(sx * dpr) / dpr, Math.floor(sy * dpr) / dpr, Math.ceil(ww * view.s * dpr + 1) / dpr, Math.ceil(wh * view.s * dpr + 1) / dpr);
    }
    return all;
  }
  function drawTiles(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#081c26'; ctx.fillRect(0, 0, vw, vh);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (baseImg && baseImg.naturalWidth) ctx.drawImage(baseImg, view.x, view.y, W * view.s, H * view.s);
    var a = toWorld(0, 0), b = toWorld(vw, vh), lv = levelFor(), L = TL.levels;
    // parent level underneath (already cached most of the time), then the sharp level
    if (lv.z > 1) drawLevel(L[lv.z - 1], a.x, a.y, b.x, b.y);
    if (lv.z > 0) drawLevel(lv, a.x, a.y, b.x, b.y);
  }

  // ---------------------------------------------------------------- places & roads (data-driven; empty in v1)
  var placeEls = [];
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function buildPlaces(){
    labels.innerHTML = ''; placeEls = [];
    PLACES.forEach(function(p){
      if (!p || p.x == null || p.y == null || !p.name) return;
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'mp-place t-' + (p.type || 'place'); b.innerHTML = '<i></i><span>' + esc(p.name) + '</span>';
      b.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
      b.addEventListener('click', function(ev){ ev.stopPropagation(); showPlace(p, b); });
      labels.appendChild(b); placeEls.push({p: p, el: b});
    });
  }
  function buildRoads(){
    gRoads.innerHTML = '';
    ROADS.forEach(function(r){ if (!r || !r.points || r.points.length < 2) return;
      var pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('class', 'road t-' + (r.type || 'road'));
      pth._pts = r.points; if (r.name){ var t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = r.name; pth.appendChild(t); }
      gRoads.appendChild(pth); });
  }
  function layoutOverlay(){
    placeEls.forEach(function(o){
      var s = toScreen(o.p.x, o.p.y), hide = o.p.minZoom && view.s < o.p.minZoom;
      o.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
      o.el.classList.toggle('off', !!hide || s.x < -80 || s.y < -40 || s.x > vw + 80 || s.y > vh + 40);
    });
    Array.prototype.forEach.call(gRoads.children, function(p){
      p.setAttribute('d', p._pts.map(function(q, i){ var s = toScreen(q[0], q[1]); return (i ? 'L' : 'M') + s.x.toFixed(1) + ' ' + s.y.toFixed(1); }).join(''));
    });
    drawRoute();
  }
  function showPlace(p, el){
    var tag = p.tag && window.__ulv && window.__ulv.TagCard && window.__ulv.TagCard.resolve(p.tag);
    pop.innerHTML = '<b>' + esc(p.name) + '</b>' + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + (tag ? '<button type="button" class="pop-tag">Kayıtları aç</button>' : '');
    pop.hidden = false;
    var s = toScreen(p.x, p.y); pop.style.left = Math.min(vw - 240, Math.max(10, s.x + 14)) + 'px'; pop.style.top = Math.min(vh - 120, Math.max(10, s.y - 10)) + 'px';
    var tb = pop.querySelector('.pop-tag'); if (tb) tb.onclick = function(){ window.__ulv.TagCard.open('p', p.tag, el); };
  }

  // ---------------------------------------------------------------- route tool
  function km(px){ return px * (CFG ? CFG.kmPerPixel : 0.5); }
  function fmtKm(k){ return k < 10 ? k.toFixed(1).replace('.', ',') + ' km' : Math.round(k).toLocaleString('tr-TR') + ' km'; }
  function fmtDays(d){
    if (d <= 0) return '—';
    if (d < 1){ var h = Math.max(1, Math.round(d * 24)); return h + ' saat'; }   // speeds are per day of travel
    return (d < 10 ? (Math.round(d * 10) / 10).toString().replace('.', ',') : Math.round(d)) + ' gün';
  }
  function segLen(a, b){ return Math.hypot(b.x - a.x, b.y - a.y); }
  function totalPx(){ var t = 0; for (var i = 1; i < route.length; i++) t += segLen(route[i - 1], route[i]); return t; }
  function updateReadout(){
    var k = km(totalPx());
    rt.querySelector('.rt-km').textContent = route.length > 1 ? fmtKm(k) : '—';
    rt.querySelector('.rt-walk').textContent = route.length > 1 ? fmtDays(k / (CFG.walkKmPerDay || 30)) : '—';
    rt.querySelector('.rt-horse').textContent = route.length > 1 ? fmtDays(k / (CFG.horseKmPerDay || 60)) : '—';
    rt.querySelector('.rt-hint').textContent = !route.length ? 'Haritaya tıklayarak durak ekle' : route.length === 1 ? 'Sonraki durağa tıkla' : route.length + ' durak · noktaları sürükleyebilirsin';
    rt.querySelector('.rt-undo').disabled = rt.querySelector('.rt-clear').disabled = !route.length;
  }
  var SVGNS = 'http://www.w3.org/2000/svg';
  function drawRoute(){
    var d = route.map(function(p, i){ var s = toScreen(p.x, p.y); return (i ? 'L' : 'M') + s.x.toFixed(1) + ' ' + s.y.toFixed(1); }).join('');
    rGlow.setAttribute('d', d); rInk.setAttribute('d', d); rDash.setAttribute('d', d);
    while (gNodes.childNodes.length > route.length) gNodes.removeChild(gNodes.lastChild);
    while (gNodes.childNodes.length < route.length){
      var g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'r-node');
      g.innerHTML = '<circle class="n-hit" r="14"/><circle class="n-ring" r="7.5"/><circle class="n-dot" r="3.2"/>';
      gNodes.appendChild(g);
    }
    route.forEach(function(p, i){ var s = toScreen(p.x, p.y), g = gNodes.childNodes[i];
      g.setAttribute('transform', 'translate(' + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ')'); g.dataset.i = i;
      g.classList.toggle('first', i === 0); g.classList.toggle('last', i === route.length - 1 && i > 0); });
    // per-segment km labels (hover shows; always for the last segment while drawing)
    var n = Math.max(0, route.length - 1);
    while (gSegs.childNodes.length > n) gSegs.removeChild(gSegs.lastChild);
    while (gSegs.childNodes.length < n){ var t = document.createElementNS(SVGNS, 'g'); t.setAttribute('class', 'r-seg'); t.innerHTML = '<line class="s-hit"/><text></text>'; gSegs.appendChild(t); }
    for (var i = 0; i < n; i++){
      var a = toScreen(route[i].x, route[i].y), b = toScreen(route[i + 1].x, route[i + 1].y), g2 = gSegs.childNodes[i];
      var ln = g2.firstChild, tx = g2.lastChild;
      ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y); ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
      tx.setAttribute('x', (a.x + b.x) / 2); tx.setAttribute('y', (a.y + b.y) / 2 - 9); tx.textContent = fmtKm(km(segLen(route[i], route[i + 1])));
      g2.classList.toggle('cur', i === n - 1 && n > 1 ? false : n === 1);
    }
  }
  function addNode(px, py){
    var w = toWorld(px, py); if (w.x < 0 || w.y < 0 || w.x > W || w.y > H) return;
    route.push({x: w.x, y: w.y}); drawRoute(); updateReadout();
    var g = gNodes.lastChild; if (g && !reduce){ g.classList.add('pop'); setTimeout(function(){ g.classList.remove('pop'); }, 400); }
  }
  function undo(){ if (!route.length) return; route.pop(); drawRoute(); updateReadout(); }
  function clearRoute(){ route = []; drawRoute(); updateReadout(); }
  function setTool(t){
    tool = t;
    ov.querySelectorAll('[data-tool]').forEach(function(b){ var on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    ov.classList.toggle('t-route', t === 'route'); rt.hidden = t !== 'route'; updateReadout();
  }

  // ---------------------------------------------------------------- input
  var ptrs = {}, drag = null, lastTap = 0, pinch = null;
  function local(ev){ var r = stage.getBoundingClientRect(); return {x: ev.clientX - r.left, y: ev.clientY - r.top}; }
  stage.addEventListener('pointerdown', function(ev){
    if (ev.button && ev.button !== 0) return;
    pop.hidden = true;
    var p = local(ev); ptrs[ev.pointerId] = p; try { stage.setPointerCapture(ev.pointerId); } catch(e){}
    anim = null; inertia = false; vel.x = vel.y = 0;
    var ids = Object.keys(ptrs);
    if (ids.length === 2){
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: view.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2}; drag = null; return;
    }
    var node = ev.target.closest && ev.target.closest('.r-node');
    drag = {x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: 0, node: node ? +node.dataset.i : -1};
    ov.classList.add('grabbing');
  });
  stage.addEventListener('pointermove', function(ev){
    if (!ptrs[ev.pointerId]) return;
    var p = local(ev); ptrs[ev.pointerId] = p;
    var ids = Object.keys(ptrs);
    if (pinch && ids.length >= 2){
      var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      view.x += mx - pinch.mx; view.y += my - pinch.my; pinch.mx = mx; pinch.my = my;
      zoomAt(pinch.s * d / pinch.d, mx, my); kick(); return;
    }
    if (!drag) return;
    var dx = p.x - drag.x, dy = p.y - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = p.x; drag.y = p.y; drag.t = now;
    if (drag.node >= 0){
      var w = toWorld(p.x, p.y); route[drag.node] = {x: Math.max(0, Math.min(W, w.x)), y: Math.max(0, Math.min(H, w.y))}; drawRoute(); updateReadout(); return;
    }
    view.x += dx; view.y += dy; clampView();
    vel.x = vel.x * 0.6 + (dx / dt * 16) * 0.4; vel.y = vel.y * 0.6 + (dy / dt * 16) * 0.4;
    dirty = true; kick();
  });
  function up(ev){
    if (!ptrs[ev.pointerId]) return;
    delete ptrs[ev.pointerId];
    if (pinch){ if (Object.keys(ptrs).length < 2) pinch = null; drag = null; return; }
    ov.classList.remove('grabbing');
    if (!drag) return;
    var d = drag; drag = null;
    if (ev.type === 'pointercancel') return;
    var tap = d.moved < 7;
    if (tap){
      var now = performance.now(), p = local(ev);
      if (tool === 'route' && d.node < 0) addNode(p.x, p.y);
      else if (tool === 'nav'){
        if (now - lastTap < 320){ smoothZoom(view.s * 2, p.x, p.y); lastTap = 0; }
        else lastTap = now;
      }
    } else if (d.node < 0 && performance.now() - d.t < 80 && (Math.abs(vel.x) + Math.abs(vel.y)) > 1 && !reduce){ inertia = true; kick(); }
  }
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', function(ev){
    ev.preventDefault();
    var p = local(ev), dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaMode === 2 ? ev.deltaY * vh : ev.deltaY;
    if (ev.ctrlKey) dy *= 3;   // trackpad pinch
    var base = anim ? anim.s : view.s, f = Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0017);
    smoothZoom(base * f, p.x, p.y);
  }, {passive: false});
  // keep the page under the overlay from scrolling / rubber-banding
  ov.addEventListener('wheel', function(ev){ ev.preventDefault(); }, {passive: false});
  ov.addEventListener('touchmove', function(ev){ if (!ev.target.closest('.mapx-pop')) ev.preventDefault(); }, {passive: false});
  ov.addEventListener('pointerdown', function(ev){ if (ev.target === ov) close(); });

  ov.querySelector('.mapx-tools').addEventListener('click', function(ev){
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.classList.contains('mt-in')) smoothZoom((anim ? anim.s : view.s) * 1.6, vw / 2, vh / 2);
    else if (b.classList.contains('mt-out')) smoothZoom((anim ? anim.s : view.s) / 1.6, vw / 2, vh / 2);
    else if (b.classList.contains('mt-fit')) smoothZoom(fitScale(), vw / 2, vh / 2);
  });
  rt.querySelector('.rt-undo').addEventListener('click', undo);
  rt.querySelector('.rt-clear').addEventListener('click', clearRoute);
  ov.querySelector('.mapx-x').addEventListener('click', function(){ close(); });

  document.addEventListener('keydown', function(ev){
    if (!isOpen) return;
    var k = ev.key, tgt = ev.target, typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
    if (typing) return;
    var U2 = window.__ulv; if (U2 && ((U2.TagCard && U2.TagCard.isOpen && U2.TagCard.isOpen()) || document.querySelector('.lb:not([hidden])'))) return;  // a card opened on top of the map handles its own keys
    if (k === 'Escape'){ ev.preventDefault(); ev.stopImmediatePropagation(); if (!pop.hidden) pop.hidden = true; else close(); return; }
    var handled = true, step = 120;
    if (k === 'Backspace' || k === 'Delete'){ if (tool === 'route') undo(); }
    else if (k === '+' || k === '=') smoothZoom((anim ? anim.s : view.s) * 1.5, vw / 2, vh / 2);
    else if (k === '-' || k === '_') smoothZoom((anim ? anim.s : view.s) / 1.5, vw / 2, vh / 2);
    else if (k === 'ArrowLeft'){ view.x += step; clampView(); dirty = true; }
    else if (k === 'ArrowRight'){ view.x -= step; clampView(); dirty = true; }
    else if (k === 'ArrowUp'){ view.y += step; clampView(); dirty = true; }
    else if (k === 'ArrowDown'){ view.y -= step; clampView(); dirty = true; }
    else if (k === 'r' || k === 'R') setTool(tool === 'route' ? 'nav' : 'route');
    else if (k === ' ' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End'){ /* swallow page scroll */ }
    else if (k === 'Tab'){
      var f = Array.prototype.slice.call(ov.querySelectorAll('button')).filter(function(b){ return b.offsetParent && !b.disabled; });
      if (f.length){ var i = f.indexOf(document.activeElement); f[(i + (ev.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    } else handled = false;
    if (handled){ ev.preventDefault(); ev.stopImmediatePropagation(); kick(); }
  }, true);

  // ---------------------------------------------------------------- loop
  var lastT = 0, fpsAcc = 0, fpsN = 0, slow = 0, fxLast = 0;
  function kick(){ if (!raf && isOpen) raf = requestAnimationFrame(frame); }
  function frame(t){
    raf = 0; if (!isOpen) return;
    var dt = lastT ? Math.min(64, t - lastT) : 16; lastT = t;
    if (anim){
      var k = 1 - Math.pow(0.0009, dt / 1000 * 2.2), ns = view.s + (anim.s - view.s) * k;
      if (Math.abs(anim.s - ns) / anim.s < 0.002){ ns = anim.s; zoomAt(ns, anim.ax, anim.ay); anim = null; } else zoomAt(ns, anim.ax, anim.ay);
    }
    if (inertia){
      var fr = Math.pow(0.92, dt / 16); vel.x *= fr; vel.y *= fr;
      var ox = view.x, oy = view.y; view.x += vel.x * dt / 16; view.y += vel.y * dt / 16; clampView();
      if (view.x === ox) vel.x = 0; if (view.y === oy) vel.y = 0;
      if (Math.abs(vel.x) + Math.abs(vel.y) < 0.15) inertia = false; dirty = true;
    }
    if (dirty && loaded){ dirty = false; drawTiles(); layoutOverlay(); }
    // atmosphere: full ~60fps, light ~30fps, reduced-motion: only on view change
    var animFx = FXL.ok && !reduce, period = lite() ? 33 : 0;
    if (FXL.ok && (t - fxLast >= period || reduce)){ FXL.draw(t / 1000); fxLast = t; }
    // auto light: sustained < 32fps while open
    if (!lite() && animFx){ fpsAcc += dt; fpsN++; if (fpsAcc > 2000){ var fps = fpsN * 1000 / fpsAcc; slow = fps < 32 ? slow + 1 : 0; if (slow >= 2){ autoLite = true; FXL.resize(); } fpsAcc = 0; fpsN = 0; } }
    if (animFx || anim || inertia || dirty) kick();
  }

  // ---------------------------------------------------------------- atmosphere (WebGL)
  var FXL = (function(){
    var gl = null, prog = null, U = {}, tex = null, ok = false, ratio = 0.5, tried = false, fallback = null;
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = [
      'precision mediump float;',
      'uniform sampler2D uField;uniform vec2 uRes;uniform float uK;uniform vec3 uView;uniform vec2 uMap;uniform vec2 uCenter;',
      'uniform float uTime;uniform float uZoom;uniform float uLite;uniform vec4 uFogP;uniform float uCloud;uniform vec2 uWind;',
      'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.,a=.5,s=0.;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){if(uLite>.5&&i>2)break;v+=a*n(p);s+=a;p=m*p;a*=.5;}return v/s;}',
      'float cloud(vec2 c,float t,float thr){float d=fbm(c+uWind*t);d+=.35*fbm(c*2.1-uWind*t*1.3);return smoothstep(thr,thr+.17,d*.78);}',
      'void over(inout vec4 o,vec3 c,float a){o.rgb=c*a+o.rgb*(1.-a);o.a=a+o.a*(1.-a);}',
      'void main(){',
      ' vec2 css=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)*uK;',
      ' vec2 w=(css-uView.yz)/uView.x; vec2 uv=w/uMap;',
      ' float f=texture2D(uField,clamp(uv,0.,1.)).r; float dist=f*f*512.;',
      ' vec2 e=min(uv,1.-uv); float ed=min(e.x,e.y);',
      ' float edge=1.-smoothstep(-.01,uFogP.z,ed); if(ed<0.)edge=1.;',
      ' float dens=max(smoothstep(uFogP.x,uFogP.y,dist),edge);',
      ' float t=uTime;',
      ' vec2 q=w/1100.;',
      ' float n1=fbm(q+vec2(t*.010,t*.004));',
      ' float n2=fbm(q*2.2-vec2(t*.017,-t*.007)+n1*1.4);',
      ' float fogn=smoothstep(.2,.8,n1*.55+n2*.55);',
      ' float fogA=dens*mix(.42,.92,fogn)*uFogP.w;',
      ' fogA*=mix(1.,.82,uZoom);',
      ' float keep=1.-(1.-smoothstep(uFogP.x*.3,uFogP.x*2.2,dist))*smoothstep(-.015,.02,ed);',
      ' fogA=max(fogA,edge*edge*(3.-2.*edge)*mix(.85,1.,fogn)*keep*uFogP.w);',
      ' vec3 fogC=mix(vec3(.50,.58,.63),vec3(.80,.84,.86),n2);',
      ' vec4 o=vec4(0.);',
      // clouds: two parallax layers above the map (layer coords shrink toward the view centre => appear closer, move faster)
      ' float thr=mix(.58,.70,uZoom);',
      ' vec2 c0=(uCenter+(w-uCenter)/1.45)/820.; vec2 c1=(uCenter+(w-uCenter)/2.1)/600.+vec2(7.3,2.1);',
      ' float sh=cloud(c0+vec2(.07,.09),t*.012,thr);',
      ' over(o,vec3(0.02,0.03,0.05),sh*.3*uCloud);',
      // sea shimmer: sparkles drifting on open water
      ' if(uLite<.5){float sea=smoothstep(6.,40.,dist)*(1.-fogA);',
      '  float s1=n(w/38.+vec2(t*.35,t*.12)),s2=n(w/27.-vec2(t*.22,-t*.28));',
      '  float sp=pow(max(0.,s1*s2-.42)*3.,3.)*sea*.32; o.rgb+=vec3(.75,.9,1.)*sp;}',
      ' over(o,fogC,fogA);',
      ' float a0=cloud(c0,t*.012,thr); float a0l=cloud(c0-vec2(.012,.016),t*.012,thr);',
      ' vec3 cc0=mix(vec3(.50,.54,.62),vec3(1.,.98,.94),clamp(.6+(a0-a0l)*3.5,0.,1.));',
      ' over(o,cc0,a0*.8*uCloud);',
      ' if(uLite<.5){float a1=cloud(c1,t*.02,thr+.05); float a1l=cloud(c1-vec2(.012,.016),t*.02,thr+.05);',
      '  vec3 cc1=mix(vec3(.55,.58,.66),vec3(1.),clamp(.6+(a1-a1l)*3.5,0.,1.)); over(o,cc1,a1*.55*uCloud);}',
      ' gl_FragColor=o;',
      '}'].join('\n');
    function init(){
      if (tried) return; tried = true;
      try { gl = cvF.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false}) || cvF.getContext('experimental-webgl'); } catch(e){ gl = null; }
      if (!gl){ initFallback(); return; }
      function sh(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
      try {
        prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      } catch(e){ if (window.console) console.warn('map fx: webgl shader failed, using 2D fog', e); gl = null; initFallback(); return; }
      gl.useProgram(prog);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uField','uRes','uK','uView','uMap','uCenter','uTime','uZoom','uLite','uFogP','uCloud','uWind'].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var img = new Image(); img.onload = function(){ gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img); ok = true; ov.classList.add('fx-on'); kick(); };
      img.src = BASE + 'fogfield.png';
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      cvF.addEventListener('webglcontextlost', function(e){ e.preventDefault(); ok = false; }, false);
    }
    // Canvas2D fallback: fog alpha image built from the distance field, drawn with a slow drift
    function initFallback(){
      var img = new Image(); img.onload = function(){
        var c = document.createElement('canvas'), w = 320, hh = Math.round(320 * img.height / img.width); c.width = w; c.height = hh;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, hh); var d = x.getImageData(0, 0, w, hh), a = d.data, F = CFG.fog;
        for (var i = 0; i < a.length; i += 4){ var f = a[i] / 255, dist = f * f * 512, k = Math.max(0, Math.min(1, (dist - F.clearPx) / (F.densePx - F.clearPx))); k = k * k * (3 - 2 * k);
          a[i] = 176; a[i + 1] = 190; a[i + 2] = 198; a[i + 3] = Math.round(k * 200); }
        x.putImageData(d, 0, 0); fallback = c; ok = true; ov.classList.add('fx-on'); kick();
      }; img.src = BASE + 'fogfield.png';
    }
    function resize(){
      if (!vw) return;
      ratio = lite() ? 0.33 : Math.min(0.6, 0.5 * dpr);
      if (fallback || !gl){ cvF.width = Math.round(vw * dpr); cvF.height = Math.round(vh * dpr); return; }
      cvF.width = Math.max(2, Math.round(vw * ratio)); cvF.height = Math.max(2, Math.round(vh * ratio));
    }
    function draw(time){
      if (!ok) return;
      if (fallback){
        var c = cvF.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, vw, vh);
        var ox = Math.sin(time * 0.05) * 18, oy = Math.cos(time * 0.04) * 12;
        c.globalAlpha = 0.9; c.drawImage(fallback, view.x + ox, view.y + oy, W * view.s, H * view.s);
        c.globalAlpha = 0.5; c.drawImage(fallback, view.x - ox * 1.7, view.y - oy * 1.3, W * view.s, H * view.s); c.globalAlpha = 1; return;
      }
      var lt = lite(), r = cvF.width / vw, F = CFG.fog || {}, C = CFG.clouds || {};
      gl.viewport(0, 0, cvF.width, cvF.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.uField, 0);
      gl.uniform2f(U.uRes, cvF.width, cvF.height); gl.uniform1f(U.uK, 1 / r);
      gl.uniform3f(U.uView, view.s, view.x, view.y); gl.uniform2f(U.uMap, W, H);
      var cw = toWorld(vw / 2, vh / 2); gl.uniform2f(U.uCenter, cw.x, cw.y);
      gl.uniform1f(U.uTime, reduce ? 40 : time % 100000);
      var zf = Math.max(0, Math.min(1, Math.log(view.s / fitScale()) / Math.log(maxS / fitScale())));
      gl.uniform1f(U.uZoom, zf); gl.uniform1f(U.uLite, lt ? 1 : 0);
      gl.uniform4f(U.uFogP, F.clearPx || 70, F.densePx || 420, F.edge || 0.14, F.strength == null ? 1 : F.strength);
      gl.uniform1f(U.uCloud, (C.strength == null ? 1 : C.strength) * (lt ? 0.8 : 1));
      var wd = C.wind || [1, 0.35]; gl.uniform2f(U.uWind, wd[0], wd[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return {init: init, resize: resize, draw: draw, get ok(){ return ok; }};
  })();

  // ---------------------------------------------------------------- open / close
  var opener = null, closing = null;
  function btnCenter(){ var b = btn.getBoundingClientRect(), p = panel.getBoundingClientRect(); return {x: b.left + b.width / 2 - p.left, y: b.top + b.height / 2 - p.top, pw: p.width, ph: p.height}; }
  function open(){
    if (isOpen) return;
    if (closing){ closing.cancel(); closing = null; }
    isOpen = true; opener = document.activeElement;
    ov.hidden = false; document.body.classList.add('map-open'); btn.setAttribute('aria-expanded', 'true');
    var c = btnCenter(), R = Math.hypot(Math.max(c.x, c.pw - c.x), Math.max(c.y, c.ph - c.y)) + 20;
    if (!reduce && panel.animate){
      panel.animate([{clipPath: 'circle(18px at ' + c.x + 'px ' + c.y + 'px)', opacity: 0.4, transform: 'scale(.96)'},
                     {clipPath: 'circle(' + R + 'px at ' + c.x + 'px ' + c.y + 'px)', opacity: 1, transform: 'scale(1)'}],
                    {duration: 620, easing: 'cubic-bezier(.65,0,.25,1)'});
      ov.animate([{backgroundColor: 'rgba(6,4,10,0)'}, {backgroundColor: 'rgba(6,4,10,.72)'}], {duration: 450, fill: 'none'});
    }
    load().then(function(){ resize(!openedOnce); openedOnce = true; dirty = true; kick(); }).catch(function(e){
      if (window.console) console.warn('map load failed', e); ov.querySelector('.mapx-load').classList.add('err'); });
    if (loaded){ resize(false); }
    setTimeout(function(){ var f = ov.querySelector('.mapx-x'); if (f) f.focus({preventScroll: true}); }, 30);
    kick();
  }
  var openedOnce = false;
  function close(){
    if (!isOpen) return;
    isOpen = false; btn.setAttribute('aria-expanded', 'false'); pop.hidden = true;
    var fin = function(){ ov.hidden = true; closing = null; document.body.classList.remove('map-open'); };
    if (!reduce && panel.animate){
      var c = btnCenter(), R = Math.hypot(Math.max(c.x, c.pw - c.x), Math.max(c.y, c.ph - c.y)) + 20;
      closing = panel.animate([{clipPath: 'circle(' + R + 'px at ' + c.x + 'px ' + c.y + 'px)', opacity: 1, transform: 'scale(1)'},
                               {clipPath: 'circle(18px at ' + c.x + 'px ' + c.y + 'px)', opacity: 0.2, transform: 'scale(.96)'}],
                              {duration: 460, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards'});
      ov.animate([{backgroundColor: 'rgba(6,4,10,.72)'}, {backgroundColor: 'rgba(6,4,10,0)'}], {duration: 460, fill: 'forwards'});
      closing.onfinish = function(){ fin(); ov.getAnimations().forEach(function(a){ a.cancel(); }); panel.getAnimations().forEach(function(a){ a.cancel(); }); };
    } else fin();
    if (opener && opener.focus) try { opener.focus({preventScroll: true}); } catch(e){}
  }
  btn.addEventListener('click', function(){ isOpen ? close() : open(); });
  window.addEventListener('resize', function(){ if (isOpen && loaded) resize(false); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) kick(); });
  // warm the cache after the page settles so the first open is instant
  window.addEventListener('load', function(){ setTimeout(function(){ if (!loading && navigator.connection && navigator.connection.saveData) return; load(); }, 4000); });

  window.__ulvMap = {open: open, close: close, setTool: setTool, route: function(){ return route.slice(); },
    addNodeWorld: function(x, y){ route.push({x: x, y: y}); drawRoute(); updateReadout(); },
    view: function(){ return {s: view.s, x: view.x, y: view.y, fit: fitScale(), vw: vw, vh: vh}; },
    zoomTo: function(s, wx, wy){ var p = toScreen(wx, wy); view.x += vw / 2 - p.x; view.y += vh / 2 - p.y; zoomAt(s, vw / 2, vh / 2); kick(); },
    stats: function(){ return {fx: FXL.ok, gl: !!(cvF.getContext && FXL.ok), lite: lite(), tiles: tileCount, loaded: loaded, km: km(totalPx()), places: PLACES.length, roads: ROADS.length}; },
    cfg: function(){ return CFG; }, redraw: function(){ dirty = true; kick(); },
    isOpen: function(){ return isOpen; }};
})();
