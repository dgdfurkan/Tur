# Yol Haritası

Bu sürüm, tasarımı ve fikri göstermek için hazırlanmış bir prototiptir. Aşağıdaki adımlar, prototipin gerçek bir acente sitesine ve ofis aracına dönüşmesi için gereken işleri önem sırasıyla listeler.

## Yayın Öncesi Yapılacaklar

| İş                    | Açıklama                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Marka                 | Ad, logo ve iletişim bilgileri `src/config/site.ts` dosyasına yazılır                             |
| Belge Bilgisi         | TÜRSAB belge numarası ve işletme unvanı alt bilgiye eklenir                                       |
| Gerçek İçerik         | Tur programları, fiyatlar ve konaklama bilgileri örnek içeriğin yerini alır                       |
| Geçmiş Turlar         | Örnek yolculuklar silinir; acentenin gerçek yolculukları panelden kaydedilir                      |
| Sıkça Sorulan Sorular | Ödeme, iptal ve ön ödeme koşulları sözleşmeyle birlikte kesinleştirilir ve yanıtlara işlenir      |
| Fotoğraf              | Kullanım hakkı acenteye ait olan tur fotoğrafları eklenir                                         |
| Yasal Metinler        | KVKK aydınlatma metni ile paket tur sözleşmesi ve ön bilgilendirme metinleri hazırlanır           |
| Arama Motorları       | `noindex` etiketi kaldırılır; site haritası ve yapılandırılmış veri eklenir                       |
| Gerçek Cihaz Denemesi | Simülasyon, orta seviye Android telefonlarda ve iPhone'da kare süresi ölçülerek denenir           |
| Panel Erişim Kodu     | `npm run panel:code` ile yeni bir kod belirlenir ve yalnızca yetkili kişilerle paylaşılır         |
| Video Stüdyosu        | Videolar Safari ve Firefox'ta da denenir; WebCodecs desteklemeyen tarayıcıda stüdyo bunu bildirir |
| Alan Adı              | Site kendi alan adına taşınır; `SITE_URL` ve `BASE_PATH` değişkenleri ayarlanır                   |

## Aşama 1: Cloudflare'e Geçiş

GitHub Pages özel HTTP başlığı göndermeye izin vermez. Site Cloudflare üzerine taşındığında aşağıdaki başlıklar etkinleştirilir:

- `Content-Security-Policy` başlık olarak gönderilir ve `frame-ancestors 'none'` eklenir.
- `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` ve `Permissions-Policy` tanımlanır.

Kendi alan adı, tarayıcı deposunu da ayırır: bugün `dgdfurkan.github.io` adresindeki diğer projeler aynı tarayıcı deposunu paylaşır.

## Aşama 2: Panelden Yayın ve Paylaşımlı Kayıtlar

Panel turları, fiyatları, kalkışları ve site içeriğini yönetir; ancak değişiklikler bugün yalnızca girildiği cihazda durur. Gerçek kullanım için iki şey gerekir: değişikliklerin siteye yayınlanması ve kayıtların ofisteki ve sahadaki herkes tarafından aynı anda görülmesi.

- Yayın: paneldeki taslaklar (turlar, geçmiş turlar ve site ayarları) tek dokunuşla yayınlanır. GitHub ile yayında taslaklar depodaki içerik dosyalarına yazılır ve site bir iki dakikada yeniden derlenir; Cloudflare ile yayında değişiklik anında görünür. Panelde kaydedilen bir geçmiş tur, yayınla birlikte kendi sayfasına kavuşur.

- Veri, Cloudflare Workers ve D1 üzerinde tutulur.
- Giriş Cloudflare Access ile yapılır; ofis, satış ve rehber rolleri ayrılır. Bugünkü erişim kodu kilidi bu girişle değiştirilir.
- Video stüdyosunda kullanılan logo ve iletişim bilgisi, ayarlarla birlikte ofisin tüm cihazlarında ortak tutulur.
- Her ekleme, değişiklik ve silme işlemi, yapan kişi ve zamanla birlikte kaydedilir.
- Panel kodu değişmez: `PassengerRepository` arayüzü için HTTP üzerinden çalışan yeni bir uygulama yazılır.
- Bağlantının zayıf olduğu yerlerde kayıt cihazda bekletilir ve bağlantı geldiğinde gönderilir.

Kişisel veri işlenmeye başlandığı için bu aşamada KVKK yükümlülükleri yerine getirilir: aydınlatma metni, saklama süresi, yalnızca gereken verinin toplanması ve erişim kaydı. Kimlik numarası yalnızca sigorta için alınır ve şifrelenerek saklanır.

## Aşama 3: Sigorta Listesi Otomasyonu

1. Sigorta şirketinin istediği dosya biçimi öğrenilir ve `ListExporter` arayüzü için bu biçimi üreten bir uygulama yazılır. Liste tek tek yazılmak yerine toplu olarak yüklenir.
2. Kimlik numarası ve doğum tarihi alanları doğrulamalarıyla birlikte forma eklenir.
3. Sigorta şirketi bir API veya toplu yükleme hizmeti sunuyorsa liste doğrudan gönderilir.

## Aşama 4: Okul ve Kurum Teklif Aracı

- Katılımcı sayısı, tarih ve bölgeye göre kişi başı fiyat hesaplayan teklif formu.
- PDF teklif ve program çıktısı.
- Okul gezileri için dijital veli izni ve öğrenci listesi.
- Araç ve sürücü belgelerinin teklif dosyasına eklenmesi.

## Aşama 5: Tedarikçi Bilgi Bankası ve Maliyet Takibi

- Otel, restoran, rehber ve mekân kayıtları; anlaşma koşulları ve iletişim kişileri.
- Tur bazında maliyet, tahsilat ve iade takibi; kişi başı kârlılık.
- Kapora ve kalan ödeme için hatırlatmalar.

## Aşama 6: İletişim ve Saha

- Kalkış saati ve buluşma noktası için WhatsApp bildirimleri.
- Rehber ekranı: karekodla biniş yoklaması ve eksik yolcu listesi.
- Okul gezilerinde velilere yolculuk durumu bilgisi.

## Aşama 7: Ürün Genişlemesi

- Umre ve yurt dışı programları için uçak rotası görünümü.
- İngilizce dil desteği; arayüz metinleri `src/i18n/` altında ikinci bir dosyaya taşınır.
- Çevrim içi ön ödeme.

## Teknik İyileştirmeler

- Lighthouse bütçesinin CI adımı olarak çalıştırılması.
- Uçtan uca testlere WebKit (iOS Safari) projesinin eklenmesi.
- Harita, biniş kartı ve video kareleri için görsel karşılaştırma testleri.
- Gerçek fotoğraflar eklendiğinde görsellerin boyut ve biçim olarak optimize edilmesi.
