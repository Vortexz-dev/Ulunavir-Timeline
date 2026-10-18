// t141 — Horaghfus 3D haritası (v3). three.js r169 (assets/vendor/three), derleme adımı yok.
// Dünya birimi: 1 = 1 km. Kıta: 1024 x 768 km. Yükseklikler EX kat abartılı.
// Veriler: assets/map3d/ (site-build/map3d/v2/*.py ile üretilir). Yer adları/açıklamaları: assets/map3d/yerler.json (elle düzenlenebilir).
import * as THREE from './vendor/three/three.module.min.js';

const V = new URL(import.meta.url).searchParams.get('v') || '1';
const BASE = new URL('./map3d/', import.meta.url).href;
const url = (f) => BASE + f + '?v=' + V;
let EX = 3.0; let VEGP = null;                        // dikey abartı (meta.json'dan)
const WK = 1024, HK = 768;           // dünya boyutu (km)
const CH = 128, NCX = 8, NCY = 6, SEG = 256;   // arazi parçaları: hepsi tam çözünürlük (LOD geçişi yok)
const DMIN = 4, DMAX = 1150, DZOOM = 3000;   // v4 B: zoom out to the whole world
const NEAR_T = 3.8;   // C3 perf: was 8.5 (15M tris + shadow pass in flat views); impostors take over beyond (~70 px trees)                  // bu mesafeye kadar ağaçlar gerçek 3D model
const NEAR_B = 75;                   // bu mesafeye kadar binalar ayrıntılı model
const CONTINENTS = [{id: 'horaghfus', name: 'Horaghfus', ox: 0, oz: 0}];
const KIND_TR = {capital: 'Başkent', city: 'Şehir', village: 'Köy', district: 'Şehir semti', landmark: 'Önemli yer', forest: 'Orman', lake: 'Göl', river: 'Nehir',
  hills: 'Tepeler', islands: 'Adalar', swamp: 'Bataklık', plains: 'Düzlük', floating: 'Uçan şehir', fortline: 'Sınır kaleleri'};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

let root, cv, renderer, scene, camera, labelsEl, cardEl, loadEl, hintEl, scaleEl;
let D = null, HGT = null, HW = 2048, HH = 1536, FAC = null, META = null, MODELS = null, MBUF = null;
let built = false, building = null, isOpen = false, raf = 0, lastT = 0, clock = 0, SAFE = false, DPR_MAX = 1.5, CTX_LOST = false;
const SUN = new THREE.Vector3(-0.78, 0.52, 0.2).normalize();
const U = {time: {value: 0}, sun: {value: SUN}, hover: {value: new THREE.Vector4(0, 0, 0, 0)}, borderVis: {value: 1}, camPos: {value: new THREE.Vector3()},
  fogCol: {value: new THREE.Color(0.58, 0.70, 0.84)}, fogK: {value: 0.0012}, hazeK: {value: 1}, sunCol: {value: new THREE.Color(1.0, 0.93, 0.82).multiplyScalar(2.1)},
  skyCol: {value: new THREE.Color(0.42, 0.55, 0.75)}, gndCol: {value: new THREE.Color(0.30, 0.27, 0.22)}, ex: {value: 3.0}, camD: {value: 1000},
  shMap: {value: null}, shMat: {value: new THREE.Matrix4()}, shOn: {value: 0}, nearT: {value: NEAR_T}, pxK: {value: 600}, swampC: {value: new THREE.Vector3(0, 0, 0)}, fineK: {value: 0}, nightK: {value: 0}, bakeK: {value: 1}, skyZen: {value: new THREE.Color(.11, .27, .55)}, plP: {value: Array.from({length: 50}, () => new THREE.Vector4(0, -99, 0, 0))}, plN: {value: 0}, vAct: {value: new Float32Array(24)}};
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
  if (x < 0 || z < 0 || x > WK || z > HK) return EXT.conts.length ? extY(x, z) : -3;
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
let MASKP = null, AUXP = null;
function pixelsAt(bm, w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(bm, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; }
function maskAt(x, z, ch){ if (!MASKP) return 0; const i = Math.min(Math.max(z * 2 | 0, 0), 1535) * 2048 + Math.min(Math.max(x * 2 | 0, 0), 2047); return MASKP[i * 4 + ch] / 255; }
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
  vec2 ob = max(vec2(-150.0, -170.0) - P.xz, P.xz - vec2(2310.0, 2290.0)); float edge = smoothstep(0.0, 260.0, max(ob.x, ob.y));
  return mix(col, fogCol, clamp(f + mist + edge, 0.0, 1.0));
}
uniform vec4 plP[50]; uniform int plN;
vec3 nightLit(vec3 P, vec3 N){ vec3 s = vec3(0.0);
  for (int i = 0; i < 50; i++){ if (i >= plN) break; vec3 d = plP[i].xyz - P; float l2 = dot(d, d); s += vec3(1.0, .62, .3) * plP[i].w * max(dot(N, d * inversesqrt(l2 + 1e-6)), 0.0) * .012 / (l2 + .004) * smoothstep(2.6, .4, l2); }
  return s; }`;

// ------------------------------------------------------------ DOM
function makeDom(){
  root = document.createElement('div'); root.className = 'm3d'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Horaghfus 3D haritası');
  root.innerHTML = '<canvas class="m3d-cv"></canvas><div class="m3d-labels"></div>' +
    '<div class="m3d-top"><div class="m3d-title"><b>Horaghfus</b><span>3D Harita · beta</span></div>' +
    '<div class="m3d-btns"><button type="button" class="m3d-world" title="Dünya küresini göster">Dünya</button><button type="button" class="m3d-home" title="Tüm kıtayı göster">Kıta</button><button type="button" class="m3d-x" aria-label="Haritayı kapat (Esc)">✕</button></div></div>' +
    '<div class="m3d-hint">Sol tık + sürükle: kaydır · Sağ tık + sürükle: döndür / eğ · Tekerlek: yakınlaş · İsme tıkla: bilgi kartı</div>' +
    '<div class="m3d-scale"><i></i><span></span></div>' +
    '<aside class="m3d-card" hidden><button type="button" class="m3d-cx" aria-label="Kartı kapat">✕</button><div class="m3d-ci"></div></aside>' +
    '<div class="m3d-load"><div class="m3d-ring"></div><p>Horaghfus yükleniyor… <span>0%</span></p></div>';
  document.body.appendChild(root);
  cv = root.querySelector('.m3d-cv'); labelsEl = root.querySelector('.m3d-labels'); cardEl = root.querySelector('.m3d-card');
  loadEl = root.querySelector('.m3d-load'); hintEl = root.querySelector('.m3d-hint'); scaleEl = root.querySelector('.m3d-scale');
  root.querySelector('.m3d-x').addEventListener('click', close);
  root.querySelector('.m3d-home').addEventListener('click', () => { if (GLB.on){ exitGlobe(null); return; } flyTo(512, 400, 1000); goal.yaw = 0; goal.tilt = 0; closeCard(); });
  root.querySelector('.m3d-world').addEventListener('click', () => { if (!GLB.on) enterGlobe(); });   // Step 3: Dünya = küre
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
  // v4 hotfix: GPU safety. Safe mode (after a context loss) = no MSAA, 1x pixels, smaller shadow map. Context loss -> graceful restart, never a dead page.
  SAFE = (() => { try { return sessionStorage.getItem('m3dSafe') === '1'; } catch (e) { return false; } })();
  const mk = (aa) => new THREE.WebGLRenderer({canvas: cv, antialias: aa, powerPreference: 'high-performance'});
  try { renderer = mk(false); }   // E1: MSAA off (Phoenix: stipple/shimmer on moving trees)
   catch (e){ console.warn('webgl retry', e); SAFE = true; renderer = mk(false); }
  DPR_MAX = SAFE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(DPR_MAX);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onCtxLost(); }, false);
  cv.addEventListener('webglcontextrestored', () => onCtxRestored(), false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // D4
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fb0cc);
  scene.fog = new THREE.FogExp2(U.fogCol.value.getHex(), 0.001);
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 6000);
  sunLight = new THREE.DirectionalLight(0xfff0dc, 2.4); sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(SAFE ? 2048 : 4096, SAFE ? 2048 : 4096); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight); scene.add(sunLight.target);
  hemi = new THREE.HemisphereLight(0xc8dcff, 0x5e5340, 1.25); scene.add(hemi);
  let done = 0; const step = (n) => (x) => { done += n; progress(Math.min(done, .99)); return x; };
  const J = (f, n) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(f); return r.json(); }).then(step(n));
  const BIN = (f, n) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(f); return r.arrayBuffer(); }).then(step(n));
  const G_NAMES = ['g0_grass', 'g1_meadow', 'g2_dirt', 'g3_sand', 'g4_rock', 'g5_snow', 'g6_gravel'], N_NAMES = ['n0_grass', 'n1_rock', 'n2_dirt'];
  let [meta, data, yer, hBm, nBm, mBm, fBm, aBm, lo, treesBuf, bldBuf, models, mbuf, gT, nT, kkBm, leafBms, watBm, vegBm, extX] = await Promise.all([
    J('meta.json', .02), J('places3d.json', .04), fetch(url('yerler.json')).then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    loadImg('height.png').then(step(.12)), loadImg('normal.webp').then(step(.12)), loadImg('mask.webp').then(step(.08)), loadImg('fac.png').then(step(.04)), loadImg('aux.png').then(step(.04)),
    loadImg('color_lo.webp').then(step(.08)), BIN('trees.bin', .08), BIN('buildings.bin', .03), J('models.json', .01), BIN('models.bin', .08),
    Promise.all(G_NAMES.map((n) => loadImg('tex/' + n + '.webp'))).then(step(.08)), Promise.all(N_NAMES.map((n) => loadImg('tex/' + n + '.webp'))).then(step(.04)),
    loadImg('tex/kk.png'), Promise.all(['leaf_n', 'leaf_p', 'leaf_t', 'bark_n', 'bark_t', 'bark_d', 'flat'].map((n) => loadImg('tex/' + n + (n === 'flat' ? '.png' : '.webp')))).then(step(.04)),
    loadImg('wat.png').then(step(.01)), loadImg('veg.png').then(step(.03)), loadExt().then(step(.06))]);
  META = meta; D = data; HW = meta.hgrid[0]; HH = meta.hgrid[1]; EX = meta.ex || 3; U.ex.value = EX; MODELS = models.models; MBUF = mbuf;
  mergeYerler(yer);
  if (D.swamp) U.swampC.value.set(D.swamp[0], D.swamp[1], D.swamp[2]);
  const hp = pixels(hBm); HGT = new Float32Array(HW * HH); const span = meta.hmax - meta.hmin;
  for (let i = 0, j = 0; i < HGT.length; i++, j += 4) HGT[i] = (hp[j] * 256 + hp[j + 1]) / 65535 * span + meta.hmin;
  VW = HW + 1; VH = new Float32Array(VW * (HH + 1));
  for (let j = 0; j <= HH; j++) for (let i = 0; i <= HW; i++){ let h = hAt(i * .5, j * .5) * EX; if (h > -.012 && h < .012) h = h < 0 ? -.012 : .012; VH[j * VW + i] = h; }   // C3: keep terrain clearly above/below the water plane (no shoreline z-fighting / 'breathing' water)
  const fp = pixels(fBm), ap = pixels(aBm); FAC = new Uint8Array(HW * HH);
  for (let i = 0, j = 0; i < FAC.length; i++, j += 4){ const m = Math.max(fp[j], fp[j + 1], fp[j + 2], ap[j]); if (m > 110) FAC[i] = m === fp[j] ? 1 : m === fp[j + 1] ? 2 : m === fp[j + 2] ? 3 : 4; }
  MASKP = pixelsAt(mBm, 2048, 1536); AUXP = ap; VEGP = pixelsAt(vegBm, 2048, 1536);
  const extBld = initExt(extX);
  if (extBld){ const u = new Uint8Array(bldBuf.byteLength + extBld.byteLength); u.set(new Uint8Array(bldBuf), 0); u.set(new Uint8Array(extBld), bldBuf.byteLength); bldBuf = u.buffer; }
  if (!U.extW){ U.extW = {value: new THREE.Texture()}; U.extXf = {value: new THREE.Vector3(0, 0, 0)}; }
  U.watTex = {value: tex(watBm, false)}; U.watTex.value.magFilter = THREE.NearestFilter; U.watTex.value.minFilter = THREE.NearestFilter; U.watTex.value.generateMipmaps = false;
  U.watFlow = {value: tex(watBm, false)};
  U.nTex = {value: tex(nBm, false)}; U.mTex = {value: tex(mBm, false)}; U.facTex = {value: tex(fBm, false)}; U.auxTex = {value: tex(aBm, false)};
  U.loTex = {value: tex(lo, true)};
  U.gTex = {value: arrayTex(gT, true)}; U.gNrm = {value: arrayTex(nT, false)};
  MAT.kk = paletteTextures(kkBm);
  MAT.leaf = leafBms.map((b, i) => { const t = tex(b, true, 4); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  MAT.flat = MAT.leaf[6]; MAT.flat.minFilter = THREE.NearestMipmapNearestFilter; MAT.flat.magFilter = THREE.NearestFilter;
  buildSky(); buildTerrain(); if (EXT.W) buildExtTerrain(); buildOcean(); buildRoads(); buildBuildings(bldBuf); buildBridges(); buildShips(); buildSpecial(); buildTrees(treesBuf);
  buildSmoke(); buildClouds(); buildCirrus(); buildWind(); buildFields(); buildVeg(); buildBergs(); buildMist(); buildLabels(); buildNightLights();
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
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
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
  const m = new THREE.ShaderMaterial({depthWrite: false, side: THREE.BackSide, fog: false, uniforms: {sun: U.sun, fogCol: U.fogCol, time: U.time, nightK: U.nightK, zen: U.skyZen, sunCol: U.sunCol},
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 sun, fogCol, zen, sunCol; uniform float time, nightK; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 hor = fogCol;
        vec3 c = mix(hor, zen, pow(clamp(y, 0.0, 1.0), .55));
        c = mix(c, hor * .92, smoothstep(0.0, -.15, y));
        float s = max(dot(d, sun), 0.0);
        float lowS = 1.0 - smoothstep(.0, .35, sun.y);
        c += vec3(1.0, .5, .22) * pow(s, 3.0) * lowS * smoothstep(-.25, .15, y) * (1.0 - smoothstep(.45, .0, sun.y + .12)) * .9 * (1.0 - nightK);   // sunrise / sunset glow
        c += vec3(1.0, .82, .6) * (pow(s, 8.0) * .25 + pow(s, 64.0) * .5) * (1.0 - nightK) + vec3(1.0, .95, .85) * smoothstep(.9995, .99975, s) * 6.0 * (1.0 - nightK);
        if (nightK > .01){ vec3 q = floor(d * 420.0); float st = fract(sin(dot(q, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          c += vec3(.9, .93, 1.0) * smoothstep(.9975, 1.0, st) * smoothstep(.02, .25, y) * nightK * (.6 + .4 * sin(time * 3.0 + st * 99.0));
          c += vec3(.9, .92, 1.0) * smoothstep(.9992, .9997, s) * nightK * 2.0; }   // moon disc (light comes from SUN at night)
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`});
  const s = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), m); s.frustumCulled = false; s.renderOrder = -10; s.onBeforeRender = () => s.position.copy(camera.position); scene.add(s);
}

// ------------------------------------------------------------ terrain
const TERR_V = `
uniform mat4 shMat; varying vec2 vW; varying vec3 vP; varying vec4 vSh;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; vP = wp.xyz; vSh = shMat * wp; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const TERR_F = `
precision highp sampler2DArray;
uniform sampler2D colTex, nTex, mTex, facTex, auxTex, shMap; uniform highp sampler2DArray gTex, gNrm;
uniform vec4 tileXf, hover; uniform vec3 sun, camPos, sunCol, skyCol, gndCol, volc, swampC; uniform float borderVis, time, ex, shOn, camD, bakeK;
varying vec2 vW; varying vec3 vP; varying vec4 vSh;
${NOISE}
${ATMO}
#include <packing>
float edge(float w){ return smoothstep(.36, .5, w) * (1.0 - smoothstep(.5, .64, w)); }
vec3 Lt(float i, vec2 uv){ float k = smoothstep(.38, .62, vn(uv * .13 + i * 3.1)); vec3 a = texture(gTex, vec3(uv, i)).rgb; if (k < .01) return a; vec3 b = texture(gTex, vec3(mat2(.8, -.6, .6, .8) * uv + vec2(.37, .71), i)).rgb; return mix(a, b, k); }     // D3: no visible tiling
vec3 avgL(float i){ return textureLod(gTex, vec3(.5, .5, i), 11.0).rgb + 1e-3; }
uniform float fineK;
vec3 det(float i, vec2 w){ vec3 a = mix(Lt(i, w * 3.6), Lt(i, w * .71 + .37), .42); return mix(a, a * Lt(i, w * 14.0) / avgL(i), fineK * .55); }
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
  float dk = 1.0 - smoothstep(22.0, 85.0, dist);
  float nz = fbm(vW * .35), nz2 = vn(vW * 2.3);
  float mlum = dot(base, vec3(.3, .59, .11)), msat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
  // --- splat weights (slope, height, painted snow, beaches)
  float wRock = smoothstep(.18, .42, slope + (nz - .5) * .12) * smoothstep(.08, .5, hk) + smoothstep(1.6, 2.8, hk) * .7 * smoothstep(.06, .22, slope);
  float snowLine = mix(3.3, 4.3, smoothstep(.12, .6, uv.y)) + (nz - .5) * .6;
  float painted = smoothstep(.5, .7, mlum) * (1.0 - smoothstep(.05, .14, msat)) * smoothstep(2.3, 3.3, hk);
  float wSnow = max(smoothstep(snowLine, snowLine + .4, hk) * (1.0 - smoothstep(.3, .55, slope + (nz2 - .5) * .15)), painted * (1.0 - smoothstep(.32, .6, slope + (nz2 - .5) * .15)));
  float wSand = smoothstep(.022, .007, hk) * step(-.01, hk) * (1.0 - wRock) * smoothstep(.0, .5, A.g);
  float wMead = smoothstep(.35, .75, nz + (nz2 - .5) * .3);
  // --- macro colour, optionally modulated by detail textures (keeps Phoenix's painted colours)
  vec3 alb = base;
  vec3 dn = vec3(0.0);
  if (dk > 0.0){
    vec3 g0 = pow(det(0.0, vW) / avgL(0.0), vec3(1.25)), g1 = pow(det(1.0, vW) / avgL(1.0), vec3(1.25));
    vec3 grassD = base * mix(g0, g1, wMead);
    // rock: triplanar on steep faces
    vec3 an = abs(n);
    vec3 rk = (Lt(4.0, vec2(vW.x, vP.y / ex * 1.0) * 1.4) * an.z + Lt(4.0, vec2(vW.y, vP.y / ex) * 1.4) * an.x + Lt(4.0, vW * 1.4) * an.y) / (an.x + an.y + an.z);
    vec3 rockD = mix(rk * 1.05, base * rk / avgL(4.0), .35);
    vec3 snowD = Lt(5.0, vW * 1.1) * vec3(.97, .99, 1.03) * 1.04;
    vec3 sandD = base * vec3(1.08, 1.03, .92) * det(3.0, vW) / avgL(3.0);
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
  alb = mix(alb, mix(alb, base * vec3(1.08, 1.03, .92), wSand), 1.0 - dk);
  // Phoenix painted whole mountain ranges white: below the snow line turn that paint into alpine rock / scree / meadow
  float pLow = smoothstep(.5, .68, mlum) * (1.0 - smoothstep(.06, .15, msat)) * (1.0 - clamp(wSnow, 0.0, 1.0)) * smoothstep(.12, .5, hk);
  if (pLow > .01){
    vec3 alp = mix(lin(vec3(.47, .5, .36)), lin(vec3(.5, .47, .43)), smoothstep(.08, .3, slope + (nz - .5) * .2));
    alp = mix(alp, lin(vec3(.62, .6, .57)), smoothstep(2.0, 2.9, hk) * .6);
    if (dk > 0.0) alp *= mix(vec3(1.0), Lt(4.0, vW * 1.4) / avgL(4.0), dk * .8);
    alb = mix(alb, alp * (.82 + .36 * nz), pLow * .9);
  }
  // v3: dwarf highlands - less pale: alpine meadow in hollows, brown-grey rock on slopes, scree higher up
  float dwf = texture2D(facTex, uv).g * smoothstep(.2, .8, hk) * (1.0 - clamp(wSnow, 0.0, 1.0));
  if (dwf > .01){
    vec3 da = mix(lin(vec3(.34, .38, .22)), lin(vec3(.4, .36, .31)), smoothstep(.07, .24, slope + (nz - .5) * .18));
    da = mix(da, lin(vec3(.31, .29, .27)), smoothstep(.3, .55, slope) * .8);
    da = mix(da, lin(vec3(.52, .5, .47)), smoothstep(2.4, 3.4, hk) * .55);
    if (dk > 0.0) da *= mix(vec3(1.0), Lt(4.0, vW * 1.4) / avgL(4.0), dk * smoothstep(.06, .25, slope) * .9);
    alb = mix(alb, da * (.8 + .4 * nz), dwf * .78);
  }
  // --- farm fields, urban ground, dirt roads, stream beds
  if (M.b > .01) alb *= 1.0 - M.b * .25;
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
  float pool = 1.0 - texture2D(facTex, uv).a;
  float swk = swampC.z > 0.0 ? 1.0 - smoothstep(swampC.z * .7, swampC.z * 1.15, length(vW - swampC.xy) + (nz - .5) * 6.0) : 0.0;
  alb *= mix(vec3(1.0), vec3(.62, .7, .5), swk * .8);
  float wet = 0.0;
  if (M.g > .02){ wet = smoothstep(.02, .5, M.g); alb *= 1.0 - wet * .38; }
  // --- light
  vec3 N = normalize(n + dn);
  float dif = max(dot(N, sun), 0.0);
  float sh = mix(1.0, A.a, smoothstep(0.0, .05, hk + .02) * bakeK);
  sh = min(sh, shadowAt());
  float cs = smoothstep(.52, .8, fbm(vW * .011 + vec2(time * .005, time * .0018)));
  vec3 amb = mix(gndCol, skyCol, N.y * .5 + .5);
  float ao = 1.0 - smoothstep(.25, .7, slope) * .2;
  vec3 col = alb * (amb * .62 * ao + sunCol * dif * sh * (1.0 - .42 * cs)) + alb * nightLit(vP, N);
  // stream water shimmer in the bed
  if (M.g > .45){ float wc = smoothstep(.45, .85, M.g); vec3 wcol = mix(lin(vec3(.18, .32, .38)), skyCol * .8, .4) + sunCol * pow(max(dot(reflect(-sun, vec3(0.0, 1.0, 0.0)), normalize(camPos - vP)), 0.0), 40.0) * .4;
    col = mix(col, wcol, wc * .85); }
  if (pool > .05){ float pb = pool + (vn(vW * 1.7) - .5) * .55 + (nz2 - .5) * .25;
    float pk = smoothstep(.42, .62, pb), rim = smoothstep(.25, .42, pb) * (1.0 - pk);
    float scum = smoothstep(.55, .8, vn(vW * 11.0 + 3.0)) * (1.0 - smoothstep(.62, .85, pb));
    vec3 mw = lin(vec3(.075, .085, .05)) + skyCol * .045 + sunCol * pow(max(dot(reflect(-sun, vec3(0.0, 1.0, 0.0)), normalize(camPos - vP)), 0.0), 60.0) * .3;
    mw = mix(mw, lin(vec3(.2, .24, .1)) * (amb * .6 + sunCol * dif * .8), scum * .7);
    col *= 1.0 - rim * .35;
    col = mix(col, mw * (.85 + .3 * vn(vW * 6.0 + time * .03)), pk * .95); }
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
const chunks = []; let TLOD = 1;
function chunkGeo(cx, cy, step = 1){
  const S = SEG / step, N = S + 1, pos = new Float32Array(N * N * 3), idx = new Uint32Array(S * S * 6);
  const i0 = cx * CH * 2, j0 = cy * CH * 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const k = (j * N + i) * 3, gi = i0 + i * step, gj = j0 + j * step; pos[k] = gi * .5; pos[k + 1] = VH[Math.min(gj, HH) * VW + Math.min(gi, VW - 1)]; pos[k + 2] = gj * .5;
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
      shMap: U.shMap, shMat: U.shMat, shOn: U.shOn, camD: U.camD, volc: {value: VOLC}, swampC: U.swampC, fineK: U.fineK, bakeK: U.bakeK, plP: U.plP, plN: U.plN}});
    const mesh = new THREE.Mesh(chunkGeo(cx, cy), m); mesh.castShadow = false; mesh.receiveShadow = false; scene.add(mesh);   // C3p: terrain self-shadow is baked; skipping it in the shadow pass saves tris/frame
    chunks.push({cx, cy, mesh, hi: false, c: new THREE.Vector3(cx * CH + CH / 2, 0, cy * CH + CH / 2)});
  }
}
function updateChunks(){
  const cp = camera.position;
  // v4b: zoom-level LOD (all chunks share one level -> no cracks): far views draw 1/4 or 1/16 of the triangles
  const st = cam.d > 1100 ? 4 : cam.d > 420 ? 2 : 1;
  if (st !== TLOD){ TLOD = st; for (const c of chunks){ c.geos = c.geos || {1: c.mesh.geometry}; c.mesh.geometry = c.geos[st] || (c.geos[st] = chunkGeo(c.cx, c.cy, st)); } }
  for (const c of chunks){
    const dx = Math.max(Math.abs(cp.x - c.c.x) - CH / 2, 0), dz = Math.max(Math.abs(cp.z - c.c.z) - CH / 2, 0), dist = Math.hypot(dx, dz, cp.y);
    if (dist < 420 && !c.hi){
      const tx = c.cx >> 1, ty = c.cy >> 1, t = tileTex(tx, ty); c.hi = true; t.ref = (t.ref || 0) + 1; c.tk = tx + '_' + ty;
      const apply = (tt) => { if (tt && c.hi){ c.mesh.material.uniforms.colTex.value = tt; c.mesh.material.uniforms.tileXf.value.set(tx * 256, ty * 256, 1 / 256, 1 / 256); } };
      if (t.t) apply(t.t); else t.p.then(apply);
    } else if (dist > 760 && c.hi){      // v4 hotfix: unload far 2048² colour tiles (GPU memory cap)
      c.hi = false; c.mesh.material.uniforms.colTex.value = U.loTex.value; c.mesh.material.uniforms.tileXf.value.set(0, 0, 1 / WK, 1 / HK);
      const t = tileCache[c.tk]; if (t && --t.ref <= 0){ if (t.t) t.t.dispose(); else t.p.then((tt) => tt && tt.dispose()); delete tileCache[c.tk]; }
    }
  }
}

// ------------------------------------------------------------ ocean, lakes, rivers (one water plane at sea level)
const OCEAN_F = `
uniform sampler2D auxTex, watTex, watFlow, extW; uniform vec3 extXf; uniform vec3 sun, camPos, skyCol, sunCol; uniform float time, nightK; varying vec2 vW; varying vec3 vP;
${NOISE}
${ATMO}
float waves(vec2 p, float t){
  return vn(p * .32 + vec2(t * .05, t * .03)) * .45 + vn(p * .9 - vec2(t * .07, -t * .04)) * .3 + vn(p * 2.6 + vec2(t * .13, t * .1)) * .17 + vn(p * 7.0 - vec2(t * .3, t * .2)) * .08; }
float ripl(vec2 p, float t){ return vn(p * 3.0 + vec2(t * .04, -t * .03)) * .6 + vn(p * 9.0 - vec2(t * .06, t * .05)) * .4; }
float flowN(vec2 p, vec2 fl, float t){      // two-phase flow map: ripples carried downstream
  float sp = .55, ph0 = fract(t * .12), ph1 = fract(t * .12 + .5), w0 = 1.0 - abs(1.0 - 2.0 * ph0);
  vec2 o0 = fl * ph0 * sp * 8.0, o1 = fl * ph1 * sp * 8.0;
  float a = vn((p - o0) * 5.0) * .6 + vn((p - o0) * 13.0 + 3.1) * .4, b = vn((p - o1) * 5.0 + 7.7) * .6 + vn((p - o1) * 13.0 + 1.3) * .4;
  return mix(b, a, w0); }
vec4 extS(vec2 w){ vec2 u = (w - extXf.xy) * extXf.z; if (extXf.z == 0.0 || u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) return vec4(1.0, 0.0, 0.0, 0.0); return texture2D(extW, u); }
float tyAt(vec2 t, float k){ return abs(floor(texture2D(watTex, (t + .5) / vec2(2048.0, 1536.0)).r * 255.0 / 64.0 + .01) - k) < .5 ? 1.0 : 0.0; }
float tyW(vec2 uv, float k){      // v4b: bilinear blend of the per-texel water type (no blocky 0.5 km squares), edges warped by noise
  vec2 w = uv * vec2(2048.0, 1536.0) - .5 + (vec2(vn(uv * 3100.0), vn(uv * 3100.0 + 7.3)) - .5) * 1.1;
  vec2 i = floor(w), f = smoothstep(0.0, 1.0, fract(w));
  return mix(mix(tyAt(i, k), tyAt(i + vec2(1.0, 0.0), k), f.x), mix(tyAt(i + vec2(0.0, 1.0), k), tyAt(i + vec2(1.0, 1.0), k), f.x), f.y); }
void main(){
  vec2 uv = vW / vec2(1024.0, 768.0);
  bool inMap = uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0;
  vec4 E = inMap ? vec4(0.0) : extS(vW);
  vec3 A = inMap ? texture2D(auxTex, uv).rgb : vec3(0.0, E.b, E.r);
  float km = A.b * A.b * 40.0, d = km / 40.0;
  float dist = length(vP - camPos); float nearF = 1.0 - smoothstep(60.0, 380.0, dist);
  float t = time, e = .2;
  float wL = inMap ? tyW(uv, 1.0) : clamp(E.g * 4.0, 0.0, 1.0), wR = inMap ? tyW(uv, 2.0) : 0.0, wS = inMap ? tyW(uv, 3.0) : 0.0, wSea = clamp(1.0 - wL - wR - wS, 0.0, 1.0);
  if (inMap && wSea > .01){   // v4b: small enclosed ponds tagged as sea -> calm lake (no surf foam ring / pale cyan)
    vec2 o = vec2(1.6 / 1024.0, 0.0), o2 = vec2(0.0, 1.6 / 768.0); float b1 = texture2D(auxTex, uv + o).b, b2 = texture2D(auxTex, uv - o).b, b3 = texture2D(auxTex, uv + o2).b, b4 = texture2D(auxTex, uv - o2).b;
    float op = max(max(b1, b2), max(b3, b4)); op = op * op * 40.0; float pond = (1.0 - smoothstep(.12, .45, op)) * wSea; wL += pond; wSea -= pond; }
  vec2 fl = inMap ? (texture2D(watFlow, uv).gb * 255.0 - 128.0) / 127.0 : vec2(0.0);
  vec3 Vd = normalize(camPos - vP);
  // --- sea: swell + breaking foam on the shore
  float w0 = waves(vW, t), wx = waves(vW + vec2(e, 0.0), t), wz = waves(vW + vec2(0.0, e), t);
  vec3 nS = normalize(vec3((w0 - wx) * .9 * nearF, 1.0, (w0 - wz) * .9 * nearF));
  // --- lake: calm, small ripples
  float l0 = ripl(vW, t), lx = ripl(vW + vec2(.05, 0.0), t), lz = ripl(vW + vec2(0.0, .05), t);
  vec3 nL = normalize(vec3((l0 - lx) * .25 * nearF, 1.0, (l0 - lz) * .25 * nearF));
  // --- river: ripples flowing downstream
  float r0 = flowN(vW, fl, t), rx = flowN(vW + vec2(.03, 0.0), fl, t), rz = flowN(vW + vec2(0.0, .03), fl, t);
  vec3 nR = normalize(vec3((r0 - rx) * .5 * nearF, 1.0, (r0 - rz) * .5 * nearF));
  vec3 n = normalize(nS * wSea + nL * wL + nR * wR + vec3(0.0, 1.0, 0.0) * wS);
  vec3 deep = vec3(.012, .05, .11), mid = vec3(.025, .13, .2), shallow = vec3(.09, .30, .32);
  vec3 cSea = mix(shallow, mid, smoothstep(0.0, .1, d)); cSea = mix(cSea, deep, smoothstep(.08, .7, d));
  vec3 cLake = mix(vec3(.07, .22, .22), vec3(.02, .08, .11), smoothstep(.0, .06, d));
  vec3 cRiv = mix(vec3(.12, .24, .2), vec3(.05, .15, .17), smoothstep(.0, .04, d)) * (.92 + .16 * r0);
  vec2 sq = vW * 2.3 + vec2(fbm(vW * .9), fbm(vW * .9 + 4.1)) * 2.5;      // domain-warped murk (no repeating blobs)
  vec3 cSw = vec3(.045, .05, .026) * (.85 + .3 * fbm(vW * 1.7)) + vec3(.028, .032, .01) * smoothstep(.58, .78, fbm(sq)) * .8;
  vec3 col = cSea * wSea + cLake * wL + cRiv * wR + cSw * wS;
  col *= 1.0 - nightK * .72;
  vec3 R = reflect(-Vd, n);
  float fres = .04 + .96 * pow(1.0 - max(dot(Vd, n), 0.0), 5.0);
  vec3 sky = mix(fogCol, skyCol * 1.1, clamp(R.y * 1.5, 0.0, 1.0));
  col = mix(col, sky, fres * (.85 * wSea + .95 * wL + .7 * wR + .3 * wS));
  float spec = pow(max(dot(reflect(-sun, n), Vd), 0.0), 160.0) * 1.2 * nearF + pow(max(dot(reflect(-sun, n), Vd), 0.0), 18.0) * .08;
  col += sunCol * spec * (1.0 - wS * .8);
  // sea: waves rolling in + breaking foam ; lakes: thin calm shoreline ; rivers: faint foam streaks along the flow near banks
  float ph = km * 6.5 + t * 1.6 + vn(vW * .6) * 4.0;
  float crest = pow(.5 + .5 * sin(ph), 14.0) * (1.0 - smoothstep(.15, 1.4, km));
  float foam = (crest * smoothstep(.35, .7, vn(vW * 7.0 + vec2(t * .15, 0.0))) * 1.2 + (1.0 - smoothstep(0.02, .1, km)) * (.55 + .45 * vn(vW * 14.0 + t * .5)) + smoothstep(.78, .95, w0) * .18 * smoothstep(.05, .3, d)) * wSea;
  foam += (1.0 - smoothstep(.0, .035, km)) * .25 * wL;
  foam += smoothstep(.72, .9, r0) * (1.0 - smoothstep(.05, .35, km)) * .35 * wR * length(fl);
  col = mix(col, vec3(.85, .92, .95) * min(vec3(1.2), skyCol * .9 + sunCol * .25), clamp(foam * nearF, 0.0, 1.0) * .8);
  col = atmo(col, vP, camPos);
  float a = mix(mix(.8, .9, wR + wL), 1.0, smoothstep(0.0, .03, d));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;
function buildOcean(){
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-Math.PI / 2); g.translate(512, 0, 384);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8,     // E4
    vertexShader: 'varying vec2 vW; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xz; vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: OCEAN_F, uniforms: {auxTex: U.auxTex, watTex: U.watTex, watFlow: U.watFlow, extW: U.extW, extXf: U.extXf, sun: U.sun, camPos: U.camPos, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, time: U.time, skyCol: U.skyCol, sunCol: U.sunCol, nightK: U.nightK}});
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
    const yR = (px, pz) => { const h = yAt(px, pz); return (px < 0 || pz < 0 || px > WK || pz > HK) && EXT.conts.length ? Math.max(h, extYS(px, pz, 3)) : h; };      // D1
    const yE = (s) => { let m = .02; for (const f of [0, .5, 1]) for (const g of [-.1, 0, .1]) m = Math.max(m, yR(x + s * dz * w * f + dx * g, z - s * dx * w * f + dz * g)); return m; };
    const y1 = sea ? .05 : yE(-1) + lift, y2 = sea ? .05 : yE(1) + lift;
    pos.set([x - dz * w, y1, z + dx * w, x + dz * w, y2, z - dx * w], i * 6); uv.set([acc, 0, acc, 1], i * 4);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
function mergeGeos(list){
  let nv = 0, ni = 0; for (const g of list){ nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const g of list){ pos.set(g.attributes.position.array, ov * 3); uv.set(g.attributes.uv.array, ov * 2); const I = g.index.array; for (let k = 0; k < I.length; k++) idx[oi + k] = I[k] + ov; ov += g.attributes.position.count; oi += I.length; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
}
function dirtMat(qual = 1){
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
    uniforms: {gTex: U.gTex, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol, camPos: U.camPos, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, op: {value: 1}, qual: {value: qual}, auxTex: U.auxTex},
    vertexShader: 'varying vec2 vU; varying vec3 vP; void main(){ vU = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `precision highp sampler2DArray; uniform highp sampler2DArray gTex; uniform sampler2D auxTex; uniform vec3 sun, sunCol, skyCol, gndCol, camPos; uniform float op, qual; varying vec2 vU; varying vec3 vP;
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
        a *= qual < .99 ? smoothstep(.25, .6, vn(vP.xz * 3.0) + .35) : 1.0;
        gl_FragColor = vec4(col * mix(.85, 1.0, qual), a * op * .92 * mix(.7, 1.0, qual));
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
  // v3: all ribbons merged per material (few draw calls even with hundreds of tracks)
  const dm = dirtMat(), tm = dirtMat(.5), mats = {road: routeMat('road'), trade: routeMat('trade'), sea: routeMat('sea')};
  const W = {trade: .2, road: .15, path: .09, track: .055};
  const G = {dirt: [], track: [], road: [], trade: [], sea: []};
  for (const r of D.roads){
    if (r.t === 'track'){ G.track.push(ribbon(r.p, W.track, .02, false)); continue; }
    if (r.t !== 'sea') G.dirt.push(ribbon(r.p, W[r.t], .025, false));
    if (r.t === 'path') continue;
    G[r.t === 'road' ? 'road' : r.t].push(ribbon(r.p, r.t === 'trade' ? .5 : r.t === 'sea' ? .7 : .3, .08, r.t === 'sea'));
  }
  for (const s of D.streets || []) G.dirt.push(ribbon(s, .07, .02, false));
  const add = (list, mat, ro) => { if (!list.length) return; const mesh = new THREE.Mesh(mergeGeos(list), mat); mesh.renderOrder = ro; mesh.frustumCulled = false; scene.add(mesh); };
  add(G.dirt, dm, 3); add(G.track, tm, 3); add(G.road, mats.road, 4); add(G.trade, mats.trade, 4); add(G.sea, mats.sea, 4);
}

// ------------------------------------------------------------ models (packed CC0 kits: KayKit Medieval Hexagon, Quaternius Stylized Nature)
const GEO = {}; const VARN = ['red', 'blue', 'yellow', 'n', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
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
  mat.onBeforeCompile = (sh) => { sh.uniforms.camPos = U.camPos; sh.uniforms.nearB = {value: NEAR_B}; sh.uniforms.nightK = U.nightK; sh.uniforms.time = U.time;
    sh.vertexShader = 'uniform vec3 camPos; uniform float nearB; varying vec3 vIP;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      { vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float dd = distance(ip, camPos); vIP = ip;
        bool hide = ${far ? 'dd < nearB || dd > 300.0' : 'dd > nearB && instanceMatrix[1][1] < 0.9'}; if (hide) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`);
    // v4 B: lit windows at night (window-coloured texels glow; each building switches on/off now and then)
    sh.fragmentShader = 'uniform float nightK, time; varying vec3 vIP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 dc = diffuseColor.rgb; float hh = fract(sin(dot(floor(vIP * 37.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float on = step(.28, fract(hh * 13.7 + floor(time / 23.0 + hh * 9.0) * .618));
        float win = smoothstep(.035, .012, abs(dc.r - .017) + abs(dc.g - .029) + abs(dc.b - .047)) + step(dc.r * 1.35 + .004, dc.b) * step(dc.r + dc.g + dc.b, .09) * .8;
        totalEmissiveRadiance += vec3(1.0, .66, .32) * win * on * nightK * ${far ? '.0' : '1.6'}; }`); };
  return mat;
}
const BLD = {tiles: new Map(), list: null, smokeSrc: []};
const BT = 8;  // building tile size (km)
function buildBuildings(buf){
  const dv = new DataView(buf), n = buf.byteLength / 16, names = MNAMES();
  const L = []; for (let i = 0; i < n; i++){ const o = i * 16; L.push({m: names[dv.getUint8(o)], v: dv.getUint8(o + 1), p: dv.getUint8(o + 2), f: dv.getUint8(o + 3), x: dv.getFloat32(o + 4, true), z: dv.getFloat32(o + 8, true), r: f16(dv.getUint16(o + 12, true)), s: f16(dv.getUint16(o + 14, true))}); }
  BLD.list = L;
  MAT.bld = [0, 1, 2, 3].map((p) => lodPatch(new THREE.MeshLambertMaterial({map: MAT.kk[p]}), false));
  MAT.bldF = lodPatch(new THREE.MeshLambertMaterial({map: MAT.flat}), false);
  for (const b of L){
    const bb = MODELS[b.m].bb; let y = Math.min(yAt(b.x, b.z), yAt(b.x + .1, b.z + .1), yAt(b.x - .1, b.z - .1)) - .01;
    if (b.m === 'wall_straight' || b.m === 'wall_straight_gate') y = yAt(b.x, b.z) - .06 * b.s * 5;
    if (b.m === 'pier' || b.m === 'dock') y = Math.max(.012, Math.min(y, .05));
    if (b.m.startsWith('rk_') || b.m.startsWith('st_')) y -= .04 * b.s;
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
    const monu = (b.f & 4) || b.s >= .9 || /^(rk_|st_|pier|dock|flag)/.test(b.m); v.set(b.x, b.y, b.z); sc.set(w, wall ? h : tall ? h * .85 : h * .58, d); if (monu) sc.set(0, 0, 0); m4.compose(v, q, sc); wm.setMatrixAt(k, m4);
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
      const im = new THREE.InstancedMesh(part.g, part.mat === 'flat' ? MAT.bldF : MAT.bld[+p], arr.length);
      arr.forEach((b, i) => { e.set(0, b.r, 0); q.setFromEuler(e); v.set(b.x, b.y, b.z); const mon = (b.f & 4) ? 1 : .999; sc.set(b.s, b.s * mon, b.s); m4.compose(v, q, sc); im.setMatrixAt(i, m4); const hh = hash(b.x * 31.7 + b.z * 17.3); cJ.setRGB(1, 1, 1).offsetHSL((hh - .5) * .06, (hash(hh * 91) - .5) * .25, (hash(hh * 57) - .5) * .16); im.setColorAt(i, cJ); });
      im.instanceColor.needsUpdate = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; grp.add(im);
    }
  }
  for (const b of t.items) if (b.f & 1) BLD.smokeSrc.push([b.x + (hash(b.x * 99) - .5) * b.s * .3, b.top - .02, b.z + (hash(b.z * 77) - .5) * b.s * .3, b.m === 'blacksmith' || b.m === 'mine' ? 1 : 0]);
  scene.add(grp); t.group = grp; smokeDirty = true;
}
function updateBuildings(){
  const cp = camera.position, todo = [];
  for (const t of BLD.tiles.values()){
    if (t.group) continue;
    const dist = Math.hypot(Math.max(Math.abs(cp.x - t.cx) - BT / 2, 0), Math.max(Math.abs(cp.z - t.cz) - BT / 2, 0), cp.y - yAt(t.cx, t.cz));
    const mon = t.items.some((b) => b.f & 4);
    if ((dist < NEAR_B + 6 || (mon && dist < 300))) todo.push([dist, t]);
  }
  if (!todo.length) return;
  todo.sort((a, b) => a[0] - b[0]);
  const t0 = performance.now();
  for (const [, t] of todo){ buildTileGroup(t); if (performance.now() - t0 > 9) break; }    // nearest tiles first, ~9 ms per frame
}
// monumental pieces (Khara dûm gate) are scaled with sy = 1.0 marker -> never hidden by the LOD switch
// v3: procedural stone arch bridge (exact span direction: unit length along X, unit width along Z)
function bridgeGeo(){
  const b = new GB(), deck = new THREE.BoxGeometry(1, .16, .86, 24, 1, 1), P = deck.attributes.position;
  for (let i = 0; i < P.count; i++){ const x = P.getX(i); P.setY(i, P.getY(i) + .9 - .25 * Math.pow(x * 2, 2)); }
  b.add(deck, M4(0, 0, 0), 0xa8a196);
  for (const sz of [-.46, .46]){ const par = new THREE.BoxGeometry(1, .22, .08, 24, 1, 1), Q = par.attributes.position;
    for (let i = 0; i < Q.count; i++){ const x = Q.getX(i); Q.setY(i, Q.getY(i) + 1.08 - .25 * Math.pow(x * 2, 2)); } b.add(par, M4(0, 0, sz), 0x958e84); }
  for (const px of [-.3, 0, .3]) b.add(new THREE.BoxGeometry(.07, 2.2, .9), M4(px, -.25, 0), 0x8a847a);
  for (const ex of [-.5, .5]) b.add(new THREE.BoxGeometry(.06, .5, 1.0), M4(ex, .65, 0), 0x8a847a);
  return b.geo();
}
function buildBridges(){
  const list = D.bridges || []; if (!list.length) return;
  const im = new THREE.InstancedMesh(bridgeGeo(), new THREE.MeshLambertMaterial({vertexColors: true}), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  list.forEach(([x, z, a, L], i) => { e.set(0, -a, 0); q.setFromEuler(e);
    const ca = Math.cos(a), sa = Math.sin(a), y = Math.max(yAt(x + ca * L / 2, z + sa * L / 2), yAt(x - ca * L / 2, z - sa * L / 2), .03);
    v.set(x, y - .085, z); sc.set(L + .25, .095, Math.min(.22, .1 + L * .03)); m4.compose(v, q, sc); im.setMatrixAt(i, m4); });
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; scene.add(im);
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
const floats = [];
// ------------------------------------------------------------ trees: real 3D models near the camera, baked impostors beyond (all 670k trees, no popping)
const TREE_SP = ['tree_a', 'tree_b', 'tree_c', 'pine_a', 'pine_b', 'pine_c', 'twist_a', 'twist_b', 'dead_a', 'dead_b', 'bush', 'bush_f', 'palm_a', 'palm_b'];
const TINTS = [[1, 1, 1], [.16, .32, .12], [.42, .55, .12], [.95, .42, .08], [.85, .12, .1], [1.0, .72, .12], [.95, .38, .6], [.5, .25, .85], [.1, .24, .16], [.35, .33, .3], [.36, .4, .18], [.28, .32, .24]];
const LEAFMAT = {leaf_n: 0, leaf_p: 1, leaf_t: 2, bark_n: 3, bark_t: 4, bark_d: 5, leaf_f: 6, bark_f: 6, flat: 6};
const TR = {n: 0, x: null, z: null, y: null, s: null, h: null, t: null, r: null, grid: null, near: [], lastX: 1e9, lastZ: 1e9};
function treeMaterial(matName){
  const isLeaf = matName.startsWith('leaf');
  const m = new THREE.MeshLambertMaterial({map: MAT.leaf[LEAFMAT[matName]], alphaTest: isLeaf ? .5 : 0, alphaToCoverage: false, side: isLeaf ? THREE.DoubleSide : THREE.FrontSide});
  m.onBeforeCompile = (sh) => {
    sh.uniforms.time = U.time;
    sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 1.3; transformed.x += sin(time * 1.3 + ph) * .025 * position.y * position.y; transformed.z += cos(time * 1.1 + ph) * .018 * position.y * position.y;');
    if (isLeaf) sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `
      #ifdef USE_MAP
      { vec2 tsz = vec2(textureSize(map, 0)); vec2 ddx = dFdx(vMapUv * tsz), ddy = dFdy(vMapUv * tsz); float ml = max(0.0, .5 * log2(max(dot(ddx, ddx), dot(ddy, ddy)))); diffuseColor.a *= 1.0 + ml * .25; }
      #endif
      #include <alphatest_fragment>`);     // E1: mip-aware alpha test
    if (isLeaf) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
      #if defined( USE_COLOR )
      { vec3 tc = vColor; float l = dot(diffuseColor.rgb, vec3(.3, .59, .11)); if (tc.r + tc.g + tc.b < 2.95) diffuseColor.rgb = l * tc * 2.7; }
      #endif
      { float hj = fract(sin(dot(vIp.xz, vec2(12.9898, 78.233))) * 43758.5453); diffuseColor.rgb *= vec3(.92 + .16 * hj, .95 + .1 * fract(hj * 7.3), .9 + .12 * fract(hj * 3.1));
        diffuseColor.rgb *= mix(.55, 1.12, smoothstep(-.1, 1.0, vLy)); }
`);
    if (isLeaf){ sh.vertexShader = 'varying vec3 vIp; varying float vLy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vIp = instanceMatrix[3].xyz; vLy = position.y / 1.6;');
      sh.fragmentShader = 'varying vec3 vIp; varying float vLy;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n #if NUM_DIR_LIGHTS > 0\n reflectedLight.indirectDiffuse += diffuseColor.rgb * .045 * max(dot(-geometryNormal, directionalLights[0].direction), 0.0) * directionalLights[0].color;\n #endif'); }   // C3: per-tree hue jitter, crown AO, back-lit wrap
  };
  return m;
}
// v4: extra trees outside the named forests are generated here from veg.png (density + biome class) -> 4-5x denser countryside without a bigger download
const SCATTER_MULT = 4.0;
const TX0 = -120, TZ0 = -140, TWW = 2400, THH = 2400, EXT_MULT = .5;   // v4 B: tree system covers the whole world
function scatterCount(){ let e = 0; if (VEGP) for (let i = 0; i < 2048 * 1536; i++) e += VEGP[i * 4] / 255 * 24 * .25 * SCATTER_MULT;
  for (const c of EXT.conts) for (let i = 0; i < c.W * c.H; i++) e += c.V[i * 4] / 255 * 24 * EXT_MULT;
  return Math.ceil(e * 1.05 + 8192); }
// species per ext biome: [species list, tint list]
const EXT_SP = {0: [[0, 1, 2, 2, 10], [0, 0, 2, 1]], 1: [[0, 1, 2, 3, 4, 10], [0, 1, 0, 8]], 2: [[3, 4, 5, 5, 3], [0, 8, 0]], 3: [[3, 4, 5], [9, 0]], 4: [[3, 5, 10], [0, 9]], 5: [[10, 11], [10, 9]], 6: [[10], [10]],
  7: [[8, 9, 8, 10], [9, 9, 11]], 8: [[12, 13, 10, 12], [0, 2, 0]], 9: [[12, 13, 6, 7, 11, 12], [0, 1, 2, 0]], 10: [[8], [9]], 11: [[2, 10, 8, 10], [10, 2, 9]], 12: [[0, 1, 2, 6, 11], [6, 3, 7, 0, 2, 6]]};
function buildTrees(buf){
  const dv = new DataView(buf), n0 = buf.byteLength / 8, cap = n0 + scatterCount();
  TR.x = new Float32Array(cap); TR.z = new Float32Array(cap); TR.y = new Float32Array(cap); TR.s = new Uint8Array(cap); TR.h = new Float32Array(cap); TR.t = new Uint8Array(cap); TR.r = new Float32Array(cap);
  const G = 2, gw = Math.ceil(TWW / G), gh = Math.ceil(THH / G), cnt = new Uint32Array(gw * gh + 1);
  for (let i = 0; i < n0; i++){ const o = i * 8; const x = dv.getUint16(o, true) / 65535 * WK, z = dv.getUint16(o + 2, true) / 65535 * HK;
    TR.x[i] = x; TR.z[i] = z; TR.y[i] = yAt(x, z) - .01; TR.s[i] = dv.getUint8(o + 4); TR.h[i] = dv.getUint8(o + 5) / 100; TR.t[i] = dv.getUint8(o + 6); TR.r[i] = dv.getUint8(o + 7) / 255 * 6.283; }
  let n = n0;
  if (VEGP){
    let sd = 911;
    const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let cj = 0; cj < 1536; cj++) for (let ci = 0; ci < 2048; ci++){
      const k = (cj * 2048 + ci) * 4, lam = VEGP[k] / 255 * 24 * .25 * SCATTER_MULT; if (lam < .02) continue;
      let m = lam | 0; if (R() < lam - m) m++;
      const cls = (VEGP[k + 1] / 40 + .5) | 0;
      for (let q = 0; q < m && n < cap; q++){
        const x = (ci + R()) * .5, z = (cj + R()) * .5, u = R();
        let sp, t = 0, h;
        if (cls === 1){ sp = u < .8 ? 3 + (R() * 3 | 0) : u < .92 ? (R() * 3 | 0) : 10; t = R() < .5 ? 8 : 0; }
        else if (cls === 2){ sp = u < .45 ? 8 + (R() * 2 | 0) : u < .8 ? 6 + (R() * 2 | 0) : 10; t = R() < .6 ? 10 : 11; }
        else if (cls === 3){ sp = u < .72 ? (R() * 3 | 0) : u < .9 ? 6 + (R() * 2 | 0) : 11; t = [3, 4, 5, 6, 7, 3, 5, 2, 0][R() * 9 | 0]; }
        else if (cls === 4){ sp = u < .7 ? (R() * 3 | 0) : u < .9 ? 3 + (R() * 3 | 0) : 11; t = [0, 2, 5, 3, 0][R() * 5 | 0]; }
        else if (cls === 5){ sp = u < .45 ? 8 + (R() * 2 | 0) : u < .92 ? 3 + (R() * 3 | 0) : 10; t = 9; }
        else { sp = u < .58 ? (R() * 3 | 0) : u < .9 ? 3 + (R() * 3 | 0) : 10 + (u > .97 ? 1 : 0); t = sp <= 2 ? [0, 0, 1, 2][R() * 4 | 0] : sp <= 5 && R() < .5 ? 8 : 0; }
        h = sp <= 2 ? .30 + .16 * R() : sp <= 5 ? .34 + .22 * R() : sp <= 7 ? .34 + .16 * R() : sp <= 9 ? .26 + .12 * R() : .07 + .05 * R();
        if (cls === 2 && sp <= 9) h *= .8;
        TR.x[n] = x; TR.z[n] = z; TR.y[n] = yAt(x, z) - .01; TR.s[n] = sp; TR.h[n] = h; TR.t[n] = t; TR.r[n] = R() * 6.283; n++;
      }
    }
  }
  {   // E2: even 50% thinning where the main-continent forest is dense (1 km cells, 3x3 smoothed density); sparse cells keep every tree
    const CW = WK | 0, CH = HK | 0, cc = new Float32Array(CW * CH), sm = new Float32Array(CW * CH);
    for (let i = 0; i < n; i++){ const ci = Math.min(CW - 1, Math.max(0, TR.x[i] | 0)), cj = Math.min(CH - 1, Math.max(0, TR.z[i] | 0)); cc[cj * CW + ci]++; }
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++){ let s = 0, w = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++){ const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= CW || jj >= CH) continue; s += cc[jj * CW + ii]; w++; } sm[j * CW + i] = s / w; }
    const nz = []; for (let k = 0; k < sm.length; k += 7) if (sm[k] > 1) nz.push(sm[k]); nz.sort((a, b) => a - b);
    const T1 = nz.length ? nz[(nz.length * .45) | 0] : 1e9, T2 = nz.length ? nz[(nz.length * .7) | 0] : 1e9;
    let w = 0;
    for (let i = 0; i < n; i++){
      const d = sm[Math.min(CH - 1, Math.max(0, TR.z[i] | 0)) * CW + Math.min(CW - 1, Math.max(0, TR.x[i] | 0))];
      const keep = d <= T1 ? 1 : d >= T2 ? .5 : 1 - .5 * (d - T1) / Math.max(T2 - T1, 1e-3);
      if (keep < 1 && hash(((TR.x[i] * 4096) | 0) * 7919 + ((TR.z[i] * 4096) | 0)) >= keep) continue;
      if (w !== i){ TR.x[w] = TR.x[i]; TR.z[w] = TR.z[i]; TR.y[w] = TR.y[i]; TR.s[w] = TR.s[i]; TR.h[w] = TR.h[i]; TR.t[w] = TR.t[i]; TR.r[w] = TR.r[i]; }
      w++;
    }
    TR.thin = [n, w, T1, T2]; n = w;
  }
  {
    let sd = 1717; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (const c of EXT.conts) for (let cj = 0; cj < c.H; cj++) for (let ci = 0; ci < c.W; ci++){
      const k = (cj * c.W + ci) * 4, lam = c.V[k] / 255 * 24 * EXT_MULT; if (lam < .02) continue;
      let m = lam | 0; if (R() < lam - m) m++;
      const sp = EXT_SP[Math.round(c.V[k + 1] / 20)] || EXT_SP[0];
      for (let q = 0; q < m && n < cap; q++){
        const x = c.x0 + (ci + R()) * c.R, z = c.z0 + (cj + R()) * c.R, y = yAt(x, z); if (y <= .01) continue;
        const s = sp[0][R() * sp[0].length | 0], t = sp[1][R() * sp[1].length | 0];
        TR.x[n] = x; TR.z[n] = z; TR.y[n] = y - .01; TR.s[n] = s; TR.t[n] = t; TR.r[n] = R() * 6.283;
        TR.h[n] = s <= 2 ? .3 + .16 * R() : s <= 5 ? .34 + .22 * R() : s <= 7 ? .34 + .16 * R() : s <= 9 ? .26 + .12 * R() : s <= 11 ? .07 + .05 * R() : .32 + .14 * R(); n++;
      }
    }
  }
  TR.n = n;
  const cellOf = (i) => Math.min(Math.max(((TR.z[i] - TZ0) / G) | 0, 0), gh - 1) * gw + Math.min(Math.max(((TR.x[i] - TX0) / G) | 0, 0), gw - 1);
  for (let i = 0; i < n; i++) cnt[cellOf(i) + 1]++;
  for (let i = 1; i < cnt.length; i++) cnt[i] += cnt[i - 1];
  const idx = new Uint32Array(n), fill = cnt.slice();
  for (let i = 0; i < n; i++){ const c = cellOf(i); idx[fill[c]++] = i; }
  TR.grid = {G, gw, gh, start: cnt, idx};
  // near meshes: one InstancedMesh per species & material part (capacity grows on demand)
  TR.meshes = TREE_SP.map((sp) => modelGeo(sp, 'n').map((part) => { const im = new THREE.InstancedMesh(part.g, treeMaterial(part.mat), 64); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    if (part.mat.startsWith('leaf')) { im.setColorAt(0, new THREE.Color(1, 1, 1)); } scene.add(im); return {im, part, cap: 64}; }));
  buildImpostors();
}
function refreshNearTrees(force){
  const cp = camera.position, gx = cp.x, gz = cp.z;
  const R = NEAR_T + .6, groundY = yAt(gx, gz);
  if (!force && Math.hypot(gx - TR.lastX, gz - TR.lastZ) < .25 && Math.abs(cp.y - (TR.lastY || 0)) < .25) return;
  TR.lastX = gx; TR.lastZ = gz; TR.lastY = cp.y;
  const per = TREE_SP.map(() => []);
  if (cp.y - groundY < R){
    const {G, gw, gh, start, idx} = TR.grid; const rr = Math.sqrt(Math.max(R * R - (cp.y - groundY) ** 2, 0));
    for (let cz = Math.max(((gz - rr - TZ0) / G) | 0, 0); cz <= Math.min(((gz + rr - TZ0) / G) | 0, gh - 1); cz++) for (let cx = Math.max(((gx - rr - TX0) / G) | 0, 0); cx <= Math.min(((gx + rr - TX0) / G) | 0, gw - 1); cx++){
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
  while (ext.length < 16) ext.push(1);
  renderer.setRenderTarget(prevRT); renderer.setViewport(prevVp); renderer.autoClear = prevAuto;
  U.impC = {value: rtC.texture}; U.impM = {value: rtM.texture};
  // instanced quads
  const n = TR.n, base = new THREE.PlaneGeometry(1, 1), TS = 64, tw = Math.ceil(TWW / TS), th = Math.ceil(THH / TS);
  const tc = new Uint32Array(tw * th + 1);
  const tileOf = (i) => Math.min(Math.max(((TR.z[i] - TZ0) / TS) | 0, 0), th - 1) * tw + Math.min(Math.max(((TR.x[i] - TX0) / TS) | 0, 0), tw - 1);
  // v4b perf: counting sort by (tile, keep-bucket) so each tile's instances are ordered by their keep hash -> per frame we draw only the prefix that can pass the shader's density test (identical image, far fewer vertices)
  const NB = 256, bk = new Uint32Array(tw * th * NB + 1), tl = new Uint32Array(n), wv = new Float32Array(n), thMax = new Float32Array(tw * th);
  for (let i = 0; i < n; i++){ const t = tileOf(i), w = hash(i * 7 + 3); tl[i] = t; wv[i] = w; bk[t * NB + Math.min(NB - 1, w * NB | 0) + 1]++; tc[t + 1]++; if (TR.h[i] > thMax[t]) thMax[t] = TR.h[i]; }
  for (let i = 1; i < tc.length; i++) tc[i] += tc[i - 1];
  for (let i = 1; i < bk.length; i++) bk[i] += bk[i - 1];
  const ip = new Uint16Array(n * 4), id = new Uint8Array(n * 4), fillB = bk.slice();
  for (let i = 0; i < n; i++){ const o = fillB[tl[i] * NB + Math.min(NB - 1, wv[i] * NB | 0)]++;
    ip[o * 4] = (TR.x[i] - TX0) / TWW * 65535; ip[o * 4 + 1] = (TR.z[i] - TZ0) / THH * 65535; ip[o * 4 + 2] = Math.min(Math.max((TR.y[i] + 1) / 24, 0), 1) * 65535; ip[o * 4 + 3] = Math.min(1, (Math.min(NB - 1, wv[i] * NB | 0) + 1) / NB) * 65535;
    id[o * 4] = Math.min(255, TR.h[i] * 100); id[o * 4 + 1] = TR.s[i]; id[o * 4 + 2] = TR.t[i]; }
  const tints = TINTS.map((t) => new THREE.Vector3(...t));
  const m = new THREE.ShaderMaterial({uniforms: {impC: U.impC, impM: U.impM, camPos: U.camPos, nearT: U.nearT, pxK: U.pxK, ext: {value: ext}, tints: {value: tints}, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, time: U.time, auxTex: U.auxTex},
    vertexShader: `attribute vec4 iP; attribute vec4 iD; uniform vec3 camPos; uniform float nearT, pxK, time; uniform float ext[16];
      varying vec2 vUv, vUv2; varying float vView, vFade, vTint, vR; varying vec3 vP;
      void main(){
        vec3 iPos = vec3(iP.x * ${TWW.toFixed(1)} + ${TX0.toFixed(1)}, iP.z * 24.0 - 1.0, iP.y * ${THH.toFixed(1)} + ${TZ0.toFixed(1)});
        float h = iD.x / 100.0; int sp = int(iD.y + .5);
        vec3 toC = camPos - iPos; float dist = length(toC);
        float px = h / dist * pxK; float keep = clamp(px * px / 3.0, 0.0, 1.0);
        if (iP.w > keep * 1.02 || dist < nearT){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
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
        vFade = smoothstep(nearT, nearT + .5, dist); vTint = iD.z; vP = c; vR = fract(iP.w * 37.13 + iD.x * .173);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D impC, impM, auxTex; uniform vec3 tints[12], sun, sunCol, skyCol, gndCol, camPos; varying vec2 vUv, vUv2; varying float vView, vFade, vTint, vR; varying vec3 vP;
      ${ATMO}
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 a = texture2D(impC, vUv), b = texture2D(impC, vUv2); vec4 c = mix(a, b, vView);
        float lm = mix(texture2D(impM, vUv).r, texture2D(impM, vUv2).r, vView);
        vec2 dU = dFdx(vUv * vec2(2048.0, 1024.0)), dV = dFdy(vUv * vec2(2048.0, 1024.0)); float ml = max(0.0, .5 * log2(max(dot(dU, dU), dot(dV, dV))));     // E1: alpha test + mip boost, per-tree fade (no per-pixel stipple)
        if (c.a * (1.0 + ml * .22) < .45 || vFade < vR) discard; float cov = 1.0;
        if (cov < .02) discard;
        vec3 col = c.rgb / max(c.a, .001);
        int ti = int(vTint + .5); vec3 tc = tints[ti];
        if (ti > 0){ float l = dot(col, vec3(.3, .59, .11)); col = mix(col, l * tc * 2.7, lm); }
        vec2 su = vP.xz / vec2(1024.0, 768.0); float sh = (su.x > 0.0 && su.y > 0.0 && su.x < 1.0 && su.y < 1.0) ? texture2D(auxTex, su).a : 1.0;
        col *= (.62 + .38 * sh) * clamp((sunCol * .55 + skyCol * .9) / vec3(1.53, 1.57, 1.63), 0.0, 1.15);
        col = atmo(col, vP, camPos);
        gl_FragColor = vec4(col, cov);
        #include <colorspace_fragment>
      }`, alphaToCoverage: false});
  const grp = new THREE.Group();
  for (let t = 0; t < tw * th; t++){
    const c0 = tc[t], c1 = tc[t + 1]; if (c1 <= c0) continue;
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    g.setAttribute('iP', new THREE.InstancedBufferAttribute(ip.subarray(c0 * 4, c1 * 4), 4, true));
    g.setAttribute('iD', new THREE.InstancedBufferAttribute(id.subarray(c0 * 4, c1 * 4), 4, false)); g.instanceCount = c1 - c0;
    const cx = ((t % tw) + .5) * TS + TX0, cz = ((t / tw | 0) + .5) * TS + TZ0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 4, cz), TS * .75); g.boundingBox = new THREE.Box3(new THREE.Vector3(cx - TS / 2, -2, cz - TS / 2), new THREE.Vector3(cx + TS / 2, 20, cz + TS / 2));
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = true; mesh.renderOrder = 1; grp.add(mesh);
    const hm = Math.min(2.56, thMax[t] + .01), bb = g.boundingBox, b0 = t * NB;
    mesh.userData.upd = (p) => { const dx = Math.max(bb.min.x - p.x, 0, p.x - bb.max.x), dz = Math.max(bb.min.z - p.z, 0, p.z - bb.max.z), dy = Math.max(bb.min.y - p.y, 0, p.y - bb.max.y);
      const px = hm / Math.max(Math.hypot(dx, dy, dz), .01) * U.pxK.value, keep = Math.min(1, px * px / 3 * 1.03);
      const nb = Math.ceil(keep * NB); g.instanceCount = nb < 1 && keep < .002 ? 0 : bk[b0 + Math.min(NB, nb + 1)] - bk[b0]; mesh.visible = g.instanceCount > 0; };
  }
  scene.add(grp); TR.imp = grp;
}
// v4 C3 perf: per-frame impostor tile pass (64 km tiles): exact per-tile density prefix, empty tiles skipped before culling
function updateImpostors(){ if (!TR.imp) return; const p = camera.position; for (const m of TR.imp.children) m.userData.upd(p);
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
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {map: {value: softTex(3)}, time: U.time, camPos: U.camPos, sun: U.sun, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, op: {value: 1}, vAct: U.vAct},
    vertexShader: `attribute vec4 iE; attribute float iS; uniform float time; uniform float vAct[24]; varying vec2 vUv; varying float vA, vK, vT; varying vec3 vP;
      void main(){
        float k = iE.w; float sp = k > 1.5 ? .018 : k > .5 ? .07 : .09; float t = fract(time * sp + iS);
        float H = k > 1.5 ? 12.0 : k > .5 ? .55 : .38, S = k > 1.5 ? 1.5 : k > .5 ? .14 : .085;
        vec3 c = iE.xyz + vec3(t * t * H * .9 + sin(iS * 40.0) * .3 * t * S * 4.0, t * H, t * H * .35 + cos(iS * 31.0) * .2 * t * S * 4.0);
        float size = S * (.35 + 2.2 * t) * (k > 1.5 ? (1.0 + 1.3 * t) : 1.0);
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = iS * 6.283 + t * 1.5; vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;
        vec3 p = c + (R * q.x + Up * q.y) * size;
        vA = sin(3.14159 * t) * smoothstep(0.0, .12, t) * (k > 1.5 ? vAct[int((k - 2.0) * 64.0 + .5)] : 1.0); vK = k; vT = t; vUv = uv; vP = c;
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
  for (const s of D.smoke || []) L.push([s[0], yAt(s[0], s[1]) + .3, s[1], 2 + (s[2] === -1 ? s[3] : 23) / 64, 0]);
  const near = BLD.smokeSrc.map((s) => [s, Math.hypot(s[0] - cp.x, s[2] - cp.z, s[1] - cp.y)]).filter((a) => a[1] < 60).sort((a, b) => a[1] - b[1]);
  let n = 0;
  for (const s of L){ for (let k = 0; k < 90 && n < SMK.MAXP; k++, n++){ SMK.e.set([s[0] + (hash(k) - .5) * .8, s[1], s[2] + (hash(k + 9) - .5) * .8, s[3]], n * 4); SMK.sd[n] = k / 90; } }
  for (const [s] of near){ const P = s[3] ? 7 : 5; if (n + P > SMK.MAXP) break; for (let k = 0; k < P; k++, n++){ SMK.e.set([s[0], s[1], s[2], s[3]], n * 4); SMK.sd[n] = (k + hash(s[0] * 31 + s[2])) / P; } }
  SMK.g.instanceCount = n; SMK.g.attributes.iE.needsUpdate = true; SMK.g.attributes.iS.needsUpdate = true;
}

// ------------------------------------------------------------ clouds: lit puff clusters (volumetric look), drifting
let CLD = null;
// v4c cloud overhaul: stacked noise slices (pseudo-volumetric, soft self-shadowed lighting, varied coverage), a precomputed tileable
// density texture keeps it to ~3 texture reads per pixel per slice (cheap) - replaces the sprite puffs
function cloudTexture(){
  const N = 512, out = new Uint8Array(N * N * 4);
  const lat = (P, seed) => { const g = new Float32Array(P * P); for (let i = 0; i < P * P; i++) g[i] = hash(i * 7919 + seed * 104729); return g; };
  const oct = (P, seed) => ({P, g: lat(P, seed)});
  const sm = (t) => t * t * (3 - 2 * t);
  const val = (o, u, v) => { const x = u * o.P, y = v * o.P, P = o.P, i0 = Math.floor(x), j0 = Math.floor(y), fx = sm(x - i0), fy = sm(y - j0), i = ((i0 % P) + P) % P, j = ((j0 % P) + P) % P, g = o.g;   // C3 fix: negative lattice index -> NaN seam band (Phoenix: streak over the Elf islands)
    const a = g[(j % P) * P + (i % P)], b = g[(j % P) * P + ((i + 1) % P)], c = g[((j + 1) % P) * P + (i % P)], d = g[((j + 1) % P) * P + ((i + 1) % P)]; return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; };
  const F = (seed, base, n) => { const os = []; for (let k = 0; k < n; k++) os.push(oct(base << k, seed + k)); return (u, v) => { let s = 0, w = 0, a = 1; for (const o of os){ s += a * val(o, u, v); w += a; a *= .5; } return s / w; }; };
  const fA = F(11, 4, 5), fB = F(31, 6, 5), fD = F(51, 16, 4), fC = F(71, 2, 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const u = x / N, v = y / N, k = (y * N + x) * 4;
    const wu = u + (fC(u + .3, v) - .5) * .08, wv = v + (fC(u, v + .7) - .5) * .08;
    out[k] = fA(wu, wv) * 255; out[k + 1] = fD(u, v) * 255; out[k + 2] = fB(wu, wv) * 255; out[k + 3] = fC(u, v) * 255; }
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
const DECK = {meshes: [], op: {value: 1}};
function buildClouds(){
  const cT = cloudTexture();
  const mk = (y, hk, sc, cover, k, n) => {
    const g = new THREE.PlaneGeometry(6000, 6000, 1, 1); g.rotateX(-Math.PI / 2); g.translate(1080, y, 1060);
    const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: {cT: {value: cT}, time: U.time, camPos: U.camPos, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, fogCol: U.fogCol, op: DECK.op, nightK: U.nightK, hk: {value: hk}, sc: {value: sc}, cover: {value: cover}, sl: {value: 1 / n}, k: {value: k}},
      vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform sampler2D cT; uniform float time, op, nightK, hk, sc, cover, sl, k; uniform vec3 camPos, sun, sunCol, skyCol, fogCol; varying vec3 vP;
        float dens(vec2 p){
          vec2 u = p * sc + vec2(time * .00055, time * .00018);
          vec4 a = texture2D(cT, u), b = texture2D(cT, p * sc * 4.3 + vec2(time * .0012, -time * .0004));
          float cov = cover + (texture2D(cT, p * sc * .21 + .37).a - .5) * .5;          // clear skies and cloudy regions
          float d = (a.r * .62 + a.b * .38) - (1.0 - cov);
          d -= (b.g - .5) * .22 * (.6 + hk);                                             // wispy, eroded edges (more at the tops)
          return smoothstep(0.0, .16, d - hk * hk * .14); }
        void main(){
          float dist = length(vP - camPos);
          float fade = smoothstep(4200.0, 1400.0, dist) * smoothstep(1.0, 9.0, dist) * op;
          float dy = abs(camPos.y - vP.y); fade *= mix(.12, 1.0, smoothstep(2.0, 60.0 + 40.0 * (1.0 - k), dy)) * (k > .5 ? .62 : 1.0);   // C3: layers thin out as the camera approaches -> fly through to the ground
          if (fade < .01) discard;
          float d = dens(vP.xz); if (d < .015) discard;
          float ds = dens(vP.xz + normalize(sun.xz + 1e-4) * 9.0 * (1.0 - sun.y * .5));
          float lit = clamp(1.0 - (ds - d) * 1.6 - ds * .45, .2, 1.0);
          float above = step(vP.y, camPos.y);
          vec3 sunL = sunCol * (.38 + .25 * hk) * mix(lit, 1.0, hk * .5);
          vec3 base = skyCol * (.7 + .3 * hk) + sunL;
          vec3 under = mix((skyCol * .62 + fogCol * .2) * (.75 + .25 * lit), base, .2 + .8 * hk * hk);            // grey flat bases, bright sunlit tops
          vec3 col = mix(under, base, mix(hk, 1.0, above * .6));
          col += sunCol * pow(max(dot(normalize(camPos - vP), -sun), 0.0), 6.0) * (1.0 - d) * .25;   // silver lining against the sun
          col = mix(col, fogCol, smoothstep(600.0, 4200.0, dist) * .6) * (1.0 - nightK * .55);
          gl_FragColor = vec4(col, min(1.0, d * sl * 3.2) * fade);
          #include <colorspace_fragment>
        }`});
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.userData.y = y; scene.add(mesh); DECK.meshes.push(mesh); };
  for (let i = 0; i < 7; i++) mk(30 + i * 1.3, i / 6, .00055, .4, 0, 7);           // main cumulus deck
  for (let i = 0; i < 3; i++) mk(13 + i * .8, i / 2, .0019, .3, 1, 3);           // low small fair-weather clouds
  CLD = {material: {uniforms: {op: DECK.op}}};
}
function updateDeck(){       // draw slices back-to-front relative to the camera
  const cy = camera.position.y; for (const m of DECK.meshes) m.renderOrder = 10 + (cy > m.userData.y ? m.userData.y : 200 - m.userData.y) * .01;
}
function buildCloudsOld(){
  const NC = 120, puffs = [];
  for (let c = 0; c < NC; c++){
    const cx = -150 + rnd() * 2450, cz = -170 + rnd() * 2450, cy = 30 + rnd() * 22, rx = 22 + rnd() * 40, rz = 14 + rnd() * 26, ry = 4 + rnd() * 5, n = 34 + (rnd() * 30 | 0);
    for (let i = 0; i < n; i++){ const a = rnd() * 6.283, r = Math.sqrt(rnd()); const ox = Math.cos(a) * r * rx, oz = Math.sin(a) * r * rz; const top = Math.sqrt(Math.max(1 - r * r, 0));
      const oy = (rnd() * .95 - .05) * ry * top; puffs.push([cx + ox, cy + oy, cz + oz, (11 + rnd() * 14) * (.55 + .55 * top), oy / ry, c, 1]); }
  }
  // v4b cloud overhaul: + low small cumulus (fair-weather, flat bases, drift faster) + scattered small wisps between the layers
  for (let c = 0; c < 300; c++){
    const cx = -150 + rnd() * 2450, cz = -170 + rnd() * 2450, cy = 10 + rnd() * 7, rx = 3 + rnd() * 7, rz = 2.5 + rnd() * 5, ry = 1.6 + rnd() * 2.2, n = 9 + (rnd() * 12 | 0);
    for (let i = 0; i < n; i++){ const a = rnd() * 6.283, r = Math.sqrt(rnd()), top = Math.sqrt(Math.max(1 - r * r, 0)), oy = rnd() * ry * top;
      puffs.push([cx + Math.cos(a) * r * rx, cy + oy, cz + Math.sin(a) * r * rz, (2.6 + rnd() * 3.2) * (.6 + .5 * top), oy / ry * 1.4 - .2, c + 1000, 1.7]); }
  }
  for (let c = 0; c < 360; c++){
    const cx = -150 + rnd() * 2450, cz = -170 + rnd() * 2450, cy = 19 + rnd() * 9, n = 2 + (rnd() * 4 | 0);
    for (let i = 0; i < n; i++) puffs.push([cx + (rnd() - .5) * 6, cy + (rnd() - .5) * 1.2, cz + (rnd() - .5) * 3, 1.6 + rnd() * 2.4, .2 + rnd() * .5, c + 3000, 1.35]);
  }
  const base = new THREE.PlaneGeometry(1, 1), n = puffs.length, g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const a = new Float32Array(n * 4), b = new Float32Array(n * 3);
  puffs.forEach((p, i) => { a.set([p[0], p[1], p[2], p[3]], i * 4); b.set([p[4], hash(i * 13 + 5), p[6]], i * 3); });
  g.setAttribute('iP', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('iL', new THREE.InstancedBufferAttribute(b, 3)); g.instanceCount = n;
  const tx = [0, 1, 2, 3].map((k) => softTex(11 + k));
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {m0: {value: tx[0]}, m1: {value: tx[1]}, time: U.time, camPos: U.camPos, sun: U.sun, op: {value: 1}, fogCol: U.fogCol, sunCol: U.sunCol, skyCol: U.skyCol},
    vertexShader: `attribute vec4 iP; attribute vec3 iL; uniform float time; uniform vec3 camPos, sun; varying vec2 vUv; varying float vL, vA, vS, vUp;
      void main(){
        vec3 c = iP.xyz + vec3(time * 1.1, 0.0, time * .35) * iL.z;
        c.x = mod(c.x + 150.0, 2460.0) - 150.0; c.z = mod(c.z + 170.0, 2460.0) - 170.0;
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = iL.y * 6.283; vec2 q = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * position.xy;
        vec3 p = c + (R * q.x + Up * q.y) * iP.w;
        float d = distance(c, camPos);
        vA = smoothstep(iP.w * .6, iP.w * 2.4, d) * smoothstep(3600.0, 1800.0, d);
        vUp = smoothstep(-2.0, 12.0, camPos.y - c.y);          // seen from above: sunlit tops, softer & brighter; from below: grey flat bases
        vL = clamp(.55 + .45 * iL.x + .25 * dot(normalize(vec3(q.x, q.y, 0.0) + 1e-4), vec2(sun.x, sun.y).xyy) + vUp * .25, .25, 1.2);
        vA *= mix(1.0, .8, vUp) * (iL.z > 1.5 ? smoothstep(2600.0, 900.0, d) : 1.0);
        vS = iL.y; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D m0, m1; uniform float op; uniform vec3 fogCol, sunCol, skyCol; varying vec2 vUv; varying float vL, vA, vS, vUp;
      void main(){ float a = vS > .5 ? texture2D(m0, vUv).a : texture2D(m1, vUv).a;
        vec3 shade = mix(vec3(.5, .56, .68), vec3(1.0, .97, .93), clamp(vL, 0.0, 1.0)) * (.85 + .15 * vL);
        vec3 col = mix(shade * (sunCol * .4 + skyCol * .5 + .02), fogCol, .28);
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
  if (EXT.W) for (const c of EXT.W.labels) labels.push({type: 'cont', x: c.x, z: c.z, y: 8, pri: 110, c, el: mk('m3l m3l-cont', esc(c.name))});
  for (const p of D.places){
    const big = p.kind === 'capital', city = p.kind === 'city' || p.kind === 'floating' || p.kind === 'fortline';
    const nat = ['forest', 'lake', 'river', 'hills', 'islands', 'swamp', 'plains'].includes(p.kind);
    const cls = 'm3l ' + (big ? 'm3l-cap' : city ? 'm3l-city' : nat ? 'm3l-nat m3l-' + p.kind : p.kind === 'village' ? 'm3l-vil' : 'm3l-poi') + ' f-' + p.fac;
    const dot = !big && p.kind !== 'floating';   // v3 (LoL style): small high-contrast dot + name beside it
    const txt = big ? '<i>✦</i>' + esc(p.name) : '<b class="m3l-d"></b><span>' + esc(p.name) + '</span>';
    let y = p.kind === 'floating' ? 24 : yAt(p.x, p.z) + (big ? 3 : city ? 2.4 : nat ? 1 : p.kind === 'district' ? 1.6 : 1.2);
    if (p.style === 'volcano') y = yAt(p.x, p.z) + 3;
    const maxD = big ? 900 : city ? 520 : p.kind === 'islands' || p.kind === 'lake' && /Thyra/.test(p.name) ? 420 : nat ? 300 : p.kind === 'district' ? 150 : p.kind === 'village' ? 175 : 175;
    const minD = p.kind === 'district' ? 0 : 0;
    labels.push({type: 'place', p, x: p.x, z: p.z, y, dot, pri: big ? 90 : city ? 80 : nat ? 40 : p.kind === 'district' ? 45 : p.kind === 'village' ? 30 : 35, maxD, minD, el: mk(cls + (dot ? ' m3l-dot' : ''), txt)});
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
    let vis = l.type === 'cont' ? d > 1300 : l.type === 'fac' ? facVis && d < 1500 : d < l.maxD && !(d > 760 && l.p.kind !== 'capital');
    if (vis){
      _v.set(l.x, l.y, l.z).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1 || _v.y < -1.1 || _v.y > 1.1) vis = false;
      else {
        const sx = (_v.x * .5 + .5) * w, sy = (-_v.y * .5 + .5) * h;
        if (!l.w){ l.w = l.el.offsetWidth || 80; l.h = l.el.offsetHeight || 18; }
        const ox = l.dot ? 9 : l.w / 2;     // dot labels: anchor = the dot (left), name to the right
        const r = {x0: sx - ox - 3, x1: sx - ox + l.w + 3, y0: sy - l.h / 2 - 2, y1: sy + l.h / 2 + 2};
        if (l.type !== 'fac' && placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) vis = false;
        else { placed.push(r); l.el.style.transform = `translate(${Math.round(sx - ox)}px,${Math.round(sy - l.h / 2)}px)`; }
      }
    }
    if (l.type === 'fac') l.el.style.opacity = vis ? facOp : 0;
    if (l.type === 'cont') l.el.style.opacity = vis ? Math.min(1, (d - 1300) / 300) : 0;
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
function flyPlace(p){ const d = p.id === 'balahnur' ? 70 : p.kind === 'capital' || p.kind === 'city' ? 26 : p.kind === 'fortline' ? 90 : p.kind === 'floating' ? 55 : p.style === 'volcano' ? 32 : ['forest', 'hills', 'plains', 'islands'].includes(p.kind) ? 110 : p.kind === 'district' ? 16 : 12; flyTo(p.x, p.z, d); }
function onLabelClick(e){
  const el = e.target.closest('.m3l'); if (!el || !el._l) return; const l = el._l;
  if (l.type === 'cont'){ flyTo(l.x, l.z, 700); return; }
  if (l.type === 'fac'){ const F = D.factions[l.key]; flyTo(F.x, F.z, 560); showFaction(l.key); }
  else { flyPlace(l.p); showPlace(l.p); }
}

// ------------------------------------------------------------ camera & input
function tiltFor(d){ const t = Math.min(Math.max((Math.log(d) - Math.log(DMIN)) / (Math.log(DMAX) - Math.log(DMIN)), 0), 1); return (19 + 37 * Math.pow(t, 1.35)) * Math.PI / 180; }
function applyCam(){
  const pitch = Math.min(Math.max(tiltFor(cam.d) + cam.tilt, .16), 1.45), ty = yAt(cam.x, cam.z) * Math.min(1, 120 / cam.d) + lumiLift(cam.x, cam.z);
  const cy = Math.sin(pitch) * cam.d, ch = Math.cos(pitch) * cam.d;
  camera.position.set(cam.x - Math.sin(cam.yaw) * ch, ty + cy, cam.z + Math.cos(cam.yaw) * ch);
  const minY = Math.max(yAt(camera.position.x, camera.position.z), yAt((camera.position.x + cam.x) / 2, (camera.position.z + cam.z) / 2)) + .45; if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(cam.x, ty, cam.z);
  const hag = camera.position.y - yAt(camera.position.x, camera.position.z); camera.near = Math.min(Math.max(Math.min(cam.d * .02, hag * .35), .05), 25); camera.far = Math.max(cam.d * 6, 4200); camera.updateProjectionMatrix();   // C3: low flat views keep foreground foliage (near plane follows height above ground)
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
    if (GLB.on || GLB.busy) return;
    cv.setPointerCapture(e.pointerId); moved = 0; flying = 0;
    const rot = e.button === 2 || e.ctrlKey || e.shiftKey;
    drag = {rot, x: e.clientX, y: e.clientY, g: rot ? null : groundAt(e.clientX, e.clientY, yAt(cam.x, cam.z) * Math.min(1, 120 / cam.d) + lumiLift(cam.x, cam.z))};
  });
  cv.addEventListener('pointermove', (e) => {
    if (GLB.on) return;
    if (!drag){ hoverAt(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
    if (drag.rot){ cam.yaw += dx * .005; cam.tilt = Math.min(Math.max(cam.tilt - dy * .004, -.3), .9); goal.yaw = cam.yaw; goal.tilt = cam.tilt; drag.x = e.clientX; drag.y = e.clientY; }
    else if (drag.g){ const g = groundAt(e.clientX, e.clientY, yAt(cam.x, cam.z) * Math.min(1, 120 / cam.d) + lumiLift(cam.x, cam.z)); if (g){ cam.x += drag.g.x - g.x; cam.z += drag.g.z - g.z; clampCam(cam); goal.x = cam.x; goal.z = cam.z; applyCam(); } }
    dirtyLabels = true;
  });
  const up = (e) => { if (!drag) return; const was = drag; drag = null; if (moved < 5 && !was.rot) clickAt(e.clientX, e.clientY); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault(); if (GLB.on || GLB.busy) return; flying = 0;
    if (e.deltaY > 0 && goal.d >= DZOOM * .97){ GLB.pull += e.deltaY; if (GLB.pull > 360) enterGlobe(); return; } GLB.pull = 0;   // Step 3: en uzaktan daha da uzaklaş -> küre
    const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * .0022), nd = Math.min(Math.max(goal.d * k, DMIN), DZOOM);
    const g = groundAt(e.clientX, e.clientY);
    const gp = pickTerrain(e.clientX, e.clientY) || g;
    if (gp){ const f = 1 - nd / goal.d; goal.x += (gp.x - goal.x) * f * .9; goal.z += (gp.z - goal.z) * f * .9; clampCam(goal); }
    goal.d = nd;
  }, {passive: false});
}
function clampCam(o){ o.x = Math.min(Math.max(o.x, -120), 2280); o.z = Math.min(Math.max(o.z, -140), 2260); }
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
function onCtxLost(){
  CTX_LOST = true; if (raf){ cancelAnimationFrame(raf); raf = 0; }
  try { sessionStorage.setItem('m3dSafe', '1'); sessionStorage.setItem('m3dReopen', '1'); } catch (e) {}
  loadEl.classList.remove('done'); loadEl.classList.add('err');
  loadEl.querySelector('p').textContent = 'Grafik kartı 3D haritayı kaldıramadı; hafif modda yeniden başlatılıyor…';
  setTimeout(() => { if (CTX_LOST) location.reload(); }, 2500);
}
function onCtxRestored(){ if (CTX_LOST) location.reload(); }
const PERF = {acc: 0, n: 0, slow: 0};
function perfGuard(dtRaw){     // sustained very slow frames -> drop the pixel ratio (keeps the GPU out of driver timeouts)
  PERF.acc += dtRaw; PERF.n++;
  if (PERF.acc > 2){ const avg = PERF.acc / PERF.n; PERF.acc = 0; PERF.n = 0;
    if (avg > .07 && renderer.getPixelRatio() > 1){ renderer.setPixelRatio(1); resize(); }
    else if (avg > .1 && renderer.getPixelRatio() > .75){ renderer.setPixelRatio(.75); resize(); } }
}
function frame(now){
  if (CTX_LOST) return;
  raf = requestAnimationFrame(frame);
  if (lastT) perfGuard((now - lastT) / 1000);
  const dt = Math.min((now - (lastT || now)) / 1000, .05); lastT = now; clock += dt; U.time.value = clock;
  if (GLB.on && GLB.g){ GLB.g.frame(dt); return; }   // Step 3: küre modu (düz sahne çizilmez)
  const r = 1 - Math.exp(-dt * (flying ? 2.6 : 9));
  const ld = Math.log(cam.d) + (Math.log(goal.d) - Math.log(cam.d)) * r;
  const moving = Math.abs(goal.x - cam.x) + Math.abs(goal.z - cam.z) + Math.abs(goal.d - cam.d) > .01;
  cam.x += (goal.x - cam.x) * r; cam.z += (goal.z - cam.z) * r; cam.d = Math.exp(ld);
  cam.yaw += (goal.yaw - cam.yaw) * r; cam.tilt += (goal.tilt - cam.tilt) * r;
  if (flying && !moving) flying = 0;
  applyCam(); updateFrame(dt);
  renderer.render(scene, camera);
  if (sunLight.castShadow && sunLight.shadow.map){ U.shMap.value = sunLight.shadow.map.texture; U.shMat.value.copy(sunLight.shadow.matrix); U.shOn.value = 1; } else U.shOn.value = 0;   // C3 fix: shadow matrix was never passed -> terrain never received tree/building shadows
  updateLabels();
  const g1 = groundAt(innerWidth / 2 - 50, innerHeight * .9), g2 = groundAt(innerWidth / 2 + 50, innerHeight * .9);
  if (g1 && g2){ const km100 = Math.hypot(g2.x - g1.x, g2.z - g1.z); const nice = [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find((n) => n / km100 * 100 > 60) || 500;
    scaleEl.querySelector('i').style.width = (nice / km100 * 100).toFixed(0) + 'px'; scaleEl.querySelector('span').textContent = (nice < 1 ? '500 m' : nice + ' km'); }
}
function updateFrame(dt){
  const d = cam.d, tN = Math.min(Math.max((Math.log(d) - Math.log(DMIN)) / (Math.log(DMAX) - Math.log(DMIN)), 0), 1);
  updateChunks(); updateBuildings(); updateImpostors(); if (BLD.far) for (const m of BLD.far) m.visible = camera.position.y < 330; refreshNearTrees(false); updateSmoke(); updateVeg(false);
  U.fineK.value = 1 - Math.min(1, Math.max(0, (d - 6) / 22));
  if (FIELDM) FIELDM.uniforms.op.value = Math.min(1, Math.max(0, (260 - d) / 90));
  if (MIST) MIST.material.uniforms.op.value = Math.min(1, Math.max(0, (200 - d) / 80));
  U.borderVis.value = Math.min(1, Math.max(0, (d - 220) / 250)) * .9;
  updateDayNight(dt);
  const pitch = Math.min(Math.max(tiltFor(cam.d) + cam.tilt, .16), 1.45), horiz = 1 - Math.min(1, Math.max(0, (pitch - .25) / .35));   // horizon haze when looking flat
  U.fogK.value = (.00016 + .0032 * Math.pow(1 - tN, 2.6)) * (d > 1150 ? Math.max(.4, 1150 / d) : 1) * (DNC.fogMul || 1) * (1 + horiz * 1.6); scene.fog.density = U.fogK.value;
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
    const key = sx.toFixed(4) + ',' + sz.toFixed(4) + ',' + S.toFixed(2) + ',' + (ty * 50 | 0) + ',' + (SUN.x * 400 | 0) + ',' + (SUN.y * 400 | 0) + ',' + (TR.lastX || 0) + ',' + (TR.lastZ || 0) + ',' + (TR.lastY || 0);   // D4
    if (key !== DNC.shKey || clock - (DNC.shT || 0) > .4){ DNC.shKey = key; DNC.shT = clock; renderer.shadowMap.needsUpdate = true; }
  } else renderer.shadowMap.needsUpdate = false;
  routeMats.forEach(({m, kind}) => { m.uniforms.op.value = kind === 'dirt' ? Math.min(1, Math.max(0, (160 - d) / 80)) : kind === 'road' ? Math.min(.85, Math.max(0, (d - 70) / 80)) * Math.min(1, Math.max(0, (420 - d) / 160))
    : kind === 'trade' ? Math.min(1, Math.max(0, (d - 60) / 90)) * Math.min(1, Math.max(.35, (900 - d) / 300)) : Math.min(1, Math.max(.3, (900 - d) / 300)); });
  if (TR.imp) TR.imp.visible = d < 520;
  if (CLD){ CLD.material.uniforms.op.value = d > 1300 ? Math.max(.35, 1 - (d - 1300) / 1500) : 1; updateDeck(); }
  if (windG) windG.material.uniforms.op.value = Math.min(1, Math.max(0, (d - 30) / 80)) * Math.min(1, Math.max(0, (500 - d) / 200));
  updateSpecial(dt); updateFPS(dt); if (EXT.W) updateExt(dt);
}
function resize(){ if (!renderer) return; const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); labels.forEach((l) => { l.w = 0; }); if (GLB.g) GLB.g.resize(w, h); }

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
    console.warn('3D map failed', err); loadEl.classList.add('err'); building = null;
    const gl = /WebGL|context/i.test(String(err && err.message));
    loadEl.querySelector('p').textContent = gl ? 'Tarayıcı WebGL’i geçici olarak kapattı (önceki bir grafik çökmesi yüzünden). Tarayıcıyı tamamen kapatıp yeniden açın, sonra tekrar deneyin; ya da 2D haritayı kullanın.'
      : '3D harita yüklenemedi. Sayfayı yenileyip tekrar dene ya da 2D haritayı kullan.';
  }
}
export function close(){
  if (!isOpen) return; isOpen = false; root.classList.remove('on'); document.body.classList.remove('m3d-open');
  if (raf){ cancelAnimationFrame(raf); raf = 0; }
  setTimeout(() => { if (!isOpen) root.hidden = true; }, 380);
  setTimeout(() => { if (!isOpen && window.__ulvAudioHold) window.__ulvAudioHold(false); }, 350);
}
window.__ulvMap3D = {open, close, fly: flyTo, jump: (x, z, d, yaw, tilt) => { flyTo(x, z, d); if (yaw != null) goal.yaw = yaw; if (tilt != null) goal.tilt = tilt; Object.assign(cam, goal); flying = 0; },
  places: () => D && D.places.map((p) => ({id: p.id, name: p.name, x: p.x, z: p.z, kind: p.kind})), cam: () => ({...cam}), globe: (v) => v ? enterGlobe() : exitGlobe(null), glook: (ll, d) => GLB.g && (ll.length === 3 ? GLB.g.lookDir(ll, d) : GLB.g.lookAt(ll, d)), stats: () => renderer ? {glb: GLB.on && GLB.g ? GLB.g.stats() : null, thin: TR.thin, tod: +DNC.p.toFixed(3), nk: +U.nightK.value.toFixed(2), glow: DNC.glow ? [DNC.glow.visible, DNC.glow.geometry.attributes.position.count, DNC.spark.geometry.attributes.position.count] : 0, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures} : null, continents: CONTINENTS, tod: (p) => { DNC.p = p; },
  prof: () => { const out = []; scene.traverseVisible((o) => { const g = o.geometry; if (!g || !(o.isMesh || o.isPoints)) return; let n = g.index ? g.index.count : g.attributes.position.count; n = Math.min(n, g.drawRange.count); let t = o.isPoints ? n : n / 3; const ic = o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? g.instanceCount : 1; out.push([o.type + ':' + (o.material && o.material.type) + ':ro' + o.renderOrder + (o.castShadow ? ':S' : '') + ':' + (o.name || ''), Math.round(t), ic === Infinity ? -1 : ic, Math.round(t * (ic === Infinity ? 1 : ic))]); }); out.sort((a, b) => b[3] - a[3]); return {n: out.length, sh: renderer.shadowMap.enabled, top: out.slice(0, 18)}; }};

// ------------------------------------------------------------ v3: farm fields (crisp meshes draped on the terrain)
const FIELD_F = `
uniform sampler2D nTex, auxTex; uniform vec3 sun, sunCol, skyCol, gndCol, camPos; uniform float op;
varying vec2 vL, vSz; varying float vCrop, vR; varying vec3 vP;
${NOISE}
${ATMO}
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec2 uv = vP.xz / vec2(1024.0, 768.0);
  vec3 n = normalize(texture2D(nTex, uv).xyz * 2.0 - 1.0);
  int c = int(vCrop + .5);
  vec3 a = c == 0 ? vec3(.80, .66, .30) : c == 1 ? vec3(.44, .58, .22) : c == 2 ? vec3(.47, .35, .22) : c == 3 ? vec3(.84, .78, .26) : c == 4 ? vec3(.30, .44, .18) : vec3(.68, .62, .40);
  a = lin(a) * (.9 + .2 * vR);
  float rows = c == 2 ? 70.0 : 46.0;
  float st = .5 + .5 * sin(vL.x * rows * 6.2832 / max(vSz.x, .1) * vSz.x);
  float f = mix(.84, 1.06, smoothstep(.2, .8, st));
  a *= f * (.92 + .16 * vn(vP.xz * 9.0 + vR * 20.0));
  vec2 e = min(vL, vSz - vL); float edge = min(e.x, e.y);
  a = mix(lin(vec3(.30, .36, .18)), a, smoothstep(.006, .022, edge));       // hedge / verge
  float sh = texture2D(auxTex, uv).a;
  float dif = max(dot(n, sun), 0.0);
  vec3 col = a * (mix(gndCol, skyCol, .8) * .62 + sunCol * dif * sh);
  col = atmo(col, vP, camPos);
  gl_FragColor = vec4(col, op * smoothstep(0.0, .01, edge));
  #include <colorspace_fragment>
}`;
let FIELDM = null;
function buildFields(){
  const L = D.fields || []; if (!L.length) return;
  const SX = 4, SZ = 3, nv = (SX + 1) * (SZ + 1), ni = SX * SZ * 6;
  const pos = new Float32Array(L.length * nv * 3), lo = new Float32Array(L.length * nv * 2), sz = new Float32Array(L.length * nv * 2), cr = new Float32Array(L.length * nv * 2), idx = new Uint32Array(L.length * ni);
  L.forEach(([x, z, w, l, th, crop], f) => {
    const c = Math.cos(th), s = Math.sin(th), r = hash(f * 7 + 1), ov = f * nv;
    for (let j = 0; j <= SZ; j++) for (let i = 0; i <= SX; i++){
      const lx = (i / SX - .5) * w, lz = (j / SZ - .5) * l, px = x + c * lx - s * lz, pz = z + s * lx + c * lz, k = ov + j * (SX + 1) + i;
      pos.set([px, yAt(px, pz) + .012, pz], k * 3); lo.set([lx + w / 2, lz + l / 2], k * 2); sz.set([w, l], k * 2); cr.set([crop, r], k * 2);
    }
    let o = f * ni; for (let j = 0; j < SZ; j++) for (let i = 0; i < SX; i++){ const a = ov + j * (SX + 1) + i, b = a + 1, cc = a + SX + 1, d = cc + 1; idx.set([a, cc, b, b, cc, d], o); o += 6; }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aL', new THREE.BufferAttribute(lo, 2)); g.setAttribute('aS', new THREE.BufferAttribute(sz, 2)); g.setAttribute('aC', new THREE.BufferAttribute(cr, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  FIELDM = new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: {nTex: U.nTex, auxTex: U.auxTex, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol, camPos: U.camPos, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, op: {value: 1}},
    vertexShader: 'attribute vec2 aL, aS, aC; varying vec2 vL, vSz; varying float vCrop, vR; varying vec3 vP; void main(){ vL = aL; vSz = aS; vCrop = aC.x; vR = aC.y; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: FIELD_F});
  const m = new THREE.Mesh(g, FIELDM); m.renderOrder = 2; m.frustumCulled = false; scene.add(m);
}

// ------------------------------------------------------------ v3: ground vegetation near the camera (grass tufts, bushes, rocks, flowers, reeds) with distance fade
const VEG = {names: ['v_grass', 'v_leafs', 'v_bush', 'v_rock', 'v_rocks', 'v_flowery', 'v_flowerr', 'v_stump', 'v_log', 'v_reed', 'v_lily'], meshes: null, last: null, R: {value: 6}};
function vegMaterial(){
  const m = new THREE.MeshLambertMaterial({map: MAT.flat});
  m.onBeforeCompile = (sh) => { sh.uniforms.vegR = VEG.R; sh.uniforms.time = U.time;
    sh.vertexShader = 'uniform float vegR, time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float dd = distance(ip.xz, cameraPosition.xz);
        float hh = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float k = 1.0 - smoothstep(vegR * (.55 + .4 * hh), vegR * (.6 + .4 * hh), dd);
        transformed *= k; transformed.x += sin(time * 1.7 + ip.x * 40.0) * .05 * position.y * k; }`); };
  return m;
}
function buildVeg(){
  VEG.mat = vegMaterial();
  VEG.meshes = VEG.names.map((n) => { if (!MODELS[n]) return null; const part = modelGeo(n, 'n')[0]; const im = new THREE.InstancedMesh(part.g, VEG.mat, 512); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; scene.add(im); return {im, part, cap: 512}; });
}
// v4b: world-anchored deterministic placement (fixed cell grids per band -> a plant never moves when the camera moves), 3 bands out to 60 km
const VEG_BANDS = [[0, 6.5, .09, 1], [6, 22, .28, 2.1], [21, 40, .75, 3.6]];
function vegBiome(x, z){
  if (x >= 0 && z >= 0 && x <= WK && z <= HK){ const ai = Math.min(Math.max(z * 2 | 0, 0), HH - 1) * HW + Math.min(Math.max(x * 2 | 0, 0), HW - 1); return AUXP[ai * 4 + 1] < 200 ? -1 : 0; }
  const c = contAt(x, z); if (!c) return -1;
  const i = Math.min(Math.max((z - c.z0) / c.R | 0, 0), c.H - 1) * c.W + Math.min(Math.max((x - c.x0) / c.R | 0, 0), c.W - 1);
  return c.Y[i] < .03 ? -1 : 100 + c.Bi[i];
}
function updateVeg(force){
  if (!VEG.meshes) return;
  const d = cam.d, on = d < 160;
  if (!on){ if (VEG.last){ VEG.meshes.forEach((M) => { if (M) M.im.count = 0; }); VEG.last = null; } return; }
  // v4b fix: rings are centred under the camera (the shader fades by camera distance) and reach far when the view is flat
  const pitch = Math.min(Math.max(tiltFor(cam.d) + cam.tilt, .16), 1.45), flat = 1 - Math.min(1, Math.max(0, (pitch - .3) / .5));
  const R = Math.min(SAFE ? 22 : 40, Math.max(4, d * 1.6, flat * 40)); VEG.R.value = R;
  const tx = camera.position.x, tz = camera.position.z, nb = VEG_BANDS.filter((b) => b[0] < R).length;
  VEG.bc = VEG.bc || [];
  let dirty = !!force || !VEG.last || nb !== VEG.last[2];
  for (let bi = 0; bi < nb; bi++){ const b = VEG.bc[bi], rout = Math.min(VEG_BANDS[bi][1], R); if (!b || Math.hypot(tx - b.x, tz - b.z) > rout * .12 || Math.abs(rout - b.r) > rout * .1) dirty = true; }
  if (!dirty) return;
  VEG.last = [tx, tz, nb, R];
  const per = VEG.names.map(() => []), sw = U.swampC.value;
  for (let bi = 0; bi < nb; bi++){
    const [rin, rb, C, sk] = VEG_BANDS[bi], rout = Math.min(rb, R);
    const bc = VEG.bc[bi];
    if (bc && !force && Math.hypot(tx - bc.x, tz - bc.z) <= rout * .12 && Math.abs(rout - bc.r) <= rout * .1){ bc.per.forEach((L, k) => { for (const it of L) per[k].push(it); }); continue; }
    const myPer = VEG.names.map(() => []); VEG.bc[bi] = {x: tx, z: tz, r: rout, per: myPer};
    const i0 = Math.floor((tx - rout) / C), i1 = Math.ceil((tx + rout) / C), j0 = Math.floor((tz - rout) / C), j1 = Math.ceil((tz + rout) / C);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
      const h1 = hash(i * 73856093 ^ j * 19349663 ^ (bi * 0x5bd1e995)), x = (i + hash(i * 31 + j * 17 + 5 + bi)) * C, z = (j + hash(i * 13 + j * 57 + 9 + bi)) * C;
      const dd = Math.sqrt((x - tx) ** 2 + (z - tz) ** 2);
      if (dd > rout || dd < rin) continue;
      const bio = vegBiome(x, z); if (bio < 0) continue;
      if (bio === 0){ const road = maskAt(x, z, 0), urb = maskAt(x, z, 3), fld = maskAt(x, z, 2); if (road > .25 || urb > .1 || fld > .05) continue; }
      const y = yMesh(x, z), hk = y / EX, sl = Math.abs(yMesh(x + .25, z) - yMesh(x - .25, z)) + Math.abs(yMesh(x, z + .25) - yMesh(x, z - .25));
      let t = -1, s = 1;
      if (bio >= 100){
        const b = bio - 100;
        if (b === 5 || b === 6 || b === 10 || b === 3){ t = h1 < .06 ? 3 : h1 < .1 ? 4 : b !== 3 && h1 < .13 ? 2 : -1; s = 1.1; }
        else if (b === 4 || sl > 1.4){ t = h1 < .35 ? 3 : h1 < .6 ? 4 : -1; s = 1.2; }
        else if (b === 7){ t = h1 < .2 ? 7 : h1 < .35 ? 8 : h1 < .5 ? 3 : -1; }
        else { const meadow = hash(Math.floor(x / 1.7) * 7 + Math.floor(z / 1.7) * 131);
          t = h1 < .4 ? (meadow < .5 ? 0 : 1) : h1 < .56 ? 2 : h1 < .62 ? 4 : h1 < .66 && (b === 12 || b === 0) ? (meadow < .5 ? 5 : 6) : h1 < .69 ? 7 : -1; }
      } else {
        const lat = z / HK, swamp = sw.z > 0 && Math.hypot(x - sw.x, z - sw.y) < sw.z;
        if (swamp){ t = h1 < .5 ? 9 : h1 < .62 ? 10 : h1 < .75 ? 7 : h1 < .85 ? 2 : -1; s = .9; }
        else if (hk > 2.4 || lat < .2 || sl > 1.4){ t = h1 < .35 ? 3 : h1 < .6 ? 4 : -1; s = 1.2; }
        else {
          const meadow = hash(Math.floor(x / 1.7) * 7 + Math.floor(z / 1.7) * 131);
          t = h1 < .42 ? (meadow < .5 ? 0 : 1) : h1 < .56 ? 2 : h1 < .63 ? 4 : h1 < .66 ? 3 : h1 < .7 && lat > .4 ? (meadow < .5 ? 5 : 6) : h1 < .72 ? 7 : h1 < .735 ? 8 : -1;
        }
      }
      if (t < 0) continue;
      myPer[t].push([x, y, z, h1, s * sk, i * 7919 + j * 104729 + bi]);
    }
    myPer.forEach((L, k) => { for (const it of L) per[k].push(it); });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const BASE = [.11, .1, .1, .07, .1, .11, .11, .07, .07, .16, .16];
  per.forEach((list, k) => { const M = VEG.meshes[k]; if (!M) return;
    if (list.length > M.cap){ M.im.removeFromParent(); M.im.dispose(); M.cap = Math.ceil(list.length * 1.4); const im = new THREE.InstancedMesh(M.part.g, VEG.mat, M.cap); im.frustumCulled = false; im.receiveShadow = true; scene.add(im); M.im = im; }
    list.forEach(([x, y, z, h1, s, id], n) => { const sz = BASE[k] * s * (.6 + .9 * hash(id * 7 + k)); e.set(0, h1 * 40, 0); q.setFromEuler(e); v.set(x, y - .004, z); sc.set(sz, sz * (k < 3 || k === 9 ? 1.4 : 1), sz); m4.compose(v, q, sc); M.im.setMatrixAt(n, m4);
      c.setRGB(1, 1, 1).offsetHSL((hash(id + k * 3) - .5) * .05, 0, (hash(id * 3 + 1) - .5) * .2); M.im.setColorAt(n, c); });
    M.im.count = list.length; M.im.instanceMatrix.needsUpdate = true; if (M.im.instanceColor) M.im.instanceColor.needsUpdate = true;
  });
}

// ------------------------------------------------------------ v3: icebergs around Ankaltvarg (bobbing, half submerged)
function buildBergs(){
  const L = D.bergs || []; if (!L.length) return;
  const mat = new THREE.MeshLambertMaterial({map: MAT.flat, color: 0xf4fbff});
  mat.onBeforeCompile = (sh) => { sh.uniforms.time = U.time; sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n float ph = instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 2.1; transformed.y += sin(time * .6 + ph) * .04;'); };
  ['berg_a', 'berg_b', 'berg_c'].forEach((n, k) => {
    const arr = L.filter((b) => b[4] === k); if (!arr.length || !MODELS[n]) return;
    for (const part of modelGeo(n, 'n')){
      const im = new THREE.InstancedMesh(part.g, mat, arr.length), m4 = new THREE.Matrix4();
      arr.forEach(([x, z, s, r], i) => { const h = k === 1 ? s * .7 : s * 1.6; m4.copy(M4(x, -s * .12, z, r, s, h, s)); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; scene.add(im);
    }
  });
}

// ------------------------------------------------------------ v3: swamp mist (low drifting veils over Dornensumpf)
let MIST = null;
function buildMist(){
  if (!D.swamp) return;
  const [sx, sz, sr] = D.swamp, n = 160, base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const a = new Float32Array(n * 4);
  let tries = 0;
  for (let i = 0; i < n; i++){ const ang = rnd() * 6.283, r = Math.sqrt(rnd()) * sr * .9, x = sx + Math.cos(ang) * r, z = sz + Math.sin(ang) * r; if (yAt(x, z) < .03 * EX && tries++ < 3000){ i--; continue; } a.set([x, yAt(x, z) + .05 + rnd() * .12, z, 1.0 + rnd() * 1.8], i * 4); }
  g.setAttribute('iP', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = n;
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {map: {value: softTex(12)}, time: U.time, op: {value: 1}, fogCol: U.fogCol, camPos: U.camPos},
    vertexShader: `attribute vec4 iP; uniform float time; uniform vec3 camPos; varying vec2 vUv; varying float vA;
      void main(){ vec3 c = iP.xyz + vec3(sin(time * .05 + iP.x) * 1.5, 0.0, cos(time * .04 + iP.z) * 1.5);
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        float an = iP.x * 3.7 + iP.z; vec2 q = mat2(cos(an), sin(an), -sin(an), cos(an)) * position.xy * iP.w * vec2(2.0, 1.3);
        vec3 p = c + vec3(q.x, 0.0, q.y);
        vA = smoothstep(1.0, 5.0, distance(c, camPos)) * (1.0 - smoothstep(40.0, 70.0, distance(c, camPos))); vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float op; uniform vec3 fogCol; varying vec2 vUv; varying float vA;
      void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(mix(vec3(.78, .82, .76), fogCol, .3), a * .16 * op * vA);
        #include <colorspace_fragment>
      }`});
  MIST = new THREE.Mesh(g, m); MIST.frustumCulled = false; MIST.renderOrder = 7; scene.add(MIST);
}

// ------------------------------------------------------------ v4: Luminaraeth - floating archipelago: shaped rock islands, dense elven city, waterfalls, volumetric cloud bank
const NOISE3 = `
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ return vn3(p) * .55 + vn3(p * 2.03 + 11.7) * .28 + vn3(p * 4.1 + 3.3) * .17; }`;
let LUMI = null;
function buildSpecial(){
  const lp = D.places.find((p) => p.kind === 'floating'); if (!lp) return;
  const g = new THREE.Group(); g.position.set(lp.x, 0, lp.z); scene.add(g);
  // islands: [x, z, radius, height, model]
  const isl = [[0, 0, 5.2, 34, 0], [-8.6, 3.4, 3.0, 37, 1], [7.4, -3.8, 3.3, 31.5, 2], [3.2, 8.6, 2.6, 39, 3], [-5.0, -8.2, 2.4, 35.5, 4], [10.8, 5.6, 1.9, 41, 1], [-11.8, -2.6, 1.8, 30, 2],
               [-2.6, 12.2, 1.4, 43, 0], [13.2, -8.8, 1.3, 36.5, 3], [-13.0, 8.6, 1.2, 33, 4], [5.5, -11.6, 1.5, 38.5, 0], [0.8, -5.6, .9, 44, 2], [-6.8, 9.6, .8, 30.5, 1], [9.0, 11.6, .7, 45, 4]];
  const rockM = new THREE.MeshLambertMaterial({map: MAT.flat});
  const bmat = new THREE.MeshLambertMaterial({map: MAT.flat});
  const fallM = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {time: U.time, fogCol: U.fogCol},
    vertexShader: 'varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time; uniform vec3 fogCol; varying vec2 vUv; varying float vY;
      ${NOISE}
      void main(){ float x = vUv.x, y = vUv.y;
        float streak = vn(vec2(x * 9.0, y * 3.0 + time * 1.6)) * .6 + vn(vec2(x * 23.0, y * 7.0 + time * 2.4)) * .4;
        float edge = smoothstep(0.0, .25, x) * smoothstep(1.0, .75, x);
        float spread = smoothstep(.0, .35, y);                     // widening + fading into spray toward the bottom
        float a = edge * (.35 + .55 * streak) * mix(.25, 1.0, spread) * smoothstep(0.0, .08, 1.0 - y + .02);
        vec3 c = mix(vec3(.82, .93, 1.0), vec3(1.0), streak * .6); c = mix(c, fogCol, .15);
        gl_FragColor = vec4(c, a * .6);
        #include <colorspace_fragment>
      }`});
  const elfM = ['elf_spire', 'elf_tower', 'elf_hall', 'elf_house', 'elf_shrine'];
  const per = {}; elfM.forEach((m) => { per[m + '|g'] = []; per[m + '|h'] = []; });
  const tops = [];
  isl.forEach(([x, z, r, y, mi], k) => {
    y = y * .5 + 4; const s = new THREE.Group(); s.position.set(x, y, z); s.userData.ph = hash(k * 3) * 6; s.userData.y0 = y;
    const sy = r * .62;
    for (const part of modelGeo('fisle_' + mi, 'n')){ const m = new THREE.Mesh(part.g, rockM); m.scale.set(r, sy, r); m.rotation.y = hash(k * 11) * 6.28; m.castShadow = true; m.receiveShadow = true; s.add(m); }
    // waterfalls off the rim of the larger islands
    const nf = r > 2.2 ? 3 : r > 1.3 ? 1 : 0;
    for (let f = 0; f < nf; f++){
      const a = hash(k * 17 + f * 5) * 6.283, len = 4 + hash(k * 5 + f) * 5 + r, w = .12 + r * .035;
      const pl = new THREE.PlaneGeometry(w, len, 1, 8); pl.translate(0, -len / 2, 0);
      const P = pl.attributes.position; for (let i = 0; i < P.count; i++){ const t = -P.getY(i) / len; P.setX(i, P.getX(i) * (1 + t * 1.4)); P.setZ(i, t * t * .8); }
      const fm = new THREE.Mesh(pl, fallM); fm.position.set(Math.cos(a) * r * .98, .06 * sy, Math.sin(a) * r * .98); fm.rotation.y = -a + Math.PI / 2; fm.renderOrder = 6; s.add(fm);
    }
    g.add(s); floats.push(s); tops.push([x, y, z, r, sy, k]);
    // dense elven city on top (main island = the city core)
    const n = Math.round(r * r * (k === 0 ? 11 : 7)), pts = [];
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++){
      const a = hash(k * 977 + tries * 13) * 6.283, rr = Math.sqrt(hash(k * 331 + tries * 7)) * r * .82, px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      const core = 1 - rr / (r * .82);
      let m = core > .7 && hash(tries * 3 + k) < .5 ? 'elf_spire' : core > .35 && hash(tries * 5 + k) < .35 ? 'elf_tower' : hash(tries * 7 + k) < .3 ? 'elf_hall' : hash(tries * 9 + k) < .15 ? 'elf_shrine' : 'elf_house';
      const sc = (m === 'elf_spire' ? .22 + core * .2 : m === 'elf_tower' ? .3 : .2) * (.85 + hash(tries) * .3) * (k === 0 ? 1.1 : 1);
      const rad = sc * (m === 'elf_hall' ? .6 : .38);
      if (pts.some(([qx, qz, qr]) => (qx - px) ** 2 + (qz - pz) ** 2 < (qr + rad) ** 2)) continue;
      pts.push([px, pz, rad]); i++;
      const ty = .1 * sy * (1 - (rr / r) ** 2) - .02;
      per[m + '|' + (hash(tries * 13 + k) < .6 ? 'g' : 'h')].push([px, ty, pz, sc, hash(tries * 17) * 6.28, s]);
    }
  });
  // v4b: Luminaraeth night lights - warm windows + pale-cyan elven lanterns on every island (move with the bobbing islands), soft glow over the main island
  const lightM = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {nightK: U.nightK, time: U.time, pxK: U.pxK},
    vertexShader: `attribute vec4 lw; uniform float nightK, time, pxK; varying float vA; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        float on = lw.w > .5 ? 1.0 : step(.22, fract(lw.x * 13.7 + floor(time / 19.0 + lw.x * 7.0) * .618));
        vA = nightK * on * (.8 + .2 * sin(time * (lw.w > .5 ? .8 : 2.3) + lw.x * 40.0)) * (lw.w > .5 ? .55 : 1.0);
        vC = lw.w > .5 ? vec3(.55, .85, 1.0) : mix(vec3(1.0, .72, .4), vec3(.6, .95, 1.0), step(.6, lw.y));
        gl_PointSize = lw.w > .5 ? clamp(lw.z * pxK / d, 2.0, 64.0) : clamp(.07 * pxK / d, 1.4, 7.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float r = length(gl_PointCoord - .5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vC * pow(1.0 - r, 1.8) * vA * 1.3, 1.0); }`});
  const byIsl = new Map();
  for (const key in per) for (const [px, ty, pz, sc, , s2] of per[key]){ const L = byIsl.get(s2) || []; byIsl.set(s2, L);
    const hgt = key.startsWith('elf_spire') ? 2.2 : key.startsWith('elf_tower') ? 1.4 : .7, w = hash(Math.round(px * 977 + pz * 131));
    L.push(px, ty + sc * hgt * .6, pz, w, w, 0, 0); if (key.startsWith('elf_spire')) L.push(px, ty + sc * hgt * 1.4, pz, w * .7 + .3, .9, 0, 0); }
  tops.forEach(([x, y, z, r, sy, k]) => { const s2 = floats[floats.length - isl.length + k]; const L = byIsl.get(s2) || []; byIsl.set(s2, L); L.push(0, .2 * sy + .4, 0, hash(k), 0, r * 1.4, 1); });
  for (const [s2, L] of byIsl){ const n = L.length / 7, pos = new Float32Array(n * 3), lw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++){ pos.set(L.slice(i * 7, i * 7 + 3), i * 3); lw.set(L.slice(i * 7 + 3, i * 7 + 7), i * 4); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('lw', new THREE.BufferAttribute(lw, 4));
    const P = new THREE.Points(gg, lightM); P.frustumCulled = false; P.renderOrder = 12; s2.add(P); }
  // instanced per island group (islands bob independently -> instance under each island group)
  for (const key in per){
    const [m, v] = key.split('|'); const L = per[key]; if (!L.length || !MODELS[m]) continue;
    const byIsle = new Map(); for (const it of L){ const a = byIsle.get(it[5]) || []; a.push(it); byIsle.set(it[5], a); }
    for (const [s, arr] of byIsle) for (const part of modelGeo(m, v)){
      const im = new THREE.InstancedMesh(part.g, bmat, arr.length), m4 = new THREE.Matrix4();
      arr.forEach(([x, y, z, sc, r], i) => { m4.copy(M4(x, y, z, r, sc, sc, sc)); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; s.add(im);
    }
  }
  // light bridges between neighbouring islands (thin arcs)
  const brM = new THREE.MeshLambertMaterial({color: 0xf1ecdf});
  for (let a = 0; a < isl.length; a++) for (let b = a + 1; b < isl.length; b++){
    const A = isl[a].slice(), B = isl[b].slice(); A[3] = A[3] * .5 + 4; B[3] = B[3] * .5 + 4; const dd = Math.hypot(A[0] - B[0], A[1] - B[1]); if (dd > 8.5 || (a > 0 && b > 0 && dd > 6.2)) continue;
    const p0 = new THREE.Vector3(A[0], A[3] + .15, A[1]), p1 = new THREE.Vector3(B[0], B[3] + .15, B[1]), dir = p1.clone().sub(p0).setY(0).normalize();
    p0.addScaledVector(dir, A[2] * .8); p1.addScaledVector(dir, -B[2] * .8);
    const mid = p0.clone().add(p1).multiplyScalar(.5); mid.y += .6;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .045, 4, false), brM); g.add(m);
  }
  // volumetric cloud bank: raymarched noise in a box around + beneath the islands
  const box = new THREE.BoxGeometry(46, 24, 46); box.translate(0, 16, 0);
  const cm = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.BackSide,
    uniforms: {time: U.time, camPos: U.camPos, sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, fogCol: U.fogCol, ctr: {value: new THREE.Vector3(lp.x, 16, lp.z)}, op: {value: 1}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time, op; uniform vec3 camPos, sun, sunCol, skyCol, fogCol, ctr; varying vec3 vW;
      ${NOISE3}
      float dens(vec3 p){
        vec3 q = p - ctr; float r = length(q.xz);
        float shell = smoothstep(23.0, 12.0, r);
        float low = smoothstep(6.0, 9.5, p.y) * smoothstep(14.5, 10.5, p.y);     // cloud deck under the islands
        float wisp = smoothstep(15.0, 18.0, p.y) * smoothstep(27.0, 21.0, p.y) * smoothstep(5.0, 11.0, r) * .55;   // wisps drifting between them
        float n = fbm3(vec3(p.x * .16 + time * .02, p.y * .3, p.z * .16 - time * .012));
        float n2 = vn3(p * .55 + vec3(time * .05, 0.0, 0.0));
        return clamp((n * 1.25 + n2 * .25 - .68) * 3.0, 0.0, 1.0) * shell * max(low, wisp * .6);
      }
      void main(){
        vec3 ro = camPos, rd = normalize(vW - camPos);
        vec3 bmin = ctr - vec3(23.0, 12.0, 23.0), bmax = ctr + vec3(23.0, 12.0, 23.0);
        vec3 t0 = (bmin - ro) / rd, t1 = (bmax - ro) / rd; vec3 tmin = min(t0, t1), tmax = max(t0, t1);
        float ta = max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), tb = min(min(tmax.x, tmax.y), tmax.z);
        if (tb <= ta) discard;
        float st = (tb - ta) / 28.0, T = 1.0; vec3 L = vec3(0.0);
        float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        for (int i = 0; i < 28; i++){
          vec3 p = ro + rd * (ta + (float(i) + j) * st);
          float d = dens(p);
          if (d > .01){
            float ds = dens(p + sun * 1.6);
            vec3 lit = mix(vec3(.62, .66, .74), vec3(1.0, .97, .92), exp(-ds * 2.2)) * mix(skyCol, sunCol, .55) * 1.05;
            float a = 1.0 - exp(-d * st * .28);
            L += T * a * lit; T *= 1.0 - a;
            if (T < .03) break;
          }
        }
        float A = (1.0 - T) * op; if (A < .005) discard;
        vec3 col = mix(L / max(1.0 - T, 1e-3), fogCol, .18);
        gl_FragColor = vec4(col, A);
        #include <colorspace_fragment>
      }`});
  const cb = new THREE.Mesh(box, cm); cb.renderOrder = 8; cb.frustumCulled = true; scene.add(cb); cb.position.set(lp.x, 0, lp.z);
  LUMI = {g, cloud: cb, cm, lp};
}
function updateSpecial(dt){
  for (const s2 of floats){ s2.position.y = s2.userData.y0 + Math.sin(clock * .5 + s2.userData.ph) * .25; s2.rotation.y += dt * .004; }
  if (LUMI){ const dd = Math.hypot(camera.position.x - LUMI.lp.x, camera.position.z - LUMI.lp.z); LUMI.cm.uniforms.op.value = Math.min(1, Math.max(0, (700 - dd) / 300)); LUMI.cloud.visible = dd < 700; }
}
// ------------------------------------------------------------ v4: tiny FPS counter
let FPSEL = null, fpsN = 0, fpsT = 0;
function updateFPS(dt){
  if (!FPSEL){ FPSEL = document.createElement('div'); FPSEL.className = 'm3d-fps'; root.appendChild(FPSEL); }
  fpsN++; fpsT += dt; if (fpsT > .5){ FPSEL.textContent = Math.round(fpsN / fpsT) + ' fps'; fpsN = 0; fpsT = 0; }
}
// camera pivot rises to the floating city when you are near it (otherwise you only see the undersides)
function lumiLift(x, z){ if (!LUMI) return 0; const d = Math.hypot(x - LUMI.lp.x, z - LUMI.lp.z); const t = Math.min(1, Math.max(0, (60 - d) / 35)); return 20 * t * t * (3 - 2 * t); }

// ------------------------------------------------------------ v4 B: other continents (Elf kıtası, Buz Adaları, Ivar'ın Adaları, Güney Toprakları, Bilinmeyen Kıta)
const EXT = {conts: [], W: null, chunks: [], last: null, ships: []};
function loadExt(){
  return fetch(url('ext/world.json')).then((r) => r.ok ? r.json() : null).then(async (W) => {
    if (!W) return null;
    const [bld, wBm, ...ims] = await Promise.all([fetch(url('ext/ext_bld.bin')).then((r) => r.arrayBuffer()), loadImg('ext/extw.png'),
      ...W.conts.flatMap((c) => [loadImg('ext/' + c.k + '_h.png'), loadImg('ext/' + c.k + '_c.webp'), loadImg('ext/' + c.k + '_v.png')])]);
    return {W, bld, wBm, ims};
  }).catch((e) => { console.warn('ext load', e); return null; });
}
function initExt(X){
  if (!X) return null;
  const W = X.W; EXT.W = W; const span = W.hmax - W.hmin;
  W.conts.forEach((c, i) => {
    const hBm = X.ims[i * 3], cBm = X.ims[i * 3 + 1], vBm = X.ims[i * 3 + 2];
    const hp = pixels(hBm), n = c.W * c.H, Y = new Float32Array(n), Bi = new Uint8Array(n);
    for (let k = 0, j = 0; k < n; k++, j += 4){ Y[k] = ((hp[j] * 256 + hp[j + 1]) / 65535 * span + W.hmin) * EX; Bi[k] = hp[j + 2] > 246 ? 10 : Math.round(hp[j + 2] / 20); }
    // v4c: per-pixel normal map from the full-res heights (far LOD chunks keep crisp ridges + valleys, no dough look)
    const NM = new Uint8Array(n * 4), Wc = c.W, Hc = c.H, i2r = 1 / (2 * c.R);
    for (let z = 0; z < Hc; z++) for (let x = 0; x < Wc; x++){ const k = z * Wc + x;
      const dx = (Y[z * Wc + Math.min(x + 1, Wc - 1)] - Y[z * Wc + Math.max(x - 1, 0)]) * i2r, dz = (Y[Math.min(z + 1, Hc - 1) * Wc + x] - Y[Math.max(z - 1, 0) * Wc + x]) * i2r, l = Math.hypot(dx, 1, dz);
      NM[k * 4] = (-dx / l * .5 + .5) * 255; NM[k * 4 + 1] = (1 / l * .5 + .5) * 255; NM[k * 4 + 2] = (-dz / l * .5 + .5) * 255; NM[k * 4 + 3] = 255; }
    const nT = new THREE.DataTexture(NM, Wc, Hc, THREE.RGBAFormat); nT.minFilter = THREE.LinearMipmapLinearFilter; nT.magFilter = THREE.LinearFilter; nT.generateMipmaps = true; nT.needsUpdate = true;
    EXT.conts.push({...c, x1: c.x0 + c.W * c.R, z1: c.z0 + c.H * c.R, Y, Bi, V: pixels(vBm), colT: tex(cBm, true), bioT: tex(hBm, false), nT});
  });
  const wt = tex(X.wBm, false); U.extW = {value: wt}; U.extXf = {value: new THREE.Vector3(W.world[0], W.world[1], 1 / W.world[2])};
  // merge places / roads (labels + cards + road ribbons reuse the Horaghfus systems)
  for (const p of W.places) D.places.push(p);
  for (const r of W.roads) D.roads.push(r);
  D.smoke = (D.smoke || []).concat((W.vents || []).map((v, i) => [v[0], v[1], -1, i]));   // C3: every vent can smoke; activity rotates (max 6 at once)
  return X.bld;
}
function contAt(x, z){
  const L = EXT.last; if (L && x >= L.x0 && z >= L.z0 && x < L.x1 && z < L.z1) return L;
  for (const c of EXT.conts) if (x >= c.x0 && z >= c.z0 && x < c.x1 && z < c.z1){ EXT.last = c; return c; }
  return null;
}
function extY(x, z){
  const c = contAt(x, z); if (!c) return -3;
  const fx = Math.min(Math.max((x - c.x0) / c.R - .5, 0), c.W - 1.001), fz = Math.min(Math.max((z - c.z0) / c.R - .5, 0), c.H - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * c.W + ix, Y = c.Y;
  const A = Y[i], B = Y[i + 1], C = Y[i + c.W], D_ = Y[i + c.W + 1];     // C3r: same triangle split as the chunk mesh -> roads/objects sit exactly on the surface
  return (tx + tz <= 1) ? A + (B - A) * tx + (C - A) * tz : D_ + (C - D_) * (1 - tx) + (B - D_) * (1 - tz);
}
function extYS(x, z, step){      // D1: height of the step-LOD chunk mesh at (x,z) (same vertex grid + triangle split as extChunkGeo)
  const c = contAt(x, z); if (!c) return -3;
  const fx = Math.min(Math.max((x - c.x0) / c.R - .5, 0), c.W - 1.001), fz = Math.min(Math.max((z - c.z0) / c.R - .5, 0), c.H - 1.001);
  const NC = 128, i0 = Math.floor(fx / NC) * NC, j0 = Math.floor(fz / NC) * NC, n = Math.min(NC, Math.max(c.W - 1 - i0, c.H - 1 - j0));
  const a = Math.min(Math.floor((fx - i0) / step), Math.ceil(n / step) - 1), b = Math.min(Math.floor((fz - j0) / step), Math.ceil(n / step) - 1);
  const gx0 = i0 + Math.min(a * step, n), gx1 = i0 + Math.min((a + 1) * step, n), gz0 = j0 + Math.min(b * step, n), gz1 = j0 + Math.min((b + 1) * step, n);
  const Yg = (i, j) => c.Y[Math.min(j, c.H - 1) * c.W + Math.min(i, c.W - 1)];
  const tx = Math.min(Math.max((fx - gx0) / Math.max(gx1 - gx0, 1e-6), 0), 1), tz = Math.min(Math.max((fz - gz0) / Math.max(gz1 - gz0, 1e-6), 0), 1);
  const A = Yg(gx0, gz0), B = Yg(gx1, gz0), C = Yg(gx0, gz1), D_ = Yg(gx1, gz1);
  return (tx + tz <= 1) ? A + (B - A) * tx + (C - A) * tz : D_ + (C - D_) * (1 - tx) + (B - D_) * (1 - tz);
}
const EXT_V = `varying vec3 vP; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`;
const EXT_F = `precision highp sampler2DArray;
uniform sampler2D colT, bioT, nrmT; uniform highp sampler2DArray gTex, gNrm; uniform vec4 xf; uniform vec3 sun, sunCol, skyCol, gndCol, camPos; uniform float time, nightK, fineK, snowH, lavaOn; varying vec3 vP; varying vec3 vN;
${NOISE}
${ATMO}
vec3 Lt(float i, vec2 uv){ float k = smoothstep(.38, .62, vn(uv * .13 + i * 3.1)); vec3 a = texture(gTex, vec3(uv, i)).rgb; if (k < .01) return a; vec3 b = texture(gTex, vec3(mat2(.8, -.6, .6, .8) * uv + vec2(.37, .71), i)).rgb; return mix(a, b, k); }     // D3: no visible tiling
vec3 avgL(float i){ return textureLod(gTex, vec3(.5, .5, i), 11.0).rgb + 1e-3; }
vec3 det(float i, vec2 w){ vec3 a = mix(Lt(i, w * 3.6), Lt(i, w * .71 + .37), .42); return mix(a, a * Lt(i, w * 14.0) / avgL(i), fineK * .55) / avgL(i); }
void main(){
  vec2 uv = (vP.xz - xf.xy) * xf.zw;
  vec3 alb = texture2D(colT, uv).rgb;
  // C3: biome ids are categorical -> 4 nearest texels + bilinear weights per class (no in-between ids = no white seams, lava only where baked as 252)
  ivec2 bsz = textureSize(bioT, 0); vec2 bt = uv * vec2(bsz) - .5; ivec2 b0 = ivec2(floor(bt)); vec2 bf = fract(bt);
  float wSand = 0.0, wRed = 0.0, wSnowB = 0.0, wMud = 0.0, wLava = 0.0, wAsh = 0.0;
  for (int q = 0; q < 4; q++){ ivec2 o = ivec2(q & 1, q >> 1); float w = (o.x == 1 ? bf.x : 1.0 - bf.x) * (o.y == 1 ? bf.y : 1.0 - bf.y);
    float bb = texelFetch(bioT, clamp(b0 + o, ivec2(0), bsz - 1), 0).b * 255.0; float id = floor(bb / 20.0 + .5); bool lv = bb > 246.0;
    if (lv) wLava += w; else { if ((id > 4.5 && id < 6.5) || abs(id - 11.0) < .5) wSand += w; if (abs(id - 6.0) < .5) wRed += w; if (abs(id - 3.0) < .5) wSnowB += w; if (abs(id - 7.0) < .5 || abs(id - 10.0) < .5) wMud += w; if (abs(id - 10.0) < .5) wAsh += w; } }
  float lavaK = lavaOn * smoothstep(.35, .75, wLava + (vn(vP.xz * 1.3) - .5) * .45 + (vn(vP.xz * 4.0) - .5) * .15) * step(.02, wLava);
  wAsh = max(wAsh, wLava);
  vec3 n = normalize(texture2D(nrmT, uv).xyz * 2.0 - 1.0);           // v4c: full-res per-pixel normals
  float dist = length(vP - camPos), near = 1.0 - smoothstep(20.0, 160.0, dist), dk = 1.0 - smoothstep(25.0, 95.0, dist);
  float dn = fbm(vP.xz * 1.3) * .6 + vn(vP.xz * 7.0) * .4;
  alb *= .86 + .28 * mix(.5, dn, .35 + .65 * near);
  float sl = 1.0 - n.y, hk = vP.y / 3.0;
  vec3 rockC = mix(mix(vec3(.33, .31, .29), vec3(.42, .27, .18), wRed), vec3(.16, .145, .14), wAsh * .8);
  rockC *= .78 + .4 * vn(vP.xz * .9) + .03 * sin(vP.y * 9.0 + vn(vP.xz * .4) * 4.0);      // varied tones + strata
  float wR = smoothstep(.22, .48, sl + (vn(vP.xz * 2.1) - .5) * .12) * mix(1.0, .7, wSnowB);
  alb = mix(alb, rockC, wR * .85);
  float wS = max(wSnowB, smoothstep(-.15, .15, hk - snowH - vn(vP.xz * .3) * .5)) * smoothstep(.46, .24, sl + (vn(vP.xz * 1.7) - .5) * .1) * .88;     // D2: snow slides off steep walls -> dark rock aretes
  alb = mix(alb, vec3(.60, .64, .71), wS);
  if (dk > 0.0){        // ground detail textures (same set as Horaghfus): grass / meadow / sand / rock (triplanar) / snow
    vec2 w = vP.xz;
    vec3 g = mix(det(0.0, w), det(1.0, w), smoothstep(.35, .75, fbm(w * .35)));
    vec3 d = mix(mix(g, det(3.0, w) * vec3(1.04, 1.0, .95), wSand), det(6.0, w), wMud);
    vec3 an = abs(n);
    vec3 rk = (Lt(4.0, vec2(w.x, vP.y / 3.0) * 1.4) * an.z + Lt(4.0, vec2(w.y, vP.y / 3.0) * 1.4) * an.x + Lt(4.0, w * 1.4) * an.y) / ((an.x + an.y + an.z) * avgL(4.0));
    d = mix(d, rk, wR); d = mix(d, Lt(5.0, w * 1.1) / avgL(5.0), wS);
    alb = mix(alb, alb * clamp(d, 0.0, 2.2), dk);
    vec2 nG = texture(gNrm, vec3(w * 3.6, 0.0)).xy * 2.0 - 1.0, nR = texture(gNrm, vec3(w * 1.4, 1.0)).xy * 2.0 - 1.0;
    vec2 nd2 = mix(nG * .5, nR * 1.0, wR) * (1.0 - wS * .7) * dk; n = normalize(n + vec3(nd2.x, 0.0, -nd2.y));
  }
  { float rp = sin(dot(vP.xz, vec2(.8, .6)) * 38.0 + vn(vP.xz * 2.0) * 7.0) * .5 + .5;     // D3: sand ripples + patchy tone (Güney/Unknown deserts were flat colour up close)
    alb *= 1.0 + wSand * (1.0 - wR) * (dk * (rp - .5) * .14 + (vn(vP.xz * .55) - .5) * .16 + (vn(vP.xz * 4.5) - .5) * .08 * dk); }
  float dif = max(dot(n, sun), 0.0);
  vec3 amb = mix(gndCol, skyCol, n.y * .5 + .5) * (.75 + .25 * n.y);
  vec3 col = alb * (sunCol * dif * mix(.62, .9, wS) + amb * mix(.62, .4, wS)) + alb * nightLit(vP, n);     // C3l: snow keeps relief contrast
  if (lavaK > .01){       // v4c: lava = glowing cracks in dark crust, pooled in the vent hollows (smooth mask, no biome blocks)
    vec2 q = vP.xz * 1.6 + vec2(fbm(vP.xz * .5), fbm(vP.xz * .5 + 3.3)) * 2.0;
    float cr = (1.0 - smoothstep(.0, .035, abs(vn(q) - .5))) * smoothstep(.35, .6, vn(vP.xz * .8)), pool = smoothstep(.68, .84, fbm(vP.xz * .7 + vec2(time * .01, 0.0)));
    float cr2 = (1.0 - smoothstep(.0, .06, abs(vn(q * 4.3 + 7.1) - .5))) * smoothstep(.4, .65, vn(vP.xz * 2.3)) * dk;     // C3o: fine crack network up close
    float l = max(max(cr * .85, cr2 * .55), pool) * lavaK * (.75 + .25 * sin(time * 1.7 + vP.x * 3.0));
    vec3 crust = mix(vec3(.05, .045, .045), vec3(.17, .15, .14), smoothstep(.3, .8, fbm(vP.xz * 2.2))) * (sunCol * dif * .7 + amb * .6);
    col = mix(col, crust, lavaK * .9) + vec3(1.0, .33, .04) * l * (.7 + 2.0 * nightK) + vec3(.8, .18, .02) * lavaK * pool * .05 * (1.0 + 2.0 * nightK); }
  col = atmo(col, vP, camPos);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
function extChunkGeo(c, i0, j0, n, step){
  const m = Math.ceil(n / step) + 1, nv = m * m, pos = new Float32Array((nv + 4 * m) * 3), nrm = new Float32Array((nv + 4 * m) * 3);
  const gi = (i) => Math.min(i, c.W - 1), gj = (j) => Math.min(j, c.H - 1), Yg = (i, j) => c.Y[gj(Math.max(j, 0)) * c.W + gi(Math.max(i, 0))];
  let k = 0;
  const vx = (i, j, drop) => { const x = c.x0 + (gi(i) + .5) * c.R, z = c.z0 + (gj(j) + .5) * c.R, y = Yg(i, j) - drop;
    const dx = (Yg(i + step, j) - Yg(i - step, j)) / (2 * step * c.R), dz = (Yg(i, j + step) - Yg(i, j - step)) / (2 * step * c.R), l = Math.hypot(dx, 1, dz);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; nrm[k * 3] = -dx / l; nrm[k * 3 + 1] = 1 / l; nrm[k * 3 + 2] = -dz / l; k++; };
  for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) vx(i0 + Math.min(a * step, n), j0 + Math.min(b * step, n), 0);
  const idx = [];
  for (let b = 0; b < m - 1; b++) for (let a = 0; a < m - 1; a++){ const p = b * m + a; idx.push(p, p + m, p + 1, p + 1, p + m, p + m + 1); }
  // skirts (hide LOD cracks)
  const edges = [[0, 1, 0, 0], [0, 1, m - 1, 0], [0, 0, 0, 1], [m - 1, 0, 0, 1]];
  for (const [ax, sx, by, sy] of edges){
    const s0 = k;
    for (let t = 0; t < m; t++){ const a = sx ? t : ax, b = sy ? t : by; vx(i0 + Math.min(a * step, n), j0 + Math.min(b * step, n), 1.2); }
    for (let t = 0; t < m - 1; t++){ const a0 = sx ? t : ax, b0 = sy ? t : by, a1 = sx ? t + 1 : ax, b1 = sy ? t + 1 : by;
      const p0 = b0 * m + a0, p1 = b1 * m + a1, q0 = s0 + t, q1 = s0 + t + 1; idx.push(p0, q0, p1, p1, q0, q1, p0, p1, q0, p1, q1, q0); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(nv + 4 * m > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingSphere(); return g;
}
function buildExtTerrain(){
  const NC = 128;
  for (const c of EXT.conts){
    const mat = new THREE.ShaderMaterial({vertexShader: EXT_V, fragmentShader: EXT_F, uniforms: {snowH: {value: c.k === 'guney' ? 99 : c.k === 'unk' ? 3.7 : 2.3}, lavaOn: {value: 1}, colT: {value: c.colT}, bioT: {value: c.bioT}, nrmT: {value: c.nT}, gTex: U.gTex, gNrm: U.gNrm, fineK: U.fineK, xf: {value: new THREE.Vector4(c.x0, c.z0, 1 / (c.W * c.R), 1 / (c.H * c.R))},
      sun: U.sun, sunCol: U.sunCol, skyCol: U.skyCol, gndCol: U.gndCol, camPos: U.camPos, time: U.time, nightK: U.nightK, fogCol: U.fogCol, fogK: U.fogK, hazeK: U.hazeK, plP: U.plP, plN: U.plN}});
    for (let j0 = 0; j0 < c.H - 1; j0 += NC) for (let i0 = 0; i0 < c.W - 1; i0 += NC){
      const n = Math.min(NC, Math.max(c.W - 1 - i0, c.H - 1 - j0)); let mx = -99;     // v4b: square chunk may overhang the grid edge (vertices clamp) -> no holes at the ragged edge
      for (let j = j0; j <= Math.min(j0 + n, c.H - 1); j += 2) for (let i = i0; i <= Math.min(i0 + n, c.W - 1); i += 2) mx = Math.max(mx, c.Y[j * c.W + i]);
      if (mx < -1.2) continue;
      const lo = new THREE.Mesh(extChunkGeo(c, i0, j0, n, 8), mat); scene.add(lo);
      EXT.chunks.push({c, i0, j0, n, mat, lo, hi: null, mid: null, cx: c.x0 + (i0 + n / 2) * c.R, cz: c.z0 + (j0 + n / 2) * c.R, half: n * c.R / 2});
    }
  }
  // v4c: Ulug'al Tamga lava vents - flickering fire glow (day + night), smoke comes from the shared smoke system
  const VN = (EXT.W.vents || []); if (VN.length){
    const pos = new Float32Array(VN.length * 3 * 3), sd = new Float32Array(VN.length * 3), vi = new Float32Array(VN.length * 3);
    VN.forEach(([x, z], i) => { for (let k = 0; k < 3; k++){ const j = i * 3 + k; pos.set([x + (hash(j) - .5) * .6, extY(x, z) + .15 + k * .25, z + (hash(j + 7) - .5) * .6], j * 3); sd[j] = hash(j * 3 + 1); vi[j] = i; } });
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('sd', new THREE.BufferAttribute(sd, 1)); gg.setAttribute('vi', new THREE.BufferAttribute(vi, 1));
    const fm = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {nightK: U.nightK, time: U.time, pxK: U.pxK, vAct: U.vAct},
      vertexShader: `attribute float sd, vi; uniform float nightK, time, pxK; uniform float vAct[24]; varying float vA; void main(){ vec3 p = position; p.y += fract(time * .35 + sd) * .5; vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (.55 + .45 * nightK) * (.6 + .4 * sin(time * 9.0 + sd * 50.0)) * (1.0 - fract(time * .35 + sd)) * vAct[int(vi + .5)]; gl_PointSize = clamp(1.1 * pxK / -mv.z, 2.0, 80.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - .5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(mix(vec3(1.0, .25, .02), vec3(1.0, .75, .3), 1.0 - r) * pow(1.0 - r, 1.6) * vA, 1.0); }`});
    const P = new THREE.Points(gg, fm); P.frustumCulled = false; P.renderOrder = 12; scene.add(P);
  }
  // airships around Mital Alari
  const shipM = new THREE.MeshLambertMaterial({map: MAT.flat});
  for (const a of EXT.W.airships){
    const g = new THREE.Group(); for (const part of modelGeo('airship', hash(a.r * 10 | 0) < .5 ? 'a' : 'g')){ const m = new THREE.Mesh(part.g, shipM); m.castShadow = true; g.add(m); }
    g.scale.setScalar(a.s); scene.add(g); EXT.ships.push({g, a});
  }
}
function updateExt(dt){
  { const N = (EXT.W && EXT.W.vents || []).length, a = U.vAct.value; a.fill(0); a[23] = 1;      // C3: 6 rotating eruption slots
    if (N) for (let s = 0; s < 6; s++){ const P = 26, t = clock + s * P / 6, e = Math.floor(t / P), f = t / P - e, v = Math.floor(hash(s * 977 + e * 131) * N) % N;
      a[v] = Math.max(a[v], Math.min(1, f / .12) * Math.min(1, (1 - f) / .2)); } }
  const cp = camera.position; let budget = 2;     // v4 hotfix: at most 2 chunk geometries built per frame (no hitches)
  for (const k of EXT.chunks){
    const d = Math.hypot(Math.max(Math.abs(cp.x - k.cx) - k.half, 0), Math.max(Math.abs(cp.z - k.cz) - k.half, 0), cp.y);
    const want = d < 90 ? 2 : d < 300 ? 1 : 0;
    if (want === 2 && !k.hi && budget-- > 0){ k.hi = new THREE.Mesh(extChunkGeo(k.c, k.i0, k.j0, k.n, 1), k.mat); k.hi.visible = false; scene.add(k.hi); }
    if (want >= 1 && !k.mid && budget-- > 0){ k.mid = new THREE.Mesh(extChunkGeo(k.c, k.i0, k.j0, k.n, 3), k.mat); k.mid.visible = false; scene.add(k.mid); }
    const w2 = want === 2 && k.hi ? 2 : want >= 1 && k.mid ? 1 : 0; k.lo.visible = w2 === 0; if (k.mid) k.mid.visible = w2 === 1; if (k.hi) k.hi.visible = w2 === 2;
    // v4 hotfix: free detailed geometry of chunks that have been far for a while (streaming, GPU memory cap)
    if (want < 2 && k.hi){ k.hiT = (k.hiT || 0) + dt; if (k.hiT > 12){ scene.remove(k.hi); k.hi.geometry.dispose(); k.hi = null; k.hiT = 0; } } else k.hiT = 0;
    if (want < 1 && k.mid){ k.midT = (k.midT || 0) + dt; if (k.midT > 20){ scene.remove(k.mid); k.mid.geometry.dispose(); k.mid = null; k.midT = 0; } } else k.midT = 0;
  }
  const route = (a, tt) => { const dir = a.ph % 2.6 < 1.3 ? 1 : -1, th = dir * tt + .55 * Math.sin(tt * .37 + a.ph * 2.1) + .25 * Math.sin(tt * .91 + a.ph),
      r = a.r * (1 + .32 * Math.sin(tt * .53 + a.ph * 1.7) + .12 * Math.sin(tt * 1.31 + a.ph * .3)); return [a.cx + Math.cos(th) * r * 1.15, a.cz + Math.sin(th) * r * .9]; };   // E6
  for (const s of EXT.ships){ const a = s.a, t = clock * a.sp + a.ph, [x, z] = route(a, t), [x2, z2] = route(a, t + .02), vx = x2 - x, vz = z2 - z;
    const yaw = Math.atan2(-vz, vx), dy = yaw - (s.yaw == null ? yaw : s.yaw); s.yaw = yaw; s.bank = (s.bank || 0) * .9 + Math.max(-.25, Math.min(.25, Math.atan2(Math.sin(dy), Math.cos(dy)) * 8)) * .1;
    s.g.position.set(x, extY(a.cx, a.cz) + a.y * EX * .5 + Math.sin(clock * .7 + a.ph) * .05 + .15 * Math.sin(t * .8 + a.ph), z); s.g.rotation.set(s.bank, yaw, 0, 'YXZ'); }
}

// ------------------------------------------------------------ v4 B: day / night cycle (2 min day + 2 min night), regional atmosphere, night city lights
const DAYLEN = 240, SUN0 = SUN.clone();
const DNC = {p: .08, moon: new THREE.Vector3(), lastPick: 0, lights: [], glow: null, spark: null};
const REGIONS = [   // x, z, radius, fog tint, fog density mult, sun tint
  {x: 512, z: 384, r: 650, fog: [1, 1, 1], k: 1, sun: [1, 1, 1]},
  {x: 1640, z: 330, r: 330, fog: [1.04, 1.02, .92], k: .85, sun: [1.04, 1.0, .9]},          // Elf kıtası: clear, golden
  {x: 1180, z: 60, r: 220, fog: [.92, 1.0, 1.12], k: 1.25, sun: [.9, .97, 1.1]},            // Buz Adaları: cold
  {x: 645, z: 1171, r: 190, fog: [.94, .98, 1.02], k: 1.35, sun: [.95, .97, 1.0]},          // Ivar: grey sea mist
  {x: 745, z: 1870, r: 380, fog: [1.25, .98, .78], k: 1.3, sun: [1.08, .93, .78]},          // Güney: red dust haze
  {x: 1868, z: 1620, r: 360, fog: [.96, 1.02, .98], k: 1.9, sun: [.96, 1.0, .96]},          // Bilinmeyen: light fog
];
const C3 = (a) => new THREE.Color(a[0], a[1], a[2]);
const KEYS = [   // sun elevation (deg) -> sunCol, skyCol, gndCol, fogCol, zenith
  [-90, [0, 0, 0], [.035, .05, .1], [.02, .025, .04], [.045, .06, .11], [.006, .012, .035]],
  [-8, [0, 0, 0], [.05, .065, .13], [.025, .03, .045], [.07, .08, .14], [.01, .02, .06]],
  [-2, [.25, .1, .06], [.2, .17, .25], [.08, .06, .06], [.4, .3, .32], [.05, .07, .18]],
  [3, [1.0, .42, .16], [.42, .36, .45], [.2, .15, .12], [.86, .55, .4], [.1, .17, .38]],
  [10, [1.5, .9, .55], [.44, .48, .62], [.27, .23, .19], [.74, .66, .62], [.11, .24, .5]],
  [25, [2.0, 1.85, 1.6], [.42, .55, .75], [.3, .27, .22], [.6, .7, .83], [.11, .27, .55]],
  [90, [2.1, 1.95, 1.72], [.42, .55, .75], [.3, .27, .22], [.58, .7, .84], [.11, .27, .55]]];
const _c = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
function keyAt(h){
  let i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))), s = t * t * (3 - 2 * t);
  for (let k = 0; k < 5; k++) _c[k].setRGB(a[k + 1][0] + (b[k + 1][0] - a[k + 1][0]) * s, a[k + 1][1] + (b[k + 1][1] - a[k + 1][1]) * s, a[k + 1][2] + (b[k + 1][2] - a[k + 1][2]) * s);
  return _c;
}
function regionMix(x, z){
  const f = [0, 0, 0], s = [0, 0, 0]; let k = 0, w = 0;
  for (const R of REGIONS){ const d = Math.hypot(x - R.x, z - R.z); const ww = Math.exp(-((d / R.r) ** 2) * 2) + 1e-4; w += ww; k += R.k * ww; for (let i = 0; i < 3; i++){ f[i] += R.fog[i] * ww; s[i] += R.sun[i] * ww; } }
  return {f: f.map((v) => v / w), s: s.map((v) => v / w), k: k / w};
}
function updateDayNight(dt){
  DNC.p = (DNC.p + dt / DAYLEN) % 1;
  const p = DNC.p, day = p < .5, q = day ? p / .5 : (p - .5) / .5;
  const e = day ? Math.sin(q * Math.PI) * 1.05 : -Math.sin(q * Math.PI) * .7;        // sun elevation (rad)
  const A = day ? q * Math.PI : Math.PI + q * Math.PI;                                  // east (+x) -> west (-x)
  const h = e * 180 / Math.PI;
  const sx = Math.cos(A) * Math.cos(e), sz = .42 * Math.sin(A) * Math.cos(e) + .12, sy = Math.sin(e);
  const sunD = new THREE.Vector3(sx, sy, sz).normalize();
  const nightK = Math.min(1, Math.max(0, (2 - h) / 9)); U.nightK.value = nightK;
  const C = keyAt(h), rg = regionMix(cam.x, cam.z);
  // moonlight at night (cool, from the opposite arc)
  DNC.moon.set(-sx, Math.max(.35, -sy * 1.2), -sz + .2).normalize();
  if (h < -3){ SUN.copy(DNC.moon); U.sunCol.value.setRGB(.075, .095, .16); } else { SUN.copy(sunD); U.sunCol.value.copy(C[0]); }
  if (h >= -3 && h < 0){ const t = (h + 3) / 3; U.sunCol.value.lerp(new THREE.Color(.075, .095, .16), 1 - t); }
  U.sunCol.value.r *= rg.s[0]; U.sunCol.value.g *= rg.s[1]; U.sunCol.value.b *= rg.s[2];
  U.skyCol.value.copy(C[1]); U.gndCol.value.copy(C[2]);
  U.fogCol.value.copy(C[3]); U.fogCol.value.r *= rg.f[0]; U.fogCol.value.g *= rg.f[1]; U.fogCol.value.b *= rg.f[2];
  U.skyZen.value.copy(C[4]);
  U.bakeK.value = Math.min(1, Math.max(0, (SUN.dot(SUN0) - .55) / .35)) * (1 - nightK * .6);
  DNC.fogMul = rg.k;
  scene.background.copy(U.fogCol.value); scene.fog.color.copy(U.fogCol.value);
  sunLight.color.copy(U.sunCol.value).multiplyScalar(1 / 2.1); sunLight.intensity = 2.4 * Math.max(.05, Math.min(1, U.sunCol.value.r / 1.6));
  hemi.color.copy(U.skyCol.value).multiplyScalar(2.2); hemi.groundColor.copy(U.gndCol.value).multiplyScalar(2.0); hemi.intensity = 1.25 * (1 - .6 * nightK);
  updateNightLights(dt, nightK);
}
// ---- night lights: window glow (shader, in lodPatch), far city glow (points), real point lights near the camera
function buildNightLights(){
  // aggregate buildings into 1.2 km cells -> glow blobs (cities seen from far), + one sparkle per house
  const cell = new Map(), sp = [];
  for (const b of BLD.list || []){
    if (/^(rk_|st_|cactus|ruin|pier|flag|wall|tree|fisle|campfire|pyramid|temple|arch)/.test(b.m)) continue;
    const hb = hash(Math.round(b.x * 977 + b.z * 131)), ox = hash(Math.floor(b.z / 3.1) * 7 + 3) * 1.2, oz = hash(Math.floor(b.x / 3.1) * 11 + 5) * 1.2;   // E3: cell grid shifted per 3 km band -> no straight rows
    const k = Math.floor((b.x + ox) / 1.2) + ',' + Math.floor((b.z + oz) / 1.2); const c = cell.get(k) || [0, 0, 0, 0, -1]; c[3]++; if (hb > c[4]){ c[4] = hb; c[0] = b.x; c[1] = b.z; c[2] = b.top || b.y; } cell.set(k, c);
    const jx = (hash(Math.round(b.x * 311 + b.z * 719)) - .5) * .07, jz = (hash(Math.round(b.x * 523 + b.z * 197)) - .5) * .07;
    if (hb > .12) sp.push(b.x + jx, (b.top || b.y) * .5 + b.y * .5 + .03, b.z + jz, hb);
  }
  if (EXT.W) for (const [x, z, s] of EXT.W.lights) if (s <= 2){ sp.push(x, yAt(x, z) + .05, z, .99); }   // camps
  const CC = (D.places || []).filter((p) => p.kind === 'capital' || p.kind === 'city').map((p) => [p.x, p.z, p.kind === 'capital' ? 20 : 9]);   // E3: denser toward city centres
  const gp = []; for (const c of cell.values()) if (c[3] >= 2){ let f = 1; for (const q of CC){ const r = Math.hypot(c[0] - q[0], c[1] - q[1]) / q[2]; if (r < 1.6) f = Math.min(f, Math.max(0, (r - .25) / 1.1)); } if (f > 0 && hash(Math.round(c[0] * 419 + c[1] * 283)) < f * .6) continue; const r1 = hash(Math.round(c[0] * 131 + c[1] * 977)), r2 = hash(Math.round(c[0] * 733 + c[1] * 59)); gp.push(c[0] + (r1 - .5) * .35, c[2] + .25, c[1] + (r2 - .5) * .35, c[3] * (.6 + .8 * r1) * (1.6 - .9 * f)); }
  const mk = (arr, glow) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr.filter((_, i) => i % 4 < 3), 3)); g.setAttribute('w', new THREE.Float32BufferAttribute(arr.filter((_, i) => i % 4 === 3), 1));
    const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {nightK: U.nightK, time: U.time, pxK: U.pxK, camPos: U.camPos, fogK: U.fogK},
      vertexShader: `attribute float w; uniform float nightK, time, pxK, fogK; uniform vec3 camPos; varying float vA; varying float vG;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
          ${glow ? `float el = clamp((camPos.y - position.y) / max(distance(camPos, position), .01), 0.0, 1.0), lowA = smoothstep(.04, .45, el);   // C3: grazing views -> smaller, fainter blobs (no merged 'sun')
            float sz = (1.0 + sqrt(w) * .5) * mix(.45, 1.0, lowA); vA = nightK * min(1.0, .45 + sqrt(w) * .1) * smoothstep(8.0, 40.0, d) * max(exp(-d * fogK * .3), .25) * mix(.22, 1.0, lowA);
            gl_PointSize = clamp(sz * pxK / d, 2.0, mix(14.0, 48.0, lowA));`
          : `float on = step(.3, fract(w * 13.7 + floor(time / 23.0 + w * 9.0) * .618)); vA = nightK * on * smoothstep(1.5, 4.0, d) * (1.0 - smoothstep(60.0, 160.0, d)) * (.75 + .25 * sin(time * 2.0 + w * 40.0));
            gl_PointSize = clamp(.06 * pxK / d, 1.3, 6.0);`}
          vG = ${glow ? '1.0' : '0.0'}; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying float vG; void main(){ vec2 c = gl_PointCoord - .5; float r = length(c) * 2.0; if (r > 1.0) discard;
          float a = vG > .5 ? pow(1.0 - r, 2.2) : smoothstep(1.0, .2, r); vec3 col = mix(vec3(1.0, .62, .28), vec3(1.0, .85, .6), vG > .5 ? (1.0 - r) : .5);
          gl_FragColor = vec4(col * a * vA * (vG > .5 ? .8 : 1.4), 1.0); }`, depthTest: true});
    const P = new THREE.Points(g, m); P.frustumCulled = false; P.renderOrder = 12; scene.add(P); return P;
  };
  DNC.glow = mk(gp, true); DNC.spark = mk(sp, false);
  for (let i = 0; i < 50; i++) DNC.lights.push({position: new THREE.Vector3(0, -99, 0), intensity: 0, userData: {}});   // v4 hotfix: uniform-only lights (fixed count, no lit-material cost, no recompiles)
  DNC.src = BLD.list ? BLD.list.filter((b) => /^(ph_|home_|elf_house|elf_hall|tavern|market|church|lighthouse|watch_big|tower_|castle|blacksmith|barracks)/.test(b.m)) : [];
}
function updateNightLights(dt, nk){
  if (!DNC.glow) return;
  DNC.glow.visible = DNC.spark.visible = nk > .01;
  const t = performance.now();
  if (t - DNC.lastPick > 600){
    DNC.lastPick = t;
    const cx = cam.x, cz = cam.z, near = [];
    const px = camera.position.x, pz = camera.position.z;   // C3: up to 50 real lights within 40 km of the camera (uniform array, fixed shader)
    if (nk > .05 && cam.d < 90){
      for (const b of DNC.src){ const d = Math.hypot(b.x - px, b.z - pz); if (d < 40) near.push([d, b]); }
      near.sort((a, b) => a[0] - b[0]);
    }
    const pick = [];
    for (const [, b] of near){ if (pick.length >= 50) break; if (pick.every((q) => Math.hypot(q.x - b.x, q.z - b.z) > .5) && hash(Math.round(b.x * 977 + b.z * 131) + Math.floor(clock / 23)) > .25) pick.push(b); }
    DNC.lights.forEach((L, i) => { const b = pick[i]; if (b){ L.position.set(b.x + .05, (b.top || b.y + .1) * .6 + b.y * .4, b.z + .05); L.userData.on = 1; } else L.userData.on = 0; });
  }
  let k = 0, nOn = 0;
  DNC.lights.forEach((L, i) => { const tgt = L.userData.on ? nk * (.9 + .1 * Math.sin(clock * 7 + i)) * .045 : 0; L.intensity += (tgt - L.intensity) * Math.min(1, dt * 4);
    U.plP.value[i].set(L.position.x, L.position.y, L.position.z, L.intensity / .045 * nk); if (L.intensity > .0005) nOn = i + 1; });
  U.plN.value = nOn;
}
// ---- high cirrus layer (streaky, thin; seen from below and from above when zoomed far out)
function buildCirrus(){
  const g = new THREE.PlaneGeometry(5600, 5600, 1, 1); g.rotateX(-Math.PI / 2); g.translate(1080, 80, 1060);
  const m = new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: {time: U.time, sunCol: U.sunCol, skyCol: U.skyCol, fogCol: U.fogCol, camPos: U.camPos, nightK: U.nightK},
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time, nightK; uniform vec3 sunCol, skyCol, fogCol, camPos; varying vec3 vP;
      ${NOISE}
      void main(){
        vec2 p = vP.xz * .0035 + vec2(time * .0009, time * .0003);
        vec2 q = vec2(p.x + p.y * .35, p.y * 3.4);
        float n = fbm(q * 3.0 + fbm(p * 2.0) * 1.6), big = fbm(p * .7 + 5.0);
        float a = smoothstep(.5, .78, n) * smoothstep(.35, .6, big) * .5;
        float d = length(vP - camPos);
        a *= smoothstep(30.0, 140.0, abs(camPos.y - 80.0) + d * .2) * exp(-d * .00035) * (1.0 - smoothstep(400.0, 1600.0, camPos.y) * .75);
        vec3 col = mix(sunCol * .42 + skyCol * .55, fogCol, .25);
        gl_FragColor = vec4(col, a * (1.0 - nightK * .5));
        #include <colorspace_fragment>
      }`});
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 9; mesh.frustumCulled = false; scene.add(mesh);
}

// ------------------------------------------------------------ Step 3: Dünya küresi (tembel yüklenir; düz harita ile küre aynı anda GPU'da tutulmaz)
const GLB = {mod: null, g: null, on: false, busy: false, wind: null, pull: 0};
const gwait = (ms) => new Promise((r) => setTimeout(r, ms));
function windEl(){
  if (!GLB.wind){ const w = document.createElement('div'); w.className = 'm3d-wind'; w.innerHTML = '<i></i><i></i><i></i><i></i><b></b>'; root.appendChild(w); GLB.wind = w; }
  return GLB.wind;
}
function windIn(){ const w = windEl(); w.classList.remove('out'); void w.offsetWidth; w.classList.add('in'); }
function windOut(){ const w = windEl(); w.classList.remove('in'); w.classList.add('out'); }
function releaseFlat(){       // küre görünürken düz haritanın ağır ayrıntısını bırak (geri dönünce gerektikçe yeniden kurulur)
  if (EXT.chunks) for (const k of EXT.chunks){
    if (k.hi){ scene.remove(k.hi); k.hi.geometry.dispose(); k.hi = null; }
    if (k.mid){ scene.remove(k.mid); k.mid.geometry.dispose(); k.mid = null; } }
  labels.forEach((l) => l.el.classList.remove('on'));
  renderer.renderLists.dispose();
}
async function enterGlobe(){
  if (GLB.on || GLB.busy || !built || CTX_LOST) return; GLB.busy = true; GLB.pull = 0; closeCard();
  goal.d = DZOOM; flying = 1; windIn(); await gwait(700);
  try {
    if (!GLB.mod) GLB.mod = await import('./map3d_globe.js?v=' + V);
    if (!GLB.g) GLB.g = await GLB.mod.createGlobe({renderer, cv, labelsEl, url, onDive: (t) => exitGlobe(t)});
    releaseFlat(); GLB.g.resize(root.clientWidth, root.clientHeight); GLB.g.show(true);
    GLB.g.orb.d = 900; GLB.g.orb.gd = 430;        // bulutların arasından geri çekilir gibi açılış
    GLB.on = true; root.classList.add('m3d-glb');
  } catch (e){ console.warn('globe failed', e); if (GLB.g){ GLB.g.dispose(); GLB.g = null; } }
  await gwait(120); windOut(); GLB.busy = false;
}
async function exitGlobe(t){
  if (!GLB.on || GLB.busy) return; GLB.busy = true; windIn(); await gwait(700);
  GLB.on = false; root.classList.remove('m3d-glb');
  if (GLB.g){ GLB.g.show(false); GLB.g.dispose(); GLB.g = null; }     // tersi: düz haritadayken kürenin GPU belleği serbest
  t = t || {x: 512, z: 400, d: 1000};
  Object.assign(cam, {x: t.x, z: t.z, d: DZOOM * .9, yaw: 0, tilt: 0}); Object.assign(goal, {x: t.x, z: t.z, d: t.d, yaw: 0, tilt: 0}); flying = 1;
  refreshNearTrees(true); await gwait(350); windOut(); GLB.busy = false;
}
