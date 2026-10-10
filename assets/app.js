(function(){
'use strict';
var D = window.TIMELINE, TH = window.THEMES || {themes:{}, rules:[]}, MU = window.MUSIC || {tracks:[]};
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var mqMobile = window.matchMedia('(max-width: 860px)');
var MOBILE = mqMobile.matches;
var itemsEl = document.getElementById('items');
var root = document.documentElement;

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function lc(s){return String(s||'').toLocaleLowerCase('tr');}
function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');var n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255];}
function rgbStr(c){return 'rgb('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+')';}
function lerp(a,b,t){return a+(b-a)*t;}
function smooth(t){return t*t*(3-2*t);}

var chById = {}, chNo = {}; (D.chapters||[]).forEach(function(c, i){chById[c.id]=c; chNo[c.id]=i+1;}); // chapters come oldest-first
var evByO = {}; D.events.forEach(function(e){evByO[e.o]=e;});

// =====================================================================
// THEMES (config: assets/themes.js)
// =====================================================================
var PTYPES = ['rain','snow','embers','ash','smoke','motes','wisps','dust','mist'];
var RULES = (TH.rules||[]).map(function(r){return {r:r, t:r.title?new RegExp(lc(r.title),'i'):null, m:r.match?new RegExp(lc(r.match),'i'):null};});
function yearOf(e){var m=/\d{4}/.exec(e.date);return m?+m[0]:null;}
function themeOf(e){
  if (e.theme && TH.themes[e.theme]) return e.theme;
  var title = lc(e.title), txt = lc([e.title, e.sum, e.chars.join(' '), e.places.join(' '), e.factions.join(' ')].join(' \n ')), y = yearOf(e);
  for (var i=0;i<RULES.length;i++){
    var c = RULES[i], r = c.r;
    if (c.t && !c.t.test(title)) continue;
    if (c.m && !c.m.test(txt)) continue;
    if (r.orders && (e.o<r.orders[0] || e.o>r.orders[1])) continue;
    if (r.years && (y==null || y<r.years[0] || y>r.years[1])) continue;
    if (r.sections && r.sections.indexOf(e.sec)<0) continue;
    if (r.chapters && r.chapters.indexOf(e.era)<0) continue;
    if (TH.themes[r.theme]) return r.theme;
  }
  return TH.themes.modern ? 'modern' : Object.keys(TH.themes)[0];
}
function themeVec(name, age){
  var t = TH.themes[name] || {line:'#ff8a3c', glow:'#7b3fc0', bgTop:'#1c1026', bgBot:'#0b0810', particles:{embers:.6}};
  var p = {}; PTYPES.forEach(function(k){p[k]=(t.particles&&t.particles[k])||0;});
  return {line:hex2rgb(t.line), glow:hex2rgb(t.glow), top:hex2rgb(t.bgTop), bot:hex2rgb(t.bgBot), p:p, age:age||0};
}
function mixVec(a,b,t){
  var o = {line:[],glow:[],top:[],bot:[],p:{},age:lerp(a.age,b.age,t)};
  for (var i=0;i<3;i++){o.line[i]=lerp(a.line[i],b.line[i],t);o.glow[i]=lerp(a.glow[i],b.glow[i],t);o.top[i]=lerp(a.top[i],b.top[i],t);o.bot[i]=lerp(a.bot[i],b.bot[i],t);}
  PTYPES.forEach(function(k){o.p[k]=lerp(a.p[k],b.p[k],t);});
  return o;
}

// =====================================================================
// RENDER (newest first)
// =====================================================================
var NONAGON = '<svg viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="#ffd88a" stroke-width="2"><circle cx="100" cy="100" r="92" stroke-opacity=".6"/><circle cx="100" cy="100" r="84" stroke-dasharray="2 6"/><polygon points="100,18 152,37 181,85 172,140 133,178 67,178 28,140 19,85 48,37"/><polygon points="100,48 145,126 55,126" stroke-opacity=".7"/><polygon points="100,152 55,74 145,74" stroke-opacity=".7"/><circle cx="100" cy="100" r="16" fill="#ffd88a22"/></g></svg>';
var CONF = {high:'yüksek', medium:'orta', low:'düşük', yuksek:'yüksek', orta:'orta', dusuk:'düşük'};

function mediaHTML(e){
  var im = e.imgs || [];
  if (!im.length){
    if (!e.major) return '';
    return '<div class="media"><div class="emblem">'+NONAGON+'<div class="em-y">'+esc(e.num?e.big:'✦')+'</div></div><div class="aging"></div></div>';
  }
  var s = '<div class="media'+(im.length>1?' multi':'')+'" data-o="'+e.o+'" data-i="0" tabindex="0" role="button" aria-label="'+esc(e.title)+' — görseli büyüt"><div class="slides">';
  im.forEach(function(x, i){
    s += '<img class="slide '+x.k+(i===0?' on':'')+'" '+(i===0?'src':'data-src')+'="'+esc(x.c)+'" width="'+x.w+'" height="'+x.h+'" '+
         'style="object-position:'+esc(x.fp||'50% 50%')+'" loading="lazy" decoding="async" alt="'+esc(e.title)+(im.length>1?' ('+(i+1)+'/'+im.length+')':'')+'">';
  });
  s += '</div><div class="aging"></div><span class="zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>';
  if (im.length>1){
    s += '<button class="gnav prev" type="button" aria-label="Önceki görsel"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>'+
         '<button class="gnav next" type="button" aria-label="Sonraki görsel"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button><div class="dots">';
    for (var i=0;i<im.length;i++) s += '<i'+(i===0?' class="on"':'')+'></i>';
    s += '</div>';
  }
  return s + '</div>';
}

function cardHTML(e){
  var chips = '';
  e.chars.slice(0,6).forEach(function(c){chips+='<li class="c">'+esc(c)+'</li>';});
  e.places.slice(0,4).forEach(function(c){chips+='<li class="p">'+esc(c)+'</li>';});
  e.factions.slice(0,4).forEach(function(c){chips+='<li class="f">'+esc(c)+'</li>';});
  var full = (e.date !== e.big) ? '<span class="full">'+esc(e.date)+'</span>' : '';
  var more = '';
  if (e.det) more += '<p class="det">'+esc(e.det)+'</p>';
  if (e.cons) more += '<p class="cons"><b>Sonuç</b>'+esc(e.cons)+'</p>';
  if (e.rel) more += '<p class="mi"><b>Sıralama</b>'+esc(e.rel)+'</p>';
  if (e.note) more += '<p class="mi"><b>Tarih notu</b>'+esc(e.note)+'</p>';
  if (e.conf) more += '<p class="mi"><b>Kesinlik</b>'+esc(CONF[lc(e.conf)]||e.conf)+(e.cb==='low'?' — belirsiz sıra: kaynaklar yeri belirlemiyor, en olası yere kondu':(e.cb==='med'?' — sıra tahmini: birden çok dolaylı ipucu aynı yeri gösteriyor':''))+'</p>';
  if (e.evid) more += '<p class="mi'+(e.cb==='low'?' evid-low':'')+'"><b>'+(e.cb==='low'?'Neden belirsiz':'Dayanak')+'</b>'+esc(Array.isArray(e.evid)?e.evid.join(' · '):e.evid)+'</p>';
  if (e.src.length) more += '<p class="mi src"><b>Kaynak</b>'+esc(e.src.join(' · '))+'</p>';
  return '<div class="card-wrap"><div class="card">'+mediaHTML(e)+
    '<div class="body">'+
      '<div class="date"><span class="big'+(e.num?'':' txt')+'">'+esc(e.big)+'</span>'+full+(e.unc?'<span class="unc" title="Tarihi belirsiz">≈ belirsiz</span>':'')+(e.cb==='low'?'<span class="est low" title="Kaynaklar bu olayın sırasını belirlemiyor; en olası yere kondu (gerekçe: Detaylar)">belirsiz sıra</span>':(e.cb==='med'?'<span class="est med" title="Sıra, birden çok dolaylı ipucuna dayanan bir tahmin">≈ sıra tahmini</span>':''))+'</div>'+
      '<h3>'+esc(e.title)+'</h3>'+
      '<p class="summary">'+esc(e.sum)+'</p>'+
      (chips?'<ul class="chips">'+chips+'</ul>':'')+
      (more?'<details class="more"><summary><span>Detaylar</span><i aria-hidden="true"></i></summary><div class="more-in">'+more+'</div></details>':'')+
    '</div></div></div>';
}

var events = D.events.slice().sort(function(a,b){return b.o-a.o;});
var THEME_OF = {}; events.forEach(function(e){THEME_OF[e.o]=themeOf(e);});
var html = '', lastCh = null, side = 0, chIdx = 0;
var ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII','XXIV','XXV','XXVI','XXVII','XXVIII','XXIX','XXX'];
events.forEach(function(e){
  if (e.era !== lastCh){
    var r = chById[e.era] || {name:e.era, sub:'', sum:''}; chIdx = chNo[e.era] || (++chIdx);
    html += '<section class="era'+(e.sec!=='A'?' post':'')+'" data-era="'+esc(e.era)+'"><div class="era-inner"><div class="era-k">Bölüm '+(ROMAN[chIdx-1]||chIdx)+'</div><div class="era-n">'+esc(r.name)+'</div>'+
            (r.sub?'<div class="era-s">'+esc(r.sub)+'</div>':'')+(r.sum?'<p class="era-sum">'+esc(r.sum)+'</p>':'')+'</div></section>';
    lastCh = e.era;
  }
  var s = (side++ % 2 === 0) ? 'left' : 'right';
  html += '<article class="ev '+(e.major?'major':'minor')+' '+s+' tier-'+e.tier+' lad-'+e.lad+' th-'+THEME_OF[e.o]+(e.sec!=='A'?' sec-post':'')+'" data-o="'+e.o+'" data-era="'+esc(e.era)+'" data-year="'+esc(e.big)+'">'+
    '<div class="arm"></div><div class="node"><span class="dot"></span>'+(e.num?'<span class="pill">'+esc(e.big)+'</span>':'')+'</div>'+cardHTML(e)+'</article>';
});
itemsEl.innerHTML = html;
document.getElementById('heroSub').textContent = D.count+' olay, en yeniden en eskiye — aşağı kaydırdıkça zamanda geriye inersin.';
var EV_ELS = Array.prototype.slice.call(itemsEl.querySelectorAll('.ev'));

// WEATHER (config: THEMES.weather in assets/themes.js): rain in the Sorrow Rains, snow in the
// winter chapters, ash + embers while Balahnur burns. A weather mode sets its own particle
// layers (keys it names, zeros included); the theme's other layers stay faintly (x0.4).
var WX = TH.weather || {modes:{}, rules:[]};
function weatherOf(e){
  var R = WX.rules || [];
  for (var i=0;i<R.length;i++){
    var r = R[i];
    if (r.chapters && r.chapters.indexOf(e.era) < 0) continue;
    if (r.orders && (e.o < r.orders[0] || e.o > r.orders[1])) continue;
    if (r.not && r.not.indexOf(e.o) >= 0) continue;
    if (WX.modes[r.mode]) return r.mode;
  }
  return null;
}
var WEATHER_OF = {}; events.forEach(function(e){ WEATHER_OF[e.o] = weatherOf(e); });
// smoothed per-event atmosphere vectors (display order)
var VEC = (function(){
  var raw = events.map(function(e){
    var v = themeVec(THEME_OF[e.o], e.age), w = WEATHER_OF[e.o];
    if (w){ var m = WX.modes[w]; PTYPES.forEach(function(k){ v.p[k] = (k in m) ? m[k] : v.p[k]*0.4; }); }
    return v;
  });
  var k = Math.max(0, TH.smoothing|0), out = [];
  for (var i=0;i<raw.length;i++){
    var acc = null, wsum = 0;
    for (var j=-k;j<=k;j++){
      var q = raw[Math.min(raw.length-1, Math.max(0, i+j))], w = (k+1-Math.abs(j)) * (j===0?2:1);
      if (!acc){ acc = mixVec(q,q,0); PTYPES.forEach(function(t){acc.p[t]*=w;}); for(var c=0;c<3;c++){acc.line[c]*=w;acc.glow[c]*=w;acc.top[c]*=w;acc.bot[c]*=w;} acc.age*=w; }
      else { for(var c2=0;c2<3;c2++){acc.line[c2]+=q.line[c2]*w;acc.glow[c2]+=q.glow[c2]*w;acc.top[c2]+=q.top[c2]*w;acc.bot[c2]+=q.bot[c2]*w;} PTYPES.forEach(function(t){acc.p[t]+=q.p[t]*w;}); acc.age+=q.age*w; }
      wsum += w;
    }
    for (var c3=0;c3<3;c3++){acc.line[c3]/=wsum;acc.glow[c3]/=wsum;acc.top[c3]/=wsum;acc.bot[c3]/=wsum;}
    PTYPES.forEach(function(t){acc.p[t]/=wsum;}); acc.age = raw[i].age; // age is already smooth
    out.push(acc);
  }
  return out;
})();

// =====================================================================
// LAYOUT (desktop masonry around the line) — chapters get breathing room
// =====================================================================
function layout(){
  if (mqMobile.matches){ itemsEl.style.height=''; return; }
  // t103: more air between cards (was MIN_STEP 96 / GAP 44): a card starts at least STAGGER x the previous
  // (other-side) card's height below it, so neighbours only half-overlap instead of stacking 4 deep
  var L = window.__ulvLayout || {}, MIN_STEP = L.step || 200, GAP = L.gap || 150, STAGGER = L.stagger != null ? L.stagger : 0.85;
  var y = {left:0,right:0}, lastTop = -1e9, lastH = 0, first = true;
  var kids = itemsEl.children;
  for (var i=0;i<kids.length;i++){
    var el = kids[i], h = el.offsetHeight, top;
    if (el.classList.contains('era')){
      var post = el.classList.contains('post');
      top = Math.max(y.left, y.right) + (first ? 30 : (post ? 190 : 130));
      el.style.top = top+'px';
      y.left = y.right = top + h + (post ? 110 : 80); lastTop = top + h; lastH = 0; first = false;
    } else {
      var s = el.classList.contains('left')?'left':'right';
      top = Math.max(y[s], lastTop + Math.max(MIN_STEP, lastH * STAGGER));
      el.style.top = top+'px';
      y[s] = top + h + GAP; lastTop = top; lastH = h;
    }
  }
  itemsEl.style.height = Math.max(y.left,y.right)+'px';
}

// =====================================================================
// ATMOSPHERE: era background, aging overlays, line colour (scroll-interpolated)
// =====================================================================
var lineEl = document.querySelector('.line'), bgEra = document.getElementById('bgEra'),
    agePaper = document.getElementById('agePaper'), ageGrain = document.getElementById('ageGrain'), ageCracks = document.getElementById('ageCracks'),
    ageTint = document.getElementById('ageTint'), vignette = document.querySelector('.vignette'), hud = document.getElementById('hud'),
    mpEl = document.getElementById('mp'), sparkEl = document.getElementById('lineSpark');
// Non-repeating aging textures: the paper noise and crack network are painted
// once on a viewport-sized canvas (no tile => no visible repetition in the
// oldest eras). CSS keeps a stretched SVG fallback until this is ready.
(function(){
  function paint(){
    try {
      var W = Math.min(1920, Math.max(800, innerWidth)), H = Math.min(1400, Math.max(600, innerHeight));
      var c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
      // paper: 6 octaves of smoothly up-scaled random value noise in sepia
      var oct = [5, 9, 17, 33, 65, 129], amp = [.5, .34, .24, .16, .1, .07];
      oct.forEach(function(n, i){
        var m = Math.max(2, Math.round(n*H/W)), s = document.createElement('canvas'); s.width = n; s.height = m; var sg = s.getContext('2d'), id = sg.createImageData(n, m);
        for (var p = 0; p < n*m; p++){ id.data[p*4] = 140; id.data[p*4+1] = 97; id.data[p*4+2] = 41; id.data[p*4+3] = Math.random()*255*amp[i]; }
        sg.putImageData(id, 0, 0);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        if ('filter' in g) g.filter = 'blur(' + Math.max(1, Math.round(W/n/3)) + 'px)';
        g.drawImage(s, -W/n, -H/m, W + 2*W/n, H + 2*H/m);
      });
      if ('filter' in g) g.filter = 'none';
      var paper = c.toDataURL('image/webp', .82);
      // cracks: random branching walks spread over the whole viewport
      var k = document.createElement('canvas'); k.width = W; k.height = H; var kg = k.getContext('2d');
      function walk(x, y, a, len, w, depth, segs){
        segs.push([x, y, w, true]);
        for (var i = 0; i < len; i++){
          a += (Math.random()-.5)*.9; var st = 7 + Math.random()*16; x += Math.cos(a)*st; y += Math.sin(a)*st; segs.push([x, y, w, false]);
          if (depth < 2 && Math.random() < .13) walk(x, y, a + (Math.random() < .5 ? -1 : 1)*(.6 + Math.random()*.8), (len*.45)|0, w*.7, depth+1, segs);
        }
      }
      var n = Math.round(W*H/90000), all = [];
      for (var j = 0; j < n; j++){ var segs = []; walk(Math.random()*W, Math.random()*H, Math.random()*6.283, 14 + (Math.random()*26|0), 1.25, 0, segs); all.push(segs); }
      [['#1a0f05', .55, 0], ['#f3dcb0', .18, 1]].forEach(function(L){
        kg.strokeStyle = L[0]; kg.globalAlpha = L[1]; kg.lineJoin = 'round'; kg.lineCap = 'round';
        all.forEach(function(segs){ kg.beginPath(); segs.forEach(function(s){ if (s[3]) kg.moveTo(s[0]+L[2], s[1]+L[2]); else kg.lineTo(s[0]+L[2], s[1]+L[2]); }); kg.lineWidth = L[2] ? .8 : 1.2; kg.stroke(); });
      });
      var cracks = k.toDataURL('image/png');
      agePaper.style.backgroundImage = 'radial-gradient(ellipse at 50% 45%,#c8a46a22 0%,#6a4a2266 55%,#2a1708cc 100%),url(' + paper + ')';
      agePaper.style.backgroundSize = '100% 100%,100% 100%';
      ageCracks.style.backgroundImage = 'url(' + cracks + ')'; ageCracks.style.backgroundSize = '100% 100%';
      document.documentElement.classList.add('tex-ok');
    } catch(e){}
  }
  var ric = window.requestIdleCallback || function(f){ return setTimeout(f, 300); };
  if (document.readyState === 'complete') ric(paint, {timeout:2500}); else window.addEventListener('load', function(){ ric(paint, {timeout:2500}); });
})();
var anchors = [], sparkGeo = {top:0, x:0, h:0, p:0}; // cached so scroll sparks never force a layout
function computeAnchors(){
  var sy = window.scrollY;
  if (lineEl){ var lr = lineEl.getBoundingClientRect(), tl = document.getElementById('timeline'); sparkGeo.top = lr.top + sy; sparkGeo.x = lr.left + lr.width/2; sparkGeo.h = tl ? tl.offsetHeight : lr.height; }
  anchors = EV_ELS.map(function(el){ var r = el.getBoundingClientRect(); return r.top + sy + Math.min(r.height, 400)/2; });
  if (window.Ambience_targets) window.Ambience_targets(sy);
  computeSongRegions(sy);
}
// page-y spans of the event/chapter songs (MU.eventMusic): chapter = its title card .. its last event
var SONG_REG = [], songWant = null;
function computeSongRegions(sy){
  SONG_REG = (MU.eventMusic||[]).filter(function(s){ return s && s.src; }).map(function(s){
    var els = [];
    (s.orders||[]).forEach(function(o){ var el = itemsEl.querySelector('.ev[data-o="'+o+'"]'); if (el) els.push(el); });
    (s.chapters||[]).forEach(function(c){ var sec = itemsEl.querySelector('section.era[data-era="'+c+'"]'); if (sec) els.push(sec);
      Array.prototype.forEach.call(itemsEl.querySelectorAll('.ev[data-era="'+c+'"]'), function(e){ els.push(e); }); });
    if (!els.length) return null;
    var top = 1e12, bot = -1e12;
    els.forEach(function(el){ var r = el.getBoundingClientRect(); top = Math.min(top, r.top + sy); bot = Math.max(bot, r.bottom + sy); });
    return {top:top, bot:bot};
  });
  musicRegion();
}
// FOCUS: the card nearest to the centre of the view (direction-independent) drives the era
// ambience (normal/war) and the event songs. A song's own events win (event lists before chapter
// lists); when the focus leaves a song for the default playlist the song is kept until the view
// centre is 20% of a screen outside the song's span (no flapping at the edges).
var focusIdx = -1;
function songFor(e){
  var L = (MU.eventMusic||[]).filter(function(s){ return s && s.src; });
  for (var i=0;i<L.length;i++){ var s = L[i];
    if (s.orders && s.orders.indexOf(e.o) >= 0) return i;
    if (s.chapters && s.chapters.indexOf(e.era) >= 0) return i; }
  return null;
}
var SONG_OF = {}; events.forEach(function(e){ SONG_OF[e.o] = songFor(e); });
function musicRegion(){
  var n = anchors.length; if (!n) return;
  var y = window.scrollY + innerHeight*0.5, best = -1, bd = 1e12;
  if (y >= anchors[0] - innerHeight*0.6){ for (var i=0;i<n;i++){ var d = Math.abs(anchors[i] - y); if (d < bd){ bd = d; best = i; } } }
  if (best !== focusIdx){ focusIdx = best; if (best >= 0 && typeof Ambience !== 'undefined' && Ambience) Ambience.onEvent(events[best]); }
  if (typeof Music === 'undefined' || !Music) return;
  var pick = best >= 0 ? SONG_OF[events[best].o] : null;
  if (pick == null && songWant != null){ var R = SONG_REG[songWant], m = innerHeight*0.2; if (R && y >= R.top - m && y <= R.bot + m) pick = songWant; }
  songWant = pick; Music.region(pick);
}
var ATM = null, lastKey = '';
function atmosphereAt(y){
  var n = anchors.length; if (!n) return VEC[0];
  if (y <= anchors[0]) return VEC[0];
  if (y >= anchors[n-1]) return VEC[n-1];
  var lo = 0, hi = n-1;
  while (hi - lo > 1){ var mid = (lo+hi)>>1; if (anchors[mid] <= y) lo = mid; else hi = mid; }
  var t = (y - anchors[lo]) / Math.max(1, anchors[hi]-anchors[lo]);
  return mixVec(VEC[lo], VEC[hi], smooth(t));
}
function q(c){return [c[0]&~3, c[1]&~3, c[2]&~3];}
function applyAtmosphere(){
  var a = atmosphereAt(window.scrollY + innerHeight*0.55); ATM = a;
  var L = q(a.line), G = q(a.glow), T = q(a.top), B = q(a.bot), age = Math.round(a.age*100)/100;
  var key = L.join()+G.join()+T.join()+B.join()+age;
  if (key === lastKey) return; lastKey = key;
  var ls = rgbStr(L), gs = rgbStr(G);
  [lineEl, hud, mpEl].forEach(function(el){ if (el){ el.style.setProperty('--line', ls); el.style.setProperty('--glow', gs);} });
  bgEra.style.setProperty('--glow', gs); bgEra.style.setProperty('--top', rgbStr(T)); bgEra.style.setProperty('--bot', rgbStr(B));
  agePaper.style.opacity = (Math.pow(age, 1.3) * 0.95).toFixed(3);
  ageTint.style.opacity = (age * 0.16).toFixed(3);
  ageGrain.style.opacity = (0.03 + age * 0.16).toFixed(3);
  ageCracks.style.opacity = Math.max(0, (age - 0.45) / 0.55 * 0.5).toFixed(3);
  vignette.style.opacity = (0.75 + age * 0.25).toFixed(3);
}

// =====================================================================
// PARTICLES: one canvas, crossfading era effects + scroll sparks
// =====================================================================
var FX = (function(){
  var cv = document.getElementById('particles'), ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1;
  var baseScale = MOBILE ? 0.5 : 1, scale = baseScale, lite = false;
  var MAX = {rain:150, snow:130, embers:80, ash:60, smoke:9, motes:60, wisps:12, dust:80, mist:7};
  var COL = {snow:'235,245,255', embers:'255,140,60', ash:'170,165,160', smoke:'40,32,30', motes:'255,214,120', wisps:'170,90,255', dust:'230,205,150', mist:'190,225,230'};
  var sprites = {}, pools = {}, weight = {}, target = {}, sparks = [];
  PTYPES.forEach(function(k){weight[k]=0;target[k]=0;pools[k]=[];});
  function sprite(rgb, hard){
    var s = document.createElement('canvas'); s.width = s.height = 64; var g = s.getContext('2d');
    var gr = g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba('+rgb+',1)'); gr.addColorStop(hard?0.35:0.15,'rgba('+rgb+','+(hard?0.9:0.6)+')'); gr.addColorStop(1,'rgba('+rgb+',0)');
    g.fillStyle = gr; g.fillRect(0,0,64,64); return s;
  }
  Object.keys(COL).forEach(function(k){ sprites[k] = sprite(COL[k], k==='snow'||k==='embers'||k==='motes'||k==='dust'); });
  var R = Math.random;
  function spawn(k, p, init){
    p.life = 0; p.tw = R()*6.28;
    var u = dpr;
    switch(k){
      case 'rain':  p.x=R()*W*1.2; p.y=init?R()*H:-20*u; p.vx=-1.6*u; p.vy=(13+R()*7)*u; p.r=(10+R()*14)*u; p.a=.25+R()*.3; p.max=1e9; break;
      case 'snow':  p.x=R()*W; p.y=init?R()*H:-10*u; p.vx=(R()-.5)*.4*u; p.vy=(.5+R()*1.2)*u; p.r=(1.2+R()*2.6)*u; p.a=.5+R()*.5; p.max=1e9; break;
      case 'embers':p.x=R()*W; p.y=init?R()*H:H+10*u; p.vx=(R()-.5)*.3*u; p.vy=-(.35+R()*.9)*u; p.r=(1.2+R()*2.6)*u; p.a=.55+R()*.45; p.max=300+R()*500; break;
      case 'ash':   p.x=R()*W; p.y=init?R()*H:-10*u; p.vx=(R()-.3)*.5*u; p.vy=(.25+R()*.6)*u; p.r=(1+R()*2)*u; p.a=.35+R()*.4; p.max=1e9; break;
      case 'smoke': p.x=R()*W; p.y=init?R()*H:H+150*u; p.vx=(R()-.5)*.25*u; p.vy=-(.15+R()*.3)*u; p.r=(120+R()*160)*u; p.a=.22+R()*.18; p.max=900+R()*700; break;
      case 'motes': p.x=R()*W; p.y=R()*H; p.vx=(R()-.5)*.25*u; p.vy=(R()-.6)*.25*u; p.r=(1.4+R()*2.6)*u; p.a=.5+R()*.5; p.max=400+R()*600; break;
      case 'wisps': p.x=R()*W; p.y=R()*H; p.vx=(R()-.5)*.5*u; p.vy=(R()-.5)*.3*u; p.r=(30+R()*60)*u; p.a=.10+R()*.12; p.max=500+R()*500; break;
      case 'dust':  p.x=R()*W; p.y=R()*H; p.vx=(R()-.5)*.18*u; p.vy=(R()-.5)*.12*u; p.r=(.8+R()*1.6)*u; p.a=.25+R()*.4; p.max=400+R()*600; break;
      case 'mist':  p.x=R()*W; p.y=H*(.35+R()*.7); p.vx=(.12+R()*.25)*u*(R()<.5?-1:1); p.vy=0; p.r=(180+R()*220)*u; p.a=.07+R()*.07; p.max=1200+R()*800; break;
    }
  }
  function resize(){
    dpr = Math.min(window.devicePixelRatio||1, lite ? 1 : (MOBILE?1.25:1.5));
    // canvas pixels must map 1:1 onto its CSS box (which excludes a classic scrollbar), otherwise sparks drift sideways
    var cw = cv.clientWidth || innerWidth, ch = cv.clientHeight || innerHeight;
    W = cv.width = Math.round(cw*dpr); H = cv.height = Math.round(ch*dpr);
  }
  function ensure(k){
    var n = Math.round(MAX[k]*scale), pool = pools[k];
    while (pool.length < n){ var p = {}; spawn(k, p, true); pool.push(p); }
  }
  var running = !reduce, lastT = 0, lastDraw = 0;
  // frame-rate probe: only real, measured slowness switches to the light mode (see Effects below)
  var probe = {t0:0, n:0, slow:0, cb:null};
  function measure(t){
    if (!probe.cb) return;
    if (!probe.t0){ probe.t0 = t; probe.n = 0; return; }
    probe.n++;
    if (t - probe.t0 >= 3000){
      var fps = probe.n * 1000 / (t - probe.t0); probe.t0 = t; probe.n = 0;
      probe.slow = fps < 40 ? probe.slow + 1 : 0;
      probe.cb(fps, probe.slow);
    }
  }
  function setLite(on){
    on = !!on; if (on === lite) return; lite = on;
    scale = baseScale * (lite ? 0.4 : 1);
    PTYPES.forEach(function(k){ var n = Math.round(MAX[k]*scale); if (pools[k].length > n) pools[k].length = n; });
    resize();
  }
  function setTargets(p){ PTYPES.forEach(function(k){ target[k] = Math.min(1, p[k]||0); }); }
  function emitSparks(n, dir, x, y, rgb){
    if (reduce) return;
    for (var i=0;i<n && sparks.length<48;i++){
      var ang = (dir>0 ? -Math.PI/2 : Math.PI/2) + (R()-.5)*1.5, sp = (2.2+R()*3.2)*dpr;
      sparks.push({x:x+(R()-.5)*6*dpr, y:y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:0, max:26+R()*26, r:(0.9+R()*1.4)*dpr, c:rgb});
    }
  }
  // card-edge bursts (major events): particles start on the card's border and drift outward, then fade.
  // Stored in page coordinates (y + scrollY) so they stay attached to the card while scrolling.
  var bursts = [], smokeSpr = sprite('18,14,20', false);
  function burst(r, rgb, mode, n){
    if (reduce) return;
    n = Math.round(n * (lite ? 0.35 : 1) * (MOBILE ? 0.6 : 1));
    var sy = window.scrollY, per = 2*(r.width + r.height);
    for (var i=0;i<n && bursts.length<420;i++){
      var d = R()*per, x, y, nx, ny;
      if (d < r.width){ x = r.left + d; y = r.top; nx = 0; ny = -1; }
      else if ((d -= r.width) < r.height){ x = r.right; y = r.top + d; nx = 1; ny = 0; }
      else if ((d -= r.height) < r.width){ x = r.right - d; y = r.bottom; nx = 0; ny = 1; }
      else { d -= r.width; x = r.left; y = r.bottom - d; nx = -1; ny = 0; }
      var sp = (mode === 'smoke' ? .25 + R()*.45 : .25 + R()*.9), tang = (R()-.5)*.8;
      bursts.push({x:x*dpr, y:(y+sy)*dpr, vx:(nx*sp + (ny ? tang : 0) + (R()-.5)*.3)*dpr, vy:(ny*sp + (nx ? tang : 0) - (mode === 'smoke' ? .25 : .1))*dpr,
        life:-R()*40, max:(mode === 'smoke' ? 70 : 70) + R()*70, r:(mode === 'smoke' ? 4 + R()*6 : .35 + R()*.65)*dpr, c:rgb, m:mode, ph:R()*6.28});
    }
  }
  function drawBursts(dt){
    if (!bursts.length) return;
    var off = window.scrollY*dpr;
    for (var b=bursts.length-1; b>=0; b--){
      var p = bursts[b]; p.life += dt; if (p.life < 0) continue;
      p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.975; p.vy = p.vy*0.975 - (p.m === 'smoke' ? 0.004 : 0.02)*dpr*dt; if (p.m !== 'smoke') p.vx += Math.sin((p.life + p.ph*20)*.08)*.012*dpr*dt;
      var f = 1 - p.life/p.max; if (f <= 0){ bursts.splice(b,1); continue; }
      var sx = p.x, sy = p.y - off; if (sy < -40 || sy > H + 40) continue;
      if (p.m === 'smoke'){
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = f*0.45; var rr = p.r*(1.6 - f*0.6);
        ctx.drawImage(smokeSpr, sx-rr, sy-rr, rr*2, rr*2);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        var fl = .65 + .35*Math.sin(p.life*.5 + p.ph); // ember flicker
        ctx.globalAlpha = f*0.4*fl; ctx.fillStyle = 'rgb('+p.c+')'; ctx.beginPath(); ctx.arc(sx, sy, p.r*2.2, 0, 6.283); ctx.fill();
        ctx.globalAlpha = f*fl; ctx.fillStyle = p.m === 'gold' ? '#fffbe8' : 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(sx, sy, p.r*0.7, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function frame(t){
    if (!running) return;
    measure(t);
    if (lite && lastDraw && t - lastDraw < 30){ requestAnimationFrame(frame); return; } // light mode: ~30fps particles
    lastDraw = t;
    var dt = lastT ? Math.min(3, (t-lastT)/16.67) : 1; lastT = t;
    ctx.clearRect(0,0,W,H);
    for (var ki=0; ki<PTYPES.length; ki++){
      var k = PTYPES[ki];
      weight[k] += (target[k]-weight[k]) * 0.035 * dt;
      if (weight[k] < 0.01 && target[k] === 0){ weight[k] = 0; continue; }
      ensure(k);
      var pool = pools[k], w = weight[k], spr = sprites[k];
      var count = Math.ceil(pool.length * Math.min(1, w*1.15));
      ctx.globalCompositeOperation = (k==='embers'||k==='motes'||k==='wisps') ? 'lighter' : 'source-over';
      if (k === 'rain'){
        ctx.strokeStyle = 'rgba(170,200,255,'+(0.32*w).toFixed(3)+')'; ctx.lineWidth = 1.1*dpr; ctx.beginPath();
      }
      for (var i=0;i<count;i++){
        var p = pool[i]; p.life += dt; p.tw += 0.04*dt;
        if (k==='snow'||k==='ash') p.x += (p.vx + Math.sin(p.tw)*0.35*dpr)*dt; else p.x += (p.vx + (k==='embers'?Math.sin(p.tw*.7)*0.25*dpr:0))*dt;
        p.y += p.vy*dt;
        if (p.life > p.max || p.y > H+40*dpr+p.r || p.y < -60*dpr-p.r || p.x < -p.r-60 || p.x > W*1.25+p.r){ spawn(k,p,false); continue; }
        var fade = Math.min(1, p.life/50) * (p.max<1e8 ? Math.max(0, 1 - p.life/p.max) : 1);
        if (k === 'rain'){ ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx*1.6, p.y - p.r); continue; }
        var a = p.a * fade * w * ((k==='embers'||k==='motes')?(0.6+0.4*Math.sin(p.tw*3)):1);
        if (a < 0.004) continue;
        ctx.globalAlpha = a; var d = p.r*2;
        ctx.drawImage(spr, p.x-p.r, p.y-p.r, d, d);
      }
      if (k === 'rain') ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // sparks
    if (sparks.length){
      ctx.globalCompositeOperation = 'lighter';
      for (var s=sparks.length-1; s>=0; s--){
        var sp = sparks[s]; sp.life += dt; sp.x += sp.vx*dt; sp.y += sp.vy*dt; sp.vx *= 0.96; sp.vy = sp.vy*0.96 + 0.05*dpr*dt;
        var f = 1 - sp.life/sp.max; if (f <= 0){ sparks.splice(s,1); continue; }
        ctx.globalAlpha = f; ctx.fillStyle = 'rgb('+sp.c+')';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r*2.2, 0, 6.283); ctx.globalAlpha = f*0.35; ctx.fill();
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r*0.8, 0, 6.283); ctx.globalAlpha = f; ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x - sp.vx*2.5, sp.y - sp.vy*2.5); ctx.strokeStyle = 'rgba('+sp.c+','+f.toFixed(2)+')'; ctx.lineWidth = sp.r; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    drawBursts(dt);
    ctx.globalCompositeOperation = 'source-over';
    tick();
    requestAnimationFrame(frame);
  }
  resize(); addEventListener('resize', resize);
  if (!reduce){
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function(){ running = !document.hidden; lastT = 0; lastDraw = 0; probe.t0 = 0; probe.slow = 0; if (running) requestAnimationFrame(frame); });
  }
  return { setTargets:setTargets, emitSparks:emitSparks, burst:burst, bursts:function(){return bursts.length;}, setLite:setLite, lite:function(){return lite;}, onFps:function(cb){ probe.cb = cb; probe.t0 = 0; probe.slow = 0; }, dpr:function(){return dpr;}, active:function(){ var o={}; PTYPES.forEach(function(k){ if (weight[k]>0.02) o[k]=+weight[k].toFixed(2); }); return o; } };
})();

// per-frame work driven from FX loop (or scroll in reduced-motion mode)
var lastScrollY = window.scrollY, sparkAcc = 0, scrollDirty = true;
window.addEventListener('scroll', function(){ scrollDirty = true; }, {passive:true});
function tick(){
  var sy = window.scrollY, dy = sy - lastScrollY; lastScrollY = sy;
  if (scrollDirty){ scrollDirty = false; applyAtmosphere(); if (ATM) FX.setTargets(ATM.p); musicRegion(); }
  if (dy && ATM && !reduce){
    sparkAcc += Math.abs(dy);
    if (sparkAcc > 22){
      var n = Math.min(3, Math.floor(sparkAcc/22)); sparkAcc = 0;
      // spawn exactly at the glowing ball: read its live on-screen box (the cached line geometry went stale
      // whenever card heights changed after the last relayout, so sparks appeared at a fixed spot away from the ball)
      var br = sparkEl ? sparkEl.getBoundingClientRect() : null;
      var cx = br ? br.left + br.width/2 : sparkGeo.x, cy = br ? br.top + br.height/2 : sparkGeo.top - sy + 13 + sparkGeo.p * sparkGeo.h;
      if (cy > 0 && cy < innerHeight && (!br || br.width)){
        var d = FX.dpr(), L = ATM.line;
        FX.emitSparks(n, dy>0?1:-1, cx*d, cy*d, Math.round(L[0])+','+Math.round(L[1])+','+Math.round(L[2]));
      }
    }
  }
}
if (reduce) window.addEventListener('scroll', function(){ requestAnimationFrame(tick); }, {passive:true});

// =====================================================================
// EFFECTS LEVEL: "Tam" (full, default) / "Hafif" (light).
// Default = full. Only if the measured frame rate stays under ~40fps for
// ~6s of real use does it switch to light automatically (not saved).
// A manual click on the toggle always wins and is remembered.
// =====================================================================
var Effects = (function(){
  var KEY = 'ulv-fx', manual = null, auto = false;
  try { var v = localStorage.getItem(KEY); if (v === 'full' || v === 'lite') manual = v; } catch(e){}
  var b = document.getElementById('fxBtn');
  function isLite(){ return manual ? manual === 'lite' : auto; }
  function apply(){
    var l = isLite();
    document.body.classList.toggle('fx-lite', l);
    FX.setLite(l);
    if (b){
      b.textContent = 'Efektler: ' + (l ? 'Hafif' : 'Tam') + (!manual && auto ? ' (oto)' : '');
      b.setAttribute('aria-pressed', l ? 'true' : 'false');
      b.title = l ? 'Hafif efektler (daha akıcı). Tam efektlere geçmek için tıkla.' : 'Tam efektler. Takılma olursa Hafif’e geçmek için tıkla.';
    }
  }
  if (b) b.addEventListener('click', function(){ manual = isLite() ? 'full' : 'lite'; try { localStorage.setItem(KEY, manual); } catch(e){} apply(); });
  if (!reduce) FX.onFps(function(fps, slowWindows){
    if (manual || auto) return;
    if (slowWindows >= 2){ auto = true; apply(); }
  });
  apply();
  return {state:function(){ return {manual:manual, auto:auto, lite:isLite()}; }, set:function(m){ manual = m; apply(); }};
})();

// =====================================================================
// HUD + current event
// =====================================================================
var hudEra = document.getElementById('hudEra'), hudYear = document.getElementById('hudYear'), hudBar = document.getElementById('hudBar');
var curO = null;
function setCurrent(el){
  var o = +el.dataset.o; if (o === curO) return; curO = o;
  var r = chById[el.dataset.era];
  hudEra.textContent = r ? r.name : '';
  hudYear.textContent = el.dataset.year;
  var idx = EV_ELS.indexOf(el), v = VEC[idx] || VEC[0];
  root.style.setProperty('--accent', rgbStr(v.line));
  root.style.setProperty('--accent2', rgbStr(v.glow));
  Music.onEvent(evByO[o], THEME_OF[o]);
  if (EraTitle) EraTitle.enter(el.dataset.era);
  if (MiniMap && hud.classList.contains('mm-open')) MiniMap.mark();
}

// =====================================================================
// GALLERY (cards) + LIGHTBOX
// =====================================================================
function loadSlide(img){ if (img && img.dataset.src && !img.getAttribute('src')){ img.src = img.dataset.src; } }
function galleryGo(media, i){
  var slides = media.querySelectorAll('.slide'), n = slides.length; if (n < 2) return;
  i = ((i % n) + n) % n;
  loadSlide(slides[i]); loadSlide(slides[(i+1)%n]);
  slides.forEach(function(s, j){ s.classList.toggle('on', j===i); });
  media.querySelectorAll('.dots i').forEach(function(d, j){ d.classList.toggle('on', j===i); });
  media.dataset.i = i;
}
itemsEl.addEventListener('click', function(ev){
  var nav = ev.target.closest('.gnav');
  var media = ev.target.closest('.media[data-o]');
  if (!media) return;
  if (media._swiped){ media._swiped = false; return; }
  if (nav){ ev.preventDefault(); ev.stopPropagation(); galleryGo(media, (+media.dataset.i) + (nav.classList.contains('next')?1:-1)); return; }
  var dot = ev.target.closest('.dots i');
  if (dot){ galleryGo(media, Array.prototype.indexOf.call(dot.parentNode.children, dot)); return; }
  Lightbox.open(+media.dataset.o, +media.dataset.i, media);
});
itemsEl.addEventListener('keydown', function(ev){
  var media = ev.target.closest && ev.target.closest('.media[data-o]'); if (!media || ev.target !== media) return;
  if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); Lightbox.open(+media.dataset.o, +media.dataset.i, media); }
  else if (ev.key === 'ArrowRight'){ galleryGo(media, +media.dataset.i+1); }
  else if (ev.key === 'ArrowLeft'){ galleryGo(media, +media.dataset.i-1); }
});
(function(){ // swipe on cards (touch)
  var sx = 0, sy = 0, m = null;
  itemsEl.addEventListener('touchstart', function(ev){ m = ev.target.closest('.media.multi'); if (!m) return; sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, {passive:true});
  itemsEl.addEventListener('touchend', function(ev){
    if (!m) return; var t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)*1.3){ var mm = m; mm._swiped = true; galleryGo(mm, (+mm.dataset.i) + (dx<0?1:-1)); setTimeout(function(){ mm._swiped = false; }, 400); }
    m = null;
  }, {passive:true});
})();

var Lightbox = (function(){
  var el = document.createElement('div');
  el.className = 'lb'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','Görsel görüntüleyici'); el.hidden = true;
  el.innerHTML = '<div class="lb-stage"><img class="lb-img" alt=""><div class="lb-spin" aria-hidden="true"></div></div>'+
    '<button class="lb-x" type="button" aria-label="Kapat (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" fill="none"/></svg></button>'+
    '<button class="lb-nav lb-prev" type="button" aria-label="Önceki görsel"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>'+
    '<button class="lb-nav lb-next" type="button" aria-label="Sonraki görsel"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>'+
    '<div class="lb-cap"><div class="lb-t"></div><div class="lb-m"><span class="lb-d"></span><span class="lb-n"></span></div><div class="lb-dots"></div></div>';
  document.body.appendChild(el);
  var img = el.querySelector('.lb-img'), tEl = el.querySelector('.lb-t'), dEl = el.querySelector('.lb-d'), nEl = el.querySelector('.lb-n'), dots = el.querySelector('.lb-dots');
  var cur = null, idx = 0, opener = null, token = 0;
  function show(i){
    var im = cur.imgs, n = im.length; idx = ((i % n) + n) % n; var x = im[idx], my = ++token;
    el.classList.add('loading'); img.classList.remove('in');
    var pre = new Image(); pre.decoding = 'async'; pre.src = x.f;
    pre.onload = pre.onerror = function(){ if (my !== token) return; img.src = x.f; img.width = x.fw; img.height = x.fh; el.classList.remove('loading'); requestAnimationFrame(function(){ img.classList.add('in'); }); };
    img.alt = cur.title + (n>1 ? ' ('+(idx+1)+'/'+n+')' : '');
    nEl.textContent = n > 1 ? (idx+1)+' / '+n : '';
    dots.innerHTML = n > 1 ? cur.imgs.map(function(_, j){ return '<i'+(j===idx?' class="on"':'')+'></i>'; }).join('') : '';
    el.classList.toggle('single', n < 2);
    if (n > 1){ var nx = new Image(); nx.src = im[(idx+1)%n].f; }
    if (opener) galleryGo(opener, idx);
  }
  function open(o, i, from){
    cur = evByO[o]; if (!cur || !cur.imgs || !cur.imgs.length) return; opener = from || null;
    tEl.textContent = cur.title; dEl.textContent = cur.date;
    el.hidden = false; requestAnimationFrame(function(){ el.classList.add('on'); });
    document.body.classList.add('lb-open');
    show(i||0); el.querySelector('.lb-x').focus({preventScroll:true});
  }
  function close(){
    if (el.hidden) return; el.classList.remove('on'); document.body.classList.remove('lb-open');
    setTimeout(function(){ el.hidden = true; img.removeAttribute('src'); }, 260);
    if (opener) opener.focus({preventScroll:true});
  }
  el.addEventListener('click', function(ev){
    if (ev.target.closest('.lb-x')) return close();
    if (ev.target.closest('.lb-prev')) return show(idx-1);
    if (ev.target.closest('.lb-next')) return show(idx+1);
    var d = ev.target.closest('.lb-dots i'); if (d) return show(Array.prototype.indexOf.call(dots.children, d));
    if (ev.target === img || ev.target.closest('.lb-cap')) return;
    close();
  });
  document.addEventListener('keydown', function(ev){
    if (el.hidden) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowRight') show(idx+1);
    else if (ev.key === 'ArrowLeft') show(idx-1);
    else if (ev.key === 'Tab'){ var f = el.querySelectorAll('button:not([hidden])'), a = Array.prototype.slice.call(f).filter(function(b){return b.offsetParent;}); if (!a.length) return;
      var k = a.indexOf(document.activeElement); ev.preventDefault(); a[(k + (ev.shiftKey?-1:1) + a.length) % a.length].focus(); }
  });
  el.addEventListener('wheel', function(ev){ ev.preventDefault(); }, {passive:false});
  var sx = 0, sy = 0;
  el.addEventListener('touchstart', function(ev){ sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, {passive:true});
  el.addEventListener('touchmove', function(ev){ ev.preventDefault(); }, {passive:false});
  el.addEventListener('touchend', function(ev){ var t = ev.changedTouches[0], dx = t.clientX-sx, dy = t.clientY-sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx<0?1:-1)); else if (dy > 90) close(); }, {passive:true});
  return {open:open, close:close};
})();

// =====================================================================
// MUSIC (local MP3s via HTML5 <audio>, fixed looping playlist 1..N -> 1)
// config: assets/music.js. Autoplay is attempted on load; if the browser
// refuses (no user gesture yet) playback starts on the first click / touch /
// key / scroll. Default ON unless the visitor switched it off before.
// Event/chapter songs (MU.eventMusic): when the view enters such a region the
// default track fades out (paused, so it keeps its exact position) and the
// region's song fades in and loops; leaving the region fades back and the
// default track continues from where it stopped.
// =====================================================================
var Music = (function(){
  var KEY = 'ulv-music', st = {on:true, vol:(MU.volume!=null?MU.volume:35), muted:false, idx:0};
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv) { st.on = sv.on !== false; st.vol = sv.vol!=null ? (+sv.vol||0) : st.vol; st.muted = !!sv.muted; st.idx = +sv.idx||0; } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  var btn = mpEl.querySelector('.mp-btn'), playB = mpEl.querySelector('.mp-play'), prevB = mpEl.querySelector('.mp-prev'), nextB = mpEl.querySelector('.mp-next'),
      muteB = mpEl.querySelector('.mp-mute'), vol = mpEl.querySelector('.mp-vol'), now = mpEl.querySelector('.mp-now');
  var tracks = (MU.playlist||[]).map(function(t){ t = typeof t === 'string' ? {src:t} : (t||{}); return {src:t.src||'', name:t.name||''}; }).filter(function(t){ return t.src; });
  var N = tracks.length;
  var SONGS = (MU.eventMusic||[]).filter(function(s){ return s && s.src; });
  var SFADE = (MU.eventMusicFadeSec || 2.5) * 1000, SDWELL = (MU.eventMusicDwellSec != null ? MU.eventMusicDwellSec : 1.2) * 1000;
  if (!(st.idx >= 0 && st.idx < N)) st.idx = 0;
  function mk(){ var a = new Audio(); a.preload = 'none'; a.loop = false; a.volume = 0; a._mix = 0; a._fr = 0; return a; }
  var au = mk(), sp = [mk(), mk()], spi = 0;   // au = default playlist; sp = event songs (two, so one song can crossfade into another)
  sp.forEach(function(a){ a.loop = true; a._song = -1; });
  var mode = null, want = null, dismissed = null, regT = 0, saved = null, switches = 0, songFailed = {};
  var isPlaying = false, blocked = false, pending = false, errStreak = 0, loadedIdx = -1;
  function active(){ return mode == null ? au : sp[spi]; }
  function title(i){ return tracks[i].name || 'Parça'; }
  function ui(){
    mpEl.classList.toggle('playing', st.on && isPlaying);
    mpEl.classList.toggle('on', st.on);
    mpEl.classList.toggle('special', mode != null);
    playB.setAttribute('aria-label', st.on ? 'Durdur' : 'Çal'); playB.classList.toggle('is-on', st.on);
    muteB.classList.toggle('is-muted', st.muted || st.vol === 0); muteB.setAttribute('aria-label', st.muted ? 'Sesi aç' : 'Sesi kapat');
    vol.value = st.vol; vol.style.setProperty('--v', st.vol+'%');
    var txt, name = mode != null ? '\u266A ' + SONGS[mode].name + ' · bu bölüme özel' : (N ? (st.idx+1)+'/'+N+' · '+title(st.idx) : '');
    if (!N && mode == null) txt = 'Henüz müzik eklenmedi';
    else if (st.on && errStreak >= N && mode == null) txt = 'Parçalar oynatılamadı';
    else if (st.on && blocked && !isPlaying) txt = name + ' — başlatmak için kaydır ya da tıkla';
    else txt = name;
    now.textContent = txt;
    now.title = mode != null ? SONGS[mode].name + ' — bu olay/bölüm için seçilmiş şarkı; çıkınca ' + (saved ? (saved.idx+1)+'/'+N+' '+title(saved.idx) : 'varsayılan liste') + ' kaldığı yerden sürer' : (N ? (st.idx+1)+'/'+N+' — '+title(st.idx) : '');
  }
  function target(){ return st.muted ? 0 : st.vol/100; }
  function applyVol(a){ a.volume = Math.max(0, Math.min(1, a._mix * target())); }
  function mixTo(a, to, ms, done){
    cancelAnimationFrame(a._fr); var from = a._mix, t0 = performance.now();
    (function f(){ var k = Math.min(1, (performance.now()-t0)/Math.max(1,ms)); a._mix = from + (to-from)*smooth(k); applyVol(a); if (k < 1) a._fr = requestAnimationFrame(f); else if (done) done(); })();
  }
  function load(i){ if (loadedIdx === i) return; loadedIdx = i; au.src = tracks[i].src; au.preload = 'auto'; }
  function refresh(){ var a = active(); isPlaying = !!(a && !a.paused && !a.ended); ui(); }
  // plays the element of the current mode; reports autoplay refusal
  var held = false, heldWas = false;   // world map open: music paused (position kept), resumed on close
  function play(fade, ms){
    if (!st.on || held) return;
    var a = active();
    if (mode == null){ if (!N) return; load(st.idx); }
    else if (a._song !== mode){ a.src = SONGS[mode].src; a._song = mode; a.preload = 'auto'; }
    a.muted = false;
    if (fade){ a._mix = 0; applyVol(a); }
    pending = true;
    var p; try { p = a.play(); } catch(e){ p = null; }
    var ok = function(){ pending = false; blocked = false; errStreak = 0; if (a !== active()) return; if (fade) mixTo(a, 1, ms || MU.fadeMs || 1200); else { a._mix = 1; applyVol(a); } refresh(); },
        bad = function(err){ pending = false; if (err && err.name === 'NotAllowedError'){ blocked = true; armGesture(); } refresh(); };
    if (p && p.then) p.then(ok, bad); else ok();
  }
  function fadeOutEl(a, ms){ mixTo(a, 0, ms, function(){ if (a !== active()){ a.pause(); if (a === au && saved) saved.t = +(au.currentTime||0).toFixed(2); } }); }
  // switch between the default playlist (m = null) and event song m
  function switchTo(m){
    if (m != null && songFailed[m]) m = null;
    if (m === mode) return;
    var from = active(), prev = mode, wasOn = st.on && (isPlaying || pending);
    if (prev == null && m != null) saved = {idx:st.idx, t:+(au.currentTime||0).toFixed(2)};
    if (m != null && prev != null) spi = 1 - spi;      // song -> song: use the other element
    mode = m; switches++;
    if (m != null && sp[spi]._song !== m){ sp[spi].src = SONGS[m].src; sp[spi]._song = m; sp[spi].preload = 'auto'; try { sp[spi].currentTime = 0; } catch(e){} }
    // the default element was only paused, so it continues from exactly where it stopped; if its track was
    // unloaded meanwhile, reload that track and seek to the saved second
    if (m == null && saved && (loadedIdx !== saved.idx || !au.getAttribute('src'))){ st.idx = saved.idx; loadedIdx = -1; load(st.idx); var t0 = saved.t; au.addEventListener('loadedmetadata', function(){ try { au.currentTime = t0; } catch(e){} }, {once:true}); }
    if (wasOn){ fadeOutEl(from, SFADE); play(true, SFADE); }
    else { if (from !== active()) { from.pause(); from._mix = 0; applyVol(from); } }
    ui();
  }
  // called on scroll with the song region under the view centre (index into SONGS, or null)
  function region(m){
    if (m === want) return;
    want = m; clearTimeout(regT);
    if (dismissed != null && dismissed !== m) dismissed = null;
    regT = setTimeout(function(){ switchTo(want != null && want === dismissed ? null : want); }, mode == null && want != null && !isPlaying ? 0 : SDWELL);
  }
  function go(i, keepVol){
    if (!N) return;
    st.idx = ((i % N) + N) % N; save(); ui();
    loadedIdx = -1;
    if (!st.on || mode != null) return;
    load(st.idx); play(!keepVol);
  }
  [au, sp[0], sp[1]].forEach(function(a){
    a.addEventListener('playing', function(){ if (a === active()){ errStreak = 0; } refresh(); });
    a.addEventListener('pause', refresh);
  });
  au.addEventListener('ended', function(){ isPlaying = false; if (st.on && mode == null) go(st.idx+1, true); });
  au.addEventListener('error', function(){ if (loadedIdx < 0) return; isPlaying = false; errStreak++; ui(); if (st.on && mode == null && errStreak < N) setTimeout(function(){ go(st.idx+1, true); }, 700); });
  sp.forEach(function(a){ a.addEventListener('error', function(){ if (!a.getAttribute('src')) return; if (a._song >= 0) songFailed[a._song] = true; if (a === active()){ a._song = -1; switchTo(null); } }); });
  function stop(){ var a = active(); mixTo(a, 0, 700, function(){ [au, sp[0], sp[1]].forEach(function(x){ x.pause(); }); }); isPlaying = false; ui(); }
  function setOn(on){ st.on = on; save(); errStreak = 0; if (on) play(true); else stop(); ui(); }
  // first real interaction unlocks audio when autoplay was refused
  var armed = false, EVS = ['pointerdown','pointerup','keydown','touchstart','touchend','click','wheel','scroll'];
  function onGesture(){ if (!st.on || isPlaying){ disarm(); return; } play(true); }
  function armGesture(){ if (armed) return; armed = true; EVS.forEach(function(t){ window.addEventListener(t, onGesture, {capture:true, passive:true}); }); }
  function disarm(){ if (!armed) return; armed = false; EVS.forEach(function(t){ window.removeEventListener(t, onGesture, {capture:true, passive:true}); }); }
  [au, sp[0], sp[1]].forEach(function(a){ a.addEventListener('playing', disarm); });
  function setOpen(o){ mpEl.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); document.body.classList.toggle('mp-open', o); }
  function step(d){
    errStreak = 0;
    if (mode != null){   // skipping during an event song = back to the playlist for the rest of this region
      dismissed = mode; var f = active(); mode = null; st.idx = ((st.idx+d) % N + N) % N; save(); loadedIdx = -1;
      if (st.on){ fadeOutEl(f, 700); play(true); } else f.pause(); ui(); return;
    }
    if (st.on) go(st.idx+d, true); else { st.idx = ((st.idx+d) % N + N) % N; save(); loadedIdx = -1; ui(); }
  }
  btn.addEventListener('click', function(){ setOpen(!mpEl.classList.contains('open')); });
  playB.addEventListener('click', function(ev){ ev.stopPropagation(); setOn(!(st.on && (isPlaying || !blocked))); });
  if (prevB) prevB.addEventListener('click', function(){ step(-1); });
  if (nextB) nextB.addEventListener('click', function(){ step(1); });
  function volAll(){ [au, sp[0], sp[1]].forEach(applyVol); }
  muteB.addEventListener('click', function(){ st.muted = !st.muted; if (!st.muted && st.vol === 0) st.vol = 30; save(); volAll(); ui(); });
  vol.addEventListener('input', function(){ st.vol = +vol.value; st.muted = st.vol === 0; save(); volAll(); ui(); });
  document.addEventListener('click', function(ev){ if (!mpEl.contains(ev.target) && mpEl.classList.contains('open')) setOpen(false); });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && mpEl.classList.contains('open')) { setOpen(false); btn.focus(); } });
  if (!N) mpEl.classList.add('empty');
  ui();
  // sound hint: shown only while the browser blocks autoplay
  var hint = document.createElement('div'); hint.className = 'snd-hint'; hint.setAttribute('role','status');
  hint.innerHTML = '<span class="snd-ic">\u266A</span> Müzik için kaydır ya da herhangi bir yere tıkla';
  document.body.appendChild(hint);
  function hintUi(){ hint.classList.toggle('show', !!(st.on && N && blocked && !isPlaying)); }
  [au, sp[0], sp[1]].forEach(function(a){ a.addEventListener('playing', hintUi); a.addEventListener('pause', hintUi); });
  var _ui = ui; ui = function(){ _ui(); hintUi(); };
  if (st.on && N) { play(true); window.addEventListener('load', function(){ if (!isPlaying) play(true); }); } // try autoplay right away; falls back to first gesture
  function hold(on){
    on = !!on; if (on === held) return;
    if (on){ heldWas = st.on && (isPlaying || pending); held = true;
      var a = active(); mixTo(a, 0, 900, function(){ if (held) [au, sp[0], sp[1]].forEach(function(x){ x.pause(); }); }); }
    else { held = false; if (heldWas && st.on) play(true, 1500); }
  }
  return {onEvent:function(){}, region:region, hold:hold, songs:SONGS, next:function(){ step(1); }, prev:function(){ step(-1); },
    state:function(){ var a = active(); return {st:st, idx:st.idx, n:N, mode:mode, want:want, song:mode != null ? SONGS[mode].name : null, title:mode != null ? SONGS[mode].name : (N?title(st.idx):null),
      playing:isPlaying, blocked:blocked, t:+(a.currentTime||0).toFixed(2), defT:+(au.currentTime||0).toFixed(2), defPaused:au.paused, vol:Math.round(a.volume*100), src:a.currentSrc,
      saved:saved, switches:switches, errStreak:errStreak, now:now.textContent}; }};
})();

// =====================================================================
// AMBIENCE + EVENT SOUNDS (one WebAudio graph)
// - Era ambience: MU.eraAmbience = [{chapters:[...], file, war?, warOrders?}] (assets/music.js).
//   Files STREAM through pooled <audio> elements (MediaElementSource -> gain -> ambBus),
//   so a 6-minute ambience never has to be decoded into memory. Each file loops with a
//   long self-crossfade (two elements), restarting at cfg.startSec. Era changes wait
//   dwellSec, then do an equal-power crossfade of crossfadeSec. An era with a 'war' file
//   layers it: while the event in view is a war event the war version fades in and the
//   normal one fades out (warFadeSec); both keep their position.
// - Event sounds: only the events listed in MU.eventSfx (keyed by event 'o').
//   Fired when the moving timeline spark reaches the event's dot; skipped on
//   fast scrolling and jumps; min gap MU.sfxMinGapMs. Fixed low level
//   (sfxBus 0.32 + 2.6 kHz lowpass), independent of the ambience slider.
// - Own on/off (+ ambience volume) in the music panel, localStorage 'ulv-amb2'.
//   Off = silent, event sounds included.
// =====================================================================
window.__ulvAudioHold = function(on){ try { Music.hold(on); } catch(e){} try { Ambience.hold(on); } catch(e){} };
window.__ulvAudioState = function(){ return {music: Music.state(), amb: Ambience.state()}; };
var Ambience = (function(){
  var KEY = 'ulv-amb2', cfg = MU.ambience || {}, ERAS = (MU.eraAmbience || []).filter(function(r){ return r && r.file && r.chapters; });
  var EVSFX = MU.eventSfx || {}, GAP = MU.sfxMinGapMs != null ? MU.sfxMinGapMs : 3000;
  var st = {on: cfg.on !== false, vol: cfg.volume != null ? cfg.volume : 24};
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv){ st.on = sv.on !== false; if (sv.vol != null) st.vol = +sv.vol||0; } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  var ambB = mpEl.querySelector('.mp-amb'), avol = mpEl.querySelector('.mp-avol');
  var AC = window.AudioContext || window.webkitAudioContext;
  var XF = cfg.crossfadeSec || 5, WXF = cfg.warFadeSec || 4, LXF = cfg.loopXfadeSec || 6, START = +cfg.startSec || 0,
      DWELL = (cfg.dwellSec != null ? cfg.dwellSec : 2.5) * 1000;
  if (!ERAS.length){ if (avol) avol.hidden = true; if (ambB){ ambB.title = 'Olay sesleri (önemli olaylar)'; ambB.setAttribute('aria-label', 'Olay sesleri'); } }
  // chapter -> era index; per-era war flags (a single calm event between two war events stays 'war': no flapping)
  var ERA_OF = {}, WAR = {};
  ERAS.forEach(function(r, i){
    r.chapters.forEach(function(c){ ERA_OF[c] = i; });
    if (!r.war) return;
    var set = {}; (r.warOrders || []).forEach(function(o){ set[String(o)] = 1; });
    var evs = D.events.filter(function(e){ return r.chapters.indexOf(e.era) >= 0; }).sort(function(a, b){ return a.o - b.o; });
    evs.forEach(function(e, k){
      var w = !!set[String(e.o)];
      if (!w && k > 0 && k < evs.length-1 && set[String(evs[k-1].o)] && set[String(evs[k+1].o)]) w = true;
      if (w) WAR[String(e.o)] = 1;
    });
  });
  var ctx = null, gate = null, ambBus = null, sfxBus = null, comp = null;
  var bufs = {}, loading = {}, failed = {}, noFiles = location.protocol === 'file:';
  function ui(){
    if (ambB){ ambB.classList.toggle('is-off', !st.on); ambB.setAttribute('aria-pressed', st.on ? 'true' : 'false'); }
    if (avol){ avol.value = st.vol; avol.style.setProperty('--v', st.vol+'%'); }
  }
  // ambience sits well under the music (files are normalised to -23 LUFS; default slider 24 => about -33 LUFS)
  function ambLevel(){ return Math.pow(st.vol/100, 1.3) * 2.0; }
  var SFX_LEVEL = Math.pow(0.30, 1.5) * 0.5;   // = the old default master level: event sounds stay exactly as quiet as before
  function ensure(){
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch(e){ return null; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .3;
    comp.connect(ctx.destination);
    gate = ctx.createGain(); gate.gain.value = 0; gate.connect(comp);                 // on/off for everything
    ambBus = ctx.createGain(); ambBus.gain.value = ambLevel(); ambBus.connect(gate);
    var sfxLvl = ctx.createGain(); sfxLvl.gain.value = SFX_LEVEL; sfxLvl.connect(gate);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.32; sfxBus.connect(sfxLvl);
    return ctx;
  }
  var held = false;   // world map open: ambience + event sounds silenced, positions kept
  function running(){ return ctx && ctx.state === 'running' && st.on && !held; }
  // ---------- one-shot buffers (event sounds) ----------
  function url(f){ return 'assets/sfx/' + (/\.(mp3|ogg|m4a|wav|opus)$/i.test(f) ? f : f + '.mp3'); }
  function load(id, cb){
    if (bufs[id]){ bufs[id].t = performance.now(); return cb && cb(bufs[id].b); }
    if (failed[id] || noFiles || !window.fetch || !ctx) return cb && cb(null);
    if (loading[id]){ if (cb) loading[id].push(cb); return; }
    loading[id] = cb ? [cb] : [];
    fetch(url(id)).then(function(r){ if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function(ab){ return new Promise(function(res, rej){ var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); })
      .then(function(b){ bufs[id] = {b:b, t:performance.now()}; trim(); var l = loading[id]; delete loading[id]; l.forEach(function(f){ f(b); }); },
            function(){ failed[id] = true; var l = loading[id]; delete loading[id]; l.forEach(function(f){ f(null); }); });
  }
  function trim(){ var ev = Object.keys(bufs).sort(function(a, b){ return bufs[a].t - bufs[b].t; }); while (ev.length > 10) delete bufs[ev.shift()]; }
  // equal-power (sin/cos) gain ramps, starting from the current value
  function ramp(P, to, dur){
    var t = ctx.currentTime, v0 = P.value, up = to > v0, n = 48, c = new Float32Array(n);
    for (var i = 0; i < n; i++){ var x = i/(n-1); c[i] = up ? v0 + (to - v0)*Math.sin(x*Math.PI/2) : to + (v0 - to)*Math.cos(x*Math.PI/2); }
    try { if (P.cancelAndHoldAtTime) P.cancelAndHoldAtTime(t); else { P.cancelScheduledValues(t); P.setValueAtTime(v0, t); } P.setValueCurveAtTime(c, t + .01, Math.max(.05, dur)); }
    catch(e){ try { P.cancelScheduledValues(0); P.setValueAtTime(v0, ctx.currentTime); P.linearRampToValueAtTime(to, ctx.currentTime + dur); } catch(e2){ P.value = to; } }
  }
  // ---------- streaming slots (pooled <audio> elements) ----------
  var POOL = [], SIL = 'assets/amb/silence.mp3';
  function newSlot(){
    var el = new Audio(); el.preload = 'auto'; el.crossOrigin = 'anonymous';
    var s = {el:el, g:ctx.createGain(), busy:false};
    try { s.src = ctx.createMediaElementSource(el); } catch(e){ return null; }
    s.g.gain.value = 0; s.src.connect(s.g);
    POOL.push(s); return s;
  }
  function getSlot(){ for (var i = 0; i < POOL.length; i++) if (!POOL[i].busy) { POOL[i].busy = true; return POOL[i]; } var s = POOL.length < 12 ? newSlot() : null; if (s) s.busy = true; return s; }
  function freeSlot(s){ if (!s) return; try { s.el.pause(); } catch(e){} try { s.g.disconnect(); } catch(e){} s.g.gain.cancelScheduledValues(0); s.g.gain.value = 0;
    s.el.removeAttribute('src'); try { s.el.load(); } catch(e){} s.busy = false; s.voice = null; }
  // iOS/Safari: elements may only start after they played once inside a user gesture -> prime the pool on unlock
  function prime(){ if (POOL.length >= 6) return; while (POOL.length < 6){ var s = newSlot(); if (!s) break; (function(s){ s.el.src = SIL; var p; try { p = s.el.play(); } catch(e){} if (p && p.then) p.then(function(){ if (!s.busy){ s.el.pause(); } }, function(){}); })(s); } }
  // ---------- a looping voice = one file on 1–2 slots ----------
  var AMB_DIR = 'assets/amb/';
  function Voice(file, level){
    this.file = file; this.vg = ctx.createGain(); this.vg.gain.value = 0; this.vg.connect(ambBus);
    this.a = null; this.b = null; this.dead = false; this.level = level; this.loops = 0; this.start(true);
  }
  Voice.prototype.start = function(first){
    var self = this, s = getSlot(); if (!s) return;
    s.voice = this; try { s.g.disconnect(); } catch(e){} s.g.connect(this.vg);
    var el = s.el, seek = function(){ try { if (START && Math.abs(el.currentTime - START) > .5) el.currentTime = START; } catch(e){} };
    el.loop = false;
    if (el.getAttribute('src') !== AMB_DIR + this.file) el.src = AMB_DIR + this.file;
    if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, {once:true});
    var p; try { p = el.play(); } catch(e){}
    if (p && p.catch) p.catch(function(){});
    if (first){ s.g.gain.value = 1; this.a = s; }
    else { s.g.gain.value = 0; ramp(s.g.gain, 1, LXF); var old = this.a; ramp(old.g.gain, 0, LXF); this.a = s; this.loops++;
           setTimeout(function(){ if (old.voice === self) freeSlot(old); }, LXF*1000 + 600); }
  };
  Voice.prototype.watch = function(){
    if (this.dead || !this.a) return;
    var el = this.a.el, d = el.duration;
    if (el.ended){ this.start(false); return; }
    if (d && isFinite(d) && el.currentTime >= d - LXF - .4 && !this.a.handing){ this.a.handing = true; this.start(false); }
    if (st.on && !document.hidden && el.paused && !el.ended && el.readyState >= 2 && running()){ var p = el.play(); if (p && p.catch) p.catch(function(){}); }
  };
  Voice.prototype.fade = function(to, sec){ this.target = to; ramp(this.vg.gain, to * this.level, sec); };
  Voice.prototype.stop = function(sec){
    var self = this; this.dead = true; this.fade(0, sec);
    setTimeout(function(){ POOL.forEach(function(s){ if (s.voice === self) freeSlot(s); }); try { self.vg.disconnect(); } catch(e){} }, sec*1000 + 500);
  };
  Voice.prototype.time = function(){ return this.a ? +this.a.el.currentTime.toFixed(1) : null; };
  // ---------- era state ----------
  var cur = null;   // {idx, n:Voice, w:Voice|null, war:bool}
  var curIdx = -1, curWar = false, wantIdx = -1, wantWar = false, dwellT = 0, eraChanges = 0;
  function applyState(idx, war){
    if (!running()) return;
    var R = idx >= 0 ? ERAS[idx] : null, lvl = R && R.gain != null ? R.gain : 1;
    war = !!(war && R && R.war);
    if (!cur || cur.idx !== idx){
      if (cur){ cur.n.stop(XF); if (cur.w) cur.w.stop(XF); }
      cur = null; curIdx = idx; curWar = war; eraChanges++;
      if (!R) return;
      cur = {idx:idx, n:new Voice(R.file, lvl), w:null, war:war};
      cur.n.fade(war ? 0 : 1, XF);
      if (war){ cur.w = new Voice(R.war, lvl); cur.w.fade(1, XF); }
      return;
    }
    if (cur.war === war) return;
    cur.war = war; curWar = war;
    if (war && !cur.w) cur.w = new Voice(R.war, lvl);
    if (cur.w) cur.w.fade(war ? 1 : 0, WXF);
    cur.n.fade(war ? 0 : 1, WXF);
  }
  setInterval(function(){ if (!cur || !running()) return; cur.n.watch(); if (cur.w) cur.w.watch(); }, 250);
  function onEvent(e){
    if (!ERAS.length || !e) return;
    var idx = ERA_OF[e.era] != null ? ERA_OF[e.era] : -1, war = !!WAR[String(e.o)];
    wantIdx = idx; wantWar = war; clearTimeout(dwellT);
    if (!running()) return;
    if (idx === curIdx && war === curWar && cur) return;
    if (!cur){ applyState(idx, war); return; }   // first sound after load/unlock: no wait
    dwellT = setTimeout(function(){ if (wantIdx === idx && wantWar === war) applyState(idx, war); }, DWELL);
  }
  function applyLevel(){ if (!ctx) return; var t = ctx.currentTime; gate.gain.cancelScheduledValues(t); gate.gain.setTargetAtTime(st.on ? 1 : 0, t, .4); ambBus.gain.cancelScheduledValues(t); ambBus.gain.setTargetAtTime(ambLevel(), t, .3); }
  function unlock(){
    if (!st.on || !ensure()) return;
    if (ERAS.length) prime();
    var go = function(){ disarm(); applyLevel(); if (ERAS.length && wantIdx >= 0 && !cur){ curIdx = -1; applyState(wantIdx, wantWar); } };
    if (ctx.state === 'suspended') ctx.resume().then(go, function(){});
    else if (ctx.state === 'running') go();
  }
  var armed = false, EVS = ['pointerdown','keydown','touchstart','touchend','click','wheel','scroll'];
  function arm(){ if (armed) return; armed = true; EVS.forEach(function(e){ window.addEventListener(e, unlock, {capture:true, passive:true}); }); }
  function disarm(){ if (!armed) return; armed = false; EVS.forEach(function(e){ window.removeEventListener(e, unlock, {capture:true, passive:true}); }); }
  function setOn(on){
    st.on = on; save(); ui();
    if (on){ unlock(); if (!ctx || ctx.state !== 'running') arm(); }
    else { applyLevel(); clearTimeout(dwellT); if (ctx) setTimeout(function(){ if (!st.on && ctx.state === 'running'){ if (cur){ cur.n.stop(.3); if (cur.w) cur.w.stop(.3); } cur = null; curIdx = -1; setTimeout(function(){ if (!st.on) ctx.suspend(); }, 900); } }, 900); }
  }
  // ---------- one-shot event sounds ----------
  var rr = {};
  function playSfx(o){
    if (!running()) return;
    var list = EVSFX[o]; if (!list || !list.length) return;   // unmapped events: silence
    rr[o] = ((rr[o] == null ? -1 : rr[o]) + 1) % list.length;
    var id = list[rr[o]], t0 = performance.now();
    load(id, function(buf){
      if (!buf || !running() || performance.now() - t0 > 1500) return;   // too late = skip (don't fire long after scrolling past)
      var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = .8; var lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2600;
      s.connect(lpf); lpf.connect(g); g.connect(sfxBus); s.start(ctx.currentTime + .02);
      // duck the ambience a little under the effect
      var t = ctx.currentTime, L = ambLevel(); ambBus.gain.cancelScheduledValues(t); ambBus.gain.setTargetAtTime(L*.8, t, .3); ambBus.gain.setTargetAtTime(L, t + Math.min(3, buf.duration), .8);
    });
  }
  // targets: {y (px from line top), o, fired}
  var targets = [], lastY = null, lastFire = 0, fired = [];
  function setTargets(list){ targets = list; lastY = null; }
  function spark(y){
    if (lastY === null){ lastY = y; return; }
    var y0 = lastY; lastY = y; if (Math.abs(y - y0) > 2500) return; // jumps (links, reload, mini-map) don't fire
    var now = performance.now(), live = running();
    for (var i = 0; i < targets.length; i++){
      var tg = targets[i];
      if (live && !tg.pre && Math.abs(tg.y - y) < 2200){ tg.pre = true; load(EVSFX[tg.o][0]); }   // fetch sounds shortly before they are needed
      if (tg.fired){ if (Math.abs(y - tg.y) > 320) tg.fired = false; continue; }
      if ((y0 < tg.y && y >= tg.y) || (y0 > tg.y && y <= tg.y)){
        tg.fired = true;
        if (now - lastFire > GAP && Math.abs(y - y0) < 140){ lastFire = now; fired.push(tg.o); if (fired.length > 20) fired.shift(); playSfx(tg.o); }
      }
    }
  }
  if (ambB) ambB.addEventListener('click', function(){ setOn(!st.on); });
  if (avol) avol.addEventListener('input', function(){ st.vol = +avol.value; if (st.vol > 0 && !st.on){ setOn(true); } save(); ui(); applyLevel(); });
  document.addEventListener('visibilitychange', function(){
    if (!ctx) return;
    if (document.hidden){ ctx.suspend(); POOL.forEach(function(s){ if (s.busy) try { s.el.pause(); } catch(e){} }); }
    else if (st.on) ctx.resume();   // the voice watcher restarts paused slots
  });
  ui();
  if (AC && st.on) arm();
  function vstate(v){ return v ? {file:v.file, t:v.time(), gain:+v.vg.gain.value.toFixed(3), target:v.target, loops:v.loops} : null; }
  function hold(on){
    on = !!on; if (on === held) return; held = on;
    if (!ctx) return;
    if (on){ var t = ctx.currentTime; gate.gain.cancelScheduledValues(t); gate.gain.setTargetAtTime(0, t, .25);
      setTimeout(function(){ if (held) POOL.forEach(function(s){ if (s.busy) try { s.el.pause(); } catch(e){} }); }, 1000); }
    else if (st.on){
      var go = function(){ POOL.forEach(function(s){ if (s.busy && s.el.paused){ var p = s.el.play(); if (p && p.catch) p.catch(function(){}); } }); applyLevel();
        if (wantIdx >= 0 && (wantIdx !== curIdx || wantWar !== curWar)) applyState(wantIdx, wantWar); };
      if (ctx.state === 'suspended') ctx.resume().then(go, function(){}); else go();
    }
  }
  return {onEvent:onEvent, setTargets:setTargets, spark:spark, hold:hold, play:function(o){ unlock(); playSfx(String(o)); },
    eras:ERAS, war:WAR, _seekEnd:function(sec){ if (cur && cur.n && cur.n.a){ var el = cur.n.a.el; try { el.currentTime = Math.max(0, el.duration - sec); } catch(e){} } },
    state:function(){ return {st:st, ctx:ctx && ctx.state, eras:ERAS.length, era:curIdx, file:curIdx >= 0 ? ERAS[curIdx].file : null, war:curWar, want:wantIdx, wantWar:wantWar,
      normal:cur && vstate(cur.n), warV:cur && vstate(cur.w), slots:POOL.filter(function(s){ return s.busy; }).length, eraChanges:eraChanges, bus:ambBus && +ambBus.gain.value.toFixed(3),
      cached:Object.keys(bufs), failed:Object.keys(failed), targets:targets.map(function(t){ return t.o; }), fired:fired.slice()}; }};
})();

// =====================================================================
// EVENT CONTENT CLASSIFIER (shared by the card-edge bursts and event SFX)
// keyword match on title first, then summary/tags, then the era theme
// =====================================================================
var KIND_RX = [
  ['dragon', /ejderha|dragon|wyrm|j[öo]rmun/],
  ['battle', /sava[şs]|ba[sş]k[ıi]n|ku[sş]atma|muharebe|katliam|[çc]at[ıi][şs]ma|isyan|ayaklan|bozgun|fethe|istila/],
  ['magic',  /cad[ıi]|b[üu]y[üu]|witch|portal|girift|iblis|lanet|hi[çc]lik|sihir/],
  ['death',  /ölüm|öldü|ölür|ölen|cenaze|katled|\byas\b|infaz|idam|suikast|can verir/],
  ['sea',    /deniz|okyanus|gemi|liman|amanar|korsan|dalga/],
  ['holy',   /tanr[ıi]|kutsal|melek|ilahi|tap[ıi]nak|dirilt|\belma|seraphim|ayin/],
  ['forge',  /c[üu]ce|demirci|forge|armatech|d[öo]k[üu]m|at[öo]lye|\bmaden/],
  ['storm',  /f[ıi]rt[ıi]na|deprem|yağmur|keder ya[ğg]|\bsel\b/],
  ['beast',  /kurt adam|\binu\b|canavar|yarat[ıi]k|hydra/],
  ['nature', /orman|a[ğg]a[çc]|\bentler?\b|druid|do[ğg]a|bah[çc]e|[şs]elale/]
];
var THEME_KIND = {witch:'magic', occult:'magic', girift:'magic', war:'battle', blood:'battle', fire:'battle', death:'death', grief:'death',
                  light:'holy', timestop:'holy', festival:'holy', sea:'sea', rain:'storm', crown:'sea', elven:'nature', calm:'nature', forge:'forge', industrial:'forge'};
function kindOf(e){
  var t = lc(e.title), all = lc([e.sum, e.chars.join(' '), e.places.join(' '), e.factions.join(' ')].join(' '));
  for (var i=0;i<KIND_RX.length;i++) if (KIND_RX[i][1].test(t)) return KIND_RX[i][0];
  for (var j=0;j<KIND_RX.length;j++) if (KIND_RX[j][1].test(all)) return KIND_RX[j][0];
  return THEME_KIND[THEME_OF[e.o]] || null;
}
var KIND_OF = {}; events.forEach(function(e){ KIND_OF[e.o] = kindOf(e); });
// burst colour per kind (major cards only)
var BURST = {magic:['180,107,255','spark'], death:['18,14,20','smoke'], battle:['255,58,46','spark'], dragon:['255,110,30','spark'], holy:['255,238,190','gold'],
             sea:['63,224,208','spark'], storm:['127,180,255','spark'], nature:['110,220,120','spark'], beast:['255,70,70','spark'], forge:['255,179,71','spark']};
function burstCard(el){
  var e = evByO[+el.dataset.o]; if (!e) return;
  var card = el.querySelector('.card'); if (!card) return;
  var r = card.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  var b = BURST[KIND_OF[e.o]], n = 110;
  if (!b){ var L = (VEC[EV_ELS.indexOf(el)] || VEC[0]).line; b = [Math.round(L[0])+','+Math.round(L[1])+','+Math.round(L[2]), 'gold']; }
  if (b[1] === 'smoke'){ FX.burst(r, b[0], 'smoke', n*0.35); FX.burst(r, '205,205,220', 'spark', n*0.6); }
  else FX.burst(r, b[0], b[1], n);
}
(function(){ // once per entry: fire when a major card is ~45% visible, re-arm when it has left the screen
  if (reduce || !('IntersectionObserver' in window)) return;
  var armedB = new WeakMap();
  var io = new IntersectionObserver(function(ents){
    ents.forEach(function(en){
      var el = en.target;
      if (!en.isIntersecting){ armedB.set(el, true); return; }
      if (en.intersectionRatio >= .45 && armedB.get(el) !== false){ armedB.set(el, false); setTimeout(function(){ burstCard(el); }, 380); }
    });
  }, {threshold:[0, .45]});
  // only the truly epic events (great wars, great victories, deaths that matter) get the ember burst
  var EPIC = {2:1,3:1,13:1,20:1,22:1,42:1,43:1,50:1,51:1,63:1,79:1,83:1,92:1,94:1,101:1,103:1,107:1,120:1,122:1,126:1,161:1,186:1,187:1,193:1,199:1,203:1,218:1};
  EV_ELS.forEach(function(el){ if (EPIC[+el.dataset.o]){ armedB.set(el, true); io.observe(el.querySelector('.card') ? el : el); } });
})();

// =====================================================================
// TAG CARDS ("bilgi kağıdı"): clicking a chip opens an animated parchment
// sheet with the tag's bio (site-build/tag_info.json -> assets/tags.js),
// photos with the same slider as the cards, and the list of events in which
// the tag appears (click = jump there). Places without their own photos show
// images of events at that place; characters without photos get an emblem.
// =====================================================================
var TagCard = (function(){
  var INFO = window.TAGINFO || {}, KEYS = {};
  Object.keys(INFO).forEach(function(k){ KEYS[lc(k)] = k; (INFO[k].alias||[]).forEach(function(a){ KEYS[lc(a)] = k; }); });
  var TYPE = {c:'Karakter', p:'Mekân', f:'Topluluk'}, CLS = {c:'chars', p:'places', f:'factions'};
  function resolve(name){
    var k = KEYS[lc(name)]; if (k) return {key:k, via:null};
    var base = String(name).split(/,|\s\(/)[0].trim();          // "Balahnur, 67. Cadde" / "Ark Armatech (kale)"
    if (base !== name && KEYS[lc(base)]) return {key:KEYS[lc(base)], via:base};
    return null;
  }
  function eventsWith(type, name){
    var f = CLS[type], n = lc(name);
    return events.filter(function(e){ return e[f].some(function(x){ return lc(x) === n; }); });
  }
  var el = document.createElement('div');
  el.className = 'tc'; el.hidden = true; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-labelledby','tcTitle');
  el.innerHTML = '<div class="tc-sheet"><div class="tc-roll tc-roll-t" aria-hidden="true"></div><div class="tc-paper">'+
    '<button class="tc-x" type="button" aria-label="Kapat (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" fill="none"/></svg></button>'+
    '<div class="tc-in"></div></div><div class="tc-roll tc-roll-b" aria-hidden="true"></div><div class="tc-seal" aria-hidden="true">✦</div></div>';
  document.body.appendChild(el);
  var inEl = el.querySelector('.tc-in'), opener = null, closeT = 0;
  function photosFor(type, key, evs){
    var info = INFO[key] || {}, ph = (info.ph||[]).map(function(p){ return {f:p.f, w:p.w, h:p.h, cap:p.cap}; });
    if (!ph.length && type === 'p'){
      evs.forEach(function(e){ if (ph.length < 4 && e.imgs && e.imgs[0]) ph.push({f:e.imgs[0].c, w:e.imgs[0].w, h:e.imgs[0].h, cap:e.title, auto:1}); });
    }
    return ph;
  }
  function build(type, name){
    var r = resolve(name), key = r && r.key, info = key ? INFO[key] : null;
    if (info && info.t) type = info.t === type ? type : (type || info.t);
    var evs = eventsWith(type, name);
    if (r && r.via && !evs.length) evs = eventsWith(type, r.via);
    var ph = photosFor(type, key || name, evs);
    if (!ph.length && type === 'p' && r && r.via) ph = photosFor('p', key, eventsWith('p', key));
    var h = '';
    if (ph.length){
      h += '<div class="tc-media'+(ph.length>1?' multi':'')+'" data-i="0"><div class="slides">';
      ph.forEach(function(p, i){ h += '<figure class="slide'+(i===0?' on':'')+'"><img '+(i<2?'src':'data-src')+'="'+esc(p.f)+'" width="'+p.w+'" height="'+p.h+'" alt="'+esc(p.cap||name)+'" decoding="async">'+(p.cap?'<figcaption>'+esc(p.cap)+'</figcaption>':'')+'</figure>'; });
      h += '</div>';
      if (ph.length>1){
        h += '<button class="gnav prev" type="button" aria-label="Önceki görsel"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button>'+
             '<button class="gnav next" type="button" aria-label="Sonraki görsel"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button><div class="dots">';
        for (var i=0;i<ph.length;i++) h += '<i'+(i===0?' class="on"':'')+'></i>';
        h += '</div>';
      }
      if (ph[0].auto) h += '<span class="tc-auto">Bu mekânın geçtiği olaylardan</span>';
      h += '</div>';
    } else {
      h += '<div class="tc-emblem tc-e-'+type+'">'+NONAGON+'<span>'+esc((name||'?').charAt(0).toLocaleUpperCase('tr'))+'</span></div>';
    }
    h += '<div class="tc-body"><div class="tc-k">'+(TYPE[type]||'Etiket')+'</div><h2 class="tc-t" id="tcTitle">'+esc(name)+'</h2>';
    if (r && r.via) h += '<div class="tc-s">'+esc(key)+' içinde</div>';
    else if (info && info.sub) h += '<div class="tc-s">'+esc(info.sub)+'</div>';
    h += '<div class="tc-rule" aria-hidden="true"><i></i><b>✦</b><i></i></div>';
    if (info && info.bio && info.bio.length && !(r && r.via && type !== 'p')){
      if (r && r.via) h += '<p class="tc-via">Bağlı olduğu yer: <b>'+esc(key)+'</b></p>';
      info.bio.forEach(function(p){ h += '<p>'+esc(p)+'</p>'; });
    } else if (!info){
      h += '<p class="tc-none">Bu ad için arşivde henüz ayrıntılı bir kayıt yok. Aşağıda geçtiği olaylar listeleniyor.</p>';
    }
    if (info && info.facts && !(r && r.via)){
      h += '<dl class="tc-facts">'; info.facts.forEach(function(f){ h += '<dt>'+esc(f[0])+'</dt><dd>'+esc(f[1])+'</dd>'; }); h += '</dl>';
    }
    if (evs.length){
      var asc = evs.slice().sort(function(a,b){ return a.o-b.o; });
      h += '<div class="tc-evh">Geçtiği olaylar <span>'+evs.length+'</span></div><ol class="tc-evs">';
      asc.forEach(function(e){ h += '<li><button type="button" data-go="'+e.o+'"><b>'+esc(e.big)+'</b><span>'+esc(e.title)+'</span></button></li>'; });
      h += '</ol>';
    }
    h += '</div>';
    return h;
  }
  function open(type, name, from){
    clearTimeout(closeT);
    opener = from || null;
    inEl.innerHTML = build(type, name); inEl.scrollTop = 0;
    el.hidden = false; el.classList.remove('out');
    document.body.classList.add('tc-open');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('on'); }); });
    el.querySelector('.tc-x').focus({preventScroll:true});
  }
  function close(){
    if (el.hidden || el.classList.contains('out')) return;
    el.classList.remove('on'); el.classList.add('out'); document.body.classList.remove('tc-open');
    closeT = setTimeout(function(){ el.hidden = true; el.classList.remove('out'); inEl.innerHTML = ''; }, 420);
    if (opener && opener.focus) opener.focus({preventScroll:true});
  }
  function slide(m, i){
    var s = m.querySelectorAll('.slide'), n = s.length; if (n < 2) return; i = ((i % n) + n) % n;
    s.forEach(function(x, j){ x.classList.toggle('on', j===i); if (Math.abs(j-i) <= 1){ var im = x.querySelector('img'); if (im && im.dataset.src && !im.getAttribute('src')) im.src = im.dataset.src; } });
    m.querySelectorAll('.dots i').forEach(function(d, j){ d.classList.toggle('on', j===i); }); m.dataset.i = i;
  }
  function go(o){
    close();
    var t = itemsEl.querySelector('.ev[data-o="'+o+'"]'); if (!t) return;
    var y = t.getBoundingClientRect().top + window.scrollY - innerHeight*0.22;
    window.scrollTo({top:y, behavior: reduce ? 'auto' : 'smooth'});
    t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); setTimeout(function(){ t.classList.remove('flash'); }, 2600);
  }
  el.addEventListener('click', function(ev){
    if (ev.target.closest('.tc-x')) return close();
    var m = ev.target.closest('.tc-media');
    if (m){ var nb = ev.target.closest('.gnav'); if (nb) return slide(m, +m.dataset.i + (nb.classList.contains('next')?1:-1));
            var d = ev.target.closest('.dots i'); if (d) return slide(m, Array.prototype.indexOf.call(d.parentNode.children, d)); }
    var g = ev.target.closest('[data-go]'); if (g) return go(+g.dataset.go);
    if (!ev.target.closest('.tc-paper')) close();
  });
  document.addEventListener('keydown', function(ev){
    if (el.hidden) return;
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft'){ var m = el.querySelector('.tc-media.multi'); if (m) slide(m, +m.dataset.i + (ev.key === 'ArrowRight'?1:-1)); }
    else if (ev.key === 'Tab'){ var f = Array.prototype.slice.call(el.querySelectorAll('button')).filter(function(b){ return b.offsetParent; }); if (!f.length) return;
      var k = f.indexOf(document.activeElement); ev.preventDefault(); f[(k + (ev.shiftKey?-1:1) + f.length) % f.length].focus(); }
  });
  (function(){ var sx = 0, sy = 0; el.addEventListener('touchstart', function(ev){ sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, {passive:true});
    el.addEventListener('touchend', function(ev){ var m = ev.target.closest && ev.target.closest('.tc-media.multi'); if (!m) return; var t = ev.changedTouches[0], dx = t.clientX-sx, dy = t.clientY-sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)*1.3) slide(m, +m.dataset.i + (dx<0?1:-1)); }, {passive:true}); })();
  // chips become buttons (keyboard + screen readers)
  itemsEl.querySelectorAll('.chips li').forEach(function(li){ li.setAttribute('role','button'); li.tabIndex = 0;
    li.setAttribute('aria-label', li.textContent + ' — bilgi kartını aç'); if (resolve(li.textContent)) li.classList.add('has-info'); });
  itemsEl.addEventListener('click', function(ev){
    var li = ev.target.closest('.chips li'); if (!li) return;
    ev.preventDefault(); open(li.classList.contains('c') ? 'c' : (li.classList.contains('p') ? 'p' : 'f'), li.textContent, li);
  });
  itemsEl.addEventListener('keydown', function(ev){
    var li = ev.target.closest && ev.target.closest('.chips li'); if (!li || (ev.key !== 'Enter' && ev.key !== ' ')) return;
    ev.preventDefault(); li.click();
  });
  return {open:open, close:close, resolve:resolve, isOpen:function(){ return !el.hidden; }};
})();

// =====================================================================
// MINI-MAP: hovering the era indicator (bottom-left) unfolds a small list
// of chapters; click = smooth scroll there. Collapsed and faint otherwise;
// tap toggles on touch screens.
// =====================================================================
var MiniMap = (function(){
  var mm = document.createElement('nav'); mm.className = 'mm'; mm.id = 'mm'; mm.setAttribute('aria-label','Bölümler — mini harita');
  var secs = Array.prototype.slice.call(itemsEl.querySelectorAll('section.era'));
  function span(id){ // year range of a chapter from its numeric dates (display: newest → oldest)
    var ys = events.filter(function(e){ return e.era === id && e.num; }).map(function(e){ var m = /\d{4}/.exec(e.big); return m ? +m[0] : null; }).filter(Boolean);
    if (!ys.length) return '';
    var a = Math.min.apply(null, ys), b = Math.max.apply(null, ys); return a === b ? String(a) : b + '–' + a;
  }
  var h = '<div class="mm-h">Bölümler</div><ol>';
  secs.forEach(function(s, i){ var id = s.dataset.era, c = chById[id] || {name:id}, no = chNo[id] || 0;
    h += '<li style="--d:'+Math.min(i,18)*22+'"><button type="button" data-era="'+esc(id)+'"><i>'+(ROMAN[no-1]||no)+'</i><span>'+esc(c.name)+'</span><em>'+esc(span(id))+'</em></button></li>'; });
  h += '</ol>';
  mm.innerHTML = h; hud.appendChild(mm);
  hud.setAttribute('aria-haspopup','true'); hud.setAttribute('aria-expanded','false'); hud.tabIndex = 0;
  hud.title = 'Bölümler arasında gezinmek için üzerine gel';
  // mouse: hover opens / leaving closes; touch & pen: tap toggles (decided per pointer, not per device, so hybrids work)
  var openT = 0, closeT2 = 0, lastPT = 'mouse';
  function set(o){ hud.classList.toggle('mm-open', o); hud.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) mark(); }
  function mark(){ var cur = curO != null && evByO[curO] ? evByO[curO].era : null;
    mm.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.era === cur); });
    var on = mm.querySelector('button.on'); if (on){ var ol = mm.querySelector('ol'); var top = on.offsetTop - ol.clientHeight/2; ol.scrollTop = Math.max(0, top); } }
  hud.addEventListener('pointerdown', function(ev){ lastPT = ev.pointerType || 'mouse'; });
  hud.addEventListener('pointerenter', function(ev){ if (ev.pointerType !== 'mouse') return; clearTimeout(closeT2); openT = setTimeout(function(){ set(true); }, 120); });
  hud.addEventListener('pointerleave', function(ev){ if (ev.pointerType !== 'mouse') return; clearTimeout(openT); closeT2 = setTimeout(function(){ set(false); }, 320); });
  hud.addEventListener('click', function(ev){
    var b = ev.target.closest('.mm button');
    if (b){ ev.stopPropagation(); var s = itemsEl.querySelector('section.era[data-era="'+b.dataset.era+'"]'); if (s){ var y = s.getBoundingClientRect().top + window.scrollY - innerHeight*0.12; window.scrollTo({top:y, behavior: reduce ? 'auto' : 'smooth'}); }
      if (lastPT !== 'mouse') set(false); return; }
    if (lastPT === 'mouse'){ clearTimeout(openT); clearTimeout(closeT2); set(true); }
    else set(!hud.classList.contains('mm-open'));
  });
  hud.addEventListener('keydown', function(ev){ if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === hud){ ev.preventDefault(); set(!hud.classList.contains('mm-open')); if (hud.classList.contains('mm-open')){ var f = mm.querySelector('button.on') || mm.querySelector('button'); if (f) f.focus(); } }
    else if (ev.key === 'Escape'){ set(false); hud.focus(); } });
  hud.addEventListener('focusout', function(){ setTimeout(function(){ if (!hud.contains(document.activeElement)) set(false); }, 50); });
  document.addEventListener('click', function(ev){ if (!hud.contains(ev.target)) set(false); });
  window.addEventListener('scroll', function(){ if (lastPT !== 'mouse' && hud.classList.contains('mm-open')){ clearTimeout(closeT2); closeT2 = setTimeout(function(){ set(false); }, 1600); } }, {passive:true});
  return {open:function(){ set(true); }, close:function(){ set(false); }, mark:mark};
})();

// =====================================================================
// CINEMATIC ERA TITLES: the first time (per visit, sessionStorage) the view
// enters a chapter, its name and years rise in the centre for ~3.5s and fade.
// Never blocks clicks; waits while scrolling very fast / a sheet is open and
// shows it once things settle if the view is still in that chapter (a chapter
// merely flown past is not marked as seen, so it still gets its title later).
// =====================================================================
var EraTitle = (function(){
  var KEY = 'ulv-era-seen', seen = {};
  try { seen = JSON.parse(sessionStorage.getItem(KEY)||'{}') || {}; } catch(e){ seen = {}; }
  var el = document.createElement('div'); el.className = 'et'; el.setAttribute('aria-hidden','true');
  el.innerHTML = '<div class="et-in"><div class="et-k"></div><div class="et-n"></div><div class="et-rule"><i></i><b>\u2726</b><i></i></div><div class="et-y"></div></div>';
  document.body.appendChild(el);
  var kEl = el.querySelector('.et-k'), nEl = el.querySelector('.et-n'), yEl = el.querySelector('.et-y');
  var vel = 0, lastY = window.scrollY, lastT = performance.now(), cur = null, pend = null, pendT = 0, hideT = 0, log = [];
  window.addEventListener('scroll', function(){ var t = performance.now(), dt = Math.max(8, t - lastT), v = Math.abs(window.scrollY - lastY) / dt * 1000; vel = vel*0.5 + v*0.5; lastY = window.scrollY; lastT = t; }, {passive:true});
  function speed(){ return performance.now() - lastT > 220 ? 0 : vel; }
  function years(id){
    var evs = events.filter(function(e){ return e.era === id; });
    var ys = []; evs.forEach(function(e){ if (e.num) (String(e.date).match(/\d{4}/g) || []).forEach(function(y){ ys.push(+y); }); });
    if (ys.length){ var a = Math.min.apply(null, ys), b = Math.max.apply(null, ys); return a === b ? String(a) : a + ' – ' + b; }
    var seenL = {}, labels = [];
    evs.slice().sort(function(a, b){ return a.o - b.o; }).forEach(function(e){ if (!seenL[e.big]){ seenL[e.big] = 1; labels.push(e.big); } });
    return labels.slice(0, 3).join(' · ');
  }
  function busy(){ var lb = document.querySelector('.lb'); return document.body.classList.contains('tc-open') || (lb && !lb.hidden); }
  function show(id){
    var c = chById[id] || {name:id}, no = chNo[id] || 0, nm = String(c.name).replace(/^\d{4}\s*[—–-]\s*/, '');
    kEl.textContent = 'Bölüm ' + (ROMAN[no-1] || no); nEl.textContent = nm; yEl.textContent = years(id);
    seen[id] = 1; try { sessionStorage.setItem(KEY, JSON.stringify(seen)); } catch(e){}
    log.push(id);
    clearTimeout(hideT); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    hideT = setTimeout(function(){ el.classList.remove('on'); }, 4200);
  }
  function check(){
    if (!pend) return;
    if (speed() > innerHeight * 2.2 || busy()){ pendT = setTimeout(check, 300); return; }
    var id = pend; pend = null;
    if (id === cur && !seen[id]) show(id);
  }
  function enter(id){
    if (!id) return; cur = id;
    if (seen[id]) return;
    pend = id; clearTimeout(pendT); pendT = setTimeout(check, 260);
  }
  return {enter:enter, seen:function(){ return Object.keys(seen); }, log:function(){ return log.slice(); }, reset:function(){ seen = {}; try { sessionStorage.removeItem(KEY); } catch(e){} }};
})();

// =====================================================================
// SCROLL ANIMATIONS (reversible: scrub)
// =====================================================================
function buildAnimations(){
  var mobile = mqMobile.matches;
  gsap.registerPlugin(ScrollTrigger);
  gsap.to('.hero-inner', {yPercent:40, opacity:0, scale:.92, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  gsap.to('.hero-ring', {scale:1.35, opacity:0, rotate:40, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  gsap.to('.bg-far', {yPercent:-14, ease:'none', scrollTrigger:{start:0, end:'max', scrub:true}});
  gsap.to('.bg-fog', {yPercent:-30, xPercent:4, ease:'none', scrollTrigger:{start:0, end:'max', scrub:true}});
  var tlEl = document.getElementById('timeline');
  ScrollTrigger.create({trigger:tlEl, start:'top 60%', end:'bottom 60%', scrub:true, onUpdate:function(self){
    var p = self.progress, H = tlEl.offsetHeight; sparkGeo.p = p; sparkGeo.h = H;
    gsap.set('#lineFill', {scaleY:p}); gsap.set('#lineSpark', {y: p*H});
    Ambience.spark(p*H);
    hudBar.style.width = (p*100).toFixed(1)+'%';
  }});
  ScrollTrigger.create({trigger:tlEl, start:'top 70%', end:'bottom 30%', onToggle:function(self){ hud.classList.toggle('on', self.isActive); }});

  gsap.utils.toArray('.era').forEach(function(el){
    gsap.fromTo(el.querySelector('.era-inner'), {scale:.2, opacity:0, rotateX:-70, filter:'blur(6px)'},
      {scale:1, opacity:1, rotateX:0, filter:'blur(0px)', ease:'power2.out', scrollTrigger:{trigger:el, start:'top 95%', end:'top 65%', scrub:.6}});
  });

  EV_ELS.forEach(function(el){
    var left = el.classList.contains('left') && !mobile;
    var dir = left ? 1 : -1;
    var card = el.querySelector('.card'), arm = el.querySelector('.arm'), dot = el.querySelector('.dot'),
        pill = el.querySelector('.pill'), media = el.querySelector('.media'), slides = el.querySelector('.slides'),
        ui = el.querySelectorAll('.gnav, .dots, .zoom'),
        bits = el.querySelectorAll('.date, h3, .summary, .chips, .more');
    var origin = left ? '100% 50%' : '0% 50%';
    var tl = gsap.timeline({scrollTrigger:{trigger:el, start:'top 94%', end:'top 52%', scrub:.7,
      onEnter:function(){setCurrent(el);}, onEnterBack:function(){setCurrent(el);} }});
    tl.fromTo(dot, {scale:0, opacity:0}, {scale:1, opacity:1, duration:.18, ease:'back.out(3)'}, 0);
    if (pill) tl.fromTo(pill, {opacity:0, y:10}, {opacity:1, y:0, duration:.2}, .02);
    tl.fromTo(arm, {scaleX:0}, {scaleX:1, duration:.22, ease:'power1.inOut'}, .05);
    tl.fromTo(card, {x: dir*(mobile?40:140), rotateY: dir*-88, scale:.55, opacity:0, transformOrigin:origin},
                    {x:0, rotateY: dir*-7, scale:1, opacity:1, transformOrigin:origin, duration:.6, ease:'power2.out'}, .12);
    if (media){
      tl.fromTo(media, {clipPath: left ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)'}, {clipPath:'inset(0% 0% 0% 0%)', duration:.45, ease:'power2.inOut'}, .35);
      if (slides) tl.fromTo(slides, {scale:1.35}, {scale:1, duration:.55, ease:'power2.out'}, .35);
      if (ui.length) tl.fromTo(ui, {opacity:0, scale:.6}, {opacity:1, scale:1, duration:.2, stagger:.03}, .7);
    }
    tl.fromTo(bits, {opacity:0, x: dir*30}, {opacity:1, x:0, stagger:.04, duration:.3, ease:'power1.out'}, .38);
    if (slides) gsap.fromTo(slides, {yPercent:-6}, {yPercent:6, ease:'none', immediateRender:false, scrollTrigger:{trigger:el, start:'top bottom', end:'bottom top', scrub:true}});
    if (!mobile && window.matchMedia('(hover:hover)').matches){
      var wrap = el.querySelector('.card-wrap');
      wrap.addEventListener('mousemove', function(ev){ var r = wrap.getBoundingClientRect(); var px = (ev.clientX-r.left)/r.width-.5, py=(ev.clientY-r.top)/r.height-.5;
        gsap.to(wrap, {rotateY: px*8, rotateX: -py*6, duration:.4, ease:'power2.out', overwrite:'auto'}); });
      wrap.addEventListener('mouseleave', function(){ gsap.to(wrap, {rotateY:0, rotateX:0, duration:.6, overwrite:'auto'}); });
    }
  });
}

function showAllStatic(){
  hud.classList.add('on');
  document.getElementById('lineFill').style.transform = 'scaleY(1)';
  var io = new IntersectionObserver(function(ents){ ents.forEach(function(en){ if (en.isIntersecting) setCurrent(en.target); }); }, {rootMargin:'-45% 0px -45% 0px'});
  EV_ELS.forEach(function(el){ io.observe(el); });
}

// "Detaylar" toggles change card heights -> re-run the masonry + triggers
itemsEl.addEventListener('toggle', function(ev){ if (ev.target.classList && ev.target.classList.contains('more')) relayout(30); }, true);

function start(){
  layout(); computeAnchors();
  if (reduce || !window.gsap || !window.ScrollTrigger){ showAllStatic(); applyAtmosphere(); return; }
  buildAnimations();
  ScrollTrigger.refresh(); computeAnchors(); scrollDirty = true;
}
var relayoutT;
function relayout(ms){ clearTimeout(relayoutT); relayoutT = setTimeout(function(){ layout(); if (window.ScrollTrigger && !reduce) ScrollTrigger.refresh(); computeAnchors(); scrollDirty = true; if (reduce) applyAtmosphere(); }, ms==null?120:ms); }

start();
document.querySelectorAll('a[href^="#"]').forEach(function(a){ a.addEventListener('click', function(ev){ var t = document.querySelector(a.getAttribute('href')); if (!t) return; ev.preventDefault(); t.scrollIntoView({behavior: reduce?'auto':'smooth'}); }); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ relayout(); });
window.addEventListener('load', function(){ relayout(); });
window.addEventListener('resize', function(){ relayout(); });
mqMobile.addEventListener && mqMobile.addEventListener('change', function(){ if (mqMobile.matches!==MOBILE){ location.reload(); } });
// SFX targets: only the events listed in MU.eventSfx (assets/music.js) — 40 important events.
// Fired when the moving line spark reaches the event's dot.
var SFX_MAP = MU.eventSfx || {};
var SFX_EVS = EV_ELS.map(function(el){ var o = String(el.dataset.o); return SFX_MAP[o] ? {el:el, o:o} : null; }).filter(Boolean);
window.Ambience_targets = function(sy){ if (!lineEl) return;
  Ambience.setTargets(SFX_EVS.map(function(t){ var d = t.el.querySelector('.dot') || t.el, r = d.getBoundingClientRect(); return {y: r.top + sy + r.height/2 - sparkGeo.top - 13, o:t.o, fired:false}; })); };
window.Ambience_targets(window.scrollY);
window.__ulv = {EraTitle:EraTitle, weatherOf:function(o){ return WEATHER_OF[o] || null; }, weather:function(){ var y = window.scrollY + innerHeight*0.55, n = anchors.length; if (!n) return null; var lo = 0; for (var i=0;i<n;i++){ if (Math.abs(anchors[i]-y) < Math.abs(anchors[lo]-y)) lo = i; } return WEATHER_OF[events[lo].o] || null; }, songRegions:function(){ return SONG_REG; }, focus:function(){ return focusIdx >= 0 ? events[focusIdx].o : null; }, Music:Music, Ambience:Ambience, FX:FX, Effects:Effects, Lightbox:Lightbox, TagCard:TagCard, MiniMap:MiniMap, kind:KIND_OF, burstCard:burstCard, theme:THEME_OF, atm:function(){return ATM;}};
})();
