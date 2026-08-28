import { Case } from "../models/Case.js";
import { MockTicket } from "../models/MockTicket.js";

/**
 * Citizen or admin cancel while ticket is still `received`.
 */
export async function cancelCaseIfReceived(caseRef, { actor = "citizen" } = {}) {
  const caseDoc = await Case.findOne({
    ref: String(caseRef).toUpperCase(),
    hidden: { $ne: true },
  });
  if (!caseDoc) return { ok: false, reason: "not_found" };

  const ticket = await MockTicket.findOne({ caseRef: caseDoc.ref });
  if (!ticket) return { ok: false, reason: "no_ticket" };
  if (ticket.status !== "received") {
    return { ok: false, reason: "not_cancellable", status: ticket.status };
  }

  ticket.status = "rejected";
  ticket.statusHistory = ticket.statusHistory || [];
  ticket.statusHistory.push({
    status: "rejected",
    note: `Dibatalkan oleh ${actor}`,
    at: new Date(),
  });
  await ticket.save();

  caseDoc.status = "cancelled";
  await caseDoc.save();

  return { ok: true, case: caseDoc.toObject(), ticket: ticket.toObject() };
}
