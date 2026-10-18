# Horaghfus 3D haritası (t141, v3 — beta)

Kaynak: Phoenix'in Inkarnate katmanları (8192x6144). Ölçek 0.125 km/px; dünya birimi 1 = 1 km (1024 x 768 km). Kodun tamamı `assets/map3d.js` (three.js r169, `assets/vendor/three/`).

## Yer adlarını / açıklamaları düzenlemek — `yerler.json`

Tek düzenlenebilir veri dosyası budur. Anahtar = yer kimliği (ör. `balahnur`, `askar-universitesi`, `karasirt-kuleleri`, `deathwing-in-ini`); kimliği değiştirme. Her yerde şu alanlar olabilir:

- `name` — haritada görünen ad
- `note` — kartın kısa açıklaması
- `desc` — kart paragrafları (metin listesi)
- `sub` — alt başlık (ör. "Balahnur'un bölgesi")
- `tag` — tıklanınca açılacak etiket kartının adı

Bir alanı silersen varsayılana döner. Dosya sayfa açılırken okunur, yeniden bake gerekmez; yeniden bake yapılırsa mevcut düzenlemeler korunur.

## Yeniden üretmek (frp-timeline/site-build/map3d/v2/)

1. `edits.json` — elle ayarlar: yanardağ (Deathwing'in İni) merkezi/yarıçapı, Balahnur elipsi, Valdoran çizgisi ve genişliği, `strombah_mtn` (Strömbah dağı: merkez, yarıçap, yükseklik), güneş yönü.
2. `python3 terrain.py` — yükseklik (≈100 sn): kara maskesi (kıyı dalga çizgileri temizlenir), tepeler/vadiler, değişken dağlar, akarsu oyma, dere yatakları, yanardağ. Ara sonuçlar `/workspace/map3d_work/v2cache/`.
3. `python3 content.py` — yerler (uygun karaya oturtma), eğime göre yol bulma (toprak yollar), şehirler/köyler/surlar/kuleler, ormanlar ve türleri, maskeler, tüm dosyalar (≈4 dk).
4. `python3 pack_models.py` — glTF modellerini `models.bin` + `models.json` olarak paketler (yalnız modeller değişince).
5. `python3 ../../stamp_map3d.py` — sürüm damgası (önbellek kırma).

## Dosyalar

- `height.png` 2048x1536 RG16 yükseklik (hmin..hmax km, abartı `meta.json` → ex)
- `normal.webp` 4096 normal haritası; `mask.webp` R toprak yol, G dere yatağı, B tarla, A şehir zemini
- `aux.png` R Halldor, G kara, B kıyıya uzaklık, A pişmiş güneş gölgesi; `fac.png` R insan / G cüce / B elf sınırları
- `c_X_Y.webp` 4x3 renk karosu, `color_lo.webp` genel görünüm
- `trees.bin` 8 bayt/ağaç: u16 x, u16 z, u8 tür, u8 boy*100, u8 renk, u8 dönüş
- `buildings.bin` 16 bayt/örnek: u8 model, u8 varyant, u8 palet, u8 bayrak (1 duman, 4 anıt), f32 x, f32 z, f16 dönüş, f16 ölçek
- `places3d.json` yerler, factionlar, yollar/ticaret/deniz yolları + patikalar (`track`), köprüler, gemiler, tarlalar (`fields`: x, z, en, boy, açı, ürün), çiftlikler, buzdağları (`bergs`), bataklık, Balahnur, yanardağ, Valdoran
- `aux.png` B kanalı: kıyıya uzaklık karekök kodlu (km = B² x 40); `fac.png` A kanalı: 255 − bataklık gölcükleri
- `models.bin/json` paketlenmiş modeller, `tex/` zemin ve ağaç dokuları

Model ve doku kaynakları / lisanslar: `CREDITS.md`.

## v4 ekleri
- `wat.png`: su türleri (R = tür·64 + kıyı mesafesi; tür 0 deniz / 1 göl / 2 nehir / 3 bataklık), G/B = akış yönü. Nehirler akar, göller durgun, bataklık bulanık.
- `veg.png`: dağınık ağaç yoğunluğu (R), bitki sınıfı (G), orman (B). Dağınık ağaçlar tarayıcıda bu haritadan üretilir.
- Luminaraeth: prosedürel uçan adalar, şelaleler ve ışın izlemeli (raymarch) bulut tabakası (`map3d.js` → `buildSpecial`).

## v4 B: diğer kıtalar (`ext/`)
- `world.json`: kıtalar (sınır kutuları), yerler, yollar, hava gemileri, gece ışık noktaları, uzak zoom kıta adları.
- `<kıta>_h.png` (yükseklik R/G 16 bit, B = biyom·20), `<kıta>_c.webp` (renk), `<kıta>_v.png` (bitki yoğunluğu/sınıfı), `extw.png` (dünya su haritası, 1 km), `ext_bld.bin` (yapılar).
- Kaynak: `site-build/map3d/v2/world.py` (CompleteMap_Test yalnızca kıyı şekli ve kaba biyom ipucu olarak kullanıldı; arazi ve renkler üretildi).
