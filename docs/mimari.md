# Mimari

Bu belge, sitenin nasıl kurulduğunu ve yeni bir özelliğin nereye ekleneceğini açıklar. Proje kuralları `CLAUDE.md`, sonraki aşamalar `docs/yol-haritasi.md` dosyasındadır.

## Genel Yapı

Site statiktir: Astro, derleme sırasında her sayfanın HTML çıktısını üretir ve sunucu tarafında çalışan kod bulunmaz. Etkileşimli bölümler (3D harita, rota simülasyonu, operasyon paneli) tarayıcıda, çatı kullanılmadan yazılmış TypeScript sınıflarıyla çalışır. Her bölüm yalnızca kendi sayfasında ve ihtiyaç duyulduğu anda yüklenir.

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

| Sınıf                                   | Görev                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Tour`                                  | Bir turun günleri, durakları, konaklaması ve kalkışları; yol uzunluğu ve en yakın kalkış hesabı |
| `Departure`, `Occupancy`                | Bir kalkışın kapasitesi, dolu koltukları ve doluluk düzeyi (yer var, son koltuklar, dolu)       |
| `RoutePlan`                             | Durakların harita düzlemindeki yerleşimi, etap uzunlukları, bir durağın çevresindeki boşluk     |
| `SeatLayout`                            | 2+1 ve 2+2 koltuk düzenleri                                                                     |
| `Money`                                 | Kuruş cinsinden tamsayıyla tutulan para değeri                                                  |
| `GeoPoint`, `MapProjection`             | Coğrafi konum, mesafe ve haritaya izdüşüm                                                       |
| `Passenger`, `Phone`                    | Panel kaydı ve telefon numarası doğrulaması                                                     |
| `TourRepository`, `PassengerRepository` | Verinin nereden geldiğini gizleyen arayüzler                                                    |

## Veri Akışı

Tur içerikleri `src/content/tours/*.json` dosyalarında tutulur ve `src/content.config.ts` içindeki şemayla derleme sırasında doğrulanır; hatalı içerik derlemeyi durdurur. `ContentTourRepository` bu içeriği alan nesnelerine çevirir. Tarayıcıda çalışan bölümler aynı veriyi sayfaya gömülen bir JSON anlık görüntüsünden (`TourSnapshot`) okur ve `toTour()` ile aynı alan nesnelerini kurar; böylece doluluk ve rota hesapları iki tarafta tek bir koddan yürür.

Operasyon panelinin kayıtları `PassengerRepository` arayüzünün ardında durur. Bugünkü uygulama `LocalPassengerRepository` sınıfıdır ve kayıtları yalnızca tarayıcıda saklar; okunan her kayıt yeniden doğrulanır. Paylaşımlı sürümde aynı arayüzü uygulayan bir HTTP sınıfı yazılır, panelin geri kalanı değişmez.

## Harita

Harita verisi `scripts/build-map-data.ts` betiğiyle Natural Earth sınırlarından üretilir ve depoda tutulur; tarayıcıya harita kütüphanesi gönderilmez. 3D harita `src/features/map3d/` altındaki küçük sınıflardan oluşur:

| Sınıf                                      | Görev                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `MapWorld`                                 | Haritanın bileşenlerini bir araya getirir; aşamalı olarak kurulur            |
| `SceneManager`                             | Çizim döngüsü; tuval görünmezken durur, kareler yavaşsa kaliteyi düşürür     |
| `TurkeyBoard`, `LandTexture`, `SeaTexture` | Boyanmış kara ve deniz yüzeyleri                                             |
| `Scenery`, `LandmarkFactory`               | Ağaç, dağ, peribacası gibi modeller; yeni model türü kayıtla eklenir         |
| `RouteTrack`, `StopMarkers`, `BusModel`    | Yol, durak işaretleri ve otobüs                                              |
| `CameraRig`                                | Kamerayı bir pozdan ötekine yumuşak biçimde taşır                            |
| `LabelLayer`                               | Yer adlarını tabela biçiminde HTML olarak yerleştirir ve çakışmaları giderir |
| `Daylight`                                 | Gün ışığı ile akşam ışığı arasında geçiş yapar                               |
| `world.ts`                                 | Ölçek: otobüs, işaret ve yol, her yakınlıkta ekranda okunaklı boyutta kalır  |

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
| `BoardingPass`         | Biniş kartı, mühür ve kartın yırtılması                                          |
| `SoundManager`         | Motor ve mühür sesleri; ses dosyası yoktur, sesler Web Audio ile üretilir        |

Controller yalnızca `RouteView` arayüzünü tanır; hangi haritanın çizildiğini bilmez. Uçtan uca testler aynı senaryoyu iki haritada da çalıştırır.

## SOLID İlkelerinin Uygulanışı

| İlke                            | Örnek                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Tek sorumluluk                  | Kamera, yol, otobüs, ses ve panel ayrı sınıflardır; simülasyon çizim hakkında bilgi taşımaz           |
| Açık-kapalı                     | Yeni model türü `LandmarkFactory.register()` ile, yeni dışa aktarma biçimi `ListExporter` ile eklenir |
| Yerine geçme                    | `ThreeRouteView` ile `FlatRouteView` aynı testlerden geçer                                            |
| Arayüz ayrımı                   | `Disposable` ve `Updatable` gibi küçük arayüzler kullanılır                                           |
| Bağımlılığın tersine çevrilmesi | Panel `PassengerRepository`, controller `RouteView` arayüzüne bağlıdır                                |

## Performans

Ölçümler derlenmiş site üzerinde, Lighthouse mobil ayarlarıyla alınmıştır.

| Ölçüt                           | Bütçe       | Ölçülen                |
| ------------------------------- | ----------- | ---------------------- |
| İlk yüklenen JavaScript         | ≤ 30 KB gz  | En fazla 6,2 KB gz     |
| Stil dosyaları                  | ≤ 30 KB gz  | En fazla 8 KB gz       |
| Yazı tipleri                    | ≤ 150 KB    | 80,5 KB (iki alt küme) |
| 3D parçası (gecikmeli yüklenir) | ≤ 250 KB gz | 149 KB gz              |
| Lighthouse performans puanı     | ≥ 90        | 97-100                 |
| En büyük içerik boyaması (LCP)  | < 2 sn      | 1,5-1,8 sn             |
| Düzen kayması (CLS)             | < 0,05      | 0                      |

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

| Tür             | Araç                       | Kapsam                                                                               |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| Birim           | Vitest                     | Alan sınıfları, servisler, depolama, biçimlendirme, simülasyon durum makinesi, ölçek |
| Uçtan uca       | Playwright                 | Masaüstü ve telefon görünümünde sayfalar, iki haritada simülasyon, panel senaryoları |
| Erişilebilirlik | axe                        | Tüm sayfalar ve panelin her sekmesi                                                  |
| Politika        | Playwright konsol denetimi | Her sayfada konsol hatası ve güvenlik politikası ihlali bulunmaması                  |

Uçtan uca testler geliştirme sunucusunda değil, derlenmiş site üzerinde çalışır.

## Sık Yapılan İşler

- **Yeni Tur Ekleme:** `src/content/tours/` altına yeni bir JSON dosyası eklenir. Liste, tur sayfası, rota sayfası ve harita kendiliğinden güncellenir.
- **Marka ve İletişim Bilgisi:** `src/config/site.ts` dosyasından değiştirilir.
- **Arayüz Metni:** `src/i18n/tr.ts` dosyasından değiştirilir; metinler `turkce-icerik-standardi` kurallarına uyar.
- **Harita Verisi:** `npm run map:build` komutuyla yeniden üretilir.
- **Yeni Depolama Biçimi:** `PassengerRepository` arayüzü uygulanır ve `src/features/admin/bootstrap.ts` içinde bağlanır.
