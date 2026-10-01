# Tur: Proje Kuralları

Ankara çıkışlı turlar için tanıtım sitesi, 3D rota simülasyonu ve operasyon paneli. Statik olarak derlenir ve GitHub Pages'te `https://dgdfurkan.github.io/Tur/` adresinde yayınlanır. Bu sürüm bir prototiptir; tur, fiyat ve konaklama bilgileri örnektir.

## Komutlar

| Komut                | İş                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`        | Geliştirme sunucusu (`http://localhost:4321/Tur/`)                                  |
| `npm run verify`     | `check` + `lint` + `test` + `build`; her teslimden önce çalıştırılır                |
| `npm run test:e2e`   | Test sürümünü `dist-e2e/` klasörüne derler ve Playwright'ı 4329 portunda çalıştırır |
| `npm run format`     | Prettier                                                                            |
| `npm run map:build`  | Harita verisini `world-atlas` kaynağından yeniden üretir                            |
| `npm run panel:code` | Operasyon panelinin erişim kodunu değiştirir                                        |

Astro 7, bir yapay zekâ ajanı algıladığında `dev` ve `preview` sunucusunu arka plana alır. Ön planda tutmak için `--ignore-lock` kullanılır (`.claude/launch.json` ve `playwright.config.ts` böyle ayarlıdır). Arka planda kalan sunucu `npx astro dev stop` veya `npx astro preview stop` ile durdurulur.

## Mimari

Bağımlılık yönü içeriye doğrudur: `features` ve `components` → `application` → `domain`. `infrastructure`, `domain` içindeki arayüzleri uygular.

- `src/domain/`: DOM'dan ve çatıdan bağımsız saf sınıflar ve değer nesneleri.
- `src/application/`: kullanım senaryolarını yürüten servisler.
- `src/infrastructure/`: repository implementasyonları, depolama, dışa aktarma.
- `src/features/`: etkileşimli özellikler (3D harita, rota simülasyonu, panel). Her özelliğin tek bir composition root'u bağımlılıkları elle kurar.
- `src/components/`, `src/layouts/`, `src/pages/`: Astro sunum katmanı.
- `src/content/tours/`: tur verisi; şema `src/content.config.ts` içindedir.
- `src/config/site.ts`: marka ve iletişim bilgisinin tek kaynağı. `src/config/paths.ts`: `pageUrl()` ve `assetUrl()`.
- Operasyon paneli `src/features/admin/` altındadır: ekranlar `screens/`, ortak arayüz parçaları `ui/kit.ts` ve `ui/parts.ts`, adresler `routes.ts`. Turlardaki değişiklikler `TourCatalogEditor` ile içerik şemasına göre denetlenerek tutulur.
- Zod yalnızca `src/application/zod.ts` üzerinden içe aktarılır; o dosya Zod'un `Function()` denemesini kapatır, aksi hâlde Trusted Types bunu engeller ve konsola hata yazar. Zod herkese açık sayfaların paketine girmez.

## Kod Kuralları

- TypeScript strict. `any`, `@ts-ignore`, ölü kod ve kullanılmayan soyutlama yasaktır.
- SOLID uygulanır: bir sınıf tek sorumluluk taşır; controller'lar somut sınıflara değil arayüzlere bağlanır; yeni tür eklemek mevcut kodu değiştirmeyi gerektirmez.
- Para `Money` değer nesnesiyle, kuruş cinsinden tamsayı olarak tutulur.
- İç bağlantılar her zaman `pageUrl()` ile üretilir; yol sabit yazılmaz (site `/Tur/` altında yayınlanır).
- Tanımlayıcılar ve yorumlar İngilizce, kullanıcıya görünen metin Türkçedir. Yorum yalnızca kodun söyleyemediği gerekçeyi açıklar.
- Yeni bağımlılık ancak gerekçesiyle eklenir.

## Metin Kuralları

Kullanıcıya görünen her Türkçe metin `.claude/skills/turkce-icerik-standardi/SKILL.md` kurallarına uyar: C1 düzeyinde resmî dil, TDK yazımı, başlıklarda her sözcük büyük harfle, devrik cümle ve uzun tire yok. Ortak arayüz metinleri `src/i18n/tr.ts` dosyasındadır.

## Performans Kuralları

- Animasyonlar yalnızca `transform` ve `opacity` üzerinden yürür. `prefers-reduced-motion` her animasyonda karşılanır.
- three.js yalnızca gereken sayfada ve lazy yüklenir; tuval görünmezken veya sekme gizliyken çizim döngüsü durur.
- 3D harita yalnızca grafik işlemcisiyle çizim yapan cihazlarda açılır; diğerlerinde düz SVG harita kullanılır (`src/shared/webgl.ts`). `?harita=3b` ve `?harita=duz` haritayı elle seçer. Başsız tarayıcı yazılımla çizer; 3D yolunu görmek için parametre veya `--use-angle=metal` gerekir.
- Haritaya eklenen her davranış `RouteView` arayüzünden geçer ve iki uygulamada da (`ThreeRouteView`, `FlatRouteView`) karşılanır.
- Kaydırmaya bağlı CSS animasyonları `animation` kısaltmasıyla yazılmaz; `animation-name`, `animation-timeline` gibi uzun adlar kullanılır. Küçültücü zaman çizelgesini kısaltmaya katar ve tarayıcı kuralı yok sayar (`tests/e2e/motion.spec.ts`).
- Kaydırıldıkça gelen içerik `data-reveal` özniteliğiyle işaretlenir; başlangıç hâli yalnızca ekranda, betik çalışırken ve hareket tercih edilirken uygulanır.
- Bütçe: ilk JS (3D hariç) ≤ 30 KB gz, CSS ≤ 30 KB gz, 3D parçası ≤ 250 KB gz; LCP < 2 sn, CLS < 0,05, INP < 150 ms.

## Güvenlik ve Veri Kuralları

- CSP `astro.config.ts` içindeki `security.csp` ile üretilir. Inline `style` özniteliği ve satır içi `<script>` yazılmaz; stil sınıfla veya CSSOM ile verilir.
- Dinamik veri DOM'a `textContent` ile yazılır; `innerHTML` kullanılmaz. CSP, Trusted Types'ı politikasız olarak zorunlu kılar; `innerHTML`, `eval` ve benzerleri çalışma anında hata verir.
- Üçüncü taraf istek, analitik ve CDN yoktur; yazı tipleri kendi sunucumuzdan gelir.
- Repo herkese açıktır. Gerçek kişisel veri, parola, anahtar veya iş ortaklarına dair iç bilgi commit'lenmez. Panel kayıtları yalnızca cihazda tutulur; localStorage anahtarları `tur-demo:v1:` önekiyle başlar.
- Panelin erişim kodu depoya yazılmaz; `npm run panel:code` yalnızca parmak izini (`src/config/panel-lock.json`) günceller. Üretilen kodun yazıldığı `erisim-kodu.txt` depoya eklenmez. Testler yalnızca `--mode e2e` derlemesinin tanıdığı herkese açık test kodunu kullanır.
- Panele ve video stüdyosuna sitenin hiçbir sayfasından bağlantı verilmez.
- Tüm sayfalar `noindex` taşır; site gerçek içerikle yayına alınırken kaldırılır.

## Skill Kullanımı

| İş              | Skill                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Türkçe metin    | `turkce-icerik-standardi`                                                                        |
| Arayüz tasarımı | `frontend-design`, `high-end-visual-design`, `ui-ux-pro-max`, `emil-design-eng`, `mobile-native` |
| Arayüz denetimi | `web-design-guidelines`, `accessibility`                                                         |
| Animasyon       | `gsap-*`, `animate`, `review-animations`, `fixing-motion-performance`                            |
| 3D              | `threejs-*`                                                                                      |
| Performans      | `performance`, `core-web-vitals`, `web-quality-audit`                                            |
| Güvenlik        | `security-and-hardening`, `security-review`                                                      |
| Test            | `playwright-best-practices`                                                                      |

## Git

Conventional Commits kullanılır. İlk kurulum dışındaki işler dal ve PR ile ilerler.
