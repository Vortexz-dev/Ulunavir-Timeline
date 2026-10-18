// t141 — Horaghfus 3D haritası (v2). three.js r169 (assets/vendor/three), derleme adımı yok.
// Dünya birimi: 1 = 1 km. Kıta: 1024 x 768 km. Yükseklikler EX kat abartılı.
// Veriler: assets/map3d/ (site-build/map3d/v2/*.py ile üretilir). Yer adları/açıklamaları: assets/map3d/yerler.json (elle düzenlenebilir).
import * as THREE from './vendor/three/three.module.min.js';

const V = new URL(import.meta.url).searchParams.get('v') || '1';
const BASE = new URL('./map3d/', import.meta.url).href;
const url = (f) => BASE + f + '?v=' + V;
let EX = 3.0;                        // dikey abartı (meta.json'dan)
const WK = 1024, HK = 768;           // dünya boyutu (km)
const CH = 128, NCX = 8, NCY = 6, SEG = 256;   // arazi parçaları: hepsi tam çözünürlük (LOD geçişi yok)
const DMIN = 4, DMAX = 1150;
const NEAR_T = 8.5;                  // bu mesafeye kadar ağaçlar gerçek 3D model
const NEAR_B = 75;                   // bu mesafeye kadar binalar ayrıntılı model
const CONTINENTS = [{id: 'horaghfus', name: 'Horaghfus', ox: 0, oz: 0}];
const KIND_TR = {capital: 'Başkent', city: 'Şehir', village: 'Köy', district: 'Şehir semti', landmark: 'Önemli yer', forest: 'Orman', lake: 'Göl', river: 'Nehir',
  hills: 'Tepeler', islands: 'Adalar', swamp: 'Bataklık', plains: 'Düzlük', floating: 'Uçan şehir', fortline: 'Sınır kaleleri'};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

let root, cv, renderer, scene, camera, labelsEl, cardEl, loadEl, hintEl, scaleEl;
let D = null, HGT = null, HW = 2048, HH = 1536, FAC = null, META = null, MODELS = null, MBUF = null;
let built = false, building = null, isOpen = false, raf = 0, lastT = 0, clock = 0;
const SUN = new THREE.Vector3(-0.78, 0.52, 0.2).normalize();
const U = {time: {value: 0}, sun: {value: SUN}, hover: {value: new THREE.Vector4(0, 0, 0, 0)}, borderVis: {value: 1}, camPos: {value: new THREE.Vector3()},
  fogCol: {value: new THREE.Color(0.58, 0.70, 0.84)}, fogK: {value: 0.0012}, hazeK: {value: 1}, sunCol: {value: new THREE.Color(1.0, 0.93, 0.82).multiplyScalar(2.1)},
  skyCol: {value: new THREE.Color(0.42, 0.55, 0.75)}, gndCol: {value: new THREE.Color(0.30, 0.27, 0.22)}, ex: {value: 3.0}, camD: {value: 1000},
  shMap: {value: null}, shMat: {value: new THREE.Matrix4()}, shOn: {value: 0}, nearT: {value: NEAR_T}, pxK: {value: 600}};
const cam = {x: 512, z: 400, d: 1000, yaw: 0, tilt: 0};
const goal = {x: 512, z: 400, d: 1000, yaw: 0, tilt: 0};
let flying = 0;

// ------------------------------------------------------------ utils
function hAt(x, z){
  if (!HGT) return 0;
  const fx = Math.min(Math.max(x * 2 - .5, 0), HW - 1.001), fz = Math.min(Math.max(z * 2 - .5, 0), HH - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * HW + ix;
  return (HGT[i] * (1 - tx) + HGT[i + 1] * tx) * (1 - tz) + (HGT[i + HW] * (1 - tx) + HGT[i + HW + 1] * tx) * tz;
}
// exact height of the rendered terrain mesh (same triangulation as chunkGeo) -> objects sit on the ground
let VH = null, VW = 0;   // vertex heights (grid every 0.5 km, shared by mesh + object placement)
function yMesh(x, z){
  if (!VH) return 0;
  const fx = Math.min(Math.max(x * 2, 0), VW - 1.001), fz = Math.min(Math.max(z * 2, 0), HH - .001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
  const g = (i, j) => VH[Math.min(j, HH) * VW + Math.min(i, VW - 1)];
  const a = g(ix, iz), b = g(ix + 1, iz), c = g(ix, iz + 1), d = g(ix + 1, iz + 1);
  const h = (tx + tz <= 1) ? a + (b - a) * tx + (c - a) * tz : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  return h;
}
const yAt = (x, z) => Math.max(yMesh(x, z), 0);
function facAt(x, z){ if (!FAC) return 0; const ix = Math.min(Math.max(x * 2 | 0, 0), HW - 1), iz = Math.min(Math.max(z * 2 | 0, 0), HH - 1); return FAC[iz * HW + ix]; }
function loadImg(f){ return fetch(url(f)).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.blob(); })
  .then((b) => createImageBitmap(b, {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})); }
function pixels(bm){ const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data; }
function tex(bm, srgb, aniso = 8){ const t = new THREE.Texture(bm); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; }
const rnd = (() => { let s = 1414; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const LOGD = '#include <logdepthbuf_pars_vertex>';
const NOISE = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = .5; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
`;
// shared atmosphere: distance haze + low valley mist; used by every custom shader
const ATMO = `
uniform vec3 fogCol; uniform float fogK, hazeK;
vec3 atmo(vec3 col, vec3 P, vec3 C){
  float dist = length(P - C);
  float f = 1.0 - exp(-dist * fogK);
  float mist = exp(-max(P.y, 0.0) * 1.1) * (1.0 - exp(-dist * fogK * 2.2)) * hazeK * .55;
  return mix(col, fogCol, clamp(f + mist, 0.0, 1.0));
}`;

// ------------------------------------------------------------ DOM
function makeDom(){
  root = document.createElement('div'); root.className = 'm3d'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Horaghfus 3D haritası');
  root.innerHTML = '<canvas class="m3d-cv"></canvas><div class="m3d-labels"></div>' +
    '<div class="m3d-top"><div class="m3d-title"><b>Horaghfus</b><span>3D Harita · beta</span></div>' +
    '<div class="m3d-btns"><button type="button" class="m3d-home" title="Tüm kıtayı göster">Kıta</button><button type="button" class="m3d-x" aria-label="Haritayı kapat (Esc)">✕</button></div></div>' +
    '<div class="m3d-hint">Sol tık + sürükle: kaydır · Sağ tık + sürükle: döndür / eğ · Tekerlek: yakınlaş · İsme tıkla: bilgi kartı</div>' +
    '<div class="m3d-scale"><i></i><span></span></div>' +
    '<aside class="m3d-card" hidden><button type="button" class="m3d-cx" aria-label="Kartı kapat">✕</button><div class="m3d-ci"></div></aside>' +
    '<div class="m3d-load"><div class="m3d-ring"></div><p>Horaghfus yükleniyor… <span>0%</span></p></div>';
  document.body.appendChild(root);
  cv = root.querySelector('.m3d-cv'); labelsEl = root.querySelector('.m3d-labels'); cardEl = root.querySelector('.m3d-card');
  loadEl = root.querySelector('.m3d-load'); hintEl = root.querySelector('.m3d-hint'); scaleEl = root.querySelector('.m3d-scale');
  root.querySelector('.m3d-x').addEventListener('click', close);
  root.querySelector('.m3d-home').addEventListener('click', () => { flyTo(512, 400, 1000); goal.yaw = 0; goal.tilt = 0; closeCard(); });
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
let sunLight, hemi;
async function build(){
  renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = true;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fb0cc);
  scene.fog = new THREE.FogExp2(U.fogCol.value.getHex(), 0.001);
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 6000);
  sunLight = new THREE.DirectionalLight(0xfff0dc, 2.4); sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight); scene.add(sunLight.target);
  hemi = new THREE.HemisphereLight(0xc8dcff, 0x5e5340, 1.25); scene.add(hemi);
  let done = 0; const step = (n) => (x) => { done += n; progress(Math.min(done, .99)); return x; };
  const J = (f, n) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(f); return r.json(); }).then(step(n));
  const BIN = (f, n) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(f); return r.arrayBuffer(); }).then(step(n));
  const G_NAMES = ['g0_grass', 'g1_meadow', 'g2_dirt', 'g3_sand', 'g4_rock', 'g5_snow', 'g6_gravel'], N_NAMES = ['n0_grass', 'n1_rock', 'n2_dirt'];
  const [meta, data, yer, hBm, nBm, mBm, fBm, aBm, lo, treesBuf, bldBuf, models, mbuf, gT, nT, kkBm, leafBms] = await Promise.all([
    J('meta.json', .02), J('places3d.json', .04), fetch(url('yerler.json')).then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    loadImg('height.png').then(step(.12)), loadImg('normal.webp').then(step(.12)), loadImg('mask.webp').then(step(.08)), loadImg('fac.png').then(step(.04)), loadImg('aux.png').then(step(.04)),
    loadImg('color_lo.webp').then(step(.08)), BIN('trees.bin', .08), BIN('buildings.bin', .03), J('models.json', .01), BIN('models.bin', .08),
    Promise.all(G_NAMES.map((n) => loadImg('tex/' + n + '.webp'))).then(step(.08)), Promise.all(N_NAMES.map((n) => loadImg('tex/' + n + '.webp'))).then(step(.04)),
    loadImg('tex/kk.png'), Promise.all(['leaf_n', 'leaf_p', 'leaf_t', 'bark_n', 'bark_t', 'bark_d'].map((n) => loadImg('tex/' + n + '.webp'))).then(step(.04))]);
  META = meta; D = data; HW = meta.hgrid[0]; HH = meta.hgrid[1]; EX = meta.ex || 3; U.ex.value = EX; MODELS = models.models; MBUF = mbuf;
  mergeYerler(yer);
  const hp = pixels(hBm); HGT = new Float32Array(HW * HH); const span = meta.hmax - meta.hmin;
  for (let i = 0, j = 0; i < HGT.length; i++, j += 4) HGT[i] = (hp[j] * 256 + hp[j + 1]) / 65535 * span + meta.hmin;
  VW = HW + 1; VH = new Float32Array(VW * (HH + 1));
  for (let j = 0; j <= HH; j++) for (let i = 0; i <= HW; i++) VH[j * VW + i] = hAt(i * .5, j * .5) * EX;
  const fp = pixels(fBm), ap = pixels(aBm); FAC = new Uint8Array(HW * HH);
  for (let i = 0, j = 0; i < FAC.length; i++, j += 4){ const m = Math.max(fp[j], fp[j + 1], fp[j + 2], ap[j]); if (m > 110) FAC[i] = m === fp[j] ? 1 : m === fp[j + 1] ? 2 : m === fp[j + 2] ? 3 : 4; }
  U.nTex = {value: tex(nBm, false)}; U.mTex = {value: tex(mBm, false)}; U.facTex = {value: tex(fBm, false)}; U.auxTex = {value: tex(aBm, false)};
  U.loTex = {value: tex(lo, true)};
  U.gTex = {value: arrayTex(gT, true)}; U.gNrm = {value: arrayTex(nT, false)};
  MAT.kk = paletteTextures(kkBm);
  MAT.leaf = leafBms.map((b, i) => { const t = tex(b, true, 4); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  buildSky(); buildTerrain(); buildOcean(); buildRoads(); buildBuildings(bldBuf); buildBridges(); buildShips(); buildSpecial(); buildTrees(treesBuf);
  buildSmoke(); buildClouds(); buildWind(); buildLabels();
  built = true;
}
function mergeYerler(Y){
  if (!Y) return;
  for (const p of D.places){ const e = Y[p.id]; if (!e) continue; for (const k of ['name', 'note', 'sub', 'tag', 'desc']) if (e[k] != null && e[k] !== '') p[k] = e[k]; }
  if (Y._factions) for (const k in Y._factions) Object.assign(D.factions[k] || {}, Y._factions[k]);
}
function arrayTex(bms, srgb){
  const w = bms[0].width, h = bms[0].height, data = new Uint8Array(w * h * 4 * bms.length);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', {willReadFrequently: true});
  bms.forEach((b, i) => { x.clearRect(0, 0, w, h); x.drawImage(b, 0, 0, w, h); data.set(x.getImageData(0, 0, w, h).data, i * w * h * 4); });
  const t = new THREE.DataArrayTexture(data, w, h, bms.length); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
// KayKit palette -> faction palettes: 0 standard, 1 elf (bright marble), 2 Halldor (black & steel), 3 Blavinken (dark gothic)
function paletteTextures(bm){
  const src = pixels(bm), w = bm.width, h = bm.height, out = [];
  for (let v = 0; v < 4; v++){
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const im = x.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4){
      let r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255; const l = .3 * r + .59 * g + .11 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
      if (v === 1){ if (sat < .25 || (r > g && g > b && sat < .45)){ r = r * .4 + .62; g = g * .4 + .6; b = b * .4 + .55; } }
      else if (v === 2){ if (b > r + .12 && b > g){ r = g = b = .1 + l * .25; } else if (sat < .2){ r *= .55; g *= .56; b *= .6; } else { r *= .7; g *= .7; b *= .72; } }
      else if (v === 3){ const k = .5; r = (r * (1 - k) + l * k) * .55; g = (g * (1 - k) + l * k) * .52; b = (b * (1 - k) + l * k) * .58; }
      im.data[i] = r * 255; im.data[i + 1] = g * 255; im.data[i + 2] = b * 255; im.data[i + 3] = 255;
    }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; out.push(t);
  }
  return out;
}
const MAT = {};

// ------------------------------------------------------------ sky
function buildSky(){
  const m = new THREE.ShaderMaterial({depthWrite: false, side: THREE.BackSide, fog: false, uniforms: {sun: U.sun, fogCol: U.fogCol, time: U.time},
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 sun, fogCol; uniform float time; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 zen = vec3(.11, .27, .55), hor = fogCol;
        vec3 c = mix(hor, zen, pow(clamp(y, 0.0, 1.0), .55));
        c = mix(c, hor * .92, smoothstep(0.0, -.15, y));
        float s = max(dot(d, sun), 0.0);
        c += vec3(1.0, .82, .6) * (pow(s, 8.0) * .25 + pow(s, 64.0) * .5) + vec3(1.0, .95, .85) * smoothstep(.9995, .99975, s) * 6.0;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`});
  const s = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), m); s.frustumCulled = false; s.renderOrder = -10; s.onBeforeRender = () => s.position.copy(camera.position); scene.add(s);
}

// ------------------------------------------------------------ terrain
const TERR_V = `
uniform mat4 shMat; varying vec2 vW; varying vec3 vP; varying vec4 vSh;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; vP = wp.xyz; vSh = shMat * wp; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const TERR_F = `
precision highp sampler2DArray;
uniform sampler2D colTex, nTex, mTex, facTex, auxTex, shMap; uniform highp sampler2DArray gTex, gNrm;
uniform vec4 tileXf, hover; uniform vec3 sun, camPos, sunCol, skyCol, gndCol, volc; uniform float borderVis, time, ex, shOn, camD;
varying vec2 vW; varying vec3 vP; varying vec4 vSh;
${NOISE}
${ATMO}
#include <packing>
float edge(float w){ return smoothstep(.36, .5, w) * (1.0 - smoothstep(.5, .64, w)); }
vec3 Lt(float i, vec2 uv){ return texture(gTex, vec3(uv, i)).rgb; }
vec3 avgL(float i){ return textureLod(gTex, vec3(.5, .5, i), 11.0).rgb + 1e-3; }
vec3 det(float i, vec2 w){ return mix(Lt(i, w * 3.6), Lt(i, w * .71 + .37), .42); }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float shadowAt(){
  if (shOn < .5) return 1.0;
  vec3 c = vSh.xyz / vSh.w; if (c.x < 0.0 || c.y < 0.0 || c.x > 1.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float s = 0.0, tx = 1.0 / 4096.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += step(c.z - .0006, unpackRGBAToDepth(texture2D(shMap, c.xy + vec2(float(i), float(j)) * tx * 1.3)));
  float edgeF = smoothstep(0.0, .06, min(min(c.x, c.y), min(1.0 - c.x, 1.0 - c.y)));
  return mix(1.0, s / 9.0, edgeF);
}
vec3 fieldsCol(vec2 w, vec3 base){
  float ang = floor(vn(w * .05) * 4.0) * .4;
  mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)); vec2 q = R * w;
  vec2 cs = vec2(.62, .38); vec2 c = floor(q / cs); float r = h21(c + floor(ang * 10.0)); vec2 f = fract(q / cs);
  vec3 crop = r < .22 ? vec3(.80, .68, .34) : r < .45 ? vec3(.46, .58, .24) : r < .62 ? vec3(.52, .40, .24) : r < .8 ? vec3(.66, .64, .32) : vec3(.36, .50, .22);
  crop = lin(crop);
  float furrow = .82 + .18 * sin((q.x + r * 3.0) * 70.0);
  float inner = smoothstep(0.0, .05, f.x) * smoothstep(1.0, .95, f.x) * smoothstep(0.0, .07, f.y) * smoothstep(1.0, .93, f.y);
  return mix(base * .72, mix(base, crop * furrow, .72), inner);
}
void main(){
  vec2 uv = vW / vec2(1024.0, 768.0);
  vec3 base = texture2D(colTex, (vW - tileXf.xy) * tileXf.zw).rgb;
  vec3 n = normalize(texture2D(nTex, uv).xyz * 2.0 - 1.0);
  vec4 M = texture2D(mTex, uv); vec4 A = texture2D(auxTex, uv);
  float hk = vP.y / ex, slope = 1.0 - n.y;
  float dist = length(vP - camPos);
  float dk = 1.0 - smoothstep(14.0, 60.0, dist);
  float nz = fbm(vW * .35), nz2 = vn(vW * 2.3);
  float mlum = dot(base, vec3(.3, .59, .11)), msat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
  // --- splat weights (slope, height, painted snow, beaches)
  float wRock = smoothstep(.18, .42, slope + (nz - .5) * .12) * smoothstep(.08, .5, hk) + smoothstep(1.6, 2.8, hk) * .7 * smoothstep(.06, .22, slope);
  float snowLine = mix(3.3, 4.3, smoothstep(.12, .6, uv.y)) + (nz - .5) * .6;
  float painted = smoothstep(.5, .7, mlum) * (1.0 - smoothstep(.05, .14, msat)) * smoothstep(1.4, 2.4, hk);
  float wSnow = max(smoothstep(snowLine, snowLine + .4, hk) * (1.0 - smoothstep(.3, .55, slope + (nz2 - .5) * .15)), painted * (1.0 - smoothstep(.32, .6, slope + (nz2 - .5) * .15)));
  float wSand = smoothstep(.035, .012, hk) * step(-.01, hk) * (1.0 - wRock);
  float wMead = smoothstep(.35, .75, nz + (nz2 - .5) * .3);
  // --- macro colour, optionally modulated by detail textures (keeps Phoenix's painted colours)
  vec3 alb = base;
  vec3 dn = vec3(0.0);
  if (dk > 0.0){
    vec3 g0 = det(0.0, vW) / avgL(0.0), g1 = det(1.0, vW) / avgL(1.0);
    vec3 grassD = base * mix(g0, g1, wMead);
    // rock: triplanar on steep faces
    vec3 an = abs(n);
    vec3 rk = (Lt(4.0, vec2(vW.x, vP.y / ex * 1.0) * 1.4) * an.z + Lt(4.0, vec2(vW.y, vP.y / ex) * 1.4) * an.x + Lt(4.0, vW * 1.4) * an.y) / (an.x + an.y + an.z);
    vec3 rockD = mix(rk * 1.05, base * rk / avgL(4.0), .35);
    vec3 snowD = Lt(5.0, vW * 1.1) * vec3(.97, .99, 1.03) * 1.04;
    vec3 sandD = mix(det(3.0, vW), base * det(3.0, vW) / avgL(3.0), .5);
    vec3 d = grassD;
    d = mix(d, sandD, wSand); d = mix(d, rockD, clamp(wRock, 0.0, .95)); d = mix(d, snowD, clamp(wSnow, 0.0, 1.0));
    alb = mix(base, d, dk);
    vec2 nG = texture(gNrm, vec3(vW * 3.6, 0.0)).xy * 2.0 - 1.0, nR = texture(gNrm, vec3(vW * 1.4, 1.0)).xy * 2.0 - 1.0;
    vec2 nd2 = mix(nG * .55, nR * 1.1, clamp(wRock, 0.0, 1.0)) * (1.0 - wSnow * .7);
    dn = vec3(nd2.x, 0.0, -nd2.y) * dk;
  }
  // far: rock and snow tints from the macro colour
  vec3 rockFar = mix(lin(vec3(.44, .41, .38)), base, .3) * (.85 + .3 * nz), snowFar = lin(vec3(.93, .95, .99));
  alb = mix(alb, mix(alb, rockFar, clamp(wRock, 0.0, .9)), 1.0 - dk);
  alb = mix(alb, mix(alb, snowFar, clamp(wSnow, 0.0, 1.0) * .9), 1.0 - dk);
  // Phoenix painted whole mountain ranges white: below the snow line turn that paint into alpine rock / scree / meadow
  float pLow = smoothstep(.5, .68, mlum) * (1.0 - smoothstep(.06, .15, msat)) * (1.0 - clamp(wSnow, 0.0, 1.0)) * smoothstep(.12, .5, hk);
  if (pLow > .01){
    vec3 alp = mix(lin(vec3(.47, .5, .36)), lin(vec3(.5, .47, .43)), smoothstep(.08, .3, slope + (nz - .5) * .2));
    alp = mix(alp, lin(vec3(.62, .6, .57)), smoothstep(2.0, 2.9, hk) * .6);
    if (dk > 0.0) alp *= mix(vec3(1.0), Lt(4.0, vW * 1.4) / avgL(4.0), dk * .8);
    alb = mix(alb, alp * (.82 + .36 * nz), pLow * .9);
  }
  // --- farm fields, urban ground, dirt roads, stream beds
  if (M.b > .01) alb = mix(alb, fieldsCol(vW, alb), smoothstep(.0, .6, M.b) * (1.0 - wRock) * (1.0 - wSnow * .8));
  if (M.a > .01){
    vec3 gv = dk > 0.0 ? det(6.0, vW * 1.5) : lin(vec3(.55, .52, .47));
    vec3 urbanG = mix(alb * .8, gv * vec3(.92, .86, .78) * .9, .75);
    // roof pattern seen from afar (individual houses are drawn as models up close)
    vec2 rc = floor(vW / .21); float rr = h21(rc); vec2 rf = fract(vW / .21);
    float roof = step(.18, rf.x) * step(rf.x, .86) * step(.2, rf.y) * step(rf.y, .82) * step(.25, rr);
    vec3 roofC = rr < .55 ? lin(vec3(.62, .26, .18)) : rr < .8 ? lin(vec3(.48, .32, .22)) : lin(vec3(.38, .40, .45));
    urbanG = mix(urbanG, roofC, roof * smoothstep(.3, .55, M.a) * smoothstep(20.0, 45.0, dist) * (1.0 - smoothstep(.9, .99, M.a)));
    urbanG = mix(urbanG, gv * vec3(.75, .7, .66), smoothstep(.85, 1.0, M.a));
    alb = mix(alb, urbanG, smoothstep(.02, .3, M.a));
  }
  if (M.r > .01){
    vec3 dirt = (dk > 0.0 ? mix(det(2.0, vW * 1.6), lin(vec3(.5, .4, .3)), 1.0 - dk) : lin(vec3(.5, .4, .3))) * vec3(1.0, .92, .82);
    float rd = smoothstep(.15, .6, M.r);
    alb = mix(alb, dirt * (.85 + .15 * nz2), rd * .92);
    alb *= 1.0 - smoothstep(.05, .2, M.r) * (1.0 - rd) * .18;      // trodden verge
  }
  float wet = 0.0;
  if (M.g > .02){ wet = smoothstep(.02, .5, M.g); alb *= 1.0 - wet * .38; }
  // --- light
  vec3 N = normalize(n + dn);
  float dif = max(dot(N, sun), 0.0);
  float sh = mix(1.0, A.a, smoothstep(0.0, .05, hk + .02));
  sh = min(sh, shadowAt());
  float cs = smoothstep(.52, .8, fbm(vW * .011 + vec2(time * .005, time * .0018)));
  vec3 amb = mix(gndCol, skyCol, N.y * .5 + .5);
  float ao = 1.0 - smoothstep(.25, .7, slope) * .2;
  vec3 col = alb * (amb * .62 * ao + sunCol * dif * sh * (1.0 - .42 * cs));
  // stream water shimmer in the bed
  if (M.g > .45){ float wc = smoothstep(.45, .85, M.g); vec3 wcol = mix(lin(vec3(.18, .32, .38)), skyCol * .8, .4) + sunCol * pow(max(dot(reflect(-sun, vec3(0.0, 1.0, 0.0)), normalize(camPos - vP)), 0.0), 40.0) * .4;
    col = mix(col, wcol, wc * .85); }
  // volcano: glowing crater + lava runs
  float dv = length(vW - volc.xz);
  if (dv < 9.0){
    float ang = atan(vW.y - volc.z, vW.x - volc.x);
    float ch = smoothstep(.72, .9, vn(vec2(ang * 7.0, dv * .35))) * smoothstep(8.0, 1.0, dv) * smoothstep(.15, .35, slope);
    float crater = smoothstep(1.6, .7, dv);
    float pulse = .75 + .25 * sin(time * 1.3 + dv * 2.0);
    vec3 lava = vec3(4.0, 1.1, .15) * pulse;
    col = mix(col, col * .45, smoothstep(9.0, 3.0, dv) * .6);
    col += lava * (ch * .6 + crater) * (.6 + .4 * vn(vW * 3.0 + time * .2));
  }
  col *= mix(1.0, .82, smoothstep(0.0, -.25, hk));
  // factions (hover + borders)
  vec4 F = vec4(texture2D(facTex, uv).rgb, A.r);
  float w = dot(F, hover);
  vec3 hc = hover.x * vec3(1., .32, .25) + hover.y * vec3(.35, .65, 1.) + hover.z * vec3(1., .85, .3) + hover.w * vec3(.9, .92, 1.);
  col = mix(col, col * .7 + hc * .35, smoothstep(.3, .7, w) * .5);
  float e = max(max(edge(F.x), edge(F.y)), max(edge(F.z), edge(F.w)));
  col = mix(col, vec3(1.0, .9, .65), e * borderVis * .4);
  col += hc * edge(w) * 1.6;
  col = atmo(col, vP, camPos);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const chunks = [];
function chunkGeo(cx, cy){
  const S = SEG, N = S + 1, pos = new Float32Array(N * N * 3), idx = new Uint32Array(S * S * 6);
  const i0 = cx * CH * 2, j0 = cy * CH * 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const k = (j * N + i) * 3, gi = i0 + i, gj = j0 + j; pos[k] = gi * .5; pos[k + 1] = VH[Math.min(gj, HH) * VW + Math.min(gi, VW - 1)]; pos[k + 2] = gj * .5;
  }
  let o = 0; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
const tileCache = {};
function tileTex(tx, ty){
  const k = tx + '_' + ty; if (tileCache[k]) return tileCache[k];
  tileCache[k] = {t: null, p: loadImg('c_' + k + '.webp').then((bm) => { tileCache[k].t = tex(bm, true); return tileCache[k].t; }).catch(() => null)};
  return tileCache[k];
}
const VOLC = new THREE.Vector3();
function buildTerrain(){
  if (D.volcano) VOLC.set(D.volcano.x, 0, D.volcano.z);
  for (let cy = 0; cy < NCY; cy++) for (let cx = 0; cx < NCX; cx++){
    const m = new THREE.ShaderMaterial({vertexShader: TERR_V, fragmentShader: TERR_F, uniforms: {
      colTex: {value: U.loTex.value}, tileXf: {value: new THREE.Vector4(0, 0, 1 / WK, 1 / HK)}, nTex: U.nTex, mTex: U.mTex, facTex: U.facTex, auxTex: U.auxTex, gTex: U.gTex, gNrm: U.gNrm,
      sun: U.sun, camPos: U.camPos, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, hover: U.hover, borderVis: U.borderVis, time: U.time, ex: U.ex, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol,
      shMap: U.shMap, shMat: U.shMat, shOn: U.shOn, camD: U.camD, volc: {value: VOLC}}});
    const mesh = new THREE.Mesh(chunkGeo(cx, cy), m); mesh.castShadow = true; mesh.receiveShadow = false; scene.add(mesh);
    chunks.push({cx, cy, mesh, hi: false, c: new THREE.Vector3(cx * CH + CH / 2, 0, cy * CH + CH / 2)});
  }
}
function updateChunks(){
  const cp = camera.position;
  for (const c of chunks){
    const dx = Math.max(Math.abs(cp.x - c.c.x) - CH / 2, 0), dz = Math.max(Math.abs(cp.z - c.c.z) - CH / 2, 0), dist = Math.hypot(dx, dz, cp.y);
    if (dist < 420 && !c.hi){
      const tx = c.cx >> 1, ty = c.cy >> 1, t = tileTex(tx, ty); c.hi = true;
      const apply = (tt) => { if (tt){ c.mesh.material.uniforms.colTex.value = tt; c.mesh.material.uniforms.tileXf.value.set(tx * 256, ty * 256, 1 / 256, 1 / 256); } };
      if (t.t) apply(t.t); else t.p.then(apply);
    }
  }
}

// ------------------------------------------------------------ ocean, lakes, rivers (one water plane at sea level)
const OCEAN_F = `
uniform sampler2D auxTex; uniform vec3 sun, camPos, skyCol, sunCol; uniform float time; varying vec2 vW; varying vec3 vP;
${NOISE}
${ATMO}
float waves(vec2 p, float t){
  return vn(p * .32 + vec2(t * .05, t * .03)) * .45 + vn(p * .9 - vec2(t * .07, -t * .04)) * .3 + vn(p * 2.6 + vec2(t * .13, t * .1)) * .17 + vn(p * 7.0 - vec2(t * .3, t * .2)) * .08; }
void main(){
  vec2 uv = vW / vec2(1024.0, 768.0);
  bool inMap = uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0;
  vec3 A = inMap ? texture2D(auxTex, uv).rgb : vec3(0.0, 0.0, 1.0);
  float d = A.b, km = d * 40.0;
  float dist = length(vP - camPos); float nearF = 1.0 - smoothstep(60.0, 380.0, dist);
  float t = time, e = .2;
  float w0 = waves(vW, t), wx = waves(vW + vec2(e, 0.0), t), wz = waves(vW + vec2(0.0, e), t);
  vec3 n = normalize(vec3((w0 - wx) * .9 * nearF, 1.0, (w0 - wz) * .9 * nearF));
  vec3 deep = vec3(.012, .05, .11), mid = vec3(.025, .13, .2), shallow = vec3(.09, .30, .32);
  vec3 col = mix(shallow, mid, smoothstep(0.0, .1, d)); col = mix(col, deep, smoothstep(.08, .7, d));
  vec3 Vd = normalize(camPos - vP); vec3 R = reflect(-Vd, n);
  float fres = .04 + .96 * pow(1.0 - max(dot(Vd, n), 0.0), 5.0);
  vec3 sky = mix(fogCol, skyCol * 1.1, clamp(R.y * 1.5, 0.0, 1.0));
  col = mix(col, sky, fres * .85);
  col += sunCol * pow(max(dot(reflect(-sun, n), Vd), 0.0), 160.0) * 1.2 * nearF + sunCol * pow(max(dot(reflect(-sun, n), Vd), 0.0), 18.0) * .08;
  // waves rolling in to the shore + breaking foam
  float ph = km * 2.1 + t * 1.25 + vn(vW * .25) * 5.0;
  float crest = pow(.5 + .5 * sin(ph), 6.0) * (1.0 - smoothstep(.4, 3.2, km));
  float foam = crest * smoothstep(.3, .65, vn(vW * 2.2 + vec2(t * .1, 0.0))) * nearF;
  foam += (1.0 - smoothstep(0.0, .28, km)) * (.6 + .4 * vn(vW * 6.0 + t * .4));
  foam += smoothstep(.78, .95, w0) * .18 * smoothstep(.05, .3, d) * nearF;
  col = mix(col, vec3(.85, .92, .95), clamp(foam, 0.0, 1.0) * .8);
  col = atmo(col, vP, camPos);
  float a = mix(.55, 1.0, smoothstep(0.0, .06, d));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;
function buildOcean(){
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-Math.PI / 2); g.translate(512, 0, 384);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vW; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xz; vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: OCEAN_F, uniforms: {auxTex: U.auxTex, sun: U.sun, camPos: U.camPos, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, time: U.time, skyCol: U.skyCol, sunCol: U.sunCol}});
  const o = new THREE.Mesh(g, m); o.renderOrder = 2; scene.add(o);
}

// ------------------------------------------------------------ roads: textured dirt ribbons draped on the terrain + glowing route lines (UI)
const routeMats = [];
function densify(pts, step){
  const out = [];
  for (let i = 0; i < pts.length - 1; i++){ const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++){ const t = k / n; out.push([ax + (bx - ax) * t, az + (bz - az) * t]); } }
  out.push(pts[pts.length - 1]); return out;
}
function ribbon(pts, w, lift, sea){
  const dense = densify(pts, sea ? 2 : .22);
  const pos = new Float32Array(dense.length * 6), uv = new Float32Array(dense.length * 4), idx = []; let acc = 0;
  for (let i = 0; i < dense.length; i++){
    const a = dense[Math.max(i - 1, 0)], b = dense[Math.min(i + 1, dense.length - 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i) acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
    const [x, z] = dense[i];
    const y1 = sea ? .05 : Math.max(yAt(x - dz * w, z + dx * w), yAt(x, z) - .05, .02) + lift, y2 = sea ? .05 : Math.max(yAt(x + dz * w, z - dx * w), yAt(x, z) - .05, .02) + lift;
    pos.set([x - dz * w, y1, z + dx * w, x + dz * w, y2, z - dx * w], i * 6); uv.set([acc, 0, acc, 1], i * 4);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
function dirtMat(){
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
    uniforms: {gTex: U.gTex, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol, camPos: U.camPos, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, op: {value: 1}, auxTex: U.auxTex},
    vertexShader: 'varying vec2 vU; varying vec3 vP; void main(){ vU = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `precision highp sampler2DArray; uniform highp sampler2DArray gTex; uniform sampler2D auxTex; uniform vec3 sun, sunCol, skyCol, gndCol, camPos; uniform float op; varying vec2 vU; varying vec3 vP;
      ${NOISE}
      ${ATMO}
      void main(){ float side = abs(vU.y * 2.0 - 1.0);
        float edgeN = vn(vP.xz * 9.0) * .35;
        float a = 1.0 - smoothstep(.55 - edgeN, 1.0 - edgeN * .5, side);
        vec3 dirt = texture(gTex, vec3(vP.xz * 5.5, 2.0)).rgb * vec3(1.0, .9, .78);
        float rut = 1.0 - .22 * smoothstep(.15, .3, abs(side - .45)) * (1.0 - smoothstep(.3, .45, abs(side - .45)));
        float sh = texture2D(auxTex, vP.xz / vec2(1024.0, 768.0)).a;
        vec3 col = dirt * rut * (mix(gndCol, skyCol, .8) * .6 + sunCol * .62 * sh);
        col = atmo(col, vP, camPos);
        gl_FragColor = vec4(col, a * op * .92);
        #include <colorspace_fragment>
      }`});
  routeMats.push({m, kind: 'dirt'}); return m;
}
function routeMat(kind){
  const col = kind === 'trade' ? new THREE.Color(0xf2c661) : kind === 'sea' ? new THREE.Color(0xbfe6ff) : new THREE.Color(0xe8cfa0);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -8,
    uniforms: {col: {value: col}, time: U.time, op: {value: 1}, kind: {value: kind === 'trade' ? 1 : kind === 'sea' ? 2 : 0}},
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 col; uniform float time, op, kind; varying vec2 vU;
      void main(){ float side = 1.0 - abs(vU.y * 2.0 - 1.0); float a = smoothstep(0.0, .5, side);
        float dash = kind > 1.5 ? step(.5, fract(vU.x * .3 - time * .2)) : kind > .5 ? .5 + .5 * step(.4, fract(vU.x * .12 - time * .3)) : .7;
        gl_FragColor = vec4(col, a * dash * op * (kind > 1.5 ? .6 : .75));
        #include <colorspace_fragment>
      }`});
  routeMats.push({m, kind}); return m;
}
function buildRoads(){
  const dm = dirtMat(), mats = {road: routeMat('road'), trade: routeMat('trade'), sea: routeMat('sea')};
  const W = {trade: .2, road: .15, path: .09};
  for (const r of D.roads){
    if (r.t !== 'sea'){ const mesh = new THREE.Mesh(ribbon(r.p, W[r.t], .025, false), dm); mesh.renderOrder = 3; scene.add(mesh); }
    if (r.t === 'path') continue;
    const mesh = new THREE.Mesh(ribbon(r.p, r.t === 'trade' ? .5 : r.t === 'sea' ? .7 : .3, .08, r.t === 'sea'), mats[r.t === 'road' ? 'road' : r.t]); mesh.renderOrder = 4; scene.add(mesh);
  }
  for (const s of D.streets || []){ const mesh = new THREE.Mesh(ribbon(s, .07, .02, false), dm); mesh.renderOrder = 3; scene.add(mesh); }
}

// ------------------------------------------------------------ models (packed CC0 kits: KayKit Medieval Hexagon, Quaternius Stylized Nature)
const GEO = {}; const VARN = ['red', 'blue', 'yellow', 'n'];
function modelGeo(name, variant){
  const key = name + '|' + variant; if (GEO[key]) return GEO[key];
  const M = MODELS[name]; const out = [];
  for (const p of M.prims){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MBUF, p.pos, p.n * 3), 3));
    g.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Int8Array(MBUF, p.nrm, p.n * 4), 4), 3, 0, true));
    const vk = p.uv[variant] != null ? variant : Object.keys(p.uv)[0];
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(MBUF, p.uv[vk], p.n * 2), 2));
    g.setIndex(new THREE.BufferAttribute(p.i32 ? new Uint32Array(MBUF, p.idx, p.ni) : new Uint16Array(MBUF, p.idx, p.ni), 1));
    g.computeBoundingSphere(); out.push({g, mat: p.mat});
  }
  return GEO[key] = out;
}
const MNAMES = () => Object.keys(MODELS);
function f16(h){ const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * Math.pow(2, -14) * f / 1024 : e === 31 ? (f ? NaN : s * Infinity) : s * Math.pow(2, e - 15) * (1 + f / 1024); }
// distance switch inside the shader: detailed instances vanish past NEAR_B, block LOD only past it (no popping of whole tiles)
function lodPatch(mat, far){
  mat.onBeforeCompile = (sh) => { sh.uniforms.camPos = U.camPos; sh.uniforms.nearB = {value: NEAR_B};
    sh.vertexShader = 'uniform vec3 camPos; uniform float nearB;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      { vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float dd = distance(ip, camPos);
        bool hide = ${far ? 'dd < nearB || dd > 300.0' : 'dd > nearB && instanceMatrix[1][1] < 0.9'}; if (hide) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`); };
  return mat;
}
const BLD = {tiles: new Map(), list: null, smokeSrc: []};
const BT = 8;  // building tile size (km)
function buildBuildings(buf){
  const dv = new DataView(buf), n = buf.byteLength / 16, names = MNAMES();
  const L = []; for (let i = 0; i < n; i++){ const o = i * 16; L.push({m: names[dv.getUint8(o)], v: dv.getUint8(o + 1), p: dv.getUint8(o + 2), f: dv.getUint8(o + 3), x: dv.getFloat32(o + 4, true), z: dv.getFloat32(o + 8, true), r: f16(dv.getUint16(o + 12, true)), s: f16(dv.getUint16(o + 14, true))}); }
  BLD.list = L;
  MAT.bld = [0, 1, 2, 3].map((p) => lodPatch(new THREE.MeshLambertMaterial({map: MAT.kk[p]}), false));
  for (const b of L){
    const bb = MODELS[b.m].bb; let y = Math.min(yAt(b.x, b.z), yAt(b.x + .1, b.z + .1), yAt(b.x - .1, b.z - .1)) - .01;
    if (b.m === 'wall_straight' || b.m === 'wall_straight_gate') y = yAt(b.x, b.z) - .06 * b.s * 5;
    b.y = y; b.top = y + bb[4] * b.s;
    const k = Math.floor(b.x / BT) + ',' + Math.floor(b.z / BT); let t = BLD.tiles.get(k);
    if (!t){ t = {k, cx: (Math.floor(b.x / BT) + .5) * BT, cz: (Math.floor(b.z / BT) + .5) * BT, items: [], group: null}; BLD.tiles.set(k, t); }
    t.items.push(b);
  }
  // far LOD: walls + roofs blocks (2 draw calls for every building on the map)
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const roof = new THREE.CylinderGeometry(.5, .5, 1, 3, 1); roof.rotateZ(Math.PI / 2); roof.rotateY(Math.PI / 2); roof.scale(1, 1, 1); roof.translate(0, .25, 0);
  const WALLC = [[0xd9cbb0, 0xa9483a], [0xf1ede2, 0xd8b45a], [0x55555c, 0x1d1d22], [0x5a5552, 0x2b2830]];
  const DWC = [0x8b8379, 0x4f6a8a];
  const nn = L.length, wm = new THREE.InstancedMesh(box, lodPatch(new THREE.MeshLambertMaterial(), true), nn), rm = new THREE.InstancedMesh(roof, lodPatch(new THREE.MeshLambertMaterial(), true), nn);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  let k = 0;
  for (const b of L){
    const bb = MODELS[b.m].bb, w = (bb[3] - bb[0]) * b.s * .85, d = (bb[5] - bb[2]) * b.s * .85, h = (bb[4] - bb[1]) * b.s;
    const tall = h > Math.max(w, d) * 1.6, wall = b.m.startsWith('wall');
    e.set(0, b.r, 0); q.setFromEuler(e);
    const monu = (b.f & 4) || b.s >= .9; v.set(b.x, b.y, b.z); sc.set(w, wall ? h : tall ? h * .85 : h * .58, d); if (monu) sc.set(0, 0, 0); m4.compose(v, q, sc); wm.setMatrixAt(k, m4);
    const pal = b.v === 1 && b.p === 0 ? DWC : WALLC[b.p] || WALLC[0];
    c.setHex(pal[0]); c.offsetHSL(0, 0, (hash(k) - .5) * .08); wm.setColorAt(k, c);
    v.set(b.x, b.y + (tall ? h * .85 : h * .58), b.z); sc.set(w * 1.08, wall ? .001 : h * (tall ? .3 : .5), d * 1.08); if (monu) sc.set(0, 0, 0); m4.compose(v, q, sc); rm.setMatrixAt(k, m4);
    c.setHex(pal[1]); c.offsetHSL(0, (hash(k + 7) - .5) * .1, (hash(k + 3) - .5) * .12); rm.setColorAt(k, c);
    k++;
  }
  [wm, rm].forEach((im) => { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.frustumCulled = false; im.castShadow = false; scene.add(im); });
  BLD.far = [wm, rm];
}
function buildTileGroup(t){
  const groups = new Map();
  for (const b of t.items){ const key = b.m + '|' + b.v + '|' + b.p; let g = groups.get(key); if (!g){ g = []; groups.set(key, g); } g.push(b); }
  const cJ = new THREE.Color(), grp = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const [key, arr] of groups){
    const [m, vv, p] = key.split('|'); const parts = modelGeo(m, VARN[+vv]);
    for (const part of parts){
      const im = new THREE.InstancedMesh(part.g, MAT.bld[+p], arr.length);
      arr.forEach((b, i) => { e.set(0, b.r, 0); q.setFromEuler(e); v.set(b.x, b.y, b.z); const mon = (b.f & 4) ? 1 : .999; sc.set(b.s, b.s * mon, b.s); m4.compose(v, q, sc); im.setMatrixAt(i, m4); const hh = hash(b.x * 31.7 + b.z * 17.3); cJ.setRGB(1, 1, 1).offsetHSL((hh - .5) * .06, (hash(hh * 91) - .5) * .25, (hash(hh * 57) - .5) * .16); im.setColorAt(i, cJ); });
      im.instanceColor.needsUpdate = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; grp.add(im);
    }
  }
  for (const b of t.items) if (b.f & 1) BLD.smokeSrc.push([b.x + (hash(b.x * 99) - .5) * b.s * .3, b.top - .02, b.z + (hash(b.z * 77) - .5) * b.s * .3, b.m === 'blacksmith' || b.m === 'mine' ? 1 : 0]);
  scene.add(grp); t.group = grp; smokeDirty = true;
}
function updateBuildings(){
  const cp = camera.position;
  let built_ = 0;
  for (const t of BLD.tiles.values()){
    if (t.group) continue;
    const dist = Math.hypot(Math.max(Math.abs(cp.x - t.cx) - BT / 2, 0), Math.max(Math.abs(cp.z - t.cz) - BT / 2, 0), cp.y - yAt(t.cx, t.cz));
    const mon = t.items.some((b) => b.f & 4);
    if ((dist < NEAR_B + 6 || (mon && dist < 300)) && built_ < 10){ buildTileGroup(t); built_++; }
  }
}
// monumental pieces (Khara dûm gate) are scaled with sy = 1.0 marker -> never hidden by the LOD switch
function buildBridges(){
  const parts = modelGeo('bridge_A', 'n'), bb = MODELS.bridge_A.bb, spanX = bb[3] - bb[0], spanZ = bb[5] - bb[2];
  const alongX = spanX >= spanZ, span = Math.max(spanX, spanZ);
  const list = D.bridges || [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const part of parts){
    const im = new THREE.InstancedMesh(part.g, new THREE.MeshLambertMaterial({map: MAT.kk[0]}), list.length);
    list.forEach(([x, z, a, L], i) => { const s = L / span; e.set(0, -a + (alongX ? 0 : Math.PI / 2), 0); q.setFromEuler(e);
      const ca = Math.cos(a), sa = Math.sin(a), y = Math.max(yAt(x + ca * L / 2, z + sa * L / 2), yAt(x - ca * L / 2, z - sa * L / 2), .05) - .02;
      v.set(x, y, z); sc.set(s, Math.min(s, .6), Math.max(.5, s * .6)); m4.compose(v, q, sc); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; scene.add(im);
  }
}

// ------------------------------------------------------------ merged vertex-coloured geometry helper (ships, floating islands)
class GB {
  constructor(){ this.p = []; this.n = []; this.c = []; }
  add(geo, m4, hex){
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m4); g.computeVertexNormals();
    const P = g.attributes.position.array, N = g.attributes.normal.array, col = new THREE.Color(hex);
    for (let i = 0; i < P.length; i++){ this.p.push(P[i]); this.n.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) this.c.push(col.r, col.g, col.b);
    return this;
  }
  geo(){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; }
}
const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function shipGeo(big){
  const b = new GB(), hull = new THREE.CylinderGeometry(.5, .5, 1, 14, 1, false, 0, Math.PI);
  hull.rotateZ(Math.PI / 2); hull.rotateX(Math.PI);
  const P = hull.attributes.position; for (let i = 0; i < P.count; i++){ const x = P.getX(i); const t = Math.abs(x) * 2; P.setZ(i, P.getZ(i) * (1 - Math.pow(t, 3) * .85)); P.setY(i, P.getY(i) * (1 - Math.pow(t, 4) * .3)); }
  b.add(hull, M4(0, .06, 0, 0, 1, .28, .3), 0x6b4a2c);
  b.add(new THREE.BoxGeometry(.86, .02, .2), M4(0, .062, 0), 0x9a7650);
  b.add(new THREE.BoxGeometry(.16, .07, .18), M4(-.32, .1, 0), 0x7a5634);
  const masts = big ? [[-.12, .62], [.16, .5]] : [[0, .42]];
  for (const [x, h] of masts){ b.add(new THREE.CylinderGeometry(.008, .012, h, 5).translate(0, h / 2, 0), M4(x, .06, 0), 0x4a3420);
    const sail = new THREE.PlaneGeometry(.2, h * .55, 4, 3); const SP = sail.attributes.position; for (let i = 0; i < SP.count; i++) SP.setZ(i, Math.sin((SP.getY(i) / (h * .55) + .5) * Math.PI) * .03);
    b.add(sail, M4(x + .01, .06 + h * .55, 0, Math.PI / 2), big ? 0xf0e6cf : 0xe8dcc2); }
  return b.geo();
}
function buildShips(){
  const L = D.ships || []; if (!L.length) return;
  const mat = new THREE.MeshLambertMaterial({vertexColors: true, side: THREE.DoubleSide});
  mat.onBeforeCompile = (sh) => { sh.uniforms.time = U.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7; transformed.y += sin(time * 1.4 + ph) * .012; transformed.z += sin(time * 1.1 + ph) * position.y * .04;'); };
  for (const big of [1, 0]){
    const arr = L.filter((s) => (s[4] === 1) === !!big); if (!arr.length) continue;
    const im = new THREE.InstancedMesh(shipGeo(big), mat, arr.length), m4 = new THREE.Matrix4();
    arr.forEach(([x, z, r, s], i) => { m4.copy(M4(x, 0, z, r, s * .42, s * .42, s * .42)); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; scene.add(im); SHIPS.push(im);
  }
}
const SHIPS = [];
// ------------------------------------------------------------ special places: Luminaraeth (floating city)
const floats = [];
function buildSpecial(){
  const lp = D.places.find((p) => p.kind === 'floating'); if (!lp) return;
  const g = new THREE.Group(); g.position.set(lp.x, 0, lp.z); scene.add(g);
  const rockM = new THREE.MeshLambertMaterial({vertexColors: true}), fall = new THREE.MeshBasicMaterial({color: 0xd6f6ff, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide});
  const spots = [[0, 0, 4.4], [-7.5, 3, 2.7], [6.5, -3.4, 3.0], [3, 7.4, 2.3], [-4.4, -7, 2.1], [9.6, 5.2, 1.7], [-10.5, -2.4, 1.6]];
  const parts = {}; ['tower_A', 'tower_B', 'home_A', 'church', 'castle'].forEach((m) => parts[m] = modelGeo(m, 'yellow'));
  const bmat = new THREE.MeshLambertMaterial({map: MAT.kk[1]});
  spots.forEach(([x, z, r], k) => {
    const s = new THREE.Group(); const b = new GB();
    const cone = new THREE.ConeGeometry(r, r * 2.6, 11, 4); cone.rotateX(Math.PI); cone.translate(0, -r * 1.3, 0);
    const P = cone.attributes.position; for (let i = 0; i < P.count; i++){ const yy = P.getY(i); const j = 1 + (hash(i * 13 + k) - .5) * .25 * (yy < -.2 ? 1 : 0); P.setX(i, P.getX(i) * j); P.setZ(i, P.getZ(i) * j); }
    b.add(cone, M4(0, 0, 0), 0x7a6c5c); b.add(new THREE.CylinderGeometry(r * 1.02, r * .97, .3, 14).translate(0, -.08, 0), M4(0, 0, 0), 0x86b25e);
    s.add(new THREE.Mesh(b.geo(), rockM));
    const items = k === 0 ? [['castle', 0, 0, .9], ['tower_A', 1.6, .8, 1.0], ['tower_A', -1.4, 1.2, 1.1], ['tower_A', .6, -1.8, 1.2], ['church', -1.8, -1.4, .6]] : [];
    const nT = Math.round(r * 2.4);
    for (let i = 0; i < nT; i++){ const a = hash(k * 31 + i) * 6.283, rr = (.3 + .6 * hash(k * 17 + i)) * r * .8; items.push([hash(i + k) < .55 ? 'tower_A' : 'home_A', Math.cos(a) * rr, Math.sin(a) * rr, .45 + hash(i * 7 + k) * .5]); }
    for (const [m, ix, iz, sc] of items) for (const part of parts[m]){ const mesh = new THREE.Mesh(part.g, bmat); mesh.position.set(ix, .05, iz); mesh.scale.set(sc, sc * (m === 'tower_A' ? 1.8 : 1), sc); mesh.rotation.y = hash(ix * 9 + iz) * 6.28; mesh.castShadow = true; s.add(mesh); }
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(.6, 14), fall); wf.position.set(r * .75, -7, 0); wf.rotation.y = hash(k) * 3; s.add(wf);
    s.position.set(x, 30 + k * 1.4 + hash(k * 5) * 3, z); s.userData.ph = hash(k * 3) * 6; g.add(s); floats.push(s);
  });
}

// ------------------------------------------------------------ trees: real 3D models near the camera, baked impostors beyond (all 670k trees, no popping)
const TREE_SP = ['tree_a', 'tree_b', 'tree_c', 'pine_a', 'pine_b', 'pine_c', 'twist_a', 'twist_b', 'dead_a', 'dead_b', 'bush', 'bush_f'];
const TINTS = [[1, 1, 1], [.16, .32, .12], [.42, .55, .12], [.95, .42, .08], [.85, .12, .1], [1.0, .72, .12], [.95, .38, .6], [.5, .25, .85], [.1, .24, .16], [.35, .33, .3]];
const LEAFMAT = {leaf_n: 0, leaf_p: 1, leaf_t: 2, bark_n: 3, bark_t: 4, bark_d: 5};
const TR = {n: 0, x: null, z: null, y: null, s: null, h: null, t: null, r: null, grid: null, near: [], lastX: 1e9, lastZ: 1e9};
function treeMaterial(matName){
  const isLeaf = matName.startsWith('leaf');
  const m = new THREE.MeshLambertMaterial({map: MAT.leaf[LEAFMAT[matName]], alphaTest: isLeaf ? .45 : 0, side: isLeaf ? THREE.DoubleSide : THREE.FrontSide});
  m.onBeforeCompile = (sh) => {
    sh.uniforms.time = U.time;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3; transformed.x += sin(time * 1.3 + ph) * .025 * position.y * position.y; transformed.z += cos(time * 1.1 + ph) * .018 * position.y * position.y;');
    if (isLeaf) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
      #if defined( USE_COLOR )
      { vec3 tc = vColor; float l = dot(diffuseColor.rgb, vec3(.3, .59, .11)); if (tc.r + tc.g + tc.b < 2.95) diffuseColor.rgb = l * tc * 2.7; }
      #endif`);
  };
  return m;
}
function buildTrees(buf){
  const dv = new DataView(buf), n = buf.byteLength / 8; TR.n = n;
  TR.x = new Float32Array(n); TR.z = new Float32Array(n); TR.y = new Float32Array(n); TR.s = new Uint8Array(n); TR.h = new Float32Array(n); TR.t = new Uint8Array(n); TR.r = new Float32Array(n);
  const G = 2, gw = Math.ceil(WK / G), gh = Math.ceil(HK / G), cnt = new Uint32Array(gw * gh + 1);
  for (let i = 0; i < n; i++){ const o = i * 8; const x = dv.getUint16(o, true) / 65535 * WK, z = dv.getUint16(o + 2, true) / 65535 * HK;
    TR.x[i] = x; TR.z[i] = z; TR.y[i] = yAt(x, z) - .01; TR.s[i] = dv.getUint8(o + 4); TR.h[i] = dv.getUint8(o + 5) / 100; TR.t[i] = dv.getUint8(o + 6); TR.r[i] = dv.getUint8(o + 7) / 255 * 6.283;
    cnt[Math.min((z / G) | 0, gh - 1) * gw + Math.min((x / G) | 0, gw - 1) + 1]++; }
  for (let i = 1; i < cnt.length; i++) cnt[i] += cnt[i - 1];
  const idx = new Uint32Array(n), fill = cnt.slice();
  for (let i = 0; i < n; i++){ const c = Math.min((TR.z[i] / G) | 0, gh - 1) * gw + Math.min((TR.x[i] / G) | 0, gw - 1); idx[fill[c]++] = i; }
  TR.grid = {G, gw, gh, start: cnt, idx};
  // near meshes: one InstancedMesh per species & material part (capacity grows on demand)
  TR.meshes = TREE_SP.map((sp) => modelGeo(sp, 'n').map((part) => { const im = new THREE.InstancedMesh(part.g, treeMaterial(part.mat), 64); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    if (part.mat.startsWith('leaf')) { im.setColorAt(0, new THREE.Color(1, 1, 1)); } scene.add(im); return {im, part, cap: 64}; }));
  buildImpostors();
}
function refreshNearTrees(force){
  const cp = camera.position, gx = cp.x, gz = cp.z;
  const R = NEAR_T + 1.2, groundY = yAt(gx, gz);
  if (!force && Math.hypot(gx - TR.lastX, gz - TR.lastZ) < .6 && Math.abs(cp.y - (TR.lastY || 0)) < .6) return;
  TR.lastX = gx; TR.lastZ = gz; TR.lastY = cp.y;
  const per = TREE_SP.map(() => []);
  if (cp.y - groundY < R){
    const {G, gw, gh, start, idx} = TR.grid; const rr = Math.sqrt(Math.max(R * R - (cp.y - groundY) ** 2, 0));
    for (let cz = Math.max(((gz - rr) / G) | 0, 0); cz <= Math.min(((gz + rr) / G) | 0, gh - 1); cz++) for (let cx = Math.max(((gx - rr) / G) | 0, 0); cx <= Math.min(((gx + rr) / G) | 0, gw - 1); cx++){
      const c = cz * gw + cx; for (let k = start[c]; k < start[c + 1]; k++){ const i = idx[k]; const dx = TR.x[i] - gx, dz = TR.z[i] - gz, dy = TR.y[i] - cp.y; if (dx * dx + dz * dz + dy * dy < R * R) per[TR.s[i]].push(i); } }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  per.forEach((list, s) => TR.meshes[s].forEach((M) => {
    if (list.length > M.cap){ M.im.removeFromParent(); M.im.dispose(); M.cap = Math.ceil(list.length * 1.5); const im = new THREE.InstancedMesh(M.part.g, M.im.material, M.cap); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; if (M.part.mat.startsWith('leaf')) im.setColorAt(0, c.setRGB(1, 1, 1)); scene.add(im); M.im = im; }
    const leaf = M.part.mat.startsWith('leaf');
    list.forEach((i, k) => { e.set((hash(i) - .5) * .1, TR.r[i], 0); q.setFromEuler(e); v.set(TR.x[i], TR.y[i], TR.z[i]); const h = TR.h[i]; sc.set(h, h, h); m4.compose(v, q, sc); M.im.setMatrixAt(k, m4);
      if (leaf){ const T = TINTS[TR.t[i]]; c.setRGB(T[0], T[1], T[2]); M.im.setColorAt(k, c); } });
    M.im.count = list.length; M.im.instanceMatrix.needsUpdate = true; if (leaf && M.im.instanceColor) M.im.instanceColor.needsUpdate = true;
  }));
}
// impostor atlas: every species rendered from the side and from above (2 x 12 cells, 256 px), colour + leaf mask
function buildImpostors(){
  const CELL = 256, COLS = 8, ROWS = 3 * 2;   // 12 species -> 2 rows of 8 (side), next 2 rows (top) ; 6 rows total for safety
  const W = CELL * COLS, Hh = CELL * 4;
  const rtC = new THREE.WebGLRenderTarget(W, Hh, {samples: 4}), rtM = new THREE.WebGLRenderTarget(W, Hh, {samples: 4});
  rtC.texture.colorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xdde8ff, 0x6a5a40, 1.4)); const dl = new THREE.DirectionalLight(0xfff0dc, 2.0); dl.position.set(-.6, 1, .8); sc.add(dl);
  const oc = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .01, 20);
  const ext = [], prevVp = new THREE.Vector4(); renderer.getViewport(prevVp);
  const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear; renderer.autoClear = false;
  const maskMats = {};
  for (const pass of [0, 1]){
    renderer.setRenderTarget(pass ? rtM : rtC); renderer.setClearColor(0x000000, 0); renderer.clear();
    TREE_SP.forEach((sp, s) => {
      const bb = MODELS[sp].bb, wd = Math.max(bb[3] - bb[0], bb[5] - bb[2]), E = Math.max(1.0, wd) * 1.06; ext[s] = E;
      const grp = new THREE.Group();
      for (const part of modelGeo(sp, 'n')){
        let mat;
        if (pass === 0) mat = new THREE.MeshLambertMaterial({map: MAT.leaf[LEAFMAT[part.mat]], alphaTest: .45, side: THREE.DoubleSide});
        else { const leaf = part.mat.startsWith('leaf'); const k = part.mat; mat = maskMats[k] || (maskMats[k] = new THREE.MeshBasicMaterial({color: leaf ? 0xffffff : 0x000000, map: MAT.leaf[LEAFMAT[part.mat]], alphaTest: .45, side: THREE.DoubleSide})); if (leaf) mat.color.setRGB(1, 1, 1); }
        if (pass === 1 && part.mat.startsWith('leaf')){ mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = vec3(1.0);'); }; }
        grp.add(new THREE.Mesh(part.g, mat));
      }
      sc.add(grp);
      for (const view of [0, 1]){
        const col = s % COLS, row = (s / COLS | 0) + view * 2;
        const el = view ? 1.0 : .12, dist = 6;
        oc.left = -E / 2; oc.right = E / 2; oc.top = E / 2; oc.bottom = -E / 2; oc.updateProjectionMatrix();
        oc.position.set(0, .5 + Math.sin(el) * dist, Math.cos(el) * dist); oc.lookAt(0, .5, 0);
        renderer.setViewport(col * CELL, (3 - row) * CELL, CELL, CELL); renderer.render(sc, oc);
      }
      sc.remove(grp);
    });
  }
  renderer.setRenderTarget(prevRT); renderer.setViewport(prevVp); renderer.autoClear = prevAuto;
  U.impC = {value: rtC.texture}; U.impM = {value: rtM.texture};
  // instanced quads
  const n = TR.n, base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const ip = new Float32Array(n * 3), id = new Float32Array(n * 4);
  for (let i = 0; i < n; i++){ ip[i * 3] = TR.x[i]; ip[i * 3 + 1] = TR.y[i]; ip[i * 3 + 2] = TR.z[i]; id[i * 4] = TR.h[i]; id[i * 4 + 1] = TR.s[i]; id[i * 4 + 2] = TR.t[i]; id[i * 4 + 3] = hash(i * 7 + 3); }
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 3)); g.setAttribute('iD', new THREE.InstancedBufferAttribute(id, 4)); g.instanceCount = n;
  const tints = TINTS.map((t) => new THREE.Vector3(...t));
  const m = new THREE.ShaderMaterial({uniforms: {impC: U.impC, impM: U.impM, camPos: U.camPos, nearT: U.nearT, pxK: U.pxK, ext: {value: ext}, tints: {value: tints}, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, time: U.time, auxTex: U.auxTex},
    vertexShader: `attribute vec3 iPos; attribute vec4 iD; uniform vec3 camPos; uniform float nearT, pxK, time; uniform float ext[12];
      varying vec2 vUv, vUv2; varying float vView, vFade, vTint; varying vec3 vP;
      void main(){
        float h = iD.x; int sp = int(iD.y + .5);
        vec3 toC = camPos - iPos; float dist = length(toC);
        float px = h / dist * pxK; float keep = clamp(px * px / 3.0, 0.0, 1.0);
        if (iD.w > keep * 1.02 || dist < nearT){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float grow = inversesqrt(max(keep, .03));
        float E = ext[sp] * h * grow;
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float el = clamp(toC.y / dist, 0.0, 1.0); vView = smoothstep(.35, .8, el);
        vec3 upv = normalize(mix(vec3(0.0, 1.0, 0.0), Up, vView));
        vec3 c = iPos + vec3(0.0, h * .5, 0.0);
        float sw = sin(time * 1.2 + iPos.x * 1.7 + iPos.z) * .02 * (position.y + .5);
        vec3 p = c + R * (position.x + sw) * E + upv * position.y * E;
        float col = mod(float(sp), 8.0), row = floor(float(sp) / 8.0);
        vUv = vec2((col + uv.x) / 8.0, 1.0 - (row + 1.0 - uv.y) / 4.0); vUv2 = vec2(vUv.x, vUv.y - .5);
        vFade = smoothstep(nearT, nearT + 1.5, dist); vTint = iD.z; vP = c;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D impC, impM, auxTex; uniform vec3 tints[10], sun, sunCol, skyCol, gndCol, camPos; varying vec2 vUv, vUv2; varying float vView, vFade, vTint; varying vec3 vP;
      ${ATMO}
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 a = texture2D(impC, vUv), b = texture2D(impC, vUv2); vec4 c = mix(a, b, vView);
        float lm = mix(texture2D(impM, vUv).r, texture2D(impM, vUv2).r, vView);
        if (c.a < .5 || hh(gl_FragCoord.xy) > vFade) discard;
        vec3 col = c.rgb / max(c.a, .001);
        int ti = int(vTint + .5); vec3 tc = tints[ti];
        if (ti > 0){ float l = dot(col, vec3(.3, .59, .11)); col = mix(col, l * tc * 2.7, lm); }
        float sh = texture2D(auxTex, vP.xz / vec2(1024.0, 768.0)).a;
        col *= .62 + .38 * sh;
        col = atmo(col, vP, camPos);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`});
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh); TR.imp = mesh;
}

// ------------------------------------------------------------ smoke: chimneys, forges, the volcano
let smokeDirty = true, SMK = null;
function softTex(seed, dark){
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 26; i++){ const px = 64 + (r() - .5) * 60, py = 64 + (r() - .5) * 60, rad = 14 + r() * 30;
    const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 6.283); x.fill(); }
  const t = new THREE.CanvasTexture(c); return t;
}
function buildSmoke(){
  const MAXP = 9000, base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const e = new Float32Array(MAXP * 4), sd = new Float32Array(MAXP);
  g.setAttribute('iE', new THREE.InstancedBufferAttribute(e, 4)); g.setAttribute('iS', new THREE.InstancedBufferAttribute(sd, 1)); g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {map: {value: softTex(3)}, time: U.time, camPos: U.camPos, sun: U.sun, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, op: {value: 1}},
    vertexShader: `attribute vec4 iE; attribute float iS; uniform float time; varying vec2 vUv; varying float vA, vK, vT; varying vec3 vP;
      void main(){
        float k = iE.w; float sp = k > 1.5 ? .018 : k > .5 ? .07 : .09; float t = fract(time * sp + iS);
        float H = k > 1.5 ? 12.0 : k > .5 ? .55 : .38, S = k > 1.5 ? 1.5 : k > .5 ? .14 : .085;
        vec3 c = iE.xyz + vec3(t * t * H * .9 + sin(iS * 40.0) * .3 * t * S * 4.0, t * H, t * H * .35 + cos(iS * 31.0) * .2 * t * S * 4.0);
        float size = S * (.35 + 2.2 * t) * (k > 1.5 ? (1.0 + 1.3 * t) : 1.0);
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = iS * 6.283 + t * 1.5; vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;
        vec3 p = c + (R * q.x + Up * q.y) * size;
        vA = sin(3.14159 * t) * smoothstep(0.0, .12, t); vK = k; vT = t; vUv = uv; vP = c;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D map; uniform float op; uniform vec3 camPos; varying vec2 vUv; varying float vA, vK, vT; varying vec3 vP;
      ${ATMO}
      void main(){ float a = texture2D(map, vUv).a;
        vec3 col = vK > 1.5 ? mix(vec3(.9, .35, .1) * 2.0, vec3(.22, .2, .2), smoothstep(0.0, .18, vT)) : vK > .5 ? vec3(.32, .31, .31) : vec3(.74, .74, .76);
        col = mix(col, col * 1.25, smoothstep(.2, .8, vT));
        col = atmo(col, vP, camPos);
        gl_FragColor = vec4(col, a * vA * op * (vK > 1.5 ? .42 * smoothstep(1.5, 9.0, distance(vP, camPos)) : .6));
        #include <colorspace_fragment>
      }`});
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 6; scene.add(mesh);
  SMK = {mesh, g, e, sd, MAXP, last: null};
}
function updateSmoke(){
  if (!SMK) return;
  const cp = camera.position; const moved = !SMK.last || Math.hypot(cp.x - SMK.last.x, cp.z - SMK.last.z) > 2 || Math.abs(cp.y - SMK.last.y) > 3;
  if (!smokeDirty && !moved) return; smokeDirty = false; SMK.last = cp.clone();
  const L = [];
  for (const s of D.smoke || []) L.push([s[0], yAt(s[0], s[1]) + .3, s[1], 2, 0]);
  const near = BLD.smokeSrc.map((s) => [s, Math.hypot(s[0] - cp.x, s[2] - cp.z, s[1] - cp.y)]).filter((a) => a[1] < 60).sort((a, b) => a[1] - b[1]);
  let n = 0;
  for (const s of L){ for (let k = 0; k < 90 && n < SMK.MAXP; k++, n++){ SMK.e.set([s[0] + (hash(k) - .5) * .8, s[1], s[2] + (hash(k + 9) - .5) * .8, 2], n * 4); SMK.sd[n] = k / 90; } }
  for (const [s] of near){ const P = s[3] ? 7 : 5; if (n + P > SMK.MAXP) break; for (let k = 0; k < P; k++, n++){ SMK.e.set([s[0], s[1], s[2], s[3]], n * 4); SMK.sd[n] = (k + hash(s[0] * 31 + s[2])) / P; } }
  SMK.g.instanceCount = n; SMK.g.attributes.iE.needsUpdate = true; SMK.g.attributes.iS.needsUpdate = true;
}

// ------------------------------------------------------------ clouds: lit puff clusters (volumetric look), drifting
let CLD = null;
function buildClouds(){
  const NC = 40, puffs = [];
  for (let c = 0; c < NC; c++){
    const cx = -120 + rnd() * 1260, cz = -100 + rnd() * 960, cy = 34 + rnd() * 16, rx = 22 + rnd() * 40, rz = 14 + rnd() * 26, ry = 4 + rnd() * 5, n = 34 + (rnd() * 30 | 0);
    for (let i = 0; i < n; i++){ const a = rnd() * 6.283, r = Math.sqrt(rnd()); const ox = Math.cos(a) * r * rx, oz = Math.sin(a) * r * rz; const top = Math.sqrt(Math.max(1 - r * r, 0));
      const oy = (rnd() * .95 - .05) * ry * top; puffs.push([cx + ox, cy + oy, cz + oz, (11 + rnd() * 14) * (.55 + .55 * top), oy / ry, c]); }
  }
  const base = new THREE.PlaneGeometry(1, 1), n = puffs.length, g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const a = new Float32Array(n * 4), b = new Float32Array(n * 2);
  puffs.forEach((p, i) => { a.set([p[0], p[1], p[2], p[3]], i * 4); b.set([p[4], hash(i * 13 + 5)], i * 2); });
  g.setAttribute('iP', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iL', new THREE.InstancedBufferAttribute(b, 2)); g.instanceCount = n;
  const tx = [0, 1, 2, 3].map((k) => softTex(11 + k));
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {m0: {value: tx[0]}, m1: {value: tx[1]}, time: U.time, camPos: U.camPos, sun: U.sun, op: {value: 1}, fogCol: U.fogCol, sunCol: U.sunCol},
    vertexShader: `attribute vec4 iP; attribute vec2 iL; uniform float time; uniform vec3 camPos, sun; varying vec2 vUv; varying float vL, vA, vS;
      void main(){
        vec3 c = iP.xyz + vec3(time * 1.1, 0.0, time * .35);
        c.x = mod(c.x + 140.0, 1300.0) - 140.0; c.z = mod(c.z + 120.0, 1000.0) - 120.0;
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = iL.y * 6.283; vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;
        vec3 p = c + (R * q.x + Up * q.y) * iP.w;
        float d = distance(c, camPos);
        vA = smoothstep(iP.w * .6, iP.w * 2.4, d) * smoothstep(1900.0, 1000.0, d);
        vL = clamp(.55 + .45 * iL.x + .25 * dot(normalize(vec3(q.x, q.y, 0.0) + 1e-4), vec2(sun.x, sun.y).xyy), .25, 1.15);
        vS = iL.y; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D m0, m1; uniform float op; uniform vec3 fogCol, sunCol; varying vec2 vUv; varying float vL, vA, vS;
      void main(){ float a = vS > .5 ? texture2D(m0, vUv).a : texture2D(m1, vUv).a;
        vec3 shade = mix(vec3(.5, .56, .68), vec3(1.0, .97, .93), clamp(vL, 0.0, 1.0)) * (.85 + .15 * vL);
        vec3 col = mix(shade, fogCol, .28);
        gl_FragColor = vec4(col, a * a * vA * op * .9);
        #include <colorspace_fragment>
      }`});
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 10; scene.add(mesh); CLD = mesh;
}
let windG;
function buildWind(){
  const n = 90, pos = new Float32Array(n * 4 * 3), uv = new Float32Array(n * 4 * 2), seed = new Float32Array(n * 4), idx = [];
  for (let i = 0; i < n; i++){ const x = rnd() * WK, z = rnd() * HK, y = 6 + rnd() * 14, L = 10 + rnd() * 20, s = rnd() * 100;
    for (let k = 0; k < 4; k++){ const u = k & 1, v = k >> 1; pos.set([x + u * L, y, z + (v - .5) * .5], (i * 4 + k) * 3); uv.set([u, v], (i * 4 + k) * 2); seed[i * 4 + k] = s; }
    const o = i * 4; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {time: U.time, op: {value: 1}},
    vertexShader: `attribute float seed; uniform float time; varying vec2 vU; varying float vA;
      void main(){ vec3 p = position; float cyc = fract(time * .05 + seed * .37); p.x += cyc * 60.0 - 30.0; p.z += sin(time * .3 + seed) * 3.0; p.y += sin(p.x * .08 + time) * .6;
        vA = sin(cyc * 3.14159); vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'uniform float op; varying vec2 vU; varying float vA; void main(){ float a = sin(vU.x * 3.14159) * (1.0 - abs(vU.y * 2.0 - 1.0)); gl_FragColor = vec4(vec3(1.0), a * vA * .2 * op); }'});
  windG = new THREE.Mesh(g, m); windG.frustumCulled = false; windG.renderOrder = 11; scene.add(windG);
}
// ------------------------------------------------------------ labels
const labels = [];
function buildLabels(){
  const FC = D.factions;
  for (const k in FC){ const f = FC[k]; const txt = (f.label || f.name.toLocaleUpperCase('tr-TR')).split('\n').map(esc).join('<br>');
    labels.push({type: 'fac', key: k, x: f.x, z: f.z, y: 6, pri: 100, el: mk('m3l m3l-fac m3l-' + k, txt)}); }
  for (const p of D.places){
    const big = p.kind === 'capital', city = p.kind === 'city' || p.kind === 'floating' || p.kind === 'fortline';
    const nat = ['forest', 'lake', 'river', 'hills', 'islands', 'swamp', 'plains'].includes(p.kind);
    const cls = 'm3l ' + (big ? 'm3l-cap' : city ? 'm3l-city' : nat ? 'm3l-nat m3l-' + p.kind : p.kind === 'village' ? 'm3l-vil' : 'm3l-poi') + ' f-' + p.fac;
    const txt = (big ? '<i>✦</i>' : '') + esc(p.name);
    let y = p.kind === 'floating' ? 38 : yAt(p.x, p.z) + (big ? 3 : city ? 2.4 : nat ? 1 : p.kind === 'district' ? 1.6 : 1.2);
    if (p.style === 'volcano') y = yAt(p.x, p.z) + 3;
    const maxD = big ? 900 : city ? 600 : p.kind === 'islands' || p.kind === 'lake' && /Thyra/.test(p.name) ? 460 : nat ? 340 : p.kind === 'district' ? 170 : p.kind === 'village' ? 210 : 190;
    const minD = p.kind === 'district' ? 0 : 0;
    labels.push({type: 'place', p, x: p.x, z: p.z, y, pri: big ? 90 : city ? 80 : nat ? 40 : p.kind === 'district' ? 45 : p.kind === 'village' ? 30 : 35, maxD, minD, el: mk(cls, txt)});
  }
  labels.forEach((l) => { labelsEl.appendChild(l.el); l.el._l = l; });
  function mk(cls, html){ const e = document.createElement('button'); e.type = 'button'; e.className = cls; e.innerHTML = html; return e; }
}
const _v = new THREE.Vector3();
function updateLabels(){
  const w = cv.clientWidth, h = cv.clientHeight, d = cam.d, placed = [];
  const facVis = d > 300, facOp = Math.min(1, (d - 300) / 180);
  const order = labels.slice().sort((a, b) => b.pri - a.pri);
  for (const l of order){
    let vis = l.type === 'fac' ? facVis : d < l.maxD && !(d > 760 && l.p.kind !== 'capital');
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
function flyPlace(p){ const d = p.id === 'balahnur' ? 70 : p.kind === 'capital' || p.kind === 'city' ? 26 : p.kind === 'fortline' ? 90 : p.kind === 'floating' ? 75 : p.style === 'volcano' ? 32 : ['forest', 'hills', 'plains', 'islands'].includes(p.kind) ? 110 : p.kind === 'district' ? 16 : 12; flyTo(p.x, p.z, d); }
function onLabelClick(e){
  const el = e.target.closest('.m3l'); if (!el || !el._l) return; const l = el._l;
  if (l.type === 'fac'){ const F = D.factions[l.key]; flyTo(F.x, F.z, 560); showFaction(l.key); }
  else { flyPlace(l.p); showPlace(l.p); }
}

// ------------------------------------------------------------ camera & input
function tiltFor(d){ const t = Math.min(Math.max((Math.log(d) - Math.log(DMIN)) / (Math.log(DMAX) - Math.log(DMIN)), 0), 1); return (19 + 37 * Math.pow(t, 1.35)) * Math.PI / 180; }
function applyCam(){
  const pitch = Math.min(Math.max(tiltFor(cam.d) + cam.tilt, .16), 1.45), ty = yAt(cam.x, cam.z) * Math.min(1, 120 / cam.d);
  const cy = Math.sin(pitch) * cam.d, ch = Math.cos(pitch) * cam.d;
  camera.position.set(cam.x - Math.sin(cam.yaw) * ch, ty + cy, cam.z + Math.cos(cam.yaw) * ch);
  const minY = Math.max(yAt(camera.position.x, camera.position.z), yAt((camera.position.x + cam.x) / 2, (camera.position.z + cam.z) / 2)) + .45; if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(cam.x, ty, cam.z);
  camera.near = Math.min(Math.max(cam.d * .02, .03), 25); camera.far = Math.max(cam.d * 6, 2600); camera.updateProjectionMatrix();
  camera.updateMatrixWorld(); U.camPos.value.copy(camera.position); U.camD.value = cam.d;
}
function flyTo(x, z, d){ goal.x = x; goal.z = z; goal.d = d; flying = 1; }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function groundAt(cx, cy, planeY = 0){
  const r = cv.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, dvec = ray.ray.direction; if (dvec.y > -1e-4) return null; const t = (planeY - o.y) / dvec.y; return {x: o.x + dvec.x * t, z: o.z + dvec.z * t};
}
function pickTerrain(cx, cy){
  const r = cv.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, dv = ray.ray.direction, step = Math.max(cam.d / 300, .08);
  for (let t = 0; t < cam.d * 8; t += step){ const x = o.x + dv.x * t, y = o.y + dv.y * t, z = o.z + dv.z * t; if (y <= yAt(x, z)) return {x, z}; if (y < -1) return {x, z}; }
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
    drag = {rot, x: e.clientX, y: e.clientY, g: rot ? null : groundAt(e.clientX, e.clientY, yAt(cam.x, cam.z) * Math.min(1, 120 / cam.d))};
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag){ hoverAt(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
    if (drag.rot){ cam.yaw += dx * .005; cam.tilt = Math.min(Math.max(cam.tilt - dy * .004, -.3), .9); goal.yaw = cam.yaw; goal.tilt = cam.tilt; drag.x = e.clientX; drag.y = e.clientY; }
    else if (drag.g){ const g = groundAt(e.clientX, e.clientY, yAt(cam.x, cam.z) * Math.min(1, 120 / cam.d)); if (g){ cam.x += drag.g.x - g.x; cam.z += drag.g.z - g.z; clampCam(cam); goal.x = cam.x; goal.z = cam.z; applyCam(); } }
    dirtyLabels = true;
  });
  const up = (e) => { if (!drag) return; const was = drag; drag = null; if (moved < 5 && !was.rot) clickAt(e.clientX, e.clientY); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault(); flying = 0;
    const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * .0022), nd = Math.min(Math.max(goal.d * k, DMIN), DMAX);
    const g = groundAt(e.clientX, e.clientY);
    const gp = pickTerrain(e.clientX, e.clientY) || g;
    if (gp){ const f = 1 - nd / goal.d; goal.x += (gp.x - goal.x) * f * .9; goal.z += (gp.z - goal.z) * f * .9; clampCam(goal); }
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
const _tv = new THREE.Vector3();
function frame(now){
  raf = requestAnimationFrame(frame);
  const dt = Math.min((now - (lastT || now)) / 1000, .05); lastT = now; clock += dt; U.time.value = clock;
  const r = 1 - Math.exp(-dt * (flying ? 2.6 : 9));
  const ld = Math.log(cam.d) + (Math.log(goal.d) - Math.log(cam.d)) * r;
  const moving = Math.abs(goal.x - cam.x) + Math.abs(goal.z - cam.z) + Math.abs(goal.d - cam.d) > .01;
  cam.x += (goal.x - cam.x) * r; cam.z += (goal.z - cam.z) * r; cam.d = Math.exp(ld);
  cam.yaw += (goal.yaw - cam.yaw) * r; cam.tilt += (goal.tilt - cam.tilt) * r;
  if (flying && !moving) flying = 0;
  applyCam(); updateFrame(dt);
  renderer.render(scene, camera);
  if (sunLight.castShadow && sunLight.shadow.map){ U.shMap.value = sunLight.shadow.map.texture; U.shOn.value = 1; } else U.shOn.value = 0;
  updateLabels();
  const g1 = groundAt(innerWidth / 2 - 50, innerHeight * .9), g2 = groundAt(innerWidth / 2 + 50, innerHeight * .9);
  if (g1 && g2){ const km100 = Math.hypot(g2.x - g1.x, g2.z - g1.z); const nice = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find((n) => n / km100 * 100 > 60) || 500;
    scaleEl.querySelector('i').style.width = (nice / km100 * 100).toFixed(0) + 'px'; scaleEl.querySelector('span').textContent = (nice < 1 ? '500 m' : nice + ' km'); }
}
function updateFrame(dt){
  const d = cam.d, tN = Math.min(Math.max((Math.log(d) - Math.log(DMIN)) / (Math.log(DMAX) - Math.log(DMIN)), 0), 1);
  updateChunks(); updateBuildings(); refreshNearTrees(false); updateSmoke();
  U.borderVis.value = Math.min(1, Math.max(0, (d - 220) / 250)) * .9;
  U.fogK.value = .00016 + .0032 * Math.pow(1 - tN, 2.6); scene.fog.density = U.fogK.value;
  U.hazeK.value = (1 - tN) * .6;
  U.pxK.value = (cv.clientHeight * renderer.getPixelRatio()) / (2 * Math.tan(camera.fov * Math.PI / 360));
  // sun shadows follow the view (texel-snapped to avoid shimmering)
  const S = Math.min(Math.max(d * 1.25, 5), 70), on = d < 140;
  sunLight.castShadow = on;
  if (on){
    const tx = cam.x - Math.sin(cam.yaw) * d * .25, tz = cam.z + Math.cos(cam.yaw) * d * .25, ty = yAt(cam.x, cam.z);
    const tex_ = S * 2 / 4096; const sx = Math.round(tx / tex_) * tex_, sz = Math.round(tz / tex_) * tex_;
    sunLight.target.position.set(sx, ty, sz); sunLight.position.set(sx + SUN.x * 150, ty + SUN.y * 150, sz + SUN.z * 150);
    const sc = sunLight.shadow.camera; sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 1; sc.far = 320; sc.updateProjectionMatrix();
    sunLight.target.updateMatrixWorld(); sunLight.updateMatrixWorld();
  }
  routeMats.forEach(({m, kind}) => { m.uniforms.op.value = kind === 'dirt' ? Math.min(1, Math.max(0, (160 - d) / 80)) : kind === 'road' ? Math.min(.85, Math.max(0, (d - 70) / 80)) * Math.min(1, Math.max(0, (420 - d) / 160))
    : kind === 'trade' ? Math.min(1, Math.max(0, (d - 60) / 90)) * Math.min(1, Math.max(.35, (900 - d) / 300)) : Math.min(1, Math.max(.3, (900 - d) / 300)); });
  if (TR.imp) TR.imp.visible = d < 520;
  if (CLD){ CLD.material.uniforms.op.value = .5 + .3 * tN; }
  if (windG) windG.material.uniforms.op.value = Math.min(1, Math.max(0, (d - 30) / 80)) * Math.min(1, Math.max(0, (500 - d) / 200));
  for (const s2 of floats){ s2.position.y += Math.sin(clock * .6 + s2.userData.ph) * .004; s2.rotation.y += dt * .01; }
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
    loadEl.classList.add('done'); resize(); applyCam(); refreshNearTrees(true);
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
window.__ulvMap3D = {open, close, fly: flyTo, jump: (x, z, d, yaw, tilt) => { flyTo(x, z, d); if (yaw != null) goal.yaw = yaw; if (tilt != null) goal.tilt = tilt; Object.assign(cam, goal); flying = 0; },
  places: () => D && D.places.map((p) => ({id: p.id, name: p.name, x: p.x, z: p.z, kind: p.kind})), cam: () => ({...cam}), stats: () => renderer ? {calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures} : null, continents: CONTINENTS};
