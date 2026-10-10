# Harita verileri (assets/map)

- `config.json` — ölçek (`kmPerPixel`, tam çözünürlük 5112x4920 px'e göre), `walkKmPerDay`, `horseKmPerDay`, sis/bulut ayarları. `scaleIsEstimate: true` iken rota kutusunda "ölçek tahmini" yazar.
- `places.json` — tıklanabilir yer adları (şimdilik boş). Şema:
  `{ "id": "balahnur", "name": "Balahnur", "x": 2310, "y": 1480, "type": "city|town|castle|ruin|region|sea|landmark", "tag": "Balahnur", "description": "kısa açıklama" }`
  `x,y` tam çözünürlüklü harita pikseli. `tag` verilirse tıklayınca sitenin tag kartı açılır. İsteğe bağlı: `"minZoom": 0.3` (bu yakınlığın altında gizle), `"size": 1`.
- `roads.json` — yollar (şimdilik boş). Şema:
  `{ "id": "kral-yolu", "name": "Kral Yolu", "type": "road|path|sea", "points": [[x,y],[x,y],...] }`
- `tiles/{z}/{x}_{y}.webp` — 512 px karo piramidi (z=0 en küçük 639 px … z=3 tam çözünürlük). `tiles.json` düzeyleri listeler. `base.webp` hızlı ilk görüntü.
- `fogfield.png` — kıyıya uzaklık alanı (1/4 çözünürlük; 0 = kara, 255 = kıyıdan ≥512 px). Sis yoğunluğu buradan hesaplanır. `landmask.png` önizleme maskesi.
- Kaynak üretim betikleri: /workspace/mapsrc/mask.py, tiles.py

## roads_auto.json (v2)
Hand-traced from visible painted roads/paths (automatic colour detection was too noisy against beige mountains/snow).
Same schema as roads.json. Not drawn — used only as routes for the tiny animated caravans.
As soon as roads.json has entries with 2+ points, caravans use roads.json instead.

## whirlpool.webp (v2)
Circular, de-squashed crop of the painted whirlpool (centre ~4503,1380 full-res px); rotated in place by map.js.
