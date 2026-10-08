(function(){
'use strict';
var D = window.TIMELINE;
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var mqMobile = window.matchMedia('(max-width: 860px)');
var itemsEl = document.getElementById('items');
var ERA_COLORS = {
  julius:['#ff7a3c','#b07bff'], elfadasi:['#ff9a3c','#7bd3ff'], tahliye:['#ffa54a','#6fd0c4'], dusus:['#ff5a2a','#ff9a3c'],
  ts2:['#ff8a3c','#9f7bff'], ts1:['#ff9a4a','#8f8bff'], cilt1:['#ffb050','#9f7bff'], donus:['#ffc060','#c08bff'],
  koken:['#e0a050','#a07050'], imparatorluk:['#e2b45a','#b06a3a'], gunes:['#f0c060','#d08a3a'], kurtulus:['#d8b070','#a07850'],
  kanunsuz:['#c9a46a','#8a6a4a'], kadim:['#c7a36a','#7a5a3a']
};

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

var NONAGON = '<svg viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="#ffd88a" stroke-width="2"><circle cx="100" cy="100" r="92" stroke-opacity=".6"/><circle cx="100" cy="100" r="84" stroke-dasharray="2 6"/><polygon points="100,18 152,37 181,85 172,140 133,178 67,178 28,140 19,85 48,37"/><polygon points="100,48 145,126 55,126" stroke-opacity=".7"/><polygon points="100,152 55,74 145,74" stroke-opacity=".7"/><circle cx="100" cy="100" r="16" fill="#ffd88a22"/></g></svg>';

function cardHTML(e){
  var media = '';
  if (e.major){
    if (e.img){
      media = '<div class="media"><img class="'+e.img.kind+'" src="'+esc(e.img.src)+'" width="'+e.img.w+'" height="'+e.img.h+'" loading="lazy" decoding="async" alt="'+esc(e.title)+'"><div class="aging"></div></div>';
    } else {
      media = '<div class="media"><div class="emblem">'+NONAGON+'<div class="em-y">'+esc(e.num?e.big:'✦')+'</div></div><div class="aging"></div></div>';
    }
  }
  var chips = '';
  e.chars.slice(0,6).forEach(function(c){chips+='<li class="c">'+esc(c)+'</li>';});
  e.places.slice(0,4).forEach(function(c){chips+='<li class="p">'+esc(c)+'</li>';});
  e.factions.slice(0,4).forEach(function(c){chips+='<li class="f">'+esc(c)+'</li>';});
  var full = (e.date !== e.big) ? '<span class="full">'+esc(e.date)+'</span>' : '';
  return '<div class="card-wrap"><div class="card">'+media+
    '<div class="body">'+
      '<div class="date"><span class="big'+(e.num?'':' txt')+'">'+esc(e.big)+'</span>'+full+(e.unc?'<span class="unc" title="Tarihi belirsiz">≈ belirsiz</span>':'')+'</div>'+
      '<h3>'+esc(e.title)+'</h3>'+
      '<p class="desc">'+esc(e.desc)+'</p>'+
      (e.cons?'<p class="cons"><b>Sonuç</b>'+esc(e.cons)+'</p>':'')+
      (chips?'<ul class="chips">'+chips+'</ul>':'')+
      (e.note?'<p class="note">Tarih notu: '+esc(e.note)+'</p>':'')+
      (e.src.length?'<div class="src">Kaynak: '+esc(e.src.join(' · '))+'</div>':'')+
    '</div></div></div>';
}

// ---------- render (newest first) ----------
var events = D.events.slice().sort(function(a,b){return b.o-a.o;});
var eraById = {}; D.eras.forEach(function(r){eraById[r.id]=r;});
var html = '', lastEra = null, side = 0, eraIdx = 0;
var ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];
events.forEach(function(e){
  if (e.era !== lastEra){
    var r = eraById[e.era]; eraIdx++;
    html += '<section class="era" data-era="'+e.era+'"><div class="era-inner"><div class="era-k">Çağ '+ROMAN[eraIdx-1]+'</div><div class="era-n">'+esc(r.name)+'</div><div class="era-s">'+esc(r.sub)+'</div></div></section>';
    lastEra = e.era;
  }
  var s = (side++ % 2 === 0) ? 'left' : 'right';
  html += '<article class="ev '+(e.major?'major':'minor')+' '+s+' tier-'+e.tier+'" data-o="'+e.o+'" data-era="'+e.era+'" data-year="'+esc(e.big)+'">'+
    '<div class="arm"></div><div class="node"><span class="dot"></span>'+(e.num?'<span class="pill">'+esc(e.big)+'</span>':'')+'</div>'+cardHTML(e)+'</article>';
});
itemsEl.innerHTML = html;
document.getElementById('heroSub').textContent = D.count+' olay, en yeniden en eskiye — aşağı kaydırdıkça zamanda geriye inersin.';

// ---------- masonry-like layout around the center line (desktop) ----------
function layout(){
  if (mqMobile.matches){ itemsEl.style.height=''; return; }
  var y = {left:0,right:0}, lastTop = -1e9, MIN_STEP = 96, GAP = 44;
  var kids = itemsEl.children;
  for (var i=0;i<kids.length;i++){
    var el = kids[i], h = el.offsetHeight, top;
    if (el.classList.contains('era')){
      top = Math.max(y.left, y.right) + 30;
      el.style.top = top+'px';
      y.left = y.right = top + h + 60; lastTop = top + h;
    } else {
      var s = el.classList.contains('left')?'left':'right';
      top = Math.max(y[s], lastTop + MIN_STEP);
      el.style.top = top+'px';
      y[s] = top + h + GAP; lastTop = top;
    }
  }
  itemsEl.style.height = Math.max(y.left,y.right)+'px';
}

// ---------- HUD ----------
var hud = document.getElementById('hud'), hudEra = document.getElementById('hudEra'), hudYear = document.getElementById('hudYear'), hudBar = document.getElementById('hudBar');
function setCurrent(el){
  var r = eraById[el.dataset.era];
  hudEra.textContent = r ? r.name : '';
  hudYear.textContent = el.dataset.year;
  var c = ERA_COLORS[el.dataset.era] || ERA_COLORS.julius;
  document.documentElement.style.setProperty('--accent', c[0]);
  document.documentElement.style.setProperty('--accent2', c[1]);
  Particles.setEra(el.dataset.era);
}

// ---------- particles ----------
var Particles = (function(){
  var cv = document.getElementById('particles'), ctx = cv.getContext('2d'), W, H, dpr, P = [], mode = 'ember', running = !reduce;
  function resize(){ dpr = Math.min(window.devicePixelRatio||1,1.5); W = cv.width = innerWidth*dpr; H = cv.height = innerHeight*dpr; }
  function spawn(p, init){
    p.x = Math.random()*W; p.y = init? Math.random()*H : (mode==='ember'? H+10 : Math.random()*H);
    p.r = (mode==='ember'? (0.6+Math.random()*1.8) : (0.5+Math.random()*1.4))*dpr;
    p.vx = (Math.random()-.5)*0.25*dpr; p.vy = mode==='ember'? -(0.25+Math.random()*0.7)*dpr : (Math.random()-.5)*0.12*dpr;
    p.life = 0; p.max = 300+Math.random()*500; p.tw = Math.random()*6.28;
  }
  function init(){ resize(); P=[]; var n = innerWidth<860? 40 : 85; for (var i=0;i<n;i++){var p={}; spawn(p,true); P.push(p);} }
  var colors = {ember:['255,150,70','255,200,120','255,110,50'], dust:['240,215,160','255,235,190','210,180,130']};
  function frame(){
    if (!running) return;
    ctx.clearRect(0,0,W,H);
    var cs = colors[mode==='ember'?'ember':'dust'];
    for (var i=0;i<P.length;i++){
      var p = P[i]; p.life++; p.tw += 0.05;
      p.x += p.vx + Math.sin(p.tw*0.5)*0.15*dpr; p.y += p.vy;
      var a = Math.min(1, p.life/60) * Math.max(0, 1 - p.life/p.max) * (0.55+0.45*Math.sin(p.tw));
      if (p.life > p.max || p.y < -20 || p.x<-20 || p.x>W+20) spawn(p,false);
      ctx.beginPath(); ctx.fillStyle = 'rgba('+cs[i%3]+','+(a*0.85).toFixed(3)+')';
      ctx.shadowBlur = mode==='ember'? 8*dpr : 3*dpr; ctx.shadowColor = 'rgba('+cs[i%3]+',0.9)';
      ctx.arc(p.x,p.y,p.r,0,6.283); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  if (!reduce){ init(); addEventListener('resize', resize); requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', function(){ running = !document.hidden; if (running) requestAnimationFrame(frame); }); }
  return { setEra: function(era){ var m = (['imparatorluk','gunes','kurtulus','kanunsuz','kadim','koken'].indexOf(era)>=0)? 'dust':'ember'; if (m!==mode){ mode = m; } } };
})();

// ---------- animations ----------
function buildAnimations(){
  var mobile = mqMobile.matches;
  gsap.registerPlugin(ScrollTrigger);

  // hero parallax out
  gsap.to('.hero-inner', {yPercent:40, opacity:0, scale:.92, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  gsap.to('.hero-ring', {scale:1.35, opacity:0, rotate:40, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  // background parallax
  gsap.to('.bg-far', {yPercent:-14, ease:'none', scrollTrigger:{start:0, end:'max', scrub:true}});
  gsap.to('.bg-fog', {yPercent:-30, xPercent:4, ease:'none', scrollTrigger:{start:0, end:'max', scrub:true}});
  // glowing line fill + spark + HUD progress
  var tlEl = document.getElementById('timeline');
  ScrollTrigger.create({trigger:tlEl, start:'top 60%', end:'bottom 60%', scrub:true, onUpdate:function(self){
    var p = self.progress;
    gsap.set('#lineFill', {scaleY:p}); gsap.set('#lineSpark', {y: p*tlEl.offsetHeight});
    hudBar.style.width = (p*100).toFixed(1)+'%';
  }});
  ScrollTrigger.create({trigger:tlEl, start:'top 70%', end:'bottom 30%', onToggle:function(self){ hud.classList.toggle('on', self.isActive); }});

  // era banners
  gsap.utils.toArray('.era').forEach(function(el){
    gsap.fromTo(el.querySelector('.era-inner'), {scale:.2, opacity:0, rotateX:-70, filter:'blur(6px)'},
      {scale:1, opacity:1, rotateX:0, filter:'blur(0px)', ease:'power2.out', scrollTrigger:{trigger:el, start:'top 95%', end:'top 65%', scrub:.6}});
  });

  // events: unfold out of the line, fold back when scrolling up (scrub => fully reversible)
  gsap.utils.toArray('.ev').forEach(function(el){
    var left = el.classList.contains('left') && !mobile;
    var dir = left ? 1 : -1;             // +1: line is to the right of the card
    var card = el.querySelector('.card'), arm = el.querySelector('.arm'), dot = el.querySelector('.dot'),
        pill = el.querySelector('.pill'), media = el.querySelector('.media'), img = el.querySelector('.media img'),
        bits = el.querySelectorAll('.date, h3, .desc, .cons, .chips, .note, .src');
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
      if (img) tl.fromTo(img, {scale:1.35}, {scale:1, duration:.55, ease:'power2.out'}, .35);
    }
    tl.fromTo(bits, {opacity:0, x: dir*30}, {opacity:1, x:0, stagger:.04, duration:.3, ease:'power1.out'}, .38);
    // subtle inner parallax of the image while it travels through the viewport
    if (img) gsap.fromTo(img, {yPercent:-6}, {yPercent:6, ease:'none', scrollTrigger:{trigger:el, start:'top bottom', end:'bottom top', scrub:true}});
    // gentle 3D tilt on hover (desktop)
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
  var evs = document.querySelectorAll('.ev'); var io = new IntersectionObserver(function(ents){ ents.forEach(function(en){ if (en.isIntersecting) setCurrent(en.target); }); }, {rootMargin:'-45% 0px -45% 0px'});
  evs.forEach(function(el){ io.observe(el); });
}

function start(){
  layout();
  if (reduce || !window.gsap || !window.ScrollTrigger){ showAllStatic(); return; }
  buildAnimations();
  ScrollTrigger.refresh();
}
var relayoutT;
function relayout(){ clearTimeout(relayoutT); relayoutT = setTimeout(function(){ layout(); if (window.ScrollTrigger && !reduce) ScrollTrigger.refresh(); }, 120); }

start();
document.querySelectorAll('a[href^="#"]').forEach(function(a){ a.addEventListener('click', function(ev){ var t = document.querySelector(a.getAttribute('href')); if (!t) return; ev.preventDefault(); t.scrollIntoView({behavior: reduce?'auto':'smooth'}); }); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
window.addEventListener('load', relayout);
window.addEventListener('resize', relayout);
var lastMobile = mqMobile.matches;
mqMobile.addEventListener && mqMobile.addEventListener('change', function(){ if (mqMobile.matches!==lastMobile){ location.reload(); } });
})();
