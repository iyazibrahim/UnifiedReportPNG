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
    "Gunakan butang menu di bawah:",
    "• *Aduan Baharu* — buat aduan",
    "• *Semak Aduan* — lihat status aduan anda",
    "• *Bantuan* — cara guna bot",
  ].join("\n"),

  help: [
    "Cara guna Saluran Aduan Bersatu:",
    "",
    "1. Tekan *Aduan Baharu*",
    "2. Taip keterangan masalah",
    "3. Hantar gambar bukti (jika ada), atau *Tiada foto*",
    "4. Kongsi lokasi GPS *atau* taip mercu tanda berdekatan",
    "5. Sahkan ringkasan, kemudian *Hantar aduan*",
    "",
    "Tekan *Semak Aduan* untuk melihat status aduan terkini.",
    "Anda juga boleh taip /status atau /status URP-XXXX.",
  ].join("\n"),

  startNew: [
    "Baik. Sila taip keterangan masalah.",
    "",
    "Contoh: jalan berlubang / sampah bertimbun / paip bocor.",
  ].join("\n"),

  backToMenu: "Baik. Kembali ke menu utama.",

  noCases: "Tiada aduan lagi. Tekan *Aduan Baharu* untuk menghantar aduan.",

  askPhoto: [
    "Adakah anda mempunyai gambar sebagai bukti?",
    "",
    "Anda boleh hantar sehingga *5 gambar* (satu-satu atau album).",
    "Tekan *Teruskan* bila selesai, atau *Tiada foto* jika tiada.",
  ].join("\n"),

  photoReceived: (count, max) =>
    `Gambar diterima (${count}/${max}). Hantar lagi jika perlu, atau tekan *Teruskan*.`,

  photoLimitReached: (max) =>
    `Had ${max} gambar telah dicapai. Sila tekan *Teruskan* untuk ke lokasi.`,

  photoTooMany: (max) =>
    `Maksimum ${max} gambar sahaja. Sila tekan *Teruskan* untuk ke lokasi.`,

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
    "Tekan *Kembali ke menu* untuk batalkan aduan ini.",
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
    "Aduan ini telah dibatalkan. Tekan *Aduan Baharu* bila anda mahu cuba lagi.",

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
    "Tekan *Semak Aduan* untuk menyemak semula.",
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
