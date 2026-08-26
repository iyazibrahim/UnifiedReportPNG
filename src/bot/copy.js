export function emptyDraft() {
  return {
    text: "",
    photoFileIds: [],
    askedPhoto: false,
    location: null,
    classification: null,
    jurisdiction: null,
  };
}

export const MSG = {
  welcome: [
    "Salam. Ini saluran aduan bersatu Pulau Pinang (MVP Telegram).",
    "",
    "Hantar:",
    "1) keterangan masalah",
    "2) foto (kalau ada)",
    "3) lokasi (kongsi GPS atau pilih pada peta)",
    "",
    "Tak perlu app baru. WhatsApp akan datang kemudian.",
    "Taip /status untuk semak aduan anda.",
  ].join("\n"),
  askPhoto: "Ada foto? Hantar gambar, atau tekan Tiada foto.",
  askLocation:
    "Sila kongsi lokasi GPS, atau pilih titik pada peta (Choose location). Pin pada peta adalah lokasi sebenar — nama jalan mungkin jalan besar berdekatan.",
  coarseGps:
    "GPS kurang tepat (lebih 80 m). Sila pilih lokasi pada peta (ikon 📎 → Location → Choose this location).",
  askLandmark: "Tulis landmark ringkas, cth: hadapan 7-Eleven / tiang lampu no. 12",
  cancelled: "Aduan dibatalkan. Hantar keterangan baru untuk mula semula.",
  needText: "Sila hantar keterangan masalah dahulu (teks atau caption pada foto).",
  needLocation: "Sila hantar lokasi dulu (kongsi atau pilih pada peta).",
};

export function previewMessage(draft) {
  const j = draft.jurisdiction;
  const c = draft.classification;
  const triage = j.needsTriage
    ? "\n\nNota: kes ini ditanda triaj (agensi mungkin perlu semak semula)."
    : "";
  return [
    "Ringkasan aduan:",
    `Kategori: ${c.categoryLabel}`,
    `Agensi: ${j.agencyLabel}`,
    `Kenapa: ${j.reason}`,
    triage,
    "",
    "Tekan Hantar untuk teruskan (MVP: tiket agensi adalah simulasi).",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

export function submittedMessage(caseDoc) {
  const triage = caseDoc.jurisdiction?.needsTriage
    ? "\nStatus: triaj ePINTAS / semakan lanjut."
    : "";
  return [
    "Aduan dihantar.",
    "",
    `Rujukan: ${caseDoc.ref}`,
    `Agensi: ${caseDoc.jurisdiction.agencyLabel}`,
    `Tiket mock: ${caseDoc.dispatch.externalRef}`,
    triage,
    "",
    "(Ini MVP — tiket agensi adalah simulasi sehingga API rasmi disambung.)",
  ].join("\n");
}
