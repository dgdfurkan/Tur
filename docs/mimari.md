# Mimari

Bu belge, sitenin nasıl kurulduğunu ve yeni bir özelliğin nereye ekleneceğini açıklar. Proje kuralları `CLAUDE.md`, sonraki aşamalar `docs/yol-haritasi.md` dosyasındadır.

## Genel Yapı

Site statiktir: Astro, derleme sırasında her sayfanın HTML çıktısını üretir ve sunucu tarafında çalışan kod bulunmaz. Etkileşimli bölümler (3D harita, rota simülasyonu, operasyon paneli, video stüdyosu) tarayıcıda, çatı kullanılmadan yazılmış TypeScript sınıflarıyla çalışır. Her bölüm yalnızca kendi sayfasında ve ihtiyaç duyulduğu anda yüklenir.

## Katmanlar

| Katman     | Klasör                                          | Sorumluluk                                                      | Bağımlı Olduğu Katman |
| ---------- | ----------------------------------------------- | --------------------------------------------------------------- | --------------------- |
| Alan       | `src/domain/`                                   | İş kuralları ve değer nesneleri; DOM'a ve çatıya bağımlı değil  | Yok                   |
| Uygulama   | `src/application/`                              | Kullanım senaryoları ve veri aktarım nesneleri                  | Alan                  |
| Altyapı    | `src/infrastructure/`                           | Alan arayüzlerinin uygulamaları: içerik, depolama, dışa aktarma | Alan, uygulama        |
| Özellikler | `src/features/`                                 | Tarayıcıda çalışan etkileşimli bölümler                         | Alan, uygulama, ortak |
| Sunum      | `src/components/`, `src/layouts/`, `src/pages/` | Astro bileşenleri ve sayfalar                                   | Tüm katmanlar         |
| Ortak      | `src/shared/`, `src/i18n/`, `src/config/`       | Biçimlendirme, arayüz metinleri, site ayarları                  | Alan                  |

Bağımlılık her zaman içeriye doğrudur; alan katmanı başka hiçbir katmanı tanımaz. Somut sınıflar yalnızca composition root'larda birbirine bağlanır: derleme tarafında `src/composition/catalog.ts`, tarayıcı tarafında her özelliğin `bootstrap.ts` dosyası. Bağımlılık enjeksiyonu için kütüphane kullanılmaz.

## Alan Modeli

| Sınıf                                   | Görev                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Tour`                                  | Bir turun günleri, durakları, konaklaması ve kalkışları; yol uzunluğu ve en yakın kalkış hesabı                         |
| `Stop`, `StopFact`, `SceneKey`          | Durak, durağa ait kısa bilgiler (rakım, yapım yılı gibi) ve durağın çiziminin anahtarı                                  |
| `rankSights`, `Tour.highlights()`       | Gezi noktalarını anlatılacak bilgisi en çok olandan başlayarak sıralar; tur sayfası ve kısa videolar bu sırayı kullanır |
| `Departure`, `Occupancy`                | Bir kalkışın kapasitesi, dolu koltukları ve doluluk düzeyi (yer var, son koltuklar, dolu)                               |
| `RoutePlan`                             | Durakların harita düzlemindeki yerleşimi, etap uzunlukları, bir durağın çevresindeki boşluk                             |
| `SeatLayout`                            | 2+1 ve 2+2 koltuk düzenleri                                                                                             |
| `Money`                                 | Kuruş cinsinden tamsayıyla tutulan para değeri                                                                          |
| `GeoPoint`, `MapProjection`             | Coğrafi konum, mesafe ve haritaya izdüşüm                                                                               |
| `Passenger`, `Phone`                    | Panel kaydı ve telefon numarası doğrulaması                                                                             |
| `Journey`, `Moment`, `totalsOf`         | Tamamlanan bir yolculuk, yolculuktan notlar ve yolculukların toplam misafir ve yol hesabı                               |
| `TourRepository`, `PassengerRepository` | Verinin nereden geldiğini gizleyen arayüzler                                                                            |

## Veri Akışı

Tur içerikleri `src/content/tours/*.json` dosyalarında tutulur ve `src/content.config.ts` içindeki şemayla derleme sırasında doğrulanır; hatalı içerik derlemeyi durdurur. `ContentTourRepository` bu içeriği alan nesnelerine çevirir. Tarayıcıda çalışan bölümler aynı veriyi sayfaya gömülen bir JSON anlık görüntüsünden (`TourSnapshot`) okur ve `toTour()` ile aynı alan nesnelerini kurar; böylece doluluk ve rota hesapları iki tarafta tek bir koddan yürür.

Geçmiş turlar `src/content/journeys/*.json`, sıkça sorulan sorular `src/content/faq.json` dosyasında tutulur ve aynı biçimde derleme sırasında doğrulanır. Bir yolculuk, turun o günkü adını, resmini, yolunu ve notlarını kendi kaydında saklar; turun programı sonradan değişse de geçmiş yolculuk değişmez.

Operasyon panelinin kayıtları `PassengerRepository` arayüzünün ardında durur. Bugünkü uygulama `LocalPassengerRepository` sınıfıdır ve kayıtları yalnızca tarayıcıda saklar; okunan her kayıt yeniden doğrulanır. Paylaşımlı sürümde aynı arayüzü uygulayan bir HTTP sınıfı yazılır, panelin geri kalanı değişmez.

## Harita

Harita verisi `scripts/build-map-data.ts` betiğiyle Natural Earth sınırlarından üretilir ve depoda tutulur; tarayıcıya harita kütüphanesi gönderilmez. 3D harita `src/features/map3d/` altındaki küçük sınıflardan oluşur:

| Sınıf                                      | Görev                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `MapWorld`                                 | Haritanın bileşenlerini bir araya getirir; aşamalı olarak kurulur               |
| `SceneManager`                             | Sahneyi çizer; sayfada `FrameLoop`, videoda kare kare ilerletilir               |
| `FrameLoop`                                | Çizim döngüsü; tuval görünmezken durur, kareler yavaşsa kaliteyi düşürür        |
| `MapSurface`                               | Haritanın çizildiği tuval ve etiket yüzeyi; videoda sabit boyutlu kare verir    |
| `TurkeyBoard`, `LandTexture`, `SeaTexture` | Boyanmış kara ve deniz yüzeyleri                                                |
| `Scenery`, `LandmarkFactory`               | Ağaç, dağ, peribacası gibi modeller; yeni model türü kayıtla eklenir            |
| `RouteTrack`, `StopMarkers`, `BusModel`    | Yol, durak işaretleri ve dönen tekerlekleriyle otobüs                           |
| `DustTrail`, `GroundDetail`                | Otobüsün ardındaki toz ve yakından görülen zemin dokusu; hız böyle hissedilir   |
| `CameraRig`                                | Kamerayı bir pozdan ötekine yumuşak biçimde taşır                               |
| `LabelLayer`                               | Yer adlarını tabela biçiminde yerleştirir ve çakışmaları giderir                |
| `LabelSurface`                             | Etiketlerin çizildiği yüzey: sayfada `DomLabels` (HTML), videoda `CanvasLabels` |
| `Daylight`                                 | Gün ışığı ile akşam ışığı arasında geçiş yapar                                  |
| `world.ts`                                 | Ölçek: otobüs, işaret ve yol, her yakınlıkta ekranda okunaklı boyutta kalır     |

### Harita Seçimi

`openGraphics()` WebGL 2 bağlamını açar ve çizimi yapan donanımı denetler. Grafik işlemcisi bulunan cihazlarda 3D harita, yazılımla çizim yapan cihazlarda düz SVG harita kullanılır; çünkü yazılımla çizimde her kare ana iş parçacığını bekletir. Adrese eklenen `?harita=3b` ve `?harita=duz` parametreleri, test ve destek amacıyla haritayı elle seçer.

## Rota Simülasyonu

| Sınıf                  | Görev                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| `RouteSimulation`      | Yolculuğun durum makinesi: sürüş, durakta bekleme, bitiş. Çizimden bağımsızdır   |
| `SimulationController` | Simülasyon olaylarını haritaya, panele ve sese aktarır; düğmeleri komuta çevirir |
| `RouteView`            | Haritadan beklenen davranışın arayüzü                                            |
| `ThreeRouteView`       | `RouteView` arayüzünün 3D uygulaması                                             |
| `FlatRouteView`        | `RouteView` arayüzünün SVG uygulaması                                            |
| `SimulationPanel`      | Durak kartı, düğmeler ve durak listesi; yalnızca DOM'u okur ve yazar             |
| `PlaceCard`            | Varılan yerin çizimi ve kısa bilgileri; masaüstünde haritanın sağında durur      |
| `BoardingPass`         | Biniş kartı, mühür ve kartın yırtılması                                          |
| `SoundKit`             | Motor, mühür, zımba ve varış seslerini Web Audio ile üretir; ses dosyası yoktur  |
| `SoundManager`         | Sesleri sayfada canlı olarak çalar; video aynı sesleri `SoundKit` ile kaydeder   |

Controller yalnızca `RouteView` arayüzünü tanır; hangi haritanın çizildiğini bilmez. Uçtan uca testler aynı senaryoyu iki haritada da çalıştırır. Son durağa varmak da, listeden son durağa atlamak da yolculuğu bitirir; bitişte kart turun kalkış tarihlerine bağlantı verir.

## Yer Çizimleri

Her durak `SceneKey` türünden bir çizim anahtarı taşır. Çizimler `src/components/scenes/art/` altında, 320 x 200 birimlik bir ızgara üzerinde SVG olarak yazılmıştır; bulut, ağaç, balon ve otobüs gibi ortak parçalar `parts/` altındadır.

- `SceneSprite`, sayfanın ihtiyaç duyduğu çizimleri bir kez `<symbol>` olarak ekler; `Scene`, bir çizimi `<use>` ile gösterir. Böylece bir çizim sayfada kaç kez görünürse görünsün HTML'e bir kez girer.
- `SceneSprite` içindeki tablo `Record<SceneKey, …>` türündedir; çizimi olmayan bir anahtar derlemeyi durdurur.
- Video stüdyosu aynı sembolleri `SceneImages` ile görüntüye çevirir; sayfadaki ve videodaki çizim aynıdır.

## Video Stüdyosu

Stüdyo, operasyon panelinin bir sekmesidir (`/yonetim/video/`) ve yalnızca panel açıldıktan sonra yüklenir. Video tarayıcıda, sayfadaki rota simülasyonunun sınıflarıyla çizilir.

| Sınıf          | Görev                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `Storyboard`   | Video türüne (tam yolculuk, gün, kısa tanıtım, rota çizimi) göre çekimleri ve sürelerini belirler |
| `FilmDirector` | Verilen andaki çekime göre `RouteView` arayüzü üzerinden kamerayı ve otobüsü yönetir              |
| `FilmOverlay`  | Verilen anda hangi tabelanın, kartın ve biniş kartının göründüğünü hesaplar; saf fonksiyondur     |
| `FilmPainter`  | Başlık, marka, yer kartı ve kapanış tabelalarını tuvale çizer                                     |
| `FilmStage`    | Haritayı kendi tuvalinde sabit boyutta çizer, etiketleri ve kaplamaları üzerine ekler             |
| `FilmMaker`    | Ön izlemeyi oynatır, videoyu kare kare üretir ve kaydediciye verir                                |
| `Mp4Recorder`  | `FilmRecorder` arayüzünün WebCodecs ve Mediabunny ile yazılmış uygulaması (H.264 ve AAC)          |

Kareler zamanla değil, sırayla üretilir: her kare için sahne sabit bir süre kadar ilerletilir. Bu nedenle 4K video yavaş bir cihazda daha uzun sürede hazırlanır, ancak hiçbir kare atlanmaz. Ses, `OfflineAudioContext` üzerinde aynı zaman çizelgesinden üretilir. Boyutlar mantıksal piksel cinsinden tanımlanır (Reels 360 x 640 gibi) ve kalite çarpanıyla büyütülür: 4K için 6, Full HD için 3, taslak için 2.

## Operasyon Paneli

Panel, telefonda kullanılmak üzere yazılmış bir uygulamadır. `PanelShell` kilit ekranını ve gezinmeyi kurar: telefonda alt sekme çubuğu, geniş ekranda yan menü. `/yonetim/` sayfasındaki bölümler (Özet, Turlar, Yolcular, Site) adresteki `#` işaretinden sonraki yolla seçilir; Video stüdyosu kendi sayfasındadır. Uygulamanın kodu ancak kilit açıldıktan sonra yüklenir.

| Sınıf veya Modül        | Görev                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `AdminApp`              | Adresi okuyup ekranı kurar; ileri, geri ve sekme geçişlerini görünüm geçişiyle canlandırır            |
| `routes.ts`             | Panelin bütün adresleri ve karşılık gelen ekranlar                                                    |
| `screens/`              | Her ekran, verisini servislerden okuyup her çizimde baştan kurar                                      |
| `ui/kit.ts`, `parts.ts` | Satır, grup, düğme, anahtar, koltuk planı, doluluk halkası gibi ortak parçalar                        |
| `Sheet`                 | Alttan açılan, aşağı çekilerek kapanan kipli pencere (`<dialog>`)                                     |
| `TourCatalogEditor`     | Yayınlanan turlar ile paneldeki değişiklikleri birleştirir; her değişikliği içerik şemasıyla denetler |
| `JourneyArchiveEditor`  | Geçmiş turlar için aynı işi yapar; panelde kaydedilen yeni yolculukları da tutar                      |
| `SiteSettingsService`   | Ana sayfa metni, duyuru, iletişim, marka ve gizlenen turlar                                           |
| `BookingService`        | Yolcu, kapora, kalan ödeme ve doluluk                                                                 |
| `PanelBackup`           | Cihazdaki bütün kayıtları tek JSON dosyasına yazar ve geri yükler                                     |

- Tur verisinin kuralları `src/application/dto/tourSchema.ts` dosyasındadır. İçerik dosyaları derleme sırasında, paneldeki değişiklikler kaydedilmeden önce aynı şemadan geçer; alan katmanının kendi denetimleri (tarih sırası, araçta olmayan koltuk) de uygulanır.
- Değişiklikler şimdilik cihazda taslak olarak tutulur. Her taslak, başladığı yayınlanmış turun parmak izini taşır; site sonradan güncellenirse panel bunu bildirir.
- Herkese açık sayfalar aynı cihazdaki panel kayıtlarını okuyup gösterir: `syncLocalChanges` fiyat, satılan koltuk, panel kaydı ve gizlenen turu; `applySiteSettings` marka adını, ana sayfa metnini, duyuru bandını ve iletişim bağlantılarını; `syncJourneys` gizlenen, değişen ve panelde kaydedilen geçmiş turları. Bu okumalar Zod kullanmaz; değerler sayfaya yalnızca metin ve öznitelik olarak yazılır, bağlantılar `contactLinks.ts` içindeki denetimden geçen değerlerden kurulur.
- `PanelLock`, girilen kodu PBKDF2 (SHA-256, 310.000 tur) ile anahtara çevirir ve anahtarın özetini sayfadaki parmak iziyle karşılaştırır. Kod rakamlardan oluşuyorsa telefon rakam klavyesini açar ve son rakamla birlikte gönderilir.
- `astro build --mode e2e` ile derlenen test sürümü herkese açık test koduyla açılır. Üretim derlemesinde bu dal derleme sırasında atılır.

## Hareket

- Animasyonlar yalnızca `transform` ve `opacity` üzerinden yürür; azaltılmış hareket tercihinde her animasyon durur veya son hâlinde gösterilir.
- Kaydırmaya bağlı hareketler (manzaranın katmanları, tur resimlerinin yaklaşması, günlük programda yolun çizilmesi, alt bilgideki otobüs) yalnızca CSS ile yazılır ve desteklemeyen tarayıcılarda son hâlinde durur. Bu kurallar `animation` kısaltmasıyla yazılmaz: derlemedeki küçültücü `animation-timeline` değerini kısaltmaya katar, tarayıcı da kuralı yok sayar. `tests/e2e/motion.spec.ts` bu davranışı derlenmiş site üzerinde denetler.
- Kaydırıldıkça gelen içerik `data-reveal` özniteliği taşır ve `watchReveals()` ile görünür yapılır. Başlangıç hâli yalnızca ekranda, betik çalışırken ve hareket tercih edilirken uygulanır; betik hiç çalışmazsa içerik beş saniye sonra kendiliğinden görünür.
- Ana sayfadaki manzara, ekran dışındayken durur (`data-paused`).

## SOLID İlkelerinin Uygulanışı

| İlke                            | Örnek                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Tek sorumluluk                  | Kamera, yol, otobüs, ses ve panel ayrı sınıflardır; simülasyon çizim hakkında bilgi taşımaz                    |
| Açık-kapalı                     | Yeni model türü `LandmarkFactory.register()` ile, yeni dışa aktarma biçimi `ListExporter` ile eklenir          |
| Yerine geçme                    | `ThreeRouteView` ile `FlatRouteView` aynı testlerden geçer; `DomLabels` ile `CanvasLabels` aynı yüzeyi uygular |
| Arayüz ayrımı                   | `Disposable` ve `Updatable` gibi küçük arayüzler kullanılır                                                    |
| Bağımlılığın tersine çevrilmesi | Panel `PassengerRepository`, controller `RouteView`, video `FilmRecorder` arayüzüne bağlıdır                   |

## Performans

Ölçümler derlenmiş site üzerinde, Lighthouse mobil ayarlarıyla alınmıştır.

| Ölçüt                           | Bütçe       | Ölçülen                                                |
| ------------------------------- | ----------- | ------------------------------------------------------ |
| İlk yüklenen JavaScript         | ≤ 30 KB gz  | En fazla 16 KB gz (rota sayfası), ana sayfada 10 KB gz |
| Stil dosyaları                  | ≤ 30 KB gz  | En fazla 10,4 KB gz (satır içi stiller dâhil)          |
| Yazı tipleri                    | ≤ 150 KB    | 80,5 KB (iki alt küme)                                 |
| 3D parçası (gecikmeli yüklenir) | ≤ 250 KB gz | 166 KB gz                                              |
| Lighthouse performans puanı     | ≥ 90        | 99-100                                                 |
| En büyük içerik boyaması (LCP)  | < 2 sn      | 1,5-1,8 sn                                             |
| Toplam engelleme süresi (TBT)   | < 200 ms    | 0-40 ms                                                |
| Düzen kayması (CLS)             | < 0,05      | 0                                                      |

Bu sonuçları sağlayan kararlar:

- Sayfanın metni ve statik haritası sunucu çıktısıyla gelir; 3D harita ilk boyamadan sonra kurulmaya başlar.
- Harita aşama aşama kurulur ve aşamalar arasında tarayıcıya söz verilir; dokular önceden yüklenir, shader'lar ilk kareden önce derlenir.
- Çizim döngüsü, tuval ekranda değilken veya sekme gizliyken durur.
- Animasyonlar yalnızca `transform` ve `opacity` üzerinden yürür; azaltılmış hareket tercihinde otobüs duraktan durağa adım adım ilerler.

Geliştirme bilgisayarında (Apple M1 Pro) simülasyon sırasında ölçülen kare süresi ortalama 16,7 ms'dir; bu, saniyede 60 kareye karşılık gelir. Telefonlarda ölçüm, yayın öncesi yapılacaklar arasındadır.

## Güvenlik

- İçerik Güvenliği Politikası her sayfada hash tabanlı üretilir; satır içi betik ve stil, `eval` ve üçüncü taraf kaynak yoktur.
- Trusted Types zorunludur ve hiçbir politikaya izin verilmez; destekleyen tarayıcılarda metin hiçbir yerde HTML'e veya koda dönüştürülemez.
- Değişken veri DOM'a yalnızca `textContent` ile yazılır. Sayfaya gömülen JSON içinde `<` karakteri kaçışlanır.
- Tarayıcı deposundan okunan her kayıt doğrulanır; bozuk kayıt yok sayılır.
- CSV dışa aktarımında formül olarak yorumlanabilecek hücreler etkisizleştirilir.
- Operasyon paneli başka bir sayfanın çerçevesi içinde çalışmaz.

Sınırlar ve sonraki adımlar `SECURITY.md` ile `docs/yol-haritasi.md` dosyalarındadır.

## Testler

| Tür             | Araç                       | Kapsam                                                                                                       |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Birim           | Vitest                     | Alan sınıfları, servisler, depolama, biçimlendirme, simülasyon durum makinesi, ölçek                         |
| Uçtan uca       | Playwright                 | Masaüstü ve telefon görünümünde sayfalar, iki haritada simülasyon, panel ve kilit senaryoları, video indirme |
| Hareket         | Playwright                 | Kaydırmaya bağlı hareketlerin derlenmiş sitede çalışması, azaltılmış harekette durması                       |
| Erişilebilirlik | axe                        | Tüm sayfalar ve panelin her sekmesi                                                                          |
| Politika        | Playwright konsol denetimi | Her sayfada konsol hatası ve güvenlik politikası ihlali bulunmaması                                          |

Uçtan uca testler geliştirme sunucusunda değil, `npm run test:e2e` komutunun `dist-e2e/` klasörüne derlediği test sürümü üzerinde çalışır; yayınlanacak `dist/` klasörüne dokunulmaz. axe, gördüğünü o anda boyandığı hâliyle değerlendirir. Bu nedenle sayfalar azaltılmış hareketle, haritalar ise etiketlerin belirmesi bittikten sonra denetlenir.

## Sık Yapılan İşler

- **Yeni Tur Ekleme:** `src/content/tours/` altına yeni bir JSON dosyası eklenir. Liste, tur sayfası, rota sayfası ve harita kendiliğinden güncellenir.
- **Geçmiş Tur Ekleme:** Panelde kaydedilir ya da `src/content/journeys/` altına `YYYY-AA-GG-tur-kimligi.json` adıyla eklenir. Arşiv, yolculuk sayfası, turun sayfası ve ana sayfa kendiliğinden güncellenir.
- **Soru Ekleme:** `src/content/faq.json` dosyasına `order` değeriyle eklenir; `featured` işaretli sorular ana sayfada, tur sayfalarında ve iletişim sayfasında da görünür.
- **Marka ve İletişim Bilgisi:** `src/config/site.ts` dosyasından değiştirilir.
- **Arayüz Metni:** `src/i18n/tr.ts` dosyasından değiştirilir; metinler `turkce-icerik-standardi` kurallarına uyar.
- **Harita Verisi:** `npm run map:build` komutuyla yeniden üretilir.
- **Yeni Depolama Biçimi:** `PassengerRepository` arayüzü uygulanır ve `src/features/admin/bootstrap.ts` içinde bağlanır.
- **Yeni Yer Çizimi:** Anahtar `SCENE_KEYS` listesine eklenir, çizim `src/components/scenes/art/` altına yazılır ve `SceneSprite` tablosuna bağlanır; derleme eksik bağlantıyı yakalar.
- **Panel Erişim Kodu:** `npm run panel:code` ile değiştirilir; ardından site yeniden derlenip yayınlanır.
