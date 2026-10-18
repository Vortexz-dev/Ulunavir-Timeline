// Step 3: Dünya küresi (tembel yüklenir; düz harita açıkken hiç yüklenmez). three.js r169.
import * as THREE from './vendor/three/three.module.min.js';

const R = 100;                                   // gezegen yarıçapı (sahne birimi)
const D2R = Math.PI / 180;
export function llVec(lon, lat, r = 1, out = new THREE.Vector3()){   // SphereGeometry uv kuralıyla aynı
  const u = (lon + 180) / 360, cl = Math.cos(lat * D2R);
  return out.set(-Math.cos(2 * Math.PI * u) * cl * r, Math.sin(lat * D2R) * r, Math.sin(2 * Math.PI * u) * cl * r);
}
export function vecLL(v){ const n = v.clone().normalize(); const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) / D2R;
  let u = Math.atan2(n.z, -n.x) / (2 * Math.PI); if (u < 0) u += 1; return [u * 360 - 180, lat]; }

const NOISE = `
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; mat3 m = mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64); for (int i = 0; i < 5; i++){ s += a * n3(p); p = m * p * 2.03; a *= .5; } return s; }`;

export async function createGlobe(ctx){
  const {renderer, cv, labelsEl, url} = ctx;
  const G = {on: false, disposed: false};
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(36, 1, .5, 40000);
  const disp = [];                                  // her şey dispose() ile serbest
  const track = (o) => { disp.push(o); return o; };
  const ld = new THREE.TextureLoader();
  const loadT = (f) => new Promise((res, rej) => ld.load(url(f), res, undefined, rej));
  const [J, tC, tN] = await Promise.all([fetch(url('globe/globe.json')).then((r) => r.json()), loadT('globe/g_c.webp'), loadT('globe/g_n.webp')]);
  for (const t of [tC, tN]){ t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.wrapS = THREE.RepeatWrapping; track(t); }
  tC.colorSpace = THREE.SRGBColorSpace;
  const SUN = (() => { const s = llVec(J.conts[0].ll[0] + 62, 12); return s.normalize(); })();   // güneş: ilk bakışta Horaghfus gündüz, sağda alacakaranlık
  const U = {sun: {value: SUN}, time: {value: 0}, cRot: {value: 0}};
  const spin = new THREE.Group(); scene.add(spin);         // gezegen + bulut + gemiler yavaşça döner (gece/gündüz kayar)

  // ---------- uzay gökyüzü (prosedürel yıldızlar + soluk galaksi bandı)
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(30000, 32, 16)), track(new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .99999; }',
    fragmentShader: NOISE + `varying vec3 vD;
      vec3 star(vec3 d, float sc){ vec3 p = d * sc, i = floor(p), f = fract(p) - .5; float h = h3(i), h2 = h3(i + 7.1);
        vec3 o = vec3(h, h2, h3(i + 3.7)) - .5; float r = length(f - o * .7); float b = step(.93, h) * smoothstep(.07 + .05 * h2, 0., r) * (.4 + h2);
        return b * mix(vec3(1., .82, .65), vec3(.7, .82, 1.), h2); }
      void main(){ vec3 d = normalize(vD); vec3 c = star(d, 140.) + star(d, 320.) * .6 + star(d, 700.) * .35;
        float band = exp(-pow(dot(d, normalize(vec3(.3, .9, -.3))) * 3.2, 2.)); float neb = fbm(d * 4.) * fbm(d * 9. + 3.);
        c += band * (vec3(.05, .045, .08) + vec3(.10, .06, .14) * neb * 1.6) + vec3(.004, .006, .014);
        gl_FragColor = vec4(c, 1.); }`})));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  // ---------- gezegen yüzeyi (gündüz albedo, gece şehir ışıkları + soluk yollar, okyanus parlaması, atmosfer pusu)
  const pm = track(new THREE.ShaderMaterial({uniforms: {...U, tC: {value: tC}, tN: {value: tN}, camP: {value: new THREE.Vector3()}},
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vW, vO; void main(){ vUv = uv; vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: NOISE + `uniform sampler2D tC, tN; uniform vec3 sun, camP; uniform float time, cRot; varying vec2 vUv; varying vec3 vN, vW, vO;
      void main(){ vec3 n = normalize(vN), v = normalize(camP - vW); vec3 al = texture2D(tC, vUv).rgb; vec4 nt = texture2D(tN, vUv);
        float land = nt.b, nd = dot(n, sun), day = smoothstep(-.12, .22, nd);
        vec3 diff = al * (max(nd, 0.) * vec3(1.05, 1., .94) * 1.25 + .035);
        vec3 hv = normalize(sun + v); float sp = pow(max(dot(n, hv), 0.), 320.) * (1. - land) * step(0., nd) * .28; diff += vec3(1., .92, .8) * sp;
        // bulut gölgesi (aynı bulut alanı, güneşe doğru kaydırılmış)
        vec3 cp = vO; float ca = cos(cRot), sa = sin(cRot); cp = vec3(ca * cp.x - sa * cp.z, cp.y, sa * cp.x + ca * cp.z);
        float cd = smoothstep(.52, .78, fbm(cp * 3.2 + vec3(0., 0., time * .004)) + .18 * fbm(cp * 11.));
        diff *= 1. - cd * .45 * day;
        float night = 1. - smoothstep(-.18, .08, nd);
        float city = nt.r * nt.r * 3.2 + nt.r * .7, road = nt.g * .22;
        float fl = .85 + .15 * n3(vO * 300. + time * .6);
        vec3 glow = (vec3(1., .66, .32) * city * fl + vec3(1., .72, .4) * road) * night * (1. - cd * .6);
        float fr = pow(1. - max(dot(n, v), 0.), 3.);
        vec3 haze = vec3(.32, .55, 1.) * fr * (.25 + .75 * day) * smoothstep(-.3, .3, nd) * .9;
        vec3 term = vec3(1., .45, .2) * fr * exp(-pow(nd * 6., 2.)) * .5;
        vec3 c = diff + glow + haze + term;
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`}));
  const planet = new THREE.Mesh(track(new THREE.SphereGeometry(R, 192, 96)), pm); spin.add(planet);

  // ---------- bulutlar: iki kabuk, güneşe doğru kendi gölgesi (hacimli görünüm)
  const cloudMat = (k) => track(new THREE.ShaderMaterial({uniforms: {...U, camP: pm.uniforms.camP, k: {value: k}}, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vO, vN, vW; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: NOISE + `uniform vec3 sun, camP; uniform float time, cRot, k; varying vec3 vO, vN, vW;
      float dens(vec3 p){ return smoothstep(.52 + k * .06, .80, fbm(p * 3.2 + vec3(0., 0., time * .004)) + .18 * fbm(p * 11. + k)); }
      void main(){ vec3 p = vO; float ca = cos(cRot), sa = sin(cRot); p = vec3(ca * p.x - sa * p.z, p.y, sa * p.x + ca * p.z);
        vec3 n = normalize(vN), v = normalize(camP - vW); float d = dens(p); if (d < .01) discard;
        vec3 sl = normalize(sun - n * dot(sun, n)); float sh = dens(p + sl * .018) - d;   // güneş tarafı parlak, arka kenar koyu
        float nd = dot(n, sun), day = smoothstep(-.15, .25, nd);
        float lit = clamp(.78 - sh * 1.8, .35, 1.15);
        vec3 col = mix(vec3(.04, .05, .08), vec3(1., .99, .97) * lit, day) + vec3(1., .5, .25) * exp(-pow(nd * 5., 2.)) * .25 * d;
        float rim = pow(1. - max(dot(n, v), 0.), 2.);
        gl_FragColor = vec4(col, d * mix(.92, .55, k) * (1. - rim * .5)); }`}));
  const cl1 = new THREE.Mesh(track(new THREE.SphereGeometry(R * 1.008, 160, 80)), cloudMat(0)); cl1.renderOrder = 2;
  const cl2 = new THREE.Mesh(track(new THREE.SphereGeometry(R * 1.016, 160, 80)), cloudMat(1)); cl2.renderOrder = 3;
  spin.add(cl1, cl2);

  // ---------- atmosfer saçılması (kenar halkası; gündüz mavi, alacakaranlıkta turuncu)
  const atm = new THREE.Mesh(track(new THREE.SphereGeometry(R * 1.06, 128, 64)), track(new THREE.ShaderMaterial({uniforms: {...U, camP: pm.uniforms.camP}, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 sun, camP; varying vec3 vN, vW;
      void main(){ vec3 v = normalize(vW - camP); vec3 o = camP; float b = dot(o, v), c = dot(o, o) - ${(R * R).toFixed(1)};
        // ışının gezegene en yakın noktası -> atmosfer kalınlığı
        float tc = -b; vec3 pc = o + v * tc; if (tc > 0. && dot(pc, pc) < ${(R * R).toFixed(1)}) discard; float hgt = (length(pc) - ${R.toFixed(1)}) / ${(R * .06).toFixed(2)};
        if (hgt < 0.) hgt = 0.; float den = exp(-hgt * 3.2) * smoothstep(1., .0, hgt);
        vec3 nn = normalize(pc); float sd = dot(nn, sun); float day = smoothstep(-.35, .25, sd);
        float mu = dot(v, sun); float mie = pow(max(mu, 0.), 12.) * .6;
        vec3 ray = vec3(.28, .52, 1.) * day + vec3(1., .42, .15) * exp(-pow(sd * 4., 2.)) * .7;
        gl_FragColor = vec4((ray + vec3(1., .85, .6) * mie * day) * den * 1.25, 1.); }`})));
  atm.renderOrder = 4; scene.add(atm);

  // ---------- gemi ışıkları (deniz yollarında hareket eden noktalar; gece belirgin)
  const L = J.lanes, NS = L.length * 2;
  const aA = new Float32Array(NS * 3), aB = new Float32Array(NS * 3), aP = new Float32Array(NS * 2), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  for (let i = 0; i < NS; i++){ const l = L[i % L.length], rev = i >= L.length; llVec(...(rev ? l[1] : l[0]), 1, _a); llVec(...(rev ? l[0] : l[1]), 1, _b);
    aA.set([_a.x, _a.y, _a.z], i * 3); aB.set([_b.x, _b.y, _b.z], i * 3); aP.set([Math.random(), .006 + Math.random() * .01], i * 2); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(aA.slice(), 3)); sg.setAttribute('a', new THREE.BufferAttribute(aA, 3));
  sg.setAttribute('b', new THREE.BufferAttribute(aB, 3)); sg.setAttribute('ph', new THREE.BufferAttribute(aP, 2)); track(sg);
  const ships = new THREE.Points(sg, track(new THREE.ShaderMaterial({uniforms: {...U, camP: pm.uniforms.camP, px: {value: 1}}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 a, b; attribute vec2 ph; uniform float time, px; uniform vec3 sun, camP; varying float vA;
      void main(){ float t = fract(ph.x + time * ph.y * .05); float om = acos(clamp(dot(a, b), -1., 1.)); float s = max(sin(om), 1e-4);
        vec3 p = normalize((sin((1. - t) * om) * a + sin(t * om) * b) / s); vec4 w = modelMatrix * vec4(p * ${(R * 1.002).toFixed(2)}, 1.);
        vec3 n = normalize(w.xyz); float night = 1. - smoothstep(-.15, .1, dot(n, sun)); float face = smoothstep(.0, .25, dot(n, normalize(camP - w.xyz)));
        vA = (.12 + .88 * night) * face * smoothstep(0., .06, t) * smoothstep(1., .94, t);
        vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; gl_PointSize = clamp(px * 1.1 / -mv.z, 1.5, 4.); }`,
    fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vec3(1., .85, .55) * vA * smoothstep(.5, .1, r), 1.); }'})));
  ships.frustumCulled = false; ships.renderOrder = 1; spin.add(ships);

  // ---------- gök cisimleri: Thysuun (güneş), Algurd (kızıl, yakın, büyük), Ailremar (koyu, uzak), Goturg (camgöbeği gaz devi)
  const bodyMat = (c1, c2, bands) => track(new THREE.ShaderMaterial({uniforms: {...U, c1: {value: new THREE.Color(...c1)}, c2: {value: new THREE.Color(...c2)}},
    vertexShader: 'varying vec3 vO, vN; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: NOISE + `uniform vec3 sun, c1, c2; uniform float time; varying vec3 vO, vN;
      void main(){ float nd = dot(normalize(vN), sun); float t;
        ${bands ? 't = .5 + .5 * sin(vO.y * 18. + fbm(vO * 3. + vec3(time * .01, 0., 0.)) * 5.) * .8 + .2 * fbm(vO * 12.);' : 't = fbm(vO * 5.) * .7 + smoothstep(.62, .7, n3(vO * 9.)) * .35;'}
        vec3 c = mix(c1, c2, clamp(t, 0., 1.)) * (max(nd, 0.) * 1.15 + .025);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`}));
  const mkBody = (r, c1, c2, bands) => new THREE.Mesh(track(new THREE.SphereGeometry(r, 64, 32)), bodyMat(c1, c2, bands));
  const algurd = mkBody(15, [.55, .12, .07], [.85, .32, .18], false), ailremar = mkBody(8, [.16, .17, .2], [.38, .38, .42], false);
  const goturg = mkBody(380, [.18, .62, .70], [.55, .92, .95], true);
  goturg.position.set(-4200, 700, -5200); goturg.rotation.z = .3;
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(480, 760, 128)), track(new THREE.ShaderMaterial({side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec2 vP; void main(){ float r = length(vP); float b = .5 + .5 * sin(r * .14) * sin(r * .045); gl_FragColor = vec4(vec3(.55, .85, .9) * b, .35 * b * smoothstep(480., 510., r) * smoothstep(760., 730., r)); }'})));
  ring.rotation.x = Math.PI / 2 - .35; goturg.add(ring);
  scene.add(algurd, ailremar, goturg);
  const sunP = SUN.clone().multiplyScalar(14000);
  const sunSp = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), track(new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv - .5; vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.); mv.xy += position.xy * 2600.; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec2 vU; void main(){ float r = length(vU) * 2.; float c = (smoothstep(.09, .07, r) * 3. + exp(-r * 9.) * 1.3 + exp(-r * 3.) * .25) * smoothstep(1., .6, r); gl_FragColor = vec4(vec3(1., .9, .72) * c, 1.); }'})));
  sunSp.position.copy(sunP); sunSp.frustumCulled = false; scene.add(sunSp);

  // ---------- etiketler (konum noktalarıyla aynı stil)
  const labs = [];
  const mkL = (name, cls, col, getP, opt = {}) => { const e = document.createElement('button'); e.type = 'button'; e.className = 'm3l ' + cls + ' m3d-gl';
    e.innerHTML = (cls.includes('m3l-dot') ? '<b class="m3l-d"' + (col ? ' style="background:' + col + ';box-shadow:0 0 0 2px #000a,0 0 10px ' + col + '"' : '') + '></b><span>' : '<span>') + name.replace(/[&<>"]/g, '') + '</span>';
    labelsEl.appendChild(e); const l = {e, getP, ...opt}; labs.push(l); return l; };
  const bodyP = (m, r) => () => ({p: m.position, r});
  mkL('Thysuun', 'm3l-city m3l-dot', '#ffd77a', () => ({p: sunP, r: 0, far: true}));
  mkL('Algurd', 'm3l-city m3l-dot', '#e0533a', bodyP(algurd, 15));
  mkL('Ailremar', 'm3l-city m3l-dot', '#8d93a3', bodyP(ailremar, 8));
  mkL('Goturg', 'm3l-city m3l-dot', '#5fe3ee', bodyP(goturg, 380));
  const surf = (ll, lift) => { const v = llVec(ll[0], ll[1], R * lift); return () => ({p: v.clone().applyMatrix4(spin.matrixWorld), r: 0, surf: true}); };
  for (const c of J.conts) mkL(c.name, 'm3l-cont', null, surf(c.ll, 1.02), {cont: c, maxD: 900});
  for (const c of J.cities) mkL(c.name, 'm3l-vil m3l-dot', null, surf(c.ll, 1.004), {maxD: 330});

  // ---------- kamera (yörünge), giriş ve ölçek
  const ORB = {lon: J.conts[0].ll[0], lat: J.conts[0].ll[1], d: 430, gd: 430, glon: 0, glat: 0, v: 0, vy: 0};
  ORB.glon = ORB.lon; ORB.glat = ORB.lat;
  let clock = 0, drag = null;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  function placeCam(){ llVec(ORB.lon, ORB.lat, ORB.d + R, camera.position).applyAxisAngle(_w.set(0, 1, 0), spin.rotation.y); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); }
  function centreLL(){ _v.copy(camera.position).applyAxisAngle(_w.set(0, 1, 0), -spin.rotation.y); return vecLL(_v); }
  // ekran merkezindeki noktanın düz haritadaki karşılığı (en yakın kıtanın kendi yerel izdüşümü)
  function flatAt(ll){
    let best = null, bd = 1e9; const P = llVec(ll[0], ll[1]);
    for (const k in J.pos){ const C = llVec(J.pos[k][0], J.pos[k][1]); const a = Math.acos(Math.max(-1, Math.min(1, P.dot(C)))); if (a < bd){ bd = a; best = k; } }
    const [lo0, la0] = J.pos[best].map((x) => x * D2R), lo = ll[0] * D2R, la = ll[1] * D2R;
    const c = Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(lo - lo0), th = Math.acos(Math.max(-1, Math.min(1, c)));
    const k_ = th < 1e-6 ? 1 : th / Math.sin(th);
    const E = k_ * Math.cos(la) * Math.sin(lo - lo0) * J.rp, N = k_ * (Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(lo - lo0)) * J.rp;
    const b = J.box[best]; const x = Math.min(Math.max((b[0] + b[2]) / 2 + E, b[0]), b[2]), z = Math.min(Math.max((b[1] + b[3]) / 2 - N, b[1]), b[3]);
    return {k: best, x, z, d: best === 'horaghfus' ? 1000 : 520};
  }
  G.flatAt = flatAt; G.centreLL = centreLL;
  G.lookDir = (v, d) => { const q = new THREE.Vector3(...v).applyAxisAngle(_w.set(0, 1, 0), -spin.rotation.y); G.lookAt(vecLL(q), d); };
  G.lookAt = (ll, d) => { ORB.glon = ORB.lon = ll[0]; ORB.glat = ORB.lat = ll[1]; if (d) ORB.d = ORB.gd = d; };

  // giriş: sürükle = döndür, tekerlek = yakınlaş/uzaklaş; yüzeye çok yaklaşınca düz haritaya geçiş
  const onDown = (e) => { if (!G.on) return; cv.setPointerCapture(e.pointerId); drag = {x: e.clientX, y: e.clientY, m: 0}; };
  const onMove = (e) => { if (!G.on || !drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.m += Math.abs(dx) + Math.abs(dy);
    const k = (ORB.d / 900) * .12 + .012; ORB.glon -= dx * k * 1.2; ORB.glat = Math.min(80, Math.max(-80, ORB.glat + dy * k)); };
  const onUp = () => { drag = null; };
  const onWheel = (e) => { if (!G.on) return; e.preventDefault(); const f = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * .0022);
    ORB.gd = Math.min(Math.max(ORB.gd * f, 26), 2400);
    if (ORB.gd <= 26.5 && e.deltaY < 0 && ctx.onDive && !G.diving){ G.diving = true; ctx.onDive(flatAt(centreLL())); } };
  const onClick = (e) => { const t = e.target.closest('.m3d-gl'); if (!t || !G.on) return; const l = labs.find((q) => q.e === t); if (!l) return;
    if (l.cont && ctx.onDive && !G.diving){ G.diving = true; ctx.onDive(flatAt(l.cont.ll)); } };
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('wheel', onWheel, {passive: false}); labelsEl.addEventListener('click', onClick);

  function updLabels(){
    const w = cv.clientWidth, h = cv.clientHeight, cp = camera.position, placed = [];
    for (const l of labs){
      const g = l.getP(); let vis = !(l.maxD && ORB.d > l.maxD);
      if (vis && g.surf){ _v.copy(g.p).normalize(); vis = _v.dot(_w.copy(cp).sub(g.p).normalize()) > .08; }
      if (vis){ _v.copy(g.p).sub(cp); const dist = _v.length(); _v.normalize();     // gezegen arkasında mı?
        const b = cp.dot(_v), c = cp.lengthSq() - R * R * 1.0, disc = b * b - c; if (!g.surf && disc > 0 && -b - Math.sqrt(disc) > 0 && -b - Math.sqrt(disc) < dist) vis = false; }
      if (vis){ _v.copy(g.p); if (g.r) _v.y += g.r * 1.05; _v.project(camera); vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05; }
      if (vis){ const x = (_v.x * .5 + .5) * w, y = (-_v.y * .5 + .5) * h; const bw = l.bw || (l.bw = l.e.offsetWidth || 80), bh = 18;
        const cx = l.e.classList.contains('m3l-dot') ? x - 8 : x - bw / 2, cy = y - bh;
        if (placed.some((p) => cx < p[2] && cx + bw > p[0] && cy < p[3] && cy + bh > p[1])) vis = false;
        else { placed.push([cx, cy, cx + bw, cy + bh]); l.e.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)`; } }
      l.e.classList.toggle('on', vis);
    }
  }
  G.frame = (dt) => {
    clock += dt; U.time.value = clock; U.cRot.value = clock * .006;
    spin.rotation.y = clock * .004;                 // gezegen kendi ekseninde yavaşça
    const r = 1 - Math.exp(-dt * 6); ORB.lon += (ORB.glon - ORB.lon) * r; ORB.lat += (ORB.glat - ORB.lat) * r; ORB.d = Math.exp(Math.log(ORB.d) + (Math.log(ORB.gd) - Math.log(ORB.d)) * r);
    const a1 = clock * .02 + 1.2, a2 = clock * .009 + 4.0;
    algurd.position.set(Math.cos(a1) * 520, Math.sin(a1) * 90, Math.sin(a1) * 520); algurd.rotation.y = clock * .02;
    ailremar.position.set(Math.cos(a2) * 980, Math.sin(a2 + 1) * 160, Math.sin(a2) * 980); goturg.rotation.y = clock * .01;
    placeCam(); camera.near = Math.max(.3, ORB.d * .02); camera.updateProjectionMatrix();
    pm.uniforms.camP.value.copy(camera.position); ships.material.uniforms.px.value = cv.clientHeight * renderer.getPixelRatio() * 2.2;
    renderer.render(scene, camera); updLabels();
  };
  G.resize = (w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix(); labs.forEach((l) => { l.bw = 0; }); };
  G.show = (v) => { G.on = v; G.diving = false; labs.forEach((l) => { l.e.hidden = !v; if (!v) l.e.classList.remove('on'); }); };
  G.stats = () => ({calls: renderer.info.render.calls, tris: renderer.info.render.triangles, d: +ORB.d.toFixed(1), ll: centreLL().map((x) => +x.toFixed(1)), labs: labs.filter((l) => l.e.classList.contains('on')).map((l) => l.e.textContent)});
  G.orb = ORB;
  G.dispose = () => {
    if (G.disposed) return; G.disposed = true; G.on = false;
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
    cv.removeEventListener('wheel', onWheel); labelsEl.removeEventListener('click', onClick);
    labs.forEach((l) => l.e.remove()); disp.forEach((o) => o.dispose && o.dispose()); renderer.renderLists.dispose();
  };
  return G;
}
