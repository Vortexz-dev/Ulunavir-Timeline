/* ==========================================================================
   ARKA PLAN MÜZİĞİ — yerel MP3 çalma listesi (assets/music/)
   --------------------------------------------------------------------------
   Parçalar yazıldığı sırayla çalar: 1 → 2 → … → 8 → tekrar 1 (sonsuz döngü).
   Site açılınca müzik kendiliğinden başlamayı dener; tarayıcı sesli otomatik
   oynatmayı engellerse ilk tıklama / dokunma / tuş / kaydırmada başlar.
   Kullanıcı müziği kapattıysa (tercih tarayıcıda saklanır) bir daha zorlamaz.
   Dönem/kaydırma müziği DEĞİŞTİRMEZ; dönem ambiyansı ayrı bir katmandır.
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
  // dönem ambiyansı (WebAudio ile tarayıcıda üretilir; dosya yok)
  ambience: { volume: 30, on: true }
};
