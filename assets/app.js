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
var anchors = [];
function computeAnchors(){
  var sy = window.scrollY;
  anchors = EV_ELS.map(function(el){ var r = el.getBoundingClientRect(); return r.top + sy + Math.min(r.height, 400)/2; });
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
  var scale = MOBILE ? 0.5 : 1;
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
    dpr = Math.min(window.devicePixelRatio||1, MOBILE?1.25:1.5);
    W = cv.width = Math.round(innerWidth*dpr); H = cv.height = Math.round(innerHeight*dpr);
  }
  function ensure(k){
    var n = Math.round(MAX[k]*scale), pool = pools[k];
    while (pool.length < n){ var p = {}; spawn(k, p, true); pool.push(p); }
  }
  var running = !reduce, lastT = 0;
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
    document.addEventListener('visibilitychange', function(){ running = !document.hidden; lastT = 0; if (running) requestAnimationFrame(frame); });
  }
  return { setTargets:setTargets, emitSparks:emitSparks, dpr:function(){return dpr;}, active:function(){ var o={}; PTYPES.forEach(function(k){ if (weight[k]>0.02) o[k]=+weight[k].toFixed(2); }); return o; } };
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
      var r = sparkEl.getBoundingClientRect();
      var cy = r.top + r.height/2;
      if (cy > 0 && cy < innerHeight && r.height){
        var d = FX.dpr(), L = ATM.line;
        FX.emitSparks(n, dy>0?1:-1, (r.left + r.width/2)*d, cy*d, Math.round(L[0])+','+Math.round(L[1])+','+Math.round(L[2]));
      }
    }
  }
}
if (reduce) window.addEventListener('scroll', function(){ requestAnimationFrame(tick); }, {passive:true});

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
// MUSIC (YouTube IFrame API, one hidden player, fixed looping playlist)
// config: assets/music.js — tracks play 1..N then wrap to 1, forever.
// Era/scroll does NOT change the music (era colours are handled elsewhere).
// =====================================================================
var Music = (function(){
  var KEY = 'ulv-music', st = {on:false, vol:(MU.volume!=null?MU.volume:35), muted:false, idx:0};
  try { var sv = JSON.parse(localStorage.getItem(KEY)||'null'); if (sv) { st.on = !!sv.on; st.vol = sv.vol!=null ? (+sv.vol||0) : st.vol; st.muted = !!sv.muted; st.idx = +sv.idx||0; } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }
  var btn = mpEl.querySelector('.mp-btn'), playB = mpEl.querySelector('.mp-play'), prevB = mpEl.querySelector('.mp-prev'), nextB = mpEl.querySelector('.mp-next'),
      muteB = mpEl.querySelector('.mp-mute'), vol = mpEl.querySelector('.mp-vol'), now = mpEl.querySelector('.mp-now');

  function parse(u){
    if (!u || typeof u !== 'string') return null; u = u.trim(); if (!u) return null;
    if (/^[\w-]{11}$/.test(u)) return u;
    var id = null, m;
    try {
      var url = new URL(u, location.href), h = url.hostname.replace(/^www\.|^m\.|^music\./,'');
      if (h === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
      else if (/youtube(-nocookie)?\.com$/.test(h)){
        id = url.searchParams.get('v');
        if (!id && (m = url.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{6,})/))) id = m[2];
      }
    } catch(e){}
    return (id && /^[\w-]{6,}$/.test(id)) ? id : null;
  }
  var tracks = (MU.playlist||[]).map(function(t){ t = typeof t === 'string' ? {url:t} : (t||{}); var ids = [t.url].concat(t.alt||[]).map(parse).filter(Boolean); return {ids:ids, id:ids[0], name:t.name||''}; })
                                .filter(function(t){ return t.id; });
  var N = tracks.length;
  if (!(st.idx >= 0 && st.idx < N)) st.idx = 0;
  var player = null, ready = false, apiState = 0, apiQ = [], fadeT = 0, isPlaying = false, loadedIdx = -1, altI = 0, errStreak = 0, lastErr = null, skipT = 0, titles = {};

  function title(i){ return titles[tracks[i].id] || tracks[i].name || 'Parça'; }
  function ui(){
    mpEl.classList.toggle('playing', st.on && isPlaying);
    mpEl.classList.toggle('on', st.on);
    playB.setAttribute('aria-label', st.on ? 'Durdur' : 'Çal'); playB.classList.toggle('is-on', st.on);
    muteB.classList.toggle('is-muted', st.muted || st.vol === 0); muteB.setAttribute('aria-label', st.muted ? 'Sesi aç' : 'Sesi kapat');
    vol.value = st.vol; vol.style.setProperty('--v', st.vol+'%');
    var txt;
    if (!N) txt = 'Henüz müzik eklenmedi';
    else if (st.on && errStreak >= N) txt = 'Parçalar oynatılamadı';
    else if (st.on && lastErr != null && !isPlaying) txt = (st.idx+1)+'/'+N+' · oynatılamadı, geçiliyor…';
    else txt = (st.idx+1)+'/'+N+' · '+title(st.idx);
    now.textContent = txt; now.title = N ? (st.idx+1)+'/'+N+' — '+title(st.idx) : '';
  }
  function loadApi(cb){
    if (window.YT && window.YT.Player) return cb();
    apiQ.push(cb); if (apiState) return; apiState = 1;
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function(){ if (prev) try{prev();}catch(e){} apiState = 2; var q = apiQ; apiQ = []; q.forEach(function(f){ f(); }); };
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = function(){ apiState = 0; apiQ = []; now.textContent = 'YouTube yüklenemedi'; };
    document.head.appendChild(s);
  }
  var readyQ = [];
  function ensurePlayer(cb){
    if (ready) return cb && cb();
    if (cb) readyQ.push(cb);
    if (player) return;
    loadApi(function(){
      if (player) return;
      var d = document.createElement('div'); d.id = 'mpP0'; document.getElementById('mpHost').appendChild(d);
      player = new YT.Player(d.id, { width:200, height:200, host:(MU.host||'https://www.youtube.com'),
        playerVars:{autoplay:0, controls:0, disablekb:1, playsinline:1, rel:0, iv_load_policy:3, fs:0, origin:location.origin},
        events:{
          onReady:function(){ ready = true; try { player.setVolume(0); } catch(e){} var q = readyQ; readyQ = []; q.forEach(function(f){ f(); }); },
          onStateChange:function(ev){
            var S = YT.PlayerState;
            if (ev.data === S.ENDED){ if (st.on) go(st.idx+1, true); return; }
            isPlaying = ev.data === S.PLAYING || ev.data === S.BUFFERING;
            if (ev.data === S.PLAYING){
              errStreak = 0; lastErr = null;
              try { var vd = player.getVideoData(); if (vd && vd.title && vd.video_id === tracks[st.idx].ids[altI]) titles[tracks[st.idx].id] = vd.title; } catch(e){}
              if (!st.on){ try { player.pauseVideo(); } catch(e){} }
            }
            ui();
          },
          onError:function(ev){
            lastErr = ev.data; isPlaying = false; clearTimeout(skipT);
            // same song, other upload (e.g. label "Topic" tracks that refuse embedding: 101/150)
            if (st.on && altI + 1 < tracks[st.idx].ids.length){ altI++; try { player.loadVideoById({videoId:tracks[st.idx].ids[altI], startSeconds:0}); } catch(e){} return; }
            errStreak++; ui();
            if (st.on && errStreak < N) skipT = setTimeout(function(){ go(st.idx+1, true); }, 900);
          }
        }});
    });
  }
  function fadeTo(to, ms, done){
    clearInterval(fadeT); if (!player || !player.getVolume){ done && done(); return; }
    var from = player.getVolume() || 0, t0 = performance.now();
    fadeT = setInterval(function(){
      var k = Math.min(1, (performance.now()-t0)/ms), v = from + (to-from)*smooth(k);
      try{ player.setVolume(v); }catch(e){}
      if (k >= 1){ clearInterval(fadeT); done && done(); }
    }, 50);
  }
  function applyMute(){ try { if (st.muted) player.mute(); else player.unMute(); } catch(e){} }
  // load + play track i (wraps); fade=false keeps current volume (track-to-track)
  function go(i, keepVol){
    if (!N) return;
    st.idx = ((i % N) + N) % N; save(); lastErr = null; ui();
    if (!st.on) { loadedIdx = -1; return; }
    ensurePlayer(function(){
      if (!st.on) return;
      applyMute();
      if (!keepVol){ try { player.setVolume(0); } catch(e){} }
      altI = 0; try { player.loadVideoById({videoId:tracks[st.idx].id, startSeconds:0}); } catch(e){}
      loadedIdx = st.idx;
      if (keepVol){ clearInterval(fadeT); try { player.setVolume(st.vol); } catch(e){} } else fadeTo(st.vol, MU.fadeMs||1200);
    });
  }
  function start(){
    if (!N) return;
    ensurePlayer(function(){
      if (!st.on) return;
      if (loadedIdx === st.idx && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PAUSED){
        applyMute(); try { player.setVolume(0); player.playVideo(); } catch(e){} fadeTo(st.vol, MU.fadeMs||1200);
      } else go(st.idx, false);
    });
  }
  function stop(){
    clearTimeout(skipT);
    if (player && ready) fadeTo(0, 700, function(){ try{ player.pauseVideo(); }catch(e){} });
    isPlaying = false; ui();
  }
  function setOn(on){
    st.on = on; save(); errStreak = 0;
    if (on) start(); else stop();
    ui();
  }
  function setOpen(o){ mpEl.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); document.body.classList.toggle('mp-open', o); }
  function step(d){ errStreak = 0; clearTimeout(skipT); if (st.on) go(st.idx+d, true); else { st.idx = ((st.idx+d) % N + N) % N; save(); loadedIdx = -1; ui(); } }
  // warm up the API/player when the user heads for the player, so the actual click can start playback inside the gesture
  var warm = function(){ if (N) ensurePlayer(); };
  btn.addEventListener('pointerenter', warm); btn.addEventListener('focus', warm);
  btn.addEventListener('click', function(){ warm(); setOpen(!mpEl.classList.contains('open')); });
  playB.addEventListener('click', function(){ setOn(!st.on); });
  if (prevB) prevB.addEventListener('click', function(){ step(-1); });
  if (nextB) nextB.addEventListener('click', function(){ step(1); });
  muteB.addEventListener('click', function(){ st.muted = !st.muted; if (!st.muted && st.vol === 0) st.vol = 30; save(); if (player && ready){ applyMute(); if (!st.muted) player.setVolume(st.vol); } ui(); });
  vol.addEventListener('input', function(){ st.vol = +vol.value; st.muted = st.vol === 0; save(); if (player && ready){ clearInterval(fadeT); player.setVolume(st.vol); applyMute(); } ui(); });
  document.addEventListener('click', function(ev){ if (!mpEl.contains(ev.target) && mpEl.classList.contains('open')) setOpen(false); });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && mpEl.classList.contains('open')) { setOpen(false); btn.focus(); } });
  // browsers block autoplay with sound: if music was on last visit, resume on the first real interaction
  if (st.on && N){
    var resume = function(){ document.removeEventListener('pointerdown', resume, true); document.removeEventListener('keydown', resume, true); if (st.on && !isPlaying) start(); };
    document.addEventListener('pointerdown', resume, true); document.addEventListener('keydown', resume, true);
    ensurePlayer(); // preload so the first interaction can start immediately
  }
  if (!N) mpEl.classList.add('empty');
  ui();
  return {onEvent:function(){ /* music no longer follows eras */ }, parse:parse, next:function(){ step(1); }, prev:function(){ step(-1); },
    state:function(){ var ps = null; try { ps = player && player.getPlayerState ? {s:player.getPlayerState(), v:Math.round(player.getVolume()), t:Math.round(player.getCurrentTime()), id:(player.getVideoData()||{}).video_id, alt:altI} : null; } catch(e){} return {st:st, idx:st.idx, n:N, title:N?title(st.idx):null, playing:isPlaying, player:ps, err:lastErr, errStreak:errStreak}; }};
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
    var p = self.progress;
    gsap.set('#lineFill', {scaleY:p}); gsap.set('#lineSpark', {y: p*tlEl.offsetHeight});
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
        gsap.to(wrap, {rotateY: px*8, rotateX: -py*6, duration:.4, ease:'power2.out'}); });
      wrap.addEventListener('mouseleave', function(){ gsap.to(wrap, {rotateY:0, rotateX:0, duration:.6}); });
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
window.__ulv = {Music:Music, FX:FX, Lightbox:Lightbox, theme:THEME_OF, atm:function(){return ATM;}};
})();
