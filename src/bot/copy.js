export function emptyDraft() {
  return {
    text: "",
    photoFileIds: [],
    askedPhoto: false,
    location: null,
    classification: null,
    jurisdiction: null,
    geocodeFails: 0,
    forceTriage: false,
  };
}

const STATUS_BM = {
  received: "Diterima",
  in_progress: "Dalam tindakan",
  resolved: "Selesai",
  rejected: "Ditolak",
};

export const MSG = {
  welcome: [
    "Assalamualaikum / Selamat sejahtera.",
    "",
    "Ini ialah *Saluran Aduan Bersatu Pulau Pinang* (MVP Telegram).",
    "Anda boleh menghantar aduan awam tanpa memuat turun aplikasi baharu.",
    "",
    "Sila sediakan maklumat berikut:",
    "1. Keterangan masalah",
    "2. Gambar bukti (jika ada)",
    "3. Lokasi kejadian (GPS atau taip mercu tanda berdekatan)",
    "",
    "Lokasi digunakan untuk menentukan agensi yang bertanggungjawab.",
    "Taip /status untuk menyemak aduan anda.",
  ].join("\n"),

  askPhoto: [
    "Adakah anda mempunyai gambar sebagai bukti?",
    "Sila hantar gambar, atau pilih *Tiada foto* untuk meneruskan.",
    "Gambar membantu pegawai mengenal pasti keadaan di lapangan.",
  ].join("\n"),

  askDescriptionAfterPhoto: [
    "Gambar anda telah diterima. Terima kasih.",
    "",
    "Sila taip ringkas masalah yang berlaku.",
    "Contoh: jalan berlubang / sampah bertimbun / paip bocor.",
  ].join("\n"),

  askLocation: [
    "Sila beritahu lokasi kejadian.",
    "",
    "Anda boleh:",
    "1. Tekan *Kongsi lokasi GPS*, atau",
    "2. Taip mercu tanda / tempat berdekatan.",
    "",
    "Contoh: Padang Kota · Jetty Butterworth · TM Butterworth · Nasi kandar Kepala Batas · depan 7-Eleven Komtar",
    "",
    "Anda tidak perlu membuka atau menyeret peta — taip nama tempat sahaja jika lebih mudah.",
  ].join("\n"),

  locatingPlace: "Sedang mencari lokasi berdasarkan mercu tanda anda…",

  placeNotFound: [
    "Maaf, lokasi tersebut tidak dijumpai dengan tepat.",
    "Sila taip mercu tanda lain yang lebih jelas, atau tekan *Kongsi lokasi GPS*.",
  ].join("\n"),

  placeConfirmHint: [
    "Kami cadangkan pin ini berdasarkan tempat yang anda taip.",
    "Adakah lokasi ini betul?",
    "(Anda hanya perlu tekan butang di bawah — tidak perlu seret peta.)",
  ].join("\n"),

  coarseGps: [
    "Ketepatan GPS semasa kurang memadai (lebih 80 meter).",
    "Sila taip mercu tanda berdekatan, atau pilih lokasi pada peta Telegram jika anda mahu.",
  ].join("\n"),

  askLandmark: [
    "Sila nyatakan mercu tanda ringkas (pilihan) untuk memudahkan pegawai mencari lokasi,",
    "contoh: hadapan 7-Eleven / tiang lampu no. 12.",
  ].join("\n"),

  cancelled:
    "Aduan ini telah dibatalkan. Sila hantar keterangan baharu untuk memulakan aduan semula.",

  needText:
    "Sila taip keterangan masalah terlebih dahulu.\nContoh: jalan berlubang / sampah bertimbun / paip bocor.",

  needLocation: [
    "Sila kongsi lokasi GPS, atau taip mercu tanda berdekatan.",
    "Contoh: Padang Kota / Jetty Butterworth / depan 7-Eleven Komtar",
  ].join("\n"),

  rateLimited: "Had penghantaran dicapai. Sila cuba lagi kemudian.",
};

export function formatConfirmMessage(location) {
  const acc =
    location.accuracy_m != null
      ? ` (±${Math.round(location.accuracy_m)} m)`
      : "";
  const name = location.display_name || "tiada nama jalan";
  const landmark = location.landmark
    ? `\nMercu tanda anda: ${location.landmark}`
    : "";
  return [
    "Sila sahkan lokasi aduan anda.",
    "",
    `Pin GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}${acc}`,
    `Nama jalan laporan: ${name}`,
    landmark,
    "",
    "Nota: Nama jalan mungkin merujuk jalan besar berdekatan. Pin GPS digunakan untuk penyaluran agensi.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

export function previewMessage(draft) {
  const j = draft.jurisdiction;
  const c = draft.classification;
  const triage = j.needsTriage
    ? "\n\nNota: Aduan ini ditanda untuk triaj lanjut oleh pihak negeri."
    : "";
  return [
    "Ringkasan aduan anda:",
    "",
    `Kategori: ${c.categoryLabel}`,
    `Agensi dicadangkan: ${j.agencyLabel}`,
    `Sebab penyaluran: ${j.reason}`,
    triage,
    "",
    "Sila tekan *Hantar* untuk mengemukakan aduan,",
    "atau *Batal* untuk membatalkan aduan ini.",
    "(MVP: tiket agensi adalah simulasi sehingga API rasmi disambungkan.)",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

export function submittedMessage(caseDoc) {
  const triage = caseDoc.jurisdiction?.needsTriage
    ? "\nStatus: dalam triaj / semakan lanjut."
    : "";
  return [
    "Aduan anda telah diterima. Terima kasih.",
    "",
    `No. rujukan: ${caseDoc.ref}`,
    `Agensi: ${caseDoc.jurisdiction.agencyLabel}`,
    `No. tiket (simulasi): ${caseDoc.dispatch.externalRef}`,
    triage,
    "",
    "Anda akan menerima pemberitahuan di Telegram apabila status aduan dikemas kini.",
    "Taip /status untuk menyemak semula.",
  ].join("\n");
}

export function statusUpdateMessage({ ref, agencyLabel, status, note }) {
  const label = STATUS_BM[status] || status;
  const lines = [
    "Kemaskini status aduan",
    "",
    `No. rujukan: ${ref}`,
    `Agensi: ${agencyLabel}`,
    `Status baharu: ${label}`,
  ];
  if (note) lines.push(`Catatan: ${note}`);
  lines.push("", "Terima kasih atas kerjasama anda.");
  return lines.join("\n");
}

export { STATUS_BM };
