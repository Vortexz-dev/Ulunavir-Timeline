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

// smoothed per-event atmosphere vectors (display order)
var VEC = (function(){
  var raw = events.map(function(e){return themeVec(THEME_OF[e.o], e.age);});
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
  var y = {left:0,right:0}, lastTop = -1e9, MIN_STEP = 96, GAP = 44, first = true;
  var kids = itemsEl.children;
  for (var i=0;i<kids.length;i++){
    var el = kids[i], h = el.offsetHeight, top;
    if (el.classList.contains('era')){
      var post = el.classList.contains('post');
      top = Math.max(y.left, y.right) + (first ? 30 : (post ? 150 : 90));
      el.style.top = top+'px';
      y.left = y.right = top + h + (post ? 90 : 60); lastTop = top + h; first = false;
    } else {
      var s = el.classList.contains('left')?'left':'right';
      top = Math.max(y[s], lastTop + MIN_STEP);
      el.style.top = top+'px';
      y[s] = top + h + GAP; lastTop = top;
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
    W = cv.width = Math.round(innerWidth*dpr); H = cv.height = Math.round(innerHeight*dpr);
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
    for (var i=0;i<n && bursts.length<260;i++){
      var d = R()*per, x, y, nx, ny;
      if (d < r.width){ x = r.left + d; y = r.top; nx = 0; ny = -1; }
      else if ((d -= r.width) < r.height){ x = r.right; y = r.top + d; nx = 1; ny = 0; }
      else if ((d -= r.height) < r.width){ x = r.right - d; y = r.bottom; nx = 0; ny = 1; }
      else { d -= r.width; x = r.left; y = r.bottom - d; nx = -1; ny = 0; }
      var sp = (mode === 'smoke' ? .35 + R()*.6 : .6 + R()*1.8), tang = (R()-.5)*1.2;
      bursts.push({x:x*dpr, y:(y+sy)*dpr, vx:(nx*sp + (ny ? tang : 0) + (R()-.5)*.3)*dpr, vy:(ny*sp + (nx ? tang : 0) - (mode === 'smoke' ? .25 : .1))*dpr,
        life:-R()*18, max:(mode === 'smoke' ? 70 : 45) + R()*40, r:(mode === 'smoke' ? 6 + R()*10 : 1 + R()*1.8)*dpr, c:rgb, m:mode});
    }
  }
  function drawBursts(dt){
    if (!bursts.length) return;
    var off = window.scrollY*dpr;
    for (var b=bursts.length-1; b>=0; b--){
      var p = bursts[b]; p.life += dt; if (p.life < 0) continue;
      p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.975; p.vy = p.vy*0.975 - (p.m === 'smoke' ? 0.004 : 0.012)*dpr*dt;
      var f = 1 - p.life/p.max; if (f <= 0){ bursts.splice(b,1); continue; }
      var sx = p.x, sy = p.y - off; if (sy < -40 || sy > H + 40) continue;
      if (p.m === 'smoke'){
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = f*0.45; var rr = p.r*(1.6 - f*0.6);
        ctx.drawImage(smokeSpr, sx-rr, sy-rr, rr*2, rr*2);
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = f*0.5; ctx.fillStyle = 'rgb('+p.c+')'; ctx.beginPath(); ctx.arc(sx, sy, p.r*2.4, 0, 6.283); ctx.fill();
        ctx.globalAlpha = f; ctx.fillStyle = p.m === 'gold' ? '#fffbe8' : 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(sx, sy, p.r*0.7, 0, 6.283); ctx.fill();
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
  if (scrollDirty){ scrollDirty = false; applyAtmosphere(); if (ATM) FX.setTargets(ATM.p); }
  if (dy && ATM && !reduce){
    sparkAcc += Math.abs(dy);
    if (sparkAcc > 22){
      var n = Math.min(3, Math.floor(sparkAcc/22)); sparkAcc = 0;
      var cy = sparkGeo.top - sy + 13 + sparkGeo.p * sparkGeo.h;
      if (cy > 0 && cy < innerHeight && sparkGeo.h){
        var d = FX.dpr(), L = ATM.line;
        FX.emitSparks(n, dy>0?1:-1, sparkGeo.x*d, cy*d, Math.round(L[0])+','+Math.round(L[1])+','+Math.round(L[2]));
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
  Ambience.onTheme(THEME_OF[o]);
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
// MUSIC (local MP3s via one HTML5 <audio>, fixed looping playlist 1..N -> 1)
// config: assets/music.js. Autoplay is attempted on load; if the browser
// refuses (no user gesture yet) playback starts on the first click / touch /
// key / scroll. Default ON unless the visitor switched it off before.
// =====================================================================
var Music = (function(){
  var KEY = 'ulv-music', st = {on:true, vol:(MU.volume!=null?MU.volume:35), muted:false, idx:0};
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv) { st.on = sv.on !== false; st.vol = sv.vol!=null ? (+sv.vol||0) : st.vol; st.muted = !!sv.muted; st.idx = +sv.idx||0; } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  var btn = mpEl.querySelector('.mp-btn'), playB = mpEl.querySelector('.mp-play'), prevB = mpEl.querySelector('.mp-prev'), nextB = mpEl.querySelector('.mp-next'),
      muteB = mpEl.querySelector('.mp-mute'), vol = mpEl.querySelector('.mp-vol'), now = mpEl.querySelector('.mp-now');
  var tracks = (MU.playlist||[]).map(function(t){ t = typeof t === 'string' ? {src:t} : (t||{}); return {src:t.src||'', name:t.name||''}; }).filter(function(t){ return t.src; });
  var N = tracks.length;
  if (!(st.idx >= 0 && st.idx < N)) st.idx = 0;
  var au = new Audio(); au.preload = 'none'; au.loop = false; au.volume = 0;
  var isPlaying = false, blocked = false, pending = false, errStreak = 0, fadeR = 0, loadedIdx = -1, gain = 0;

  function title(i){ return tracks[i].name || 'Parça'; }
  function ui(){
    mpEl.classList.toggle('playing', st.on && isPlaying);
    mpEl.classList.toggle('on', st.on);
    playB.setAttribute('aria-label', st.on ? 'Durdur' : 'Çal'); playB.classList.toggle('is-on', st.on);
    muteB.classList.toggle('is-muted', st.muted || st.vol === 0); muteB.setAttribute('aria-label', st.muted ? 'Sesi aç' : 'Sesi kapat');
    vol.value = st.vol; vol.style.setProperty('--v', st.vol+'%');
    var txt;
    if (!N) txt = 'Henüz müzik eklenmedi';
    else if (st.on && errStreak >= N) txt = 'Parçalar oynatılamadı';
    else if (st.on && blocked && !isPlaying) txt = (st.idx+1)+'/'+N+' · '+title(st.idx)+' — başlatmak için kaydır ya da tıkla';
    else txt = (st.idx+1)+'/'+N+' · '+title(st.idx);
    now.textContent = txt; now.title = N ? (st.idx+1)+'/'+N+' — '+title(st.idx) : '';
  }
  function target(){ return st.muted ? 0 : st.vol/100; }
  function setG(g){ gain = g; au.volume = Math.max(0, Math.min(1, g)); }
  function fadeTo(to, ms, done){
    cancelAnimationFrame(fadeR); var from = gain, t0 = performance.now();
    (function f(){ var k = Math.min(1, (performance.now()-t0)/Math.max(1,ms)); setG(from + (to-from)*smooth(k)); if (k < 1) fadeR = requestAnimationFrame(f); else if (done) done(); })();
  }
  function load(i){ if (loadedIdx === i) return; loadedIdx = i; au.src = tracks[i].src; au.preload = 'auto'; }
  // returns the play() promise result via callbacks
  function play(fade){
    if (!N || !st.on) return;
    load(st.idx); au.muted = false;
    if (fade) setG(0);
    pending = true;
    var p; try { p = au.play(); } catch(e){ p = null; }
    var ok = function(){ pending = false; blocked = false; errStreak = 0; if (fade) fadeTo(target(), MU.fadeMs||1200); else setG(target()); ui(); },
        bad = function(err){ pending = false; if (err && err.name === 'NotAllowedError'){ blocked = true; armGesture(); } ui(); };
    if (p && p.then) p.then(ok, bad); else ok();
  }
  function go(i, keepVol){
    if (!N) return;
    st.idx = ((i % N) + N) % N; save(); ui();
    loadedIdx = -1;
    if (!st.on) return;
    load(st.idx); play(!keepVol);
  }
  au.addEventListener('playing', function(){ isPlaying = true; errStreak = 0; ui(); });
  au.addEventListener('pause', function(){ isPlaying = false; ui(); });
  au.addEventListener('ended', function(){ isPlaying = false; if (st.on) go(st.idx+1, true); });
  au.addEventListener('error', function(){ if (loadedIdx < 0) return; isPlaying = false; errStreak++; ui(); if (st.on && errStreak < N) setTimeout(function(){ go(st.idx+1, true); }, 700); });
  function stop(){ fadeTo(0, 700, function(){ au.pause(); }); isPlaying = false; ui(); }
  function setOn(on){ st.on = on; save(); errStreak = 0; if (on) play(true); else stop(); ui(); }
  // first real interaction unlocks audio when autoplay was refused
  // only real activation events can unlock audio (wheel/scroll cannot, and a failed
  // attempt from them used to swallow the next click while 'pending')
  var armed = false, EVS = ['pointerdown','pointerup','keydown','touchstart','touchend','click','wheel','scroll'];
  function onGesture(){ if (!st.on || isPlaying){ disarm(); return; } play(true); }
  function armGesture(){ if (armed) return; armed = true; EVS.forEach(function(t){ window.addEventListener(t, onGesture, {capture:true, passive:true}); }); }
  function disarm(){ if (!armed) return; armed = false; EVS.forEach(function(t){ window.removeEventListener(t, onGesture, {capture:true, passive:true}); }); }
  au.addEventListener('playing', disarm);
  function setOpen(o){ mpEl.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); document.body.classList.toggle('mp-open', o); }
  function step(d){ errStreak = 0; if (st.on) go(st.idx+d, true); else { st.idx = ((st.idx+d) % N + N) % N; save(); loadedIdx = -1; ui(); } }
  btn.addEventListener('click', function(){ setOpen(!mpEl.classList.contains('open')); });
  playB.addEventListener('click', function(ev){ ev.stopPropagation(); setOn(!(st.on && (isPlaying || !blocked))); });
  if (prevB) prevB.addEventListener('click', function(){ step(-1); });
  if (nextB) nextB.addEventListener('click', function(){ step(1); });
  muteB.addEventListener('click', function(){ st.muted = !st.muted; if (!st.muted && st.vol === 0) st.vol = 30; save(); cancelAnimationFrame(fadeR); setG(target()); ui(); });
  vol.addEventListener('input', function(){ st.vol = +vol.value; st.muted = st.vol === 0; save(); cancelAnimationFrame(fadeR); setG(target()); ui(); });
  document.addEventListener('click', function(ev){ if (!mpEl.contains(ev.target) && mpEl.classList.contains('open')) setOpen(false); });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && mpEl.classList.contains('open')) { setOpen(false); btn.focus(); } });
  if (!N) mpEl.classList.add('empty');
  ui();
  // sound hint: shown only while the browser blocks autoplay
  var hint = document.createElement('div'); hint.className = 'snd-hint'; hint.setAttribute('role','status');
  hint.innerHTML = '<span class="snd-ic">\u266A</span> Müzik ve ambiyans için kaydır ya da herhangi bir yere tıkla';
  document.body.appendChild(hint);
  function hintUi(){ hint.classList.toggle('show', !!(st.on && N && blocked && !isPlaying)); }
  au.addEventListener('playing', hintUi); au.addEventListener('pause', hintUi);
  var _ui = ui; ui = function(){ _ui(); hintUi(); };
  if (st.on && N) { play(true); window.addEventListener('load', function(){ if (!isPlaying) play(true); }); } // try autoplay right away; falls back to first gesture
  return {onEvent:function(){ /* music does not follow eras; ambience does */ }, next:function(){ step(1); }, prev:function(){ step(-1); },
    state:function(){ return {st:st, idx:st.idx, n:N, title:N?title(st.idx):null, playing:isPlaying, blocked:blocked, t:Math.round(au.currentTime||0), vol:Math.round(au.volume*100), src:au.currentSrc, errStreak:errStreak}; }};
})();

// =====================================================================
// AMBIENCE: real recorded loops (assets/sfx/amb-*.mp3, CC0 / public domain /
// CC BY, see assets/sfx/CREDITS.md) chosen per era theme from a pool with a
// no-repeat window, dwell-time hysteresis while scrolling, long crossfades
// and slow in-place rotation. The old procedural WebAudio layers stay as a
// fallback (file:// or failed downloads) and for the drone pad.
// One-shot event sounds: when the moving timeline spark reaches a major
// event, a sound matching its content plays (dragon roar, sword clashes
// with distant shouting, magic shimmer, low toll, waves, bells, anvil,
// thunder, howl); events with no match get a soft synthesized chime.
// Own on/off + volume (localStorage 'ulv-amb'); off = silent, SFX included.
// =====================================================================
var Ambience = (function(){
  var KEY = 'ulv-amb', cfg = MU.ambience || {}, st = {on: cfg.on !== false, vol: cfg.volume != null ? cfg.volume : 30};
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv){ st.on = sv.on !== false; if (sv.vol != null) st.vol = +sv.vol||0; } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  var ambB = mpEl.querySelector('.mp-amb'), avol = mpEl.querySelector('.mp-avol');
  var AC = window.AudioContext || window.webkitAudioContext;
  var BEDS = cfg.beds || {}, POOLS = cfg.pools || {}, SFXV = cfg.sfx || {};
  var FADE = cfg.fadeSec || 4.5, DWELL = (cfg.dwellSec != null ? cfg.dwellSec : 2.2) * 1000, ROT = cfg.rotateSec || [80, 130], NOREP = cfg.noRepeat || 5;
  var SYN = {ice:'wind', snowcity:'wind', sky:'wind', ancient:'wind', calm:'wind', memory:'wind', grief:'wind', night:'wind', death:'wind', sand:'wind', modern:'wind',
             fire:'fire', war:'fire', forge:'fire', industrial:'fire', blood:'fire', rain:'rain', sea:'sea',
             elven:'forest', light:'forest', festival:'forest', witch:'forest', crown:'forest',
             occult:'drone', girift:'drone', sterile:'drone', timestop:'drone', quake:'drone'};
  var PAD = {girift:.55, timestop:.4, occult:.3, sterile:.3, death:.25}; // quiet synth drone under these themes
  var ctx = null, master = null, sfxBus = null, bedBus = null, white = null, brown = null, comp = null;
  var curTheme = null, wantTheme = null, dwellT = 0, rotT = 0, hist = [], cur = null, synth = {}, curSyn = null, padL = null, spawnT = 0;
  var bufs = {}, lru = [], loading = {}, failed = {}, noFiles = location.protocol === 'file:';
  function ui(){
    if (ambB){ ambB.classList.toggle('is-off', !st.on); ambB.setAttribute('aria-pressed', st.on ? 'true' : 'false'); }
    if (avol){ avol.value = st.vol; avol.style.setProperty('--v', st.vol+'%'); }
  }
  function level(){ return st.on ? Math.pow(st.vol/100, 1.5) * 0.5 : 0; }
  function noiseBuf(kind, sec){
    var n = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++){ var w = Math.random()*2-1; if (kind === 'brown'){ last = (last + 0.02*w)/1.02; d[i] = last*3.5; } else d[i] = w; }
    var f = Math.min(2048, n>>3); for (var j = 0; j < f; j++){ var k = j/f; d[n-f+j] = d[n-f+j]*(1-k) + d[j]*k; }
    return b;
  }
  function ensure(){
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch(e){ return null; }
    master = ctx.createGain(); master.gain.value = 0;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = .01; comp.release.value = .3;
    master.connect(comp); comp.connect(ctx.destination);
    bedBus = ctx.createGain(); bedBus.gain.value = 2.2; bedBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.32; sfxBus.connect(master);
    white = noiseBuf('white', 3); brown = noiseBuf('brown', 6);
    return ctx;
  }
  function running(){ return ctx && ctx.state === 'running' && st.on; }
  // ---------- file loading (decoded buffers, small LRU so memory stays low) ----------
  function url(id){ return 'assets/sfx/' + id + '.mp3'; }
  function load(id, cb){
    if (bufs[id]){ touch(id); return cb && cb(bufs[id]); }
    if (failed[id] || noFiles || !window.fetch) return cb && cb(null);
    if (loading[id]){ if (cb) loading[id].push(cb); return; }
    loading[id] = cb ? [cb] : [];
    fetch(url(id)).then(function(r){ if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function(ab){ return new Promise(function(res, rej){ var p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); })
      .then(function(b){ bufs[id] = b; touch(id); var l = loading[id]; delete loading[id]; l.forEach(function(f){ f(b); }); },
            function(){ failed[id] = true; var l = loading[id]; delete loading[id]; l.forEach(function(f){ f(null); }); });
  }
  function touch(id){
    var i = lru.indexOf(id); if (i >= 0) lru.splice(i, 1); lru.push(id);
    while (lru.length > 5){ var old = lru.shift(); if (cur && cur.id === 'amb-' + old) { lru.push(old); break; } if (/^amb-/.test(old)) delete bufs[old]; }
  }
  // ---------- beds ----------
  function pickBed(theme, avoid){
    var pool = (POOLS[theme] || POOLS.modern || []).filter(function(b){ return !failed['amb-' + b]; });
    if (!pool.length) return null;
    var fresh = pool.filter(function(b){ return b !== avoid && hist.indexOf(b) < 0; });
    if (!fresh.length) fresh = pool.filter(function(b){ return b !== avoid; });
    if (!fresh.length) fresh = pool;
    // least recently used among the candidates, random tie-break
    fresh.sort(function(a, b){ return (hist.lastIndexOf(a) - hist.lastIndexOf(b)) || (Math.random() - .5); });
    return fresh[0];
  }
  function startBed(bed){
    var id = 'amb-' + bed;
    load(id, function(buf){
      if (!buf){ synthFallback(curTheme); return; }
      if (!running() || !curTheme) return;
      var t = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain(), gain = (BEDS[bed] && BEDS[bed].g) || 1;
      s.buffer = buf; s.loop = true; s.loopStart = .03; s.loopEnd = buf.duration - .03;
      g.gain.value = 0; s.connect(g); g.connect(bedBus);
      s.start(t, .03 + Math.random() * (buf.duration - 1));
      g.gain.setTargetAtTime(gain, t + .05, FADE / 3);
      fadeOutCur(); cur = {id:id, bed:bed, s:s, g:g};
      hist.push(bed); if (hist.length > NOREP) hist.shift();
      synthFallback(null);
      scheduleRotate();
    });
  }
  function fadeOutCur(){
    if (!cur) return; var o = cur; cur = null; var t = ctx.currentTime;
    o.g.gain.cancelScheduledValues(t); o.g.gain.setTargetAtTime(0, t, FADE / 3);
    setTimeout(function(){ try { o.s.stop(); } catch(e){} try { o.g.disconnect(); } catch(e){} }, FADE * 1000 + 2500);
  }
  function scheduleRotate(){
    clearTimeout(rotT);
    rotT = setTimeout(function(){ if (running() && curTheme && !document.hidden){ var b = pickBed(curTheme, cur && cur.bed); if (b && (!cur || b !== cur.bed)) startBed(b); else scheduleRotate(); } }, (ROT[0] + Math.random() * (ROT[1] - ROT[0])) * 1000);
  }
  function applyTheme(theme){
    if (!running()) return;
    var changed = theme !== curTheme; curTheme = theme;
    setPad(PAD[theme] || 0);
    var pool = POOLS[theme] || [];
    if (cur && pool.indexOf(cur.bed) >= 0) return;          // current loop also fits the new theme: keep it
    if (!changed && cur) return;
    var b = pickBed(theme, cur && cur.bed);
    if (b) startBed(b); else synthFallback(theme);
  }
  function setTheme(theme){
    wantTheme = theme; clearTimeout(dwellT);
    if (!running()) return;
    if (!curTheme){ applyTheme(theme); return; }
    dwellT = setTimeout(function(){ if (wantTheme === theme) applyTheme(theme); }, DWELL);
  }
  // ---------- procedural fallback layers (used when the files can't load) ----------
  function src(buf){ var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(ctx.currentTime, Math.random()*buf.duration*0.9); return s; }
  function filt(type, f, q){ var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function lfo(freq, depth, param){ var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o; }
  function chain(){ for (var i = 0; i < arguments.length-1; i++) arguments[i].connect(arguments[i+1]); }
  function makeLayer(type){
    var g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    var L = {g:g, stop:[], spawn:null, type:type};
    if (type === 'wind'){
      var s = src(brown), bp = filt('bandpass', 420, .6), v = ctx.createGain(); v.gain.value = .9;
      chain(s, bp, v, g); L.stop.push(s, lfo(.06, 220, bp.frequency), lfo(.11, .35, v.gain));
    } else if (type === 'fire'){
      var s2 = src(brown), lp = filt('lowpass', 260), v2 = ctx.createGain(); v2.gain.value = .7;
      chain(s2, lp, v2, g); L.stop.push(s2, lfo(.17, .2, v2.gain));
      L.spawn = function(t){ var n = 1 + (Math.random()*3|0); for (var i = 0; i < n; i++) crackle(g, t + Math.random()*.25); };
    } else if (type === 'rain'){
      var s3 = src(white), hp = filt('highpass', 1100), lp3 = filt('lowpass', 6500), v3 = ctx.createGain(); v3.gain.value = .22;
      chain(s3, hp, lp3, v3, g); L.stop.push(s3, lfo(.09, .05, v3.gain));
    } else if (type === 'sea'){
      var s4 = src(brown), lp4 = filt('lowpass', 520), v4 = ctx.createGain(); v4.gain.value = .55;
      chain(s4, lp4, v4, g); L.stop.push(s4, lfo(.085, .45, v4.gain), lfo(.085, 260, lp4.frequency));
    } else if (type === 'forest'){
      var s5 = src(brown), bp5 = filt('bandpass', 700, .5), v5 = ctx.createGain(); v5.gain.value = .45;
      chain(s5, bp5, v5, g); L.stop.push(s5, lfo(.05, 160, bp5.frequency));
    } else { // drone pad
      [55, 82.4, 110.3].forEach(function(f, i){ var o = ctx.createOscillator(), og = ctx.createGain(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; og.gain.value = [.22, .14, .05][i];
        chain(o, og, g); o.start(); L.stop.push(o, lfo(.03 + i*.02, .9, o.detune)); });
      var s6 = src(brown), lp6 = filt('lowpass', 180), v6 = ctx.createGain(); v6.gain.value = .25; chain(s6, lp6, v6, g); L.stop.push(s6);
    }
    return L;
  }
  function killLayer(L){ var t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(0, t, 1.2);
    setTimeout(function(){ L.stop.forEach(function(n){ try{ n.stop(); }catch(e){} }); try { L.g.disconnect(); } catch(e){} }, 7000); }
  function synthFallback(theme){
    var type = theme ? (SYN[theme] || 'wind') : null;
    if (type === curSyn) return;
    if (curSyn && synth[curSyn]){ killLayer(synth[curSyn]); delete synth[curSyn]; }
    curSyn = type; if (!type) return;
    var L = synth[type] = makeLayer(type); L.g.gain.setTargetAtTime(1, ctx.currentTime, 1.3);
  }
  function setPad(v){
    if (!ctx) return;
    if (!padL && v > 0){ padL = makeLayer('drone'); }
    if (padL) padL.g.gain.setTargetAtTime(v * .9, ctx.currentTime, 2.5);
  }
  function env(g, t, a, peak, dur){ g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t+a); g.gain.exponentialRampToValueAtTime(.0005, t+dur); }
  function crackle(out, t){ var b = ctx.createBufferSource(); b.buffer = white; var hp = filt('highpass', 1800 + Math.random()*2500), g = ctx.createGain();
    env(g, t, .002, .05 + Math.random()*.25, .012 + Math.random()*.03); chain(b, hp, g, out); b.start(t, Math.random()*2); b.stop(t+.08); }
  function applyLevel(){ if (!ctx) return; var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level(), t, .4); }
  function loop(){ if (!running() || document.hidden) return; var L = curSyn && synth[curSyn]; if (L && L.spawn) L.spawn(ctx.currentTime + .05); }
  function preloadSfx(){ // fetch the short event sounds once audio is unlocked (small files)
    Object.keys(SFXV).forEach(function(k, i){ setTimeout(function(){ if (ctx) load('sfx-' + SFXV[k][0]); }, 800 + i*250); });
  }
  var preloaded = false;
  function unlock(){
    if (!st.on || !ensure()) return;
    var go = function(){ disarm(); applyLevel(); if (!preloaded){ preloaded = true; preloadSfx(); } if (wantTheme && !curTheme) applyTheme(wantTheme); };
    if (ctx.state === 'suspended') ctx.resume().then(go, function(){});
    else if (ctx.state === 'running') go();
  }
  var armed = false, EVS = ['pointerdown','keydown','touchstart','touchend','click','wheel','scroll'];
  function arm(){ if (armed) return; armed = true; EVS.forEach(function(e){ window.addEventListener(e, unlock, {capture:true, passive:true}); }); }
  function disarm(){ if (!armed) return; armed = false; EVS.forEach(function(e){ window.removeEventListener(e, unlock, {capture:true, passive:true}); }); }
  function setOn(on){
    st.on = on; save(); ui();
    if (on){ unlock(); if (ctx && ctx.state !== 'running') arm(); if (!spawnT) spawnT = setInterval(loop, 180); if (ctx && ctx.state === 'running' && wantTheme){ curTheme = null; applyTheme(wantTheme); } }
    else { applyLevel(); clearInterval(spawnT); spawnT = 0; clearTimeout(rotT); if (ctx) setTimeout(function(){ if (!st.on && ctx.state === 'running'){ fadeOutCur(); synthFallback(null); curTheme = null; ctx.suspend(); } }, 900); }
  }
  // ---------- one-shot event sounds ----------
  var rr = {};
  function playSfx(kind){
    if (!running()) return;
    var list = SFXV[kind];
    if (!list || !list.length){ chime(kind); return; }
    rr[kind] = ((rr[kind] || 0) + 1) % list.length;
    var id = 'sfx-' + list[rr[kind]], t0 = performance.now();
    load(id, function(buf){
      if (!buf || !running() || performance.now() - t0 > 1500){ if (!buf) chime(kind); return; }   // too late = skip (don't fire long after scrolling past)
      var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = .8; var lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 2600;
      s.connect(lpf); lpf.connect(g); g.connect(sfxBus); s.start(ctx.currentTime + .02);
      // duck the bed a little under the effect
      bedBus.gain.cancelScheduledValues(ctx.currentTime); bedBus.gain.setTargetAtTime(2.0, ctx.currentTime, .3); bedBus.gain.setTargetAtTime(2.2, ctx.currentTime + Math.min(3, buf.duration), .8);
    });
  }
  // atmospheric, non-melodic fallback (no notes/tones): a soft gust of air with a low distant swell.
  // 'magic' gets a slightly brighter airy shimmer-whoosh. Replaces the old sine chime (felt like piano tiles).
  function chime(kind){
    if (!running()) return;
    var t = ctx.currentTime + .03, magic = kind === 'magic', dur = magic ? 2.6 : 3.2;
    var src = ctx.createBufferSource(); src.buffer = magic ? white : brown; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = magic ? 'bandpass' : 'lowpass'; f.Q.value = magic ? 1.2 : .5;
    var f0 = magic ? 900 : 180, f1 = magic ? 3200 : 700;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur*.45); f.frequency.exponentialRampToValueAtTime(f0, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(magic ? .11 : .22, t + dur*.4); g.gain.linearRampToValueAtTime(0, t + dur);
    chain(src, f, g, sfxBus); src.start(t, Math.random()*2); src.stop(t + dur + .05);
    if (!magic){ var o = ctx.createOscillator(), og = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'sine'; o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(41, t + 2.4);
      lp.type = 'lowpass'; lp.frequency.value = 120; og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(.09, t + .6); og.gain.exponentialRampToValueAtTime(.0005, t + 2.8);
      chain(o, lp, og, sfxBus); o.start(t); o.stop(t + 2.9); }
  }
  // targets: {y (px from line top), kind, fired}
  var targets = [], lastY = null, lastFire = 0, fired = [];
  function setTargets(list){ targets = list; lastY = null; }
  function spark(y){
    if (lastY === null){ lastY = y; return; }
    var y0 = lastY; lastY = y; if (Math.abs(y - y0) > 2500) return; // jumps (links, reload, mini-map) don't fire
    var now = performance.now();
    for (var i = 0; i < targets.length; i++){
      var tg = targets[i];
      if (tg.fired){ if (Math.abs(y - tg.y) > 320) tg.fired = false; continue; }
      if ((y0 < tg.y && y >= tg.y) || (y0 > tg.y && y <= tg.y)){
        tg.fired = true;
        if (now - lastFire > 7000 && Math.abs(y - y0) < 140){ lastFire = now; fired.push(tg.kind); if (fired.length > 20) fired.shift(); playSfx(tg.kind); }
      }
    }
  }
  if (ambB) ambB.addEventListener('click', function(){ setOn(!st.on); });
  if (avol) avol.addEventListener('input', function(){ st.vol = +avol.value; if (st.vol > 0 && !st.on){ st.on = true; setOn(true); } save(); ui(); applyLevel(); });
  document.addEventListener('visibilitychange', function(){ if (!ctx) return; if (document.hidden) ctx.suspend(); else if (st.on) ctx.resume(); });
  ui();
  if (AC && st.on){ arm(); spawnT = setInterval(loop, 180); }
  return {onTheme:function(theme){ setTheme(theme); }, setTargets:setTargets, spark:spark, play:function(k){ unlock(); playSfx(k); },
    state:function(){ return {st:st, ctx:ctx && ctx.state, theme:curTheme, want:wantTheme, bed:cur && cur.bed, hist:hist.slice(), synth:curSyn, cached:Object.keys(bufs), failed:Object.keys(failed), targets:targets.length, fired:fired.slice()}; }};
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
  var b = BURST[KIND_OF[e.o]], n = 64;
  if (!b){ var L = (VEC[EV_ELS.indexOf(el)] || VEC[0]).line; b = [Math.round(L[0])+','+Math.round(L[1])+','+Math.round(L[2]), 'gold']; }
  if (b[1] === 'smoke'){ FX.burst(r, b[0], 'smoke', n*0.7); FX.burst(r, '205,205,220', 'spark', n*0.25); }
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
  EV_ELS.forEach(function(el){ if (el.classList.contains('major')){ armedB.set(el, true); io.observe(el.querySelector('.card') ? el : el); } });
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
    var p = self.progress; sparkGeo.p = p;
    gsap.set('#lineFill', {scaleY:p}); gsap.set('#lineSpark', {y: p*tlEl.offsetHeight});
    Ambience.spark(p*sparkGeo.h);
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
// SFX targets: every major event gets a sound matching its content (dragon / battle / magic / death / sea / holy / forge /
// storm / beast; nature + unmatched -> soft chime). Fired when the moving line spark reaches the event's dot.
var SFX_EVS = EV_ELS.map(function(el){ var e = evByO[+el.dataset.o]; if (!e || !e.major) return null;
  var k = KIND_OF[e.o]; if (k === 'nature') k = null;
  return {el:el, kind:k || 'chime'}; }).filter(Boolean);
window.Ambience_targets = function(sy){ if (!lineEl) return;
  Ambience.setTargets(SFX_EVS.map(function(t){ var d = t.el.querySelector('.dot') || t.el, r = d.getBoundingClientRect(); return {y: r.top + sy + r.height/2 - sparkGeo.top - 13, kind:t.kind, fired:false}; })); };
window.Ambience_targets(window.scrollY);
window.__ulv = {Music:Music, Ambience:Ambience, FX:FX, Effects:Effects, Lightbox:Lightbox, TagCard:TagCard, MiniMap:MiniMap, kind:KIND_OF, burstCard:burstCard, theme:THEME_OF, atm:function(){return ATM;}};
})();
