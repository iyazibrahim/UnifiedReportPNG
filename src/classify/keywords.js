import { CATEGORIES } from "../jurisdiction/categories.js";

const RULES = [
  {
    id: "kebersihan",
    words: [
      "sampah",
      "rubbish",
      "garbage",
      "tong",
      "kutipan",
      "kotor",
      "litter",
      "waste",
    ],
  },
  {
    id: "longkang_lokal",
    words: ["longkang", "parit", "drain", "tersumbat", "clogged"],
  },
  {
    id: "banjir",
    words: ["banjir", "flood", "flash flood"],
  },
  {
    id: "jalan",
    words: [
      "lubang",
      "pothole",
      "berlubang",
      "jalan rosak",
      "road damage",
      "jalan pecah",
    ],
  },
  {
    id: "lampu_isyarat",
    words: [
      "lampu isyarat",
      "traffic light",
      "papan tanda",
      "signboard",
      "signboard",
    ],
  },
  {
    id: "lampu_jalan",
    words: ["lampu jalan", "street light", "tiang lampu", "gelap jalan"],
  },
  {
    id: "pokok",
    words: ["pokok", "tree", "dahan", "ranting"],
  },
  {
    id: "kemudahan_awam",
    words: [
      "taman",
      "playground",
      "pondok bas",
      "bus stop",
      "park",
      "padang",
    ],
  },
  {
    id: "parkir",
    words: ["parkir", "parking", "letak kereta", "saman parkir"],
  },
  {
    id: "binaan_haram",
    words: ["binaan haram", "illegal structure", "premis haram", "binaan tanpa"],
  },
  {
    id: "bekalan_air",
    words: [
      "paip",
      "bekalan air",
      "tiada air",
      "no water",
      "bocor air",
      "tekanan air",
      "water leak",
    ],
  },
];

export function classifyByKeywords(text) {
  const hay = String(text || "").toLowerCase();
  let best = { id: "lain_lain", score: 0 };
  for (const rule of RULES) {
    let score = 0;
    for (const word of rule.words) {
      if (hay.includes(word)) score += word.split(" ").length;
    }
    if (score > best.score) best = { id: rule.id, score };
  }

  if (best.score === 0) {
    return {
      categoryId: "lain_lain",
      categoryLabel: CATEGORIES.lain_lain.label,
      confidence: 0.2,
      method: "rules",
    };
  }

  return {
    categoryId: best.id,
    categoryLabel: CATEGORIES[best.id].label,
    confidence: Math.min(0.95, 0.55 + best.score * 0.1),
    method: "rules",
  };
}
