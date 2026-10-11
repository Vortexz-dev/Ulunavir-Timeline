/* Horaghfus map soundscape: own WebAudio graph, active only while the world map is open.
   Layers (CC0 / public-domain loops in assets/sfx/map/, see assets/sfx/CREDITS.md) are crossfaded continuously
   by zoom and by what is under the view centre: high wind (lowpass opens with altitude) -> lighter wind + birds
   -> birdsong, breeze, rustling leaves; town murmur near settlements (nature ducks), soft surf near coasts; at night crickets/owls replace birds; rain+thunder near storms, snowstorm wind in the snowy north/peaks,
   ship creaks/lapping near ships and hooves/wheels near caravans when zoomed close; harbour water/bells/gulls, forge hammering,
   waterfalls, temple drone + gong, desert wind in the Southern Lands (all lazy); cannon/sword one-shots for the pirate fights. */
(function(){
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  var DIR = 'assets/sfx/map/', LEVEL = 0.5;
  var FILES = {windHi: 'map-wind-high.mp3', windLo: 'map-wind-low.mp3', nature: 'map-nature.mp3', breeze: 'map-breeze.mp3', town: 'map-town.mp3', surf: 'map-surf.mp3',
    night: 'map-night.mp3', storm: 'map-storm.mp3', snow: 'map-snow.mp3', ship: 'map-ship.mp3', hooves: 'map-hooves.mp3',
    harbor: 'map-harbor.mp3', forge: 'map-forge.mp3', waterfall: 'map-waterfall.mp3', temple: 'map-temple.mp3', desert: 'map-desert.mp3'};
  var LAZY = {night: 1, storm: 1, snow: 1, ship: 1, hooves: 1, harbor: 1, forge: 1, waterfall: 1, temple: 1, desert: 1};   // fetched only the first time they become audible
  var BASE = {windHi: .46, windLo: .8, nature: .9, breeze: .7, town: .85, surf: .75, night: .85, storm: .9, snow: .7, ship: .8, hooves: .7, harbor: .8, forge: .7, waterfall: .8, temple: .7, desert: .75};
  var ctx = null, master = null, lp = null, L = {}, loading = false, active = false, sleepT = 0, tgt = {}, nloaded = 0;
  var on = true, vol = 50;   // vol 0..100; 100 = the original v3 level (LEVEL), default 50
  try { var sv = localStorage.getItem('ulv-map-vol2'); if (sv != null && sv !== '' && isFinite(+sv)) vol = Math.max(0, Math.min(100, +sv)); } catch(e){}
  try {
    var pref = localStorage.getItem('ulv-map-snd');
    if (pref != null) on = pref !== '0';
    else { var m = JSON.parse(localStorage.getItem('ulv-music') || 'null'); if (m && (m.muted || +m.vol === 0)) on = false; }   // follow the site's music mute
  } catch(e){}
  function sstep(a, b, x){ var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function ensure(){
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch(e){ return null; }
    master = ctx.createGain(); master.gain.value = 0;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = .5;
    var hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 2500; hs.gain.value = -9; lp.connect(hs); lp = {connect: function(n){ hs.connect(n); }, frequency: lp.frequency, _in: lp};
    Object.keys(FILES).forEach(function(k){ var g = ctx.createGain(); g.gain.value = 0; if (k === 'windHi'){ lp.connect(g); } g.connect(master); L[k] = {g: g, src: null}; });
    return ctx;
  }
  var started = {};
  function load(){
    if (loading || !ctx) return; loading = true;
    Object.keys(FILES).forEach(function(k){ if (!LAZY[k]) loadOne(k); });
  }
  function loadOne(k){
    if (started[k] || !ctx) return; started[k] = 1;
    (function(){
      fetch(DIR + FILES[k]).then(function(r){ if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function(ab){ return new Promise(function(res, rej){ var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); })
        .then(function(buf){
          var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
          s.loopStart = .06; s.loopEnd = Math.max(.5, buf.duration - .06);          // skip mp3 encoder padding => seamless loop
          s.connect(k === 'windHi' ? lp._in : L[k].g); s.start(0, .06 + Math.random() * (buf.duration - 1)); L[k].src = s; nloaded++;
        }).catch(function(e){ if (window.console) console.warn('map audio: ' + FILES[k] + ' failed', e); });
    })();
  }
  function setMaster(sec){ if (!master) return; var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(active && on ? LEVEL * vol / 100 : 0, t, sec / 3); }
  function open(){
    if (!AC) return; active = true; clearTimeout(sleepT);
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function(){});
    load(); setMaster(1.4);
  }
  function close(){
    active = false; setMaster(.7);
    clearTimeout(sleepT); sleepT = setTimeout(function(){ if (!active && ctx && ctx.state === 'running') ctx.suspend().catch(function(){}); }, 1200);
  }
  // p = {zf: 0 far .. 1 close, town: 0..1, land: 0..1, coast: px from shore}
  function update(p){
    if (!ctx || !active) return;
    var zf = p.zf, far = 1 - sstep(.05, .5, zf), close = sstep(.45, .85, zf), mid = Math.max(0, 1 - far - close);
    var town = p.town * sstep(.3, .8, zf), landF = p.land, coastF = 1 - sstep(30, 260, p.coast);
    tgt = {
      windHi: .95 * far + .15 * mid,
      windLo: .25 * far + .75 * mid + .3 * close * (1 - town),
      nature: (.4 * mid + 1 * close) * (.25 + .75 * landF) * (1 - .85 * town),
      breeze: .75 * close * landF * (1 - .5 * town),
      town: town,
      surf: (close * coastF + mid * .3 * coastF) * (1 - .6 * town)
    };
    // night: crickets/owls replace the daytime birds; storms, snowstorm wind, ships and caravans when close to them
    var nt = sstep(.25, .75, p.night || 0);
    tgt.night = tgt.nature * nt * 1.1 + .25 * mid * nt * landF; tgt.nature *= 1 - nt; tgt.breeze *= 1 - .4 * nt;
    tgt.storm = Math.min(1, (p.storm || 0) * 1.3) * (.35 + .65 * (1 - far));
    tgt.snow = (p.snow || 0) * (.4 + .6 * (1 - far)); tgt.windHi *= 1 - .5 * (p.snow || 0);
    tgt.ship = (p.ship || 0) * close; tgt.hooves = (p.car || 0) * close * (1 - .5 * town);
    // location-specific beds when zoomed near: harbours (water, bells, gulls), forges, waterfalls, the temple, desert wind
    var nearZ = sstep(.3, .7, zf);
    tgt.harbor = (p.harbor || 0) * nearZ; tgt.forge = (p.forge || 0) * nearZ; tgt.waterfall = (p.waterfall || 0) * nearZ; tgt.temple = (p.temple || 0) * nearZ * (1 - .3 * nt);
    tgt.desert = (p.desert || 0) * (.35 + .65 * (1 - far)) * (1 - .5 * town); tgt.nature *= 1 - .8 * (p.desert || 0); tgt.breeze *= 1 - .7 * (p.desert || 0); tgt.night *= 1 - .5 * (p.desert || 0);
    tgt.surf *= 1 - .5 * tgt.harbor; tgt.town *= 1 - .3 * Math.max(tgt.forge, tgt.temple);
    Object.keys(LAZY).forEach(function(k){ if (tgt[k] > .01) loadOne(k); });
    var t = ctx.currentTime;
    Object.keys(tgt).forEach(function(k){ var g = L[k].g.gain; g.cancelScheduledValues(t); g.setTargetAtTime(tgt[k] * BASE[k], t, .5); });
    lp.frequency.cancelScheduledValues(t); lp.frequency.setTargetAtTime(520 + 2300 * far * far + 600 * mid, t, .6);   // wind character: dull/near -> airy/high (kept soft, no hiss)
  }
  // one-shots (pirate battle): cannon + sword clash; decoded on first use, spatialised by a simple stereo pan
  var SFX = {cannon: 'sfx-cannon.mp3', clash: 'sfx-clash.mp3'}, sbuf = {}, sbusy = {}, lastS = {};
  function sfx(name, g, pan){
    if (!ctx || !active || !on || !SFX[name]) return;
    if (!sbuf[name]){ if (!sbusy[name]){ sbusy[name] = 1; fetch(DIR + SFX[name]).then(function(r){ return r.arrayBuffer(); }).then(function(ab){ return new Promise(function(res, rej){ var q = ctx.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); }); }).then(function(b){ sbuf[name] = b; }).catch(function(){}); } return; }
    var now = ctx.currentTime; if (lastS[name] && now - lastS[name] < .12) return; lastS[name] = now;
    var src = ctx.createBufferSource(), gn = ctx.createGain(); src.buffer = sbuf[name]; src.playbackRate.value = .9 + Math.random() * .2; gn.gain.value = Math.max(0, Math.min(1, g || 0)) * .9;
    var out = gn; if (ctx.createStereoPanner){ var pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan || 0)); gn.connect(pn); out = pn; }
    src.connect(gn); out.connect(master); src.start();
  }
  function setOn(v){ on = !!v; try { localStorage.setItem('ulv-map-snd', on ? '1' : '0'); } catch(e){} if (on && active) open(); setMaster(.6); }
  function setVol(v){ vol = Math.max(0, Math.min(100, Math.round(+v || 0))); try { localStorage.setItem('ulv-map-vol2', String(vol)); } catch(e){} setMaster(.15); }
  window.__ulvMapAudio = {open: open, close: close, update: update, sfx: sfx, setOn: setOn, isOn: function(){ return on; }, setVol: setVol, getVol: function(){ return vol; },
    state: function(){ return {ctx: ctx && ctx.state, on: on, vol: vol, active: active, loaded: nloaded, master: master && +master.gain.value.toFixed(3), lp: lp && Math.round(lp.frequency.value),
      layers: Object.keys(L).reduce(function(o, k){ o[k] = +L[k].g.gain.value.toFixed(3); return o; }, {}), target: tgt}; }};
})();
