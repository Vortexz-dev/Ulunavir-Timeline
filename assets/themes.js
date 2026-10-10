/* ==========================================================================
   DÖNEM TEMALARI — kolayca düzenlenebilir ayar dosyası
   --------------------------------------------------------------------------
   Her olay, aşağıdaki "rules" listesinde İLK eşleşen kurala göre bir tema alır.
   Kural alanları (hepsi isteğe bağlı, hepsi verilirse hepsi sağlanmalı):
     title:   olay başlığında aranacak düzenli ifade (büyük/küçük harf duyarsız)
     match:   başlık + özet + karakterler + yerler + gruplarda aranacak ifade
     orders:  [ilk, son]  olay sıra numarası aralığı (1 = en eski)
     years:   [ilk, son]  oyun içi yıl aralığı
     sections:["A","C4",...] bölüm kodları
     chapters:["kadim",...]  bölüm/çağ kimlikleri (oyun sonrası: "ch01" … "ch11")
   Bir olaya veri içinde "theme" alanı verilirse o doğrudan kullanılır.
   Not: eşleştirme Türkçe küçük harfle yapılır (I→ı); Roma rakamlarını başlıktaki gibi BÜYÜK yaz (ör. 'julius IV:').
   Temalar:
     line:  orta çizginin neon rengi        glow: arka plan ışıltısı
     bgTop / bgBot: arka plan degradesi     particles: efekt katmanları (0–1 yoğunluk)
   Efekt türleri: rain, snow, embers, ash, smoke, motes, wisps, dust, mist
   ========================================================================== */
window.THEMES = {
  smoothing: 2,          // komşu kaç olayla yumuşatılsın (geçişler sertleşirse arttır)
  themes: {
    modern:   { name:'Günümüz',          line:'#ff8a3c', glow:'#7b3fc0', bgTop:'#1c1026', bgBot:'#0b0810', particles:{ embers:.7, dust:.15 } },
    witch:    { name:'Cadılar',          line:'#b46bff', glow:'#7a2cff', bgTop:'#1b0b2e', bgBot:'#08050f', particles:{ wisps:1, motes:.25 } },
    war:      { name:'Savaş',            line:'#ff2e2e', glow:'#9a1010', bgTop:'#2a0b0a', bgBot:'#0d0606', particles:{ embers:.9, smoke:.7, ash:.5 } },
    fire:     { name:'Ateş / Ejderha',   line:'#ff7a12', glow:'#d4380a', bgTop:'#2e1206', bgBot:'#0f0604', particles:{ embers:1, smoke:.35 } },
    elven:    { name:'Elf yüceliği',     line:'#ffd36a', glow:'#3fbf8a', bgTop:'#0f1f1a', bgBot:'#070d0b', particles:{ motes:1, mist:.2 } },
    light:    { name:'Işık',             line:'#fff1a8', glow:'#d8b24a', bgTop:'#201a0c', bgBot:'#0b0905', particles:{ motes:1, dust:.2 } },
    ice:      { name:'Buz çağı',         line:'#8fdcff', glow:'#3a7fb8', bgTop:'#0c1824', bgBot:'#05090e', particles:{ snow:1, mist:.25 } },
    rain:     { name:'Keder Yağışları',  line:'#7fb4ff', glow:'#2c4f88', bgTop:'#0d1520', bgBot:'#05080c', particles:{ rain:1, mist:.3 } },
    sea:      { name:'Deniz',            line:'#3fe0d0', glow:'#14707a', bgTop:'#08181c', bgBot:'#03090b', particles:{ mist:.8, rain:.25 } },
    death:    { name:'Ölüm',             line:'#cfd6ff', glow:'#3b3566', bgTop:'#0e0d18', bgBot:'#040408', particles:{ dust:.6, wisps:.35, mist:.3 } },
    sand:     { name:'Kızıl kumlar',     line:'#ff9a5a', glow:'#a2401c', bgTop:'#2a120a', bgBot:'#0e0604', particles:{ dust:1 } },
    quake:    { name:'Deprem / Buhar',   line:'#d9a36a', glow:'#6a4a2a', bgTop:'#1e140c', bgBot:'#0a0705', particles:{ smoke:.8, dust:.6 } },
    ancient:  { name:'Kadim',            line:'#d9b46a', glow:'#6a4a24', bgTop:'#1d150c', bgBot:'#0a0705', particles:{ dust:1 } },
    calm:     { name:'Sakin dönem',      line:'#c9b48a', glow:'#4a4a3a', bgTop:'#15130f', bgBot:'#080706', particles:{ dust:.5, motes:.2 } },
    // --- oyun sonrası (post-game) temaları ---
    memory:   { name:'Geçmiş / anı',     line:'#d9b38a', glow:'#5a3a2a', bgTop:'#18110d', bgBot:'#080605', particles:{ dust:.7, ash:.2 } },
    forge:    { name:'Ark Armatech / döküm', line:'#ffb347', glow:'#a8541a', bgTop:'#22150c', bgBot:'#0c0805', particles:{ embers:.8, smoke:.4 } },
    festival: { name:'Festival',         line:'#ffcf6a', glow:'#e0572e', bgTop:'#25120f', bgBot:'#0c0607', particles:{ motes:1, embers:.35 } },
    blood:    { name:'Mağara / vampir',  line:'#ff4060', glow:'#6a0f2a', bgTop:'#1e070c', bgBot:'#090305', particles:{ mist:.45, ash:.3 } },
    sky:      { name:'Gökyüzü seferi',   line:'#9fe0ff', glow:'#4a7fb0', bgTop:'#0f1a26', bgBot:'#06090d', particles:{ mist:.7, motes:.2 } },
    snowcity: { name:'Karlı Balahnur',   line:'#bfe4ff', glow:'#4a6a8a', bgTop:'#101820', bgBot:'#05080b', particles:{ snow:.9, smoke:.35 } },
    sterile:  { name:'Beyaz oda / elf tesisi', line:'#e8f6ff', glow:'#7fa8c0', bgTop:'#1a2026', bgBot:'#0a0d10', particles:{ dust:.3, motes:.15 } },
    occult:   { name:'Jephcoats / okült', line:'#4fd1c5', glow:'#1d4f5a', bgTop:'#0a1416', bgBot:'#040809', particles:{ mist:.5, wisps:.3, dust:.2 } },
    girift:   { name:'Girift Alem',      line:'#5ff2e6', glow:'#7a2cff', bgTop:'#0b0f24', bgBot:'#04040c', particles:{ wisps:.9, motes:.5 } },
    industrial:{ name:'Herkenoff / sızma', line:'#9cc45a', glow:'#3d4a2a', bgTop:'#121510', bgBot:'#060705', particles:{ smoke:.8, rain:.45, ash:.2 } },
    crown:    { name:'Crownforge adası', line:'#d8c27a', glow:'#3a5f7f', bgTop:'#101820', bgBot:'#05080b', particles:{ mist:.6, rain:.35 } },
    night:    { name:'Balahnur gecesi / Vindicator', line:'#ff5a4a', glow:'#3a2a6a', bgTop:'#120e1e', bgBot:'#06050a', particles:{ motes:.4, mist:.3 } },
    timestop: { name:'Durmuş zaman',     line:'#fff0b0', glow:'#3fb8c0', bgTop:'#0f1e22', bgBot:'#05090b', particles:{ motes:1, mist:.3 } },
    grief:    { name:'Yas',              line:'#8aa0c8', glow:'#2a3550', bgTop:'#0d1018', bgBot:'#040508', particles:{ rain:.65, mist:.2 } }
  },
  /* HAVA EFEKTLERİ — arka plandaki uçuşan parçacıklar çağa/bölüme göre değişir.
     İlk eşleşen kural kullanılır. orders: [ilk, son] olay 'o' aralığı, chapters: bölümler,
     not: hariç tutulan olaylar. Bir hava modu, adını verdiği katmanları (0 dahil) belirler;
     temanın diğer katmanları hafifçe (x0.4) kalır. Geçişler komşu olaylarla yumuşatılır.
     'Efektler: Hafif' modunda ve yavaş cihazlarda parçacık sayısı otomatik azalır. */
  weather: {
    modes: {
      rain: { rain:1, mist:.3, snow:0, embers:0, dust:0 },              // yağmur damlaları
      snow: { snow:1, mist:.15, rain:0, embers:0, ash:0 },              // kar
      burn: { ash:.95, embers:.9, smoke:.35, rain:0, snow:0, motes:0 }  // düşen kül + yükselen közler
    },
    rules: [
      { orders:[6, 19], mode:'rain' },                       // Keder Yağışları (2001–3000)
      { chapters:['ch05'], orders:[155, 158], mode:'snow' },  // Blood&Duty: karlı Balahnur kışı
      { chapters:['ch06'], not:[163], mode:'snow' },          // Kış: Jephcoats, TimeSkip 2 (Girift Âlem hariç)
      { orders:[176, 176], mode:'snow' },                     // Echoes of the Past: donmuş ev
      { chapters:['ch08'], not:[192], mode:'burn' }           // Balahnur yanarken (Arrowhul uçuşu hariç)
    ]
  },
  rules: [
    // ===== OYUN SONRASI (chapters ch01–ch11): önce başlık kuralları, sonra bölüm varsayılanı =====
    // ch01 Geçmişler ve Büyük Savaş
    { chapters:['ch01'], title:'katledil', theme:'death' },
    { chapters:['ch01'], title:'39\\. cadde|barışbozan', theme:'rain' },
    { chapters:['ch01'], title:'büyük savaş:', theme:'war' },
    { chapters:['ch01'], title:'hundred blades', theme:'fire' },
    { chapters:['ch01'], title:'savaş biter', theme:'festival' },
    { chapters:['ch01'], title:'kuruluşu', theme:'forge' },
    { chapters:['ch01'], theme:'memory' },
    // ch02 Cilt I
    { chapters:['ch02'], title:'chavel|velocis|kapsülü', theme:'forge' },
    { chapters:['ch02'], title:'han odası', theme:'rain' },
    { chapters:['ch02'], title:'kütüphane', theme:'ancient' },
    { chapters:['ch02'], title:'vampir|false hydra savaşı', theme:'blood' },
    { chapters:['ch02'], title:'diriltilir|serilda', theme:'light' },
    { chapters:['ch02'], title:'narnia', theme:'ice' },
    { chapters:['ch02'], title:'nasihir', theme:'fire' },
    { chapters:['ch02'], title:"xar'koth", theme:'witch' },
    { chapters:['ch02'], theme:'modern' },
    // ch03 Serylda'nın sesi, festival, sefer hazırlığı
    { chapters:['ch03'], title:'pox sanctum', theme:'light' },
    { chapters:['ch03'], title:'kapsül laneti', theme:'sand' },
    { chapters:['ch03'], title:'aetherion', theme:'forge' },
    { chapters:['ch03'], title:'goblin', theme:'fire' },
    { chapters:['ch03'], theme:'festival' },
    // ch04 Güney seferi
    { chapters:['ch04'], title:'antik kule', theme:'war' },
    { chapters:['ch04'], title:'trader', theme:'fire' },
    { chapters:['ch04'], title:'pirdeviz', theme:'ancient' },
    { chapters:['ch04'], title:'omzu kuma|sedonia|haydut', theme:'sand' },
    { chapters:['ch04'], title:'imparatoriçe', theme:'light' },
    { chapters:['ch04'], theme:'sky' },
    // ch05 TimeSkip 1
    { chapters:['ch05'], title:'çamurda', theme:'rain' },
    { chapters:['ch05'], title:'beyaz oda|elf tesisi', theme:'sterile' },
    { chapters:['ch05'], title:'kurtadam', theme:'blood' },
    { chapters:['ch05'], title:'ışıkları|grev', theme:'forge' },
    { chapters:['ch05'], theme:'snowcity' },
    // ch06 Kış: Jephcoats, Girift Alem, TimeSkip 2
    { chapters:['ch06'], title:'girift', theme:'girift' },
    { chapters:['ch06'], title:'jephcoats', theme:'occult' },
    { chapters:['ch06'], title:'oath of the ninth|derisi mektup', theme:'witch' },
    { chapters:['ch06'], title:'meyve', theme:'occult' },
    { chapters:['ch06'], title:'herkenoff|sinomorph|kurtadam', theme:'industrial' },
    { chapters:['ch06'], title:'crownforge|grafted', theme:'crown' },
    { chapters:['ch06'], title:'julius vane', theme:'forge' },
    { chapters:['ch06'], theme:'snowcity' },
    // ch07 Ayinden önceki günler
    { chapters:['ch07'], title:'vindicator|julius V:', theme:'night' },
    { chapters:['ch07'], title:'yüzüğünün yakılması', theme:'forge' },
    { chapters:['ch07'], title:'echoes of the past', theme:'death' },
    { chapters:['ch07'], title:'herkenoff|envy', theme:'industrial' },
    { chapters:['ch07'], title:'off duty', theme:'rain' },
    { chapters:['ch07'], title:'julius II:', theme:'festival' },
    { chapters:['ch07'], title:'julius IV:', theme:'war' },
    { chapters:['ch07'], title:'julius III:|pride|crownforge ayini', theme:'witch' },
    { chapters:['ch07'], title:'murat bey', theme:'forge' },
    { chapters:['ch07'], theme:'night' },
    // ch08 Balahnur'un düşüşü
    { chapters:['ch08'], title:'arrowhul', theme:'elven' },
    { chapters:['ch08'], title:'revalor düşmüş', theme:'light' },
    { chapters:['ch08'], title:'saint antonio', theme:'rain' },
    { chapters:['ch08'], title:'porsu|zafer I–II|işçilere|işçileri|hayvan laneti', theme:'forge' },
    { chapters:['ch08'], title:'herkenoff', theme:'war' },
    { chapters:['ch08'], title:'julius VI:|bound by lust|oburluk|julius takası', theme:'witch' },
    { chapters:['ch08'], title:'ayaklanma', theme:'war' },
    { chapters:['ch08'], theme:'fire' },
    // ch09 Tahliye ve Mital Alari'ye varış
    { chapters:['ch09'], title:'amanar|tahliye', theme:'sea' },
    { chapters:['ch09'], title:'zaman durdurması|varış', theme:'timestop' },
    { chapters:['ch09'], title:'ölüm', theme:'death' },
    { chapters:['ch09'], theme:'elven' },
    // ch10 Mital Alari günleri
    { chapters:['ch10'], title:'julius X:', theme:'grief' },
    { chapters:['ch10'], title:'mektub', theme:'night' },
    { chapters:['ch10'], title:'hayvan lanet', theme:'occult' },
    { chapters:['ch10'], theme:'elven' },
    // ch11 Julius'un hesaplaşması
    { chapters:['ch11'], title:'hundred blades', theme:'war' },
    { chapters:['ch11'], title:'nyxara', theme:'witch' },
    { chapters:['ch11'], title:'silent voice', theme:'light' },
    { chapters:['ch11'], theme:'grief' },
    // ===== OYUN ÖNCESİ (§A) =====
    { title:'sakin dönem', theme:'calm' },
    { title:'KEDER YAĞIŞLARI \\(başlangıç\\)|kuraklık', theme:'rain' },
    { title:'KEDER YAĞIŞLARININ SONU|Yeni Bir Umut', theme:'light' },
    { title:'Ölüm|Tarikatı Ayini', theme:'death' },
    { title:'Işık Elflerinin ortaya', theme:'light' },
    { title:'Kasvetli Nefes|Kükreyen Dağlar', theme:'quake' },
    { title:'kırmızı kum|red sand', theme:'sand' },
    { title:'balahnur yanar|yanış', theme:'fire' },
    { match:'cadı|nyxara|witch|girift|ninth|oburluk|melankoli|seraphim|silent voice|12 şarkı', theme:'witch' },
    { match:'ejderha|dragon|paarthonax|jörmun|yanardağ|(^|\\s)lav|ateşten portal|güneş savaş|balahnur yanar|yan[ıa]ş', theme:'fire' },
    { match:'amanar|deniz|korsan|tahliye|okyanus|gemi|sahil|kıyı|(^|\\s)ivar', theme:'sea' },
    { years:[2001, 2999], theme:'ice' },
    { match:'manayutan|keskinayaz|(^|\\s)buz|kar fırtına|(^|\\s)kış', theme:'ice' },
    { match:'savaş|katliam|baskın|gazab|(^|\\s)kanlı|bozgun|isyan|cinayet|katled', theme:'war' },
    { match:'elf|arowuhl|arrowhul|mital alari|revalor', theme:'elven' },
    { years:[1, 4999], theme:'ancient' },
    { sections:['A'], theme:'calm' },
    { theme:'modern' }
  ]
};
