export type Lang = 'id' | 'en';

export type StringKey =
  | 'title'
  | 'tagline'
  | 'odd'
  | 'even'
  | 'active'
  | 'inactive'
  | 'holiday'
  | 'weekend'
  | 'hours'
  | 'follow'
  | 'stopFollow'
  | 'alertEnter'
  | 'gpsDenied'
  | 'offlineReady'
  | 'downloadMap'
  | 'downloading'
  | 'mapReady'
  | 'dataAsOf'
  | 'statusOk'
  | 'statusAvoid'
  | 'themeToggle'
  | 'activeOk'
  | 'activeAvoid'
  | 'storageLow'
  | 'downloadFailed'
  | 'shellReady'
  | 'layers'
  | 'layerGage'
  | 'layerMrt'
  | 'layerLrt'
  | 'layerKrl'
  | 'layerTransjakarta'
  | 'layerParkRide'
  | 'layerToll'
  | 'layerFlood'
  | 'layerRestrictions'
  | 'legend'
  | 'close'
  | 'about'
  | 'dataSources'
  | 'privacy'
  | 'reportData'
  | 'share'
  | 'shareCopied'
  | 'search'
  | 'searchPlaceholder'
  | 'noResults'
  | 'north'
  | 'onboardTitle1'
  | 'onboardTitle2'
  | 'onboardTitle3'
  | 'onboardBody1'
  | 'onboardBody2'
  | 'onboardBody3'
  | 'next'
  | 'skip'
  | 'done'
  | 'exemptions'
  | 'exemptionsBody'
  | 'installHint'
  | 'more'
  | 'switchToEn'
  | 'switchToId'
  | 'groupRules'
  | 'groupTransit'
  | 'groupRoad'
  | 'groupHazard'
  | 'whatItIsBody1'
  | 'whatItIsBody2'
  | 'needsReview'
  | 'sourceLink'
  | 'attributionText'
  | 'disclaimer'
  | 'privacyBody'
  | 'installHintIOS'
  | 'installHintAndroid'
  | 'dataSourceHolidays'
  | 'dataSourceBasemap';

export const STRINGS: Record<Lang, Record<StringKey, string>> = {
  id: {
    title: 'Jalanin',
    tagline: 'Gage, tol, banjir, MRT — sekali lihat.',
    odd: 'Ganjil',
    even: 'Genap',
    active: 'Gage aktif',
    inactive: 'Gage tidak aktif',
    holiday: 'Libur',
    weekend: 'Akhir pekan',
    hours: '06–10 & 16–21',
    follow: 'Ikuti posisi',
    stopFollow: 'Berhenti ikuti',
    alertEnter: 'Masuk jalur gage: {road}',
    gpsDenied: 'Akses lokasi ditolak. Aktifkan GPS untuk mengikuti posisi.',
    offlineReady: 'Peta siap offline',
    downloadMap: 'Unduh peta Jakarta untuk offline',
    downloading: 'Mengunduh peta…',
    mapReady: 'Peta siap',
    dataAsOf: 'Data: Dishub DKI, Sep 2026',
    statusOk: 'Aman, pelat boleh lewat',
    statusAvoid: 'Hindari, kena gage',
    themeToggle: 'Ganti tema',
    activeOk: 'Gage aktif · boleh lewat',
    activeAvoid: 'Gage aktif · hindari',
    storageLow: 'Ruang penyimpanan tidak cukup untuk peta offline',
    downloadFailed: 'Unduh peta gagal. Coba lagi.',
    shellReady: 'Aplikasi siap offline',
    layers: 'Layer',
    layerGage: 'Ganjil-genap',
    layerMrt: 'MRT',
    layerLrt: 'LRT',
    layerKrl: 'KRL',
    layerTransjakarta: 'Transjakarta',
    layerParkRide: 'Park & ride',
    layerToll: 'Tol',
    layerFlood: 'Banjir',
    layerRestrictions: 'Larangan',
    legend: 'Keterangan',
    close: 'Tutup',
    about: 'Tentang',
    dataSources: 'Sumber data',
    privacy: 'Privasi',
    reportData: 'Lapor data salah',
    share: 'Bagikan',
    shareCopied: 'Tautan disalin',
    search: 'Cari',
    searchPlaceholder: 'Cari jalan atau stasiun',
    noResults: 'Tidak ada hasil',
    north: 'Utara',
    onboardTitle1: 'Cek gage sekali lihat',
    onboardTitle2: 'Izinkan lokasi',
    onboardTitle3: 'Unduh untuk offline',
    onboardBody1: 'Peta menunjukkan jalan ganjil-genap yang aktif sekarang.',
    onboardBody2: 'Lokasi menandai posisi dan arahmu, tidak dikirim ke server mana pun.',
    onboardBody3: 'Simpan peta Jakarta agar tetap jalan tanpa internet.',
    next: 'Lanjut',
    skip: 'Lewati',
    done: 'Selesai',
    exemptions: 'Pengecualian',
    exemptionsBody: 'Kendaraan tertentu bebas gage, misalnya ambulans dan mobil listrik.',
    installHint: 'Tambahkan ke layar utama untuk akses offline.',
    more: 'Lainnya',
    switchToEn: 'Switch to English',
    switchToId: 'Ganti ke Bahasa Indonesia',
    groupRules: 'Aturan',
    groupTransit: 'Transportasi umum',
    groupRoad: 'Jalan',
    groupHazard: 'Bahaya',
    whatItIsBody1:
      'Jalanin menunjukkan gage, jalur transit, dan data jalan Jakarta dalam satu peta.',
    whatItIsBody2: 'Data berasal dari OpenStreetMap dan sumber resmi, diperbarui berkala.',
    needsReview: 'Perlu dicek',
    sourceLink: 'Sumber',
    attributionText:
      'Peta: © kontributor OpenStreetMap (ODbL), Protomaps. Data: Dishub DKI, KAI Commuter, MRT Jakarta, LRT, Transjakarta.',
    disclaimer: 'Bukan sumber resmi. Cek rambu di jalan.',
    privacyBody: 'Tidak ada pelacakan. Server hanya menyimpan log akses nginx.',
    installHintIOS: 'iOS: Bagikan → Tambah ke Layar Utama',
    installHintAndroid: 'Android: Pasang aplikasi',
    dataSourceHolidays: 'Hari libur nasional',
    dataSourceBasemap: 'Peta dasar',
  },
  en: {
    title: 'Jalanin',
    tagline: 'Odd-even, tolls, floods, MRT — one glance.',
    odd: 'Odd',
    even: 'Even',
    active: 'Gage active',
    inactive: 'Gage inactive',
    holiday: 'Holiday',
    weekend: 'Weekend',
    hours: '06:00–10:00 & 16:00–21:00',
    follow: 'Follow me',
    stopFollow: 'Stop following',
    alertEnter: 'Entering gage road: {road}',
    gpsDenied: 'Location access denied. Enable GPS to follow your position.',
    offlineReady: 'Map ready offline',
    downloadMap: 'Download Jakarta map for offline use',
    downloading: 'Downloading map…',
    mapReady: 'Map ready',
    dataAsOf: 'Data: Dishub DKI, Sep 2026',
    statusOk: 'Clear, your plate can pass',
    statusAvoid: 'Avoid, this hits the gage rule',
    themeToggle: 'Switch theme',
    activeOk: 'Gage active · you can pass',
    activeAvoid: 'Gage active · avoid',
    storageLow: 'Not enough storage for the offline map',
    downloadFailed: 'Map download failed. Try again.',
    shellReady: 'App ready offline',
    layers: 'Layers',
    layerGage: 'Odd-even',
    layerMrt: 'MRT',
    layerLrt: 'LRT',
    layerKrl: 'KRL',
    layerTransjakarta: 'Transjakarta',
    layerParkRide: 'Park & ride',
    layerToll: 'Toll',
    layerFlood: 'Flood',
    layerRestrictions: 'Restrictions',
    legend: 'Legend',
    close: 'Close',
    about: 'About',
    dataSources: 'Data sources',
    privacy: 'Privacy',
    reportData: 'Report bad data',
    share: 'Share',
    shareCopied: 'Link copied',
    search: 'Search',
    searchPlaceholder: 'Search a road or station',
    noResults: 'No results',
    north: 'North',
    onboardTitle1: 'Check gage at a glance',
    onboardTitle2: 'Allow location',
    onboardTitle3: 'Download for offline',
    onboardBody1: 'The map shows which odd-even roads are active right now.',
    onboardBody2: 'Location marks your position and heading; it never leaves your phone.',
    onboardBody3: 'Save the Jakarta map so it still works without internet.',
    next: 'Next',
    skip: 'Skip',
    done: 'Done',
    exemptions: 'Exemptions',
    exemptionsBody: 'Some vehicles are exempt from gage, like ambulances and electric cars.',
    installHint: 'Add to your home screen for offline access.',
    more: 'More',
    switchToEn: 'Switch to English',
    switchToId: 'Switch to Indonesian',
    groupRules: 'Rules',
    groupTransit: 'Transit',
    groupRoad: 'Road',
    groupHazard: 'Hazard',
    whatItIsBody1: 'Jalanin shows gage, transit lines, and Jakarta road data on one map.',
    whatItIsBody2: 'Data comes from OpenStreetMap and official sources, updated regularly.',
    needsReview: 'Needs review',
    sourceLink: 'Source',
    attributionText:
      'Map: © OpenStreetMap contributors (ODbL), Protomaps. Data: Dishub DKI, KAI Commuter, MRT Jakarta, LRT, Transjakarta.',
    disclaimer: 'Not an official source. Check the signs on the road.',
    privacyBody: 'No tracking. The server only keeps nginx access logs.',
    installHintIOS: 'iOS: Share → Add to Home Screen',
    installHintAndroid: 'Android: Install app',
    dataSourceHolidays: 'National holidays',
    dataSourceBasemap: 'Basemap',
  },
};

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[lang][key];
}
