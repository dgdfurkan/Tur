# Tur Sitesi Prototipi

Ankara çıkışlı kültür turları için hazırlanan tanıtım sitesi, 3D rota simülasyonu ve demo operasyon paneli.

**Canlı sürüm:** https://dgdfurkan.github.io/Tur/

> Bu sürüm tanıtım amaçlı bir prototiptir. Tur, fiyat ve konaklama bilgileri örnek niteliğindedir; marka adı yer tutucudur.

## Özellikler

- **Tur Vitrini:** Her tur için ayrı sayfa, günlük program, konaklama, fiyata dâhil olan ve olmayan hizmetler.
- **Doluluk Görünümü:** Kalkış tarihine göre doluluk oranı, kalan koltuk sayısı ve koltuk durumu.
- **Rota Ön İzlemesi:** Çizim tarzında 3D Türkiye haritası üzerinde biniş kartı, mühür ve otobüs animasyonuyla ilerleyen rota simülasyonu. Grafik işlemcisi bulunmayan cihazlarda aynı simülasyon düz harita üzerinde çalışır.
- **Demo Operasyon Paneli:** Telefondan yolcu ve kapora kaydı, anlık doluluk, sigorta listesi dışa aktarımı. Veriler yalnızca cihazda saklanır.
- **Erişilebilirlik:** Klavye ile kullanım, ekran okuyucu duyuruları ve azaltılmış hareket tercihi desteklenir.

## Teknoloji

| Katman    | Seçim                   |
| --------- | ----------------------- |
| Çatı      | Astro 7 (statik çıktı)  |
| Dil       | TypeScript 6 (strict)   |
| 3D        | three.js                |
| Animasyon | GSAP                    |
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

| Komut               | Açıklama                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Geliştirme sunucusunu başlatır                                               |
| `npm run build`     | Siteyi `dist/` klasörüne derler                                              |
| `npm run preview`   | Derlenen siteyi yerelde sunar                                                |
| `npm run verify`    | Tip denetimi, lint, birim testleri ve derlemeyi birlikte çalıştırır          |
| `npm run test:e2e`  | Uçtan uca testleri derlenmiş site üzerinde çalıştırır (önce `npm run build`) |
| `npm run format`    | Kodu Prettier ile biçimlendirir                                              |
| `npm run map:build` | Harita verisini yeniden üretir                                               |

## Klasör Yapısı

```
.claude/skills/     Geliştirmede kullanılan skill paketleri ve Türkçe içerik standardı
.github/            Dependabot ayarları, issue ve PR şablonları
docs/               Mimari, yol haritası ve üçüncü taraf lisansları
scripts/            Harita verisini üreten betik
src/
  config/           Marka, iletişim ve yol yardımcıları
  content/tours/    Tur içerikleri
  domain/           Çatıdan bağımsız iş kuralları
  application/      Servisler
  infrastructure/   Depolama ve dışa aktarma
  features/         3D harita, rota simülasyonu, panel
  components/       Arayüz bileşenleri
  layouts/  pages/  styles/  i18n/
tests/              Birim ve uçtan uca testler
```

Mimari ayrıntıları `docs/mimari.md`, sonraki aşamalar `docs/yol-haritasi.md` dosyasındadır.

## Yayın

Site GitHub Pages üzerinde yayınlanır. Marka adı ve iletişim bilgileri `src/config/site.ts` dosyasından değiştirilir. Site farklı bir alan adına taşınırken `SITE_URL` ve `BASE_PATH` ortam değişkenleri ayarlanır.

## Güvenlik ve Veri

Depoya gerçek kişisel veri eklenmez. Demo paneli verileri yalnızca tarayıcıda tutar ve hiçbir sunucuya göndermez. Güvenlik açığı bildirimi için `SECURITY.md` dosyasına bakınız.

## Lisans

Tüm hakları saklıdır; ayrıntılar `LICENSE` dosyasındadır. Üçüncü taraf bileşenlerin lisansları `docs/ucuncu-taraf.md` dosyasında listelenir.
