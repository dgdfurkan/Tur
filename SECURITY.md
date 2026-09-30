# Güvenlik Politikası

## Kapsam

Bu depo, statik olarak derlenip GitHub Pages üzerinden yayınlanan bir tanıtım sitesi prototipini içerir. Sunucu tarafı kodu, veri tabanı ve kimlik doğrulama bulunmaz. Demo operasyon paneli verileri yalnızca kullanıcının kendi tarayıcısında saklar ve hiçbir sunucuya göndermez.

## Güvenlik Açığı Bildirimi

Bir güvenlik açığı fark ederseniz herkese açık bir issue açmayınız. Deponun **Security** sekmesindeki **Report a vulnerability** bağlantısıyla özel bir bildirim oluşturunuz. Bildirimde sorunun nasıl yeniden üretileceğini ve olası etkisini belirtiniz.

Bildirimler yedi gün içinde yanıtlanır. Doğrulanan açıklar için düzeltme yayınlandıktan sonra bildirim sahibine bilgi verilir.

## Alınan Önlemler

- İçerik Güvenliği Politikası (CSP) her sayfada hash tabanlı olarak üretilir; `default-src 'self'` uygulanır.
- Trusted Types zorunludur ve hiçbir politikaya izin verilmez; destekleyen tarayıcılarda metin HTML'e veya koda dönüştürülemez.
- Değişken veri sayfaya yalnızca `textContent` ile yazılır; tarayıcı deposundan okunan kayıtlar doğrulanır.
- Operasyon paneli, başka bir sayfanın çerçevesi içinde açıldığında çalışmaz.
- Üçüncü taraf betik, analitik, yazı tipi sunucusu ve CDN kullanılmaz.
- Bağımlılıklar Dependabot ile haftalık olarak denetlenir.
- Depoya gerçek kişisel veri, parola veya erişim anahtarı eklenmez.

## Bilinen Sınırlar

- GitHub Pages özel HTTP başlığı tanımlamaya izin vermez. Bu nedenle `frame-ancestors`, HSTS ve `Permissions-Policy` gibi başlıklar, site Cloudflare üzerine taşındığında etkinleştirilecektir.
- Site, `dgdfurkan.github.io` adresindeki diğer projelerle aynı tarayıcı deposunu paylaşır. Bu nedenle panel yalnızca demo verisiyle kullanılmalıdır.

Ayrıntılar `docs/yol-haritasi.md` dosyasındadır.
