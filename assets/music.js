/* ==========================================================================
   ARKA PLAN MÜZİĞİ — yerel MP3 çalma listesi (assets/music/)
   --------------------------------------------------------------------------
   Parçalar yazıldığı sırayla çalar: 1 → 2 → … → 8 → tekrar 1 (sonsuz döngü).
   Site açılınca müzik kendiliğinden başlamayı dener; tarayıcı sesli otomatik
   oynatmayı engellerse ilk tıklama / dokunma / tuş / kaydırmada başlar.
   Kullanıcı müziği kapattıysa (tercih tarayıcıda saklanır) bir daha zorlamaz.
   Dönem/kaydırma müziği DEĞİŞTİRMEZ; dönem ambiyansı ayrı bir katmandır (aşağıda 'eraAmbience').
   ========================================================================== */
window.MUSIC = {
  volume: 35,      // varsayılan ses (0–100)
  fadeMs: 1200,    // açılış/kapanış ses geçişi (milisaniye)
  playlist: [
    { name:'Shadow of War — Fires of War',        src:'assets/music/01.mp3' },
    { name:'Invincible — Ugly and Vengeful',      src:'assets/music/02.mp3' },
    { name:'Bard’s Banquet',                      src:'assets/music/03.mp3' },
    { name:'The Three Banners: Fanfare',          src:'assets/music/04.mp3' },
    { name:'Magnus Smiles on Suran',              src:'assets/music/05.mp3' },
    { name:'People of the Land',                  src:'assets/music/06.mp3' },
    { name:'The Tree When We Sat Once',           src:'assets/music/07.mp3' },
    { name:'Main Theme',                          src:'assets/music/08.mp3' }
  ],
  /* ------------------------------------------------------------------------
     DÖNEM AMBİYANSI (ERA AMBIENCE) — şimdilik BOŞ: Phoenix kendi ambiyans
     dosyalarını yıl aralıklarıyla gönderecek. Dosyaları assets/sfx/ içine koyup
     aşağıdaki listeye ekle; liste boşken hiç ambiyans çalmaz (olay sesleri yine çalar).

     Biçim (yukarıdan aşağı İLK eşleşen satır kullanılır):
       { from: 1949, to: 2999, files: ['amb-kadim-1.mp3', 'amb-kadim-2.mp3'], gain: 1 }
         from / to : yıl aralığı, iki uç dahil (ekrandaki olayın yılı).
         files     : tek dosya = kesintisiz döngü; birden fazla = sırayla çalar,
                     biri bitince yumuşak geçişle sıradakine geçer, sonra başa döner.
         gain      : isteğe bağlı ses çarpanı (varsayılan 1).
       { postgame: true, files: [...] }      oyun (kampanya) dönemi: 'Kampanya öncesi',
                                             'Cilt I', festival, TimeSkip, Tahliye, Mital Alari...
       { chapters: ['ch08','ch09'], files: [...] }  isteğe bağlı: belirli oyun bölümleri.
     Yıl kuralı: oyun öncesi olaylarda tarihteki ilk yıl kullanılır ("8102–9072" -> 8102,
     "tarihsiz, 9763 ile 9761 arası" -> 9763). Oyun dönemi olaylarının yılı 10000 sayılır,
     yani { from: 9903, to: 99999 } de oyun dönemini kapsar.
     Geçişler: dönem değişince crossfadeSec saniyelik eşit güçlü geçiş; aynı dönemde
     kalınca ses yeniden başlamaz; hızlı kaydırmada dwellSec kadar beklenir.
     ------------------------------------------------------------------------ */
  eraAmbience: [
    // örnek: { from: 1949, to: 2999, files: ['amb-kadim.mp3'] },
    // örnek: { postgame: true, files: ['amb-oyun-1.mp3', 'amb-oyun-2.mp3'] }
  ],
  ambience: {
    volume: 24,          // ambiyans varsayılan sesi (0–100); eski varsayılan 30'un bir kademe altı, müzik önde kalır
    on: true,            // ambiyans + olay sesleri açık/kapalı (sağ alttaki müzik panelinde)
    crossfadeSec: 5,     // dönemler arası eşit güçlü geçiş (saniye)
    loopXfadeSec: 1.5,   // dosya sonu -> başı (ya da sıradaki dosya) arası kısa geçiş, tık sesi olmasın
    dwellSec: 2.5        // yeni döneme geçmeden önce o dönemde kalma süresi (hızlı kaydırmada sesler sürekli değişmesin)
  },
  /* ------------------------------------------------------------------------
     OLAY SESLERİ — yalnızca bu 40 önemli olayda çalar (anahtar: data.js'teki olay 'o' numarası).
     Çizgideki parlayan top olayın noktasına ulaşınca bir kez çalar; listede olmayan
     olaylarda hiçbir ses çalmaz. Dosyalar: assets/sfx/<ad>.mp3 (kaynaklar: assets/sfx/CREDITS.md).
     Birden fazla dosya verilirse her geçişte sıradaki çalar.
     ------------------------------------------------------------------------ */
  eventSfx: {
    '2':['evt-death-descends'],     '3':['evt-elf-war-sorcery'],    '6':['evt-rains-begin'],
    '13':['evt-apple-in-ice'],      '19':['evt-manayutan-raid'],    '20':['evt-rains-end'],
    '22':['evt-manayutan-war'],     '31':['evt-kobold-war'],        '38':['evt-phoenix-archers'],
    '42':['evt-fire-portal-hordes'],'43':['evt-portal-closes'],     '50':['evt-amanar-rises'],
    '51':['evt-dragon-slain'],      '58':['evt-kobold-surrender'],  '63':['evt-kingdom-wars'],
    '79':['evt-frozen-blood'],      '82':['evt-hidden-prince'],     '83':['evt-empire-founded'],
    '90':['evt-orc-curse'],         '92':['evt-boraldmir-onslaught'],'94':['evt-boraldmir-falls'],
    '101':['evt-boraldmir-returns'],'103':['evt-wardrobe-night'],   '107':['evt-three-banners'],
    '115':['evt-first-spark'],      '120':['evt-hydra-cave'],       '122':['evt-hydra-slain'],
    '126':['evt-race-victory'],     '130':['evt-voice-returns'],    '155.6':['evt-werewolf-cage'],
    '161':['evt-secret-passage'],   '186':['evt-crownforge-rite'],  '187':['evt-balahnur-burns'],
    '190':['evt-pox-uprising'],     '193':['evt-angel-defeated'],   '199':['evt-angel-inferno'],
    '203':['evt-harbour-exodus'],   '206':['evt-death-walks'],      '218':['evt-nyxara-falls'],
    '219':['evt-silent-voice']
  },
  sfxMinGapMs: 3000      // iki olay sesi arasında en az bu kadar süre
};
