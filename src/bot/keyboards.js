import { InlineKeyboard, Keyboard } from "grammy";

/** Persistent reply menu when idle / not asking for GPS. */
export const MENU = {
  NEW: "Aduan Baharu",
  STATUS: "Semak Aduan",
  HELP: "Bantuan",
  BACK: "Kembali ke menu",
  GPS: "Kongsi lokasi GPS",
};

export function mainMenuKeyboard() {
  return new Keyboard()
    .text(MENU.NEW)
    .text(MENU.STATUS)
    .row()
    .text(MENU.HELP)
    .resized()
    .persistent();
}

/** Only shown while collecting / confirming location. */
export function locationKeyboard() {
  return new Keyboard()
    .requestLocation(MENU.GPS)
    .row()
    .text(MENU.BACK)
    .resized()
    .oneTime();
}

export function photoSkipKeyboard() {
  return new InlineKeyboard().text("Tiada foto", "photo_skip");
}

export function photoContinueKeyboard(hasPhotos = false) {
  const kb = new InlineKeyboard();
  if (hasPhotos) {
    kb.text("Teruskan", "photo_done").row();
  }
  kb.text("Tiada foto", "photo_skip");
  return kb;
}

export function confirmKeyboard() {
  return new InlineKeyboard()
    .text("Ya, lokasi ini betul", "loc_yes")
    .row()
    .text("Tidak — pilih semula", "loc_no")
    .row()
    .text("Ya, dan tambah mercu tanda", "loc_yes_landmark");
}

/** Confirm after AI/Nominatim landmark resolve — buttons only, no map drag. */
export function textPlaceConfirmKeyboard() {
  return new InlineKeyboard()
    .text("Ya, lokasi ini betul", "loc_yes")
    .row()
    .text("Cuba cari semula", "loc_retry_text")
    .row()
    .text("Saya tidak pasti — teruskan", "loc_uncertain");
}

export function submitKeyboard() {
  return new InlineKeyboard()
    .text("Hantar aduan", "submit_yes")
    .text("Batalkan aduan ini", "submit_cancel");
}
