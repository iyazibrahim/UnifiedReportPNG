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
    "3. Lokasi kejadian (pin GPS)",
    "",
    "Pin lokasi digunakan untuk menentukan agensi yang bertanggungjawab.",
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
    "Sila kongsi lokasi kejadian.",
    "",
    "Anda boleh:",
    "• Kongsi lokasi GPS semasa, atau",
    "• Pilih titik tepat pada peta (Choose location).",
    "",
    "Pin GPS digunakan untuk penyaluran kepada agensi yang berkenaan.",
    "Nama jalan yang dicadangkan sistem mungkin merujuk jalan besar berdekatan — pin pada peta adalah rujukan utama.",
  ].join("\n"),

  coarseGps: [
    "Ketepatan GPS semasa kurang memadai (lebih 80 meter).",
    "Sila pilih lokasi secara manual pada peta:",
    "📎 → Location → Choose this location.",
  ].join("\n"),

  askLandmark: [
    "Sila nyatakan mercu tanda ringkas (pilihan) untuk memudahkan pegawai mencari lokasi,",
    "contoh: hadapan 7-Eleven / tiang lampu no. 12.",
  ].join("\n"),

  cancelled:
    "Aduan ini telah dibatalkan. Sila hantar keterangan baharu untuk memulakan aduan semula.",

  needText:
    "Sila taip keterangan masalah terlebih dahulu.\nContoh: jalan berlubang / sampah bertimbun / paip bocor.",

  needLocation:
    "Sila kongsi atau pilih lokasi kejadian terlebih dahulu melalui butang lokasi di bawah.",
};

export function formatConfirmMessage(location) {
  const acc =
    location.accuracy_m != null
      ? ` (±${Math.round(location.accuracy_m)} m)`
      : "";
  const name = location.display_name || "tiada cadangan nama";
  return [
    "Sila sahkan lokasi aduan anda.",
    "",
    `Pin GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}${acc}`,
    `Cadangan nama: ${name}`,
    "",
    "Nota: Cadangan nama mungkin merujuk jalan besar berdekatan. Pin GPS adalah asas penyaluran agensi.",
  ].join("\n");
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
