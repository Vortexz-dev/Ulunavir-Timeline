/* ==========================================================================
   ARKA PLAN MÜZİĞİ — yerel MP3 çalma listesi (assets/music/)
   --------------------------------------------------------------------------
   Parçalar yazıldığı sırayla çalar: 1 → 2 → … → 8 → tekrar 1 (sonsuz döngü).
   Site açılınca müzik kendiliğinden başlamayı dener; tarayıcı sesli otomatik
   oynatmayı engellerse ilk tıklama / dokunma / tuş / kaydırmada başlar.
   Kullanıcı müziği kapattıysa (tercih tarayıcıda saklanır) bir daha zorlamaz.
   Dönem/kaydırma müziği DEĞİŞTİRMEZ; dönem ambiyansı ayrı bir katmandır (aşağıda 'ambience').
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
  // dönem ambiyansı: gerçek kayıt döngüleri (assets/sfx/amb-*.mp3, lisanslar: assets/sfx/CREDITS.md)
  // + yedek olarak tarayıcıda üretilen (WebAudio) sesler.
  ambience: {
    volume: 30, on: true,
    fadeSec: 4.5,        // iki döngü arası geçiş süresi (saniye)
    dwellSec: 2.2,       // kaydırırken yeni temanın sesine geçmeden önce bekleme (hızlı kaydırmada sesler sürekli değişmesin)
    rotateSec: [80, 130],// aynı yerde durulursa bu aralıkta aynı temanın başka bir döngüsüne geç
    noRepeat: 5,         // son N döngü mümkünse tekrar seçilmez
    // döngüler: dosya kimliği -> ses çarpanı (g)
    beds: {
      'wind-1':{g:1}, 'wind-2':{g:1}, 'wind-3':{g:.9}, 'wind-4':{g:.8}, 'wind-5':{g:1},
      'cave-1':{g:1}, 'cave-2':{g:.8}, 'fire-1':{g:.7}, 'fire-2':{g:1.2}, 'fire-3':{g:.5}, 'lava-1':{g:.9},
      'rain-1':{g:1}, 'rain-2':{g:1}, 'rain-3':{g:.9}, 'rain-4':{g:.65}, 'rain-5':{g:.9},
      'sea-1':{g:1}, 'sea-2':{g:1}, 'river-1':{g:1}, 'river-2':{g:1}, 'river-3':{g:.6},
      'forest-1':{g:.9}, 'forest-2':{g:.9}, 'forest-3':{g:.9}, 'forest-4':{g:.9}, 'forest-5':{g:.6},
      'night-1':{g:.8}, 'night-2':{g:.9}, 'city-1':{g:1.1}, 'city-2':{g:1.1}, 'camp-1':{g:.9},
      'bells-1':{g:.8}, 'machine-1':{g:.8}, 'machine-2':{g:.8}, 'dark-1':{g:.9}, 'dark-2':{g:.9}
    },
    // tema (assets/themes.js) -> uygun döngüler
    pools: {
      modern:['city-1','city-2','wind-3','rain-1','fire-2'], witch:['night-2','dark-1','cave-1','night-1'],
      war:['camp-1','fire-1','lava-1','wind-4'], fire:['fire-1','fire-3','lava-1','fire-2'],
      elven:['forest-1','forest-2','river-1','forest-5'], light:['forest-3','bells-1','forest-4','river-3'],
      ice:['wind-1','wind-2','wind-5'], rain:['rain-1','rain-2','rain-3','rain-5'], sea:['sea-1','sea-2','river-2'],
      death:['wind-1','cave-1','dark-2'], sand:['wind-3','wind-2','wind-4'], quake:['lava-1','cave-1','machine-2'],
      ancient:['wind-5','cave-2','fire-3','wind-3'], calm:['forest-3','river-1','forest-4','night-1'],
      memory:['rain-1','wind-3','river-3','fire-2'], forge:['machine-1','machine-2','fire-2','city-1'],
      festival:['city-2','city-1','forest-1'], blood:['cave-2','cave-1','night-2'], sky:['wind-2','wind-4','wind-5'],
      snowcity:['wind-1','wind-5','fire-2'], sterile:['machine-1','dark-1'], occult:['cave-2','dark-1','dark-2'],
      girift:['dark-2','dark-1'], industrial:['machine-2','rain-4','machine-1'], crown:['sea-2','rain-4','wind-4'],
      night:['night-1','city-2','rain-5'], timestop:['dark-1','forest-3'], grief:['rain-1','rain-5','rain-2']
    },
    // önemli olay sesleri (çizgideki kıvılcım büyük bir olaya ulaşınca): tür -> dosyalar (sırayla değişir)
    sfx: {
      dragon:['dragon-1','dragon-2'], battle:['battle-1','battle-2'], 
      death:['death-1','death-2'], sea:['sea-1'], holy:['holy-1'], forge:['forge-1','forge-2'],
      storm:['storm-1'], beast:['beast-1']
    }
  }
};
