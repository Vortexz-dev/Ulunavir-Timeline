# Ulunavir Timeline — Horaghfus Evreni

Horaghfus evreninin tek sayfalık, animasyonlu zaman çizelgesi. En yeni olay en üstte; aşağı kaydırdıkça geçmişe inilir.

Canlı site: https://vortexz-dev.github.io/Ulunavir-Timeline/

Statik site (HTML/CSS/JS, GSAP ScrollTrigger). Veri `data.js` içinde.

## Arka plan müziği

Sağ alttaki müzik düğmesi `assets/music.js` içindeki `playlist` listesini sırayla çalar (1 → 8, sonra tekrar 1; sonsuz döngü). Dosyalar sitenin içindedir (`assets/music/01.mp3` … `08.mp3`, orijinal kalite); YouTube kullanılmaz. Tek bir HTML5 `<audio>` öğesi vardır ve dosyalar yalnızca çalınacakları zaman indirilir.

1. Shadow of War — Fires of War
2. Invincible — Ugly and Vengeful (The Scourge Virus Theme)
3. Bard’s Banquet
4. The Three Banners: Fanfare
5. Magnus Smiles on Suran
6. People of the Land
7. The Tree When We Sat Once
8. Main Theme

Müzik site açılınca kendiliğinden başlamayı dener. Tarayıcı izin vermezse ilk tıklama, dokunma, tuş ya da kaydırmada başlar. Ziyaretçi müziği kapatırsa bu tercih (ses, parça, sessiz) tarayıcıda hatırlanır ve bir daha zorlanmaz. Parça eklemek için:

```js
{ name:'Parça adı', src:'assets/music/09.mp3' }
```

Müzik parçalarının hakları sahiplerine aittir; bu kişisel hayran sitesinde yalnızca arka plan için kullanılır.

## Dönem ambiyansı ve efekt sesleri

Oynatıcıdaki rüzgâr düğmesi ve yanındaki ikinci kaydırıcı, dönemin temasına göre çok kısık bir ortam sesini açar/kapatır (rüzgâr, ateş çıtırtısı, yağmur, deniz, orman/kuş, büyü uğultusu). Dönem değişince sesler yumuşakça birbirine geçer. Zaman çizgisindeki ışık topu büyük bir savaşın (başlığında "Savaş" geçen önemli olaylar) düğümüne ulaşınca kısa bir savaş borusu, cüce/demirci olaylarına (Crownforge, cüceler, Forge) ulaşınca bir örs sesi çalar; her geçişte bir kez, ambiyans kapalıyken hiç.

**Kaynak ve lisans:** bu seslerin hiçbiri dosya değildir; hepsi tarayıcıda Web Audio API ile anlık üretilir (gürültü + filtre + osilatör), bu sitenin kendi kodudur. Dışarıdan ses kaydı kullanılmaz, lisans gerektirmez. Tercih `localStorage` içinde `ulv-amb` anahtarıyla saklanır.

## Önbellek

`site-build/build.py` her resim bağlantısına ve `index.html` içindeki `data.js`, `assets/*.js`, `assets/style.css` bağlantılarına içerik özetinden üretilen `?v=…` ekler. Bir dosya değişince adresi de değişir, tarayıcı eski kopyayı göstermez.

Dönem renkleri ve parçacık efektleri: `assets/themes.js`.
