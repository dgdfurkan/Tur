# Tur Sitesi Prototipi

Ankara çıkışlı kültür turları için hazırlanan tanıtım sitesi, 3D rota simülasyonu ve operasyon paneli.

**Canlı sürüm:** https://dgdfurkan.github.io/Tur/

> Bu sürüm tanıtım amaçlı bir prototiptir. Tur, fiyat ve konaklama bilgileri örnek niteliğindedir; marka adı yer tutucudur.

## Özellikler

- **Tur Vitrini:** Her tur için ayrı sayfa, günlük program, konaklama, fiyata dâhil olan ve olmayan hizmetler. Her durak bir çizimle ve rakım, yapım yılı gibi kısa bilgilerle gösterilir.
- **Doluluk Görünümü:** Kalkış tarihine göre doluluk oranı, kalan koltuk sayısı ve koltuk durumu.
- **Rota Ön İzlemesi:** Çizim tarzında 3D Türkiye haritası üzerinde biniş kartı, mühür ve otobüs animasyonuyla ilerleyen rota simülasyonu. Otobüs bir durağa vardığında o yerin çizimi ve bilgileri ekranda belirir; yolculuğun sonunda kalkış tarihlerine geçilir. Grafik işlemcisi bulunmayan cihazlarda aynı simülasyon düz harita üzerinde çalışır.
- **Operasyon Paneli:** Telefonda kullanılmak üzere tasarlanmış yönetim uygulaması. Turların fiyatı, kalkışları, başka kanaldan satılan koltukları, sitede görünüp görünmeyeceği ve sayfa içeriği; yolcu ve kapora kaydı, kalan ödemeler, sigorta listesi; ana sayfa metni, duyuru ve iletişim bilgileri buradan yönetilir. Panel erişim koduyla açılır ve siteden bağlantı verilmez.
- **Video Stüdyosu:** Panelde, tur rotasından Instagram boyutlarında (9:16, 4:5, 1:1, 16:9) 4K çözünürlüğe kadar MP4 video üretilir. Videoya logo, ajans adı ve iletişim satırı eklenir; video cihazda hazırlanır ve hiçbir sunucuya yüklenmez.
- **Erişilebilirlik:** Klavye ile kullanım, ekran okuyucu duyuruları ve azaltılmış hareket tercihi desteklenir.

## Teknoloji

| Katman    | Seçim                   |
| --------- | ----------------------- |
| Çatı      | Astro 7 (statik çıktı)  |
| Dil       | TypeScript 6 (strict)   |
| 3D        | three.js                |
| Animasyon | GSAP, CSS               |
| Video     | WebCodecs, Mediabunny   |
| Test      | Vitest, Playwright, axe |
| Yayın     | GitHub Pages            |

## Kurulum

Node.js 22.12 veya üzeri gerekir.

```bash
npm install
```

```bash
npm run dev
```

Site `http://localhost:4321/Tur/` adresinde açılır.

## Komutlar

| Komut                | Açıklama                                                                               |
| -------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`        | Geliştirme sunucusunu başlatır                                                         |
| `npm run build`      | Siteyi `dist/` klasörüne derler                                                        |
| `npm run preview`    | Derlenen siteyi yerelde sunar                                                          |
| `npm run verify`     | Tip denetimi, lint, birim testleri ve derlemeyi birlikte çalıştırır                    |
| `npm run build:e2e`  | Test sürümünü `dist-e2e/` klasörüne derler; bu sürümün paneli test koduyla açılır      |
| `npm run test:e2e`   | Test sürümünü derler ve uçtan uca testleri çalıştırır                                  |
| `npm run format`     | Kodu Prettier ile biçimlendirir                                                        |
| `npm run map:build`  | Harita verisini yeniden üretir                                                         |
| `npm run panel:code` | Operasyon panelinin erişim kodunu değiştirir (`-- --generate` rastgele bir kod üretir) |

## Klasör Yapısı

```
.claude/skills/     Geliştirmede kullanılan skill paketleri ve Türkçe içerik standardı
.github/            Dependabot ayarları, issue ve PR şablonları
docs/               Mimari, yol haritası ve üçüncü taraf lisansları
scripts/            Harita verisini üreten ve panel kodunu değiştiren betikler
src/
  config/           Marka, iletişim ve yol yardımcıları
  content/tours/    Tur içerikleri
  domain/           Çatıdan bağımsız iş kuralları
  application/      Servisler
  infrastructure/   Depolama ve dışa aktarma
  features/         3D harita, rota simülasyonu, panel, video stüdyosu
  components/       Arayüz bileşenleri ve yer çizimleri
  layouts/  pages/  styles/  i18n/
tests/              Birim ve uçtan uca testler
```

Mimari ayrıntıları `docs/mimari.md`, sonraki aşamalar `docs/yol-haritasi.md` dosyasındadır.

## Yayın

Site GitHub Pages üzerinde yayınlanır. Marka adı ve iletişim bilgileri `src/config/site.ts` dosyasından değiştirilir. Site farklı bir alan adına taşınırken `SITE_URL` ve `BASE_PATH` ortam değişkenleri ayarlanır.

## Operasyon Paneli

Panel `/yonetim/` adresindedir ve sitenin hiçbir sayfasından bağlantı verilmez. Açılması için erişim kodu gerekir.

- Kod `npm run panel:code` komutuyla belirlenir. Komut kodu iki kez sorar ve ekranda göstermez. `npm run panel:code -- --generate` rastgele bir kod üretir ve `erisim-kodu.txt` dosyasına yazar; bu dosya depoya eklenmez.
- Depoda yalnızca kodun tuzlanmış parmak izi (`src/config/panel-lock.json`) tutulur. Kod değiştirildikten sonra site yeniden derlenip yayınlanır.
- "Bu Cihazda Hatırla" seçilmezse panel, sekme kapandığında yeniden kilitlenir.
- Uçtan uca testler için derlenen sürüm herkese açık bir test koduyla açılır; yayınlanan sürüm bu kodu tanımaz.

Paneldeki değişiklikler şimdilik girildiği cihazda saklanır. Fiyat, doluluk ve tur görünürlüğü o cihazdaki site görünümüne hemen yansır; herkesin görmesi için site içeriğinin panelden yayınlanması gerekir (`docs/yol-haritasi.md`). Kayıtlar Site bölümündeki **Yedek Al** ve **Yedekten Geri Yükle** ile başka bir cihaza taşınır.

Kilit, ziyaretçilerin paneli açmasını önler; ancak gerçek bir erişim denetimi değildir. Site statiktir ve depo herkese açıktır; panelin yazılımı ve örnek veriler yayınlanan dosyaların içindedir. Paneldeki kayıtlar yalnızca girildiği cihazda durur. Gerçek erişim denetimi, paylaşımlı panelle birlikte Cloudflare Access üzerinden kurulur (`docs/yol-haritasi.md`).

## Güvenlik ve Veri

Depoya gerçek kişisel veri eklenmez. Demo paneli verileri yalnızca tarayıcıda tutar ve hiçbir sunucuya göndermez. Güvenlik açığı bildirimi için `SECURITY.md` dosyasına bakınız.

## Lisans

Tüm hakları saklıdır; ayrıntılar `LICENSE` dosyasındadır. Üçüncü taraf bileşenlerin lisansları `docs/ucuncu-taraf.md` dosyasında listelenir.
