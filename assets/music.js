/* ==========================================================================
   ARKA PLAN MÜZİĞİ — yerel MP3 çalma listesi (assets/music/)
   --------------------------------------------------------------------------
   Parçalar yazıldığı sırayla çalar: 1 → 2 → … → 8 → tekrar 1 (sonsuz döngü).
   Site açılınca müzik kendiliğinden başlamayı dener; tarayıcı sesli otomatik
   oynatmayı engellerse ilk tıklama / dokunma / tuş / kaydırmada başlar.
   Kullanıcı müziği kapattıysa (tercih tarayıcıda saklanır) bir daha zorlamaz.
   Bazı olay/bölümlerde özel şarkı çalar (aşağıda 'eventMusic'); dönem ambiyansı ayrı bir katmandır ('eraAmbience').
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
     OLAYA / BÖLÜME ÖZEL MÜZİK (Phoenix'in Drive'a yüklediği şarkılar, assets/music/event/)
     Varsayılan 8 parça normal çalar. Ekrandaki olay aşağıdaki listede bir bölgeye
     girince müzik yumuşak geçişle o şarkıya geçer (şarkı orada döngüde çalar).
     Bölgeden çıkınca varsayılan parçaya geri dönülür: hangi parçada ve kaçıncı
     saniyede kalındıysa oradan devam eder.
       chapters: [...]  bölümün tamamı (başlık kartından son olayına kadar)
       orders:   [...]  yalnızca bu olay(lar) — data.js'teki 'o' numaraları
     Yukarıdan aşağı İLK eşleşen satır kullanılır (olay satırları bölüm satırlarından önce).
     ------------------------------------------------------------------------ */
  eventMusic: [
    { name:'Güneş Savaşları',  src:'assets/music/event/gunes-savaslari.mp3',   orders:[42, 43] },
    { name:'Serylda’nın Sesi', src:'assets/music/event/seryldanin-sesi.mp3',   orders:[130, 130.5] },
    { name:'Sefer Hazırlığı',  src:'assets/music/event/sefer-hazirligi.mp3',   orders:[133, 134, 134.5] },
    { name:'Jephcoats',        src:'assets/music/event/jephcoats.mp3',         orders:[161, 162] },
    { name:'Girift Âlem',      src:'assets/music/event/girift-alem.mp3',       orders:[163] },
    { name:'Kadim Çağ',        src:'assets/music/event/kadim-cag.mp3',         chapters:['kadim'] },
    { name:'İmparatorluk Çağı',src:'assets/music/event/imparatorluk-cagi.mp3', chapters:['imparatorluk'] },
    { name:'Boraldmir’in Dönüşü', src:'assets/music/event/boraldmirin-donusu.mp3', chapters:['donus'] },
    { name:'Güney Seferi',     src:'assets/music/event/guney-seferi.mp3',      chapters:['ch04'] },
    { name:'Balahnur’un Düşüşü', src:'assets/music/event/balahnurun-dususu.mp3', chapters:['ch08'] },
    { name:'Mital Alari',      src:'assets/music/event/mital-alari.mp3',       chapters:['ch10'] }
  ],
  eventMusicFadeSec: 2.5,   // varsayılan <-> özel şarkı geçişi (saniye)
  eventMusicDwellSec: 1.2,  // bölgeye girip/çıkınca geçmeden önce bekleme (hızlı kaydırmada müzik sürekli değişmesin)
  /* ------------------------------------------------------------------------
     DÖNEM AMBİYANSI (Phoenix'in numaralı ambiyans dosyaları, assets/amb/)
     Her bölüm (çağ) kendi ambiyansını çalar; bölümler arası eşit güçlü yumuşak geçiş.
       chapters: bölüm kimlikleri (data.js chapters[].id)
       file:     normal ambiyans
       war:      isteğe bağlı SAVAŞ sürümü; 'warOrders' listesindeki olaylar ekrandayken
                 normal sürümle yumuşak geçişle yer değiştirir (ikisi de kaldığı yerden sürer).
     Dosyalar web için kısaltıldı: orijinallerin ilk 1 dakikası atlandı (60. saniyeden
     itibaren 6 dakika, 80 kbps). Bu yüzden startSec 0; tam dosya konursa startSec: 60 yap —
     her döngü de startSec'ten yeniden başlar.
     ------------------------------------------------------------------------ */
  eraAmbience: [
    { chapters:['kadim'],        file:'01-kadim.mp3' },
    { chapters:['kanunsuz'],     file:'02-kanunsuz.mp3' },
    { chapters:['kurtulus'],     file:'03-kurtulus.mp3' },
    { chapters:['gunes'],        file:'04-gunes.mp3',        war:'04-gunes-war.mp3',
      warOrders:[42, 43, 46, 48, 50, 51, 56, 57, 58] },
    { chapters:['imparatorluk'], file:'05-imparatorluk.mp3', war:'05-imparatorluk-war.mp3',
      warOrders:[63, 67, 68, 73, 76, 77, 78, 79, 80, 81, 82, 87, 88, 89, 92, 94] },
    { chapters:['donus'],        file:'06-donus.mp3',        war:'06-donus-war.mp3', warOrders:[101] },
    { chapters:['ch01'],         file:'07-ch01.mp3' },
    { chapters:['ch02'],         file:'08-ch02.mp3' },
    { chapters:['ch03'],         file:'09-ch03.mp3' },
    { chapters:['ch04'],         file:'10-ch04.mp3' },
    { chapters:['ch05'],         file:'11-ch05.mp3' },
    { chapters:['ch06'],         file:'12-ch06.mp3' },
    { chapters:['ch07'],         file:'13-ch07.mp3' },
    { chapters:['ch08'],         file:'14-ch08.mp3' },
    { chapters:['ch09'],         file:'15-ch09.mp3' },
    { chapters:['ch10', 'ch11'], file:'16-ch10-ch11.mp3' }
  ],
  ambience: {
    volume: 24,          // ambiyans varsayılan sesi (0–100); müzik önde, ambiyans arka planda kalır
    on: true,            // ambiyans + olay sesleri açık/kapalı (sağ alttaki müzik panelinde)
    startSec: 0,         // her dosya bu saniyeden başlar ve döngüde buraya döner (dosyalarda ilk dakika zaten atlandı)
    crossfadeSec: 5,     // bölümler arası eşit güçlü geçiş (saniye)
    warFadeSec: 4,       // normal <-> savaş sürümü geçişi (saniye)
    loopXfadeSec: 6,     // dosya sonu -> başı arası geçiş (dikiş duyulmasın)
    dwellSec: 2.5        // yeni bölüme / savaş sürümüne geçmeden önce bekleme (hızlı kaydırmada sesler sürekli değişmesin)
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
