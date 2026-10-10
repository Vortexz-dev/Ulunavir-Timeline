/* Horaghfus — interactive 2D world map (v2: birds, caravans, whirlpool, light sweep, tilt-shift)
   Tile pyramid on Canvas2D + WebGL atmosphere (fog from a precomputed coast-distance field,
   parallax clouds with shadows, sea shimmer) + SVG route tool. Self-contained: no app.js edits.
   Data: assets/map/{config,tiles,places,roads}.json */
(function(){
  'use strict';
  var BASE = 'assets/map/';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (/[?&]rm=1/.test(location.search)) reduce = true;   // test hook
  var noAuto = /[?&]fxtest=1/.test(location.search);    // test hook: keep full FX in slow headless browsers
  var ICON_MAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5l5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity=".7"/></svg>';
  var I = {
    hand:'<svg viewBox="0 0 24 24"><path d="M12 2.5l2.6 3.2h-1.8v5.5h5.5V9.4L21.5 12l-3.2 2.6v-1.8h-5.5v5.5h1.8L12 21.5l-2.6-3.2h1.8v-5.5H5.7v1.8L2.5 12l3.2-2.6v1.8h5.5V5.7H9.4z" fill="currentColor"/></svg>',
    route:'<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2.3" fill="currentColor"/><circle cx="19" cy="6" r="2.3" fill="currentColor"/><path d="M6.5 16.5C10 14 7 10 11 9s5 1 6.5-1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.6 2.4" stroke-linecap="round"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    minus:'<svg viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    fit:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    undo:'<svg viewBox="0 0 24 24"><path d="M9 7L4 12l5 5M4.5 12H15a5 5 0 010 10h-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trash:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    cloud:'<svg viewBox="0 0 24 24"><path d="M7 18h10.5a3.8 3.8 0 00.4-7.6A5.6 5.6 0 007.3 9.2 4.4 4.4 0 007 18z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path class="off" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    snd:'<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="on" d="M15.5 9a4.2 4.2 0 010 6M18 6.5a7.6 7.6 0 010 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
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
        '<canvas class="mapx-life"></canvas>' +
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
        '<i class="mt-sep"></i>' +
        '<button type="button" class="mt-cloud" aria-pressed="true" title="Bulutlar">' + I.cloud + '</button>' +
        '<button type="button" class="mt-snd" aria-pressed="true" title="Harita sesleri">' + I.snd + '</button>' +
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
      getJSON('places.json').catch(function(){ return []; }), getJSON('roads.json').catch(function(){ return []; }), getJSON('roads_auto.json').catch(function(){ return []; }), getJSON('sealanes.json').catch(function(){ return []; }), getJSON('life.json').catch(function(){ return {}; })])
    .then(function(r){
      CFG = r[0]; TL = r[1]; PLACES = Array.isArray(r[2]) ? r[2] : []; ROADS = Array.isArray(r[3]) ? r[3] : [];
      W = TL.width; H = TL.height; maxS = CFG.maxZoom || 2.5;
      rt.querySelector('.rt-est').hidden = !CFG.scaleIsEstimate;
      buildPlaces(); buildRoads(); LIFE.init(Array.isArray(r[4]) ? r[4] : [], Array.isArray(r[5]) ? r[5] : [], r[6] || {});
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
    clampView(); FXL.resize(); LIFE.resize(); dirty = true; kick();
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
    tiltBlur();
  }
  // tilt-shift depth: blur the top/bottom bands of the map layer (only redrawn on view change; no-op where ctx.filter is unsupported)
  var tiltCv = null;
  function tiltBlur(){
    if (!(tiltO > 0) || !('filter' in ctx)) return;
    var w = cvT.width, h = cvT.height, bh = Math.round(h * .26), blur = (2.6 * dpr * tiltO).toFixed(2);
    if (!tiltCv) tiltCv = document.createElement('canvas');
    if (tiltCv.width !== w || tiltCv.height !== bh){ tiltCv.width = w; tiltCv.height = bh; }
    var x = tiltCv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (var k = 0; k < 2; k++){
      var y0 = k ? h - bh : 0;
      x.globalCompositeOperation = 'copy'; x.filter = 'blur(' + blur + 'px)';
      x.drawImage(cvT, 0, y0, w, bh, 0, 0, w, bh);
      x.filter = 'none'; x.globalCompositeOperation = 'destination-in';
      var g = x.createLinearGradient(0, 0, 0, bh);
      if (k){ g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); } else { g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); }
      x.fillStyle = g; x.fillRect(0, 0, w, bh);
      ctx.drawImage(tiltCv, 0, y0);
    }
    x.globalCompositeOperation = 'source-over';
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
    else if (b.classList.contains('mt-cloud')){ cloudsOn = !cloudsOn; try { localStorage.setItem('ulv-map-clouds', cloudsOn ? '1' : '0'); } catch(e){} syncToggles(); kick(); }
    else if (b.classList.contains('mt-snd')){ if (window.__ulvMapAudio){ window.__ulvMapAudio.setOn(!window.__ulvMapAudio.isOn()); } syncToggles(); }
  });
  function syncToggles(){
    var cb = ov.querySelector('.mt-cloud'), sb = ov.querySelector('.mt-snd'), so = !!(window.__ulvMapAudio && window.__ulvMapAudio.isOn());
    cb.classList.toggle('is-off', !cloudsOn); cb.setAttribute('aria-pressed', cloudsOn ? 'true' : 'false'); cb.title = cloudsOn ? 'Bulutları gizle' : 'Bulutları göster';
    sb.classList.toggle('is-off', !so); sb.setAttribute('aria-pressed', so ? 'true' : 'false'); sb.title = so ? 'Harita seslerini kapat' : 'Harita seslerini aç';
    if (!window.__ulvMapAudio) sb.hidden = true;
  }
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
  var lastT = 0, fpsAcc = 0, fpsN = 0, slow = 0, fxLast = 0, lifeLast = 0, tiltO = -1, sndLast = 0;
  // tilt-shift style depth blur on the top/bottom bands, fades in as you zoom in (full mode only)
  function tilt(){
    var o = (lite() || reduce) ? 0 : Math.max(0, Math.min(1, (LIFE.zoomF() - .3) / .45)); o = Math.round(o * 20) / 20;
    if (o === tiltO) return; tiltO = o; dirty = true;
  }
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
    var moved = false;
    if (loaded) tilt();
    if (dirty && loaded){ dirty = false; drawTiles(); layoutOverlay(); moved = true; }
    // atmosphere: full ~60fps, light ~30fps, reduced-motion: only on view change
    var animFx = FXL.ok && !reduce, period = lite() ? 33 : 0;
    if (FXL.ok && (t - fxLast >= period || reduce || moved)){ FXL.draw(t / 1000); fxLast = t; }
    if (loaded && !reduce && (t - lifeLast >= period || moved)){ LIFE.draw(t / 1000); lifeLast = t; }
    if (loaded && window.__ulvMapAudio && t - sndLast > 250){ sndLast = t; var cw0 = toWorld(vw / 2, vh / 2), pr = LIFE.probe(cw0.x, cw0.y); pr.zf = LIFE.zoomF(); window.__ulvMapAudio.update(pr); }
    // auto light: sustained < 32fps while open
    if (!lite() && animFx){ fpsAcc += dt; fpsN++; if (fpsAcc > 2000){ var fps = fpsN * 1000 / fpsAcc; slow = fps < 32 ? slow + 1 : 0; if (slow >= 2 && !noAuto){ autoLite = true; FXL.resize(); } fpsAcc = 0; fpsN = 0; } }
    if (animFx || loaded || anim || inertia || dirty) kick();
  }


  // ---------------------------------------------------------------- life layer (Canvas2D, between map and atmosphere)
  // whirlpool, ships/fleets on coastal sea lanes, caravans on roads, chimney smoke, ember glow, bird flocks.
  // Disabled under reduced motion; Light mode = fewer of everything.
  var LIFE = (function(){
    var cv = ov.querySelector('.mapx-life'), c = cv.getContext('2d');
    var land = null, field = null, landPts = [], roadsA = [], lanes = [], wp = null, wpIn = null, DATA = {smoke: [], settlements: []};
    var cars = [], flocks = [], ships = [], nextFlock = 1, lastT = 0, ready = false;
    var WP = {x: 4503, y: 1380, r: 132, sq: 0.68};
    var GLOW = [[2233,440,70],[2330,855,34],[2511,930,30],[2222,984,30],[2319,1026,32],[2212,1219,30],[2914,4484,60]];
    function rnd(a, b){ return a + Math.random() * (b - a); }
    function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
    function sstep(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function imgData(src, cb){ var m = new Image(); m.onload = function(){ var t = document.createElement('canvas'); t.width = m.width; t.height = m.height; var x = t.getContext('2d'); x.drawImage(m, 0, 0); cb(x.getImageData(0, 0, m.width, m.height).data, m.width, m.height); }; m.src = src; }
    function init(autoRoads, seaLanes, life){
      roadsA = autoRoads || []; DATA = life || DATA; if (!DATA.smoke) DATA.smoke = []; if (!DATA.settlements) DATA.settlements = [];
      lanes = (seaLanes || []).map(function(l){ var p = l.points.map(function(q){ return {x: q[0], y: q[1]}; }), L = [0];
        for (var i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
        var tot = L[L.length - 1], closed = Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) < 60; return {p: p, L: L, tot: tot, closed: closed}; });
      imgData(BASE + 'landmask.png', function(d, w, h){
        var a = new Uint8Array(w * h); for (var i = 0; i < a.length; i++) a[i] = d[i * 4] > 127 ? 1 : 0;
        for (var yy = 6; yy < h - 6; yy += 4) for (var xx = 6; xx < w - 6; xx += 4){
          if (a[yy * w + xx] && a[yy * w + xx + 5] && a[yy * w + xx - 5] && a[(yy + 5) * w + xx] && a[(yy - 5) * w + xx]) landPts.push([(xx + .5) / w * W, (yy + .5) / h * H]);
        }
        land = {w: w, h: h, a: a}; kick();
      });
      imgData(BASE + 'fogfield.png', function(d, w, h){ var a = new Uint8Array(w * h); for (var i = 0; i < a.length; i++) a[i] = d[i * 4]; field = {w: w, h: h, a: a}; });
      wp = new Image(); wp.onload = function(){
        var s = wp.width, t = document.createElement('canvas'); t.width = t.height = s; var x = t.getContext('2d');
        x.drawImage(wp, 0, 0); x.globalCompositeOperation = 'destination-in';
        var g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, '#000'); g.addColorStop(.42, '#000'); g.addColorStop(.62, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, s, s); wpIn = t;
      }; wp.src = BASE + 'whirlpool.webp';
      makeSmokeSprites(); ready = true;
    }
    function isLand(x, y){ if (!land || x < 0 || y < 0 || x >= W || y >= H) return false; return land.a[((y / H * land.h) | 0) * land.w + ((x / W * land.w) | 0)] === 1; }
    // distance to the nearest coast in full-res px (fog field encoding: sqrt(d/512))
    function coastDist(x, y){ if (!field) return 999; x = clamp(x, 0, W - 1); y = clamp(y, 0, H - 1); var f = field.a[((y / H * field.h) | 0) * field.w + ((x / W * field.w) | 0)] / 255; return f * f * 512; }
    function roads(){
      var r = ROADS.filter(function(q){ return q.points && q.points.length > 1; });
      return r.length ? r : roadsA.filter(function(q){ return q.points && q.points.length > 1; });
    }
    function zoomF(){ var f = fitScale(); return Math.max(0, Math.min(1, Math.log(view.s / f) / Math.log(maxS / f))); }
    function at(k, d){
      var L = k.L, i = 1; while (i < L.length - 1 && L[i] < d) i++;
      var a = k.p[i - 1], b = k.p[i], f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); f = Math.max(0, Math.min(1, f));
      return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x)};
    }
    function vis(P, m){ return !(P.x < -m || P.y < -m || P.x > vw + m || P.y > vh + m); }
    // ---- caravans (spread over all routes, weighted by length, not bunched)
    var roadCache = null, roadSrc = null;
    function roadGeo(){
      var R = roads(); if (roadSrc === R.length + ':' + ROADS.length && roadCache) return roadCache;
      roadSrc = R.length + ':' + ROADS.length;
      roadCache = R.map(function(rd){ var p = rd.points.map(function(q){ return {x: q[0], y: q[1]}; }), L = [0];
        for (var i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)); return {p: p, L: L, tot: L[L.length - 1]}; })
        .filter(function(g){ return g.tot > 40; });
      return roadCache;
    }
    function newCar(stagger){
      var G = roadGeo(); if (!G.length) return null;
      var sum = 0, i; for (i = 0; i < G.length; i++) sum += G[i].tot;
      for (var tries = 0; tries < 6; tries++){
        var r = Math.random() * sum, g = G[0]; for (i = 0; i < G.length; i++){ r -= G[i].tot; if (r <= 0){ g = G[i]; break; } }
        var rev = Math.random() < .5, d = stagger ? rnd(0, g.tot * .85) : 0, ok = true;
        for (var j = 0; j < cars.length; j++){ var o = cars[j]; if (o && o.g === g && Math.abs((o.rev === rev ? o.d : o.tot - o.d) - d) < 70){ ok = false; break; } }
        if (ok || tries === 5){
          var p = rev ? g.p.slice().reverse() : g.p, L = [0];
          for (i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
          return {g: g, rev: rev, p: p, L: L, tot: g.tot, d: d, v: rnd(5, 9), trail: [], tAcc: 0, size: rnd(.85, 1.2), carts: Math.random() < .45 ? 2 + (Math.random() < .3 ? 1 : 0) : 1};
        }
      }
      return null;
    }
    function stepCars(dt, lt){
      var want = lt ? 8 : 24, guard = 0;
      while (cars.length < want && guard++ < want){ var n = newCar(true); if (!n) break; cars.push(n); }
      if (cars.length > want) cars.length = want;
      for (var i = 0; i < cars.length; i++){
        var k = cars[i]; k.d += k.v * dt; k.tAcc += dt;
        if (k.tAcc > .5){ k.tAcc = 0; var q = at(k, k.d); k.trail.push({x: q.x, y: q.y}); if (k.trail.length > 16) k.trail.shift(); }
        if (k.d >= k.tot){ var r = newCar(false); if (r) cars[i] = r; else k.d = 0; }
      }
    }
    function drawCars(){
      var s = view.s, sz = clamp(13 * s, 2.4, 8);
      for (var i = 0; i < cars.length; i++){
        var k = cars[i], fade = Math.min(1, k.d / (k.tot * .07), (k.tot - k.d) / (k.tot * .07)); if (fade <= 0) continue;
        var q = at(k, k.d), P = toScreen(q.x, q.y); if (!vis(P, 40)) continue;
        if (k.trail.length > 1){
          c.lineCap = 'round'; c.lineWidth = Math.max(.9, sz * .45);
          for (var j = 1; j < k.trail.length; j++){
            var A = toScreen(k.trail[j - 1].x, k.trail[j - 1].y), B = j === k.trail.length - 1 ? P : toScreen(k.trail[j].x, k.trail[j].y);
            c.strokeStyle = 'rgba(70,52,30,' + (0.18 * j / k.trail.length * fade).toFixed(3) + ')';
            c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
          }
        }
        c.save(); c.translate(P.x, P.y); c.rotate(q.ang); c.globalAlpha = .9 * fade;
        var z = sz * k.size;
        if (z < 3){ c.fillStyle = '#1d140c'; for (var m0 = 0; m0 < k.carts; m0++){ c.beginPath(); c.arc(-m0 * z * 1.2, 0, z * (m0 ? .42 : .52), 0, 6.283); c.fill(); } }
        else {
          for (var m = 0; m < k.carts; m++){
            var ox = -m * z * 1.55;
            c.fillStyle = '#2a1d10'; c.fillRect(ox - z * .55, -z * .32, z * .75, z * .64);
            c.fillStyle = '#e2d4b8'; c.fillRect(ox - z * .5, -z * .27, z * .62, z * .3);
            c.fillStyle = '#1a120a'; c.beginPath(); c.ellipse(ox + z * .45, 0, z * .28, z * .14, 0, 0, 6.283); c.fill();
          }
        }
        c.restore();
      }
    }
    // ---- ships: several types, some in fleets; only on coastal sea lanes (contours of the coast-distance field => never cross land)
    var TYPES = {
      galleon: {sc: 1.55, v: 5.5, beam: .3, w: 2}, cog: {sc: 1.1, v: 6.5, beam: .32, w: 1}, sloop: {sc: .8, v: 9, beam: .26, w: 1},
      longship: {sc: 1.15, v: 8.5, beam: .2, w: 1}, fishing: {sc: .7, v: 5, beam: .3, w: 1}
    };
    var TYPE_W = [['galleon', .18], ['cog', .25], ['sloop', .25], ['longship', .14], ['fishing', .18]];
    function pickType(){ var r = Math.random(), a = 0; for (var i = 0; i < TYPE_W.length; i++){ a += TYPE_W[i][1]; if (r <= a) return TYPE_W[i][0]; } return 'cog'; }
    function laneAt(ln, d){ if (ln.closed){ d = ((d % ln.tot) + ln.tot) % ln.tot; } return at(ln, clamp(d, 0, ln.tot)); }
    function spawnShips(stagger, budget){
      if (!lanes.length) return 0;
      var sum = 0, i; for (i = 0; i < lanes.length; i++) sum += lanes[i].tot;
      var r = Math.random() * sum, ln = lanes[0]; for (i = 0; i < lanes.length; i++){ r -= lanes[i].tot; if (r <= 0){ ln = lanes[i]; break; } }
      var fleet = Math.random() < .3 ? Math.min(budget, 2 + ((Math.random() * 4) | 0)) : 1, dir = Math.random() < .5 ? 1 : -1;
      var lead = pickType(); if (fleet > 1 && lead === 'fishing') lead = Math.random() < .5 ? 'longship' : 'galleon';
      var t0, run = rnd(1400, 3600), d0 = ln.closed ? rnd(0, ln.tot) : rnd(0, Math.max(1, ln.tot - 200)), v = TYPES[lead].v * rnd(.85, 1.1), ph = rnd(0, 9);
      if (!ln.closed){ dir = d0 > ln.tot / 2 ? -1 : 1; run = Math.min(run, dir > 0 ? ln.tot - d0 : d0); }
      t0 = stagger ? rnd(0, run * .8) : 0;
      for (var k = 0; k < fleet; k++){
        var type = k === 0 ? lead : (lead === 'galleon' && Math.random() < .5 ? 'sloop' : lead), row = Math.ceil(k / 2);
        ships.push({ln: ln, dir: dir, d0: d0 - dir * row * 70 * TYPES[lead].sc, run: run, t: t0, v: v, type: type,
          lat: k ? (k % 2 ? 1 : -1) * row * 26 : 0, ph: ph + k, sz: rnd(.9, 1.1)});
      }
      return fleet;
    }
    function stepShips(dt, lt){
      var want = lt ? 12 : 40, guard = 0;
      while (ships.length < want && guard++ < 60) spawnShips(true, want - ships.length);
      if (ships.length > want + 4) ships.length = want;
      for (var i = ships.length - 1; i >= 0; i--){ var k = ships[i]; k.t += k.v * dt; if (k.t >= k.run) ships.splice(i, 1); }
    }
    function drawShip(z, type, ang, t, ph){
      var T = TYPES[type], L = z * T.sc, B = L * T.beam;
      c.save(); c.rotate(ang);
      c.strokeStyle = 'rgba(230,245,250,.30)'; c.lineWidth = Math.max(.6, L * .07);       // wake
      c.beginPath(); c.moveTo(-L * 2.4, -L * .55); c.lineTo(-L * .45, 0); c.lineTo(-L * 2.4, L * .55); c.stroke();
      c.fillStyle = type === 'longship' ? '#3a2412' : '#2b1a0e';
      c.beginPath(); c.ellipse(0, 0, L * .62, B, 0, 0, 6.283); c.fill();                  // hull
      if (type === 'longship'){                                                             // oars
        c.strokeStyle = 'rgba(40,25,12,.8)'; c.lineWidth = Math.max(.4, L * .03); var sw = Math.sin(t * 2.2 + ph) * L * .06;
        c.beginPath(); for (var o = -2; o <= 2; o++){ var ox = o * L * .2; c.moveTo(ox, -B); c.lineTo(ox + sw, -B - L * .22); c.moveTo(ox, B); c.lineTo(ox + sw, B + L * .22); } c.stroke();
      }
      c.restore();
      // sails stay upright on the painted (oblique) map; gentle bob
      c.rotate(Math.sin(t * 1.3 + ph) * .05);
      var s1 = '#efe6d2', ln = 'rgba(40,28,16,.55)';
      c.lineWidth = Math.max(.4, L * .05); c.strokeStyle = ln;
      function tri(x, h, w){ c.fillStyle = s1; c.beginPath(); c.moveTo(x, -L * .12); c.lineTo(x, -h); c.lineTo(x + w, -L * .16); c.closePath(); c.fill(); c.stroke(); }
      function sq(x, h, w, col){ c.fillStyle = col || s1; c.beginPath(); c.moveTo(x - w / 2, -h); c.quadraticCurveTo(x + w * .08, -h * .62, x - w / 2, -L * .2); c.lineTo(x + w / 2, -L * .2); c.quadraticCurveTo(x + w * .58, -h * .62, x + w / 2, -h); c.closePath(); c.fill(); c.stroke(); }
      if (type === 'galleon'){ sq(-L * .28, L * .78, L * .34); sq(L * .05, L * 1.0, L * .42); sq(L * .36, L * .72, L * .3); c.fillStyle = '#8a1f1f'; c.fillRect(L * .02, -L * 1.14, L * .14, L * .08); }
      else if (type === 'cog'){ sq(0, L * .9, L * .5, '#e8dcc0'); }
      else if (type === 'sloop'){ tri(-L * .05, L * .95, L * .5); }
      else if (type === 'longship'){ sq(0, L * .8, L * .55, '#b23a2a'); c.fillStyle = 'rgba(245,235,215,.9)'; c.fillRect(-L * .275 + L * .11, -L * .78, L * .1, L * .56); c.fillRect(-L * .275 + L * .33, -L * .78, L * .1, L * .56); }
      else { tri(0, L * .75, L * .4); }
    }
    function drawShips(t){
      var s = view.s, base = clamp(40 * s, 7, 30);
      for (var i = 0; i < ships.length; i++){
        var k = ships[i], fade = Math.min(1, k.t / 160, (k.run - k.t) / 160); if (fade <= 0) continue;
        var d = k.d0 + k.dir * k.t, q = laneAt(k.ln, d), ang = q.ang + (k.dir < 0 ? Math.PI : 0);
        var wx = q.x - Math.sin(ang) * k.lat, wy = q.y + Math.cos(ang) * k.lat, P = toScreen(wx, wy); if (!vis(P, 60)) continue;
        c.save(); c.translate(P.x, P.y); c.globalAlpha = fade; drawShip(base * k.sz, k.type, ang, t, k.ph); c.restore();
      }
    }
    // ---- chimney smoke: soft noise-textured sprite particles (rise, expand, drift with the wind, fade)
    var SPR = [], SPRD = [], smoke = [], smokeOn = {};
    function makeSmokeSprites(){
      function one(dark){
        var S = 96, t = document.createElement('canvas'); t.width = t.height = S; var x = t.getContext('2d');
        for (var i = 0; i < 26; i++){
          var a = rnd(0, 6.283), r = rnd(0, S * .26), cx = S / 2 + Math.cos(a) * r, cy = S / 2 + Math.sin(a) * r, R = rnd(S * .12, S * .3);
          var v = dark ? (60 + rnd(0, 30)) | 0 : (200 + rnd(0, 45)) | 0, g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
          g.addColorStop(0, 'rgba(' + v + ',' + v + ',' + (v + 4) + ',' + rnd(.35, .62).toFixed(2) + ')'); g.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
          x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.283); x.fill();
        }
        // shade the lower-right a little for a volumetric feel
        x.globalCompositeOperation = 'source-atop'; var sh = x.createLinearGradient(S * .2, S * .2, S * .85, S * .9);
        sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(40,40,50,.28)'); x.fillStyle = sh; x.fillRect(0, 0, S, S);
        x.globalCompositeOperation = 'destination-in'; var m = x.createRadialGradient(S / 2, S / 2, S * .15, S / 2, S / 2, S / 2);
        m.addColorStop(0, '#000'); m.addColorStop(.55, 'rgba(0,0,0,.8)'); m.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = m; x.fillRect(0, 0, S, S);
        return t;
      }
      for (var i = 0; i < 4; i++){ SPR.push(one(false)); }
      for (var j = 0; j < 2; j++){ SPRD.push(one(true)); }
    }
    function puff(e, age){
      var sz = e[2], life = rnd(7, 11) * (.8 + sz * .25);
      return {e: e, x: rnd(-1.5, 1.5) * sz, y: 0, age: age || 0, life: life, r0: rnd(4.5, 7) * sz, vy: -rnd(7, 11) * (.8 + sz * .3), seed: rnd(0, 9),
        spr: e[3] ? SPRD[(Math.random() * SPRD.length) | 0] : SPR[(Math.random() * SPR.length) | 0], a: rnd(.8, 1)};
    }
    function stepSmoke(dt, lt, zf){
      var vis0 = sstep(.1, .26, zf), A = toWorld(-120, -160), B = toWorld(vw + 120, vh + 60), E = DATA.smoke;
      if (vis0 <= 0){ if (smoke.length) smoke.length = 0; smokeOn = {}; return 0; }
      for (var i = 0; i < E.length; i++){
        if (lt && i % 2) continue;
        var e = E[i], on = e[0] > A.x && e[0] < B.x && e[1] > A.y && e[1] < B.y;
        if (!on){ if (smokeOn[i]) smokeOn[i] = 0; continue; }
        var rate = (lt ? 1.1 : 2.6) * (.6 + e[2] * .5);
        if (!smokeOn[i]){ smokeOn[i] = 1; var n0 = Math.round(rate * 9); for (var q = 0; q < n0; q++) smoke.push(puff(e, rnd(0, 9))); }   // pre-warm
        e._acc = (e._acc || 0) + dt * rate; while (e._acc >= 1){ e._acc -= 1; smoke.push(puff(e)); }
      }
      var cap = lt ? 300 : 950; if (smoke.length > cap) smoke.splice(0, smoke.length - cap);
      for (var j = smoke.length - 1; j >= 0; j--){
        var p = smoke[j]; p.age += dt; if (p.age >= p.life){ smoke.splice(j, 1); continue; }
        var u = p.age / p.life; p.y += p.vy * dt * (1 - u * .45); p.x += (4.5 * u + 1.2 + Math.sin(p.age * .8 + p.seed) * 1.4) * dt;
      }
      return vis0;
    }
    function drawSmoke(vis0, zf){
      if (vis0 <= 0) return; var s = view.s, k0 = vis0 * (.75 + .25 * sstep(.35, .8, zf));
      for (var j = 0; j < smoke.length; j++){
        var p = smoke[j], u = p.age / p.life, r = p.r0 * (1 + u * 3.8) * s; if (r < .6) continue;
        var P = toScreen(p.e[0] + p.x, p.e[1] + p.y); if (!vis(P, r)) continue;
        var a = sstep(0, .08, u) * Math.pow(1 - u, 1.25) * p.a * k0; if (a < .01) continue;
        c.globalAlpha = a; c.drawImage(p.spr, P.x - r, P.y - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
    }
    function drawGlow(t, lt){
      var s = view.s; c.save(); c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < GLOW.length; i++){
        var g0 = GLOW[i], P = toScreen(g0[0], g0[1]), R = g0[2] * s * 1.6; if (P.x + R < 0 || P.y + R < 0 || P.x - R > vw || P.y - R > vh) continue;
        var fl = lt ? .8 : .62 + .2 * Math.sin(t * 2.3 + i * 1.9) + .12 * Math.sin(t * 5.7 + i) + .06 * Math.sin(t * 11.3 + i * 3);
        var g = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, R);
        g.addColorStop(0, 'rgba(255,140,40,' + (.22 * fl).toFixed(3) + ')'); g.addColorStop(.5, 'rgba(255,80,20,' + (.08 * fl).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,60,10,0)');
        c.fillStyle = g; c.fillRect(P.x - R, P.y - R, R * 2, R * 2);
      }
      c.restore();
    }
    // ---- birds
    function spawnFlock(){
      if (!landPts.length) return;
      var a = toWorld(0, 0), b = toWorld(vw, vh), mid = null;
      for (var i = 0; i < 40 && !mid; i++){ var x = rnd(Math.max(0, a.x), Math.min(W, b.x)), y = rnd(Math.max(0, a.y), Math.min(H, b.y)); if (isLand(x, y)) mid = {x: x, y: y}; }
      if (!mid){ var p = landPts[(Math.random() * landPts.length) | 0]; mid = {x: p[0], y: p[1]}; }
      var ang = rnd(0, 6.283), D = Math.max(260, Math.hypot(b.x - a.x, b.y - a.y) * rnd(.32, .45));
      var v = Math.max(30, Math.min(120, 22 / view.s)) * rnd(.85, 1.15), n = 3 + ((Math.random() * 6) | 0);
      var birds = []; for (var j = 0; j < n; j++){ var row = Math.ceil(j / 2), side = j % 2 ? 1 : -1; birds.push({row: row, side: j ? side : 0, ph: rnd(0, 10), fq: rnd(6, 9), jx: rnd(-.4, .4), jy: rnd(-.4, .4)}); }
      flocks.push({sx: mid.x - Math.cos(ang) * D, sy: mid.y - Math.sin(ang) * D, ang: ang, len: 2 * D, d: 0, v: v, birds: birds,
        white: Math.random() < .4, alt: rnd(1.09, 1.16), wob: rnd(0, 6), t: 0});
    }
    function stepBirds(dt, lt){
      nextFlock -= dt;
      var max = lt ? 3 : 9;
      if (nextFlock <= 0){ if (flocks.length < max) spawnFlock(); nextFlock = flocks.length < max / 2 ? rnd(1, 3) : rnd(3, 8); }
      for (var i = flocks.length - 1; i >= 0; i--){ var f = flocks[i]; f.d += f.v * dt; f.t += dt; if (f.d > f.len) flocks.splice(i, 1); }
    }
    function drawBirds(lt){
      if (!flocks.length) return;
      var cw = toWorld(vw / 2, vh / 2), zf = zoomF(), span = 3.8 + 4 * zf, sp = span * 1.5;
      for (var pass = 0; pass < 2; pass++){
        if (pass === 0 && lt) continue;
        for (var i = 0; i < flocks.length; i++){
          var f = flocks[i], fade = Math.min(1, f.d / (f.len * .12), (f.len - f.d) / (f.len * .12)); if (fade <= 0) continue;
          var wob = Math.sin(f.t * .4 + f.wob) * .18, ang = f.ang + wob;
          var wx = f.sx + Math.cos(f.ang) * f.d + Math.sin(f.t * .3 + f.wob) * 30, wy = f.sy + Math.sin(f.ang) * f.d + Math.cos(f.t * .25 + f.wob) * 30;
          var P = pass ? {x: vw / 2 + (wx - cw.x) * view.s * f.alt, y: vh / 2 + (wy - cw.y) * view.s * f.alt} : toScreen(wx + 16, wy + 22);
          if (!vis(P, 60)) continue;
          var ca = Math.cos(ang), sa = Math.sin(ang);
          c.lineWidth = pass ? 1.25 : 1; c.lineCap = 'round'; c.lineJoin = 'round';
          c.strokeStyle = pass ? (f.white ? 'rgba(244,242,236,' + (.95 * fade) + ')' : 'rgba(18,18,22,' + (.9 * fade) + ')') : 'rgba(0,0,0,' + (.16 * fade) + ')';
          c.beginPath();
          for (var j = 0; j < f.birds.length; j++){
            var b = f.birds[j], back = -b.row * sp + Math.sin(f.t * 1.3 + b.ph) * b.jx * sp, lat = b.side * b.row * sp * .75 + Math.cos(f.t * 1.1 + b.ph) * b.jy * sp;
            var x = P.x + ca * back - sa * lat, y = P.y + sa * back + ca * lat;
            var cyc = (f.t + b.ph) % 3, flap = cyc < 1.4 ? Math.sin((f.t + b.ph) * b.fq * 6.283 / 4) : .25;
            var tip = span * .5, lift = (flap * .55) * span * .5, s = pass ? 1 : .9;
            var lx = -sa * tip * s, ly = ca * tip * s, bx = -ca * span * .3 * s, by = -sa * span * .3 * s;
            c.moveTo(x + lx + bx, y + ly + by - lift); c.lineTo(x, y); c.lineTo(x - lx + bx, y - ly + by - lift);
          }
          c.stroke();
          if (pass && f.white){ c.strokeStyle = 'rgba(20,24,30,' + (.35 * fade) + ')'; c.lineWidth = .6; c.stroke(); }
        }
      }
    }
    // ---- whirlpool
    function drawWhirl(t, lt){
      if (!wp || !wp.complete || !wp.naturalWidth) return;
      var P = toScreen(WP.x, WP.y), R = WP.r * view.s; if (P.x + R < 0 || P.y + R < 0 || P.x - R > vw || P.y - R > vh) return;
      c.save(); c.translate(P.x, P.y); c.scale(1, WP.sq);
      c.save(); c.rotate(-t * .12); c.globalAlpha = .9; c.drawImage(wp, -R, -R, R * 2, R * 2); c.restore();
      if (!lt && wpIn){ c.save(); c.rotate(-t * .34); c.globalAlpha = .85; c.drawImage(wpIn, -R, -R, R * 2, R * 2); c.restore(); }
      var pulse = .75 + .25 * Math.sin(t * .7), g = c.createRadialGradient(0, 0, R * .05, 0, 0, R);
      g.addColorStop(0, 'rgba(10,30,45,' + (.35 * pulse) + ')'); g.addColorStop(.55, 'rgba(90,200,215,' + (.10 * pulse) + ')'); g.addColorStop(1, 'rgba(90,200,215,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill();
      if (!lt){
        c.lineCap = 'round';
        for (var i = 0; i < 9; i++){
          var rr = R * (.3 + i * .075), w = -t * (.5 / (.4 + i * .12)) + i * 2.1, len = .7 + (i % 3) * .35;
          var al = (.16 + .12 * Math.sin(t * 1.3 + i * 1.7)) * (1 - i / 12);
          c.strokeStyle = 'rgba(225,245,250,' + Math.max(0, al).toFixed(3) + ')'; c.lineWidth = Math.max(.6, R * .025);
          c.beginPath(); c.arc(0, 0, rr, w, w + len); c.stroke();
          c.beginPath(); c.arc(0, 0, rr * .97, w + 3.14, w + 3.14 + len * .6); c.stroke();
        }
      }
      c.restore();
    }
    function resize(){ cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); }
    function draw(t){
      var dt = lastT ? Math.min(.1, t - lastT) : .016; lastT = t;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, vw, vh);
      if (!ready || reduce) return;
      var lt = lite(), zf = zoomF();
      stepCars(dt, lt); stepBirds(dt, lt); stepShips(dt, lt); var sv = stepSmoke(dt, lt, zf);
      drawWhirl(t, lt); drawGlow(t, lt); drawShips(t); drawCars(); drawSmoke(sv, zf); drawBirds(lt);
    }
    // what is around a world point (for the soundscape)
    function probe(x, y){
      var town = 0, S = DATA.settlements;
      for (var i = 0; i < S.length; i++){ var d = Math.hypot(S[i][0] - x, S[i][1] - y); town = Math.max(town, 1 - sstep(S[i][2] * .6, S[i][2] * 2.2, d)); }
      var landF = 0, n = 0; for (var a = 0; a < 5; a++){ var ox = a ? Math.cos(a * 1.57) * 120 : 0, oy = a ? Math.sin(a * 1.57) * 120 : 0; landF += isLand(x + ox, y + oy) ? 1 : 0; n++; }
      return {town: town, land: landF / n, coast: coastDist(x, y)};
    }
    return {init: init, resize: resize, draw: draw, zoomF: zoomF, spawn: spawnFlock, probe: probe, coastDist: coastDist,
      stats: function(){ return {ships: ships.length, fleets: ships.filter(function(k){ return k.lat; }).length, types: ships.reduce(function(o, k){ o[k.type] = (o[k.type] || 0) + 1; return o; }, {}),
        shipPos: ships.slice(0, 6).map(function(k){ var q = laneAt(k.ln, k.d0 + k.dir * k.t); return [Math.round(q.x), Math.round(q.y)]; }),
        cars: cars.length, flocks: flocks.length, roads: roadGeo().length, lanes: lanes.length, smoke: smoke.length, land: landPts.length,
        carPos: cars.slice(0, 4).map(function(k){ var q = at(k, k.d); return [Math.round(q.x), Math.round(q.y)]; })}; }};
  })();

  // ---------------------------------------------------------------- storm cells (drift slowly over open sea; rendered in the shader)
  var STORM = (function(){
    var cells = [mk(), mk()], last = 0;
    function mk(){ return {x: -9999, y: -9999, r: 300, a: 0, fl: 0, life: 0, age: 0, vx: 0, vy: 0, next: 0, f2: 0}; }
    function spawn(c0, t){
      for (var i = 0; i < 60; i++){
        var x = 300 + Math.random() * (W - 600), y = 300 + Math.random() * (H - 600), d = LIFE.coastDist(x, y);
        if (d > 180 && d < 520){ c0.x = x; c0.y = y; break; }
      }
      c0.r = 240 + Math.random() * 160; c0.age = 0; c0.life = 150 + Math.random() * 150; c0.vx = 5 + Math.random() * 5; c0.vy = 1 + Math.random() * 3; c0.next = t + 4 + Math.random() * 8;
    }
    function step(t){
      var dt = last ? Math.min(.2, t - last) : 0; last = t;
      for (var i = 0; i < 2; i++){
        var c0 = cells[i];
        if (c0.age >= c0.life){ if (Math.random() < .02 || !c0.life) spawn(c0, t + i * 40); continue; }
        c0.age += dt; c0.x += c0.vx * dt; c0.y += c0.vy * dt;
        c0.a = Math.min(1, c0.age / 12, (c0.life - c0.age) / 12);
        if (t > c0.next){ c0.f2 = t; c0.next = t + 6 + Math.random() * 12; }
        var e = t - c0.f2; c0.fl = e < 0 || e > .7 ? 0 : (e < .08 ? 1 : e < .16 ? .25 : e < .24 ? .8 : Math.max(0, .8 - (e - .24) * 2));
      }
    }
    return {cells: cells, step: step};
  })();
  var cloudsOn = true; try { cloudsOn = localStorage.getItem('ulv-map-clouds') !== '0'; } catch(e){}

  // ---------------------------------------------------------------- atmosphere (WebGL)
  var FXL = (function(){
    var gl = null, prog = null, U = {}, tex = null, ok = false, ratio = 0.5, tried = false, fallback = null;
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = [
      'precision mediump float;',
      'uniform sampler2D uField;uniform vec2 uRes;uniform float uK;uniform vec3 uView;uniform vec2 uMap;uniform vec2 uCenter;',
      'uniform float uTime;uniform float uZoom;uniform float uLite;uniform vec4 uFogP;uniform float uCloud;uniform vec2 uWind;uniform vec4 uSt0;uniform vec4 uSt1;uniform vec2 uFl;',
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
      ' float thr=mix(.58,.70,uZoom); float cap=mix(.5,1.,smoothstep(0.,.5,uZoom));',
      ' vec2 c0=(uCenter+(w-uCenter)/1.45)/820.; vec2 c1=(uCenter+(w-uCenter)/2.1)/600.+vec2(7.3,2.1);',
      ' float sh=cloud(c0+vec2(.07,.09),t*.03,thr);',
      ' over(o,vec3(0.02,0.03,0.05),sh*.34*uCloud*cap);',
      // sea shimmer: sparkles drifting on open water
      ' if(uLite<.5){float sea=smoothstep(6.,40.,dist)*(1.-fogA);',
      '  vec2 ws=uCenter+(w-uCenter)*1.06;',
      '  float s1=n(ws/38.+vec2(t*.35,t*.12)),s2=n(ws/27.-vec2(t*.22,-t*.28));',
      '  float sp=pow(max(0.,s1*s2-.46)*3.4,4.)*sea*.16; o.rgb+=vec3(.75,.9,1.)*sp;',
      // sea motion: rolling swell bands, drifting highlight streaks, short-lived whitecaps
      '  float sw0=sin(dot(ws,vec2(.6,.8))/48.-t*.9+fbm(ws/420.)*7.);',
      '  o.rgb+=vec3(.70,.85,.95)*pow(max(0.,sw0),5.)*.07*sea; over(o,vec3(0.,.02,.05),max(0.,-sw0)*.07*sea);',
      '  float stk=n(vec2((ws.x+ws.y*.35)/150.-t*.04,(ws.y-ws.x*.2)/16.+t*.03));',
      '  o.rgb+=vec3(.8,.92,1.)*smoothstep(.74,.95,stk)*.06*sea;',
      '  vec2 cid=floor(ws/46.); float cr=h(cid); float cph=fract(t*.13+cr*7.31);',
      '  vec2 cj=vec2(h(cid+3.1),h(cid+7.7))*30.+8.; float cd=length(fract(ws/46.)*46.-cj);',
      '  float cap0=step(.88,cr)*smoothstep(0.,.12,cph)*(1.-smoothstep(.12,.45,cph))*(1.-smoothstep(1.,3.2,cd));',
      '  o.rgb+=vec3(.95,.98,1.)*cap0*.28*sea*smoothstep(.2,.55,uZoom);}',
      // coastal foam lines rolling toward the shore (patchy, not on every coast)
      ' {float cz=smoothstep(.08,.35,uZoom); if(cz>0.){float nn=n(w/90.+t*.03);',
      '  float fr=fract(dist/15.+t*.33+nn*1.3); float wv=smoothstep(0.,.07,fr)*(1.-smoothstep(.07,.32,fr));',
      '  float amp=smoothstep(1.2,4.5,dist)*(1.-smoothstep(16.,44.,dist))*smoothstep(.42,.72,n(w/230.+vec2(t*.008,0.)));',
      '  o.rgb+=vec3(.92,.98,1.)*wv*amp*.36*cz*(1.-fogA);}}',
      // storm cells over open sea: dark cloud mass, rain streaks, lightning flashes
      ' if(uLite<.5){for(int k=0;k<2;k++){vec4 S=k==0?uSt0:uSt1; float fl=k==0?uFl.x:uFl.y; if(S.w<.01)continue;',
      '  float dd=length(w-S.xy)/S.z+(fbm(w/170.+t*.015+float(k)*5.)-.5)*.7; float m=(1.-smoothstep(.25,1.,dd))*S.w;',
      '  if(m<.002)continue; over(o,vec3(.07,.08,.10),m*.5);',
      '  float rn=n(vec2((w.x+w.y*.28)/1.7,(w.y-t*260.)/24.)); over(o,vec3(.72,.76,.82),smoothstep(.78,.93,rn)*m*.24*smoothstep(.1,.4,uZoom)*smoothstep(.2,.6,m));',
      '  o.rgb+=vec3(.85,.9,1.)*fl*m*.55;}}',
      ' over(o,fogC,fogA);',
      // slow warm light sweep across the map (full mode)
      ' if(uLite<.5){float sw=dot(uv,vec2(.857,.514));float ph=fract(t/46.)*2.4-.5;float band=exp(-pow((sw-ph)/.10,2.));o.rgb+=vec3(1.,.88,.66)*band*.05*(1.-fogA*.6);}',
      ' float a0=cloud(c0,t*.03,thr); float a0l=cloud(c0-vec2(.012,.016),t*.03,thr);',
      ' vec3 cc0=mix(vec3(.50,.54,.62),vec3(1.,.98,.94),clamp(.6+(a0-a0l)*3.5,0.,1.));',
      ' over(o,cc0,min(a0*.8,.78)*uCloud*cap);',
      ' if(uLite<.5){float a1=cloud(c1,t*.05,thr+.05); float a1l=cloud(c1-vec2(.012,.016),t*.05,thr+.05);',
      '  vec3 cc1=mix(vec3(.55,.58,.66),vec3(1.),clamp(.6+(a1-a1l)*3.5,0.,1.)); over(o,cc1,a1*.55*uCloud*cap);}',
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
      ['uField','uRes','uK','uView','uMap','uCenter','uTime','uZoom','uLite','uFogP','uCloud','uWind','uSt0','uSt1','uFl'].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });
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
      gl.uniform1f(U.uCloud, cloudsOn ? (C.strength == null ? 1 : C.strength) * (lt ? 0.8 : 1) : 0);
      STORM.step(time); var S0 = STORM.cells[0], S1 = STORM.cells[1];
      gl.uniform4f(U.uSt0, S0.x, S0.y, S0.r, lt || reduce ? 0 : S0.a); gl.uniform4f(U.uSt1, S1.x, S1.y, S1.r, lt || reduce ? 0 : S1.a); gl.uniform2f(U.uFl, S0.fl, S1.fl);
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
    syncToggles();
    if (window.__ulvAudioHold) window.__ulvAudioHold(true);          // site music + era ambience fade out (positions kept)
    if (window.__ulvMapAudio) window.__ulvMapAudio.open();
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
    if (window.__ulvMapAudio) window.__ulvMapAudio.close();
    setTimeout(function(){ if (!isOpen && window.__ulvAudioHold) window.__ulvAudioHold(false); }, 350);
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
    stats: function(){ return {fx: FXL.ok, gl: !!(cvF.getContext && FXL.ok), lite: lite(), tiles: tileCount, loaded: loaded, km: km(totalPx()), places: PLACES.length, roads: ROADS.length, life: LIFE.stats()}; },
    cfg: function(){ return CFG; }, clouds: function(){ return cloudsOn; }, spawnFlock: function(){ LIFE.spawn(); }, redraw: function(){ dirty = true; kick(); },
    isOpen: function(){ return isOpen; }};
})();
