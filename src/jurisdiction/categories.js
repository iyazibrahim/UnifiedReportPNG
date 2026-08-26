export const CATEGORIES = {
  kebersihan: {
    id: "kebersihan",
    label: "Kebersihan / sampah",
    owner: "pbt",
  },
  longkang_lokal: {
    id: "longkang_lokal",
    label: "Longkang / parit (lokal)",
    owner: "pbt",
  },
  banjir: {
    id: "banjir",
    label: "Banjir / saliran besar",
    owner: "epintas",
  },
  jalan: {
    id: "jalan",
    label: "Jalan berlubang / rosak",
    owner: "road",
  },
  lampu_jalan: {
    id: "lampu_jalan",
    label: "Lampu jalan / tiang lampu",
    owner: "road",
  },
  lampu_isyarat: {
    id: "lampu_isyarat",
    label: "Lampu isyarat / papan tanda",
    owner: "myjalan",
  },
  pokok: {
    id: "pokok",
    label: "Pokok",
    owner: "pbt",
  },
  kemudahan_awam: {
    id: "kemudahan_awam",
    label: "Kemudahan awam",
    owner: "pbt",
  },
  parkir: {
    id: "parkir",
    label: "Parkir / saman PBT",
    owner: "pbt",
  },
  binaan_haram: {
    id: "binaan_haram",
    label: "Binaan haram / premis",
    owner: "pbt",
  },
  bekalan_air: {
    id: "bekalan_air",
    label: "Bekalan air",
    owner: "pbapp",
  },
  lain_lain: {
    id: "lain_lain",
    label: "Lain-lain / tidak pasti",
    owner: "epintas",
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

export const AGENCIES = {
  pearl_mbpp: {
    id: "pearl_mbpp",
    label: "Pearl eAduan (MBPP)",
  },
  aspire_mbsp: {
    id: "aspire_mbsp",
    label: "Aspire eAduan (MBSP)",
  },
  myjalan: {
    id: "myjalan",
    label: "MyJalan (JKR / KKR)",
  },
  pbapp: {
    id: "pbapp",
    label: "PBAPP (Bekalan Air)",
  },
  epintas: {
    id: "epintas",
    label: "ePINTAS (PSUK)",
  },
};
