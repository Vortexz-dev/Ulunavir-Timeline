// t141 — Horaghfus 3D haritası (v1, deneysel). three.js (assets/vendor/three), derleme adımı yok.
// Dünya birimi: 1 = 1 km. Kıta: 1024 x 768 km. Yükseklikler EX kat abartılı.
// Mimari: CONTINENTS listesi -> ileride diğer kıtalar (offset ile) ve küre görünümü eklenecek.
import * as THREE from './vendor/three/three.module.min.js';

const V = new URL(import.meta.url).searchParams.get('v') || '1';
const BASE = new URL('./map3d/', import.meta.url).href;
const url = (f) => BASE + f + '?v=' + V;
const EX = 3.4;                      // dikey abartı
const WK = 1024, HK = 768;           // dünya boyutu (km)
const CH = 128, NCX = 8, NCY = 6;    // arazi parçaları
const DMIN = 7, DMAX = 1150;
const CONTINENTS = [{id: 'horaghfus', name: 'Horaghfus', ox: 0, oz: 0}];   // ileride: diğer kıtalar
const KIND_TR = {capital: 'Başkent', city: 'Şehir', village: 'Köy', district: 'Şehir bölgesi', landmark: 'Önemli yer', forest: 'Orman', lake: 'Göl', river: 'Nehir',
  hills: 'Tepeler', islands: 'Adalar', swamp: 'Bataklık', plains: 'Düzlük', floating: 'Uçan şehir'};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

let root, cv, renderer, scene, camera, labelsEl, cardEl, loadEl, hintEl, scaleEl;
let D = null, HGT = null, HW = 2048, HH = 1536, FAC = null, META = null;
let built = false, building = null, isOpen = false, raf = 0, lastT = 0, clock = 0;
const U = {time: {value: 0}, sun: {value: new THREE.Vector3(-0.78, 0.52, 0.2).normalize()}, hover: {value: new THREE.Vector4(0, 0, 0, 0)},
  borderVis: {value: 1}, camPos: {value: new THREE.Vector3()}, fogCol: {value: new THREE.Color(0x0d2236)}, fogK: {value: 0.0009}};
const cam = {x: 512, z: 400, d: 1000, yaw: 0, tilt: 0};
const goal = {x: 512, z: 400, d: 1000, yaw: 0, tilt: 0};
let flying = 0, dirtyLabels = true;

// ------------------------------------------------------------ utils
function hAt(x, z){   // km (gerçek) -> abartısız yükseklik
  if (!HGT) return 0;
  const fx = Math.min(Math.max(x * 2 - .5, 0), HW - 1.001), fz = Math.min(Math.max(z * 2 - .5, 0), HH - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * HW + ix;
  return (HGT[i] * (1 - tx) + HGT[i + 1] * tx) * (1 - tz) + (HGT[i + HW] * (1 - tx) + HGT[i + HW + 1] * tx) * tz;
}
const yAt = (x, z) => Math.max(hAt(x, z), 0) * EX;
function facAt(x, z){ if (!FAC) return 0; const ix = Math.min(Math.max(x * 2 | 0, 0), HW - 1), iz = Math.min(Math.max(z * 2 | 0, 0), HH - 1); return FAC[iz * HW + ix]; }
function loadImg(f){ return fetch(url(f)).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.blob(); })
  .then((b) => createImageBitmap(b, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})); }
function pixels(bm){ const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data; }
function tex(bm, srgb){ const t = new THREE.Texture(bm); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; }

// ------------------------------------------------------------ DOM
function makeDom(){
  root = document.createElement('div'); root.className = 'm3d'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Horaghfus 3D haritası');
  root.innerHTML = '<canvas class="m3d-cv"></canvas><div class="m3d-labels"></div>' +
    '<div class="m3d-top"><div class="m3d-title"><b>Horaghfus</b><span>3D Harita · deneme sürümü</span></div>' +
    '<div class="m3d-btns"><button type="button" class="m3d-home" title="Tüm kıtayı göster">Kıta</button><button type="button" class="m3d-x" aria-label="Haritayı kapat (Esc)">✕</button></div></div>' +
    '<div class="m3d-hint">Sol tık + sürükle: kaydır · Sağ tık + sürükle: döndür / eğ · Tekerlek: yakınlaş · İsme tıkla: bilgi kartı</div>' +
    '<div class="m3d-scale"><i></i><span></span></div>' +
    '<aside class="m3d-card" hidden><button type="button" class="m3d-cx" aria-label="Kartı kapat">✕</button><div class="m3d-ci"></div></aside>' +
    '<div class="m3d-load"><div class="m3d-ring"></div><p>Horaghfus yükleniyor… <span>0%</span></p></div>';
  document.body.appendChild(root);
  cv = root.querySelector('.m3d-cv'); labelsEl = root.querySelector('.m3d-labels'); cardEl = root.querySelector('.m3d-card');
  loadEl = root.querySelector('.m3d-load'); hintEl = root.querySelector('.m3d-hint'); scaleEl = root.querySelector('.m3d-scale');
  root.querySelector('.m3d-x').addEventListener('click', close);
  root.querySelector('.m3d-home').addEventListener('click', () => { flyTo(512, 400, 1000); closeCard(); });
  root.querySelector('.m3d-cx').addEventListener('click', closeCard);
  cardEl.addEventListener('click', onCardClick);
  labelsEl.addEventListener('click', onLabelClick);
  document.addEventListener('keydown', (e) => {
    if (!isOpen || e.key !== 'Escape') return;
    const tc = document.querySelector('.tc'); if (tc && !tc.hidden) return;
    const z = root.querySelector('.m3d-zoom'); if (z){ z.remove(); return; }
    if (!cardEl.hidden) closeCard(); else close();
  });
  bindInput();
}
function progress(p){ const s = loadEl.querySelector('span'); if (s) s.textContent = Math.round(p * 100) + '%'; }

// ------------------------------------------------------------ build scene
async function build(){
  renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1c2d);
  camera = new THREE.PerspectiveCamera(36, 1, 0.5, 9000);
  const dl = new THREE.DirectionalLight(0xfff1dc, 2.2); dl.position.copy(U.sun.value).multiplyScalar(100); scene.add(dl);
  scene.add(new THREE.HemisphereLight(0xe4ecff, 0x6a5a40, 1.5));
  let done = 0; const step = (n) => (x) => { done += n; progress(Math.min(done, 1)); return x; };
  const [meta, data, hBm, fBm, aBm, lo, treesBuf] = await Promise.all([
    fetch(url('meta.json')).then((r) => r.json()).then(step(.05)), fetch(url('places3d.json')).then((r) => r.json()).then(step(.05)),
    loadImg('height.png').then(step(.35)), loadImg('fac.png').then(step(.1)), loadImg('aux.png').then(step(.1)),
    loadImg('color_lo.webp').then(step(.2)), fetch(url('trees.bin')).then((r) => r.arrayBuffer()).then(step(.15))]);
  META = meta; D = data; HW = meta.hgrid[0]; HH = meta.hgrid[1];
  // heights
  const hp = pixels(hBm); HGT = new Float32Array(HW * HH); const span = meta.hmax - meta.hmin;
  for (let i = 0, j = 0; i < HGT.length; i++, j += 4) HGT[i] = (hp[j] * 256 + hp[j + 1]) / 65535 * span + meta.hmin;
  const fp = pixels(fBm), ap = pixels(aBm); FAC = new Uint8Array(HW * HH);
  for (let i = 0, j = 0; i < FAC.length; i++, j += 4){ const m = Math.max(fp[j], fp[j + 1], fp[j + 2], ap[j]); if (m > 110) FAC[i] = m === fp[j] ? 1 : m === fp[j + 1] ? 2 : m === fp[j + 2] ? 3 : 4; }
  // normal map texture from heights (gives crisp relief at every LOD)
  const nm = new Uint8Array(HW * HH * 4);
  for (let z = 0; z < HH; z++) for (let x = 0; x < HW; x++){
    const i = z * HW + x, l = HGT[z * HW + Math.max(x - 1, 0)], r = HGT[z * HW + Math.min(x + 1, HW - 1)];
    const u = HGT[Math.max(z - 1, 0) * HW + x], d = HGT[Math.min(z + 1, HH - 1) * HW + x];
    let nx = (l - r) * EX, nz = (u - d) * EX, ny = 1.0; const k = 1 / Math.hypot(nx, ny, nz); nx *= k; ny *= k; nz *= k;
    nm[i * 4] = (nx * .5 + .5) * 255; nm[i * 4 + 1] = ny * 255; nm[i * 4 + 2] = (nz * .5 + .5) * 255; nm[i * 4 + 3] = 255;
  }
  const nTex = new THREE.DataTexture(nm, HW, HH, THREE.RGBAFormat); nTex.magFilter = THREE.LinearFilter; nTex.minFilter = THREE.LinearMipmapLinearFilter; nTex.generateMipmaps = true; nTex.needsUpdate = true;
  U.nTex = {value: nTex}; U.facTex = {value: tex(fBm, false)}; U.auxTex = {value: tex(aBm, false)};
  U.loTex = {value: tex(lo, true)};
  buildTerrain(); buildOcean(); buildTrees(treesBuf); buildRoads(); buildPlaces(); buildClouds(); buildWind(); buildLabels();
  built = true;
}

// ------------------------------------------------------------ terrain
const TERR_V = `
varying vec2 vW; varying float vH; varying vec3 vP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; vH = position.y; vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const TERR_F = `
uniform sampler2D colTex, nTex, facTex, auxTex; uniform vec4 tileXf; uniform vec3 sun, camPos, fogCol; uniform vec4 hover; uniform float borderVis, time, fogK, ex;
varying vec2 vW; varying float vH; varying vec3 vP;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= .5; } return s; }
float edge(float w){ return smoothstep(.36, .5, w) * (1.0 - smoothstep(.5, .64, w)); }
void main(){
  vec2 uv = vW / vec2(1024.0, 768.0);
  vec3 base = texture2D(colTex, (vW - tileXf.xy) * tileXf.zw).rgb;
  vec3 n = texture2D(nTex, uv).xyz * vec3(2.0, 1.0, 2.0) - vec3(1.0, 0.0, 1.0); n = normalize(n);
  float hk = vH / ex, slope = 1.0 - n.y;
  float nz = fbm(vW * 0.9);
  float det = vn(vW * 7.0) * .5 + vn(vW * 23.0) * .3 + vn(vW * 61.0) * .2;
  base *= .9 + .2 * det;
  // rock & snow on relief
  vec3 rock = mix(vec3(.30,.28,.26), vec3(.52,.49,.45), nz);
  float rk = smoothstep(.10, .38, slope) * smoothstep(.35, 1.1, hk) + smoothstep(1.3, 2.1, hk) * .7;
  base = mix(base, rock, clamp(rk, 0.0, .92));
  float snowLine = mix(2.35, 3.3, smoothstep(.12, .55, uv.y)) + (nz - .5) * .6;
  float sn = smoothstep(snowLine, snowLine + .45, hk) * (1.0 - smoothstep(.35, .7, slope)) * .92;
  base = mix(base, vec3(.93,.95,1.0), sn);
  // light
  float dif = max(dot(n, sun), 0.0);
  float cs = smoothstep(.45, .75, fbm(vW * .012 + vec2(time * .006, time * .002)));      // cloud shadows
  float cav = 1.0 - smoothstep(.2, .7, slope) * .25;
  vec3 col = base * (0.30 + 1.05 * dif * (1.0 - .35 * cs)) * cav + base * vec3(.08,.10,.16) * n.y;
  // underwater seabed darken
  col = mix(col, col * vec3(.55,.75,.85), smoothstep(0.0, -0.3, hk));
  // factions
  vec4 F = vec4(texture2D(facTex, uv).rgb, texture2D(auxTex, uv).r);
  float w = dot(F, hover);
  vec3 hc = hover.x * vec3(1.,.32,.25) + hover.y * vec3(.35,.65,1.) + hover.z * vec3(1.,.85,.3) + hover.w * vec3(.9,.92,1.);
  col = mix(col, col * .7 + hc * .35, smoothstep(.3, .7, w) * .55);
  float e = max(max(edge(F.x), edge(F.y)), max(edge(F.z), edge(F.w)));
  float eh = edge(w);
  col = mix(col, vec3(1.0, .9, .65), e * borderVis * .45);
  col += hc * eh * 1.6;
  // atmosphere
  float dist = length(vP - camPos);
  col = mix(col, fogCol, 1.0 - exp(-dist * fogK));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const chunks = [];
function chunkGeo(cx, cy, S){
  const N = S + 3, pos = new Float32Array(N * N * 3), idx = [];
  const x0 = cx * CH, z0 = cy * CH, st = CH / S;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const ii = Math.min(Math.max(i - 1, 0), S), jj = Math.min(Math.max(j - 1, 0), S);
    const x = x0 + ii * st, z = z0 + jj * st; let y = hAt(x, z) * EX; if (i === 0 || j === 0 || i === N - 1 || j === N - 1) y -= 3;
    const k = (j * N + i) * 3; pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
  }
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++){ const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(N * N > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingSphere(); return g;
}
const tileCache = {};
function tileTex(tx, ty){
  const k = tx + '_' + ty; if (tileCache[k]) return tileCache[k];
  tileCache[k] = {t: null, p: loadImg('c_' + k + '.webp').then((bm) => { tileCache[k].t = tex(bm, true); return tileCache[k].t; }).catch(() => null)};
  return tileCache[k];
}
function buildTerrain(){
  for (let cy = 0; cy < NCY; cy++) for (let cx = 0; cx < NCX; cx++){
    const m = new THREE.ShaderMaterial({vertexShader: TERR_V, fragmentShader: TERR_F, uniforms: {
      colTex: {value: U.loTex.value}, tileXf: {value: new THREE.Vector4(0, 0, 1 / WK, 1 / HK)}, nTex: U.nTex, facTex: U.facTex, auxTex: U.auxTex,
      sun: U.sun, camPos: U.camPos, fogCol: U.fogCol, hover: U.hover, borderVis: U.borderVis, time: U.time, fogK: U.fogK, ex: {value: EX}}});
    const geos = {}; geos[32] = chunkGeo(cx, cy, 32);
    const mesh = new THREE.Mesh(geos[32], m); scene.add(mesh);
    chunks.push({cx, cy, mesh, geos, lod: 32, hi: false, c: new THREE.Vector3(cx * CH + CH / 2, 0, cy * CH + CH / 2)});
  }
}
let geoBudget = 0;
function updateChunks(){
  geoBudget = 2;
  const cp = camera.position;
  for (const c of chunks){
    const dx = Math.max(Math.abs(cp.x - c.c.x) - CH / 2, 0), dz = Math.max(Math.abs(cp.z - c.c.z) - CH / 2, 0), dist = Math.hypot(dx, dz, cp.y);
    const want = dist < 150 ? 256 : dist < 420 ? 96 : 32;
    if (want !== c.lod){
      if (!c.geos[want] && geoBudget > 0){ c.geos[want] = chunkGeo(c.cx, c.cy, want); geoBudget--; }
      if (c.geos[want]){ c.mesh.geometry = c.geos[want]; c.lod = want; }
    }
    const wantHi = dist < 330;
    if (wantHi && !c.hi){
      const tx = c.cx >> 1, ty = c.cy >> 1, t = tileTex(tx, ty); c.hi = true;
      const apply = (tt) => { if (tt && c.hi){ c.mesh.material.uniforms.colTex.value = tt; c.mesh.material.uniforms.tileXf.value.set(tx * 256, ty * 256, 1 / 256, 1 / 256); } };
      if (t.t) apply(t.t); else t.p.then(apply);
    } else if (!wantHi && c.hi && dist > 520){
      c.hi = false; c.mesh.material.uniforms.colTex.value = U.loTex.value; c.mesh.material.uniforms.tileXf.value.set(0, 0, 1 / WK, 1 / HK);
    }
  }
}

// ------------------------------------------------------------ ocean
const OCEAN_F = `
uniform sampler2D auxTex; uniform vec3 sun, camPos, fogCol; uniform float time, fogK; varying vec2 vW; varying vec3 vP;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float waves(vec2 p, float t){
  float s = 0.0; s += vn(p * .35 + vec2(t * .05, t * .03)) * .5; s += vn(p * .9 - vec2(t * .07, -t * .04)) * .3; s += vn(p * 2.3 + vec2(t * .12, t * .1)) * .2;
  return s; }
void main(){
  vec2 uv = vW / vec2(1024.0, 768.0);
  bool inMap = uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0;
  vec3 A = inMap ? texture2D(auxTex, uv).rgb : vec3(0.0, 0.0, 1.0);
  float d = A.b, land = A.g;
  float e = .25; vec2 p = vW; float t = time;
  float w0 = waves(p, t), wx = waves(p + vec2(e, 0.0), t), wz = waves(p + vec2(0.0, e), t);
  float dist = length(vP - camPos); float nearF = 1.0 - smoothstep(120.0, 520.0, dist);
  vec3 n = normalize(vec3((w0 - wx) * .55 * nearF, 1.0, (w0 - wz) * .55 * nearF));
  vec3 deep = vec3(.025, .085, .17), mid = vec3(.05, .20, .30), shallow = vec3(.16, .42, .45);
  vec3 col = mix(shallow, mid, smoothstep(0.0, .12, d)); col = mix(col, deep, smoothstep(.1, .8, d));
  vec3 V = normalize(camPos - vP); vec3 R = reflect(-sun, n);
  float spec = pow(max(dot(R, V), 0.0), 60.0) * .55;
  float fres = pow(1.0 - max(dot(V, n), 0.0), 4.0);
  col += vec3(.45, .6, .75) * fres * .35 + vec3(1.0, .93, .8) * spec;
  col *= .82 + .3 * mix(.5, w0, nearF);
  // coast foam bands
  float km = d * 40.0;
  float band = sin(km * 3.2 - t * 1.1 + vn(vW * .3) * 6.0) * .5 + .5;
  float foam = smoothstep(.72, 1.0, band) * (1.0 - smoothstep(0.2, 2.6, km)) * smoothstep(.35, .7, vn(vW * 1.7 + t * .05));
  foam += (1.0 - smoothstep(0.0, .45, km)) * (.55 + .45 * vn(vW * 4.0 + t * .3));
  foam += smoothstep(.83, .95, waves(p * 1.6, t * 1.3)) * .22 * smoothstep(.05, .3, d) * nearF;     // white caps
  col = mix(col, vec3(.92, .96, .98), clamp(foam, 0.0, 1.0) * .8);
  col = mix(col, fogCol, 1.0 - exp(-dist * fogK));
  float a = mix(.62, 1.0, smoothstep(0.0, .08, d)) * (1.0 - land * .0);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;
function buildOcean(){
  const g = new THREE.PlaneGeometry(7000, 7000, 1, 1); g.rotateX(-Math.PI / 2); g.translate(512, 0, 384);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vW; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xz; vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: OCEAN_F, uniforms: {auxTex: U.auxTex, sun: U.sun, camPos: U.camPos, fogCol: U.fogCol, time: U.time, fogK: U.fogK}});
  const o = new THREE.Mesh(g, m); o.renderOrder = 2; scene.add(o);
}

// ------------------------------------------------------------ geometry builder (merged, vertex coloured)
class GB {
  constructor(){ this.p = []; this.n = []; this.c = []; }
  add(geo, m4, hex){
    const g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(m4); g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array, col = new THREE.Color(hex);
    for (let i = 0; i < P.length; i++){ this.p.push(P[i]); this.n.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) this.c.push(col.r, col.g, col.b);
    return this;
  }
  geo(){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; }
}
const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
const CYL = (seg = 8, top = 1) => new THREE.CylinderGeometry(top, 1, 1, seg).translate(0, .5, 0);
const CONE = (seg = 8) => new THREE.ConeGeometry(1, 1, seg).translate(0, .5, 0);
const PRISM = (() => { const g = new THREE.CylinderGeometry(.5, .5, 1, 3); g.rotateZ(Math.PI / 2); g.rotateX(0); g.scale(1, 1, 1); return g.translate(0, .28, 0); })();
const rnd = (() => { let s = 1414; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function house(b, x, z, s, wall, roof, ry){
  b.add(BOX, M4(x, 0, z, ry, .9 * s, .55 * s, .65 * s), wall);
  b.add(PRISM, M4(x, .55 * s, z, ry, .95 * s, .5 * s, .74 * s), roof);
}
function tower(b, x, z, r, h, wall, roof, seg = 8){ b.add(CYL(seg), M4(x, -0.3, z, 0, r, h + .3, r), wall); b.add(CONE(seg), M4(x, h, z, 0, r * 1.25, r * 2.2, r * 1.25), roof); }
function walls(b, R, n, h, col, tcol, troof){
  for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2, a2 = (i + 1) / n * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R, x2 = Math.cos(a2) * R, z2 = Math.sin(a2) * R;
    const L = Math.hypot(x2 - x, z2 - z); b.add(BOX, M4((x + x2) / 2, -0.3, (z + z2) / 2, -Math.atan2(z2 - z, x2 - x), L, h + .3, .12), col);
    tower(b, x, z, .16, h * 1.6, tcol, troof, 6); }
}
const PAL = {
  human: {wall: 0xd9c9a8, roof: [0xa8442f, 0x8f3a2a, 0xb85a36], stone: 0xb7ab98, troof: 0x46526a},
  blavinken: {wall: 0x6f6a66, roof: [0x2f3035, 0x3b3540, 0x463a3a], stone: 0x5b5753, troof: 0x262230},
  dwarf: {wall: 0x8d8478, roof: [0x5c6d80, 0x4d5a68, 0x6b6157], stone: 0x7a7066, troof: 0x2f5b8f},
  elf: {wall: 0xf3efe2, roof: [0xd8b456, 0x9fbf6a, 0xe0c66f], stone: 0xe8e2d0, troof: 0xd9ad3c},
  halldor: {wall: 0x6e6e74, roof: [0x2a2a30, 0x3a3a42, 0x24242a], stone: 0x5d5d63, troof: 0x15151a},
};
function cityModel(p){
  const b = new GB(), glow = new GB(), st = p.style === 'blavinken' ? 'blavinken' : p.fac === 'none' ? 'human' : p.fac, P = PAL[st] || PAL.human;
  const big = p.kind === 'capital' ? 1.35 : 1;
  const roof = () => P.roof[(rnd() * P.roof.length) | 0];
  if (p.fac === 'elf'){
    const R = 2.6 * big;
    for (let i = 0; i < 26 * big; i++){ const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R, x = Math.cos(a) * r, z = Math.sin(a) * r; const h = (.6 + rnd() * 1.4) * (1.6 - r / R);
      tower(b, x, z, .12 + rnd() * .1, h, P.wall, roof(), 10); }
    tower(b, 0, 0, .34 * big, 3.2 * big, P.wall, P.troof, 12);
    for (let i = 0; i < 4; i++){ const a = i * 1.57 + .4; tower(b, Math.cos(a) * .9 * big, Math.sin(a) * .9 * big, .18, 2.2 * big, P.wall, P.troof, 10); }
    b.add(new THREE.IcosahedronGeometry(1, 1), M4(-1.3 * big, 1.5, .9, 0, 1.1, 1.0, 1.1), 0xc9b04a); b.add(CYL(6), M4(-1.3 * big, -0.2, .9, 0, .15, 1.6, .15), 0x7a5a3a);
    glow.add(new THREE.SphereGeometry(.12, 8, 6), M4(0, 3.2 * big + .9 * big, 0), 0xfff2b0);
  } else if (p.fac === 'dwarf'){
    const R = 2.2 * big;
    b.add(BOX, M4(0, -0.4, 0, 0, 3.2 * big, 1.6 * big, 2.4 * big), P.stone);                      // hall terrace
    b.add(BOX, M4(0, 1.2 * big, -.3, 0, 2.2 * big, 1.0 * big, 1.6 * big), P.wall);
    b.add(PRISM, M4(0, 2.2 * big, -.3, 0, 2.3 * big, .8, 1.7 * big), P.troof);
    b.add(BOX, M4(-.55, -0.2, 1.25 * big, 0, .35, 2.2 * big, .4), P.stone); b.add(BOX, M4(.55, -0.2, 1.25 * big, 0, .35, 2.2 * big, .4), P.stone);   // gate
    b.add(BOX, M4(0, 1.9 * big, 1.25 * big, 0, 1.6, .35, .5), P.stone);
    glow.add(BOX, M4(0, 0, 1.38 * big, 0, .7, 1.7 * big, .05), 0xff8a2a);
    const nT = p.style === 'towers' ? 7 : 4;
    for (let i = 0; i < nT; i++){ const a = i / nT * 6.283 + .3, r = R * (.9 + rnd() * .3); b.add(BOX, M4(Math.cos(a) * r, -0.3, Math.sin(a) * r, a, .45, (p.style === 'towers' ? 3.4 : 1.6) + rnd(), .45), P.wall);
      b.add(CONE(4), M4(Math.cos(a) * r, (p.style === 'towers' ? 3.1 : 1.3) + .4, Math.sin(a) * r, a + .785, .42, .7, .42), P.troof); }
    for (let i = 0; i < 10 * big; i++){ const a = rnd() * 6.283, r = R * (.6 + rnd() * .8); house(b, Math.cos(a) * r, Math.sin(a) * r, .45, P.wall, roof(), a); }
    for (let i = 0; i < 3; i++){ const x = (rnd() - .5) * 2, z = -1 + rnd(); b.add(CYL(6), M4(x, 1.5, z, 0, .1, 1.6, .1), 0x4b443d); glow.add(CYL(6), M4(x, 3.08, z, 0, .07, .05, .07), 0xff7a20); }
  } else {
    const R = (p.fac === 'halldor' ? 1.9 : 2.7) * big;
    walls(b, R, p.fac === 'halldor' ? 9 : 14, .45, P.stone, P.stone, P.troof);
    for (let i = 0; i < 46 * big; i++){ const a = rnd() * 6.283, r = .5 + Math.sqrt(rnd()) * (R - .7); house(b, Math.cos(a) * r, Math.sin(a) * r, .38 + rnd() * .18, P.wall, roof(), a + rnd()); }
    if (p.fac === 'halldor'){
      b.add(CYL(7), M4(0, -0.5, 0, 0, 1.0, 1.4, 1.0), 0x4c4c50);
      b.add(BOX, M4(0, .9, 0, 0, 1.1, 1.6, 1.1), P.wall); for (let i = 0; i < 4; i++) tower(b, (i % 2 ? .6 : -.6), (i < 2 ? .6 : -.6), .22, 2.8, P.wall, P.troof, 8);
      tower(b, 0, 0, .3, 3.6, P.wall, P.troof, 8);
    } else {
      b.add(BOX, M4(.2, 0, -.2, .3, .9, 1.0, 1.6), P.stone); b.add(PRISM, M4(.2, 1.0, -.2, .3, 1.0, .9, 1.65), P.troof);            // keep / cathedral
      tower(b, .55, .55, .22, 2.6 * big, P.stone, P.troof, 8); tower(b, -.6, -.4, .3, 1.8 * big, P.stone, P.troof, 8);
      if (st === 'blavinken'){ for (let i = 0; i < 5; i++){ const a = rnd() * 6.283; tower(b, Math.cos(a) * 1.4, Math.sin(a) * 1.4, .12, 1.6 + rnd(), 0x4a4548, 0x1f1b22, 6); }
        for (let i = 0; i < 9; i++){ const a = rnd() * 6.283, r = rnd() * R; glow.add(BOX, M4(Math.cos(a) * r, .2, Math.sin(a) * r, 0, .08, .08, .08), 0x9cff9a); } }
      for (let i = 0; i < 14; i++){ const a = rnd() * 6.283, r = rnd() * R * .9; glow.add(BOX, M4(Math.cos(a) * r, .22, Math.sin(a) * r, 0, .06, .06, .06), 0xffc46a); }
    }
  }
  return {b, glow};
}
function villageModel(p){
  const b = new GB(), P = PAL[p.fac] || PAL.human, n = 6 + (rnd() * 5 | 0);
  for (let i = 0; i < n; i++){ const a = rnd() * 6.283, r = .2 + rnd() * .8, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (p.fac === 'elf'){ b.add(CYL(8), M4(x, 0, z, 0, .14, .22, .14), P.wall); b.add(CONE(8), M4(x, .22, z, 0, .2, .3, .2), 0x8fb35a); }
    else house(b, x, z, .3 + rnd() * .1, P.wall, P.roof[i % P.roof.length], rnd() * 6); }
  if (p.fac !== 'elf') tower(b, 0, 0, .07, .55, P.stone, P.troof, 6);
  return {b, glow: null};
}
function districtModel(p){
  const b = new GB(), glow = new GB(), P = PAL.human;
  if (p.style === 'harbor'){
    for (let i = 0; i < 5; i++) b.add(BOX, M4(-1 + i * .5, -0.2, .8, 0, .12, .28, 1.4), 0x6d553a);
    for (let i = 0; i < 4; i++){ const x = -0.75 + i * .5, z = 1.6 + rnd() * .3; b.add(BOX, M4(x, -0.05, z, 0, .18, .12, .55), 0x5a3d22); b.add(BOX, M4(x, .07, z, 0, .02, .5, .02), 0x3b2a1a); b.add(BOX, M4(x, .22, z, 0, .015, .3, .32), 0xf3ead4); }
    for (let i = 0; i < 10; i++) house(b, (rnd() - .5) * 2.4, (rnd() - .5) * 1.2 - .3, .35, P.wall, P.roof[i % 3], rnd() * 6);
  } else if (p.style === 'gate'){
    tower(b, -.5, 0, .3, 1.4, P.stone, P.troof); tower(b, .5, 0, .3, 1.4, P.stone, P.troof); b.add(BOX, M4(0, .7, 0, 0, 1.0, .5, .4), P.stone);
  } else if (p.style === 'university'){
    b.add(BOX, M4(0, 0, 0, 0, 1.8, .6, 1.0), 0xe2d6bd); b.add(new THREE.SphereGeometry(.42, 12, 8, 0, 6.283, 0, 1.57), M4(0, .6, 0), 0x6f8aa0);
    tower(b, .85, .4, .14, 1.3, 0xe2d6bd, 0x6f8aa0); tower(b, -.85, .4, .14, 1.3, 0xe2d6bd, 0x6f8aa0);
  } else if (p.style === 'outpost'){
    tower(b, 0, 0, .25, 1.6, 0x6a5f55, 0x2a2430, 6); for (let i = 0; i < 12; i++){ const a = i / 12 * 6.283; b.add(CYL(4), M4(Math.cos(a) * .8, -0.1, Math.sin(a) * .8, 0, .05, .5, .05), 0x5b4630); }
    glow.add(BOX, M4(0, 1.2, .26, 0, .1, .1, .02), 0xb88cff);
  } else {   // industrial district
    for (let i = 0; i < 8; i++){ const x = (rnd() - .5) * 2.2, z = (rnd() - .5) * 1.6; b.add(BOX, M4(x, 0, z, 0, .55, .45, .4), 0x8b8077); b.add(CYL(6), M4(x + .18, .4, z, 0, .06, .7, .06), 0x4a3f3a); glow.add(BOX, M4(x, .2, z + .21, 0, .3, .1, .01), 0xffa040); }
  }
  return {b, glow};
}
function volcanoModel(){
  const b = new GB(), glow = new GB();
  b.add(new THREE.CylinderGeometry(.6, 3.2, 3.4, 18, 1, true).translate(0, 1.5, 0), M4(0, 0, 0), 0x3a2e2a);
  b.add(new THREE.CylinderGeometry(.62, .62, .05, 18).translate(0, 3.1, 0), M4(0, 0, 0), 0x2a1a14);
  glow.add(new THREE.CylinderGeometry(.55, .55, .06, 18).translate(0, 3.14, 0), M4(0, 0, 0), 0xff5a1a);
  for (let i = 0; i < 5; i++){ const a = rnd() * 6.283; glow.add(BOX, M4(Math.cos(a) * 1.4, 1.0, Math.sin(a) * 1.4, a, .06, 1.6, .03), 0xff6a20); }
  return {b, glow};
}
function floatingCity(){
  const g = new THREE.Group(), isl = [];
  const spots = [[0, 0, 4.2], [-7, 3, 2.6], [6, -3, 2.8], [3, 7, 2.2], [-4, -7, 2.0], [9, 5, 1.6], [-10, -2, 1.5]];
  spots.forEach(([x, z, r], k) => {
    const b = new GB(), glow = new GB();
    b.add(new THREE.ConeGeometry(r, r * 2.4, 9).rotateX(Math.PI).translate(0, -r * 1.2, 0), M4(0, 0, 0), 0x6e6255);
    b.add(new THREE.CylinderGeometry(r * 1.02, r * .96, .35, 12).translate(0, -.1, 0), M4(0, 0, 0), 0x7fae5a);
    const n = Math.round(r * 3);
    for (let i = 0; i < n; i++){ const a = rnd() * 6.283, rr = rnd() * r * .7; tower(b, Math.cos(a) * rr, Math.sin(a) * rr, .12 + rnd() * .12, .7 + rnd() * 1.8 * (r / 3), 0xf6f2e8, 0xe9c35a, 10); }
    if (k === 0){ tower(b, 0, 0, .45, 4.6, 0xfbf8f0, 0xf0cf6a, 12); glow.add(new THREE.OctahedronGeometry(.6), M4(0, 6.6, 0), 0x9ff4ff); }
    for (let i = 0; i < 3; i++){ const a = rnd() * 6.283; glow.add(new THREE.OctahedronGeometry(.28), M4(Math.cos(a) * r * .8, -r * .9 - rnd() * .8, Math.sin(a) * r * .8, 0, 1, 2, 1), 0x8fe9ff); }
    const m = new THREE.Mesh(b.geo(), MAT.city); const gm = new THREE.Mesh(glow.geo(), MAT.glow); const s = new THREE.Group(); s.add(m, gm);
    s.position.set(x, 26 + k * 1.3 + rnd() * 3, z); s.userData.ph = rnd() * 6; g.add(s); isl.push(s);
    // waterfall veil
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(.5, 9), MAT.fall); wf.position.set(r * .7, -4.5, 0); wf.rotation.y = rnd() * 3; s.add(wf);
  });
  g.userData.isl = isl; return g;
}
const MAT = {};
const cityObjs = [];
function buildPlaces(){
  MAT.city = new THREE.MeshLambertMaterial({vertexColors: true});
  MAT.glow = new THREE.MeshBasicMaterial({vertexColors: true, toneMapped: false});
  MAT.fall = new THREE.MeshBasicMaterial({color: 0xcdf6ff, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide});
  for (const p of D.places){
    let mdl = null;
    if (p.kind === 'capital' || p.kind === 'city') mdl = cityModel(p);
    else if (p.kind === 'village') mdl = villageModel(p);
    else if (p.kind === 'district' || (p.kind === 'landmark' && p.style !== 'volcano')) mdl = districtModel(p);
    else if (p.style === 'volcano') mdl = volcanoModel();
    if (p.kind === 'floating'){ const g = floatingCity(); g.position.set(p.x, 0, p.z); scene.add(g); cityObjs.push({p, g, float: true, min: 900}); continue; }
    if (!mdl) continue;
    const g = new THREE.Group(); g.add(new THREE.Mesh(mdl.b.geo(), MAT.city)); if (mdl.glow && mdl.glow.p.length) g.add(new THREE.Mesh(mdl.glow.geo(), MAT.glow));
    let y = yAt(p.x, p.z); if (p.style === 'harbor') y = Math.max(y, .05); if (p.style === 'volcano') y = 0;
    g.position.set(p.x, y, p.z); g.rotation.y = rnd() * 6.283 * (p.fac === 'dwarf' ? 0 : 1);
    scene.add(g);
    cityObjs.push({p, g, min: p.kind === 'capital' ? 700 : p.kind === 'city' ? 520 : p.style === 'volcano' ? 700 : 200});
  }
}

// ------------------------------------------------------------ trees (instanced per chunk & type)
const treeSets = [];
function treeGeos(){
  const pine = new GB(); pine.add(CYL(5), M4(0, 0, 0, 0, .05, .25, .05), 0x5a4030); [0, 1, 2].forEach((k) => pine.add(CONE(7), M4(0, .2 + k * .22, 0, k, .34 - k * .08, .45, .34 - k * .08), 0xffffff));
  const leaf = new GB(); leaf.add(CYL(5), M4(0, 0, 0, 0, .05, .35, .05), 0x6a4a30); leaf.add(new THREE.IcosahedronGeometry(1, 0), M4(0, .55, 0, 0, .33, .3, .33), 0xffffff); leaf.add(new THREE.IcosahedronGeometry(1, 0), M4(.12, .72, .05, 1, .22, .2, .22), 0xffffff);
  const dead = new GB(); dead.add(CYL(5, .4), M4(0, 0, 0, 0, .06, .7, .06), 0xffffff); dead.add(CYL(4, .3), M4(.1, .42, 0, 0, .025, .32, .025).multiply(new THREE.Matrix4().makeRotationZ(-.7)), 0xffffff);
  dead.add(CYL(4, .3), M4(-.08, .35, .03, 0, .022, .28, .022).multiply(new THREE.Matrix4().makeRotationZ(.8)), 0xffffff);
  const elf = new GB(); elf.add(CYL(6), M4(0, 0, 0, 0, .05, .5, .05), 0xe8dcc0); elf.add(CONE(8), M4(0, .35, 0, 0, .22, 1.0, .22), 0xffffff); elf.add(new THREE.IcosahedronGeometry(1, 0), M4(0, .55, 0, 0, .28, .25, .28), 0xffffff);
  return [pine.geo(), leaf.geo(), dead.geo(), elf.geo()];
}
const TREE_COL = [[0x2f5a3a, 0x3d6b44, 0x2a4d38], [0x5b8a3c, 0x6f9a44, 0x4c7a36, 0x88a24a], [0x4a3d36, 0x3a302c, 0x56483e], [0xd6c25a, 0xb8cc6a, 0xe0b24e]];
function buildTrees(buf){
  const dv = new DataView(buf), n = buf.byteLength / 6, G = treeGeos();
  const mat = new THREE.MeshLambertMaterial({vertexColors: true});
  mat.onBeforeCompile = (sh) => { sh.uniforms.time = U.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3; transformed.x += sin(time * 1.6 + ph) * .035 * position.y; transformed.z += cos(time * 1.3 + ph) * .02 * position.y;'); };
  // blend instance colour with vertex colour (trunks keep vertex colour because white parts take instance colour)
  const bins = {};
  for (let i = 0; i < n; i++){ const x = dv.getUint16(i * 6, true) / 65535 * WK, z = dv.getUint16(i * 6 + 2, true) / 65535 * HK, t = dv.getUint8(i * 6 + 4), s = dv.getUint8(i * 6 + 5) / 100;
    const k = ((z / CH) | 0) * NCX + ((x / CH) | 0) + t * 1000; (bins[k] = bins[k] || []).push(x, z, s); }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const k in bins){
    const t = (k / 1000) | 0, arr = bins[k], cnt = arr.length / 3, im = new THREE.InstancedMesh(G[t], mat, cnt);
    for (let i = 0; i < cnt; i++){ const x = arr[i * 3], z = arr[i * 3 + 1], s = arr[i * 3 + 2] * .62; e.set((rnd() - .5) * .12, rnd() * 6.28, 0); q.setFromEuler(e);
      v.set(x, yAt(x, z) - .03, z); sc.set(s, s * (t === 0 ? 1.15 : 1), s); m.compose(v, q, sc); im.setMatrixAt(i, m);
      const P = TREE_COL[t]; c.setHex(P[(rnd() * P.length) | 0]); c.offsetHSL(0, 0, (rnd() - .5) * .06); im.setColorAt(i, c); }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.visible = false; scene.add(im); treeSets.push(im);
  }
  // white vertex colours act as "take instance colour"; trunks are coloured -> multiply looks fine
}

// ------------------------------------------------------------ roads & trade routes (ribbons draped on terrain)
const routeMats = [];
function ribbon(pts, w, lift, sea){
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++){ const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / .35));
    for (let k = 0; k < n; k++){ const t = k / n; dense.push([ax + (bx - ax) * t, az + (bz - az) * t]); } }
  dense.push(pts[pts.length - 1]);
  const pos = [], uv = [], idx = []; let acc = 0;
  for (let i = 0; i < dense.length; i++){
    const a = dense[Math.max(i - 1, 0)], b = dense[Math.min(i + 1, dense.length - 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i) acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    const [x, z] = dense[i]; const y = sea ? .06 : Math.max(yAt(x, z), .02) + lift;
    pos.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w); uv.push(acc, 0, acc, 1);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
function routeMat(kind){
  const col = kind === 'trade' ? new THREE.Color(0xf2c661) : kind === 'sea' ? new THREE.Color(0xbfe6ff) : new THREE.Color(0x6b5236);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: {col: {value: col}, time: U.time, op: {value: 1}, kind: {value: kind === 'trade' ? 1 : kind === 'sea' ? 2 : 0}},
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 col; uniform float time, op, kind; varying vec2 vU;
      void main(){ float side = 1.0 - abs(vU.y * 2.0 - 1.0); float a = smoothstep(0.0, .45, side);
        float dash = kind > 1.5 ? step(.5, fract(vU.x * .45 - time * .25)) : kind > .5 ? .55 + .45 * step(.45, fract(vU.x * .35 - time * .35)) : .55 + .45 * step(.35, fract(vU.x * 1.2));
        vec3 c = col * (kind > .5 ? 1.0 + .4 * step(.45, fract(vU.x * .35 - time * .35)) : 1.0);
        gl_FragColor = vec4(c, a * dash * op * (kind > 1.5 ? .65 : .9));
#include <colorspace_fragment>
}`});
  routeMats.push({m, kind}); return m;
}
function buildRoads(){
  const mats = {road: routeMat('road'), trade: routeMat('trade'), sea: routeMat('sea')};
  for (const r of D.roads){ const w = r.t === 'trade' ? .13 : r.t === 'sea' ? .22 : .075; const mesh = new THREE.Mesh(ribbon(r.p, w, .06, r.t === 'sea'), mats[r.t]); mesh.renderOrder = 3; scene.add(mesh); }
}

// ------------------------------------------------------------ clouds & wind
const clouds = []; let windG;
function cloudTex(seed){
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 46; i++){ const px = 128 + (r() - .5) * 150, py = 128 + (r() - .5) * 70, rad = 22 + r() * 46;
    const g = x.createRadialGradient(px, py - rad * .2, 0, px, py, rad); const sh = 235 - (py > 140 ? 40 : 0) * r();
    g.addColorStop(0, `rgba(${sh},${sh},${sh + 8},.55)`); g.addColorStop(.6, `rgba(${sh - 20},${sh - 18},${sh - 5},.22)`); g.addColorStop(1, 'rgba(200,205,220,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 6.283); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildClouds(){
  const texs = [1, 2, 3, 4, 5].map(cloudTex);
  for (let i = 0; i < 46; i++){
    const m = new THREE.SpriteMaterial({map: texs[i % 5], transparent: true, depthWrite: false, opacity: .8, fog: false});
    const s = new THREE.Sprite(m); const sz = 90 + rnd() * 150; s.scale.set(sz, sz * .5, 1);
    s.position.set(-150 + rnd() * 1300, 34 + rnd() * 40, -100 + rnd() * 1000); s.userData = {sz, base: .35 + rnd() * .3, sp: .6 + rnd() * .6};
    s.renderOrder = 10; scene.add(s); clouds.push(s);
  }
  // low cloud bank under Luminaraeth
  const lp = D.places.find((p) => p.kind === 'floating');
  if (lp) for (let i = 0; i < 9; i++){ const m = new THREE.SpriteMaterial({map: texs[i % 5], transparent: true, depthWrite: false, opacity: .85}); const s = new THREE.Sprite(m);
    const sz = 12 + rnd() * 14; s.scale.set(sz, sz * .5, 1); s.position.set(lp.x + (rnd() - .5) * 26, 14 + rnd() * 5, lp.z + (rnd() - .5) * 22); s.userData = {sz, base: .9, sp: .15, fixed: true, ox: s.position.x}; s.renderOrder = 9; scene.add(s); clouds.push(s); }
}
function buildWind(){
  const n = 90, pos = new Float32Array(n * 4 * 3), uv = new Float32Array(n * 4 * 2), seed = new Float32Array(n * 4), idx = [];
  for (let i = 0; i < n; i++){ const x = rnd() * WK, z = rnd() * HK, y = 4 + rnd() * 14, L = 10 + rnd() * 20, s = rnd() * 100;
    for (let k = 0; k < 4; k++){ const u = k & 1, v = k >> 1; pos.set([x + u * L, y, z + (v - .5) * .5], (i * 4 + k) * 3); uv.set([u, v], (i * 4 + k) * 2); seed[i * 4 + k] = s; }
    const o = i * 4; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {time: U.time, op: {value: 1}},
    vertexShader: `attribute float seed; uniform float time; varying vec2 vU; varying float vA;
      void main(){ vec3 p = position; float cyc = fract(time * .05 + seed * .37); p.x += cyc * 60.0 - 30.0; p.z += sin(time * .3 + seed) * 3.0; p.y += sin(p.x * .08 + time) * .6;
        vA = sin(cyc * 3.14159); vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'uniform float op; varying vec2 vU; varying float vA; void main(){ float a = sin(vU.x * 3.14159) * (1.0 - abs(vU.y * 2.0 - 1.0)); gl_FragColor = vec4(vec3(1.0), a * vA * .22 * op); }'});
  windG = new THREE.Mesh(g, m); windG.frustumCulled = false; windG.renderOrder = 11; scene.add(windG);
}

// ------------------------------------------------------------ labels
const labels = [];
function buildLabels(){
  const FC = D.factions;
  for (const k in FC){ const f = FC[k]; labels.push({type: 'fac', key: k, x: f.x, z: f.z, y: 4, pri: 100, el: mk('m3l m3l-fac m3l-' + k, f.name.toLocaleUpperCase('tr-TR'))}); }
  for (const p of D.places){
    const big = p.kind === 'capital', city = p.kind === 'city' || p.kind === 'floating';
    const nat = ['forest', 'lake', 'river', 'hills', 'islands', 'swamp', 'plains'].includes(p.kind);
    const cls = 'm3l ' + (big ? 'm3l-cap' : city ? 'm3l-city' : nat ? 'm3l-nat m3l-' + p.kind : p.kind === 'village' ? 'm3l-vil' : 'm3l-poi') + ' f-' + p.fac;
    const txt = (big ? '<i>✦</i>' : '') + esc(p.name);
    let y = p.kind === 'floating' ? 34 : yAt(p.x, p.z) + (big ? 5 : city ? 4 : nat ? 1 : 1.6);
    const maxD = big ? 760 : city ? 560 : p.kind === 'islands' || p.kind === 'lake' && /Thyra/.test(p.name) ? 420 : nat ? 300 : p.kind === 'village' ? 190 : 150;
    labels.push({type: 'place', p, x: p.x, z: p.z, y, pri: big ? 90 : city ? 80 : nat ? 40 : p.kind === 'village' ? 30 : 35, maxD, el: mk(cls, txt)});
  }
  labels.forEach((l) => { labelsEl.appendChild(l.el); l.el._l = l; });
  function mk(cls, html){ const e = document.createElement('button'); e.type = 'button'; e.className = cls; e.innerHTML = html; return e; }
}
const _v = new THREE.Vector3();
function updateLabels(){
  const w = cv.clientWidth, h = cv.clientHeight, d = cam.d, placed = [];
  const facVis = d > 260, facOp = Math.min(1, (d - 260) / 160);
  const order = labels.slice().sort((a, b) => b.pri - a.pri);
  for (const l of order){
    let vis = l.type === 'fac' ? facVis : d < l.maxD && !(d > 700 && l.p.kind !== 'capital');
    if (vis){
      _v.set(l.x, l.y, l.z).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1 || _v.y < -1.1 || _v.y > 1.1) vis = false;
      else {
        const sx = (_v.x * .5 + .5) * w, sy = (-_v.y * .5 + .5) * h;
        if (!l.w){ l.w = l.el.offsetWidth || 80; l.h = l.el.offsetHeight || 18; }
        const r = {x0: sx - l.w / 2 - 3, x1: sx + l.w / 2 + 3, y0: sy - l.h / 2 - 2, y1: sy + l.h / 2 + 2};
        if (l.type !== 'fac' && placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) vis = false;
        else { placed.push(r); l.el.style.transform = `translate(${(sx - l.w / 2).toFixed(1)}px,${(sy - l.h / 2).toFixed(1)}px)`; }
      }
    }
    if (l.type === 'fac') l.el.style.opacity = vis ? facOp : 0;
    l.el.classList.toggle('on', vis);
  }
}

// ------------------------------------------------------------ cards
function TC(){ return window.__ulv && window.__ulv.TagCard; }
function tagType(tag){ const I = window.TAGINFO || {}; return (I[tag] && I[tag].t) || 'p'; }
function openCard(html){ cardEl.querySelector('.m3d-ci').innerHTML = html; cardEl.hidden = false; requestAnimationFrame(() => cardEl.classList.add('on')); cardEl.querySelector('.m3d-ci').scrollTop = 0; }
function closeCard(){ cardEl.classList.remove('on'); setTimeout(() => { if (!cardEl.classList.contains('on')) cardEl.hidden = true; }, 260); U.hover.value.set(0, 0, 0, 0); pinFac = null; }
let gal = null;
function photoHtml(ph){
  if (!ph || !ph.length) return ''; gal = ph;
  return '<div class="m3c-ph" data-i="0"><img src="' + esc(ph[0].f) + '" alt="' + esc(ph[0].cap || '') + '" loading="lazy">' + (ph.length > 1 ? '<button type="button" class="m3c-nav p" aria-label="Önceki görsel">‹</button><button type="button" class="m3c-nav n" aria-label="Sonraki görsel">›</button><span class="m3c-cnt">1 / ' + ph.length + '</span>' : '') +
    '<button type="button" class="m3c-zoom" aria-label="Görseli büyüt" title="Büyüt">⤢</button>' + (ph[0].cap ? '<span class="m3c-cap">' + esc(ph[0].cap) + '</span>' : '') + '</div>';
}
const FAC_LABEL = (k) => (D.factions[k] ? D.factions[k].name : 'Bağımsız / doğa');
function showPlace(p){
  const F = D.factions[p.fac];
  let h = photoHtml(p.ph) + '<div class="m3c-b"><div class="m3c-k">' + (KIND_TR[p.kind] || 'Yer') + (F ? ' · <span class="f-' + p.fac + '">' + esc(F.name) + '</span>' : '') + '</div><h2>' + esc(p.name) + '</h2>';
  if (p.sub) h += '<div class="m3c-s">' + esc(p.sub) + '</div>';
  h += '<div class="m3c-rule"><i></i><b>✦</b><i></i></div>';
  if (p.desc && p.desc.length) p.desc.forEach((d) => { h += '<p>' + esc(d) + '</p>'; });
  else if (p.note) h += '<p>' + esc(p.note) + '</p>';
  else h += '<p class="m3c-none">Arşivde bu yer için henüz ayrıntılı bir kayıt yok.</p>';
  if (p.facts && p.facts.length){ h += '<dl>'; p.facts.forEach((f) => { h += '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }); h += '</dl>'; }
  h += '<div class="m3c-acts">';
  if (p.tag) h += '<button type="button" class="m3c-btn gold" data-tag="' + esc(p.tag) + '" data-tt="' + tagType(p.tag) + '">Etiket kartını aç</button>';
  if (F) h += '<button type="button" class="m3c-btn" data-fac="' + p.fac + '">' + esc(F.name) + '</button>';
  h += '<button type="button" class="m3c-btn" data-fly="' + p.id + '">Yakınlaş</button></div>';
  if (p.links && p.links.length){ h += '<div class="m3c-h">Bağlantılı etiketler</div><ul class="m3c-tags">'; p.links.forEach((l) => { const n = Array.isArray(l) ? l[0] : l, t = Array.isArray(l) ? l[1] : tagType(n); h += '<li><button type="button" class="t-' + t + '" data-tag="' + esc(n) + '" data-tt="' + t + '">' + esc(n) + '</button></li>'; }); h += '</ul>'; }
  h += '<p class="m3c-co">Konum: ' + Math.round(p.x) + ' km doğu, ' + Math.round(p.z) + ' km güney (kıtanın kuzeybatı köşesinden)</p>';
  openCard(h + '</div>');
}
let pinFac = null;
function showFaction(k){
  const F = D.factions[k]; if (!F) return; pinFac = k; setHover(k);
  const mine = D.places.filter((p) => p.fac === k);
  const grp = (kinds, title) => { const L = mine.filter((p) => kinds.includes(p.kind)); if (!L.length) return ''; return '<div class="m3c-h">' + title + ' <span>' + L.length + '</span></div><ul class="m3c-list">' + L.map((p) => '<li><button type="button" data-pl="' + p.id + '">' + (p.kind === 'capital' ? '✦ ' : '') + esc(p.name) + '</button></li>').join('') + '</ul>'; };
  let h = '<div class="m3c-b"><div class="m3c-k">Faction · Horaghfus</div><h2 class="f-' + k + '">' + esc(F.name) + '</h2><div class="m3c-s">Başkent: ' + esc(F.cap) + ' · yaklaşık ' + (Math.round(F.area / 1000) * 1000).toLocaleString('tr-TR') + ' km²</div><div class="m3c-rule"><i></i><b>✦</b><i></i></div>';
  const I = (window.TAGINFO || {})[F.tag]; const bio = I && (I.bio || I.desc); if (F.note) h += '<p>' + esc(F.note) + '</p>'; if (bio && bio.length) h += '<p>' + esc(Array.isArray(bio) ? bio[0] : bio) + '</p>';
  h += '<div class="m3c-acts"><button type="button" class="m3c-btn gold" data-tag="' + esc(F.tag) + '" data-tt="' + F.tt + '">Etiket kartını aç</button></div>';
  h += grp(['capital', 'city', 'floating'], 'Şehirler') + grp(['village'], 'Köyler') + grp(['district', 'landmark'], 'Önemli yerler') + grp(['islands'], 'Adalar');
  openCard(h + '</div>');
}
function onCardClick(e){
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tag){ const tc = TC(); if (tc) tc.open(t.dataset.tt || 'p', t.dataset.tag, t); return; }
  if (t.dataset.fac){ const F = D.factions[t.dataset.fac]; flyTo(F.x, F.z, 560); showFaction(t.dataset.fac); return; }
  if (t.dataset.fly || t.dataset.pl){ const p = D.places.find((q) => q.id === (t.dataset.fly || t.dataset.pl)); if (p){ flyPlace(p); showPlace(p); } return; }
  if (t.classList.contains('m3c-nav') && gal){ const box = t.closest('.m3c-ph'); let i = (+box.dataset.i + (t.classList.contains('n') ? 1 : -1) + gal.length) % gal.length; box.dataset.i = i;
    box.querySelector('img').src = gal[i].f; const c = box.querySelector('.m3c-cnt'); if (c) c.textContent = (i + 1) + ' / ' + gal.length; const cp = box.querySelector('.m3c-cap'); if (cp) cp.textContent = gal[i].cap || ''; return; }
  if (t.classList.contains('m3c-zoom') && gal){ const i = +t.closest('.m3c-ph').dataset.i; const z = document.createElement('div'); z.className = 'm3d-zoom';
    z.innerHTML = '<img src="' + esc(gal[i].f) + '" alt="">' + (gal[i].cap ? '<span>' + esc(gal[i].cap) + '</span>' : ''); z.addEventListener('click', () => z.remove()); root.appendChild(z); }
}
function flyPlace(p){ const d = p.kind === 'capital' || p.kind === 'city' ? 34 : p.kind === 'floating' ? 60 : ['forest', 'hills', 'plains', 'islands'].includes(p.kind) ? 110 : 22; flyTo(p.x, p.z + (p.kind === 'floating' ? 0 : 0), d); }
function onLabelClick(e){
  const el = e.target.closest('.m3l'); if (!el || !el._l) return; const l = el._l;
  if (l.type === 'fac'){ const F = D.factions[l.key]; flyTo(F.x, F.z, 560); showFaction(l.key); }
  else { flyPlace(l.p); showPlace(l.p); }
}

// ------------------------------------------------------------ camera & input
function tiltFor(d){ const t = Math.min(Math.max((Math.log(d) - Math.log(DMIN)) / (Math.log(DMAX) - Math.log(DMIN)), 0), 1); return (34 + 44 * Math.pow(t, .8)) * Math.PI / 180; }
function applyCam(){
  const pitch = Math.min(Math.max(tiltFor(cam.d) + cam.tilt, .3), 1.45), ty = Math.max(hAt(cam.x, cam.z), 0) * EX * Math.min(1, 120 / cam.d);
  const cy = Math.sin(pitch) * cam.d, ch = Math.cos(pitch) * cam.d;
  camera.position.set(cam.x - Math.sin(cam.yaw) * ch, ty + cy, cam.z + Math.cos(cam.yaw) * ch);
  const minY = yAt(camera.position.x, camera.position.z) + 1.2; if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(cam.x, ty, cam.z); camera.updateMatrixWorld(); U.camPos.value.copy(camera.position);
}
function flyTo(x, z, d){ goal.x = x; goal.z = z; goal.d = d; flying = 1; }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function groundAt(cx, cy, planeY = 0){
  const r = cv.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, dvec = ray.ray.direction; if (dvec.y > -1e-4) return null; const t = (planeY - o.y) / dvec.y; return {x: o.x + dvec.x * t, z: o.z + dvec.z * t};
}
function pickTerrain(cx, cy){
  const r = cv.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, dv = ray.ray.direction, step = Math.max(cam.d / 300, .2);
  for (let t = 0; t < cam.d * 4; t += step){ const x = o.x + dv.x * t, y = o.y + dv.y * t, z = o.z + dv.z * t; if (y <= yAt(x, z)) return {x, z}; if (y < -1) return {x, z}; }
  return null;
}
function setHover(k){ const id = k ? D.factions[k].id : 0; U.hover.value.set(id === 1 ? 1 : 0, id === 2 ? 1 : 0, id === 3 ? 1 : 0, id === 4 ? 1 : 0);
  labels.forEach((l) => { if (l.type === 'fac') l.el.classList.toggle('hov', l.key === k); }); }
const FKEY = [null, 'human', 'dwarf', 'elf', 'halldor'];
function bindInput(){
  let drag = null, moved = 0;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); moved = 0; flying = 0;
    const rot = e.button === 2 || e.ctrlKey || e.shiftKey;
    drag = {rot, x: e.clientX, y: e.clientY, g: rot ? null : groundAt(e.clientX, e.clientY, Math.max(hAt(cam.x, cam.z), 0) * EX * Math.min(1, 120 / cam.d))};
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag){ hoverAt(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
    if (drag.rot){ cam.yaw += dx * .005; cam.tilt = Math.min(Math.max(cam.tilt - dy * .004, -.5), .55); goal.yaw = cam.yaw; goal.tilt = cam.tilt; drag.x = e.clientX; drag.y = e.clientY; }
    else if (drag.g){ const g = groundAt(e.clientX, e.clientY, Math.max(hAt(cam.x, cam.z), 0) * EX * Math.min(1, 120 / cam.d)); if (g){ cam.x += drag.g.x - g.x; cam.z += drag.g.z - g.z; clampCam(cam); goal.x = cam.x; goal.z = cam.z; applyCam(); } }
    dirtyLabels = true;
  });
  const up = (e) => { if (!drag) return; const was = drag; drag = null; if (moved < 5 && !was.rot) clickAt(e.clientX, e.clientY); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault(); flying = 0;
    const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * .0022), nd = Math.min(Math.max(goal.d * k, DMIN), DMAX);
    const g = groundAt(e.clientX, e.clientY);
    if (g){ const f = 1 - nd / goal.d; goal.x += (g.x - goal.x) * f * .9; goal.z += (g.z - goal.z) * f * .9; clampCam(goal); }
    goal.d = nd;
  }, {passive: false});
}
function clampCam(o){ o.x = Math.min(Math.max(o.x, -60), WK + 60); o.z = Math.min(Math.max(o.z, -60), HK + 60); }
let hovK = null;
function hoverAt(x, y){
  if (pinFac || cam.d < 260){ if (hovK && !pinFac){ hovK = null; setHover(null); } cv.style.cursor = ''; return; }
  const p = pickTerrain(x, y); const k = p ? FKEY[facAt(p.x, p.z)] : null;
  if (k !== hovK){ hovK = k; setHover(k); } cv.style.cursor = k ? 'pointer' : '';
}
function clickAt(x, y){
  if (cam.d < 260) return;
  const p = pickTerrain(x, y); const k = p ? FKEY[facAt(p.x, p.z)] : null;
  if (k){ const F = D.factions[k]; flyTo(F.x, F.z, 560); showFaction(k); } else if (pinFac) closeCard();
}

// ------------------------------------------------------------ frame
function frame(now){
  raf = requestAnimationFrame(frame);
  const dt = Math.min((now - (lastT || now)) / 1000, .05); lastT = now; clock += dt; U.time.value = clock;
  const r = 1 - Math.exp(-dt * (flying ? 2.6 : 9));
  const ld = Math.log(cam.d) + (Math.log(goal.d) - Math.log(cam.d)) * r;
  const moving = Math.abs(goal.x - cam.x) + Math.abs(goal.z - cam.z) + Math.abs(goal.d - cam.d) > .01;
  cam.x += (goal.x - cam.x) * r; cam.z += (goal.z - cam.z) * r; cam.d = Math.exp(ld);
  if (flying && !moving) flying = 0;
  applyCam(); updateChunks();
  // zoom-dependent layers
  const d = cam.d;
  U.borderVis.value = Math.min(1, Math.max(0, (d - 200) / 250)) * .9;
  U.fogK.value = .00035 + .0009 * (1 - Math.min(1, d / 900));
  for (const t of treeSets) t.visible = d < 240;
  for (const o of cityObjs){ o.g.visible = d < o.min; const s = Math.min(Math.max(d / 60, 1), 3.2); if (!o.float) o.g.scale.setScalar(o.p.kind === 'village' || o.p.kind === 'district' || o.p.kind === 'landmark' ? Math.min(s, 2.2) : s);
    if (o.float) o.g.userData.isl.forEach((s2) => { s2.position.y += Math.sin(clock * .6 + s2.userData.ph) * .004; s2.rotation.y += dt * .01; }); }
  routeMats.forEach(({m, kind}) => { m.uniforms.op.value = kind === 'road' ? Math.min(1, Math.max(0, (330 - d) / 140)) : kind === 'trade' ? Math.min(1, Math.max(.35, (800 - d) / 300)) : Math.min(1, Math.max(.3, (900 - d) / 300)); });
  const camY = camera.position.y;
  for (const c of clouds){
    const u = c.userData; if (!u.fixed){ c.position.x += dt * 1.6 * u.sp; c.position.z += dt * .5 * u.sp; if (c.position.x > WK + 200) c.position.x = -200; if (c.position.z > HK + 150) c.position.z = -150; }
    else c.position.x = u.ox + Math.sin(clock * .05 + u.sz) * 2;
    const near = c.position.distanceTo(camera.position);
    const altF = u.fixed ? 1 : Math.min(1, Math.max(0, (camY - 90) / 160));
    c.material.opacity = u.base * altF * Math.min(1, Math.max(0, (near - u.sz * .35) / (u.sz * .6)));
    c.visible = c.material.opacity > .01;
  }
  if (windG) windG.material.uniforms.op.value = Math.min(1, Math.max(0, (d - 30) / 80)) * Math.min(1, Math.max(0, (500 - d) / 200));
  renderer.render(scene, camera);
  updateLabels();
  // scale bar
  const g1 = groundAt(innerWidth / 2 - 50, innerHeight * .9), g2 = groundAt(innerWidth / 2 + 50, innerHeight * .9);
  if (g1 && g2){ const km100 = Math.hypot(g2.x - g1.x, g2.z - g1.z); const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((n) => n / km100 * 100 > 60) || 500;
    scaleEl.querySelector('i').style.width = (nice / km100 * 100).toFixed(0) + 'px'; scaleEl.querySelector('span').textContent = nice + ' km'; }
}
function resize(){ if (!renderer) return; const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); labels.forEach((l) => { l.w = 0; }); }

// ------------------------------------------------------------ open / close
export async function open(){
  if (!root){ makeDom(); window.addEventListener('resize', () => isOpen && resize()); }
  if (isOpen) return; isOpen = true;
  root.hidden = false; document.body.classList.add('m3d-open'); requestAnimationFrame(() => root.classList.add('on'));
  if (window.__ulvAudioHold) window.__ulvAudioHold(true);
  try {
    if (!built){ if (!building) building = build(); await building; }
    loadEl.classList.add('done'); resize(); applyCam();
    if (!raf){ lastT = 0; raf = requestAnimationFrame(frame); }
    setTimeout(() => hintEl.classList.add('fade'), 7000);
  } catch (err){
    console.warn('3D map failed', err); loadEl.classList.add('err'); loadEl.querySelector('p').textContent = '3D harita yüklenemedi (WebGL gerekli). Sayfayı yenileyip tekrar dene ya da 2D haritayı kullan.';
  }
}
export function close(){
  if (!isOpen) return; isOpen = false; root.classList.remove('on'); document.body.classList.remove('m3d-open');
  if (raf){ cancelAnimationFrame(raf); raf = 0; }
  setTimeout(() => { if (!isOpen) root.hidden = true; }, 380);
  setTimeout(() => { if (!isOpen && window.__ulvAudioHold) window.__ulvAudioHold(false); }, 350);
}
window.__ulvMap3D = {open, close, fly: flyTo, jump: (x, z, d) => { flyTo(x, z, d); Object.assign(cam, goal); flying = 0; }, cam: () => ({...cam}), stats: () => renderer ? {calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures} : null, continents: CONTINENTS};
