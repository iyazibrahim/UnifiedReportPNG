import { statusUpdateMessage } from "../bot/copy.js";

/**
 * Soft-fail notifier: never throws to the caller path.
 */
export async function notifyReporterStatusUpdate(sendMessage, caseDoc, ticket) {
  const chatId = caseDoc?.reporter?.telegramUserId;
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
    return { sent: true };
  } catch (err) {
    console.error("notifyReporterStatusUpdate failed:", err.message);
    return { sent: false, reason: err.message };
  }
}
