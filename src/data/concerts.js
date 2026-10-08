/**
 * Event facts checked against public sources on 29 September 2026.
 * Ticket inventory and prices are intentionally not treated as immutable.
 */
export const concerts = [
  {
    id: 'gone-fludd-spb-2026',
    artist: 'GONE.Fludd',
    city: 'Санкт-Петербург',
    date: '2026-11-27',
    time: '20:00',
    endTime: '22:00',
    venue: 'СК «Юбилейный»',
    address: 'просп. Добролюбова, 18',
    metro: 'Спортивная',
    ageLimit: '16+',
    duration: 'около 2 часов',
    priceFrom: 2700,
    priceNote: '2 700–8 200 ₽ · проверено 30.09.2026',
    status: 'on-sale',
    statusLabel: 'Билеты доступны (на момент проверки)',
    theme: 'goneFludd',
    image: '/assets/concert-gone-fludd.png',
    audioPreview: {
      title: "BOYS DON'T CRY",
      source: 'Apple Music Preview',
      trackUrl: 'https://music.apple.com/us/album/boys-dont-cry/1650816267?i=1650816280&uo=4',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/11/ce/a7/11cea7a9-1eda-5cff-a17b-f7ef08b62321/mzaf_13520549601727969425.plus.aac.p.m4a',
    },
    seatMap: {
      type: 'unavailable',
      selectionMode: 'unavailable',
      available: false,
      label: 'Выбор зоны намеренно отключён в этой версии открытки — билет создаётся без места.',
      source: 'https://spb.kassir.ru/koncert/gonefludd',
      sourceLabel: 'Открыть актуальную схему у оператора',
      sourceNote: 'Актуальные категории, наличие и схема проверяются только в динамическом интерфейсе билетного оператора.',
    },
    officialSource: 'https://gonefludd.com/spb',
    ticketSource: 'https://spb.kassir.ru/koncert/gonefludd',
    corroboratingSource: 'https://www.afisha.ru/concert/gone-fludd-6035734/',
    sourceNote:
      'Официальная страница GLAM GO и Kassir.ru совпадают по дате, времени и площадке; цены и наличие могут измениться.',
  },
  {
    id: 'dark-prince-spb-2027',
    artist: 'Тёмный принц',
    city: 'Санкт-Петербург',
    date: '2027-02-14',
    time: '20:00',
    venue: 'Temple of Deer',
    address: 'Арсенальная наб., 1',
    metro: 'Площадь Ленина',
    ageLimit: '16+',
    duration: null,
    priceFrom: 2800,
    priceNote: 'Актуальную цену уточняйте у билетного оператора',
    status: 'announced',
    statusLabel: 'Анонсировано; билетная ссылка активна',
    theme: 'darkPrince',
    image: '/assets/concert-dark-prince.png',
    audioPreview: {
      title: 'утекай',
      source: 'Apple Music Preview',
      trackUrl: 'https://music.apple.com/us/album/%D1%83%D1%82%D0%B5%D0%BA%D0%B0%D0%B9/6788463007?i=6788463411&uo=4',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ba/00/81/ba0081fc-53cb-f12c-3134-bdd977fd3797/mzaf_1051806525373217507.plus.aac.p.m4a',
    },
    seatMap: {
      type: 'unavailable',
      selectionMode: 'unavailable',
      available: false,
      label: 'Актуальная схема зала и категории мест для этого выступления оператором ещё не опубликованы.',
    },
    officialSource: 'https://fleekmedia.ru/darkprince',
    tourSource: 'https://militantum.ru/',
    ticketSource:
      'https://afisha.yandex.ru/saint-petersburg/concert/temnyy-prints-tour?filterDates=2027-02-14%2C+1&filterDict=date%3D2027-02-14%26period%3D1&refererSurface=selection-events',
    corroboratingSource:
      'https://afisha.yandex.ru/saint-petersburg/concert/places/temple-of-deer/schedule',
    sourceNote:
      '14.02.2027 20:00 подтверждается организатором/букингом, Яндекс Афишей и расписанием площадки. Встречаются устаревшие зеркала с 13.02 21:00 — перед покупкой сверить у оператора.',
  },
];

export const researchCheckedAt = '2026-09-29';
