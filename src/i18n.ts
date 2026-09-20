export type Lang = 'id' | 'en';

export type StringKey =
  | 'title'
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
  | 'offlineReady'
  | 'downloadMap'
  | 'downloading'
  | 'mapReady'
  | 'dataAsOf'
  | 'statusOk'
  | 'statusAvoid'
  | 'themeToggle'
  | 'activeOk'
  | 'activeAvoid';

const STRINGS: Record<Lang, Record<StringKey, string>> = {
  id: {
    title: 'Gage Jakarta',
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
  },
  en: {
    title: 'Gage Jakarta',
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
  },
};

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[lang][key];
}
