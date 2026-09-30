/**
 * Shared interface copy. Every string follows the project's Turkish content
 * standard (.claude/skills/turkce-icerik-standardi): formal register, TDK
 * spelling, title case for headings, buttons and labels.
 */
export const tr = {
  nav: {
    label: 'Ana Menü',
    tours: 'Turlar',
    corporate: 'Kurumsal',
    contact: 'İletişim',
    openMenu: 'Menüyü Aç',
    closeMenu: 'Menüyü Kapat',
    skipToContent: 'İçeriğe Geç',
    home: 'Ana Sayfa',
  },
  actions: {
    browseTours: 'Turları İncele',
    allTours: 'Tüm Turlar',
    previewRoute: 'Rotayı Ön İzle',
    viewTour: 'Turu İncele',
    startSimulation: 'Simülasyonu Başlat',
    contactUs: 'İletişime Geçin',
    backToTour: 'Tur Sayfasına Dön',
  },
  tour: {
    perPerson: 'Kişi Başı',
    singleSupplement: 'Tek Kişilik Oda Farkı',
    duration: 'Süre',
    departurePoint: 'Kalkış Noktası',
    departureTime: 'Kalkış Saati',
    stops: 'Durak',
    routeLength: 'Toplam Yol',
    nextDeparture: 'En Yakın Kalkış',
    departures: 'Kalkış Tarihleri',
    itinerary: 'Günlük Program',
    lodging: 'Konaklama',
    included: 'Fiyata Dâhil Olanlar',
    excluded: 'Fiyata Dâhil Olmayanlar',
    seatStatus: 'Koltuk Durumu',
    occupancy: 'Doluluk',
    remainingSeats: 'Kalan Koltuk',
    soldOut: 'Kontenjan Doldu',
    lastSeats: 'Son Koltuklar',
    seatsAvailable: 'Yer Var',
    noDepartures: 'Yeni kalkış tarihleri yakında açıklanacaktır.',
    day: 'Gün',
    samplePrice: 'Örnek fiyattır.',
    approximately: 'yaklaşık',
    nightsUnit: 'gece',
    seatFree: 'Boş',
    seatTaken: 'Dolu',
    front: 'Ön',
    door: 'Kapı',
  },
  categories: {
    all: 'Tümü',
    kultur: 'Kültür',
    doga: 'Doğa',
    gunubirlik: 'Günübirlik',
  },
  footer: {
    prototypeNote:
      'Bu sürüm tanıtım amaçlı bir prototiptir; tur, fiyat ve konaklama bilgileri örnek niteliğindedir.',
    licensePending: 'TÜRSAB belge numarası yayın öncesinde eklenecektir.',
    rights: 'Tüm hakları saklıdır.',
  },
  contact: {
    pending: 'Yayın öncesinde eklenecektir.',
    phone: 'Telefon',
    whatsapp: 'WhatsApp',
    email: 'E-posta',
    address: 'Adres',
    hours: 'Çalışma Saatleri',
  },
} as const;

export const categoryLabels = {
  kultur: tr.categories.kultur,
  doga: tr.categories.doga,
  gunubirlik: tr.categories.gunubirlik,
} as const;
