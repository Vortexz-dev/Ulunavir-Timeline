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
    ctx.globalCompositeOperation = 'source-over';
    tick();
    requestAnimationFrame(frame);
  }
  resize(); addEventListener('resize', resize);
  if (!reduce){
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function(){ running = !document.hidden; lastT = 0; lastDraw = 0; probe.t0 = 0; probe.slow = 0; if (running) requestAnimationFrame(frame); });
  }
  return { setTargets:setTargets, emitSparks:emitSparks, setLite:setLite, lite:function(){return lite;}, onFps:function(cb){ probe.cb = cb; probe.t0 = 0; probe.slow = 0; }, dpr:function(){return dpr;}, active:function(){ var o={}; PTYPES.forEach(function(k){ if (weight[k]>0.02) o[k]=+weight[k].toFixed(2); }); return o; } };
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
    else if (st.on && blocked && !isPlaying) txt = (st.idx+1)+'/'+N+' · '+title(st.idx)+' — başlatmak için sayfaya dokun';
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
  var armed = false, EVS = ['pointerdown','keydown','touchstart','touchend','click','wheel','scroll'];
  function onGesture(){ if (!st.on || isPlaying){ disarm(); return; } if (!pending) play(true); }
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
  if (st.on && N) play(true); // try autoplay right away; falls back to first gesture
  return {onEvent:function(){ /* music does not follow eras; ambience does */ }, next:function(){ step(1); }, prev:function(){ step(-1); },
    state:function(){ return {st:st, idx:st.idx, n:N, title:N?title(st.idx):null, playing:isPlaying, blocked:blocked, t:Math.round(au.currentTime||0), vol:Math.round(au.volume*100), src:au.currentSrc, errStreak:errStreak}; }};
})();

// =====================================================================
// AMBIENCE (procedural WebAudio, no audio files): one quiet loop per era
// theme family (wind / fire / rain / sea / forest / drone), crossfaded on
// era change, plus light one-shot SFX (war horn / anvil) when the moving
// timeline spark reaches a major battle / dwarf-forge event. Own on/off +
// volume (saved in localStorage 'ulv-amb'); off = silent, SFX included.
// =====================================================================
var Ambience = (function(){
  var KEY = 'ulv-amb', cfg = MU.ambience || {}, st = {on: cfg.on !== false, vol: cfg.volume != null ? cfg.volume : 30};
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv){ st.on = sv.on !== false; if (sv.vol != null) st.vol = +sv.vol||0; } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  var ambB = mpEl.querySelector('.mp-amb'), avol = mpEl.querySelector('.mp-avol');
  var AC = window.AudioContext || window.webkitAudioContext;
  var TYPE = {ice:'wind', snowcity:'wind', sky:'wind', ancient:'wind', calm:'wind', memory:'wind', grief:'wind', night:'wind', death:'wind', sand:'wind', modern:'wind',
              fire:'fire', war:'fire', forge:'fire', industrial:'fire', blood:'fire',
              rain:'rain', sea:'sea',
              elven:'forest', light:'forest', festival:'forest', witch:'forest', crown:'forest',
              occult:'drone', girift:'drone', sterile:'drone', timestop:'drone', quake:'drone'};
  var ctx = null, master = null, sfxBus = null, white = null, brown = null, layers = {}, curType = null, wantType = null, spawnT = 0;
  function ui(){
    if (ambB){ ambB.classList.toggle('is-off', !st.on); ambB.setAttribute('aria-pressed', st.on ? 'true' : 'false'); }
    if (avol){ avol.value = st.vol; avol.style.setProperty('--v', st.vol+'%'); }
  }
  function level(){ return st.on ? Math.pow(st.vol/100, 1.5) * 0.5 : 0; }
  function noiseBuf(kind, sec){
    var n = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++){ var w = Math.random()*2-1; if (kind === 'brown'){ last = (last + 0.02*w)/1.02; d[i] = last*3.5; } else d[i] = w; }
    // crossfade the loop seam so it never clicks
    var f = Math.min(2048, n>>3); for (var j = 0; j < f; j++){ var k = j/f; d[n-f+j] = d[n-f+j]*(1-k) + d[j]*k; }
    return b;
  }
  function ensure(){
    if (ctx || !AC) return ctx;
    try { ctx = new AC(); } catch(e){ return null; }
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.6; sfxBus.connect(master);
    white = noiseBuf('white', 3); brown = noiseBuf('brown', 6);
    return ctx;
  }
  function src(buf){ var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0; s.start(ctx.currentTime, Math.random()*buf.duration*0.9); return s; }
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
      L.spawn = function(t){ if (Math.random() < .5) drip(g, t + Math.random()*.2); };
    } else if (type === 'sea'){
      var s4 = src(brown), lp4 = filt('lowpass', 520), v4 = ctx.createGain(); v4.gain.value = .55;
      chain(s4, lp4, v4, g); L.stop.push(s4, lfo(.085, .45, v4.gain), lfo(.085, 260, lp4.frequency));
    } else if (type === 'forest'){
      var s5 = src(brown), bp5 = filt('bandpass', 700, .5), v5 = ctx.createGain(); v5.gain.value = .45;
      chain(s5, bp5, v5, g); L.stop.push(s5, lfo(.05, 160, bp5.frequency));
      L.spawn = function(t){ if (Math.random() < .045) chirp(g, t); };
    } else { // drone
      [55, 82.4, 110.3].forEach(function(f, i){ var o = ctx.createOscillator(), og = ctx.createGain(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; og.gain.value = [.22, .14, .05][i];
        chain(o, og, g); o.start(); L.stop.push(o, lfo(.03 + i*.02, .9, o.detune)); });
      var s6 = src(brown), lp6 = filt('lowpass', 180), v6 = ctx.createGain(); v6.gain.value = .25; chain(s6, lp6, v6, g); L.stop.push(s6);
    }
    return L;
  }
  function env(g, t, a, peak, dur){ g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t+a); g.gain.exponentialRampToValueAtTime(.0005, t+dur); }
  function crackle(out, t){ var b = ctx.createBufferSource(); b.buffer = white; var hp = filt('highpass', 1800 + Math.random()*2500), g = ctx.createGain();
    env(g, t, .002, .05 + Math.random()*.25, .012 + Math.random()*.03); chain(b, hp, g, out); b.start(t, Math.random()*2); b.stop(t+.08); }
  function drip(out, t){ var o = ctx.createOscillator(), g = ctx.createGain(), f = 1400 + Math.random()*2200; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f*1.6, t+.04);
    env(g, t, .002, .04 + Math.random()*.05, .06); chain(o, g, out); o.start(t); o.stop(t+.08); }
  function chirp(out, t){ var reps = 2 + (Math.random()*3|0), base = 2600 + Math.random()*1400;
    for (var i = 0; i < reps; i++){ var o = ctx.createOscillator(), g = ctx.createGain(), s = t + i*.13; o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base*1.45, s+.07);
      env(g, s, .01, .05, .1); chain(o, g, out); o.start(s); o.stop(s+.12); } }
  function setType(type){
    wantType = type;
    if (!ctx || ctx.state !== 'running' || !st.on || type === curType) return;
    var t = ctx.currentTime, old = curType && layers[curType];
    if (old){ old.g.gain.cancelScheduledValues(t); old.g.gain.setTargetAtTime(0, t, 1.0); var oo = old, ot = curType;
      setTimeout(function(){ if (curType !== ot && layers[ot] === oo){ oo.stop.forEach(function(n){ try{ n.stop(); }catch(e){} }); try { oo.g.disconnect(); } catch(e){} delete layers[ot]; } }, 7000); }
    curType = type; if (!type) return;
    var L = layers[type] || (layers[type] = makeLayer(type));
    L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(1, t, 1.3);
  }
  function applyLevel(){ if (!ctx) return; var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level(), t, .4); }
  function loop(){ // sparse one-shot texture (crackles / drips / chirps) for the active layer only
    if (!ctx || ctx.state !== 'running' || !st.on || document.hidden) return;
    var L = curType && layers[curType]; if (L && L.spawn) L.spawn(ctx.currentTime + .05);
  }
  function unlock(){
    if (!st.on || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().then(function(){ disarm(); applyLevel(); var w = wantType; curType = null; setType(w); }, function(){});
    else if (ctx.state === 'running'){ disarm(); applyLevel(); if (wantType !== curType){ var w2 = wantType; setType(w2); } }
  }
  var armed = false, EVS = ['pointerdown','keydown','touchend','click'];
  function arm(){ if (armed) return; armed = true; EVS.forEach(function(e){ window.addEventListener(e, unlock, {capture:true, passive:true}); }); }
  function disarm(){ if (!armed) return; armed = false; EVS.forEach(function(e){ window.removeEventListener(e, unlock, {capture:true, passive:true}); }); }
  function setOn(on){
    st.on = on; save(); ui();
    if (on){ unlock(); if (ctx && ctx.state !== 'running') arm(); if (!spawnT) spawnT = setInterval(loop, 180); }
    else { applyLevel(); clearInterval(spawnT); spawnT = 0; if (ctx) setTimeout(function(){ if (!st.on && ctx.state === 'running') ctx.suspend(); }, 900); }
  }
  // ---- one-shot SFX ----
  function horn(){
    if (!ctx || ctx.state !== 'running' || !st.on) return;
    var t = ctx.currentTime + .03, lp = filt('lowpass', 300, 2), g = ctx.createGain(); chain(lp, g, sfxBus);
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(1300, t+.45); lp.frequency.linearRampToValueAtTime(700, t+1.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t+.4); g.gain.setValueAtTime(.16, t+1.2); g.gain.exponentialRampToValueAtTime(.0005, t+2.2);
    [[98, 0], [98.7, 0], [147, .55]].forEach(function(p){ var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(p[0]*.94, t); o.frequency.linearRampToValueAtTime(p[0], t+.25);
      og.gain.value = p[1] ? .35 : .5; chain(o, og, lp); o.start(t); o.stop(t+2.3); });
  }
  function anvil(){
    if (!ctx || ctx.state !== 'running' || !st.on) return;
    var t = ctx.currentTime + .03, f0 = 610;
    [[1, .2, 1.4], [2.76, .12, .9], [5.4, .07, .6], [8.93, .04, .35]].forEach(function(p){ var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f0*p[0];
      env(g, t, .002, p[1], p[2]); chain(o, g, sfxBus); o.start(t); o.stop(t+p[2]+.05); });
    var b = ctx.createBufferSource(); b.buffer = white; var hp = filt('highpass', 3000), g2 = ctx.createGain(); env(g2, t, .001, .25, .03); chain(b, hp, g2, sfxBus); b.start(t); b.stop(t+.05);
  }
  // targets: {y (px from line top), kind, fired}
  var targets = [], lastY = null, lastFire = 0, fired = [];
  function setTargets(list){ targets = list; lastY = null; }
  function spark(y){
    if (lastY === null){ lastY = y; return; }
    var y0 = lastY; lastY = y; if (Math.abs(y - y0) > 2500) return; // jumps (links, reload) don't fire
    var now = performance.now();
    for (var i = 0; i < targets.length; i++){
      var tg = targets[i];
      if (tg.fired){ if (Math.abs(y - tg.y) > 320) tg.fired = false; continue; }
      if ((y0 < tg.y && y >= tg.y) || (y0 > tg.y && y <= tg.y)){
        tg.fired = true;
        if (now - lastFire > 1200){ lastFire = now; fired.push(tg.kind); if (fired.length > 20) fired.shift(); if (tg.kind === 'horn') horn(); else anvil(); }
      }
    }
  }
  if (ambB) ambB.addEventListener('click', function(ev){ setOn(!st.on); });
  if (avol) avol.addEventListener('input', function(){ st.vol = +avol.value; if (st.vol > 0 && !st.on){ st.on = true; setOn(true); } save(); ui(); applyLevel(); });
  document.addEventListener('visibilitychange', function(){ if (!ctx) return; if (document.hidden) ctx.suspend(); else if (st.on) ctx.resume(); });
  ui();
  if (AC && st.on){ arm(); spawnT = setInterval(loop, 180); }
  return {onTheme:function(theme){ setType(TYPE[theme] || 'wind'); }, setTargets:setTargets, spark:spark, horn:function(){ unlock(); horn(); }, anvil:function(){ unlock(); anvil(); },
    state:function(){ return {st:st, ctx:ctx && ctx.state, type:curType, want:wantType, layers:Object.keys(layers), targets:targets.length, fired:fired.slice()}; }};
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
// SFX targets: major battles -> war horn, dwarf / forge events -> anvil (dot centre, px from line top)
var SFX_EVS = EV_ELS.map(function(el){ var e = evByO[+el.dataset.o]; if (!e || !e.major) return null;
  var k = /Savaş/.test(e.title) ? 'horn' : (/[Cc]üce|Crownforge|demirci|Forge/.test(e.title) ? 'anvil' : null);
  return k ? {el:el, kind:k} : null; }).filter(Boolean);
window.Ambience_targets = function(sy){ if (!lineEl) return;
  Ambience.setTargets(SFX_EVS.map(function(t){ var d = t.el.querySelector('.dot') || t.el, r = d.getBoundingClientRect(); return {y: r.top + sy + r.height/2 - sparkGeo.top - 13, kind:t.kind, fired:false}; })); };
window.Ambience_targets(window.scrollY);
window.__ulv = {Music:Music, Ambience:Ambience, FX:FX, Effects:Effects, Lightbox:Lightbox, theme:THEME_OF, atm:function(){return ATM;}};
})();
