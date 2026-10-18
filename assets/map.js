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
    x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    dn:'<svg viewBox="0 0 24 24"><g class="on"><circle cx="9" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 3.2v1.6M9 15.2v1.6M2.2 10h1.6M14.2 10h1.6M4.2 5.2l1.1 1.1M12.7 13.7l1.1 1.1M4.2 14.8l1.1-1.1M12.7 6.3l1.1-1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M20.5 15.2a4.6 4.6 0 01-6.3 5.3 4.8 4.8 0 004-6.9 4.6 4.6 0 012.3 1.6z" fill="currentColor"/></g><g class="off"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></g></svg>',
    pin:'<svg viewBox="0 0 24 24"><path d="M12 21.5s-6.5-6.2-6.5-11.2a6.5 6.5 0 0113 0c0 5-6.5 11.2-6.5 11.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.3 7.6l5.4 5.4M14.7 7.6l-5.4 5.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="off" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };
  I.lock = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path class="shut" d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path class="open" d="M8 10.5V8a4 4 0 017.6-1.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.5" fill="currentColor"/></svg>';
  I.wx = '<svg viewBox="0 0 24 24"><path d="M6.5 13.5h9a3.2 3.2 0 00.3-6.4A4.7 4.7 0 006.8 6.1 3.7 3.7 0 006.5 13.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 16.5v4M6.3 17.5l3.4 2M9.7 17.5l-3.4 2M15.5 16l-1.2 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="off" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  I.roads = '<svg viewBox="0 0 24 24"><path d="M3.5 19.5c3-1 4-4 7-5.5s7.5-.5 10-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 9.5c2.5-.5 3.5-3 6.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2.2" stroke-linecap="round"/><circle cx="3.5" cy="19.5" r="1.6" fill="currentColor"/><circle cx="20.5" cy="9" r="1.6" fill="currentColor"/><path class="off" d="M4 4l16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  I.plan = '<svg viewBox="0 0 24 24"><path d="M6 21V4M6 4.5h10l-2.2 3.2L16 11H6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/><circle cx="17.5" cy="18.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 18.5h6.5" stroke="currentColor" stroke-width="1.4" stroke-dasharray="1.8 1.8"/></svg>';
  var PIN_I = {
    battle:'<svg viewBox="0 0 24 24"><path d="M5 4l9.5 9.5M19 4L9.5 13.5M4 17.5l3 3M20 17.5l-3 3M6.2 15.2l2.6 2.6M17.8 15.2l-2.6 2.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
    found:'<svg viewBox="0 0 24 24"><path d="M6 21V9l-1.5-2V4h3v1.5h2V4h5v1.5h2V4h3v3L18 9v12zM10.5 21v-4a1.5 1.5 0 013 0v4" fill="currentColor"/></svg>',
    event:'<svg viewBox="0 0 24 24"><path d="M12 3l2.4 6.1 6.6.4-5.1 4.2 1.7 6.4L12 16.6l-5.6 3.5 1.7-6.4L3 9.5l6.6-.4z" fill="currentColor"/></svg>'
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
        '<canvas class="mapx-night"></canvas>' +
        '<canvas class="mapx-sky"></canvas>' +
                '<svg class="mapx-svg" xmlns="http://www.w3.org/2000/svg"><g class="mapx-roads"></g><g class="mapx-planr"><path class="p-glow"/><path class="p-ink"/><path class="p-sea"/><g class="p-nodes"></g></g><g class="mapx-route"><path class="r-glow"/><path class="r-ink"/><path class="r-dash"/><g class="r-segs"></g><g class="r-nodes"></g></g></svg>' +
        '<div class="mapx-pins"></div>' +
        '<div class="mapx-labels"></div>' +
        '<div class="mapx-vig" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="mapx-tools" role="toolbar" aria-label="Harita araçları">' +
        '<button type="button" class="mt-nav on" data-tool="nav" aria-pressed="true" title="Gezinme (sürükle, tekerlekle yakınlaş)">' + I.hand + '</button>' +
        '<button type="button" class="mt-route" data-tool="route" aria-pressed="false" title="Rota ölç (tıkla: nokta ekle)">' + I.route + '</button>' +
        '<button type="button" class="mt-plan" aria-pressed="false" title="Yolculuk planla (yerden yere en kısa yol)">' + I.plan + '</button>' +
        '<i class="mt-sep"></i>' +
        '<button type="button" class="mt-in" title="Yakınlaş">' + I.plus + '</button>' +
        '<button type="button" class="mt-out" title="Uzaklaş">' + I.minus + '</button>' +
        '<button type="button" class="mt-fit" title="Tüm harita">' + I.fit + '</button>' +
        '<i class="mt-sep"></i>' +
        '<button type="button" class="mt-cloud" aria-pressed="true" title="Bulutlar">' + I.cloud + '</button>' +
        '<button type="button" class="mt-dn" aria-pressed="true" title="Gece / gündüz döngüsü (kapalıyken hep gündüz)">' + I.dn + '</button>' +
        '<button type="button" class="mt-pins" aria-pressed="true" title="Tarihî olay iğneleri">' + I.pin + '</button>' +
        '<button type="button" class="mt-roads" aria-pressed="false" title="Yollar">' + I.roads + '</button>' +
        '<button type="button" class="mt-wx" aria-pressed="false" title="Mevsim ve hava">' + I.wx + '</button>' +
        '<button type="button" class="mt-edit" aria-pressed="false" title="İğne ve yer adı düzenleme (kilidi aç, sürükle)">' + I.lock + '</button>' +
        '<div class="mt-sndwrap"><button type="button" class="mt-snd" aria-pressed="true" title="Harita sesleri">' + I.snd + '</button>' +
        '<div class="mt-volpop"><input type="range" class="mt-vol" min="0" max="100" step="1" value="50" aria-label="Harita ses düzeyi"><output class="mt-volv">50</output></div></div>' +
      '</div>' +
      '<div class="mapx-edit" hidden role="status"><b>Düzenleme modu</b><span>İğneleri ve yer adlarını sürükleyerek taşıyın. Bitince kilide tekrar basın: yeni konumlar herkes için kaydedilir.</span><em class="me-n"></em></div>' +
      '<div class="mapx-rt" hidden>' +
        '<div class="rt-main"><span class="rt-km">—</span><span class="rt-t"><b class="rt-walk">—</b> yaya · <b class="rt-horse">—</b> atlı · <b class="rt-cart">—</b> kervan · <b class="rt-air">—</b> hava gemisi</span></div>' +
        '<div class="rt-sub"><span class="rt-hint">Haritaya tıklayarak durak ekle</span><span class="rt-est">ölçek tahmini</span></div>' +
        '<div class="rt-btns"><button type="button" class="rt-undo" title="Son durağı geri al (Backspace)">' + I.undo + '</button><button type="button" class="rt-clear" title="Rotayı temizle">' + I.trash + '</button></div>' +
      '</div>' +
      '<div class="mapx-pop" hidden></div>' +
      '<div class="mapx-plan" hidden role="dialog" aria-label="Yolculuk planla"><div class="pl-h"><b>Yolculuk planla</b><button type="button" class="pl-x" aria-label="Kapat">' + I.x + '</button></div>' +
        '<div class="pl-stops"></div><button type="button" class="pl-add">+ Durak ekle</button><div class="pl-out" aria-live="polite"></div>' +
        '<datalist id="mapxPlaces"></datalist></div>' +
      '<aside class="mapx-place" hidden role="dialog" aria-label="Yer bilgisi"><div class="mpl-roll" aria-hidden="true"></div><button type="button" class="mpl-x" aria-label="Kapat">' + I.x + '</button><div class="mpl-in"></div></aside>' +
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
  var CFG = null, TL = null, PLACES = [], PINS = [], ROADS = [], loaded = false, loading = null;
  var W = 5112, H = 4920;
  var vw = 0, vh = 0, dpr = 1;
  var view = {s: 0.2, x: 0, y: 0}, minS = 0.1, maxS = 2.5;
  var anim = null;          // smooth zoom target {s, ax, ay}
  var vel = {x: 0, y: 0}, inertia = false;
  var tool = 'nav', route = [], isOpen = false, dirty = true, raf = 0;
  var planW = 0, tiles = {}, tileCount = 0, baseImg = null, NETD = null, roadsOn = false, wxOn = false, plan = null;
  try { roadsOn = localStorage.getItem('ulv-map-roads') === '1'; wxOn = localStorage.getItem('ulv-map-wx') !== '0'; } catch(e){}   // weather defaults ON; the toggle switches ALL weather off (see wxActive)

  function lite(){ return document.body.classList.contains('fx-lite') || autoLite; }
  var autoLite = false;

  function getJSON(u){ return fetch(BASE + u, {cache: 'no-cache'}).then(function(r){ if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  function load(){
    if (loading) return loading;
    loading = Promise.all([getJSON('config.json'), getJSON('tiles.json'),
      getJSON('places.json').catch(function(){ return []; }), getJSON('roads.json').catch(function(){ return []; }), getJSON('roads_auto.json').catch(function(){ return []; }), getJSON('sealanes.json').catch(function(){ return []; }), getJSON('life.json').catch(function(){ return {}; }), getJSON('roadnet.json').catch(function(){ return null; })])
    .then(function(r){
      CFG = r[0]; TL = r[1]; PLACES = Array.isArray(r[2]) ? r[2] : ((r[2] && r[2].places) || []); PINS = (r[2] && r[2].pins) || []; ROADS = Array.isArray(r[3]) ? r[3] : [];
      W = TL.width; H = TL.height; maxS = CFG.maxZoom || 2.5;
      rt.querySelector('.rt-est').hidden = !CFG.scaleIsEstimate;
      NETD = r[7] && r[7].nodes ? r[7] : null; PE.apply(PE.cached()); buildPlaces(); PE.fetch().then(function(o){ if (!PE.on) PE.apply(o); dirty = true; kick(); }); buildRoads(); buildPlanList(); LIFE.init(Array.isArray(r[4]) ? r[4] : [], Array.isArray(r[5]) ? r[5] : [], r[6] || {}, r[7]);
      return new Promise(function(res){ baseImg = new Image(); baseImg.decoding = 'async'; baseImg.onload = baseImg.onerror = function(){ res(); }; baseImg.src = BASE + 'base.webp'; });
    }).then(function(){ loaded = true; ov.classList.add('ready'); FXL.init(); resize(true); });
    return loading;
  }

  // ---------------------------------------------------------------- view math
  function fitScale(){ return Math.min(vw / W, vh / H); }
  function clampView(){
    view.s = Math.max(minS, Math.min(maxS, view.s));
    var mw = W * view.s, mh = H * view.s, pad = 0;
    var padX = plan && plan.open && vw > 700 ? planW : 0;   // the planner panel covers the left edge: allow the map to slide under it
    if (mw <= vw) view.x = (vw - mw) / 2; else view.x = Math.min(padX, Math.max(vw - mw - pad, view.x));
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
    if (roadsOn) drawNet();
    tiltBlur();
  }
  // road network overlay (toggle): inked, semi-transparent paths drawn into the static map layer (redrawn only on view change)
  var netPaths = null;
  function drawNet(){
    if (!NETD) return;
    if (!netPaths){ netPaths = [new Path2D(), new Path2D(), new Path2D()];
      NETD.edges.forEach(function(e){ var P = netPaths[e.t] || netPaths[2], q = e.p; P.moveTo(q[0][0], q[0][1]); for (var i = 1; i < q.length; i++) P.lineTo(q[i][0], q[i][1]); }); }
    var s = view.s, u = 1 / s, k = Math.min(1.6, .75 + s * .9);
    ctx.save(); ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.x, dpr * view.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(250,232,190,.22)'; ctx.lineWidth = 5.5 * k * u; ctx.stroke(netPaths[0]);
    ctx.strokeStyle = 'rgba(122,62,22,.62)'; ctx.lineWidth = 2.6 * k * u; ctx.stroke(netPaths[0]);
    ctx.strokeStyle = 'rgba(250,232,190,.16)'; ctx.lineWidth = 4 * k * u; ctx.stroke(netPaths[1]);
    ctx.strokeStyle = 'rgba(92,58,28,.52)'; ctx.lineWidth = 1.7 * k * u; ctx.stroke(netPaths[1]);
    ctx.setLineDash([4.5 * k * u, 4 * k * u]); ctx.strokeStyle = 'rgba(84,56,30,.48)'; ctx.lineWidth = 1.2 * k * u; ctx.stroke(netPaths[2]);
    ctx.restore();
  }
  // tilt-shift depth: blur the top/bottom bands of the map layer (only redrawn on view change; no-op where ctx.filter is unsupported)
  var tiltCv = null;
  function tiltBlur(){
    if (!(tiltO > 0) || !('filter' in ctx)) return;
    var w = cvT.width, h = cvT.height, bh = Math.round(h * .2), blur = (1.6 * dpr * tiltO).toFixed(2);
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

  // ---------------------------------------------------------------- places, history pins, info panel (data: places.json, generated by site-build/map_places.py)
  var placeEls = [], pinEls = [], pinsOn = true, curPanel = null;
  try { pinsOn = localStorage.getItem('ulv-map-pins') !== '0'; } catch(e){}
  var pinsLayer = ov.querySelector('.mapx-pins'), plc = ov.querySelector('.mapx-place'), plcIn = plc.querySelector('.mpl-in');
  // zoomF thresholds where each rank appears (regions fade out again when zoomed far in)
  var RANK_Z = {capital: 0, city: 0, sea: 0, region: 0, town: .3, landmark: .34, district: .5};
  var RANK_K = {capital: 'Başkent', city: 'Şehir', town: 'Yerleşim', landmark: 'Önemli yer', district: 'Şehir bölgesi', region: 'Bölge', sea: 'Deniz'};
  var PIN_K = {battle: 'Savaş · çatışma', found: 'Kuruluş', event: 'Önemli olay'};
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function evByO(o){ var E = (window.TIMELINE && window.TIMELINE.events) || []; for (var i = 0; i < E.length; i++) if (E[i].o === o) return E[i]; return null; }
  function placeById(id){ for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i]; return null; }
  function buildPlaces(){
    labels.innerHTML = ''; placeEls = [];
    PLACES.forEach(function(p){
      if (!p || p.rank === 'hidden' || p.lx == null || !p.name) return;
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'mp-place r-' + p.rank; b.innerHTML = '<span>' + esc(p.name) + '</span>';
      b.setAttribute('aria-label', p.name + ' — ' + (RANK_K[p.rank] || 'Yer') + ', bilgiyi aç');
      b.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
      b.addEventListener('click', function(ev){ ev.stopPropagation(); showPlace(p, b); });
      labels.appendChild(b); placeEls.push({p: p, el: b, z: RANK_Z[p.rank] || 0});
    });
    pinsLayer.innerHTML = ''; pinEls = [];
    PINS.forEach(function(q){
      var e = evByO(q.o); if (!e) return;
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'mp-pin p-' + q.type + (q.est ? ' est' : '') + (e.major ? ' major' : '');
      b.innerHTML = '<i>' + (PIN_I[q.type] || PIN_I.event) + '</i>';
      b.title = e.big + ' · ' + e.title + (q.est ? ' (konum tahmini)' : '');
      b.setAttribute('aria-label', e.title + ' — olay iğnesi');
      b.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
      b.addEventListener('click', function(ev){ ev.stopPropagation(); showPin(q, e, b); });
      pinsLayer.appendChild(b); pinEls.push({q: q, el: b});
    });
    pinsLayer.classList.toggle('off', !pinsOn);
  }
  function buildRoads(){
    gRoads.innerHTML = '';
    ROADS.forEach(function(r){ if (!r || !r.points || r.points.length < 2) return;
      var pth = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pth.setAttribute('class', 'road t-' + (r.type || 'road'));
      pth._pts = r.points; if (r.name){ var t = document.createElementNS('http://www.w3.org/2000/svg', 'title'); t.textContent = r.name; pth.appendChild(t); }
      gRoads.appendChild(pth); });
  }
  // ---------------------------------------------------------------- pin edit mode (shared positions)
  // Lock button -> edit mode: history pins and place labels become draggable. Leaving edit mode sends the moved
  // positions (only {id,x,y}) to the Katip worker (POST /pins, strict validation + rate limit there, KV storage); every
  // visitor's map loads them with GET /pins at open (cached briefly) and applies them over places.json. If the save
  // fails, the moves stay in localStorage and are re-sent on the next open.
  var PE = (function(){
    var API = 'https://katip-pirdeviz.ulunavir.workers.dev/pins', on = false, moved = {}, drag = null, PKEY = 'ulv-pin-pending', CKEY = 'ulv-pin-cache';
    function pending(){ try { return JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch(e){ return {}; } }
    function cached(){ try { var c0 = JSON.parse(sessionStorage.getItem(CKEY) || 'null'); return c0 && c0.o || {}; } catch(e){ return {}; } }
    function fetchO(){
      try { var c0 = JSON.parse(sessionStorage.getItem(CKEY) || 'null'); if (c0 && Date.now() - c0.t < 60e3) return Promise.resolve(c0.o); } catch(e){}
      var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function(){ if (ctl) ctl.abort(); }, 8000);
      return fetch(API, {signal: ctl ? ctl.signal : undefined}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){ clearTimeout(tm); var o = d && d.o || {};
        try { sessionStorage.setItem(CKEY, JSON.stringify({t: Date.now(), o: o})); } catch(e){} return o; }).catch(function(){ clearTimeout(tm); return {}; });
    }
    function apply(o){
      o = o || {}; var pd = pending(), k; for (k in pd) o[k] = pd[k];
      PLACES.forEach(function(p){ var v = p && o['pl:' + p.id]; if (v && isFinite(v[0]) && isFinite(v[1])){ p.lx = v[0]; p.ly = v[1]; } });
      PINS.forEach(function(q){ var v = o['pin:' + q.o]; if (v && isFinite(v[0]) && isFinite(v[1])){ q.x = v[0]; q.y = v[1]; } });
      if (Object.keys(pd).length && !apply.sent){ apply.sent = 1; setTimeout(function(){ send(pd); }, 1500); }
    }
    function send(m){
      var moves = Object.keys(m).map(function(id){ return {id: id, x: Math.round(m[id][0]), y: Math.round(m[id][1])}; }); if (!moves.length) return;
      try { var pd = pending(); moves.forEach(function(v){ pd[v.id] = [v.x, v.y]; }); localStorage.setItem(PKEY, JSON.stringify(pd)); } catch(e){}
      var chunks = []; for (var i = 0; i < moves.length; i += 100) chunks.push(moves.slice(i, i + 100));
      chunks.reduce(function(pr, ch){ return pr.then(function(){ return fetch(API, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({moves: ch})}).then(function(r){ if (!r.ok) throw new Error('pins ' + r.status); }); }); }, Promise.resolve())
        .then(function(){ try { localStorage.removeItem(PKEY); sessionStorage.removeItem(CKEY); } catch(e){} toast(moves.length + ' konum kaydedildi — herkes için güncellendi.'); })
        .catch(function(){ toast('Kaydedilemedi; değişiklikler bu cihazda saklandı, harita bir daha açıldığında yeniden denenecek.'); });
    }
    function toast(msg){ var e = ov.querySelector('.mapx-edit'); e.hidden = false; e.classList.add('msg'); e.querySelector('span').textContent = msg; e.querySelector('.me-n').textContent = '';
      clearTimeout(toast.t); toast.t = setTimeout(function(){ if (!on){ e.hidden = true; e.classList.remove('msg'); } }, 4200); }
    function count(){ var n = Object.keys(moved).length; ov.querySelector('.me-n').textContent = n ? n + ' değişiklik' : ''; }
    function toggle(){
      on = !on; ov.classList.toggle('editing', on);
      var b = ov.querySelector('.mt-edit'), e = ov.querySelector('.mapx-edit'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = on ? 'Düzenlemeyi bitir ve kaydet' : 'İğne ve yer adı düzenleme (kilidi aç, sürükle)';
      if (on){ moved = {}; e.hidden = false; e.classList.remove('msg'); e.querySelector('span').textContent = 'İğneleri ve yer adlarını sürükleyerek taşıyın. Bitince kilide tekrar basın: yeni konumlar herkes için kaydedilir.'; count(); pinsLayer.classList.remove('off'); }
      else { pinsLayer.classList.toggle('off', !pinsOn); var m = moved; moved = {}; if (Object.keys(m).length) send(m); else e.hidden = true; }
      dirty = true; kick();
    }
    function find(el){
      for (var i = 0; i < placeEls.length; i++) if (placeEls[i].el === el) return {id: 'pl:' + placeEls[i].p.id, o: placeEls[i].p, kx: 'lx', ky: 'ly'};
      for (i = 0; i < pinEls.length; i++) if (pinEls[i].el === el) return {id: 'pin:' + pinEls[i].q.o, o: pinEls[i].q, kx: 'x', ky: 'y'};
      return null;
    }
    function down(ev){
      if (!on) return; var el = ev.target.closest('.mp-place,.mp-pin'); if (!el) return; var f = find(el); if (!f) return;
      ev.stopPropagation(); ev.preventDefault();
      drag = {f: f, el: el, sx: ev.clientX, sy: ev.clientY, ox: f.o[f.kx], oy: f.o[f.ky], id: ev.pointerId}; el.classList.add('dragging');
      try { el.setPointerCapture(ev.pointerId); } catch(e){}
    }
    function move(ev){
      if (!drag || ev.pointerId !== drag.id) return; ev.preventDefault();
      var f = drag.f, nx = clampN(drag.ox + (ev.clientX - drag.sx) / view.s, 0, W), ny = clampN(drag.oy + (ev.clientY - drag.sy) / view.s, 0, H);
      f.o[f.kx] = nx; f.o[f.ky] = ny; if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 2){ moved[f.id] = [nx, ny]; count(); }
      layoutOverlay();
    }
    function up(ev){ if (!drag || ev.pointerId !== drag.id) return; drag.el.classList.remove('dragging'); drag = null; }
    function clampN(v, a, b){ return v < a ? a : v > b ? b : v; }
    [labels, pinsLayer].forEach(function(L){
      L.addEventListener('pointerdown', down, true); L.addEventListener('pointermove', move, true); L.addEventListener('pointerup', up, true); L.addEventListener('pointercancel', up, true);
      L.addEventListener('click', function(ev){ if (on){ ev.stopPropagation(); ev.preventDefault(); } }, true);
    });
    return {fetch: fetchO, apply: apply, cached: cached, toggle: toggle, get on(){ return on; }, moved: function(){ return moved; }};
  })();
  function layoutOverlay(){
    var zf = LIFE.zoomF(), ls = Math.min(1.25, .82 + zf * .5);
    labels.style.setProperty('--ls', ls.toFixed(3));
    placeEls.forEach(function(o){
      var s = toScreen(o.p.lx, o.p.ly), r = o.p.rank;
      var hide = zf < o.z - .001 || ((r === 'region' || r === 'sea') && zf > .72) || s.x < -160 || s.y < -40 || s.x > vw + 160 || s.y > vh + 40;
      o.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + ls.toFixed(3) + ')';
      o.el.classList.toggle('off', hide);
    });
    var pinVis = (pinsOn || PE.on) && zf >= .16;
    pinEls.forEach(function(o){
      var s = toScreen(o.q.x, o.q.y);
      o.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
      o.el.classList.toggle('off', !pinVis || s.x < -20 || s.y < -20 || s.x > vw + 20 || s.y > vh + 20);
    });
    Array.prototype.forEach.call(gRoads.children, function(p){
      p.setAttribute('d', p._pts.map(function(q, i){ var s = toScreen(q[0], q[1]); return (i ? 'L' : 'M') + s.x.toFixed(1) + ' ' + s.y.toFixed(1); }).join(''));
    });
    drawRoute(); drawPlan();
  }
  function TC(){ return window.__ulv && window.__ulv.TagCard; }
  // place/pin photo gallery (t130): prev/next arrows, swipe, arrow keys, '2 / 4' counter + dots, caption, enlarge -> lightbox
  var galPh = null, galTitle = '';
  function mediaHtml(ph, auto, title){
    galPh = ph && ph.length ? ph : null; galTitle = title || '';
    if (!ph || !ph.length) return '';
    var h = '<div class="mpl-media' + (ph.length > 1 ? ' multi' : '') + '" data-i="0"><div class="slides">';
    ph.forEach(function(p, i){ h += '<figure class="slide' + (i ? '' : ' on') + '"><img ' + (i < 2 ? 'src' : 'data-src') + '="' + esc(p.f) + '" width="' + p.w + '" height="' + p.h + '" alt="' + esc(p.cap || '') + '" decoding="async" draggable="false">' + (p.cap ? '<figcaption>' + esc(p.cap) + '</figcaption>' : '') + '</figure>'; });
    h += '</div>';
    if (ph.length > 1){ h += '<button type="button" class="mpl-nav prev" aria-label="Önceki görsel">‹</button><button type="button" class="mpl-nav next" aria-label="Sonraki görsel">›</button>';
      h += '<span class="mpl-cnt" aria-live="polite">1 / ' + ph.length + '</span><span class="mpl-dots">'; for (var d = 0; d < ph.length; d++) h += '<i' + (d ? '' : ' class="on"') + ' data-di="' + d + '"></i>'; h += '</span>'; }
    h += '<button type="button" class="mpl-zoom" aria-label="Görseli büyüt" title="Büyüt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></button>';
    if (auto) h += '<span class="mpl-auto">Bu yerde geçen olaylardan</span>';
    return h + '</div>';
  }
  function openPanel(html, el){
    plcIn.innerHTML = html; plcIn.scrollTop = 0; pop.hidden = true;
    var was = !plc.hidden; plc.hidden = false; curPanel = el || null;
    if (!was){ plc.classList.remove('on'); void plc.offsetWidth; }
    requestAnimationFrame(function(){ plc.classList.add('on'); });
  }
  function closePanel(){
    if (plc.hidden) return; plc.classList.remove('on');
    setTimeout(function(){ if (!plc.classList.contains('on')){ plc.hidden = true; plcIn.innerHTML = ''; } }, 320);
    ov.querySelectorAll('.mp-place.sel,.mp-pin.sel').forEach(function(x){ x.classList.remove('sel'); });
  }
  function evList(os, title){
    var E = os.map(evByO).filter(Boolean); if (!E.length) return '';
    var h = '<div class="mpl-h">' + title + ' <span>' + E.length + '</span></div><ol class="mpl-evs">';
    E.forEach(function(e){ h += '<li><button type="button" data-go="' + e.o + '"><b>' + esc(e.big) + '</b><span>' + esc(e.title) + '</span></button></li>'; });
    return h + '</ol>';
  }
  function showPlace(p, el){
    ov.querySelectorAll('.mp-place.sel,.mp-pin.sel').forEach(function(x){ x.classList.remove('sel'); }); if (el) el.classList.add('sel');
    var h = mediaHtml(p.ph, p.phAuto, p.name) + '<div class="mpl-body"><div class="mpl-k">' + (RANK_K[p.rank] || 'Yer') + '</div><h2 class="mpl-t">' + esc(p.name) + '</h2>';
    if (p.sub) h += '<div class="mpl-s">' + esc(p.sub) + '</div>';
    var tg = p.tagId || p.tag; if (tg){ var tt = 'p'; (p.links || []).forEach(function(l){ if (l[0] === tg) tt = l[1]; });   // the place's own tag card
      h += '<button type="button" class="mpl-card t-' + tt + '" data-tag="' + esc(tg) + '" data-tt="' + tt + '">Etiket kartını aç</button>'; }
    h += '<div class="mpl-rule" aria-hidden="true"><i></i><b>✦</b><i></i></div>';
    (p.desc || []).forEach(function(d){ h += '<p>' + esc(d).replace(/tahmin ediliyor/g, '<em class="mpl-est">tahmin ediliyor</em>') + '</p>'; });
    if (!p.desc || !p.desc.length) h += '<p class="mpl-none">Arşivde bu yer için henüz ayrıntılı bir kayıt yok.</p>';
    if (p.facts && p.facts.length){ h += '<dl class="mpl-facts">'; p.facts.forEach(function(f){ h += '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }); h += '</dl>'; }
    if (p.links && p.links.length){
      h += '<div class="mpl-h">Bağlantılı etiketler</div><ul class="mpl-tags">';
      p.links.forEach(function(l){ h += '<li><button type="button" class="t-' + l[1] + '" data-tag="' + esc(l[0]) + '" data-tt="' + l[1] + '">' + esc(l[0]) + '</button></li>'; });
      h += '</ul>';
    }
    if (p.ev && p.ev.length) h += evList(p.ev, 'Tarihçe · burada geçen olaylar');
    var near = PINS.filter(function(q){ return q.pl === p.id; }).length;
    if (near) h += '<p class="mpl-note">Haritada bu yerin çevresinde ' + near + ' olay iğnesi var' + (pinsOn ? '.' : ' (iğne katmanı kapalı).') + '</p>';
    openPanel(h + '</div>', el);
  }
  function showPin(q, e, el){
    ov.querySelectorAll('.mp-place.sel,.mp-pin.sel').forEach(function(x){ x.classList.remove('sel'); }); if (el) el.classList.add('sel');
    var ph = (e.imgs || []).slice(0, 4).map(function(im){ return {f: im.c, w: im.w, h: im.h, cap: ''}; });
    var p = placeById(q.pl);
    var h = mediaHtml(ph, false, e.title) + '<div class="mpl-body"><div class="mpl-k">' + (PIN_K[q.type] || 'Olay') + ' · ' + esc(e.big) + '</div><h2 class="mpl-t">' + esc(e.title) + '</h2>';
    h += '<div class="mpl-s">' + (p && p.rank !== 'hidden' ? '<button type="button" class="mpl-pl" data-pl="' + esc(p.id) + '">' + esc(p.name) + '</button>' : esc(p ? p.name : '')) +
      (q.via ? ' · ' + esc(q.via) : '') + (q.est ? ' <em class="mpl-est">konum tahmini</em>' : '') + '</div>';
    h += '<div class="mpl-rule" aria-hidden="true"><i></i><b>✦</b><i></i></div><p>' + esc(e.sum) + '</p>';
    if (q.est) h += '<p class="mpl-note">İğne, olayın geçtiği yerden (' + esc(q.via || (p && p.name) || '') + ') yola çıkılarak yaklaşık olarak yerleştirildi; kesin konum arşivde yok.</p>';
    h += '<button type="button" class="mpl-go" data-go="' + e.o + '">Zaman çizelgesinde göster</button>';
    openPanel(h + '</div>', el);
  }
  function goCard(o){
    closePanel(); close();
    setTimeout(function(){
      var t = document.querySelector('.ev[data-o="' + o + '"]'); if (!t) return;
      var y = t.getBoundingClientRect().top + window.scrollY - innerHeight * 0.22;
      window.scrollTo({top: y, behavior: reduce ? 'auto' : 'smooth'});
      t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); setTimeout(function(){ t.classList.remove('flash'); }, 2600);
    }, reduce ? 0 : 480);
  }
  function galGo(m, i){
    var sl = m.querySelectorAll('.slide'), n = sl.length; if (n < 2) return; i = ((i % n) + n) % n;
    sl.forEach(function(x, j){ x.classList.toggle('on', j === i); if (Math.abs(j - i) <= 1 || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)){ var im = x.querySelector('img'); if (im && im.dataset.src && !im.getAttribute('src')) im.src = im.dataset.src; } });
    m.dataset.i = i; var c0 = m.querySelector('.mpl-cnt'); if (c0) c0.textContent = (i + 1) + ' / ' + n;
    m.querySelectorAll('.mpl-dots i').forEach(function(d, j){ d.classList.toggle('on', j === i); });
  }
  function galMedia(){ return plc.hidden ? null : plc.querySelector('.mpl-media.multi'); }
  // swipe on the photo (touch / pen; mouse drags too)
  var galSX = null, galSY = 0, galSwiped = false;
  plc.addEventListener('pointerdown', function(ev){ if (ev.target.closest('.mpl-media') && !ev.target.closest('button')){ galSX = ev.clientX; galSY = ev.clientY; } else galSX = null; }, true);
  plc.addEventListener('pointerup', function(ev){ if (galSX == null) return; var m = ev.target.closest('.mpl-media.multi'), dx = ev.clientX - galSX, dy = ev.clientY - galSY; galSX = null;
    if (m && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3){ galSwiped = true; galGo(m, +m.dataset.i + (dx < 0 ? 1 : -1)); setTimeout(function(){ galSwiped = false; }, 400); } }, true);
  // fullscreen viewer for the panel photos; same look as the timeline lightbox (style.css .lb*)
  var PLB = (function(){
    var el = null, img, tEl, dEl, nEl, dots, ph = null, idx = 0, opener = null, token = 0;
    function build(){
      el = document.createElement('div'); el.className = 'lb mpl-lb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Görsel görüntüleyici'); el.hidden = true;
      el.innerHTML = '<div class="lb-stage"><img class="lb-img" alt=""><div class="lb-spin" aria-hidden="true"></div></div>' +
        '<button class="lb-x" type="button" aria-label="Kapat (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" fill="none"/></svg></button>' +
        '<button class="lb-nav lb-prev" type="button" aria-label="Önceki görsel"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>' +
        '<button class="lb-nav lb-next" type="button" aria-label="Sonraki görsel"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>' +
        '<div class="lb-cap"><div class="lb-t"></div><div class="lb-m"><span class="lb-d"></span><span class="lb-n"></span></div><div class="lb-dots"></div></div>';
      document.body.appendChild(el);
      img = el.querySelector('.lb-img'); tEl = el.querySelector('.lb-t'); dEl = el.querySelector('.lb-d'); nEl = el.querySelector('.lb-n'); dots = el.querySelector('.lb-dots');
      el.addEventListener('click', function(ev){
        if (ev.target.closest('.lb-x')) return close();
        if (ev.target.closest('.lb-prev')) return show(idx - 1);
        if (ev.target.closest('.lb-next')) return show(idx + 1);
        var d = ev.target.closest('.lb-dots i'); if (d) return show(Array.prototype.indexOf.call(dots.children, d));
        if (ev.target === img || ev.target.closest('.lb-cap')) return;
        close();
      });
      el.addEventListener('wheel', function(ev){ ev.preventDefault(); ev.stopPropagation(); }, {passive: false});
      var sx = 0, sy = 0;
      el.addEventListener('touchstart', function(ev){ sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, {passive: true});
      el.addEventListener('touchmove', function(ev){ ev.preventDefault(); }, {passive: false});
      el.addEventListener('touchend', function(ev){ var t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1)); else if (dy > 90) close(); }, {passive: true});
    }
    function show(i){
      var n = ph.length; idx = ((i % n) + n) % n; var x = ph[idx], my = ++token, src = String(x.f);
      el.classList.add('loading'); img.classList.remove('in');
      var pre = new Image(); pre.decoding = 'async'; pre.src = src;
      pre.onload = pre.onerror = function(){ if (my !== token) return; img.src = src; img.width = x.w || 1280; img.height = x.h || 720; el.classList.remove('loading'); requestAnimationFrame(function(){ img.classList.add('in'); }); };
      img.alt = (x.cap || tEl.textContent) + (n > 1 ? ' (' + (idx + 1) + '/' + n + ')' : '');
      dEl.textContent = x.cap || ''; nEl.textContent = n > 1 ? (idx + 1) + ' / ' + n : '';
      dots.innerHTML = n > 1 ? ph.map(function(_, j){ return '<i' + (j === idx ? ' class="on"' : '') + '></i>'; }).join('') : '';
      el.classList.toggle('single', n < 2);
      if (n > 1){ var nx = new Image(); nx.src = ph[(idx + 1) % n].f; }
      var m = plc.querySelector('.mpl-media'); if (m) galGo(m, idx);   // keep the panel in step
    }
    function open(list, i, title, from){
      if (!list || !list.length) return; if (!el) build(); ph = list; opener = from || null; tEl.textContent = title || '';
      el.hidden = false; requestAnimationFrame(function(){ el.classList.add('on'); }); document.body.classList.add('lb-open');
      show(i || 0); el.querySelector('.lb-x').focus({preventScroll: true});
    }
    function close(){
      if (!el || el.hidden) return; el.classList.remove('on'); document.body.classList.remove('lb-open');
      setTimeout(function(){ el.hidden = true; img.removeAttribute('src'); }, 260);
      if (opener && opener.focus) opener.focus({preventScroll: true});
    }
    // capture phase: runs before the map's own keys (Esc would otherwise close the whole map)
    window.addEventListener('keydown', function(ev){
      if (!el || el.hidden) return;
      if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopImmediatePropagation(); close(); }
      else if (ev.key === 'ArrowRight'){ ev.preventDefault(); ev.stopImmediatePropagation(); show(idx + 1); }
      else if (ev.key === 'ArrowLeft'){ ev.preventDefault(); ev.stopImmediatePropagation(); show(idx - 1); }
    }, true);
    return {open: open, close: close, isOpen: function(){ return !!el && !el.hidden; }};
  })();
  // arrow keys flip the panel photos while a multi-photo panel is open (the map pans by drag / wheel)
  window.addEventListener('keydown', function(ev){
    if (!isOpen || PLB.isOpen() || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
    var tg0 = ev.target; if (tg0 && (tg0.tagName === 'INPUT' || tg0.tagName === 'TEXTAREA' || tg0.isContentEditable)) return;
    var U3 = window.__ulv; if (U3 && U3.TagCard && U3.TagCard.isOpen && U3.TagCard.isOpen()) return;
    var m = galMedia(); if (!m) return; ev.preventDefault(); ev.stopImmediatePropagation(); galGo(m, +m.dataset.i + (ev.key === 'ArrowRight' ? 1 : -1));
  }, true);
  plc.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
  plc.addEventListener('wheel', function(ev){ ev.stopPropagation(); }, {passive: true});
  plc.addEventListener('click', function(ev){
    if (ev.target.closest('.mpl-x')) return closePanel();
    var m = ev.target.closest('.mpl-media');
    if (m){ if (galSwiped){ galSwiped = false; return; }
      var nb = ev.target.closest('.mpl-nav'); if (nb) return galGo(m, +m.dataset.i + (nb.classList.contains('next') ? 1 : -1));
      var dt0 = ev.target.closest('[data-di]'); if (dt0) return galGo(m, +dt0.dataset.di);
      if (ev.target.closest('.mpl-zoom') || ev.target.closest('.slide')) return PLB.open(galPh, +m.dataset.i, galTitle, ev.target.closest('button') || m); }
    var g = ev.target.closest('[data-go]'); if (g) return goCard(+g.dataset.go);
    var t = ev.target.closest('[data-tag]'); if (t){ var tc = TC(); if (tc) tc.open(t.dataset.tt, t.dataset.tag, t); return; }
    var pl = ev.target.closest('[data-pl]'); if (pl){ var p = placeById(pl.dataset.pl); if (p){ var o = placeEls.filter(function(x){ return x.p === p; })[0]; showPlace(p, o && o.el); } }
  });
  // tag card opened from the map: its own "jump to event" buttons must close the map first
  document.addEventListener('click', function(ev){ if (isOpen && ev.target.closest && ev.target.closest('.tc [data-go]')){ closePanel(); close(); } }, true);


  // ---------------------------------------------------------------- route tool
  function km(px){ return px * (CFG ? CFG.kmPerPixel : 0.5); }
  function fmtKm(k){ return k < 10 ? k.toFixed(1).replace('.', ',') + ' km' : Math.round(k).toLocaleString('tr-TR') + ' km'; }
  function fmtDays(d){
    if (d <= 0) return '—';
    if (d < 1){ var h = Math.max(1, Math.round(d * 24)); return h + ' saat'; }   // speeds are per day of travel
    return (d < 10 ? (Math.round(d * 10) / 10).toString().replace('.', ',') : Math.round(d)) + ' gün';
  }
  // flying steam airship (Aetherion Magnus class): straight line, ~AIR_KMH cruising, AIR_HPD flight hours per day (estimate; no figure in the archive)
  function fmtAir(k){ var v = CFG.airshipKmh || 60, hpd = CFG.airshipHoursPerDay || 18, h = k / v; if (h < 1) return Math.max(5, Math.round(h * 12) * 5) + ' dk'; if (h <= hpd) return (h < 10 ? (Math.round(h * 2) / 2).toString().replace('.', ',') : Math.round(h)) + ' saat'; return fmtDays(h / hpd); }
  function segLen(a, b){ return Math.hypot(b.x - a.x, b.y - a.y); }
  function totalPx(){ var t = 0; for (var i = 1; i < route.length; i++) t += segLen(route[i - 1], route[i]); return t; }
  function updateReadout(){
    var k = km(totalPx());
    rt.querySelector('.rt-km').textContent = route.length > 1 ? fmtKm(k) : '—';
    rt.querySelector('.rt-walk').textContent = route.length > 1 ? fmtDays(k / (CFG.walkKmPerDay || 30)) : '—';
    rt.querySelector('.rt-horse').textContent = route.length > 1 ? fmtDays(k / (CFG.horseKmPerDay || 60)) : '—';
    rt.querySelector('.rt-cart').textContent = route.length > 1 ? fmtDays(k / (CFG.cartKmPerDay || 25)) : '—';
    rt.querySelector('.rt-air').textContent = route.length > 1 ? fmtAir(k) : '—';
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

  // ---------------------------------------------------------------- journey planner: named places -> shortest path on the road network (Dijkstra)
  var planEl = ov.querySelector('.mapx-plan'), planStops = planEl.querySelector('.pl-stops'), planOut = planEl.querySelector('.pl-out');
  var pGlow = svg.querySelector('.p-glow'), pInk = svg.querySelector('.p-ink'), pSea = svg.querySelector('.p-sea'), pNodes = svg.querySelector('.p-nodes');
  plan = {open: false, road: [], sea: [], stops: []};
  function planPlaces(){ return PLACES.filter(function(p){ return p.rank !== 'hidden'; }); }
  function buildPlanList(){
    var dl = planEl.querySelector('datalist'); dl.innerHTML = planPlaces().map(function(p){ return '<option value="' + esc(p.name) + '"></option>'; }).join('');
    planStops.innerHTML = ''; addStop(); addStop();
  }
  function addStop(val){
    var n = planStops.children.length; if (n >= 6) return;
    var row = document.createElement('div'); row.className = 'pl-row';
    row.innerHTML = '<span class="pl-n">' + String.fromCharCode(65 + n) + '</span><input type="search" list="mapxPlaces" placeholder="Yer ara…" autocomplete="off" spellcheck="false" aria-label="Durak ' + (n + 1) + '"><button type="button" class="pl-rm" aria-label="Durağı kaldır">×</button>';
    if (val) row.querySelector('input').value = val;
    planStops.appendChild(row); relabel();
  }
  function relabel(){ Array.prototype.forEach.call(planStops.children, function(r, i){ r.querySelector('.pl-n').textContent = String.fromCharCode(65 + i); r.querySelector('.pl-rm').hidden = planStops.children.length <= 2; }); }
  function norm(t){ return String(t || '').toLocaleLowerCase('tr-TR').replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim(); }
  function placeByName(t){ var q = norm(t); if (!q) return null; var L = planPlaces(), i;
    for (i = 0; i < L.length; i++) if (norm(L[i].name) === q) return L[i];
    for (i = 0; i < L.length; i++) if (norm(L[i].name).indexOf(q) === 0) return L[i];
    return null; }
  function nearNode(p){
    var N = NETD.nodes, best = -1, bd = 1e9;
    for (var i = 0; i < N.length; i++){ if (N[i][3] && norm(N[i][3]) === norm(p.name)) return {i: i, d: 0}; var d = Math.hypot(N[i][0] - p.x, N[i][1] - p.y); if (d < bd){ bd = d; best = i; } }
    return {i: best, d: bd};
  }
  function dijkstra(a, b){
    var N = NETD.nodes.length, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), via = new Array(N).fill(null), done = new Array(N).fill(false);
    dist[a] = 0;
    for (;;){ var u = -1, bd = Infinity; for (var i = 0; i < N; i++) if (!done[i] && dist[i] < bd){ bd = dist[i]; u = i; }
      if (u < 0 || u === b) break; done[u] = true;
      NETD.edges.forEach(function(e){ if (e.a !== u && e.b !== u) return; var v = e.a === u ? e.b : e.a, nd = dist[u] + e.len; if (nd < dist[v]){ dist[v] = nd; prev[v] = u; via[v] = e; } }); }
    if (!isFinite(dist[b])) return null;
    var pts = [], v = b; while (v !== a){ var e = via[v], q = e.b === v ? e.p.slice() : e.p.slice().reverse(); pts = pts.length ? q.concat(pts.slice(1)) : q; v = prev[v]; }
    return {len: dist[b], pts: pts};
  }
  function computePlan(){
    var st = Array.prototype.map.call(planStops.querySelectorAll('input'), function(i){ var p = placeByName(i.value); i.classList.toggle('bad', !!i.value && !p); return p; }).filter(Boolean);
    plan.road = []; plan.sea = []; plan.stops = st;
    if (st.length < 2 || !NETD){ planOut.innerHTML = st.length < 2 ? '<p class="pl-hint">En az iki yer seç; en kısa yol yol ağı üzerinden çizilir.</p>' : ''; drawPlan(); return; }
    var roadPx = 0, seaPx = 0, airPx = 0, notes = [];
    for (var i = 1; i < st.length; i++){
      var A = st[i - 1], B = st[i]; airPx += Math.hypot(B.x - A.x, B.y - A.y);
      var na = nearNode(A), nb = nearNode(B), r = (na.d < 380 && nb.d < 380) ? dijkstra(na.i, nb.i) : null;
      if (r){ var P = r.pts.slice(); if (na.d > 30){ P.unshift([A.x, A.y]); roadPx += na.d; } if (nb.d > 30){ P.push([B.x, B.y]); roadPx += nb.d; }
        roadPx += r.len; plan.road.push(P); if (na.d > 60 || nb.d > 60) notes.push(A.name + ' / ' + B.name + ': yola kadar patika (düz hat)'); }
      else { var d = Math.hypot(B.x - A.x, B.y - A.y); seaPx += d; plan.sea.push([[A.x, A.y], [B.x, B.y]]); notes.push(A.name + ' → ' + B.name + ': yol bağlantısı yok, deniz yolu / düz hat sayıldı'); }
    }
    var rk = km(roadPx), sk = km(seaPx), ak = km(airPx), seaDay = CFG.shipKmPerDay || 120;
    function t(v){ return fmtDays(rk / v + sk / seaDay); }
    planOut.innerHTML = '<div class="pl-km"><b>' + fmtKm(rk + sk) + '</b>' + (sk ? ' <small>(' + fmtKm(rk) + ' kara · ' + fmtKm(sk) + ' deniz)</small>' : ' <small>yol ağı üzerinden</small>') + '</div>' +
      '<dl class="pl-t"><dt>Yaya</dt><dd>' + t(CFG.walkKmPerDay || 30) + '</dd><dt>Atlı</dt><dd>' + t(CFG.horseKmPerDay || 60) + '</dd><dt>Araba · kervan</dt><dd>' + t(CFG.cartKmPerDay || 25) + '</dd>' +
      '<dt>Hava gemisi</dt><dd>' + fmtAir(ak) + ' <small>(düz uçuş ' + fmtKm(ak) + ')</small></dd></dl>' +
      (notes.length ? '<ul class="pl-notes">' + notes.map(function(n){ return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="pl-fine">Hızlar tahmini: yaya ' + (CFG.walkKmPerDay || 30) + ', atlı ' + (CFG.horseKmPerDay || 60) + ', kervan ' + (CFG.cartKmPerDay || 25) + ' km/gün' + (sk ? ', gemi ' + seaDay + ' km/gün' : '') + '; Aetherion Magnus tipi buharlı hava gemisi ~' + (CFG.airshipKmh || 60) + ' km/sa, günde ~' + (CFG.airshipHoursPerDay || 18) + ' saat uçuş.</p>';
    drawPlan(); fitPlan();
  }
  function fitPlan(){
    var all = [].concat.apply([], plan.road.concat(plan.sea)); if (!all.length) return;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; all.forEach(function(q){ x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
    var pr = planEl.getBoundingClientRect(), sr = stage.getBoundingClientRect(); planW = Math.max(0, pr.right - sr.left + 20); var padL = vw > 700 ? Math.max(60, pr.right - sr.left + 40) : 30, padB = vw > 700 ? 40 : Math.min(vh * .6, Math.max(vh * .3, sr.bottom - pr.top + 20));
    var ns = Math.max(minS, Math.min(maxS * .5, Math.min((vw - padL - 60) / Math.max(1, x1 - x0), (vh - padB - 80) / Math.max(1, y1 - y0))));
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; view.s = ns; view.x = padL + (vw - padL) / 2 - cx * ns; view.y = (vh - padB) / 2 + 20 - cy * ns; clampView(); dirty = true; kick();
  }
  function pathD(P){ return P.map(function(q, i){ var o = toScreen(q[0], q[1]); return (i ? 'L' : 'M') + o.x.toFixed(1) + ' ' + o.y.toFixed(1); }).join(''); }
  function drawPlan(){
    if (!plan) return;
    var d = plan.road.map(pathD).join(''), ds = plan.sea.map(pathD).join('');
    pGlow.setAttribute('d', d); pInk.setAttribute('d', d); pSea.setAttribute('d', ds);
    while (pNodes.childNodes.length > plan.stops.length) pNodes.removeChild(pNodes.lastChild);
    while (pNodes.childNodes.length < plan.stops.length){ var g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'p-node'); g.innerHTML = '<circle r="9"/><text dy="3.6"></text>'; pNodes.appendChild(g); }
    plan.stops.forEach(function(p, i){ var o = toScreen(p.x, p.y), g = pNodes.childNodes[i]; g.setAttribute('transform', 'translate(' + o.x.toFixed(1) + ' ' + o.y.toFixed(1) + ')'); g.lastChild.textContent = String.fromCharCode(65 + i); });
  }
  function togglePlan(on){
    plan.open = on == null ? !plan.open : !!on; planEl.hidden = !plan.open;
    var b = ov.querySelector('.mt-plan'); b.classList.toggle('on', plan.open); b.setAttribute('aria-pressed', plan.open ? 'true' : 'false');
    if (plan.open){ if (tool === 'route') setTool('nav'); closePanel(); var f = planStops.querySelector('input'); if (f && !f.value) setTimeout(function(){ f.focus(); }, 30); computePlan(); }
    else { plan.road = []; plan.sea = []; plan.stops = []; drawPlan(); clampView(); dirty = true; kick(); }
  }
  planEl.addEventListener('input', function(ev){ if (ev.target.tagName === 'INPUT') computePlan(); });
  planEl.addEventListener('change', function(ev){ if (ev.target.tagName === 'INPUT') computePlan(); });
  planEl.addEventListener('click', function(ev){
    if (ev.target.closest('.pl-x')) togglePlan(false);
    else if (ev.target.closest('.pl-add')){ addStop(); var ins = planStops.querySelectorAll('input'); ins[ins.length - 1].focus(); }
    else if (ev.target.closest('.pl-rm')){ ev.target.closest('.pl-row').remove(); relabel(); computePlan(); }
  });
  ['pointerdown', 'wheel', 'touchmove'].forEach(function(t){ planEl.addEventListener(t, function(ev){ ev.stopPropagation(); }, {passive: true}); });

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
  ov.addEventListener('touchmove', function(ev){ if (!ev.target.closest('.mapx-pop, .mt-volpop')) ev.preventDefault(); }, {passive: false});
  ov.addEventListener('pointerdown', function(ev){ if (ev.target === ov) close(); });

  ov.querySelector('.mapx-tools').addEventListener('click', function(ev){
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.tool) setTool(b.dataset.tool);
    else if (b.classList.contains('mt-in')) smoothZoom((anim ? anim.s : view.s) * 1.6, vw / 2, vh / 2);
    else if (b.classList.contains('mt-out')) smoothZoom((anim ? anim.s : view.s) / 1.6, vw / 2, vh / 2);
    else if (b.classList.contains('mt-fit')) smoothZoom(fitScale(), vw / 2, vh / 2);
    else if (b.classList.contains('mt-cloud')){ cloudsOn = !cloudsOn; try { localStorage.setItem('ulv-map-clouds', cloudsOn ? '1' : '0'); } catch(e){} syncToggles(); kick(); }
    else if (b.classList.contains('mt-snd')){ if (window.__ulvMapAudio){ window.__ulvMapAudio.setOn(!window.__ulvMapAudio.isOn()); } syncToggles(); }
    else if (b.classList.contains('mt-dn')){ DN.setRun(!DN.run); syncToggles(); kick(); }
    else if (b.classList.contains('mt-roads')){ roadsOn = !roadsOn; try { localStorage.setItem('ulv-map-roads', roadsOn ? '1' : '0'); } catch(e){} syncToggles(); dirty = true; kick(); }
    else if (b.classList.contains('mt-wx')){ wxOn = !wxOn; try { localStorage.setItem('ulv-map-wx', wxOn ? '1' : '0'); } catch(e){} syncToggles(); kick(); }
    else if (b.classList.contains('mt-plan')){ togglePlan(); }
    else if (b.classList.contains('mt-edit')){ PE.toggle(); }
    else if (b.classList.contains('mt-pins')){ pinsOn = !pinsOn; try { localStorage.setItem('ulv-map-pins', pinsOn ? '1' : '0'); } catch(e){} pinsLayer.classList.toggle('off', !pinsOn); syncToggles(); dirty = true; kick(); }
  });
  function syncToggles(){
    var cb = ov.querySelector('.mt-cloud'), sb = ov.querySelector('.mt-snd'), so = !!(window.__ulvMapAudio && window.__ulvMapAudio.isOn());
    var db = ov.querySelector('.mt-dn'), pb = ov.querySelector('.mt-pins');
    db.classList.toggle('is-off', !DN.run); db.setAttribute('aria-pressed', DN.run ? 'true' : 'false'); db.title = DN.run ? 'Gece/gündüz döngüsünü durdur (gündüze sabitle)' : 'Gece/gündüz döngüsünü başlat';
    pb.classList.toggle('is-off', !pinsOn); pb.setAttribute('aria-pressed', pinsOn ? 'true' : 'false'); pb.title = pinsOn ? 'Tarihî olay iğnelerini gizle' : 'Tarihî olay iğnelerini göster';
    [['.mt-roads', roadsOn, 'Yolları gizle', 'Yolları göster'], ['.mt-wx', wxOn, 'Hava olaylarını kapat (fırtına, yağmur, hortum, kum fırtınası, kar)', 'Hava olaylarını aç (fırtına, yağmur, hortum, kum fırtınası, kar)']].forEach(function(a){
      var e = ov.querySelector(a[0]); e.classList.toggle('is-off', !a[1]); e.setAttribute('aria-pressed', a[1] ? 'true' : 'false'); e.title = a[1] ? a[2] : a[3]; });
    cb.classList.toggle('is-off', !cloudsOn); cb.setAttribute('aria-pressed', cloudsOn ? 'true' : 'false'); cb.title = cloudsOn ? 'Bulutları gizle (fırtına bulutları, yağmur, hortumlar ve kum fırtınası da kapanır)' : 'Bulutları göster';
    sb.classList.toggle('is-off', !so); sb.setAttribute('aria-pressed', so ? 'true' : 'false'); sb.title = so ? 'Harita seslerini kapat' : 'Harita seslerini aç';
    if (!window.__ulvMapAudio) sb.parentNode.hidden = true;
    else { var vv = window.__ulvMapAudio.getVol(), vr = ov.querySelector('.mt-vol'); vr.value = vv; vr.style.setProperty('--v', vv + '%'); ov.querySelector('.mt-volv').textContent = vv; }
  }
  (function(){   // volume slider: slides out on hover/focus; on touch a long-press on the sound button opens it (tap still mutes)
    var wrap = ov.querySelector('.mt-sndwrap'), sb = wrap.querySelector('.mt-snd'), vr = wrap.querySelector('.mt-vol'), lpT = 0, lpFired = false, hideT = 0;
    vr.addEventListener('input', function(){ if (!window.__ulvMapAudio) return; var v = +vr.value; window.__ulvMapAudio.setVol(v);
      if (v > 0 && !window.__ulvMapAudio.isOn()) window.__ulvMapAudio.setOn(true); syncToggles(); });
    function show(){ clearTimeout(hideT); wrap.classList.add('show'); hideT = setTimeout(function(){ if (!wrap.matches(':hover') && !wrap.contains(document.activeElement)) wrap.classList.remove('show'); }, 4000); }
    sb.addEventListener('pointerdown', function(ev){ if (ev.pointerType === 'mouse') return; lpFired = false; clearTimeout(lpT); lpT = setTimeout(function(){ lpFired = true; show(); }, 450); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(t){ sb.addEventListener(t, function(){ clearTimeout(lpT); }); });
    sb.addEventListener('click', function(ev){ if (lpFired){ lpFired = false; ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
    sb.addEventListener('contextmenu', function(ev){ ev.preventDefault(); });
    vr.addEventListener('pointerdown', function(){ clearTimeout(hideT); });
    vr.addEventListener('change', function(){ if (wrap.classList.contains('show')) show(); });
    ov.addEventListener('pointerdown', function(ev){ if (!wrap.contains(ev.target)) wrap.classList.remove('show'); });
  })();
  rt.querySelector('.rt-undo').addEventListener('click', undo);
  rt.querySelector('.rt-clear').addEventListener('click', clearRoute);
  ov.querySelector('.mapx-x').addEventListener('click', function(){ close(); });

  document.addEventListener('keydown', function(ev){
    if (!isOpen) return;
    var k = ev.key, tgt = ev.target, typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
    if (typing){ if (k === 'Escape' && plan && plan.open && planEl.contains(tgt) && !tgt.value){ ev.preventDefault(); tgt.blur(); togglePlan(false); } return; }   // in the planner: 1st Esc clears the field, 2nd closes
    var U2 = window.__ulv; if (U2 && ((U2.TagCard && U2.TagCard.isOpen && U2.TagCard.isOpen()) || document.querySelector('.lb:not([hidden])'))) return;  // a card opened on top of the map handles its own keys
    if (k === 'Escape'){ ev.preventDefault(); ev.stopImmediatePropagation(); if (!pop.hidden) pop.hidden = true; else if (!plc.hidden) closePanel(); else if (plan && plan.open) togglePlan(false); else close(); return; }
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
  var frameErr = {};
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
    DN.step(t / 1000);
    var animFx = FXL.ok && !reduce, period = lite() ? 33 : 0;
    var DBG = window.__ulvMapDbg || 0;
    if (FXL.ok && !DBG.nofx && (t - fxLast >= period || reduce || moved)){ fxLast = t; try { FXL.draw(t / 1000); } catch (e){ if (!frameErr.fx){ frameErr.fx = 1; console.error('[map] fx draw failed:', e); } } }
    if (loaded && !reduce && !DBG.nolife && (t - lifeLast >= period || moved)){ lifeLast = t; try { LIFE.draw(t / 1000); } catch (e){ if (!frameErr.life){ frameErr.life = 1; console.error('[map] life draw failed:', e); } } }
    if (loaded && window.__ulvMapAudio && t - sndLast > 250){ sndLast = t; var cw0 = toWorld(vw / 2, vh / 2), pr = LIFE.probe(cw0.x, cw0.y); pr.zf = LIFE.zoomF(); pr.night = DN.v.night; pr.storm = Math.max(STORM.near(cw0.x, cw0.y), (pr.torn || 0) * .7); pr.desert = Math.max(pr.desert || 0, STORM.nearSand(cw0.x, cw0.y));
      pr.snow = wxOn ? Math.max(1 - lin(560, 980, cw0.y), 1 - lin(260, 520, Math.hypot(cw0.x - 2290, (cw0.y - 700) * 1.5))) : 0; window.__ulvMapAudio.update(pr); }
    // auto light: sustained < 32fps while open
    if (!lite() && animFx){ fpsAcc += dt; fpsN++; if (fpsAcc > 2000){ var fps = fpsN * 1000 / fpsAcc; slow = fps < 32 ? slow + 1 : 0; if (slow >= 2 && !noAuto){ autoLite = true; FXL.resize(); } fpsAcc = 0; fpsN = 0; } }
    if (animFx || loaded || anim || inertia || dirty) kick();
  }


  // ---------------------------------------------------------------- life layer (Canvas2D, between map and atmosphere)
  // whirlpool, ships/fleets on coastal sea lanes, caravans on roads, chimney smoke, ember glow, bird flocks.
  // Disabled under reduced motion; Light mode = fewer of everything.
  var LIFE = (function(){
    var cv = ov.querySelector('.mapx-life'), c = cv.getContext('2d'), cvN = ov.querySelector('.mapx-night');
    var land = null, field = null, landPts = [], roadsA = [], lanes = [], wp = null, wpIn = null, DATA = {smoke: [], settlements: []};
    var cars = [], flocks = [], ships = [], nextFlock = 1, lastT = 0, ready = false;
    var WP = {x: 4503, y: 1380, r: 132, sq: 0.68};
    // sound landmarks: forges (the smithy glows; the lair and southern volcano are lava, not forges), waterfalls, temple, harbours
    var FORGES = [[2330,855],[2511,930],[2222,984],[2319,1026],[2212,1219]], FALLS = [[1440,2010],[1720,420]], TEMPLES = [[3150,4044]], PORTS = [], BLAV = [[680,1460]];
    var GLOW = [[2233,440,70],[2330,855,34],[2511,930,30],[2222,984,30],[2319,1026,32],[2212,1219,30],[2914,4484,60]];
    function rnd(a, b){ return a + Math.random() * (b - a); }
    function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
    function sstep(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function imgData(src, cb){ var m = new Image(); m.onload = function(){ var t = document.createElement('canvas'); t.width = m.width; t.height = m.height; var x = t.getContext('2d'); x.drawImage(m, 0, 0); cb(x.getImageData(0, 0, m.width, m.height).data, m.width, m.height); }; m.src = src; }
    function init(autoRoads, seaLanes, life, net){
      roadsA = autoRoads || []; setNet(net); DATA = life || DATA; if (!DATA.smoke) DATA.smoke = []; if (!DATA.settlements) DATA.settlements = [];
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
      getJSON('searoutes.json').then(setRoutes).catch(function(){ routesReady = true; });
      makeSmokeSprites(); loadLights(); ready = true;
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
    // ---- follow-the-leader trains: the head drops a world-space breadcrumb every HS px; every wagon / rank behind it is
    // placed at a fixed arc length back along that trail, so the column turns at each bend in sequence (also across junctions).
    var HS = 3, HC = 170, UP = {x: 0, y: 0, a: 0, v: false};
    function atK(k, d){   // at() with a cached segment index (heads only move forward)
      var L = k.L, i = k._i || 1; if (i >= L.length || L[i - 1] > d) i = 1;
      while (i < L.length - 1 && L[i] < d) i++; k._i = i;
      var a = k.p[i - 1], b = k.p[i], f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); f = f < 0 ? 0 : f > 1 ? 1 : f;
      UP.x = a.x + (b.x - a.x) * f; UP.y = a.y + (b.y - a.y) * f; UP.a = Math.atan2(b.y - a.y, b.x - a.x); return UP;
    }
    function hPush(k, x, y){ k.hi = (k.hi + 1) % HC; k.hx[k.hi] = x; k.hy[k.hi] = y; if (k.hn < HC) k.hn++; }
    function hInit(k){   // breadcrumbs behind the spawn point (along the current road, clamped at its start)
      k.hx = new Float32Array(HC); k.hy = new Float32Array(HC); k.hn = 0; k.hi = -1; k._i = 1;
      var back = Math.min(HC - 2, Math.floor(Math.max(0, k.d) / HS));
      for (var j = back; j >= 0; j--){ var q = at(k, Math.max(0, k.d - j * HS)); hPush(k, q.x, q.y); }
      k.trav = k.gate ? 0 : Math.max(0, k.d);
    }
    function hStep(k, dd){
      var q = atK(k, Math.min(k.d, k.tot)); k.hdx = q.x; k.hdy = q.y; k.hda = q.a; k.trav += dd;
      var lx = k.hx[k.hi], ly = k.hy[k.hi]; if ((q.x - lx) * (q.x - lx) + (q.y - ly) * (q.y - ly) >= HS * HS) hPush(k, q.x, q.y);
    }
    // world position + heading of the unit o px behind the head (UP.v = false when that part of the column has not left the gate yet)
    function unitAt(k, o){
      var hx = k.hdx, hy = k.hdy, lx = k.hx[k.hi], ly = k.hy[k.hi], hd = Math.hypot(hx - lx, hy - ly);
      UP.v = o <= k.trav + .5;
      if (o <= hd || k.hn < 2){ var f = hd ? o / hd : 0; if (f > 1) f = 1; UP.x = hx + (lx - hx) * f; UP.y = hy + (ly - hy) * f; UP.a = hd > .01 ? Math.atan2(hy - ly, hx - lx) : k.hda; return UP; }
      var r = (o - hd) / HS, i0 = Math.floor(r), fr = r - i0;
      if (i0 >= k.hn - 1){ i0 = k.hn - 2; fr = 1; }
      var j0 = (k.hi - i0 + HC) % HC, j1 = (j0 - 1 + HC) % HC;
      var ax = k.hx[j0], ay = k.hy[j0], bx = k.hx[j1], by = k.hy[j1];
      UP.x = ax + (bx - ax) * fr; UP.y = ay + (by - ay) * fr; UP.a = Math.atan2(ay - by, ax - bx); return UP;
    }
    // ---- caravans on the road network (roadnet.json: royal roads / trade routes / side roads between named places & villages)
    // carts & wagons, lone riders, rare army columns with banners; city-to-city journeys chained across junctions; anti-overlap queueing.
    var NET = null, netEdges = [], netAdj = {};
    function setNet(n){
      NET = n && n.edges && n.edges.length ? n : null; netEdges = []; netAdj = {};
      if (!NET){   // fallback: hand-traced painted roads as standalone edges
        roads().forEach(function(rd){ var p = rd.points; netEdges.push(geoEdge(p, -1, -1, (+rd.w || 1) > 1 ? 1 : 2)); });
        return;
      }
      NET.edges.forEach(function(e){ var g = geoEdge(e.p, e.a, e.b, e.t, e.tr); netEdges.push(g); (netAdj[e.a] = netAdj[e.a] || []).push(g); (netAdj[e.b] = netAdj[e.b] || []).push(g); });
    }
    function geoEdge(pts, a, b, t, tr){   // tr: traffic weight from roadnet.json (thins out over-busy corridors)
      var p = pts.map(function(q){ return {x: q[0], y: q[1]}; }), L = [0];
      for (var i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
      var rp = p.slice().reverse(), RL = [0]; for (i = 1; i < rp.length; i++) RL.push(RL[i - 1] + Math.hypot(rp[i].x - rp[i - 1].x, rp[i].y - rp[i - 1].y));
      tr = tr == null ? 1 : +tr;
      return {p: p, L: L, rp: rp, RL: RL, tot: L[L.length - 1], a: a, b: b, t: t, w: (t === 0 ? 2.4 : t === 1 ? 1.7 : 1) * tr, tr: tr, n: 0};
    }
    function roadGeo(){ return netEdges; }
    function edgeCap(g){ return Math.max(g.tr < 1 ? 1 : 2, Math.floor(g.tot / 110 * (g.t === 0 ? 1.3 : 1) * Math.min(1, g.tr))); }
    var KINDS = ['wagon', 'ox', 'merchant', 'rider', 'army'], armies = 0;
    function pickKind(g){
      var r = Math.random();
      if (g.t < 2 && armies < (lite() ? 1 : 3) && r < .035) return 'army';
      r = Math.random(); return r < .22 ? 'rider' : r < .52 ? 'wagon' : r < .74 ? 'merchant' : 'ox';
    }
    function carOnEdge(k, g, rev, d){
      k.g = g; k.rev = rev; k.p = rev ? g.rp : g.p; k.L = rev ? g.RL : g.L; k.tot = g.tot; k.d = d; k.to = rev ? g.a : g.b;
      k.cont = (netAdj[k.to] || []).length > 1 && (k.hops || 0) < 5 && Math.random() > .28;   // decided up front so the fade-out is known
    }
    function newCar(stagger){
      var G = netEdges; if (!G.length) return null;
      var sum = 0, i; for (i = 0; i < G.length; i++) sum += Math.sqrt(G[i].tot) * G[i].w;
      for (var tries = 0; tries < 12; tries++){
        var r = Math.random() * sum, g = G[0]; for (i = 0; i < G.length; i++){ r -= Math.sqrt(G[i].tot) * G[i].w; if (r <= 0){ g = G[i]; break; } }
        if (g.n >= edgeCap(g) && tries < 11) continue;
        var gate = !stagger && Math.random() < .5, rev = Math.random() < .5, d = gate ? 0 : rnd(0, g.tot * .85), ok = true;
        for (var j = 0; j < cars.length; j++){ var o = cars[j]; if (o && o.g === g && Math.abs((o.rev === rev ? o.d : o.tot - o.d) - d) < 55 + (o.clen || 0)){ ok = false; break; } }
        if (!ok && tries < 11) continue;
        var kind = pickKind(g), k = {kind: kind, d0: 0, gate: gate || !stagger, trail: [], tAcc: 0, size: rnd(.88, 1.15), hops: 0,
          v: rnd(5, 8.5) * (g.t < 2 ? 1 : .85), carts: 1, hue: (Math.random() * 4) | 0, ph: rnd(0, 9)};
        if (kind === 'rider') k.v *= 1.9;
        else if (kind === 'army'){ k.v *= .62; k.n = 12 + ((Math.random() * 14) | 0); armies++; k.ranks = armyRanks(k.n); k.clen = k.ranks.length * 7; }
        else k.carts = Math.random() < .4 ? 2 + (Math.random() < .3 ? 1 : 0) : 1;
        if (!k.clen) k.clen = k.carts * 9;
        carOnEdge(k, g, rev, d); k.d0 = stagger ? d - 50 : d; g.n++; hInit(k);
        return k;
      }
      return null;
    }
    function retire(k){ if (k.g) k.g.n = Math.max(0, k.g.n - 1); if (k.kind === 'army') armies = Math.max(0, armies - 1); }
    function nextHop(k){   // arrived at a junction / settlement: continue the journey on another road, or end here
      if (!k.cont) return false;
      var opts = (netAdj[k.to] || []).filter(function(g){ return g !== k.g && g.n < edgeCap(g); });
      if (!opts.length) opts = (netAdj[k.to] || []).filter(function(g){ return g !== k.g; });
      if (!opts.length) return false;
      var sum = 0; opts.forEach(function(g){ sum += g.w; }); var r = Math.random() * sum, g = opts[0];
      for (var i = 0; i < opts.length; i++){ r -= opts[i].w; if (r <= 0){ g = opts[i]; break; } }
      k.g.n = Math.max(0, k.g.n - 1); var rev = g.b === k.to; k.hops++; carOnEdge(k, g, rev, 0); g.n++; k.d0 = -1e9; return true;
    }
    function stepCars(dt, lt){
      var want = lt ? 45 : 160, guard = 0;
      while (cars.length < want && guard++ < want){ var n = newCar(true); if (!n) break; cars.push(n); }
      while (cars.length > want){ retire(cars.pop()); }
      for (var i = 0; i < cars.length; i++){
        var k = cars[i], sp = k.v;
        for (var j = 0; j < cars.length; j++){ var o = cars[j]; if (o !== k && o.g === k.g && o.rev === k.rev){ var gap = o.d - k.d, need = 26 + o.clen; if (gap > 0 && gap < need + 16) sp = Math.min(sp, o.v * (gap < need ? .45 : 1)); } }
        k.d += sp * dt; k.tAcc += dt; hStep(k, sp * dt);
        if (k.tAcc > .5){ k.tAcc = 0; var q = at(k, k.d); k.trail.push({x: q.x, y: q.y}); if (k.trail.length > 14) k.trail.shift(); }
        if (k.d >= k.tot && !nextHop(k)){ retire(k); var r = newCar(false); if (r) cars[i] = r; else { cars.splice(i, 1); i--; } }
      }
    }
    var CART = [['#e9dfc6', '#6b4a28'], ['#c9b48a', '#5a3a1e'], ['#a83a2a', '#4a2c16'], ['#2f5a8a', '#3d2a18']], BAN = ['#b3262a', '#d9a62e', '#2c5aa0', '#1f6b3a'];
    // per-unit spacing in WORLD px (sprites are zoom-clamped in screen px, so the spacing follows the drawn size)
    function drawCars(t, nightV){
      var s = view.s, sz = clamp(19.5 * s, 3.5, 12), lamps = nightV > .02, dots = new Path2D(), trails = new Path2D();
      ARM.n = 0;
      for (var i = 0; i < cars.length; i++){
        var k = cars[i], fin = k.d0 > -1e8 ? Math.min(1, (k.d - k.d0) / (k.gate ? 14 : 45)) : 1, fade = Math.min(fin, k.cont ? 1 : (k.tot - k.d) / 18); if (fade <= 0 || !k.hx) continue;
        var P = toScreen(k.hdx, k.hdy); if (!vis(P, 60 + k.clen * s * 2)) continue;
        var z = sz * k.size, off = sz * .45, far = z < 3.6;
        if (k.kind === 'army' && !far){ queueArmy(k, z, s, off, fade, t, lamps); continue; }
        var nn = k.kind === 'rider' ? 1 : k.kind === 'army' ? 3 : k.carts, sp = (far ? z * 1.2 : z * 1.75) / s;
        if (!far && k.trail.length > 2 && k.kind !== 'rider'){   // dust track: one path per caravan
          var A0 = toScreen(k.trail[0].x, k.trail[0].y); trails.moveTo(A0.x, A0.y);
          for (var j = 1; j < k.trail.length; j++){ var B0 = toScreen(k.trail[j].x, k.trail[j].y); trails.lineTo(B0.x, B0.y); }
          trails.lineTo(P.x, P.y);
        }
        for (var m = 0; m < nn; m++){
          var u = unitAt(k, m * sp); if (!u.v) break;
          var ua = u.a, cu = Math.cos(ua), su = Math.sin(ua), X = (u.x * s + view.x) - su * off, Y = (u.y * s + view.y) + cu * off;
          if (far){ var rr = z * (m ? .42 : .52) * (k.kind === 'army' ? .8 : 1); dots.moveTo(X + rr, Y); dots.arc(X, Y, rr, 0, 6.283); }
          else {   // cached sprite per kind/colour/size, one drawImage per wagon, each turned to its own heading
            var o = carSprite(k, z), sc = z / o.zq, ca1 = cu * sc * dpr, sa1 = su * sc * dpr;
            c.setTransform(ca1, sa1, -sa1, ca1, X * dpr, Y * dpr); c.globalAlpha = .92 * fade; c.drawImage(o.cv, o.x0, o.y0, o.w, o.h);
          }
          if (lamps) unitLamp(k, X, Y, cu, su, z, fade, m, far);
        }
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = 1;
      c.fillStyle = 'rgba(29,20,12,.88)'; c.fill(dots);
      c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = Math.max(.9, sz * .45); c.strokeStyle = 'rgba(70,52,30,.09)'; c.stroke(trails);
      drawArmies(t, lamps);
    }
    // lanterns: EVERY wagon carries one (merchants/odd wagons a second one at the tail), riders one; each casts a small warm pool.
    // Far away the pools are dimmed (many overlapping pools would read as glowing roads); the abandoned south only dimmer.
    function unitLamp(k, X, Y, ca, sa, z, fade, m, far){
      var la = fade * (.45 + .55 * Math.min(1, Math.max(0, (z - 3.5) / 6))) * (k.hdy > 3750 ? .55 : 1);
      var lr = Math.max(1.1, z * .2), pr = Math.max(7, z * 3.2) * (far && m ? 0 : 1);
      if (k.kind === 'rider'){ NGL.lamp(X + ca * z * .3, Y + sa * z * .3, lr * .9, la * .8, k.ph, pr * .7); return; }
      NGL.lamp(X + ca * z * .45 - sa * z * .3, Y + sa * z * .45 + ca * z * .3, lr, la, k.ph + m, pr);
      if (!far && (k.kind === 'merchant' || (k.hue + m) & 1)) NGL.lamp(X - ca * z * .5 + sa * z * .3, Y - sa * z * .5 - ca * z * .3, lr * .8, la * .75, k.ph + m + .5, 0);
    }
    var SPC = {}, nSPC = 0;
    function carSprite(k, z){
      var zq = Math.max(3.5, Math.round(z * 2) / 2), key = k.kind + (k.hue | 0) + '|' + zq + '|' + dpr, o = SPC[key];
      if (o) return o;
      if (nSPC > 400){ SPC = {}; nSPC = 0; }
      var x0, x1, y0, y1;
      if (k.kind === 'rider'){ x0 = -zq * .5; x1 = zq * .62; y0 = -zq * .32; y1 = zq * .32; }
      else { x0 = -zq * .7; x1 = zq * 1.3; y0 = -zq * .42; y1 = zq * .42; }
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
      var cv0 = document.createElement('canvas'); cv0.width = Math.ceil((x1 - x0) * dpr); cv0.height = Math.ceil((y1 - y0) * dpr);
      var x = cv0.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
      var keep = c; c = x;
      try { if (k.kind === 'rider') drawRider(k, zq, 0); else drawCart(k, zq, 0, 0); } finally { c = keep; }
      o = SPC[key] = {cv: cv0, x0: x0, y0: y0, w: x1 - x0, h: y1 - y0, zq: zq}; nSPC++;
      return o;
    }
    // ---- armies (2.5D): marching column in ranks that follows the leader along the road. Upright figures seen from the
    // map's oblique camera: mounted vanguard/rearguard, spear infantry in files of three, banner bearers whose flags wave
    // and stream back from the pole, spear tips glinting in the sun, a dust cloud rising behind the column.
    function armyRanks(n){
      var R = ['cav', 'cav', 'ban'], inf = Math.max(2, Math.round((n - 7) / 3));
      for (var i = 0; i < inf; i++) R.push(i % 4 === 3 ? 'ban' : 'inf');
      R.push('cav'); return R;
    }
    var ARM = {n: 0, dn: 0, L: []}, FIG = {}, nFIG = 0, ACOL = [['#7d2420', '#4a1512'], ['#2c4f86', '#1a2f52'], ['#2f5a2e', '#1b361b'], ['#6e5a2a', '#43361a']];
    function figSprite(type, zq, face, fr, hue){
      var key = type + face + fr + hue + '|' + zq + '|' + dpr, o = FIG[key]; if (o) return o;
      if (nFIG > 500){ FIG = {}; nFIG = 0; }
      var Hh = zq, w = Hh * 1.5, x0 = -w / 2, y0 = -Hh * 1.55, hh = Hh * 1.65;
      var cv0 = document.createElement('canvas'); cv0.width = Math.ceil(w * dpr) + 2; cv0.height = Math.ceil(hh * dpr) + 2;
      var x = cv0.getContext('2d'); x.setTransform(dpr * face, 0, 0, dpr, (face > 0 ? -x0 : w + x0) * dpr + 1, -y0 * dpr + 1);
      var C = ACOL[hue & 3], st = [-.11, -.035, .11, .035][fr], lw = Math.max(.6, Hh * .075);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(0, 0, Hh * (type === 'cav' ? .36 : .17), Hh * .05, 0, 0, 6.283); x.fill();
      x.lineCap = 'round'; x.lineJoin = 'round';
      if (type === 'cav'){
        x.strokeStyle = '#2a1a0e'; x.lineWidth = lw * 1.1; x.beginPath();   // legs (walk cycle)
        x.moveTo(-Hh * .2, -Hh * .36); x.lineTo(-Hh * .2 - st * 1.4, 0); x.moveTo(-Hh * .12, -Hh * .36); x.lineTo(-Hh * .12 + st * 1.4, 0);
        x.moveTo(Hh * .17, -Hh * .36); x.lineTo(Hh * .17 + st * 1.4, 0); x.moveTo(Hh * .25, -Hh * .36); x.lineTo(Hh * .25 - st * 1.4, 0); x.stroke();
        x.fillStyle = ['#4a2e18', '#2b1d12', '#6a4a2a', '#3a2a1c'][hue & 3]; x.beginPath(); x.ellipse(0, -Hh * .45, Hh * .33, Hh * .13, 0, 0, 6.283); x.fill();   // horse body
        x.beginPath(); x.moveTo(Hh * .22, -Hh * .5); x.lineTo(Hh * .38, -Hh * .78); x.lineTo(Hh * .48, -Hh * .72); x.lineTo(Hh * .32, -Hh * .42); x.closePath(); x.fill();   // neck+head
        x.strokeStyle = x.fillStyle; x.lineWidth = lw; x.beginPath(); x.moveTo(-Hh * .32, -Hh * .5); x.lineTo(-Hh * .42, -Hh * .28); x.stroke();   // tail
        x.fillStyle = C[0]; x.fillRect(-Hh * .1, -Hh * .9, Hh * .2, Hh * .36);                 // rider
        x.fillStyle = '#b8bcc4'; x.beginPath(); x.arc(0, -Hh * .98, Hh * .09, 0, 6.283); x.fill();   // helm
        x.strokeStyle = '#5a4128'; x.lineWidth = lw * .8; x.beginPath(); x.moveTo(-Hh * .1, -Hh * .62); x.lineTo(Hh * .62, -Hh * 1.22); x.stroke();   // lance
        x.fillStyle = '#dfe3ea'; x.beginPath(); x.moveTo(Hh * .62, -Hh * 1.22); x.lineTo(Hh * .52, -Hh * 1.12); x.lineTo(Hh * .66, -Hh * 1.15); x.closePath(); x.fill();
      } else {
        x.strokeStyle = '#2a2018'; x.lineWidth = lw; x.beginPath(); x.moveTo(-Hh * .03, -Hh * .36); x.lineTo(-Hh * .03 - st, 0); x.moveTo(Hh * .03, -Hh * .36); x.lineTo(Hh * .03 + st, 0); x.stroke();   // legs
        x.fillStyle = C[0]; x.beginPath(); x.moveTo(-Hh * .13, -Hh * .36); x.lineTo(-Hh * .1, -Hh * .78); x.lineTo(Hh * .1, -Hh * .78); x.lineTo(Hh * .13, -Hh * .36); x.closePath(); x.fill();   // tunic
        x.fillStyle = '#d8b48c'; x.beginPath(); x.arc(0, -Hh * .87, Hh * .085, 0, 6.283); x.fill();
        x.fillStyle = '#9aa0aa'; x.beginPath(); x.arc(0, -Hh * .9, Hh * .09, Math.PI, 0); x.fill();   // helmet
        if (type === 'inf'){
          x.strokeStyle = '#5a4128'; x.lineWidth = lw * .8; x.beginPath(); x.moveTo(Hh * .08, -Hh * .2); x.lineTo(Hh * .22, -Hh * 1.42); x.stroke();   // spear
          x.fillStyle = '#e6e9ee'; x.beginPath(); x.moveTo(Hh * .22, -Hh * 1.52); x.lineTo(Hh * .18, -Hh * 1.38); x.lineTo(Hh * .26, -Hh * 1.38); x.closePath(); x.fill();
          x.fillStyle = C[1]; x.beginPath(); x.arc(Hh * .12, -Hh * .56, Hh * .14, 0, 6.283); x.fill();                    // round shield
          x.strokeStyle = '#c9a24a'; x.lineWidth = Math.max(.4, lw * .55); x.stroke();
        } else { x.strokeStyle = '#3a2a18'; x.lineWidth = lw * .9; x.beginPath(); x.moveTo(0, -Hh * .3); x.lineTo(0, -Hh * 1.55); x.stroke(); }   // banner pole
      }
      o = FIG[key] = {cv: cv0, w: cv0.width / dpr, h: cv0.height / dpr, ax: (face > 0 ? -x0 : w + x0) + 1 / dpr, ay: -y0 + 1 / dpr}; nFIG++;
      return o;
    }
    function queueArmy(k, z, s, off, fade, t, lamps){
      var Hh = Math.max(5, z * 1.45), rs = Hh * .6 / s, R = k.ranks, fr0 = (t * 3.2 + k.ph) | 0;
      for (var r = 0; r < R.length; r++){
        var u = unitAt(k, r * rs); if (!u.v) break;
        var cu = Math.cos(u.a), su = Math.sin(u.a), cx = (u.x * s + view.x) - su * off, cy = (u.y * s + view.y) + cu * off;
        var face = cu >= 0 ? 1 : -1, files = R[r] === 'cav' ? 2 : R[r] === 'ban' ? 1 : 3, gap = Hh * .42;
        for (var f = 0; f < files; f++){
          var lo = (f - (files - 1) / 2) * gap, e = ARM.L[ARM.n] || (ARM.L[ARM.n] = {});
          e.x = cx - su * lo; e.y = cy + cu * lo * .62; e.t = R[r]; e.face = face; e.fr = (fr0 + f + r) & 3; e.hue = k.hue; e.Hh = Hh; e.fade = fade; e.sd = k.ph + r * 1.7 + f; ARM.n++;
          if (lamps && f === 0 && r % 2 === 0) NGL.lamp(e.x + face * Hh * .2, e.y - Hh * 1.05, Math.max(1.1, Hh * .12), fade * .9, k.ph + r * .37, r % 4 ? 0 : Math.max(9, Hh * 3));
        }
        if (r === R.length - 1 || r % 3 === 2){ var D = DUST[ARM.dn] || (DUST[ARM.dn] = {}); D.x = cx - cu * rs * s * .6; D.y = cy - su * rs * s * .6; D.r = Hh * (2.2 + (r % 2)); D.a = fade * (r === R.length - 1 ? .2 : .12); D.sd = k.ph + r; ARM.dn++; }
      }
    }
    var DUST = [], dustSpr = null;
    function drawArmies(t, lamps){
      if (!ARM.n && !ARM.dn){ ARM.dn = 0; return; }
      if (!dustSpr){ dustSpr = document.createElement('canvas'); dustSpr.width = dustSpr.height = 64; var dx = dustSpr.getContext('2d'), g = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(176,146,102,.9)'); g.addColorStop(.5, 'rgba(160,130,90,.45)'); g.addColorStop(1, 'rgba(150,120,80,0)'); dx.fillStyle = g; dx.fillRect(0, 0, 64, 64); }
      for (var d = 0; d < ARM.dn; d++){ var D = DUST[d], rr = D.r * (1 + .25 * Math.sin(t * .9 + D.sd)); c.globalAlpha = D.a; c.drawImage(dustSpr, D.x - rr, D.y - rr * .75, rr * 2, rr * 1.4); }
      ARM.dn = 0;
      var L = ARM.L, n = ARM.n, i, j;
      for (i = 1; i < n; i++){ var e = L[i]; j = i - 1; while (j >= 0 && L[j].y > e.y){ L[j + 1] = L[j]; j--; } L[j + 1] = e; }   // back to front
      var day = 1 - DN.v.night;
      for (i = 0; i < n; i++){
        var a = L[i], zq = Math.max(4, Math.round(a.Hh)), o = figSprite(a.t, zq, a.face, a.t === 'ban' ? 0 : a.fr, a.hue), sc = a.Hh / zq;
        c.globalAlpha = .96 * a.fade; c.drawImage(o.cv, a.x - o.ax * sc, a.y - o.ay * sc, o.w * sc, o.h * sc);
        if (a.t === 'ban'){   // banner faces the camera, streams back from the pole and waves
          var px = a.x, py = a.y - a.Hh * 1.52, bw = a.Hh * .62, bh = a.Hh * .36, fb = -a.face, w1 = Math.sin(t * 5 + a.sd) * bh * .18, w2 = Math.sin(t * 5 + a.sd - 1.6) * bh * .22;
          c.fillStyle = BAN[a.hue & 3]; c.beginPath(); c.moveTo(px, py);
          c.quadraticCurveTo(px + fb * bw * .5, py + w1, px + fb * bw, py + w2); c.lineTo(px + fb * bw * .92, py + bh + w2); c.quadraticCurveTo(px + fb * bw * .5, py + bh + w1, px, py + bh); c.closePath(); c.fill();
          c.fillStyle = 'rgba(240,215,140,.9)'; c.beginPath(); c.arc(px + fb * bw * .45, py + bh * .5 + w1 * .8, bh * .17, 0, 6.283); c.fill();
        } else if (day > .3 && Math.sin(t * 2.3 + a.sd * 3.1) > .965){   // a spear tip / helm catches the sun
          var gx = a.x + a.face * a.Hh * (a.t === 'cav' ? .6 : .22), gy = a.y - a.Hh * (a.t === 'cav' ? 1.2 : 1.47), gr = Math.max(1.2, a.Hh * .14);
          c.globalAlpha = a.fade * day; c.strokeStyle = 'rgba(255,250,225,.95)'; c.lineWidth = .8; c.beginPath(); c.moveTo(gx - gr, gy); c.lineTo(gx + gr, gy); c.moveTo(gx, gy - gr); c.lineTo(gx, gy + gr); c.stroke();
        }
      }
      c.globalAlpha = 1; ARM.n = 0;
    }
    function horse(z, x, col){
      c.fillStyle = col || '#4a2e18'; c.beginPath(); c.ellipse(x, 0, z * .34, z * .13, 0, 0, 6.283); c.fill();
      c.beginPath(); c.ellipse(x + z * .36, 0, z * .12, z * .07, 0, 0, 6.283); c.fill();
    }
    function drawCart(k, z, ox, t){
      var C = CART[k.kind === 'merchant' ? 2 + (k.hue & 1) : k.kind === 'ox' ? 1 : 0];
      if (ox === 0) horse(z, z * .78, k.kind === 'ox' ? '#7a5a3a' : '#3e2614');
      c.fillStyle = C[1]; c.fillRect(ox - z * .55, -z * .3, z * .82, z * .6);                    // bed
      c.fillStyle = '#1a120a'; c.fillRect(ox - z * .4, -z * .36, z * .14, z * .72); c.fillRect(ox + z * .02, -z * .36, z * .14, z * .72);   // wheels
      if (k.kind === 'ox'){ c.fillStyle = '#8a6a3a'; c.fillRect(ox - z * .5, -z * .22, z * .7, z * .44); }   // hay/load
      else { c.fillStyle = C[0]; c.beginPath(); c.ellipse(ox - z * .14, 0, z * .42, z * .27, 0, 0, 6.283); c.fill();    // canvas cover / canopy
        c.strokeStyle = 'rgba(40,25,12,.35)'; c.lineWidth = Math.max(.5, z * .04); c.beginPath(); c.moveTo(ox - z * .3, -z * .25); c.lineTo(ox - z * .3, z * .25); c.moveTo(ox, -z * .25); c.lineTo(ox, z * .25); c.stroke(); }
    }
    function drawRider(k, z, t){
      var b = Math.sin(t * 9 + k.ph) * z * .03;
      horse(z * 1.05, 0, '#3b2414');
      c.fillStyle = ['#7a1e1e', '#1e3d6a', '#2f4a22', '#5a4a2a'][k.hue]; c.beginPath(); c.arc(-z * .02, b, z * .17, 0, 6.283); c.fill();    // rider cloak
      c.fillStyle = '#e0c9a0'; c.beginPath(); c.arc(z * .06, b, z * .07, 0, 6.283); c.fill();
    }
    // ---- ships: several types, some in fleets; only on coastal sea lanes (contours of the coast-distance field => never cross land)
    var TYPES = {
      galleon: {sc: 1.55, v: 5.5, beam: .3, w: 2}, cog: {sc: 1.1, v: 6.5, beam: .32, w: 1}, sloop: {sc: .8, v: 9, beam: .26, w: 1},
      longship: {sc: 1.15, v: 8.5, beam: .2, w: 1}, fishing: {sc: .7, v: 5, beam: .3, w: 1}, pirate: {sc: .95, v: 10, beam: .25, w: 0}
    };
    // lane mix by distance from the coast: the inner lanes see sloops/cogs and some fishing boats, the open sea mostly big
    // ships (galleons, cogs, longships) and only rarely a small one. Small fishing boats live near the coasts (FISHB).
    var TYPE_W = [['galleon', .18], ['cog', .25], ['sloop', .25], ['longship', .14], ['fishing', .18]];
    var TYPE_OPEN = [['galleon', .36], ['cog', .32], ['longship', .22], ['sloop', .07], ['fishing', .03]];
    var TYPE_IN = [['galleon', .08], ['cog', .22], ['sloop', .32], ['longship', .14], ['fishing', .24]];
    function laneOff(ln){ if (ln.off == null && field){ var o = 0; for (var i = 0; i < 5; i++){ var q = at(ln, ln.tot * (i + .5) / 5); o += coastDist(q.x, q.y); } ln.off = o / 5; } return ln.off == null ? 170 : ln.off; }
    function pickType(ln){ var off = ln ? laneOff(ln) : 170, T = off > 200 ? TYPE_OPEN : off < 140 ? TYPE_IN : TYPE_W, r = Math.random(), a = 0;
      for (var i = 0; i < T.length; i++){ a += T[i][1]; if (r <= a) return T[i][0]; } return 'cog'; }
    function laneAt(ln, d){ if (ln.closed){ d = ((d % ln.tot) + ln.tot) % ln.tot; } return at(ln, clamp(d, 0, ln.tot)); }
    // ---- harbour traffic (searoutes.json): ships leave a city harbour, sail an A* sea route to another port and berth there
    var PORTR = [], SP = {x: 0, y: 0, ang: 0, fade: 0}, routesReady = false;
    function setRoutes(d){
      routesReady = true; PORTS = ((d && d.ports) || []).map(function(q){ return [q.x, q.y]; });
      PORTR = ((d && d.routes) || []).map(function(r){ var g = geoEdge(r.p, r.a, r.b, 0); g.closed = false; return g; });
    }
    function spawnPortShip(stagger, budget){
      if (!PORTR.length) return 0;
      var ln = PORTR[(Math.random() * PORTR.length) | 0], dir = Math.random() < .5 ? 1 : -1, lead = Math.random() < .4 ? 'cog' : Math.random() < .5 ? 'galleon' : Math.random() < .6 ? 'sloop' : 'longship';
      var fleet = Math.random() < .18 ? Math.min(budget, 2 + ((Math.random() * 2) | 0)) : 1, v = TYPES[lead].v * rnd(.85, 1.1), ph = rnd(0, 9);
      var run = ln.tot, t0 = stagger ? rnd(0, run * .9) : 0, d0 = dir > 0 ? 0 : ln.tot;
      for (var k = 0; k < fleet; k++){
        var row = Math.ceil(k / 2), type = k === 0 ? lead : (lead === 'galleon' ? 'sloop' : lead);
        ships.push({ln: ln, dir: dir, d0: d0, run: run, t: Math.max(0, t0 - row * 60), v: v, type: type, port: 1, fl: fleet,
          lat: k ? (k % 2 ? 1 : -1) * row * 24 : 0, ph: ph + k, sz: rnd(.9, 1.1), sink: -1});
      }
      return fleet;
    }
    // current position of a ship (lane or harbour route; escorts close up near the harbours) -> SP
    function shipPos(k){
      var d = k.d0 + k.dir * k.t, q = laneAt(k.ln, d), ang = q.ang + (k.dir < 0 ? Math.PI : 0);
      var lat = k.port ? k.lat * clamp(Math.min(k.t, k.run - k.t) / 260, 0, 1) : k.lat;
      SP.x = q.x - Math.sin(ang) * lat; SP.y = q.y + Math.cos(ang) * lat; SP.ang = ang;
      SP.fade = k.port ? Math.min(1, k.t / 45, (k.run - k.t) / 45) : Math.min(1, k.t / 160, (k.run - k.t) / 160);
      if (k.sink >= 0) SP.fade *= 1 - sstep(4, 16, k.sink);
      return SP;
    }
    function spawnShips(stagger, budget){
      if (!lanes.length) return 0;
      var sum = 0, i; for (i = 0; i < lanes.length; i++) sum += lanes[i].tot;
      var r = Math.random() * sum, ln = lanes[0]; for (i = 0; i < lanes.length; i++){ r -= lanes[i].tot; if (r <= 0){ ln = lanes[i]; break; } }
      var fleet = Math.random() < .3 ? Math.min(budget, 2 + ((Math.random() * 4) | 0)) : 1, dir = Math.random() < .5 ? 1 : -1;
      var lead = pickType(ln); if (fleet > 1 && lead === 'fishing') lead = Math.random() < .5 ? 'longship' : 'galleon';
      if (laneOff(ln) > 190 && Math.random() < .14){ var np0 = 0; for (i = 0; i < ships.length; i++) if (ships[i].type === 'pirate') np0++; if (np0 < (wLT ? 1 : 3)){ lead = 'pirate'; fleet = 1; } }   // black-sailed prowlers hunt the open sea
      var t0, run = rnd(1400, 3600), d0 = ln.closed ? rnd(0, ln.tot) : rnd(0, Math.max(1, ln.tot - 200)), v = TYPES[lead].v * rnd(.85, 1.1), ph = rnd(0, 9);
      if (!ln.closed){ dir = d0 > ln.tot / 2 ? -1 : 1; run = Math.min(run, dir > 0 ? ln.tot - d0 : d0); }
      t0 = stagger ? rnd(0, run * .8) : 0;
      for (var k = 0; k < fleet; k++){
        var type = k === 0 ? lead : (lead === 'galleon' && Math.random() < .5 ? 'sloop' : lead), row = Math.ceil(k / 2);
        ships.push({ln: ln, dir: dir, d0: d0 - dir * row * 70 * TYPES[lead].sc, run: run, t: t0, v: v, type: type, fl: fleet,
          lat: k ? (k % 2 ? 1 : -1) * row * 26 : 0, ph: ph + k, sz: rnd(.9, 1.1), sink: -1});
      }
      return fleet;
    }
    function stepShips(dt, lt){
      if (!routesReady) return;
      wLT = !!lt; var want = lt ? 12 : 40, wantP = PORTR.length ? Math.round(want * .62) : 0, guard = 0, np = 0;
      for (var i = 0; i < ships.length; i++) if (ships[i].port) np++;
      while (ships.length < want && guard++ < 60){ var stg = !shipsInit; if (np < wantP){ var a = spawnPortShip(stg, want - ships.length); np += a; if (!a) spawnShips(stg, want - ships.length); } else spawnShips(stg, want - ships.length); }
      shipsInit = true;
      if (ships.length > want + 4) ships.length = want;
      for (i = ships.length - 1; i >= 0; i--){
        var k = ships[i];
        if (k.sink >= 0){ k.sink += dt; if (k.sink > 16){ if (k.wk) k.wk.live = false; ships.splice(i, 1); } continue; }
        if (k.halt) continue;
        var e = k.port ? clamp(.22 + Math.min(k.t, k.run - k.t) / 170, .22, 1) : 1;   // leave / enter harbour slowly
        k.t += k.v * e * dt; if (k.t >= k.run) ships.splice(i, 1);
      }
    }
    function drawShip(z, type, ang, t, ph){
      var T = TYPES[type], L = z * T.sc, B = L * T.beam;
      c.save(); c.rotate(ang);
      c.fillStyle = type === 'longship' ? '#3a2412' : type === 'pirate' ? '#151012' : '#2b1a0e';
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
      else if (type === 'pirate'){ sq(-L * .12, L * .82, L * .38, '#4a4440'); tri(L * .2, L * .7, L * .3); c.strokeStyle = '#111'; c.lineWidth = Math.max(.5, L * .035);
        var wv = Math.sin(t * 5 + ph) * L * .03;
        c.beginPath(); c.moveTo(-L * .12, -L * .82); c.lineTo(-L * .12, -L * 1.12); c.stroke(); c.fillStyle = '#060607';
        c.beginPath(); c.moveTo(-L * .12, -L * 1.12); c.quadraticCurveTo(L * .05, -L * 1.12 + wv, L * .2, -L * 1.1); c.lineTo(L * .2, -L * .9); c.quadraticCurveTo(L * .05, -L * .92 + wv, -L * .12, -L * .92); c.closePath(); c.fill();
        c.fillStyle = '#efeadf'; c.beginPath(); c.arc(L * .04, -L * 1.03 + wv * .5, Math.max(.6, L * .045), 0, 6.283); c.fill();
        c.strokeStyle = '#efeadf'; c.lineWidth = Math.max(.35, L * .018); c.beginPath(); c.moveTo(-L * .03, -L * .95); c.lineTo(L * .11, -L * .99); c.moveTo(-L * .03, -L * .99); c.lineTo(L * .11, -L * .95); c.stroke(); }
      else if (type === 'longship'){ sq(0, L * .8, L * .55, '#b23a2a'); c.fillStyle = 'rgba(245,235,215,.9)'; c.fillRect(-L * .275 + L * .11, -L * .78, L * .1, L * .56); c.fillRect(-L * .275 + L * .33, -L * .78, L * .1, L * .56); }
      else { tri(0, L * .75, L * .4); }
    }
    // ---- detached ship wakes: points dropped in world space behind the stern; each point ages in place and is drawn as a
    // kelvin-ish pair of diverging, broken foam arms + soft central turbulence. Pooled; length/width/lifetime scale with hull size.
    var shipsInit = false, WAKE = {galleon: 3.4, cog: 2.4, longship: 2.8, sloop: 1.6, fishing: 1.3, pirate: 1.8}, wakes = [], wPool = [], wLT = false;
    function wPt(){ return wPool.pop() || {}; }
    function wakeEmit(k, wx, wy, ang, Lw, t, fade){
      var tr = k.wk;
      if (!tr){ tr = k.wk = {pts: [], life: WAKE[k.type] * Lw / k.v, v: k.v, B: Lw * TYPES[k.type].beam, Lw: Lw, live: true}; wakes.push(tr); }
      var sx = wx - Math.cos(ang) * Lw * .42, sy = wy - Math.sin(ang) * Lw * .42, P = tr.pts, last = P[P.length - 1];
      var step = Lw * (wLT ? .45 : .26);
      if (last && (sx - last.x) * (sx - last.x) + (sy - last.y) * (sy - last.y) < step * step) return;
      var q = wPt(); q.x = sx; q.y = sy; q.a = ang; q.b = t; q.f = fade; q.gl = Math.random() < .12; q.gr = Math.random() < .12;
      q.jl = rnd(-.06, .06); q.jr = rnd(-.06, .06); q.w = rnd(.75, 1.25); P.push(q);
    }
    var WK0 = {}, WK1 = {};
    function drawWakes(t){
      var s = view.s;
      for (var i = wakes.length - 1; i >= 0; i--){
        var tr = wakes[i], P = tr.pts;
        while (P.length && t - P[0].b > tr.life) wPool.push(P.shift());
        if (!P.length){ if (!tr.live) wakes.splice(i, 1); continue; }
        var H = toScreen(P[P.length - 1].x, P[P.length - 1].y), T0 = toScreen(P[0].x, P[0].y);
        if (!vis(H, 120) && !vis(T0, 120)) continue;
        // batched: arms go into 3 alpha buckets per wake, churned water into one path (few draw calls per ship)
        var prev = null, bk = [new Path2D(), new Path2D(), new Path2D()], ch = new Path2D(), lw = Math.max(.5, tr.Lw * s * .034), anyC = false;
        for (var j = 0; j < P.length; j++){
          var p = P[j], a = (t - p.b) / tr.life; if (a < 0) a = 0;
          var back = a * tr.life * tr.v, hw = tr.B * .45 + back * .2, nx = -Math.sin(p.a), ny = Math.cos(p.a);
          var Cx = p.x * s + view.x, Cy = p.y * s + view.y, kl = hw * (1 + p.jl), kr = hw * (1 + p.jr);
          var cur = prev === WK0 ? WK1 : WK0; cur.x = Cx; cur.y = Cy; cur.a = a; cur.f = p.f; cur.lx = (p.x + nx * kl) * s + view.x; cur.ly = (p.y + ny * kl) * s + view.y; cur.rx = (p.x - nx * kr) * s + view.x; cur.ry = (p.y - ny * kr) * s + view.y;
          if (prev){
            var aa = (a + prev.a) / 2, al = Math.pow(1 - aa, 1.5) * Math.min(prev.f, cur.f);
            if (al > .025){
              var B2 = bk[al > .66 ? 0 : al > .33 ? 1 : 2];
              if (!p.gl){ B2.moveTo(prev.lx, prev.ly); B2.lineTo(cur.lx, cur.ly); }
              if (!p.gr){ B2.moveTo(prev.rx, prev.ry); B2.lineTo(cur.rx, cur.ry); }
              if (aa < .45 && (j & 1)){ var rr = Math.max(.8, tr.B * s * (.4 + .9 * aa)); ch.moveTo(Cx + rr, Cy); ch.arc(Cx, Cy, rr, 0, 6.283); anyC = true; }
            }
          }
          prev = cur;
        }
        c.lineWidth = lw;
        c.strokeStyle = 'rgba(236,246,250,.33)'; c.stroke(bk[0]); c.strokeStyle = 'rgba(236,246,250,.2)'; c.stroke(bk[1]); c.strokeStyle = 'rgba(236,246,250,.08)'; c.stroke(bk[2]);
        if (anyC){ c.fillStyle = 'rgba(225,240,246,.05)'; c.fill(ch); }
      }
    }
    function drawShips(t, nv){
      var s = view.s, base = clamp(40 * s, 7, 30);
      for (var w = 0; w < wakes.length; w++) wakes[w].live = false;
      for (var i = 0; i < ships.length; i++){
        var k = ships[i]; if (k.wk) k.wk.live = true; var Q = shipPos(k), fade = Q.fade; if (fade <= 0 || k.halt || k.sink >= 0) continue;
        wakeEmit(k, Q.x, Q.y, Q.ang, base * k.sz * TYPES[k.type].sc / s, t, fade);
      }
      PIRATE.wake(t, base, s);
      drawWakes(t);
      for (i = 0; i < ships.length; i++){
        k = ships[i]; var Q2 = shipPos(k), ang = Q2.ang; fade = Q2.fade; if (fade <= 0) continue;
        var P = toScreen(Q2.x, Q2.y); if (!vis(P, 60)) continue;
        c.save(); c.translate(P.x, P.y); c.globalAlpha = fade;
        if (k.sink >= 0){   // struck by pirates: lists, settles lower and fades; a ring of foam spreads
          var sk = k.sink, L1 = base * k.sz * TYPES[k.type].sc;
          c.strokeStyle = 'rgba(230,242,248,' + (.35 * (1 - sk / 16)).toFixed(3) + ')'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, L1 * (.5 + sk * .09), L1 * (.25 + sk * .045), 0, 0, 6.283); c.stroke();
          c.translate(0, Math.min(sk, 10) * L1 * .02); c.rotate(Math.min(.6, sk * .055) * (k.ph % 2 > 1 ? 1 : -1)); c.scale(1, 1 - sstep(3, 16, sk) * .55);
        }
        drawShip(base * k.sz, k.type, ang, t, k.ph); c.restore();
        if (nv > .02 && k.sink < 0){   // big ships: stern lanterns, deck lights, masthead; small boats one lantern; warm pool on the water
          var L0 = base * k.sz * TYPES[k.type].sc, lr = Math.max(1, L0 * .045), ca = Math.cos(ang), sa = Math.sin(ang), big = k.type === 'galleon' || k.type === 'cog';
          NGL.lamp(P.x - ca * L0 * .5, P.y - sa * L0 * .5, lr, fade, k.ph, L0 * (big ? 1.3 : .9));
          if (big){ NGL.lamp(P.x - ca * L0 * .45 - sa * L0 * .12, P.y - sa * L0 * .45 + ca * L0 * .12, lr * .85, fade * .9, k.ph + 1, 0);
            NGL.lamp(P.x + ca * L0 * .1, P.y + sa * L0 * .1, lr * .8, fade * .8, k.ph + 2, L0 * .7);
            NGL.lamp(P.x + ca * L0 * .45, P.y + sa * L0 * .45, lr * .75, fade * .75, k.ph + 3, 0);
            NGL.lamp(P.x, P.y - L0 * .9, lr * .7, fade * .8, k.ph + 4, 0); }
          else if (k.type === 'longship') NGL.lamp(P.x + ca * L0 * .3, P.y + sa * L0 * .3, lr * .8, fade * .8, k.ph + 2, 0);
        }
      }
    }
    // ---- pirates: now and then (random time & place) a black-flagged ship appears behind a lone merchant, closes in a little
    // faster, comes alongside; cannon flashes + smoke both ways (and sword clashes when boarding); then it sails off and fades
    // while the merchant lists and sinks. Sounds only when the camera is near (map-audio one-shots).
    var PUF = [];
    function sfx(name, x, y, g){
      var A = window.__ulvMapAudio; if (!A || !A.sfx) return;
      var P = toScreen(x, y), zf = zoomF(), dx = (P.x - vw / 2) / vw, dy = (P.y - vh / 2) / vh, d = Math.sqrt(dx * dx + dy * dy);
      var near = (1 - sstep(.35, .75, d)) * sstep(.25, .6, zf); if (near > .03) A.sfx(name, near * (g || 1), clamp(dx * 1.6, -1, 1));
    }
    function mkPirate(){
      var P = null;
      function pickVictim(){
        var A = toWorld(0, 0), B = toWorld(vw, vh), vis0 = [], open = [];
        var C = ships.filter(function(k){ return !k.halt && !k.tgt && k.sink < 0 && (k.fl || 1) === 1 && (k.type === 'cog' || k.type === 'galleon' || k.type === 'sloop') && k.run - k.t > 600 && k.t > 120; });
        if (!C.length) return null;
        C.forEach(function(k){ var q = shipPos(k); if (coastDist(q.x, q.y) > 130){ open.push(k); if (q.x > A.x && q.x < B.x && q.y > A.y && q.y < B.y) vis0.push(k); } });
        if (vis0.length && Math.random() < .8) return vis0[(Math.random() * vis0.length) | 0];
        if (open.length) return open[(Math.random() * open.length) | 0];
        return C[(Math.random() * C.length) | 0];
      }
      function water(x, y){ return !isLand(x, y) && coastDist(x, y) > 14; }
      function start(){
        var v = pickVictim(); if (!v) return false;
        var q = shipPos(v), ca = Math.cos(q.ang), sa = Math.sin(q.ang);
        for (var i = 0; i < 18; i++){
          var back = rnd(140, 230), side = rnd(-1, 1) * 110, x = q.x - ca * back - sa * side, y = q.y - sa * back + ca * side;
          if (water(x, y) && water((x + q.x) / 2, (y + q.y) / 2)){ v.tgt = true; P = {x: x, y: y, ang: Math.atan2(q.y - y, q.x - x), st: 'chase', t: 0, v: v, a: 0, nextShot: 0, k: {type: 'pirate', v: 9, ph: rnd(0, 9), sz: 1}}; return true; }
        }
        return false;
      }
      function steer(tx, ty, sp, dt, rate){
        var want = Math.atan2(ty - P.y, tx - P.x), da = Math.atan2(Math.sin(want - P.ang), Math.cos(want - P.ang));
        P.ang += clamp(da, -rate * dt, rate * dt);
        for (var tr = 0; tr < 8; tr++){
          var nx = P.x + Math.cos(P.ang) * sp * dt, ny = P.y + Math.sin(P.ang) * sp * dt;
          if (water(nx, ny)){ P.x = nx; P.y = ny; return true; }
          P.ang += (tr % 2 ? -1 : 1) * .4 * (tr + 1);
        }
        return false;
      }
      function end(){ if (P && P.v) P.v.tgt = false; P = null; }
      function step(t, dt){
        if (!P) return;
        P.t += dt; var v = P.v, alive = ships.indexOf(v) >= 0;
        if (P.st === 'chase' && (!alive || v.sink >= 0 || (v.halt && P.st !== 'fight'))){ P.st = 'flee'; P.t = 0; v.tgt = false; }
        if (P.st === 'chase'){
          P.a = Math.min(1, P.a + dt / 3);
          var q = shipPos(v), ca = Math.cos(q.ang), sa = Math.sin(q.ang), sd = ((P.x - q.x) * -sa + (P.y - q.y) * ca) >= 0 ? 1 : -1;
          var tx = q.x - sa * sd * 20 + ca * 4, ty = q.y + ca * sd * 20 + sa * 4, d = Math.hypot(tx - P.x, ty - P.y);
          var vv = v.v * (v.port ? clamp(.22 + Math.min(v.t, v.run - v.t) / 170, .22, 1) : 1);
          if (!steer(tx, ty, Math.min(vv * 1.45 + 5, 3 + d * 2), dt, 1.1) || P.t > 80){ P.st = 'flee'; P.t = 0; v.tgt = false; }
          else if (d < 8){ P.st = 'fight'; P.t = 0; v.halt = true; P.side = sd; }
        } else if (P.st === 'fight'){
          var q2 = shipPos(v), c2 = Math.cos(q2.ang), s2 = Math.sin(q2.ang);
          P.x += ((q2.x - s2 * P.side * 19) - P.x) * Math.min(1, dt * 2); P.y += ((q2.y + c2 * P.side * 19) - P.y) * Math.min(1, dt * 2); P.ang += Math.atan2(Math.sin(q2.ang - P.ang), Math.cos(q2.ang - P.ang)) * Math.min(1, dt * 1.5);
          if (P.t > P.nextShot && P.t < 9){   // broadside: muzzle flash + smoke from either hull towards the other
            var fromP = Math.random() < .6, ox = fromP ? P.x : q2.x, oy = fromP ? P.y : q2.y, tox = fromP ? q2.x : P.x, toy = fromP ? q2.y : P.y, m = Math.hypot(tox - ox, toy - oy) || 1;
            var along = rnd(-6, 6), fx = ox + (tox - ox) / m * 6 + c2 * along, fy = oy + (toy - oy) / m * 6 + s2 * along;
            FLASH.push({x: fx, y: fy, t: t, r: rnd(5, 8)});
            for (var j = 0; j < 3; j++) PUF.push({x: fx + rnd(-2, 2), y: fy + rnd(-2, 2), vx: (tox - ox) / m * rnd(1, 4) + rnd(-1, 1), vy: (toy - oy) / m * rnd(1, 4) - rnd(.5, 2), age: 0, life: rnd(5, 8), r0: rnd(2.5, 4), spr: SPR[(Math.random() * SPR.length) | 0]});
            sfx('cannon', fx, fy, rnd(.7, 1)); P.nextShot = P.t + rnd(.25, .9);
          }
          if (P.t > 5.5 && P.t < 10 && Math.random() < dt * 1.4) sfx('clash', P.x, P.y, rnd(.5, .8));   // boarding
          if (P.t > 11){ v.sink = 0; P.st = 'flee'; P.t = 0; P.fights = 1;
            var bestA = P.ang, bd = -1; for (var a = 0; a < 8; a++){ var aa = a * .785, cd = coastDist(P.x + Math.cos(aa) * 180, P.y + Math.sin(aa) * 180); if (cd > bd && !isLand(P.x + Math.cos(aa) * 90, P.y + Math.sin(aa) * 90)){ bd = cd; bestA = aa; } } P.flee = bestA; }
        } else {
          steer(P.x + Math.cos(P.flee == null ? P.ang : P.flee) * 100, P.y + Math.sin(P.flee == null ? P.ang : P.flee) * 100, 7 + Math.min(8, P.t * 1.5), dt, .5);
          P.a = Math.max(0, 1 - P.t / 16);
          if (P.t > 16) end();
        }
      }
      return {step: step, start: start, get p(){ return P; },
        wake: function(t, base, s){ if (!P) return; if (P.k.wk) P.k.wk.live = true; if (P.a > .05 && P.st !== 'fight') wakeEmit(P.k, P.x, P.y, P.ang, base * TYPES.pirate.sc / s, t, P.a); },
        draw: function(t, base){ if (!P || P.a <= .01) return; var Q = toScreen(P.x, P.y); if (!vis(Q, 60)) return; c.save(); c.translate(Q.x, Q.y); c.globalAlpha = P.a; drawShip(base, 'pirate', P.ang, t, P.k.ph); c.restore(); }};
    }
    var PIRATE = (function(){
      var I = [mkPirate(), mkPirate()], clock = 0, next = 22 + Math.random() * 28, fights = 0, starts = 0;
      function step(t, dt, lt){
        clock += dt; var max = lt ? 1 : 2;
        for (var i = 0; i < I.length; i++){ var pf = I[i].p; I[i].step(t, dt); if (pf && pf.fights && !I[i].p) fights++; }
        if (clock > next && ships.length){
          var free = null; for (i = 0; i < max; i++) if (!I[i].p){ free = I[i]; break; }
          if (free && free.start()){ starts++; next = clock + (lt ? rnd(80, 150) : rnd(55, 115)); } else next = clock + (free ? 6 : 15);
        }
      }
      function first(){ for (var i = 0; i < I.length; i++) if (I[i].p) return I[i].p; return null; }
      return {step: step, get p(){ return first(); },
        list: function(){ return I.map(function(o){ var P = o.p; return P ? {st: P.st, x: Math.round(P.x), y: Math.round(P.y), t: +P.t.toFixed(1)} : null; }).filter(Boolean); },
        counts: function(){ return {starts: starts, fights: fights, clock: +clock.toFixed(1), next: +next.toFixed(1)}; },
        wake: function(t, base, s){ for (var i = 0; i < I.length; i++) I[i].wake(t, base, s); },
        draw: function(t, base){ for (var i = 0; i < I.length; i++) I[i].draw(t, base); },
        force: function(){ next = clock; }};
    })();
    var FLASH = [];
    function drawBattle(t, dt){
      var s = view.s;
      for (var i = PUF.length - 1; i >= 0; i--){
        var p = PUF[i]; p.age += dt; if (p.age > p.life){ PUF.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .985; p.vy *= .985;
        var u = p.age / p.life, r = p.r0 * (1 + u * 3) * s * 2.2, P = toScreen(p.x, p.y); if (r < .5 || !vis(P, r)) continue;
        c.globalAlpha = sstep(0, .05, u) * Math.pow(1 - u, 1.4) * .85; c.drawImage(p.spr, P.x - r, P.y - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
      for (i = FLASH.length - 1; i >= 0; i--){
        var f = FLASH[i], e = t - f.t; if (e > .35 || e < 0){ FLASH.splice(i, 1); continue; }
        var Q = toScreen(f.x, f.y), a = 1 - e / .35, rr = Math.max(2.5, f.r * s * 1.1) * (1 + e * 2);
        NGL.flash(Q.x, Q.y, rr, a * .75, 5);
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
      var vis0 = sstep(.02, .14, zf), farF = sstep(.03, .32, zf), A = toWorld(-120, -160), B = toWorld(vw + 120, vh + 60), E = DATA.smoke;
      if (vis0 <= 0){ if (smoke.length) smoke.length = 0; smokeOn = {}; return 0; }
      for (var i = 0; i < E.length; i++){
        if ((lt && i % 2) || (farF < .5 && i % 2) || (farF < .2 && i % 4 === 1)) continue;   // far zoom: fewer emitters
        var e = E[i], on = e[0] > A.x && e[0] < B.x && e[1] > A.y && e[1] < B.y;
        if (!on){ if (smokeOn[i]) smokeOn[i] = 0; continue; }
        var rate = (lt ? 1.1 : 2.6) * (.6 + e[2] * .5) * (.45 + .55 * farF);
        if (!smokeOn[i]){ smokeOn[i] = 1; var n0 = Math.round(rate * 9); for (var q = 0; q < n0; q++) smoke.push(puff(e, rnd(0, 9))); }   // pre-warm
        e._acc = (e._acc || 0) + dt * rate; while (e._acc >= 1){ e._acc -= 1; smoke.push(puff(e)); }
      }
      var cap = Math.round((lt ? 300 : 950) * (.5 + .5 * farF)); if (smoke.length > cap) smoke.splice(0, smoke.length - cap);
      for (var j = smoke.length - 1; j >= 0; j--){
        var p = smoke[j]; p.age += dt; if (p.age >= p.life){ smoke.splice(j, 1); continue; }
        var u = p.age / p.life; p.y += p.vy * dt * (1 - u * .45); p.x += (4.5 * u + 1.2 + Math.sin(p.age * .8 + p.seed) * 1.4) * dt;
      }
      return vis0;
    }
    function drawSmoke(vis0, zf){
      if (vis0 <= 0) return; var s = view.s, k0 = vis0 * (.75 + .25 * sstep(.35, .8, zf)), grow = 1 + (1 - sstep(.03, .32, zf)) * .9;
      for (var j = 0; j < smoke.length; j++){
        var p = smoke[j], u = p.age / p.life, r = p.r0 * (1 + u * 3.8) * s * grow; if (r < .6) continue;
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
    function resize(){ cv.width = cvN.width = Math.round(vw * dpr); cv.height = cvN.height = Math.round(vh * dpr); if (cvS){ cvS.width = cv.width; cvS.height = cv.height; skyUsed = true; } }
    // high flyers (dragon) on their own 2D canvas ABOVE the fog/cloud layer; cleared only after use
    var cvS = ov.querySelector('.mapx-sky'), cS = cvS ? cvS.getContext('2d') : null, skyUsed = false, skyNow = false;
    function skyBegin(){ skyNow = false; if (skyUsed && cS){ cS.setTransform(1, 0, 0, 1, 0, 0); cS.clearRect(0, 0, cvS.width, cvS.height); skyUsed = false; } }
    function skyCtx(){ if (!cS) return c; if (!skyNow){ cS.setTransform(dpr, 0, 0, dpr, 0, 0); skyNow = true; } skyUsed = true; return cS; }
    // ---- night lights: ONE WebGL pass on the night canvas. Static city lights (lights.bin: placed on roofs/walls/streets
    // detected in the painted map, built once into a GPU buffer; twinkle, staggered switch-on and occasional lamps going
    // off/on are computed in the shader) + soft warm light pools that brighten the darkened map around settlements,
    // ships and caravans. Dynamic lanterns are written into a preallocated Float32Array each frame (no allocations).
    var NGL = (function(){
      var gl = null, prog = null, A = {}, U = {}, bufP = null, bufQ = null, bufD = null, nP = 0, nQ = 0, ok = false, cleared = true;
      var DMAX = 3200, dyn = new Float32Array(DMAX * 48), nd = 0, STR = 32;
      var VS = ['attribute vec4 aA;attribute vec4 aB;uniform vec3 uView;uniform vec2 uRes;uniform float uT;uniform float uNV;uniform float uPx;uniform float uPool;',
        'varying vec2 vC;varying float vA;varying float vK;varying float vW;',
        'void main(){float k=aB.w,sd=aB.z;vec2 sp=aA.xy*uView.x+uView.yz;float r;float a=aB.y;',
        ' if(k<.5){r=aB.x*uPx*2.6;a*=.74+.26*sin(uT*(.7+sd*2.6)+sd*61.);',
        '  float per=11.+sd*23.;float wv=uT/per+sd*37.;float wi=floor(wv),wf=fract(wv);float hs=fract(sin(wi*12.9898+sd*78.233)*43758.545);',
        '  a*=1.-step(hs,.06)*smoothstep(0.,.06,wf)*(1.-smoothstep(.9,1.,wf))*.96;',
        '  a*=smoothstep(sd*.55,sd*.55+.15,uNV);}',
        ' else if(k<1.5){r=aB.x*uView.x;a*=uPool*(.9+.1*sin(uT*.8+sd*9.));}',
        ' else if(k<2.5){r=aB.x*2.6;a*=.86+.14*sin(uT*7.3+sd*13.);}',
        ' else{r=aB.x;}',
        ' if(k<3.5)a*=uNV;sp+=aA.zw*r;vec2 cl=sp/uRes*2.-1.;gl_Position=vec4(cl.x,-cl.y,0.,1.);vC=aA.zw;vA=a;vK=k;vW=fract(sd*7.13);}'].join('\n');
      var FS = ['precision mediump float;varying vec2 vC;varying float vA;varying float vK;varying float vW;',
        'void main(){float d=dot(vC,vC);if(d>1.||vA<.003)discard;vec3 c;',
        ' if(vK>4.5){float core=exp(-d*9.);c=vec3(1.,.93,.75)*core*1.6+vec3(1.,.55,.2)*exp(-d*3.)*.5;}',
        ' else if(vK>3.5){float core=exp(-d*14.);c=vec3(.85,.9,1.)*core*1.7+vec3(.55,.65,1.)*exp(-d*3.5)*.45;}',
        ' else if(vK<.5||(vK>1.5&&vK<2.5)){float core=exp(-d*20.);float halo=exp(-d*5.)*.38;c=mix(vec3(1.,.74,.40),vec3(1.,.90,.68),vW)*core*1.25+vec3(1.,.52,.18)*halo;}',
        ' else{float f=1.-d;c=vec3(1.,.58,.26)*f*f*f*.75;}',
        ' gl_FragColor=vec4(c*vA,0.);}'].join('\n');
      var CORN = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
      function put(arr, o, x, y, sz, br, sd, k){ for (var c = 0; c < 6; c++){ var j = o + c * 8; arr[j] = x; arr[j + 1] = y; arr[j + 2] = CORN[c * 2]; arr[j + 3] = CORN[c * 2 + 1]; arr[j + 4] = sz; arr[j + 5] = br; arr[j + 6] = sd; arr[j + 7] = k; } }
      function init(){
        try { gl = cvN.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false}); } catch(e){ gl = null; }
        if (!gl) return;
        function sh(t, src){ var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
        try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
          if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); } catch(e){ if (window.console) console.warn('map night lights: shader failed', e); gl = null; return; }
        gl.useProgram(prog); A.a = gl.getAttribLocation(prog, 'aA'); A.b = gl.getAttribLocation(prog, 'aB');
        ['uView', 'uRes', 'uT', 'uNV', 'uPx', 'uPool'].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });
        gl.enableVertexAttribArray(A.a); gl.enableVertexAttribArray(A.b);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        bufD = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufD); gl.bufferData(gl.ARRAY_BUFFER, dyn.byteLength, gl.DYNAMIC_DRAW);
        cvN.addEventListener('webglcontextlost', function(e){ e.preventDefault(); ok = false; }, false);
        ok = true;
      }
      function setStatic(pts, pools){   // pts: [x,y,size,bright]*, pools: [x,y,r,bright]*
        if (!gl) return;
        nP = pts.length / 4; var a = new Float32Array(nP * 48);
        for (var i = 0; i < nP; i++) put(a, i * 48, pts[i * 4], pts[i * 4 + 1], pts[i * 4 + 2], pts[i * 4 + 3], Math.random(), 0);
        bufP = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
        nQ = pools.length / 4; var q = new Float32Array(nQ * 48);
        for (i = 0; i < nQ; i++) put(q, i * 48, pools[i * 4], pools[i * 4 + 1], pools[i * 4 + 2], pools[i * 4 + 3], Math.random(), 1);
        bufQ = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufQ); gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW);
      }
      function begin(){ nd = 0; }
      // screen-space (css px) lantern: bright core + optional warm pool of radius pr
      function lamp(x, y, r, a, sd, pr){
        if (nd >= DMAX - 1 || a < .01 || x < -60 || y < -60 || x > vw + 60 || y > vh + 60) return;
        put(dyn, nd * 48, x, y, r, a, sd, 2); nd++;
        if (pr > 0){ put(dyn, nd * 48, x, y, pr, a * .55, sd, 3); nd++; }
      }
      // kind 4 = lightning (bluish white), 5 = muzzle / fire flash: visible by day too
      function flash(x, y, r, a, k){
        if (nd >= DMAX - 1 || a < .01 || x < -80 || y < -80 || x > vw + 80 || y > vh + 80) return;
        put(dyn, nd * 48, x, y, r, a, 0, k); nd++;
      }
      function bind(b){ gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.vertexAttribPointer(A.a, 4, gl.FLOAT, false, STR, 0); gl.vertexAttribPointer(A.b, 4, gl.FLOAT, false, STR, 16); }
      function flush(t, nv, zf, lt){
        if (!ok) return;
        if (nv <= .01 && !nd){ if (!cleared){ gl.viewport(0, 0, cvN.width, cvN.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); cleared = true; } return; }
        cleared = false;
        gl.viewport(0, 0, cvN.width, cvN.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(U.uRes, vw, vh); gl.uniform1f(U.uT, t % 10000); gl.uniform1f(U.uNV, nv);
        gl.uniform1f(U.uPx, .75 + Math.min(view.s, .7) * 1.5);
        gl.uniform1f(U.uPool, .3 + .7 * Math.pow(1 - zf, 1.4));
        gl.uniform3f(U.uView, view.s, view.x, view.y);
        if (nv > .01 && bufQ && nQ){ bind(bufQ); gl.drawArrays(gl.TRIANGLES, 0, nQ * 6); }
        if (nv > .01 && bufP && nP){ var n = Math.round(nP * (lt ? .5 : 1) * (.42 + .58 * sstep(.04, .4, zf))); bind(bufP); gl.drawArrays(gl.TRIANGLES, 0, n * 6); }
        if (nd){ gl.uniform3f(U.uView, 1, 0, 0); bind(bufD); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn.subarray(0, nd * 48)); gl.drawArrays(gl.TRIANGLES, 0, nd * 6); }
      }
      return {init: init, setStatic: setStatic, begin: begin, lamp: lamp, flash: flash, flush: flush, get ok(){ return ok; }, get n(){ return nP; }, get pools(){ return nQ; }, get dyn(){ return nd; }};
    })();
    var LN = 0;
    function loadLights(){
      NGL.init(); if (!NGL.ok) return;
      fetch(BASE + 'lights.bin').then(function(r){ if (!r.ok) throw new Error('lights.bin ' + r.status); return r.arrayBuffer(); }).then(function(ab){
        var u = new Uint16Array(ab), np = u[0], nq = u[1], pts = new Float32Array(np * 4), pools = [], o = 2;
        for (var i = 0; i < np; i++, o += 3){ pts[i * 4] = u[o]; pts[i * 4 + 1] = u[o + 1]; pts[i * 4 + 2] = (u[o + 2] & 255) / 20; pts[i * 4 + 3] = (u[o + 2] >> 8) / 255; }
        for (i = 0; i < nq; i++, o += 4) pools.push(u[o], u[o + 1], u[o + 2], u[o + 3] / 1000 * .55);
        GLOW.forEach(function(g){ pools.push(g[0], g[1], g[2] * 2.4, .5); });   // forges / lava
        NGL.setStatic(pts, pools); LN = np; kick();
      }).catch(function(e){ if (window.console) console.warn('map night lights', e); });
    }
    // ---- nature: deer herds grazing on the plains, whales/dolphins surfacing, an eagle circling the high peaks, a rare
    // dragon near Deathwing'in İni, a very rare faint sea-serpent in the fog belt, rainbows after storms, lightning bolts
    // (NGL, above the clouds). All tiny vector strokes, view-culled. (Tornadoes: TORN.)
    var NAT = (function(){
      var HZ = [[1512,984],[1272,1184],[1656,1264],[2112,1272],[3448,1400],[3880,1136],[3536,976]], herds = null, sea = [], nextSea = 4, sky = [], nextEagle = 20, nextDragon = 120, nextSerp = 200, bows = [], bolts = [], seen = [0, 0, 0, 0], clock = 0;
      function mkHerds(){
        herds = HZ.map(function(z){ var n = 5 + ((Math.random() * 6) | 0), d = []; for (var i = 0; i < n; i++) d.push({x: z[0] + rnd(-25, 25), y: z[1] + rnd(-18, 18), tx: 0, ty: 0, ang: rnd(0, 6.28), ph: rnd(0, 9), mv: 0});
          return {cx: z[0], cy: z[1], z: z, d: d, next: rnd(10, 40)}; });
        herds = herds.filter(function(h){ return isLand(h.cx, h.cy); });
      }
      function seaPt(minD, maxD){ var A = toWorld(0, 0), B = toWorld(vw, vh); for (var i = 0; i < 12; i++){ var x = rnd(A.x, B.x), y = rnd(A.y, B.y), d = coastDist(x, y); if (!isLand(x, y) && d > minD && d < maxD) return [x, y]; } return null; }
      function step(dt, t, lt){
        clock += dt; var zf = zoomF();
        if (!herds && land) mkHerds();
        if (herds && zf > .4) herds.forEach(function(h){
          h.next -= dt; if (h.next <= 0){ h.next = rnd(18, 50); var a = rnd(0, 6.28), r = rnd(10, 55), nx = h.z[0] + Math.cos(a) * r, ny = h.z[1] + Math.sin(a) * r; if (isLand(nx, ny)){ h.cx = nx; h.cy = ny; } }
          for (var i = 0; i < h.d.length; i++){ var e = h.d[i], gx = h.cx + Math.cos(i * 2.4) * (9 + i * 3.6), gy = h.cy + Math.sin(i * 2.4) * (6 + i * 2.6), dx = gx - e.x, dy = gy - e.y, dd = Math.hypot(dx, dy);
            if (dd > 2){ var sp = Math.min(dd, dd > 18 ? 9 : 2.2) * dt; e.x += dx / dd * sp; e.y += dy / dd * sp; e.ang = Math.atan2(dy, dx); e.mv = dd > 18 ? 2 : 1; } else e.mv = 0; }
        });
        // sea life events near the view
        nextSea -= dt; if (nextSea <= 0 && zf > .3 && sea.length < 3){ nextSea = rnd(5, 12) * (lt ? 1.6 : 1); var sp0 = seaPt(60, 600);
          if (sp0){ var wh = Math.random() < .4; sea.push({k: wh ? 'whale' : 'dolph', x: sp0[0], y: sp0[1], a: rnd(0, 6.28), t: 0, life: wh ? 9 : 5, n: wh ? 1 : 3 + ((Math.random() * 3) | 0)}); } }
        for (var i = sea.length - 1; i >= 0; i--){ sea[i].t += dt; if (sea[i].t > sea[i].life) sea.splice(i, 1); }
        // sky: eagle circling (Strömbah range / north peaks), dragon near the lair, serpent in the fog belt
        nextEagle -= dt; if (nextEagle <= 0){ nextEagle = rnd(70, 150); var ep = Math.random() < .6 ? [2200 + rnd(-250, 250), 800 + rnd(-200, 200)] : [1500 + rnd(-150, 150), 550 + rnd(-100, 100)]; sky.push({k: 'eagle', x: ep[0], y: ep[1], t: 0, life: 45, r: rnd(35, 60), a0: rnd(0, 6.28)}); }
        nextDragon -= dt; if (nextDragon <= 0){ nextDragon = rnd(240, 420); var da = rnd(0, 6.28); sky.push({k: 'dragon', x: 2233 - Math.cos(da) * 700, y: 450 - Math.sin(da) * 500, vx: Math.cos(da) * 38, vy: Math.sin(da) * 26, t: 0, life: 38}); }
        nextSerp -= dt; if (nextSerp <= 0 && !lt){ nextSerp = rnd(240, 480); var s0 = seaPt(220, 380); if (s0) sky.push({k: 'serp', x: s0[0], y: s0[1], a: rnd(0, 6.28), t: 0, life: 14}); else nextSerp = 40; }
        for (i = sky.length - 1; i >= 0; i--){ sky[i].t += dt; if (sky[i].t > sky[i].life) sky.splice(i, 1); }
        // rainbows where a storm has just rained out (daytime); lightning bolts on new flashes
        while (STORM.ended.length){ var en = STORM.ended.shift(); if (DN.v.day > .45 && t - en.t < 5 && Math.random() < (en.tier <= 3 ? .3 : .1)) bows.push({x: en.x + en.r * .3, y: en.y + en.r * .5, r: en.r * .55, t: 0, life: 45}); }
        for (i = bows.length - 1; i >= 0; i--){ bows[i].t += dt; if (bows[i].t > bows[i].life) bows.splice(i, 1); }
        if (!lt) STORM.cells.forEach(function(c0, j){ var b = c0.bolt || 0; if (b !== seen[j]){ seen[j] = b; if (c0.a > .3) bolts.push(mkBolt(c0, t)); } });
        for (i = bolts.length - 1; i >= 0; i--) if (t - bolts[i].t > .75) bolts.splice(i, 1);
      }
      function mkBolt(c0, t){
        var a = rnd(0, 6.28), rr = rnd(.1, .55) * c0.r, gx = c0.x + Math.cos(a) * rr, gy = c0.y + Math.sin(a) * rr * .7, top = rnd(110, 170), P = [], B = [];
        var n = 9, x = gx + rnd(-20, 20), y = gy - top;
        for (var i = 0; i <= n; i++){ var u = i / n; P.push([x + (gx - x) * u + (i && i < n ? rnd(-14, 14) : 0), y + (gy - y) * u]); }
        var bi = 3 + ((Math.random() * 3) | 0), bx = P[bi][0], by = P[bi][1], ba = rnd(-1, 1) > 0 ? 1 : -1; B.push([bx, by]); for (i = 1; i < 4; i++) B.push([bx + ba * i * rnd(8, 14), by + i * rnd(9, 14)]);
        return {P: P, B: B, t: t, c: c0};
      }
      function drawBolt(b, t){
        var fl = b.c.fl; if (fl < .05) return; var s = view.s;
        [b.P, b.B].forEach(function(L, li){
          for (var i = 1; i < L.length; i++){ var A = toScreen(L[i - 1][0], L[i - 1][1]), Bq = toScreen(L[i][0], L[i][1]), d = Math.hypot(Bq.x - A.x, Bq.y - A.y), n = Math.max(1, Math.min(14, (d / 4) | 0));
            if (!vis(A, 40) && !vis(Bq, 40)) continue;
            for (var j = 0; j < n; j++){ var u = j / n; NGL.flash(A.x + (Bq.x - A.x) * u, A.y + (Bq.y - A.y) * u, Math.max(3, 2.6 * s) * (li ? .7 : 1), fl * (li ? .45 : .85), 4); } }
        });
        var G = toScreen(b.P[b.P.length - 1][0], b.P[b.P.length - 1][1]); NGL.flash(G.x, G.y, Math.max(10, 16 * s), fl * .5, 4);
      }
      function deer(x, y, ang, sc, mv, t, ph, a){
        var ca = Math.cos(ang), sa = Math.sin(ang), face = ca >= 0 ? 1 : -1, L = sc, legs = mv ? Math.sin(t * (mv > 1 ? 14 : 6) + ph) * .35 : 0;
        c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, y + L * .1, L * .55, L * .16, 0, 0, 6.283); c.fill();
        c.strokeStyle = '#4a3220'; c.lineWidth = Math.max(.6, L * .1); c.beginPath();
        c.moveTo(x - L * .3 * face, y - L * .32); c.lineTo(x - L * (.3 + legs * .3) * face, y);
        c.moveTo(x + L * .28 * face, y - L * .32); c.lineTo(x + L * (.28 - legs * .3) * face, y); c.stroke();
        c.fillStyle = '#8a5a32'; c.beginPath(); c.ellipse(x, y - L * .42, L * .42, L * .17, 0, 0, 6.283); c.fill();
        var graze = !mv && Math.sin(t * .5 + ph) > .2, hx = x + L * .44 * face, hy = graze ? y - L * .1 : y - L * .78;
        c.strokeStyle = '#7a4e2a'; c.lineWidth = Math.max(.5, L * .12); c.beginPath(); c.moveTo(x + L * .3 * face, y - L * .5); c.lineTo(hx, hy); c.stroke();
        c.fillStyle = '#7a4e2a'; c.beginPath(); c.arc(hx + L * .06 * face, hy, L * .1, 0, 6.283); c.fill();
        c.fillStyle = '#efe6d6'; c.beginPath(); c.arc(x - L * .4 * face, y - L * .44, L * .06, 0, 6.283); c.fill();
      }
      function draw(t, lt){
        var s = view.s, zf = zoomF(), day = DN.v.day, nightA = 1 - DN.v.night * .65;
        if (herds && zf > .45){ var L = Math.max(3, 7 * s), al = sstep(.45, .6, zf) * nightA;
          for (var h = 0; h < herds.length; h++){ var H0 = herds[h], C = toScreen(H0.cx, H0.cy); if (!vis(C, 120)) continue;
            for (var i = 0; i < H0.d.length; i++){ var e = H0.d[i], P = toScreen(e.x, e.y); deer(P.x, P.y, e.ang, L, e.mv, t, e.ph, al); } }
          c.globalAlpha = 1; }
        for (i = 0; i < sea.length; i++){ var q = sea[i], Q = toScreen(q.x, q.y); if (!vis(Q, 60)) continue; var u = q.t / q.life, ca = Math.cos(q.a), sa = Math.sin(q.a);
          if (q.k === 'whale'){ var ws = Math.max(5, 11 * s), rise = Math.sin(Math.min(1, u * 1.15) * Math.PI);
            c.globalAlpha = .8 * rise * nightA; c.fillStyle = '#26323a'; c.beginPath(); c.ellipse(Q.x + ca * u * ws, Q.y + sa * u * ws, ws, ws * .28 * rise + .5, q.a, 0, 6.283); c.fill();
            c.globalAlpha = .35 * rise; c.strokeStyle = '#e8f2f6'; c.lineWidth = 1; c.beginPath(); c.ellipse(Q.x + ca * u * ws, Q.y + sa * u * ws, ws * 1.25, ws * .45, q.a, 0, 6.283); c.stroke();
            if (u < .35){ var sp = u / .35; c.globalAlpha = (1 - sp) * .7; c.fillStyle = '#f2f7fa'; c.beginPath(); c.ellipse(Q.x + ca * ws * .5, Q.y + sa * ws * .5 - ws * (.4 + sp * 1.2), ws * (.18 + sp * .3), ws * (.3 + sp * .5), 0, 0, 6.283); c.fill(); }
            if (u > .55 && u < .9){ var tu = (u - .55) / .35, tx = Q.x - ca * ws * .6, ty = Q.y - sa * ws * .6; c.globalAlpha = Math.sin(tu * Math.PI) * .85 * nightA; c.fillStyle = '#26323a'; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - ws * .45, ty - ws * .55 * Math.sin(tu * Math.PI)); c.lineTo(tx + ws * .45, ty - ws * .55 * Math.sin(tu * Math.PI)); c.closePath(); c.fill(); }
          } else { var ds = Math.max(2.5, 4.5 * s);
            c.lineCap = 'round'; c.lineWidth = Math.max(1.2, ds * .45);
            for (var j = 0; j < q.n; j++){ var uj = (u * 1.6 - j * .16), lj = (uj % .5) / .5; if (uj < 0 || uj > 1.4) continue; var ox = Q.x + ca * (uj * ds * 9) + (-sa) * (j - 1) * ds * 1.4, oy = Q.y + sa * (uj * ds * 9) + ca * (j - 1) * ds * 1.4;
              var arc = Math.sin(lj * Math.PI); c.globalAlpha = .85 * arc * nightA; c.strokeStyle = '#3c4a54'; c.beginPath(); c.moveTo(ox - ca * ds, oy - sa * ds); c.quadraticCurveTo(ox, oy - ds * 1.6 * arc, ox + ca * ds, oy + sa * ds); c.stroke();
              c.globalAlpha = .4 * (1 - arc); c.strokeStyle = '#eef6f8'; c.lineWidth = 1; c.beginPath(); c.arc(ox + ca * ds, oy + sa * ds, ds * .6 * (1 - arc) + .5, 0, 6.283); c.stroke(); c.lineWidth = Math.max(1.2, ds * .45); } }
        }
        c.globalAlpha = 1;
        for (i = 0; i < sky.length; i++){ var k = sky[i], fa = Math.min(1, k.t / 4, (k.life - k.t) / 4);
          if (k.k === 'eagle'){ var an = k.a0 + k.t * .35, ex = k.x + Math.cos(an) * k.r, ey = k.y + Math.sin(an) * k.r * .6, E = toScreen(ex, ey); if (!vis(E, 80) || zf < .15) continue;
            var es = Math.max(4, 7 * s), dir = an + 1.57, cx2 = Math.cos(dir), sx2 = Math.sin(dir); var Sh = toScreen(ex + 30, ey + 46);
            [[Sh, 'rgba(0,0,0,' + (.14 * fa) + ')'], [E, 'rgba(26,22,20,' + (.9 * fa * nightA) + ')']].forEach(function(o){ var X = o[0]; c.fillStyle = o[1]; c.beginPath(); c.moveTo(X.x + cx2 * es * .5, X.y + sx2 * es * .5);
              c.quadraticCurveTo(X.x - sx2 * es * .6, X.y + cx2 * es * .6 - es * .25, X.x - sx2 * es * 1.3 - cx2 * es * .2, X.y + cx2 * es * 1.3 - sx2 * es * .2); c.lineTo(X.x - cx2 * es * .5, X.y - sx2 * es * .5);
              c.lineTo(X.x + sx2 * es * 1.3 - cx2 * es * .2, X.y - cx2 * es * 1.3 - sx2 * es * .2); c.quadraticCurveTo(X.x + sx2 * es * .6, X.y - cx2 * es * .6 - es * .25, X.x + cx2 * es * .5, X.y + sx2 * es * .5); c.fill(); });
          } else if (k.k === 'dragon' || k.k === 'serp'){ if (k.k === 'serp' && !k.sum){ drawHigh(k, fa); c.globalAlpha = 1; } else { var c00 = c; try { c = skyCtx(); drawHigh(k, fa); c.globalAlpha = 1; } finally { c = c00; } } }
        }
        // rainbows + lightning bolts (t139: these lines had slipped into drawHigh, where day/t/i are undefined -> ReferenceError
        // every frame a dragon/serpent was up: the frame died, c stayed on the sky canvas and the loop stopped)
        if (day > .3) for (i = 0; i < bows.length; i++){ var b = bows[i], R0 = b.r * s, Bc = toScreen(b.x, b.y); if (!vis(Bc, R0 * 1.2)) continue; var ba = Math.min(1, b.t / 8, (b.life - b.t) / 12) * .26 * day;
          var g = c.createRadialGradient(Bc.x, Bc.y, R0 * .86, Bc.x, Bc.y, R0); ['rgba(140,60,200,0)', 'rgba(140,60,200,1)', 'rgba(60,110,255,1)', 'rgba(60,200,120,1)', 'rgba(250,230,70,1)', 'rgba(255,150,40,1)', 'rgba(240,50,40,1)', 'rgba(240,50,40,0)'].forEach(function(cl, ci){ g.addColorStop(ci / 7, cl); });
          c.globalAlpha = ba; c.strokeStyle = g; c.lineWidth = R0 * .14; c.beginPath(); c.arc(Bc.x, Bc.y, R0 * .93, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); c.globalAlpha = 1; }
        for (i = 0; i < bolts.length; i++) drawBolt(bolts[i], t);
      }
      function drawHigh(k, fa){
        var s = view.s, zf = zoomF(), nightA = 1 - DN.v.night * .65;
        {
          if (k.k === 'dragon'){ var dx = k.x + k.vx * k.t, dy = k.y + k.vy * k.t + Math.sin(k.t * .6) * 30, D = toScreen(dx, dy); if (!vis(D, 420)) return;
            var dsz = Math.max(27, 66 * s), ang2 = Math.atan2(k.vy, k.vx), c3 = Math.cos(ang2), s3 = Math.sin(ang2), flap = Math.sin(k.t * 3.2);
            [[toScreen(dx + 70, dy + 110), .16 * fa, '0,0,0'], [D, .92 * fa * nightA, '30,18,16']].forEach(function(o){ var X = o[0]; c.fillStyle = 'rgba(' + o[2] + ',' + o[1] + ')'; c.strokeStyle = c.fillStyle;
              c.lineWidth = Math.max(1, dsz * .14); c.lineCap = 'round'; c.beginPath(); c.moveTo(X.x + c3 * dsz * .8, X.y + s3 * dsz * .8); c.quadraticCurveTo(X.x - c3 * dsz * .8 + s3 * dsz * .25 * flap, X.y - s3 * dsz * .8 - c3 * dsz * .25 * flap, X.x - c3 * dsz * 1.6, X.y - s3 * dsz * 1.6); c.stroke();
              var wl = dsz * (1.1 + .25 * flap), wb = dsz * .35 * flap;
              for (var sg = -1; sg <= 1; sg += 2){ c.beginPath(); c.moveTo(X.x + c3 * dsz * .3, X.y + s3 * dsz * .3); c.lineTo(X.x - s3 * wl * sg + c3 * wb, X.y + c3 * wl * sg + s3 * wb - dsz * .2 * flap);
                c.lineTo(X.x - s3 * wl * .7 * sg - c3 * dsz * .5, X.y + c3 * wl * .7 * sg - s3 * dsz * .5); c.lineTo(X.x - c3 * dsz * .35, X.y - s3 * dsz * .35); c.closePath(); c.fill(); }
              c.beginPath(); c.ellipse(X.x, X.y, dsz * .55, dsz * .16, ang2, 0, 6.283); c.fill(); });
          } else if (k.k === 'serp'){ var Sp = toScreen(k.x, k.y); if (!vis(Sp, 300) || (zf < .2 && !k.sum)) return;
            var ssz = Math.max(18, 36 * s), ca4 = Math.cos(k.a), sa4 = Math.sin(k.a), mv2 = k.t * .9; c.globalAlpha = (k.sum ? .7 : .22) * fa; c.strokeStyle = '#1c2a30'; c.lineWidth = Math.max(1.5, ssz * .28); c.lineCap = 'round';
            for (var hm = 0; hm < 3; hm++){ var ph2 = (mv2 + hm * .8) % 2.4, ar = Math.sin(Math.min(1, ph2 / 1.6) * Math.PI); if (ar <= 0) continue; var bx = Sp.x + ca4 * (hm * ssz * 2.2 + k.t * ssz * .35), by = Sp.y + sa4 * (hm * ssz * 2.2 + k.t * ssz * .35);
              c.beginPath(); c.moveTo(bx - ca4 * ssz, by - sa4 * ssz); c.quadraticCurveTo(bx, by - ssz * 1.3 * ar, bx + ca4 * ssz, by + sa4 * ssz); c.stroke(); }
            c.globalAlpha = 1; }
        }
      }
      return {step: step, draw: draw, st: function(){ return {herds: herds ? herds.length : 0, sea: sea.length, sky: sky.map(function(k){ return k.k; }), bows: bows.length, bolts: bolts.length}; },
        force: function(k, x, y){ if (k === 'whale' || k === 'dolph') sea.push({k: k, x: x, y: y, a: .3, t: 0, life: k === 'whale' ? 9 : 5, n: 4}); else if (k === 'bow') bows.push({x: x, y: y, r: 300, t: 8, life: 60}); else if (k === 'dragon') sky.push({k: 'dragon', x: x - 300, y: y, vx: 30, vy: 4, t: 5, life: 30}); else if (k === 'eagle') sky.push({k: 'eagle', x: x, y: y, t: 5, life: 40, r: 45, a0: 0}); else if (k === 'serp') sky.push({k: 'serp', x: x, y: y, a: .2, t: 3, life: 14}); }};
    })();
    // ---- tornadoes / waterspouts: a RARE event of its own (not every storm). At most 2 at once, anywhere on land or near
    // coasts at sea (never the Southern Lands desert); random size skewed small, never huge. Each has its own small dark
    // cloud cap, a swaying funnel and a spinning debris/spray skirt; it wanders ~40-70 s and ropes out.
    var TORN = (function(){
      var L = [], next = 80 + Math.random() * 110, cap = null;
      function capSprite(){ if (cap) return cap; var n = 96, cv0 = document.createElement('canvas'); cv0.width = cv0.height = n; var x = cv0.getContext('2d');
        var g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(30,32,38,.97)'); g.addColorStop(.45, 'rgba(44,47,55,.8)'); g.addColorStop(.75, 'rgba(58,62,70,.35)'); g.addColorStop(1, 'rgba(64,68,76,0)');
        x.fillStyle = g; x.fillRect(0, 0, n, n); return (cap = cv0); }
      function spawn(x, y, sc){
        if (x == null){ for (var i = 0; i < 40; i++){ var px = rnd(250, W - 250), py = rnd(250, H - 250); if (STORM.south(px, py)) continue; if (!isLand(px, py) && coastDist(px, py) > 380) continue;
            if (L.some(function(o){ return Math.hypot(o.x - px, o.y - py) < 300; })) continue; x = px; y = py; break; } if (x == null) return false; }
        if (sc == null){ var u = Math.random(); sc = .62 + .42 * u * u * u; }   // mostly ~0.62-0.75, at most ~1.04
        var a0 = rnd(0, 6.283); L.push({x: x, y: y, sc: sc, t: 0, life: rnd(40, 70), vx: 5 + Math.cos(a0) * 4, vy: 1.5 + Math.sin(a0) * 3, ph: rnd(0, 9)}); return true;
      }
      function step(dt, lt){
        var on = wxActive() && !lt;
        for (var i = L.length - 1; i >= 0; i--){ var k = L[i]; k.t += dt; if (!on) k.life = Math.min(k.life, k.t + 6); if (k.cell){ var cc0 = k.cell; if (cc0.tier !== 5) k.life = Math.min(k.life, k.t + 6); k.ox += Math.sin(k.t * .21 + k.ph) * dt * 4; k.oy += Math.cos(k.t * .17 + k.ph) * dt * 2.5; k.x = cc0.x + k.ox; k.y = cc0.y + k.oy; } else { k.x += k.vx * dt; k.y += k.vy * dt; } k.vx += Math.sin(k.t * .23 + k.ph) * dt * .9; k.vy += Math.cos(k.t * .17 + k.ph) * dt * .6;
          if (STORM.south(k.x, k.y)) k.life = Math.min(k.life, k.t + 5); if (k.t > k.life) L.splice(i, 1); }
        if (!on) return;
      }
      function near(x, y){ var b = 0; for (var i = 0; i < L.length; i++){ var k = L[i], fa = Math.max(0, Math.min(1, k.t / 5, (k.life - k.t) / 6)); b = Math.max(b, fa * (1 - sstep(60, 420 * k.sc, Math.hypot(k.x - x, k.y - y)))); } return b; }
      function draw(t){
        if (!L.length) return; var s = view.s, cp = capSprite();
        for (var i = 0; i < L.length; i++){
          var k = L[i], G = toScreen(k.x, k.y), hgt = Math.max(30, 165 * s) * k.sc, wd = Math.max(3, 11 * s) * k.sc; if (!vis(G, hgt * 1.4)) continue;
          var fa = Math.min(1, k.t / 5, (k.life - k.t) / 6); if (fa <= 0) continue; var rope = sstep(k.life - 9, k.life, k.t), wet = !isLand(k.x, k.y), tw = t * 2.1 + k.ph;
          var lean = Math.sin(t * .4 + k.ph) * .25 + rope * .9, wdk = wd * (1 - .65 * rope);
          // ground contact: spray (sea) or dust (land) ring + spinning debris
          c.globalAlpha = .45 * fa; c.fillStyle = wet ? 'rgba(226,236,242,.85)' : 'rgba(150,122,92,.85)';
          c.beginPath(); c.ellipse(G.x, G.y, wdk * 3.6 + Math.sin(t * 5 + k.ph) * wdk * .3, wdk * 1.2, 0, 0, 6.283); c.fill(); c.globalAlpha = .3 * fa; c.beginPath(); c.ellipse(G.x, G.y - wdk * .8, wdk * 2.2, wdk * 1.6, 0, 0, 6.283); c.fill();
          c.globalAlpha = .7 * fa; c.fillStyle = wet ? 'rgba(236,244,248,.9)' : 'rgba(92,72,52,.9)'; c.beginPath();
          for (var j = 0; j < 9; j++){ var aj = t * 3.4 + j * .7 + k.ph, rj = wdk * (2 + 1.2 * ((j * 37) % 5) / 5), hj = (j % 3) * wdk * .9; var X = G.x + Math.cos(aj) * rj, Y = G.y - hj + Math.sin(aj) * rj * .32, rr = Math.max(.5, wdk * .16); c.moveTo(X + rr, Y); c.arc(X, Y, rr, 0, 6.283); }
          c.fill();
          // funnel: rope-thin at the ground, flaring into the cap like a trumpet; the centre line bends (elbow) and sways.
          // Three soft layered passes (outer veil, body, darker core) instead of one hard-edged cone.
          var bend = lean * hgt, sw = Math.sin(tw * .5) * wdk * 1.6;
          function cxu(uu){ return G.x + bend * uu * uu * .55 + Math.sin(3.1416 * uu) * sw + Math.sin(tw + uu * 5) * wdk * .45 * uu; }
          function hwu(uu){ return wdk * (.42 + 3.9 * uu * uu * uu + .5 * uu); }
          var gg = c.createLinearGradient(0, G.y, 0, G.y - hgt);
          gg.addColorStop(0, wet ? 'rgba(214,224,230,.95)' : 'rgba(150,124,94,.95)'); gg.addColorStop(.4, 'rgba(150,154,162,.97)'); gg.addColorStop(1, 'rgba(92,96,106,1)');
          c.fillStyle = gg;
          for (var pass = 0; pass < 3; pass++){ var wm = pass === 0 ? 1.4 : pass === 1 ? 1 : .5, am = pass === 0 ? .4 : pass === 1 ? .85 : .55;
            c.beginPath(); for (var st2 = 0; st2 <= 14; st2++){ var uu = st2 / 14; c.lineTo(cxu(uu) - hwu(uu) * wm, G.y - uu * hgt); }
            for (st2 = 14; st2 >= 0; st2--){ uu = st2 / 14; c.lineTo(cxu(uu) + hwu(uu) * wm, G.y - uu * hgt); }
            c.closePath(); c.globalAlpha = am * fa; c.fill(); }
          c.fillStyle = 'rgba(40,42,50,.5)'; c.beginPath(); for (st2 = 0; st2 <= 14; st2++){ uu = st2 / 14; c.lineTo(cxu(uu) + hwu(uu) * .15, G.y - uu * hgt); } for (st2 = 14; st2 >= 0; st2--){ uu = st2 / 14; c.lineTo(cxu(uu) + hwu(uu) * 1.05, G.y - uu * hgt); } c.closePath(); c.globalAlpha = .55 * fa; c.fill();   // shaded side
          // spinning spiral streaks wrapping the funnel
          c.strokeStyle = 'rgba(222,228,234,.55)'; c.lineWidth = Math.max(.6, wdk * .2); c.beginPath(); c.globalAlpha = .8 * fa;
          for (j = 0; j < 6; j++){ var u0 = ((t * .7 + k.ph + j / 6) % 1) * .92 + .04; for (st2 = 0; st2 <= 5; st2++){ uu = Math.min(1, u0 + st2 * .035); var hx = cxu(uu) + Math.sin(t * 7 + j * 1.7 + st2 * .9) * hwu(uu) * .85, hy = G.y - uu * hgt + st2 * wdk * .08; if (st2) c.lineTo(hx, hy); else c.moveTo(hx, hy); } }
          c.stroke();
          // cloud cap (over the funnel top)
          var R = hgt * 1.05; c.globalAlpha = .95 * fa; c.drawImage(cp, G.x + lean * hgt * .5 - R, G.y - hgt - R * .4, R * 2, R * .8); c.drawImage(cp, G.x + lean * hgt * .5 - R * .6, G.y - hgt - R * .3, R * 1.2, R * .55);
          c.globalAlpha = 1;
        }
      }
      return {step: step, draw: draw, near: near, count: function(){ return L.length; }, list: function(){ return L.map(function(k){ return [Math.round(k.x), Math.round(k.y), +k.sc.toFixed(2), +k.t.toFixed(0)]; }); },
        force: function(x, y, sc){ L.length = 0; spawn(x, y, sc); L[0].t = 6; }, nextIn: function(){ return -1; },
        attach: function(c0){ L.length = 0; var u = Math.random(); L.push({cell: c0, ox: c0.r * rnd(-.15, .15), oy: c0.r * rnd(0, .2), x: c0.x, y: c0.y, sc: .66 + .3 * u * u, t: -12, life: c0.life - 26, vx: 0, vy: 0, ph: rnd(0, 9)}); },
        detach: function(){ L.length = 0; }};
    })();
    // ---- coastal fishing boats: many small boats close to the shore near settlements/harbours. They potter between
    // fishing spots, stop to fish (bobbing, net drifting) and carry one lantern at night. Not in the abandoned south.
    var FISHB = [], fishPts = null;
    function mkFishPts(){
      fishPts = []; var S = DATA.settlements.map(function(q){ return [q[0], q[1]]; }).concat(PORTS);
      for (var i = 0; i < 3000 && fishPts.length < 320 && S.length; i++){ var s0 = S[(Math.random() * S.length) | 0], a0 = rnd(0, 6.283), r0 = rnd(50, 460), x = s0[0] + Math.cos(a0) * r0, y = s0[1] + Math.sin(a0) * r0;
        if (x < 40 || y < 40 || x > W - 40 || y > H - 40 || isLand(x, y) || STORM.south(x, y) || y > 3500) continue; var d = coastDist(x, y); if (d > 16 && d < 80) fishPts.push([x, y]); }
    }
    function fishTarget(k){ for (var i = 0; i < 8; i++){ var a0 = rnd(0, 6.283), r0 = rnd(20, 70), x = k.hx + Math.cos(a0) * r0, y = k.hy + Math.sin(a0) * r0, d = coastDist(x, y); if (!isLand(x, y) && d > 10 && d < 95){ k.tx = x; k.ty = y; return; } } k.tx = k.hx; k.ty = k.hy; }
    function stepFish(dt, lt){
      if (!fishPts){ if (land && field && routesReady) mkFishPts(); return; }
      if (!fishPts.length) return;
      var want = lt ? 10 : 32;
      while (FISHB.length < want){ var p0 = fishPts[(Math.random() * fishPts.length) | 0], k = {hx: p0[0], hy: p0[1], x: p0[0], y: p0[1], ang: rnd(0, 6.283), st: Math.random() < .5 ? 1 : 0, w: rnd(2, 14), t: 0, ph: rnd(0, 9), sz: rnd(.8, 1.1), v: rnd(3.5, 6)}; fishTarget(k); FISHB.push(k); }
      while (FISHB.length > want) FISHB.pop();
      for (var i = 0; i < FISHB.length; i++){ var b = FISHB[i]; b.t += dt;
        if (b.st){ b.w -= dt; if (b.w <= 0){ b.st = 0; fishTarget(b); } continue; }
        var dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy); if (d < 3){ b.st = 1; b.w = rnd(6, 22); continue; }
        var want2 = Math.atan2(dy, dx), da = Math.atan2(Math.sin(want2 - b.ang), Math.cos(want2 - b.ang)); b.ang += clamp(da, -1.2 * dt, 1.2 * dt);
        var nx = b.x + Math.cos(b.ang) * b.v * dt, ny = b.y + Math.sin(b.ang) * b.v * dt; if (isLand(nx, ny)){ fishTarget(b); b.ang += 1.2; } else { b.x = nx; b.y = ny; } }
    }
    function drawFish(t, nv, zf){
      if (zf < .16 || !FISHB.length) return;
      var s = view.s, base = clamp(40 * s, 7, 30) * .62, al = sstep(.16, .26, zf), V = new Path2D(), anyV = false;
      for (var i = 0; i < FISHB.length; i++){ var b = FISHB[i], P = toScreen(b.x, b.y); if (!vis(P, 30)) continue; var fa = Math.min(1, b.t / 3) * al;
        if (!b.st){ var L0 = base * b.sz * .7, ca = Math.cos(b.ang), sa = Math.sin(b.ang), bx = P.x - ca * L0 * .45, by = P.y - sa * L0 * .45;   // tiny V wake
          V.moveTo(bx - ca * L0 * 1.4 - sa * L0 * .5, by - sa * L0 * 1.4 + ca * L0 * .5); V.lineTo(bx, by); V.lineTo(bx - ca * L0 * 1.4 + sa * L0 * .5, by - sa * L0 * 1.4 - ca * L0 * .5); anyV = true; }
        c.save(); c.translate(P.x, P.y + (b.st ? Math.sin(t * 1.7 + b.ph) * .4 : 0)); c.globalAlpha = fa; drawShip(base * b.sz, 'fishing', b.st ? b.ang + Math.sin(t * .3 + b.ph) * .3 : b.ang, t, b.ph); c.restore();
        if (nv > .02) NGL.lamp(P.x, P.y - base * b.sz * .35, Math.max(.9, base * .05), fa * .85, b.ph, base * b.sz * .8);
      }
      if (anyV){ c.globalAlpha = .5 * al; c.strokeStyle = 'rgba(236,246,250,.45)'; c.lineWidth = Math.max(.5, base * .05); c.stroke(V); c.globalAlpha = 1; }
    }
    // ---- snowfall (weather on; snowy north & the Strömbah peaks): crisp screen-space flakes in 3 depth layers drawn at full
    // resolution from tiny pre-rendered soft sprites (replaces the old half-res shader flakes, which were big and blurry).
    // Far layer: many tiny slow flakes; near layer: few, a little larger, faster, more parallax. Light mode: none.
    var SNOW = (function(){
      var F = [], spr = null, lvx = null, lvy = 0, ls = 0, on = 0;
      function sprites(){ if (spr && spr.d === dpr) return spr; spr = {d: dpr, c: []};
        [.9, 1.25, 1.75].forEach(function(r){ var R = Math.max(2, Math.ceil(r * 2.4 * dpr)), cv0 = document.createElement('canvas'); cv0.width = cv0.height = R * 2; var x = cv0.getContext('2d');
          var g = x.createRadialGradient(R, R, 0, R, R, R); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(250,252,255,.9)'); g.addColorStop(.62, 'rgba(236,244,255,.28)'); g.addColorStop(1, 'rgba(236,244,255,0)');
          x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2); spr.c.push({cv: cv0, r: R / dpr}); }); return spr; }
      function amt(wx, wy){ return Math.max(1 - sstep(560, 980, wy), 1 - sstep(260, 520, Math.hypot(wx - 2290, (wy - 700) * 1.5))); }
      function step(dt, t, lt, zf){
        var want = 0;
        if (wxOn && !lt && zf > .1){ var A = toWorld(0, 0), B = toWorld(vw, vh), m = 0; for (var gy = 0; gy <= 2; gy++) for (var gx = 0; gx <= 2; gx++) m = Math.max(m, amt(A.x + (B.x - A.x) * gx / 2, A.y + (B.y - A.y) * gy / 2));
          if (m > .03) want = Math.round(clamp(vw * vh / 3400, 80, 360) * sstep(.1, .3, zf)); }
        on = want;
        if (!want){ F.length = 0; lvx = null; return; }
        while (F.length < want){ var r = Math.random(), z = r < .52 ? 0 : r < .84 ? 1 : 2; F.push({x: rnd(0, vw), y: rnd(-10, vh), z: z, sp: rnd(.75, 1.25), ph: rnd(0, 6.283), fr: rnd(.8, 1.6)}); }
        if (F.length > want) F.length = want;
        var dx = lvx == null ? 0 : view.x - lvx, dy = lvx == null ? 0 : view.y - lvy, gust = .6 + .5 * Math.sin(t * .23) + .25 * Math.sin(t * .71); lvx = view.x; lvy = view.y;
        if (Math.abs(view.s - ls) / (ls || 1) > .02){ dx = dy = 0; } ls = view.s;
        for (var i = 0; i < F.length; i++){ var f = F[i], zz = f.z * .5, par = .25 + .5 * zz;
          f.y += ((11 + 26 * zz) * f.sp) * dt + dy * par; f.x += ((6 + 12 * zz) * gust + Math.sin(t * f.fr + f.ph) * (3 + 6 * zz)) * dt + dx * par;
          if (f.y > vh + 4){ f.y -= vh + 8; f.x = rnd(0, vw); } else if (f.y < -6) f.y += vh + 8;
          if (f.x > vw + 4) f.x -= vw + 8; else if (f.x < -4) f.x += vw + 8; }
      }
      function draw(zf){
        if (!on || !F.length) return; var S = sprites(), nt = 1 - DN.v.night * .4, za = sstep(.1, .3, zf) * nt, s = view.s;
        for (var i = 0; i < F.length; i++){ var f = F[i], a = amt((f.x - view.x) / s, (f.y - view.y) / s); if (a < .03) continue; var o = S.c[f.z];
          c.globalAlpha = Math.min(1, a * za * (.72 + .14 * f.z)); c.drawImage(o.cv, f.x - o.r, f.y - o.r, o.r * 2, o.r * 2); }
        c.globalAlpha = 1;
      }
      return {step: step, draw: draw, n: function(){ return on; }};
    })();
    // ---- steampunk balloon airships around Mital Alari (t129): 0-5 at once, all one size (small-medium). Each spawns near
    // the city, wanders loosely (random waypoints, no fixed route, never far away), then fades out. The body is a cached
    // high-res sprite per zoom bucket (drawn once, blitted every frame); only the propeller, bob, ground shadow, the faint
    // engine-steam trail and the night lamps are live. Light mode: at most 2, no steam trail.
    var AIRS = (function(){
      var MA = [3630, 1080], A = [], P = [], want = 1 + ((Math.random() * 3) | 0), nextS = rnd(2, 10), nextW = rnd(90, 200), cache = {}, puffC = null;
      function sprite(Lc){   // Lc = envelope length in css px (bucketed); sprite faces LEFT
        var key = Lc + ':' + dpr; if (cache[key]) return cache[key];
        var ks = Object.keys(cache); if (ks.length > 6) delete cache[ks[0]];
        var Lp = Lc * dpr, w = Math.ceil(Lp * 1.16), h = Math.ceil(Lp * .74), cv0 = document.createElement('canvas'); cv0.width = w; cv0.height = h;
        var x = cv0.getContext('2d'), L = Lp; x.translate(w * .5, h * .36);
        var ey = -L * .06, rx = L * .5, ry = L * .165;
        function env(){ x.beginPath(); x.moveTo(-rx, ey); x.bezierCurveTo(-rx, ey - ry * 1.05, -rx * .35, ey - ry, rx * .25, ey - ry * .92); x.bezierCurveTo(rx * .78, ey - ry * .8, rx, ey - ry * .25, rx, ey);
          x.bezierCurveTo(rx, ey + ry * .25, rx * .78, ey + ry * .8, rx * .25, ey + ry * .92); x.bezierCurveTo(-rx * .35, ey + ry, -rx, ey + ry * 1.05, -rx, ey); x.closePath(); }
        // tail fins (behind the envelope)
        x.fillStyle = '#6e3220'; x.strokeStyle = '#c99a48'; x.lineWidth = Math.max(.6, L * .008);
        [[-1], [1]].forEach(function(sg){ var d = sg[0]; x.beginPath(); x.moveTo(rx * .58, ey + d * ry * .55); x.lineTo(rx * 1.04, ey + d * ry * 1.32); x.lineTo(rx * 1.1, ey + d * ry * 1.25); x.lineTo(rx * .98, ey + d * ry * .3); x.closePath(); x.fill(); x.stroke();
          x.strokeStyle = 'rgba(40,18,10,.5)'; x.beginPath(); x.moveTo(rx * .72, ey + d * ry * .7); x.lineTo(rx * 1.02, ey + d * ry * 1.15); x.stroke(); x.strokeStyle = '#c99a48'; });
        // rigging: envelope belly -> gondola
        var gy = L * .2, gx0 = -L * .2, gx1 = L * .2;
        x.strokeStyle = 'rgba(52,36,22,.75)'; x.lineWidth = Math.max(.5, L * .005); x.beginPath();
        for (var i = 0; i <= 6; i++){ var ax = -rx * .62 + i * rx * 1.24 / 6, bx = gx0 + (gx1 - gx0) * i / 6 * .9 + L * .02; x.moveTo(ax, ey + ry * .86); x.lineTo(bx, gy - L * .03); } x.stroke();
        // envelope: varnished canvas with soft shading
        env(); var g = x.createLinearGradient(0, ey - ry, 0, ey + ry); g.addColorStop(0, '#f1e3bd'); g.addColorStop(.35, '#d9bf8a'); g.addColorStop(.75, '#a77f4c'); g.addColorStop(1, '#6f4f2c');
        x.fillStyle = g; x.fill();
        x.save(); env(); x.clip();
        var hg = x.createRadialGradient(-rx * .35, ey - ry * .55, 0, -rx * .35, ey - ry * .55, rx * .7); hg.addColorStop(0, 'rgba(255,250,232,.55)'); hg.addColorStop(1, 'rgba(255,250,232,0)'); x.fillStyle = hg; x.fillRect(-rx, ey - ry, rx * 2, ry * 2);
        x.strokeStyle = 'rgba(96,64,34,.32)'; x.lineWidth = Math.max(.5, L * .005);   // longitudinal seams
        for (i = -2; i <= 2; i++){ var f = i / 3; x.beginPath(); x.moveTo(-rx, ey + f * ry * .15); x.bezierCurveTo(-rx * .4, ey + f * ry * 1.05, rx * .5, ey + f * ry * .95, rx, ey + f * ry * .1); x.stroke(); }
        x.strokeStyle = '#b8873a'; x.lineWidth = Math.max(.8, L * .014);   // brass hoops
        [-.55, -.18, .2, .55].forEach(function(u){ var bx = rx * u, hh = ry * Math.sqrt(Math.max(0, 1 - u * u)) * 1.02; x.beginPath(); x.ellipse(bx, ey, Math.max(.6, L * .018), hh, 0, 0, 6.283); x.stroke(); });
        x.fillStyle = 'rgba(40,22,10,.18)'; x.fillRect(-rx, ey + ry * .55, rx * 2, ry);   // belly shadow
        x.restore();
        env(); x.strokeStyle = 'rgba(58,38,20,.85)'; x.lineWidth = Math.max(.6, L * .009); x.stroke();
        x.fillStyle = '#c4923e'; x.beginPath(); x.arc(-rx + L * .012, ey, Math.max(.8, L * .016), 0, 6.283); x.fill();   // brass nose cap
        // gondola: a little wooden hull with brass rail, round lit portholes, engine house and stack
        x.fillStyle = '#7a5530'; x.fillRect(L * .1, gy - L * .085, L * .07, L * .05);   // engine house
        x.fillStyle = '#9a7036'; x.fillRect(L * .125, gy - L * .135, L * .022, L * .06); x.fillStyle = '#c99a48'; x.fillRect(L * .118, gy - L * .14, L * .036, L * .012);   // stack
        x.beginPath(); x.moveTo(gx0 - L * .04, gy - L * .035); x.lineTo(gx1 + L * .02, gy - L * .035); x.quadraticCurveTo(gx1 + L * .02, gy + L * .04, gx1 - L * .05, gy + L * .055);
        x.lineTo(gx0 + L * .03, gy + L * .055); x.quadraticCurveTo(gx0 - L * .03, gy + L * .04, gx0 - L * .04, gy - L * .035); x.closePath();
        var wg = x.createLinearGradient(0, gy - L * .035, 0, gy + L * .055); wg.addColorStop(0, '#8a5a2c'); wg.addColorStop(.5, '#5e3a1a'); wg.addColorStop(1, '#3a220e'); x.fillStyle = wg; x.fill();
        x.strokeStyle = 'rgba(28,16,6,.55)'; x.lineWidth = Math.max(.4, L * .004); x.beginPath();
        for (i = 1; i <= 2; i++){ var py = gy - L * .035 + i * L * .03; x.moveTo(gx0 - L * .03 + i * L * .008, py); x.lineTo(gx1 + L * .01 - i * L * .02, py); } x.stroke();
        x.strokeStyle = '#c99a48'; x.lineWidth = Math.max(.7, L * .009); x.beginPath(); x.moveTo(gx0 - L * .045, gy - L * .037); x.lineTo(gx1 + L * .025, gy - L * .037); x.stroke();
        x.fillStyle = '#f2cf78'; x.strokeStyle = '#b8873a'; x.lineWidth = Math.max(.4, L * .005);
        for (i = 0; i < 4; i++){ x.beginPath(); x.arc(gx0 + L * .02 + i * L * .07, gy - L * .006, Math.max(.6, L * .011), 0, 6.283); x.fill(); x.stroke(); }
        x.fillStyle = '#4a2d14'; x.fillRect(gx1 + L * .015, gy - L * .012, L * .03, L * .012);   // prop shaft
        return (cache[key] = {cv: cv0, w: w / dpr, h: h / dpr, ox: w * .5 / dpr, oy: h * .36 / dpr});
      }
      function puffSprite(){ if (puffC) return puffC; var n = 32, cv0 = document.createElement('canvas'); cv0.width = cv0.height = n; var x = cv0.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
        g.addColorStop(0, 'rgba(245,245,242,1)'); g.addColorStop(.5, 'rgba(240,240,236,.45)'); g.addColorStop(1, 'rgba(240,240,236,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); return (puffC = cv0); }
      function wp(k){ var a0 = rnd(0, 6.283), r0 = rnd(60, 470); k.tx = MA[0] + Math.cos(a0) * r0 * 1.15; k.ty = MA[1] + Math.sin(a0) * r0 * .8; }
      function spawn(stag){ var a0, r0, px, py; for (var n = 0; n < 12; n++){ a0 = rnd(0, 6.283); r0 = rnd(120, 430); px = MA[0] + Math.cos(a0) * r0 * 1.15; py = MA[1] + Math.sin(a0) * r0 * .8; if (!A.some(function(o){ return Math.hypot(o.x - px, (o.y - py) * 1.6) < 200; })) break; }
        var k = {x: px, y: py, v: rnd(6, 10), ang: rnd(0, 6.283), t: stag ? rnd(6, 60) : 0, life: rnd(110, 240), ph: rnd(0, 9), em: 0, face: 1};
        wp(k); A.push(k); }
      function step(dt, lt){
        var cap = lt ? Math.min(2, want) : want;
        nextW -= dt; if (nextW <= 0){ want = (Math.random() * 6) | 0; nextW = rnd(120, 260); }   // the sky can be empty (0) or busy (5)
        if (!A.length && !step.init){ step.init = 1; for (var j = 0; j < Math.min(cap, 2); j++) spawn(true); }
        nextS -= dt; if (nextS <= 0){ if (A.length < cap) spawn(false); nextS = rnd(12, 40); }
        for (var i = A.length - 1; i >= 0; i--){ var k = A[i]; k.t += dt;
          if (A.length > cap && k.life > k.t + 6) k.life = k.t + 6;   // over the cap: ease one out
          var dx = k.tx - k.x, dy = k.ty - k.y, d = Math.hypot(dx, dy); if (d < 25) wp(k);
          var da = Math.atan2(Math.sin(Math.atan2(dy, dx) - k.ang), Math.cos(Math.atan2(dy, dx) - k.ang)); k.ang += clamp(da, -.25 * dt, .25 * dt);
          for (var j2 = 0; j2 < A.length; j2++){ var o = A[j2]; if (o === k) continue; var ex = k.x - o.x, ey2 = (k.y - o.y) * 1.6, ed = Math.hypot(ex, ey2); if (ed < 150 && ed > .1){ k.x += ex / ed * (150 - ed) * .25 * dt; k.y += ey2 / ed * (150 - ed) * .15 * dt; } }   // keep apart
          k.x += Math.cos(k.ang) * k.v * dt; k.y += Math.sin(k.ang) * k.v * dt; var cf = Math.cos(k.ang) > 0 ? -1 : 1; k.face += clamp(cf - k.face, -dt * .8, dt * .8);
          k.em += dt; if (!lt && k.em > .45 && P.length < 70){ k.em = 0; var Lw = clamp(80 * view.s, 26, 116) / view.s;   // stack top, world units
            P.push({x: k.x + k.face * Lw * .136, y: k.y + Lw * .06, vx: rnd(-1.2, 1.2), vy: rnd(-3.2, -1.8), t: 0, a: Math.min(1, k.t / 4, (k.life - k.t) / 5)}); }
          if (k.t > k.life) A.splice(i, 1); }
        for (i = P.length - 1; i >= 0; i--){ var q = P[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.t > 4.5) P.splice(i, 1); }
      }
      function draw(t, nv, zf, lt){
        if (!A.length || zf < .12) return; var s = view.s, Lc = clamp(80 * s, 26, 116), Lb = Math.round(Math.pow(1.12, Math.round(Math.log(Lc) / Math.log(1.12)))), al = sstep(.12, .22, zf), sp = sprite(Lb), sc = Lc / Lb, pc = puffSprite();
        // faint engine steam: emitted in world space so it trails behind on the wind of motion
        var i, k; if (!lt){ c.globalAlpha = 1; for (i = 0; i < P.length; i++){ var q = P[i], Q = toScreen(q.x, q.y); if (!vis(Q, 20)) continue; var r = (1.2 + q.t * 1.6) * Lc / 40;
            c.globalAlpha = .16 * (1 - q.t / 4.5) * q.a * al; c.drawImage(pc, Q.x - r, Q.y - r, r * 2, r * 2); } }
        for (i = 0; i < A.length; i++){ k = A[i]; var G = toScreen(k.x, k.y); if (!vis(G, Lc * 2)) continue;
          var fa = Math.min(1, k.t / 4, (k.life - k.t) / 5) * al, bob = Math.sin(t * .7 + k.ph) * Lc * .025;
          c.globalAlpha = .13 * fa; c.fillStyle = '#1a1612'; c.beginPath(); c.ellipse(G.x + Lc * .2, G.y + Lc * .95, Lc * .42, Lc * .1, 0, 0, 6.283); c.fill();   // shadow on the ground far below
          c.save(); c.translate(G.x, G.y + bob); c.rotate(Math.sin(t * .5 + k.ph) * .025); c.scale(k.face * sc, sc); c.globalAlpha = fa;
          c.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h);
          var pw = Lb * .065 * Math.abs(Math.sin(t * 16 + k.ph)) + Lb * .012; c.fillStyle = 'rgba(70,52,30,.55)'; c.beginPath(); c.ellipse(Lb * .245, Lb * .194, Math.max(.4, Lb * .008), pw, 0, 0, 6.283); c.fill();   // spinning propeller
          c.restore();
          if (nv > .02){ var lr = Math.max(1, Lc * .035), fx2 = k.face * sc * Lb;   // porthole glow, stern + nose lanterns
            NGL.lamp(G.x - fx2 * .1, G.y + bob + Lc * .19, lr, fa, k.ph, Lc * .9); NGL.lamp(G.x + fx2 * .22, G.y + bob + Lc * .17, lr * .8, fa * .85, k.ph + 1, 0);
            NGL.lamp(G.x - fx2 * .49, G.y + bob - Lc * .06, lr * .7, fa * .8, k.ph + 2, 0); }
        }
        c.globalAlpha = 1;
      }
      return {step: step, draw: draw, n: function(){ return A.length; }, want: function(){ return want; }, list: function(){ return A.map(function(k){ return [Math.round(k.x), Math.round(k.y)]; }); },
        force: function(n){ want = Math.max(want, n || 3); for (var i = A.length; i < want; i++){ spawn(false); A[A.length - 1].t = 5; } }};
    })();
    var simAcc = 0, layerErr = {};
    // one layer's exception must not kill the frame: log it once, reset the canvas state and go on with the next layer
    function L(n, f){ try { f(); } catch (e){ if (!layerErr[n]){ layerErr[n] = 1; try { console.error('[map] layer ' + n + ' failed:', e); } catch (_){} } try { c.restore(); } catch (_){} c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; } }
    function draw(t){
      var dt = lastT ? Math.min(.1, t - lastT) : .016; lastT = t;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, vw, vh); skyBegin();
      if (!ready || reduce) return;
      var lt = lite(), zf = zoomF(), nv = DN.v.lights;
      // far away the movement is sub-pixel: simulate caravans/ships/birds at ~30 Hz (Light: ~20 Hz) and draw every frame
      simAcc += dt; if (simAcc >= (zf < .28 ? (lt ? .05 : .033) : 0)){ stepCars(simAcc, lt); stepBirds(simAcc, lt); stepShips(simAcc, lt); simAcc = 0; }
      var sv = stepSmoke(dt, lt, zf);
      NGL.begin(); var D = window.__ulvMapDbg || 0;
      L('s-nat', function(){ NAT.step(dt, t, lt); }); L('s-pirate', function(){ PIRATE.step(t, dt, lt); }); L('s-torn', function(){ TORN.step(dt, lt); }); L('s-air', function(){ AIRS.step(dt, lt); }); L('s-fish', function(){ stepFish(dt, lt); }); L('s-snow', function(){ SNOW.step(dt, t, lt, zf); });
      L('whirl', function(){ drawWhirl(t, lt); }); L('glow', function(){ drawGlow(t, lt); }); if (!D.nonat) L('nat', function(){ NAT.draw(t, lt); });
      if (!D.noships){ L('fish', function(){ drawFish(t, nv, zf); }); L('ships', function(){ drawShips(t, nv); }); L('pirate', function(){ PIRATE.draw(t, clamp(40 * view.s, 7, 30)); }); L('battle', function(){ drawBattle(t, dt); }); }
      if (!D.nocars) L('cars', function(){ drawCars(t, nv); }); if (!D.nosmoke) L('smoke', function(){ drawSmoke(sv, zf); });
      if (!D.nonat) L('torn', function(){ TORN.draw(t); }); if (!D.noships) L('air', function(){ AIRS.draw(t, nv, zf, lt); }); L('birds', function(){ drawBirds(lt); }); L('snow', function(){ SNOW.draw(zf); });
      if (!D.nonight) L('night', function(){ NGL.flush(t, nv, zf, lt); });
    }
    // what is around a world point (for the soundscape)
    function probe(x, y){
      var town = 0, S = DATA.settlements;
      for (var i = 0; i < S.length; i++){ var d = Math.hypot(S[i][0] - x, S[i][1] - y); town = Math.max(town, 1 - sstep(S[i][2] * .6, S[i][2] * 2.2, d)); }
      var landF = 0, n = 0; for (var a = 0; a < 5; a++){ var ox = a ? Math.cos(a * 1.57) * 120 : 0, oy = a ? Math.sin(a * 1.57) * 120 : 0; landF += isLand(x + ox, y + oy) ? 1 : 0; n++; }
      var sh = 0, ca = 0;   // ship / caravan proximity (world px), for creaks+lapping and hooves+wheels when zoomed close
      for (i = 0; i < ships.length; i++){ var k = ships[i], q = shipPos(k); sh = Math.max(sh, 1 - sstep(25, 150, Math.hypot(q.x - x, q.y - y))); }
      for (i = 0; i < cars.length; i++){ var c = cars[i]; if (c.d < 0 || c.d > c.tot) continue; var q2 = at(c, c.d); ca = Math.max(ca, 1 - sstep(20, 120, Math.hypot(q2.x - x, q2.y - y))); }
      var near = function(L, r0, r1){ var b = 0; for (var j = 0; j < L.length; j++) b = Math.max(b, 1 - sstep(r0, r1, Math.hypot(L[j][0] - x, L[j][1] - y))); return b; };
      var desert = STORM.south(x, y) && landF > 0 ? sstep(3550, 3800, y) * (landF / n) * (1 - (1 - sstep(80, 260, Math.hypot(x - 3150, y - 4044))) * .6) : 0;
      return {town: town, land: landF / n, coast: coastDist(x, y), ship: sh, car: ca, harbor: near(PORTS, 70, 300), eerie: near(BLAV, 110, 430), torn: TORN.near(x, y), forge: near(FORGES, 40, 220), waterfall: near(FALLS, 40, 240), temple: near(TEMPLES, 50, 260), desert: desert};
    }
    function landPt(){ return landPts.length ? landPts[(Math.random() * landPts.length) | 0] : null; }
    return {init: init, resize: resize, draw: draw, zoomF: zoomF, landPt: landPt, spawn: spawnFlock, probe: probe, coastDist: coastDist, isLand: isLand, dbg: {pirate: PIRATE, nat: NAT, torn: TORN, air: AIRS},
      stats: function(){ return {ships: ships.length, wakes: wakes.length, wakePts: wakes.reduce(function(n, w){ return n + w.pts.length; }, 0), galleon: (function(){ var g = ships.filter(function(k){ return k.type === "galleon" && k.t > 300; })[0]; if (!g) return null; var q = shipPos(g); return [Math.round(q.x), Math.round(q.y)]; })(), fleets: ships.filter(function(k){ return k.lat; }).length, types: ships.reduce(function(o, k){ o[k.type] = (o[k.type] || 0) + 1; return o; }, {}),
        harb: ships.filter(function(k){ return k.port && (k.t < 260 || k.run - k.t < 260); }).slice(0, 8).map(function(k){ var q = shipPos(k); return [Math.round(q.x), Math.round(q.y), k.type]; }),
        portShips: ships.filter(function(k){ return k.port; }).length, routes: PORTR ? PORTR.length : 0, sinking: ships.filter(function(k){ return k.sink >= 0; }).length, pirate: PIRATE.p ? PIRATE.p.st : null, pirPos: PIRATE.p ? [Math.round(PIRATE.p.x), Math.round(PIRATE.p.y), +PIRATE.p.t.toFixed(1)] : null, pirates: PIRATE.list(), pirCount: PIRATE.counts(), nat: NAT.st(),
        tornado: TORN.list(), airships: AIRS.list(), airWant: AIRS.want(), tornNext: TORN.nextIn(), storms: STORM.count(), wxTiers: STORM.tiers(), wxInfo: STORM.info(), sand: +STORM.sand.a.toFixed(2), fishing: FISHB.length, fishPts: fishPts ? fishPts.length : 0, fishPos: FISHB.slice(0, 4).map(function(b){ return [Math.round(b.x), Math.round(b.y)]; }), snow: SNOW.n(),
        shipPos: ships.slice(0, 6).map(function(k){ var q = shipPos(k); return [Math.round(q.x), Math.round(q.y)]; }),
        net: !!NET, netEdges: netEdges.length, armies: armies, lights: LN, pools: NGL.pools, dynLights: NGL.dyn, kinds: cars.reduce(function(o, k){ o[k.kind] = (o[k.kind] || 0) + 1; return o; }, {}), hops: cars.filter(function(k){ return k.hops; }).length,
        cars: cars.length, carRoads: cars.reduce(function(o, k){ var j = roadGeo().indexOf(k.g); o[j] = (o[j] || 0) + 1; return o; }, {}), gates: cars.filter(function(k){ return k.gate; }).length, flocks: flocks.length, roads: roadGeo().length, lanes: lanes.length, smoke: smoke.length, land: landPts.length,
        armyPos: cars.filter(function(k){ return k.kind === 'army' && k.d > 0 && k.d < k.tot; }).map(function(k){ var q = at(k, k.d); return [Math.round(q.x), Math.round(q.y)]; }),
        merchPos: cars.filter(function(k){ return k.kind === 'merchant' && k.d > 0 && k.d < k.tot; }).slice(0, 3).map(function(k){ var q = at(k, k.d); return [Math.round(q.x), Math.round(q.y)]; }),
        carPos: cars.slice(0, 4).map(function(k){ var q = at(k, k.d); return [Math.round(q.x), Math.round(q.y)]; })}; }};
  })();

  // ---------------------------------------------------------------- tiered weather cells (rendered in the shader) + desert sandstorm
  // t132/t133 tiers, most -> least common (weights of a new cell; at most 4 cells on the map, usually 0-2):
  //   1 light drizzle under a few pale clouds (46 %)   2 rain under dense grey clouds (28 %)   3 rain under dark clouds (17 %)
  //   4 thunderstorm: black clouds, heavy rain, lightning + thunder (9 %; max 2 at once)
  //   5 tornado storm: a thunderstorm with ONE funnel (LIFE TORN). Own timer: never at map open, first after 5-8 min,
  //     then 8-15 min after the previous one ended; max 1. No cell lives longer than one day+night cycle (2 min).
  // No rain over the Southern Lands (an occasional orange sandstorm there). Thunder (audio near()) and lightning only for 4-5.
  // Rainbows: sometimes after a rain cell ends (daytime, NAT). Toggles: everything only while weather AND clouds are on.
  function wxActive(){ return wxOn && cloudsOn; }
  var STORM = (function(){
    var NC = 4, cells = [mk(), mk(), mk(), mk()], last = 0, ended = [], clock = 0;
    var TI = [null,   // r: radius range, life (s), dark 0-1, rain 0-1, rot: slow drift of the cloud mass (no vortex look)
      {w: .46, r: [190, 290], life: [40, 80], dark: 0, rain: .35, rot: 0},
      {w: .28, r: [250, 360], life: [50, 95], dark: .4, rain: .62, rot: 0},
      {w: .17, r: [290, 410], life: [60, 105], dark: .72, rain: .86, rot: 0},
      {w: .09, r: [330, 470], life: [65, 110], dark: 1, rain: 1, rot: .01},
      {w: 0, r: [350, 450], life: [85, 115], dark: 1, rain: 1, rot: .01}];
    var cap = 1 + ((Math.random() * 2) | 0), nextCap = 90 + Math.random() * 110, nextSpawn = 4 + Math.random() * 10, nextT5 = 300 + Math.random() * 180, log = [0, 0, 0, 0, 0, 0];
    var sand = {x: -9999, y: -9999, r: 420, a: 0, life: 0, age: 0, vx: 0, vy: 0, next: 30 + Math.random() * 60};
    function mk(){ return {x: -9999, y: -9999, r: 300, a: 0, fl: 0, life: 0, age: 0, vx: 0, vy: 0, next: 0, f2: 0, rot: 0, land: 0, tier: 0, dark: 0, rain: 0}; }
    function south(x, y){ return y > 3550 && x > 1150 && x < 3500; }
    function rr(a){ return a[0] + Math.random() * (a[1] - a[0]); }
    function active(){ var n = 0; for (var i = 0; i < NC; i++) if (cells[i].age < cells[i].life) n++; return n; }
    function nTier(lo){ var n = 0; for (var i = 0; i < NC; i++) if (cells[i].age < cells[i].life && cells[i].tier >= lo) n++; return n; }
    function free(){ for (var i = 0; i < NC; i++) if (cells[i].age >= cells[i].life) return cells[i]; return null; }
    function spawn(c0, tier, t, fx, fy){
      var P = TI[tier], r = rr(P.r), ok = fx != null, overLand = Math.random() < .5, x = fx, y = fy;
      for (var i = 0; i < 80 && !ok; i++){
        if (overLand){ var lp = LIFE.landPt(); if (!lp) break; x = lp[0] - 120; y = lp[1] - 30; }
        else { x = 300 + Math.random() * (W - 600); y = 300 + Math.random() * (H - 600); var d = LIFE.coastDist(x, y); if (d < 120 || d > 560) continue; }
        if (south(x, y) || south(x + 300, y + 120)) continue;
        var clash = false; for (var j = 0; j < NC; j++){ var o = cells[j]; if (o !== c0 && o.age < o.life && Math.hypot(o.x - x, o.y - y) < o.r + r + 250){ clash = true; break; } }   // keep cells apart
        if (!clash) ok = true;
      }
      if (!ok) return false;
      c0.x = x; c0.y = y; c0.r = r; c0.tier = tier; c0.dark = P.dark; c0.rain = P.rain; c0.rot = P.rot * (Math.random() < .5 ? 1 : -1);
      c0.land = overLand ? 1 : 0; c0.age = 0; c0.life = Math.min(118, rr(P.life)); c0.a = 0; c0.fl = 0;
      c0.vx = 3 + Math.random() * 5; c0.vy = .5 + Math.random() * 2.5; c0.next = t + 6 + Math.random() * 6; log[tier]++;
      if (tier === 5 && LIFE.dbg && LIFE.dbg.torn) LIFE.dbg.torn.attach(c0);
      return true;
    }
    function pickTier(){ var u = Math.random(), k = 1; for (; k < 4; k++){ if (u < TI[k].w) break; u -= TI[k].w; } if (k === 4 && (nTier(4) >= 2 || clock < 45)) k = 3; return k; }
    function step(t){
      var dt = last ? Math.min(.2, t - last) : 0; last = t; var on = wxActive();
      if (on) clock += dt;
      if (on){
        nextCap -= dt; if (nextCap <= 0){ var u = Math.random(); cap = u < .12 ? 0 : u < .4 ? 1 : u < .72 ? 2 : u < .92 ? 3 : 4; nextCap = 90 + Math.random() * 110; }
        nextT5 -= dt; if (nextT5 <= 0){ var f5 = nTier(5) < 1 && nTier(4) < 2 ? free() : null; if (f5 && spawn(f5, 5, t)) nextT5 = 1e9; else nextT5 = 20; }
        nextSpawn -= dt; if (nextSpawn <= 0){ nextSpawn = 8 + Math.random() * 22; if (active() < cap){ var fc = free(); if (fc) spawn(fc, pickTier(), t); } }
      }
      for (var i = 0; i < NC; i++){
        var c0 = cells[i];
        if (c0.age >= c0.life){ if (c0.x > -9000){ if (c0.life > 0 && on) ended.push({x: c0.x, y: c0.y, r: c0.r, t: t, tier: c0.tier}); if (c0.tier === 5) nextT5 = 480 + Math.random() * 420; c0.x = -9999; c0.a = 0; c0.fl = 0; c0.tier = 0; } continue; }
        if (!on){ c0.life = Math.min(c0.life, c0.age + 5); }
        c0.age += dt; c0.x += c0.vx * dt; c0.y += c0.vy * dt;
        if (south(c0.x, c0.y)) c0.life = Math.min(c0.life, c0.age + 10);   // drifting toward the desert: rain out before it
        var fin = c0.tier >= 4 ? 14 : 10; c0.a = Math.max(0, Math.min(1, c0.age / fin, (c0.life - c0.age) / fin));
        if (c0.tier >= 4){ if (t > c0.next){ c0.f2 = t; c0.next = t + 3 + Math.random() * 9; c0.bolt = (c0.bolt || 0) + 1; }
          var e = t - c0.f2; c0.fl = e < 0 || e > .7 ? 0 : (e < .08 ? 1 : e < .16 ? .25 : e < .24 ? .8 : Math.max(0, .8 - (e - .24) * 2)); } else c0.fl = 0;
      }
      // sandstorm over the Southern Lands: forms, drifts with the wind for a while, dissipates (weather off: fades away)
      if (!on){ sand.a = Math.max(0, sand.a - dt / 5); if (sand.a <= 0) sand.age = sand.life; }
      else if (sand.age >= sand.life){ sand.a = 0; sand.next -= dt; if (sand.next <= 0){ var lp2 = null; for (var k = 0; k < 40; k++){ var q = LIFE.landPt(); if (q && q[1] > 3900 && q[0] > 1500 && q[0] < 3100){ lp2 = q; break; } }
          if (lp2){ sand.x = lp2[0] - 220; sand.y = lp2[1]; sand.r = 600 + Math.random() * 300; sand.age = 0; sand.life = 70 + Math.random() * 45; sand.vx = 7 + Math.random() * 6; sand.vy = (Math.random() - .5) * 4; }
          sand.next = 140 + Math.random() * 160; } }
      else { sand.age += dt; sand.x += sand.vx * dt; sand.y += sand.vy * dt; sand.a = Math.max(0, Math.min(1, sand.age / 18, (sand.life - sand.age) / 20)); }
    }
    // storm audio (rain + thunder loop) only near thunderstorms (tiers 4-5)
    function near(x, y){ var b = 0; for (var i = 0; i < NC; i++){ var c0 = cells[i]; if (c0.tier >= 4 && c0.a > .05) b = Math.max(b, c0.a * (1 - Math.min(1, Math.hypot(c0.x - x, c0.y - y) / (c0.r * 2.2)))); } return b; }
    function nearSand(x, y){ return sand.a > .05 ? sand.a * (1 - Math.min(1, Math.hypot(sand.x - x, sand.y - y) / (sand.r * 2))) : 0; }
    return {cells: cells, step: step, near: near, nearSand: nearSand, sand: sand, ended: ended, south: south,
      count: function(){ var n = 0; for (var i = 0; i < NC; i++) if (cells[i].a > .05) n++; return n; },
      tiers: function(){ return cells.filter(function(c0){ return c0.age < c0.life; }).map(function(c0){ return [c0.tier, Math.round(c0.age), Math.round(c0.life)]; }); },
      info: function(){ return {clock: +clock.toFixed(1), cap: cap, nextT5: +nextT5.toFixed(0), spawned: log.slice(1)}; },
      force: function(kind, x, y){ if (kind === 'sand'){ sand.x = x; sand.y = y; sand.r = 750; sand.age = 19; sand.life = 110; sand.vx = 9; sand.vy = 0; return; }
        var tier = kind === 't1' ? 1 : kind === 't2' ? 2 : kind === 't3' ? 3 : kind === 't5' ? 5 : 4;
        var c0 = free() || cells[0]; if (c0.tier === 5) LIFE.dbg.torn.detach(); c0.life = 0; spawn(c0, tier, last, x, y); c0.age = 12; }};
  })();
  var cloudsOn = true; try { cloudsOn = localStorage.getItem('ulv-map-clouds') !== '0'; } catch(e){}
  // ---------------------------------------------------------------- day/night cycle: 1 min day + 1 min night; paused = eases back to noon
  function lin(a, b, x){ return Math.max(0, Math.min(1, (x - a) / (b - a))); }
  var DN = (function(){
    var run = true; try { run = localStorage.getItem('ulv-map-dn') !== '0'; } catch(e){}
    var PERIOD = 120, ph = .03, last = 0, v = {day: 1, dusk: 0, night: 0, elev: 1, sx: 0, sy: .5, lights: 0, ph: .25};
    function ss(a, b, x){ var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function step(t){
      var dt = last ? Math.min(.25, t - last) : 0; last = t;
      if (run && !reduce) ph = (ph + dt / PERIOD) % 1;
      else { var d = .25 - ph; if (d > .5) d -= 1; if (d < -.5) d += 1; ph = reduce ? .25 : (ph + d * Math.min(1, dt * 1.4) + 1) % 1; }
      var a = ph * 6.2832, e = Math.sin(a);
      v.ph = ph; v.day = ss(-.26, .3, e); v.night = 1 - v.day; v.dusk = Math.exp(-Math.pow(e / .4, 2)); v.elev = Math.abs(e);
      var la = e >= 0 ? a : a - Math.PI; v.sx = Math.cos(la); v.sy = .55 * Math.sin(la) + .15;
      v.lights = ss(.18, .8, v.night);
      return v;
    }
    function setRun(r){ run = !!r; try { localStorage.setItem('ulv-map-dn', run ? '1' : '0'); } catch(e){} }
    return {step: step, v: v, setRun: setRun, setPhase: function(p){ ph = ((p % 1) + 1) % 1; }, get run(){ return run && !reduce; }};
  })();

  // ---------------------------------------------------------------- atmosphere (WebGL)
  var FXL = (function(){
    var STA = new Float32Array(16), SQA = new Float32Array(16), RN = [0, 0, 0], SNX = [0, 0, 0], SNY = [0, 0, 0], lastFx = 0;
    var gl = null, prog = null, U = {}, tex = null, tex2 = null, hasBase = false, ok = false, ratio = 0.5, tried = false, fallback = null;
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = [
      'precision mediump float;',
      'uniform sampler2D uField;uniform vec2 uRes;uniform float uK;uniform vec3 uView;uniform vec2 uMap;uniform vec2 uCenter;',
      'uniform float uTime;uniform float uZoom;uniform float uLite;uniform vec4 uFogP;uniform float uCloud;uniform vec2 uWind;uniform vec4 uSt[4];uniform vec4 uFl;uniform vec4 uSr;uniform vec4 uSq[4];uniform vec4 uSand;uniform vec3 uRn;uniform vec3 uSnX;uniform vec3 uSnY;',
      'uniform sampler2D uBase;uniform float uHasBase;uniform vec4 uDN;uniform vec2 uSun;uniform float uWx;',
      'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.,a=.5,s=0.;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){if(uLite>.5&&i>2)break;v+=a*n(p);s+=a;p=m*p;a*=.5;}return v/s;}',
      'float fb3(vec2 p){mat2 m=mat2(1.6,1.2,-1.2,1.6);float v=n(p)*.5;p=m*p;v+=n(p)*.25;p=m*p;v+=n(p)*.125;return v/.875;}',
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
      '  o.rgb+=vec3(.95,.98,1.)*cap0*.28*sea*smoothstep(.2,.55,uZoom);',
      // choppy patches: drifting regions of short crossing waves, normal-shaded from the sun (troughs dark, crests lit)
      '  float chop=smoothstep(.52,.74,n(ws/760.+vec2(t*.006,-t*.004)))*sea*smoothstep(.06,.3,uZoom);',
      '  if(chop>.01){vec2 wp=ws/19.;float ta=t*1.3;',
      '   float c0=sin(wp.x*1.1+wp.y*.45-ta)+.8*sin(wp.x*.42-wp.y*1.05-ta*.8)+.9*n(wp*1.6+vec2(ta*.4,0.));',
      '   float cx=sin((wp.x+.35)*1.1+wp.y*.45-ta)+.8*sin((wp.x+.35)*.42-wp.y*1.05-ta*.8)+.9*n((wp+vec2(.35,0.))*1.6+vec2(ta*.4,0.));',
      '   float cy=sin(wp.x*1.1+(wp.y+.35)*.45-ta)+.8*sin(wp.x*.42-(wp.y+.35)*1.05-ta*.8)+.9*n((wp+vec2(0.,.35))*1.6+vec2(ta*.4,0.));',
      '   vec2 gw=vec2(cx-c0,cy-c0)*2.4;float lit=dot(normalize(vec3(-gw,1.)),normalize(vec3(uSun*.8+vec2(.3,-.5),.9)));',
      '   over(o,vec3(0.,.03,.07),clamp(.92-lit,0.,1.)*.30*chop);o.rgb+=vec3(.75,.88,.98)*pow(max(0.,lit),8.)*.22*chop*(1.-uDN.z*.7);',
      '   o.rgb+=vec3(.92,.97,1.)*smoothstep(1.55,2.3,c0)*.14*chop;}}',
      // coastal foam lines rolling toward the shore (patchy, not on every coast)
      ' {float cz=smoothstep(.08,.35,uZoom); if(cz>0.){float nn=n(w/90.+t*.03);',
      '  float fr=fract(dist/15.+t*.33+nn*1.3); float wv=smoothstep(0.,.07,fr)*(1.-smoothstep(.07,.32,fr));',
      '  float amp=smoothstep(1.2,4.5,dist)*(1.-smoothstep(16.,44.,dist))*smoothstep(.42,.72,n(w/230.+vec2(t*.008,0.)));',
      '  o.rgb+=vec3(.92,.98,1.)*wv*amp*.36*cz*(1.-fogA);}}',
      ' over(o,fogC,fogA);',
      // storm cells: wet darkened ground, three depth layers of angled rain streaks (varied lengths/speeds) + splashes,
      // a dense dark cloud mass rotating slowly (faster near the core) with gaps, lit from inside by lightning
      ' if(uLite<.5){for(int k=0;k<4;k++){vec4 S=uSt[k]; if(S.w<.01)continue; vec2 rel=w-S.xy; float r=length(rel)/S.z; if(r>1.45)continue;',
      '  vec4 Q=uSq[k]; float D=Q.x; float ro=Q.z*t; float ca=cos(ro),sa=sin(ro); vec2 rr=vec2(ca*rel.x-sa*rel.y,sa*rel.x+ca*rel.y)-vec2(t*1.5,0.);',
      '  float cn=fb3(rr/(S.z*.42)+float(k)*7.3)*.85+n(rr/(S.z*.06))*.15; float dd=r+(cn-.5)*(1.3-.5*D); float m=(1.-smoothstep(.15,1.,dd))*S.w; if(m<.003)continue;',
      '  float fl=k==0?uFl.x:k==1?uFl.y:k==2?uFl.z:uFl.w; over(o,vec3(.02,.025,.04),m*(.1+.4*D));',
      '  float nL=Q.y<.5?1.:Q.y<.8?2.:3.; float ra=smoothstep(.2,.65,m)*smoothstep(.06,.3,uZoom)*(.45+.55*Q.y); if(ra>.01){float rain=0.;',
      '   for(int L=0;L<3;L++){float fL=float(L); if(fL>=nL)break; float cw=7.+fL*5.; float xs=css.x+css.y*(.30+fL*.04); float col=floor(xs/cw); float hc=h(vec2(col,fL*13.1+float(k))); float h2=h(vec2(col*1.7,fL+3.3));',
      '    float PL=90.+fL*35.; float Pc=PL*exp2(floor(hc*2.99)); float off=L==0?uRn.x:L==1?uRn.y:uRn.z; float yy=fract((css.y-off)/Pc+h2*5.)*Pc; float len=PL*(.25+.5*h2);',
      '    float st=smoothstep(0.,len*.15,yy)*(1.-smoothstep(len*.5,len,yy)); float xl=abs(fract(xs/cw)-.5)*cw-(h2-.5)*cw*.5; rain+=(1.-smoothstep(.5+fL*.3,1.6+fL*.7,abs(xl)))*st*step(.35-fL*.1,hc)*(.30+fL*.25);}',
      '   over(o,vec3(.70,.75,.84),min(rain,1.)*ra*.42);',
      '   if(Q.y>.8){vec2 sid=floor(css/5.); float sph=fract(uRn.x*.013+h(sid)*7.); float sp=step(.975,h(sid+floor(uRn.x*.013+h(sid)*7.)))*(1.-smoothstep(0.,.25,sph));o.rgb+=vec3(.78,.83,.92)*sp*ra*.22*smoothstep(.3,.6,uZoom);}}',
      '  float cn2=n(rr/70.+vec2(t*.04,0.))*.6+n(rr/26.-vec2(0.,t*.05))*.4; float body=smoothstep(.22,.6,cn+cn2*.28)*smoothstep(0.,.5,m)*S.w;',
      '  float lit=.5; if(D>.3){float cnl=fb3((rr-uSun*S.z*.06)/(S.z*.42)+float(k)*7.3)*.85+n((rr-uSun*S.z*.06)/(S.z*.06))*.15; lit=clamp((cn-cnl)*5.+.35,0.,1.);}',
      '  vec3 cc=mix(mix(vec3(.66,.68,.72),vec3(.06,.065,.08),D),mix(vec3(.95,.95,.97),vec3(.36,.38,.43),D),clamp(cn2*.9-.15+lit*.55,0.,1.));',
      '  over(o,cc,min(body*.9,.62+.26*D)); o.rgb+=vec3(.82,.87,1.)*fl*(body*.85+m*.25);}}',
      // sandstorm (Southern Lands): a dense orange dust wall with turbulent billows and fast streaks; ground dims beneath
      ' if(uSand.w>.01){vec2 rel=w-uSand.xy; float r=length(rel*vec2(.8,1.25))/uSand.z; if(r<1.6){',
      '  vec2 q2=rel/(uSand.z*.55)-vec2(t*.05,0.); float d1=fb3(q2+fb3(q2*1.7+vec2(t*.03,0.))*1.3); float m=(1.-smoothstep(.1,1.05,r+(d1-.5)*.9))*uSand.w;',
      '  if(m>.003){over(o,vec3(.16,.07,.02),m*.38); float d2=n(rel/40.-vec2(t*.7,t*.05)); float dl=fb3(q2-uSun*.08+fb3(q2*1.7+vec2(t*.03,0.))*1.3); float lit=clamp((d1-dl)*5.+.4,0.,1.);',
      '   vec3 sc=mix(vec3(.46,.24,.09),vec3(.93,.66,.36),clamp(d1*.6+lit*.6-.1,0.,1.))*(.88+.24*d2);',
      '   over(o,sc,min(1.,m*1.25)*smoothstep(.15,.6,d1+.2)*.92); float sk=n(vec2(rel.x/110.-t*1.1,rel.y/4.5));',
      '   o.rgb+=vec3(.95,.78,.52)*smoothstep(.7,.95,sk)*m*.18*smoothstep(.15,.45,uZoom);}}}',
      // ---- day/night: relief relighting from the moving sun (luminance of the painted map as height), warm low sun, blue night
      ' float day=uDN.x,dusk=uDN.y,night=uDN.z,elev=uDN.w; vec3 L3=normalize(vec3(uSun,.35+elev*.9));',
      ' float landM=1.-smoothstep(.5,3.,dist);',
      ' if(uHasBase>.5){vec2 tx=vec2(1.6)/vec2(639.,615.); vec3 lw=vec3(.3,.59,.11);',
      '  float hl=dot(texture2D(uBase,uv-vec2(tx.x,0.)).rgb,lw),hr=dot(texture2D(uBase,uv+vec2(tx.x,0.)).rgb,lw),hu=dot(texture2D(uBase,uv-vec2(0.,tx.y)).rgb,lw),hd=dot(texture2D(uBase,uv+vec2(0.,tx.y)).rgb,lw);',
      '  vec3 nn=normalize(vec3((hl-hr)*3.2,(hu-hd)*3.2,1.)); float lam=dot(nn,L3)-L3.z;',
      '  float lowS=1.-smoothstep(.3,.95,elev)*day;float rs=landM*(1.-fogA*.8)*(.12+.88*lowS);',
      '  o.rgb+=mix(vec3(1.,.9,.7),vec3(1.,.6,.3),dusk)*max(0.,lam)*.32*rs*day;',
      '  over(o,mix(vec3(.05,.03,.08),vec3(.01,.02,.06),night),clamp(-lam,0.,1.)*.42*rs);}',
      // broad sun-side gradient (far side a little darker) + low-sun warmth
      ' vec2 sd=uv-.5; float side=dot(sd,normalize(uSun+vec2(1e-4)));',
      ' float lowS2=1.-smoothstep(.3,.95,elev)*day;',
      ' over(o,vec3(.04,.02,.05),clamp(.10-side*.22,0.,.2)*day*lowS2*(.4+dusk));',
      ' over(o,mix(vec3(1.,.50,.18),vec3(.95,.38,.30),clamp(.5-side,0.,1.)),.24*dusk*(.6+side*.5+.2));',
      ' o.rgb+=vec3(1.,.62,.28)*.09*dusk*max(0.,side+.35);',
      ' over(o,vec3(.012,.026,.075),.60*night);',
      ' o.rgb+=vec3(.02,.04,.09)*night*(1.-landM*.5);',
      // weather (toggle): snow-whitened north & high peaks + snowfall, wind gust streaks over the Karduwh forests
      ' if(uWx>.01){float nz=1.-smoothstep(560.,980.,w.y);float pk=(1.-smoothstep(260.,520.,length((w-vec2(2290.,700.))*vec2(1.,1.5))));',
      '  float sz=max(nz,pk)*landM*(1.-fogA*.6);float sn=n(w/38.)*.6+n(w/11.)*.4;',
      '  over(o,mix(vec3(.80,.86,.94),vec3(.95,.97,1.),day),sz*smoothstep(.35,.75,sn)*.42*uWx*(1.-night*.5));',
      // snow haze (the falling flakes themselves are drawn crisp at full resolution on the life canvas: LIFE SNOW)
      '  float szf=max(nz,pk)*(1.-fogA*.6);if(szf>.02){',
      '   over(o,mix(vec3(.78,.83,.9),vec3(.93,.95,.98),day),szf*(.06+.07*n(w/260.+vec2(t*.05,0.)))*uWx*(1.-night*.4));}',
      '  float gm=(1.-smoothstep(220.,520.,length((w-vec2(1450.,1320.))*vec2(1.,1.3))))*landM*uWx*smoothstep(.15,.45,uZoom);',
      '  if(gm>.01){float env=smoothstep(.3,1.,sin(t*.37)*.5+.5+sin(t*.91)*.3);vec2 gq=vec2((w.x+w.y*.25)/70.-t*1.6,(w.y-w.x*.12)/4.5);',
      '   o.rgb+=vec3(.92,.96,.9)*smoothstep(.78,.96,n(gq))*smoothstep(.3,.7,n(gq*.13+3.))*.16*gm*env*(1.-night*.6);}}',
      // slow warm light sweep across the map (full mode)
      ' if(uLite<.5){float sw=dot(uv,vec2(.857,.514));float ph=fract(t/46.)*2.4-.5;float band=exp(-pow((sw-ph)/.10,2.));o.rgb+=vec3(1.,.88,.66)*band*.05*(1.-fogA*.6)*day*(1.-dusk);}',
      ' vec3 cTint=mix(mix(vec3(1.),mix(vec3(1.22,.78,.50),vec3(1.12,.62,.74),clamp(.5-side*1.5,0.,1.)),dusk),vec3(.20,.26,.42),night);',
      ' float a0=cloud(c0,t*.03,thr); float a0l=cloud(c0-vec2(.012,.016),t*.03,thr);',
      ' vec3 cc0=mix(vec3(.50,.54,.62),vec3(1.,.98,.94),clamp(.6+(a0-a0l)*3.5,0.,1.));',
      ' over(o,cc0*cTint,min(a0*.8,.78)*uCloud*cap*(1.-.25*night));',
      ' if(uLite<.5){float a1=cloud(c1,t*.05,thr+.05); float a1l=cloud(c1-vec2(.012,.016),t*.05,thr+.05);',
      '  vec3 cc1=mix(vec3(.55,.58,.66),vec3(1.),clamp(.6+(a1-a1l)*3.5,0.,1.)); over(o,cc1*cTint,a1*.55*uCloud*cap*(1.-.25*night));}',
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
      ['uField','uRes','uK','uView','uMap','uCenter','uTime','uZoom','uLite','uFogP','uCloud','uWind','uSt','uFl','uSr','uSq','uSand','uRn','uSnX','uSnY','uBase','uHasBase','uDN','uSun','uWx'].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var img = new Image(); img.onload = function(){ gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img); ok = true; ov.classList.add('fx-on'); kick(); };
      img.src = BASE + 'fogfield.png';
      // painted map (low-res base) as a height source for the moving-sun relief shading
      tex2 = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var upB = function(){ try { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex2); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, baseImg); hasBase = true; } catch(e){} gl.activeTexture(gl.TEXTURE0); };
      if (baseImg && baseImg.complete && baseImg.naturalWidth) upB(); else if (baseImg) baseImg.addEventListener('load', upB);
      gl.activeTexture(gl.TEXTURE0);
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
      ratio = lite() ? 0.33 : Math.min(0.5, 0.45 * dpr);
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
      STORM.step(time); var SC = STORM.cells, off = lt || reduce;
      for (var si = 0; si < 4; si++){ var Sx = SC[si]; STA[si * 4] = Sx.x; STA[si * 4 + 1] = Sx.y; STA[si * 4 + 2] = Sx.r; STA[si * 4 + 3] = off ? 0 : Sx.a;
        SQA[si * 4] = Sx.dark; SQA[si * 4 + 1] = Sx.rain; SQA[si * 4 + 2] = Sx.rot; SQA[si * 4 + 3] = 0; }
      gl.uniform4fv(U.uSt, STA); gl.uniform4fv(U.uSq, SQA); gl.uniform4f(U.uFl, SC[0].fl, SC[1].fl, SC[2].fl, SC[3].fl);
      var SD = STORM.sand; gl.uniform4f(U.uSand, SD.x, SD.y, SD.r, reduce ? 0 : SD.a);
      // fast-moving rain / snow offsets integrated here and wrapped (keeps shader numbers small: mediump-safe on phones)
      var fdt = lastFx ? Math.min(.1, Math.max(0, time - lastFx)) : 0; lastFx = time;
      for (var li = 0; li < 3; li++){ var PL = 90 + li * 35; RN[li] = (RN[li] + fdt * (430 + li * 210)) % (PL * 4); }
      gl.uniform3f(U.uRn, RN[0], RN[1], RN[2]); gl.uniform3f(U.uSnX, SNX[0], SNX[1], SNX[2]); gl.uniform3f(U.uSnY, SNY[0], SNY[1], SNY[2]);
      var wd = C.wind || [1, 0.35]; gl.uniform2f(U.uWind, wd[0], wd[1]);
      gl.uniform1i(U.uBase, 1); gl.uniform1f(U.uHasBase, hasBase && !lt ? 1 : 0);
      var dv = DN.v; gl.uniform4f(U.uDN, dv.day, dv.dusk, dv.night, dv.elev); gl.uniform2f(U.uSun, dv.sx, dv.sy); gl.uniform1f(U.uWx, wxOn ? 1 : 0);
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
    isOpen = false; btn.setAttribute('aria-expanded', 'false'); pop.hidden = true; closePanel();
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
  // t141: harita butonu 2D / 3D seçimini aşağı kaydırır (3D yalnız masaüstü)
  var M3D_V = 'ffad5e7c14';
  var choice = document.createElement('div'); choice.className = 'map-choice'; choice.setAttribute('role', 'menu');
  choice.innerHTML = '<button type="button" class="mc-2d" role="menuitem" title="2D harita">2D</button><button type="button" class="mc-3d" role="menuitem" title="3D harita (deneme)">3D</button>';
  document.body.appendChild(choice);
  function showChoice(on){ choice.classList.toggle('on', on); btn.setAttribute('aria-expanded', on || isOpen ? 'true' : 'false'); }
  var m3dMod = null;
  function open3D(){
    showChoice(false);
    (m3dMod || (m3dMod = import(new URL('assets/map3d.js?v=' + M3D_V, document.baseURI).href))).then(function(m){ m.open(); })
      .catch(function(e){ m3dMod = null; if (window.console) console.warn('3D map load failed', e); open(); });
  }
  btn.addEventListener('click', function(ev){ ev.stopPropagation(); if (isOpen){ close(); return; } showChoice(!choice.classList.contains('on')); });
  try { if (sessionStorage.getItem('m3dReopen') === '1'){ sessionStorage.removeItem('m3dReopen'); setTimeout(open3D, 600); } } catch(e){}   // v4 hotfix: reopen 3D after a GPU context-loss restart
  choice.querySelector('.mc-2d').addEventListener('click', function(ev){ ev.stopPropagation(); showChoice(false); open(); });
  choice.querySelector('.mc-3d').addEventListener('click', function(ev){ ev.stopPropagation(); open3D(); });
  document.addEventListener('click', function(ev){ if (choice.classList.contains('on') && !choice.contains(ev.target)) showChoice(false); });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && choice.classList.contains('on')) showChoice(false); });
  window.addEventListener('resize', function(){ if (isOpen && loaded) resize(false); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) kick(); });
  // warm the cache after the page settles so the first open is instant
  window.addEventListener('load', function(){ setTimeout(function(){ if (!loading && navigator.connection && navigator.connection.saveData) return; load(); }, 4000); });

  window.__ulvMap = {open: open, close: close, setTool: setTool, route: function(){ return route.slice(); },
    addNodeWorld: function(x, y){ route.push({x: x, y: y}); drawRoute(); updateReadout(); },
    view: function(){ return {s: view.s, x: view.x, y: view.y, fit: fitScale(), vw: vw, vh: vh}; },
    zoomTo: function(s, wx, wy){ var p = toScreen(wx, wy); view.x += vw / 2 - p.x; view.y += vh / 2 - p.y; zoomAt(s, vw / 2, vh / 2); kick(); },
    stats: function(){ return {fx: FXL.ok, gl: !!(cvF.getContext && FXL.ok), lite: lite(), tiles: tileCount, loaded: loaded, km: km(totalPx()), places: PLACES.length, roads: ROADS.length, life: LIFE.stats()}; },
    fx: function(k, x, y, sc){ if (k === 'storm' || k === 'land' || k === 'sand' || /^t[1-5]$/.test(k)) STORM.force(k, x, y); else if (k === 'pirate') LIFE.dbg.pirate.force(); else if (k === 'tornado') LIFE.dbg.torn.force(x, y, sc); else if (k === 'airship') LIFE.dbg.air.force(x); else LIFE.dbg.nat.force(k, x, y); kick(); },
    wx: function(on){ if (on != null){ wxOn = !!on; try { localStorage.setItem('ulv-map-wx', wxOn ? '1' : '0'); } catch(e){} syncToggles(); kick(); } return wxOn; },
    cfg: function(){ return CFG; }, clouds: function(){ return cloudsOn; }, spawnFlock: function(){ LIFE.spawn(); }, redraw: function(){ dirty = true; kick(); },
    isOpen: function(){ return isOpen; }, dn: function(p, run){ if (run != null) DN.setRun(run); if (p != null) DN.setPhase(p); kick(); return DN.v; },
    places: function(){ return {places: PLACES.length, pins: PINS.length, labels: placeEls.length}; }, showPlace: function(id){ var p = placeById(id); if (p) showPlace(p, null); },
    showPin: function(i){ var q = PINS[i]; if (q) showPin(q, evByO(q.o), null); }};
})();
