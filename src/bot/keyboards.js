import { InlineKeyboard, Keyboard } from "grammy";

export function locationKeyboard() {
  return new Keyboard().requestLocation("Kongsi lokasi GPS").resized().oneTime();
}

export function photoSkipKeyboard() {
  return new InlineKeyboard().text("Tiada foto", "photo_skip");
}

export function confirmKeyboard() {
  return new InlineKeyboard()
    .text("Betul lokasi ini", "loc_yes")
    .row()
    .text("Bukan — pilih semula", "loc_no")
    .row()
    .text("Betul, tambah landmark", "loc_yes_landmark");
}

export function submitKeyboard() {
  return new InlineKeyboard()
    .text("Hantar", "submit_yes")
    .text("Batal", "submit_cancel");
}
