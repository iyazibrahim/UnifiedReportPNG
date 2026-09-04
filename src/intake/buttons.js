/** Shared menu / button ids used by Telegram + WhatsApp adapters. */

import { CATEGORIES } from "../jurisdiction/categories.js";

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
  LOC_PICK_PREFIX: "loc_pick_",
  LOC_PICK_RETRY: "loc_pick_retry",
  STREET_GPS_YES: "street_gps_yes",
  STREET_GPS_NO: "street_gps_no",
  STREET_GPS_SKIP: "street_gps_skip",
  STREET_KNOW_YES: "street_know_yes",
  STREET_KNOW_NO: "street_know_no",
  STREET_CONFIRM_YES: "street_confirm_yes",
  STREET_USE_RAW: "street_use_raw",
  STREET_PICK_OTHER: "street_pick_other",
  STREET_PICK_PREFIX: "street_pick_",
  SUBMIT_YES: "submit_yes",
  SUBMIT_CANCEL: "submit_cancel",
  CAT_PICK_PREFIX: "cat_pick_",
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

/** Build pick buttons for place disambiguation (max 3 options). */
export function placePickButtons(candidates) {
  const buttons = (candidates || []).slice(0, 3).map((c, i) => ({
    id: `${BUTTON.LOC_PICK_PREFIX}${i}`,
    label: (c.placeName || c.display_name || `Pilihan ${i + 1}`).slice(0, 60),
  }));
  buttons.push({ id: BUTTON.LOC_PICK_RETRY, label: "Cuba lokasi lain" });
  return buttons;
}

export function streetGpsConfirmButtons() {
  return [
    { id: BUTTON.STREET_GPS_YES, label: "Ya, betul" },
    { id: BUTTON.STREET_GPS_NO, label: "Tidak — taip nama lain" },
    { id: BUTTON.STREET_GPS_SKIP, label: "Langkau" },
  ];
}

export function streetKnowButtons() {
  return [
    { id: BUTTON.STREET_KNOW_YES, label: "Ya, saya tahu" },
    { id: BUTTON.STREET_KNOW_NO, label: "Tidak / Tidak pasti" },
  ];
}

export function streetConfirmButtons(hasAlternatives = false) {
  const buttons = [{ id: BUTTON.STREET_CONFIRM_YES, label: "Ya, betul" }];
  if (hasAlternatives) {
    buttons.push({ id: BUTTON.STREET_PICK_OTHER, label: "Pilih jalan lain" });
  }
  buttons.push({ id: BUTTON.STREET_USE_RAW, label: "Guna teks saya" });
  return buttons;
}

export function streetPickButtons(candidates) {
  const buttons = (candidates || []).slice(0, 3).map((c, i) => ({
    id: `${BUTTON.STREET_PICK_PREFIX}${i}`,
    label: (c.streetName || `Jalan ${i + 1}`).slice(0, 60),
  }));
  buttons.push({ id: BUTTON.STREET_USE_RAW, label: "Guna teks saya" });
  return buttons;
}

export function mainMenuButtons() {
  return [
    { id: "menu_new", label: MENU.NEW },
    { id: "menu_status", label: MENU.STATUS },
    { id: "menu_help", label: MENU.HELP },
  ];
}

/** Clarifying category pick when AI confidence is low. */
export function categoryClarifyButtons(categoryIds) {
  return (categoryIds || []).slice(0, 3).map((id) => {
    const cat = CATEGORIES[id];
    return {
      id: `${BUTTON.CAT_PICK_PREFIX}${id}`,
      label: (cat?.label || String(id)).slice(0, 60),
    };
  });
}
