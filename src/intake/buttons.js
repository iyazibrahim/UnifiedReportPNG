/** Shared menu / button ids used by Telegram + WhatsApp adapters. */

export const MENU = {
  NEW: "Aduan Baharu",
  STATUS: "Semak Aduan",
  HELP: "Bantuan",
  BACK: "Kembali ke menu",
  GPS: "Kongsi lokasi GPS",
};

export const BUTTON = {
  PHOTO_SKIP: "photo_skip",
  PHOTO_DONE: "photo_done",
  LOC_YES: "loc_yes",
  LOC_NO: "loc_no",
  LOC_YES_LANDMARK: "loc_yes_landmark",
  LOC_RETRY_TEXT: "loc_retry_text",
  LOC_UNCERTAIN: "loc_uncertain",
  SUBMIT_YES: "submit_yes",
  SUBMIT_CANCEL: "submit_cancel",
};

export function photoSkipButtons() {
  return [{ id: BUTTON.PHOTO_SKIP, label: "Tiada foto" }];
}

export function photoContinueButtons(hasPhotos = false) {
  const buttons = [];
  if (hasPhotos) buttons.push({ id: BUTTON.PHOTO_DONE, label: "Teruskan" });
  buttons.push({ id: BUTTON.PHOTO_SKIP, label: "Tiada foto" });
  return buttons;
}

export function confirmButtons() {
  return [
    { id: BUTTON.LOC_YES, label: "Ya, lokasi ini betul" },
    { id: BUTTON.LOC_NO, label: "Tidak — pilih semula" },
    { id: BUTTON.LOC_YES_LANDMARK, label: "Ya, dan tambah mercu tanda" },
  ];
}

export function textPlaceConfirmButtons() {
  return [
    { id: BUTTON.LOC_YES, label: "Ya, lokasi ini betul" },
    { id: BUTTON.LOC_RETRY_TEXT, label: "Cuba cari semula" },
    { id: BUTTON.LOC_UNCERTAIN, label: "Saya tidak pasti — teruskan" },
  ];
}

export function submitButtons() {
  return [
    { id: BUTTON.SUBMIT_YES, label: "Hantar aduan" },
    { id: BUTTON.SUBMIT_CANCEL, label: "Batalkan aduan ini" },
  ];
}

export function mainMenuButtons() {
  return [
    { id: "menu_new", label: MENU.NEW },
    { id: "menu_status", label: MENU.STATUS },
    { id: "menu_help", label: MENU.HELP },
  ];
}
