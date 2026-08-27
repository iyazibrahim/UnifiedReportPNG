import { statusUpdateMessage } from "../bot/copy.js";

/**
 * Soft-fail notifier: never throws to the caller path.
 * Routes by caseDoc.channel to the matching send function.
 *
 * @param {object} senders
 * @param {(chatId: string, text: string) => Promise<unknown>} [senders.telegram]
 * @param {(chatId: string, text: string) => Promise<unknown>} [senders.whatsapp]
 * @param {(chatId: string, text: string) => Promise<unknown>} [senders.sendMessage] legacy single sender
 */
export async function notifyReporterStatusUpdate(senders, caseDoc, ticket) {
  // Back-compat: notifyReporterStatusUpdate(sendMessageFn, caseDoc, ticket)
  if (typeof senders === "function") {
    senders = { sendMessage: senders, telegram: senders };
  }

  const channel = caseDoc?.channel || "telegram";
  const chatId =
    caseDoc?.reporter?.channelUserId ||
    caseDoc?.reporter?.telegramUserId ||
    null;

  const sendMessage =
    (channel === "whatsapp" ? senders?.whatsapp : senders?.telegram) ||
    senders?.sendMessage;

  if (!chatId || typeof sendMessage !== "function") {
    return { sent: false, reason: "no_chat_or_sender" };
  }
  const text = statusUpdateMessage({
    ref: caseDoc.ref,
    agencyLabel:
      caseDoc.jurisdiction?.agencyLabel || ticket.adapterId || "Agensi",
    status: ticket.status,
    note: ticket.statusHistory?.at(-1)?.note,
  });
  try {
    await sendMessage(chatId, text);
    return { sent: true, channel };
  } catch (err) {
    console.error("notifyReporterStatusUpdate failed:", err.message);
    return { sent: false, reason: err.message };
  }
}
