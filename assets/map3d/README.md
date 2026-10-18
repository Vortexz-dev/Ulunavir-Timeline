# Horaghfus 3D haritası (t141, v1 — deneme)

Kaynak: Phoenix'in Inkarnate katmanları (8192x6144). Bake: `frp-timeline/site-build/map3d/build_map3d.py`, yer listesi `places3d_src.json`, sürüm damgası `stamp_map3d.py`.

- Ölçek: 0.125 km/px (kıta ≈ 289.000 km², Balahnur → Blavinken ≈ 255 km kuş uçuşu / ≈ 300 km yol). Dünya: 1 birim = 1 km, 1024 x 768 km.
- `height.png`: 2048x1536, RG = 16 bit yükseklik (hmin..hmax km, meta.json). Dağ objelerinden + gürültüden türetildi.
- `fac.png` (R insan, G cüce, B elf) + `aux.png` (R Halldor, G kara, B kıyıya uzaklık): sınırlar ve deniz.
- `c_X_Y.webp` 4x3 renk karosu (2048), `color_lo.webp` genel görünüm.
- `trees.bin`: ağaç örnekleri (uint16 x, uint16 z, uint8 tür, uint8 ölçek*100).
- `places3d.json`: yerler, factionlar, yollar / ticaret rotaları / deniz yolları.
- Modeller kod içinde prosedürel (three.js). three.js r169 MIT (assets/vendor/three/LICENSE).
