---
name: turkce-icerik-standardi
description: Sitedeki ve dokümanlardaki tüm Türkçe metinler için yazım ve üslup standardı (C1 düzeyinde resmî dil, TDK yazımı, başlıklarda büyük harf kuralı, devrik cümle ve uzun tire yasağı, tr-TR sayı, para, tarih ve saat biçimleri). Kullanıcıya görünen herhangi bir Türkçe metni yazarken, düzenlerken veya gözden geçirirken kullan; sayfa içeriği, düğme ve etiket metinleri, tur programları, hata mesajları, README ve docs buna dâhildir.
---

# Türkçe İçerik Standardı

Bu proje bir seyahat acentesinin vitrinidir. Metin, markanın güvenilirliğini taşır; yazım hatası veya özensiz bir cümle doğrudan güven kaybıdır. Bu yüzden her metin aşağıdaki kurallara uyar. Emin olunmayan her yazım `https://sozluk.gov.tr/gts?ara=<sözcük>` adresinden doğrulanır; tahmin yürütülmez.

## 1. Üslup

- Resmî ve ölçülü bir dil kullanılır; okura "siz" diye hitap edilir.
- Cümleler kurallıdır: yüklem sonda yer alır. Devrik cümle kurulmaz.
- Etken çatı ve kısa cümle tercih edilir. Bir cümle tek bir bilgi taşır.
- Ünlem işareti, emoji ve abartılı sıfat ("muhteşem", "eşsiz", "rüya gibi") kullanılmaz. Somut bilgi verilir: süre, mesafe, saat, fiyata dâhil hizmet.
- Okura yarar sağlamayan cümle yazılmaz. Dolgu ifadeleri ("bildiğiniz gibi", "aslında", "tabii ki") çıkarılır.
- Çeviri kokan kalıplardan kaçınılır: "olanak tanır" yerine eylemin kendisi yazılır.

| Yanlış | Doğru |
|---|---|
| Keşfedin Kapadokya'yı bizimle! | Kapadokya'yı deneyimli rehberlerimiz eşliğinde keşfedin. |
| Unutulmaz, rüya gibi bir tatil sizi bekliyor. | Üç günlük programda on durak ve iki gece konaklama yer alır. |
| Bu tur, misafirlerin dinlenmesine olanak tanır. | Bu turda her gün iki saat serbest zaman ayrılır. |

## 2. Başlıklar, Düğmeler ve Etiketler

- Başlıklarda, menü ögelerinde, düğmelerde ve form etiketlerinde her sözcük büyük harfle başlar: "Haftalık Rutin", "Yaklaşan Turlar", "Rotayı Ön İzle", "Simülasyonu Başlat".
- "ve", "ile", "veya", "ya da", "de", "ki", "mi" başta değilse küçük yazılır: "Kurumsal ve Okul Turları".
- Başlık sonuna nokta konmaz. Açıklama ve gövde metinleri normal cümle düzeninde yazılır.
- Tamamı büyük harfli metin elle ve doğru harflerle yazılır: "BİNİŞ ONAYLANDI", "ILGAZ". CSS `text-transform: uppercase` yalnızca `lang="tr"` altında kullanılır; JavaScript'te `toLocaleUpperCase('tr-TR')` çağrılır.

## 3. Noktalama ve Yazım

- Uzun tire (—) kullanılmaz. Açıklama için iki nokta veya virgül, aralık için kısa tire kullanılır: "16-18 Ekim 2026", "07.00-19.30".
- Özel adlara gelen ekler kesme işaretiyle ayrılır: "Ankara'dan", "Kapadokya'ya", "Tuz Gölü'nde". Kısaltmalara gelen ekler de ayrılır: "TÜRSAB'ın".
- Kurum ve kuruluş adlarına gelen ekler kesmeyle ayrılmaz: "Kültür ve Turizm Bakanlığının".
- Sayılara gelen ekler kesmeyle ayrılır: "2'nci gün", "16 Ekim 2026'da".
- Bağlaç olan "de/da" ve "ki" ile soru eki "mi" ayrı yazılır.
- Düzeltme işareti TDK'nin gösterdiği sözcüklerde kullanılır (aşağıdaki sözlüğe bakınız).
- Yer adlarında ikinci sözcük de büyük harfle başlar: "Ihlara Vadisi", "Göreme Açık Hava Müzesi", "Derinkuyu Yeraltı Şehri", "Uçhisar Kalesi".

## 4. Sayı, Para, Tarih ve Saat

| Tür | Biçim | Örnek | Kod |
|---|---|---|---|
| Sayı | Binlik ayırıcı nokta, ondalık virgül | 12.500 | `Intl.NumberFormat('tr-TR')` |
| Para | Simge önde, kuruşsuz | ₺12.500 | `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })` |
| Tarih | Gün, ay adı, yıl, gün adı; ay ve gün adı büyük harfle | 16 Ekim 2026 Cuma | `Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })` |
| Saat | Nokta ile | 07.00 | Elle biçimlendirilir; `Intl` iki nokta üretir |
| Yüzde | İşaret önde, bitişik | %71 | `Intl.NumberFormat('tr-TR', { style: 'percent' })` |
| Ölçü | Sayı ile birim arasında boşluk | 780 km | |
| Süre | Metinde küçük, başlıkta büyük | 2 gece 3 gün, "2 Gece 3 Gün" | |

Para hesapları kuruş cinsinden tamsayıyla yapılır; biçimlendirme yalnızca gösterim anında uygulanır.

## 5. Sözlük

Aşağıdaki yazımlar TDK Güncel Türkçe Sözlük'ten doğrulanmıştır.

| Doğru | Yanlış | Not |
|---|---|---|
| dâhil | dahil | "Fiyata Dâhil Olanlar" |
| güzergâh | güzergah | |
| ön izleme, ön izle | önizleme, önizle | Ayrı yazılır |
| günübirlik | günü birlik | Bitişik yazılır |
| tarihî | tarihi | "tarihî evler"; "tarihi" sözcüğü "onun tarihi" anlamına gelir |
| resmî | resmi | |
| mekân | mekan | |
| hâl, hâlihazırda | hal, halihazırda | Durum anlamında |
| kâğıt, dükkân, hikâye | kağıt, dükkan, hikaye | |
| peribacası | peri bacası | |
| yeraltı şehri | yer altı şehri | Sıfat bitişik, isim ayrı ("yer altı") yazılır |
| açık hava müzesi | açıkhava müzesi | |
| yurt içi, yurt dışı | yurtiçi, yurtdışı | |
| acente | acenta | Özel ad olan "Türkiye Seyahat Acentaları Birliği" hariç |
| yarım pansiyon | yarımpansiyon | |
| herhangi bir, her şey, bir şey, pek çok | herhangibir, herşey, birşey, pekçok | |
| birkaç, hiçbir | bir kaç, hiç bir | |
| e-posta | email, mail | |
| çevrim içi | online | |

## 6. Terim Birliği

Aynı kavram sitenin her yerinde aynı sözcükle anılır.

| Kavram | Kullanılacak terim |
|---|---|
| Turun gün gün akışı | Günlük Program |
| Uğranan yer | Durak |
| Yolculuğun başladığı yer | Kalkış Noktası |
| Otel bilgisi | Konaklama |
| Ücrete giren hizmetler | Fiyata Dâhil Olanlar |
| Ücrete girmeyen hizmetler | Fiyata Dâhil Olmayanlar |
| Satılan koltuk oranı | Doluluk |
| Boş koltuk sayısı | Kalan Koltuk |
| Koltukların dolu ve boş görünümü | Koltuk Durumu |
| Müşteriden önceden alınan tutar | Kapora (operasyon paneli), ön ödeme (müşteriye dönük metin) |
| Harita üzerindeki yol | Rota |
| Turu satın alan kişi | Misafir (site), yolcu (operasyon paneli) |

## 7. Kod ile Metnin Ayrımı

- Tanımlayıcılar, dosya adları ve kod yorumları İngilizcedir.
- Kullanıcıya görünen ortak metinler `src/i18n/tr.ts` dosyasında, tur içerikleri `src/content/tours/` altında tutulur. Bileşen içine dağınık metin yazılmaz.
- Kök öge `lang="tr"` taşır.

## 8. Teslim Öncesi Kontrol

1. Başlık, düğme ve etiketlerde her sözcük büyük harfle başlıyor mu?
2. Devrik cümle, ünlem, emoji veya uzun tire var mı?
3. Sözlükteki sözcükler doğru yazıldı mı (dâhil, güzergâh, ön izleme, tarihî)?
4. Özel adlara gelen ekler kesme işaretiyle ayrıldı mı?
5. Saatler noktayla, para ve tarihler tr-TR biçiminde mi?
6. Aynı kavram için tek terim mi kullanıldı?
7. Her cümle okura somut bir bilgi veriyor mu?
