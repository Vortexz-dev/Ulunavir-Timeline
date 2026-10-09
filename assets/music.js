/* ==========================================================================
   ARKA PLAN MÜZİĞİ — tek, sabit çalma listesi (YouTube)
   --------------------------------------------------------------------------
   Parçalar yazıldığı sırayla çalar: 1 → 2 → … → 8 → tekrar 1 (sonsuz döngü).
   Dönem/kaydırma müziği DEĞİŞTİRMEZ (dönem renkleri themes.js'te, ayrı).
   Bir parça oynatılamazsa (ör. yerleştirme kapalı) önce "alt" bağlantısı
   (aynı parçanın başka bir yüklemesi) denenir, o da olmazsa sonrakine geçer.
   Tarayıcılar sesli otomatik oynatmayı engeller; müzik ilk tıklamada başlar.
   Bağlantı biçimleri: https://www.youtube.com/watch?v=XXXXXXXXXXX
                       https://youtu.be/XXXXXXXXXXX   veya sadece XXXXXXXXXXX
   ========================================================================== */
window.MUSIC = {
  volume: 35,      // varsayılan ses (0–100)
  fadeMs: 1200,    // açılış/kapanış ses geçişi (milisaniye)
  playlist: [
    { name:'Shadow of War — Fires of War',                url:'https://www.youtube.com/watch?v=QrBihZya6s4' },
    { name:'Invincible — Ugly and Vengeful',              url:'https://youtu.be/aE8eyF1g_BE' },
    { name:'Bard’s Banquet',                              url:'https://youtu.be/zXefQYvRaaA' },
    { name:'The Three Banners: Fanfare',                  url:'https://youtu.be/P-kovS9jIN0' },
    { name:'Magnus Smiles on Suran',                      url:'https://youtu.be/k-t186eu1tY' },
    { name:'People of the Land',                          url:'https://youtu.be/_oAMgAkgH0Y' },
    { name:'The Tree When We Sat Once',                   url:'https://youtu.be/isC9-OOwPPs', alt:'https://youtu.be/ElP5w9X3sp8' },
    { name:'Frostpunk 2 — Main Theme',                    url:'https://youtu.be/DEw6uhOVbXk', alt:'https://youtu.be/ivR-KQdwmdo' }
  ]
};
