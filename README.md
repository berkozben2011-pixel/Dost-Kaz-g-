# Dost Kazığı Online
Türkçe, mobil uyumlu, 3–12 kişilik online parti oyunu. HTML/CSS/JS + Node.js + Express + Socket.IO.

## Yerel çalıştırma
```
npm install
npm start        # http://localhost:3000
npm test         # sunucu testleri (15 senaryo)
```
Aynı Wi-Fi'deki telefonlar için bilgisayarın yerel IP'sini kullan: `http://192.168.x.x:3000`

## İnternette yayınlama (farklı cihazlardan oynamak için)
Socket.IO kalıcı bağlantı gerektirdiğinden **Node sunucusu çalıştırabilen** bir servis gerekir (GitHub Pages / Netlify statik hosting çalışmaz).
**Render.com (ücretsiz):** projeyi GitHub'a yükle → New → Web Service → repo'yu seç → Build: `npm install`, Start: `npm start` → Deploy. Verilen `https://…onrender.com` adresini arkadaşlarınla paylaş.
Railway, Fly.io ve Glitch de aynı şekilde çalışır (PORT ortam değişkenini otomatik okur). Tek sunucu örneği kullan: oda durumu bellekte tutulur, ölçeklenirse odalar ayrışır. Ücretsiz planlarda sunucu uyuyabilir; ilk açılış ~30 sn sürebilir.

## Nasıl çalışır
- Oda kodu 6 haneli; en fazla 12 oyuncu. Oyun sonradan katılanları bir sonraki turda dahil eder.
- Seçimler yalnızca sunucuda tutulur; herkes cevaplayana kadar istemcilere gönderilmez.
- Oda sahibi çıkarsa/bağlantısı 15 sn'den uzun kopar​sa yönetim sıradaki bağlı oyuncuya geçer; eski sahip geri dönse de yetki geri verilmez.
- Bağlantısı kopan oyuncu 30 sn sonra "bekliyor" işaretlenir; oda sahibi bekler, o turda atlar veya odadan çıkarır.
- Fotoğraflar tarayıcıda 160×160 JPEG'e küçültülür, sunucuda doğrulanır ve yalnızca bellekte, oda açıkken tutulur. Veritabanı yoktur.
- Hatalı oda kodu denemeleri IP başına dakikada 8 ile sınırlıdır.
- **+18 kategorisi** varsayılan kapalıdır, yalnızca oda sahibi açabilir; açık cinsel içerik yoktur. Yaş kontrolü **yalnızca kişinin beyanına dayanır**, doğrulanmaz.
- Ayarlanabilir ortam değişkenleri: `PORT`, `HOST_GRACE_MS`, `STALL_MS`.

## Dosyalar
`server.js` (odalar, turlar, güvenlik) · `questions.js` (155 soru, 6 kategori) · `public/` (arayüz) · `test.js` (testler)

## Bilinen eksikler
Arayüz otomatik tarayıcı testinden geçmedi; farklı telefon/PC'lerde elle denenmeli. Sunucu yeniden başlarsa odalar silinir.
