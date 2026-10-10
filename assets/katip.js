/* Kâtip Pirdeviz — chronicle chatbot (UI + client-side retrieval).
   The browser ranks the published corpus (assets/katip/kb.json) with BM25 + entity matching and sends only the
   question, a short history and the ids of the best chunks to the worker; the worker fetches those chunks itself. */
(function(){
'use strict';
var API = 'https://katip-pirdeviz.ulunavir.workers.dev/chat';
var KB_URL = 'assets/katip/kb.json';
var AV = 'assets/katip/pirdeviz.webp';
var STORE = 'ulv-katip', MAXQ = 1500, CTX_CHARS = 14000, MAX_IDS = 12, SEND_TURNS = 6;
var GREET = 'Hoş geldiniz efendim. Ben **Kâtip Pirdeviz**; çağların büyük defterini tutarım. Kadim Çağ’dan Mital Alari günlerine dek ne kayda geçmişse sorunuz, mürekkebim kurumadan arz edeyim. Defterde yazmayanı ise uydurmam, “kayıtlı değil” derim.';

// ---------------------------------------------------------------- retrieval
var FOLD = {'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','â':'a','î':'i','û':'u','é':'e','ë':'e','ä':'a'};
var STOP = {};
('ve ile bir bu su o ne mi mu da de ki icin gibi kim kimdi kimdir nedir nasil neden niye oldu olan olarak hangi zaman hakkinda anlat anlatir bana bize sen ben biz siz onu ona onun bunu buna sunu daha cok en ya veya ama fakat ise yani peki hem hic her sey seyi seyler mi mudur midir varmi var yok neler nerede nereye nereden kac kadar sonra once icinde uzerine the of and to in a is was who what when where why how did does about tell me')
  .split(' ').forEach(function(w){ STOP[w] = 1; });
function fold(s){ return String(s).toLocaleLowerCase('tr').replace(/[çğıöşüâîûéëä]/g, function(c){ return FOLD[c]; }).replace(/['’`´]/g, ' '); }
function toks(s){
  var out = [], m = fold(s).match(/[a-z0-9]+/g) || [];
  for (var i=0;i<m.length;i++){ var w = m[i]; if (w.length < 2 || STOP[w]) continue; out.push(w.length > 5 ? w.slice(0,5) : w); }
  return out;
}
var KB = null, KBP = null;
function loadKB(){
  if (KBP) return KBP;
  KBP = fetch(KB_URL, {cache:'no-cache'}).then(function(r){ if (!r.ok) throw 0; return r.json(); }).then(function(d){
    var N = d.chunks.length, df = {}, tot = 0, ent = {};
    d.chunks.forEach(function(c){
      var tf = {}, t = toks(c.t + ' ' + c.t + ' ' + c.x + ' ' + (c.e || []).join(' '));
      t.forEach(function(w){ tf[w] = (tf[w]||0) + 1; });
      c._tf = tf; c._len = t.length; tot += t.length;
      for (var w in tf) df[w] = (df[w]||0) + 1;
      if (c.k === 'tag') (c.e || []).forEach(function(n){
        var key = toks(n).join(' '); if (key) (ent[key] = ent[key] || []).push(n);
        toks(n).forEach(function(w){ if (w.length >= 4) (ent[w] = ent[w] || []).push(n); });
      });
    });
    KB = {d:d, N:N, df:df, avg:tot/Math.max(1,N), ent:ent};
    return KB;
  });
  return KBP;
}
function retrieve(q, prev){
  if (!KB) return [];
  var qt = toks(q), pt = prev ? toks(prev) : [], w = {};
  qt.forEach(function(t){ w[t] = 1; });
  pt.forEach(function(t){ if (!w[t]) w[t] = 0.45; });
  // entities named in the question (full names, then distinctive single words)
  var ents = {}, qs = ' ' + qt.join(' ') + ' ', ps = ' ' + pt.join(' ') + ' ';
  for (var key in KB.ent){
    var hit = qs.indexOf(' ' + key + ' ') >= 0 ? 1 : (ps.indexOf(' ' + key + ' ') >= 0 ? 0.5 : 0);
    if (hit && (key.indexOf(' ') > 0 || KB.ent[key].length <= 3)) KB.ent[key].forEach(function(n){ ents[n] = Math.max(ents[n]||0, hit); });
  }
  var k1 = 1.2, b = 0.75, res = [];
  KB.d.chunks.forEach(function(c){
    var s = 0;
    for (var t in w){ var f = c._tf[t]; if (!f) continue;
      var idf = Math.log(1 + (KB.N - KB.df[t] + 0.5) / (KB.df[t] + 0.5));
      s += w[t] * idf * f * (k1 + 1) / (f + k1 * (1 - b + b * c._len / KB.avg)); }
    var eb = 0; (c.e || []).forEach(function(n){ if (ents[n]) eb += ents[n] * (c.k === 'tag' ? 9 : c.k === 'ev' ? 2.2 : 1.6); });
    s += eb;
    if (c.k === 'kb' && /^Hikâye \(/.test(c.t)) s *= 0.85;
    if (s > 0) res.push([s, c]);
  });
  res.sort(function(a, b){ return b[0] - a[0]; });
  var out = [], chars = 0, top = res.length ? res[0][0] : 0, per = {};
  for (var i=0;i<res.length && out.length < MAX_IDS;i++){
    var c = res[i][1], len = c.x.length + c.t.length + 8, doc = c.k === 'kb' ? c.t.split(' › ')[0] : c.i;
    if (res[i][0] < top * 0.18) break;
    if (chars + len > CTX_CHARS || (per[doc]||0) >= 2) continue;
    per[doc] = (per[doc]||0) + 1;
    out.push(c.i); chars += len;
  }
  return out;
}

// ---------------------------------------------------------------- markdown (escaped)
function esc(s){ return s.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function inline(s){ return esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>'); }
function md(src){
  var lines = src.replace(/\r/g,'').split('\n'), html = '', list = null, para = [];
  function flushP(){ if (para.length){ html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } }
  function flushL(){ if (list){ html += '</' + list + '>'; list = null; } }
  lines.forEach(function(l){
    var m;
    if (/^\s*$/.test(l)){ flushP(); flushL(); return; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))){ flushP(); if (list !== 'ul'){ flushL(); html += '<ul>'; list = 'ul'; } html += '<li>' + inline(m[1]) + '</li>'; return; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))){ flushP(); if (list !== 'ol'){ flushL(); html += '<ol>'; list = 'ol'; } html += '<li>' + inline(m[1]) + '</li>'; return; }
    if ((m = l.match(/^\s*#{1,4}\s+(.*)/))){ flushP(); flushL(); html += '<p><b>' + inline(m[1]) + '</b></p>'; return; }
    if (/^\s*[—–-]{1,2}\s*Defter/i.test(l)){ flushP(); flushL(); html += '<p class="kp-cite">' + inline(l.trim()) + '</p>'; return; }
    flushL(); para.push(l);
  });
  flushP(); flushL();
  return html;
}

// ---------------------------------------------------------------- state
var st = {msgs:[]};
try { var sv = JSON.parse(localStorage.getItem(STORE) || 'null'); if (sv && Array.isArray(sv.msgs)) st.msgs = sv.msgs.filter(function(m){ return m && (m.r==='u'||m.r==='m') && typeof m.t==='string'; }).slice(-60); } catch(e){}
function save(){ try { localStorage.setItem(STORE, JSON.stringify({msgs: st.msgs.slice(-60)})); } catch(e){} }

// ---------------------------------------------------------------- DOM
var lite = function(){ return document.body.classList.contains('fx-lite') || matchMedia('(prefers-reduced-motion: reduce)').matches; };
var btn = document.createElement('button');
btn.className = 'kp-btn'; btn.type = 'button'; btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-controls','kpPanel');
btn.setAttribute('aria-label','Kâtip Pirdeviz ile konuş'); btn.title = 'Kâtip Pirdeviz — Çağlar Defteri’ne sor';
btn.innerHTML = '<img src="' + AV + '" alt="" width="44" height="44" decoding="async"><i class="kp-ring" aria-hidden="true"></i>';
var panel = document.createElement('section');
panel.className = 'kp-panel'; panel.id = 'kpPanel'; panel.hidden = true;
panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Kâtip Pirdeviz sohbeti');
panel.innerHTML =
  '<header class="kp-head"><img class="kp-hav" src="' + AV + '" alt="" width="34" height="34">' +
  '<div class="kp-ht"><b>Kâtip Pirdeviz</b><span>Çağlar Defteri’nin kâtibi</span></div>' +
  '<button type="button" class="kp-new" title="Yeni sayfa (sohbeti temizle)" aria-label="Yeni sayfa"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z M14 3v5h5 M12 11v6 M9 14h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
  '<button type="button" class="kp-min" title="Küçült" aria-label="Küçült"><svg viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></header>' +
  '<div class="kp-log" aria-live="polite"></div>' +
  '<form class="kp-form" autocomplete="off"><textarea class="kp-in" rows="1" maxlength="' + MAXQ + '" placeholder="Kâtibe sorunu yaz…" aria-label="Sorunuz"></textarea>' +
  '<button type="submit" class="kp-send" title="Gönder (Enter)" aria-label="Gönder"><svg viewBox="0 0 24 24"><path d="M20 3C12 4 7 9 5 17l-1 4 4-1c1-3 2-5 4-7l-3 1c2-4 5-7 11-11z" fill="currentColor"/></svg></button></form>';
document.body.appendChild(panel); document.body.appendChild(btn);
var log = panel.querySelector('.kp-log'), inp = panel.querySelector('.kp-in'), form = panel.querySelector('.kp-form'), sendB = panel.querySelector('.kp-send');
var busy = false;

function bubble(r, text, anim){
  var row = document.createElement('div'); row.className = 'kp-msg ' + (r === 'u' ? 'kp-u' : 'kp-m') + (anim && !lite() ? ' kp-in-anim' : '');
  if (r === 'm') row.innerHTML = '<img class="kp-av" src="' + AV + '" alt="" width="30" height="30">';
  var b = document.createElement('div'); b.className = 'kp-b';
  if (r === 'u') b.textContent = text; else b.innerHTML = md(text);
  row.appendChild(b); log.appendChild(row); scroll(); return b;
}
function scroll(){ log.scrollTop = log.scrollHeight; }
function render(){
  log.innerHTML = '';
  bubble('m', GREET, false);
  st.msgs.forEach(function(m){ bubble(m.r, m.t, false); });
}
function typing(){
  var row = document.createElement('div'); row.className = 'kp-msg kp-m kp-typing';
  row.innerHTML = '<img class="kp-av" src="' + AV + '" alt="" width="30" height="30"><div class="kp-b"><svg class="kp-quill" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3C12 4 7 9 5 17l-1 4 4-1c1-3 2-5 4-7l-3 1c2-4 5-7 11-11z" fill="currentColor"/></svg><span class="kp-dots"><i></i><i></i><i></i></span><span class="sr">Kâtip yazıyor…</span></div>';
  log.appendChild(row); scroll(); return row;
}
function errText(code){
  return {rate:'Mürekkebim tükendi efendim; kalemimi biraz dinlendireyim, birazdan yeniden sorunuz.',
          quota:'Bugünlük hokkam kurudu efendim. Defterin sayfaları yarın yeniden açılır; o vakit tekrar sorunuz.',
          long:'Efendim, bu sual bir sayfaya sığmaz; biraz kısaltıp yeniden yazınız.',
          net:'Ulak yolda kayboldu efendim; mektubunuz bana ulaşmadı. Bir daha deneyiniz.'}[code] ||
         'Kalemim kırıldı efendim, bir aksilik oldu. Birazdan yeniden deneyiniz.';
}

// typewriter that follows the incoming stream
function Writer(el){
  var target = '', shown = 0, done = false, raf = 0, last = 0, cb = null;
  function tick(t){
    raf = 0;
    var dt = last ? t - last : 16; last = t;
    var behind = target.length - shown;
    var speed = lite() ? 4000 : Math.max(55, behind * 3.2);   // chars / second, catches up when far behind
    shown = Math.min(target.length, shown + Math.max(1, Math.round(speed * dt / 1000)));
    el.innerHTML = md(target.slice(0, shown)) ; el.classList.toggle('kp-ink', shown < target.length || !done);
    var row = el.parentNode;   // follow the text, but never scroll the start of a long answer out of view
    log.scrollTop = Math.min(log.scrollHeight - log.clientHeight, row.offsetTop - 10);
    if (shown < target.length) raf = requestAnimationFrame(tick);
    else { last = 0; if (done && cb){ el.classList.remove('kp-ink'); var f = cb; cb = null; f(); } }
  }
  function kick(){ if (!raf) raf = requestAnimationFrame(tick); }
  return {push:function(s){ target += s; kick(); }, end:function(f){ done = true; cb = f; kick(); }, text:function(){ return target; }};
}

function history(){
  return st.msgs.slice(-SEND_TURNS).map(function(m){ return {r:m.r, t:m.t.slice(0, 900)}; });
}
function ask(q){
  if (busy) return;
  q = q.trim(); if (!q) return;
  if (q.length > MAXQ){ bubble('m', errText('long'), true); return; }
  busy = true; sendB.disabled = true;
  var hist = history();
  var prevU = null; for (var i = st.msgs.length - 1; i >= 0; i--) if (st.msgs[i].r === 'u'){ prevU = st.msgs[i].t; break; }
  st.msgs.push({r:'u', t:q}); save(); bubble('u', q, true);
  var ty = typing();
  loadKB().catch(function(){ return null; }).then(function(){
    var ids = retrieve(q, prevU);
    return fetch(API, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({q:q, h:hist, ids:ids})});
  }).then(function(r){
    if (!r.ok) return r.json().catch(function(){ return {}; }).then(function(j){ throw {code: j.err || (r.status === 429 ? 'rate' : 'x')}; });
    ty.remove();
    var b = bubble('m', '', true), wr = Writer(b);
    var rd = r.body.getReader(), dec = new TextDecoder(), buf = '', failed = false;
    function finish(){
      wr.end(function(){
        var t = wr.text().trim();
        if (t){ st.msgs.push({r:'m', t:t}); save(); }
        else { b.innerHTML = md(errText(failed ? 'x' : 'x')); }
        busy = false; sendB.disabled = false;
      });
    }
    function pump(){
      return rd.read().then(function(x){
        if (x.done){ finish(); return; }
        buf += dec.decode(x.value, {stream:true});
        var k; while ((k = buf.indexOf('\n\n')) >= 0){
          var ev = buf.slice(0, k); buf = buf.slice(k + 2);
          var line = ev.split('\n').filter(function(l){ return l.indexOf('data:') === 0; }).map(function(l){ return l.slice(5); }).join('');
          if (!line) continue;
          try { var d = JSON.parse(line); if (d.t) wr.push(d.t); if (d.err) failed = true; if (d.done) window.__katipLast = d; } catch(e){}
        }
        return pump();
      });
    }
    return pump().catch(function(){ failed = true; finish(); });
  }).catch(function(e){
    if (ty.parentNode) ty.remove();
    bubble('m', errText(e && e.code === 'rate' ? 'rate' : e && e.code === 'quota' ? 'quota' : e && e.code === 'long' ? 'long' : (e && e.code) ? 'x' : 'net'), true);
    busy = false; sendB.disabled = false;
  });
}

// ---------------------------------------------------------------- open / close
var rendered = false, closeT = 0;
function setOpen(o){
  clearTimeout(closeT);
  btn.setAttribute('aria-expanded', o ? 'true' : 'false');
  document.body.classList.toggle('kp-open', o);
  if (o){
    if (!rendered){ render(); rendered = true; }
    panel.hidden = false; void panel.offsetWidth; panel.classList.add('on');
    loadKB().catch(function(){});
    setTimeout(function(){ scroll(); if (matchMedia('(pointer:fine)').matches) inp.focus(); }, 60);
  } else {
    panel.classList.remove('on');
    closeT = setTimeout(function(){ panel.hidden = true; }, lite() ? 0 : 280);
  }
}
btn.addEventListener('click', function(){ setOpen(panel.hidden || !panel.classList.contains('on')); });
btn.addEventListener('pointerenter', function(){ loadKB().catch(function(){}); }, {once:true});
panel.querySelector('.kp-min').addEventListener('click', function(){ setOpen(false); btn.focus(); });
panel.querySelector('.kp-new').addEventListener('click', function(){
  if (busy) return;
  st.msgs = []; save(); render(); inp.focus();
});
form.addEventListener('submit', function(ev){ ev.preventDefault(); var q = inp.value; if (!q.trim() || busy) return; inp.value = ''; grow(); ask(q); });
inp.addEventListener('keydown', function(ev){
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing){ ev.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', {cancelable:true})); }
});
function grow(){ inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 110) + 'px'; }
inp.addEventListener('input', grow);
panel.addEventListener('keydown', function(ev){ if (ev.key === 'Escape'){ ev.stopPropagation(); setOpen(false); btn.focus(); } });
document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && !panel.hidden && panel.contains(document.activeElement) === false && document.activeElement === btn){ setOpen(false); } });
// keep wheel/touch scrolling inside the log from scrolling the timeline
log.addEventListener('wheel', function(ev){ ev.stopPropagation(); }, {passive:true});

// sit exactly above the music button (its height/position differs per device and when the player is open)
var mpEl = document.querySelector('.mp');
function place(){
  var mb = document.querySelector('.mp-btn'); if (!mb) return;
  var r = mb.getBoundingClientRect(), top = r.top, w = btn.offsetWidth || 40;
  var pp = mpEl && mpEl.classList.contains('open') && innerWidth <= 860 ? mpEl.querySelector('.mp-panel') : null;
  if (pp){ var pr = pp.getBoundingClientRect(); if (pr.height) top = Math.min(top, pr.top); }
  var bottom = Math.max(8, innerHeight - top + 10);
  btn.style.bottom = bottom + 'px';
  btn.style.right = Math.max(4, innerWidth - (r.left + r.right) / 2 - w / 2) + 'px';
  panel.style.bottom = (bottom + w + 10) + 'px';
}
place();
addEventListener('resize', place); addEventListener('load', place);
if (mpEl && window.MutationObserver) new MutationObserver(function(){ place(); setTimeout(place, 320); }).observe(mpEl, {attributes:true, attributeFilter:['class']});

window.__katip = {open:function(){ setOpen(true); }, close:function(){ setOpen(false); }, ask:ask, retrieve:function(q, p){ return loadKB().then(function(){ return retrieve(q, p); }); }, _md:md};
})();
