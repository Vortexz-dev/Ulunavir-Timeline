# Ulunavir Timeline — Horaghfus Evreni

Horaghfus evreninin tek sayfalık, animasyonlu zaman çizelgesi. En yeni olay en üstte; aşağı kaydırdıkça geçmişe inilir.

Canlı site: https://vortexz-dev.github.io/Ulunavir-Timeline/

Statik site (HTML/CSS/JS, GSAP ScrollTrigger). Veri `data.js` içinde.

## Arka plan müziği ekleme

Sağ alttaki küçük müzik düğmesi `assets/music.js` içindeki `playlist` listesini sırayla çalar (1 → 8, sonra tekrar 1; sonsuz döngü). Dönem/kaydırma müziği değiştirmez. Parça eklemek/sıralamak için listeyi düzenle:

```js
{ name:'Parça adı', url:'https://youtu.be/XXXXXXXXXXX' }
```

Kabul edilen bağlantılar: `youtube.com/watch?v=…`, `youtu.be/…`, `music.youtube.com/…`, `…/shorts/…` veya 11 karakterlik video kimliği. Oynatılamayan (ör. yerleştirmesi kapalı) parça otomatik atlanır. Tarayıcılar sesli otomatik oynatmayı engellediği için müzik ilk tıklamayla başlar; ses, parça ve açık/kapalı durumu tarayıcıda hatırlanır.

Dönem renkleri ve parçacık efektleri: `assets/themes.js`.
