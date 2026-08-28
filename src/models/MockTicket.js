import mongoose from "mongoose";

const STATUS = [
  "received",
  "acknowledged",
  "in_progress",
  "resolved",
  "rejected",
];

const mockTicketSchema = new mongoose.Schema(
  {
    adapterId: { type: String, index: true },
    externalRef: { type: String, unique: true },
    caseRef: { type: String, index: true },
    payload: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: STATUS,
      default: "received",
      index: true,
    },
    statusHistory: [
      {
        status: String,
        note: String,
        actorUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
        actorUsername: { type: String, default: null },
        at: { type: Date, default: Date.now },
      },
    ],
    assignedUnit: { type: String, default: null },
    dueAt: { type: Date, default: null },
    externalSync: {
      status: { type: String, default: null },
      externalId: { type: String, default: null },
      lastAttemptAt: { type: Date, default: null },
      lastError: { type: String, default: null },
    },
  },
  { timestamps: true }
);

export const MockTicket = mongoose.model("MockTicket", mockTicketSchema);
export const MOCK_TICKET_STATUSES = STATUS;

export const STATUS_LABEL = {
  received: "Diterima",
  acknowledged: "Diakui",
  in_progress: "Dalam tindakan",
  resolved: "Selesai",
  rejected: "Ditolak",
};

/** Valid next statuses from current state */
export function allowedNextStatuses(current) {
  switch (current) {
    case "received":
      return ["acknowledged", "in_progress", "rejected"];
    case "acknowledged":
      return ["in_progress", "rejected"];
    case "in_progress":
      return ["resolved", "rejected"];
    case "resolved":
    case "rejected":
      return [];
    default:
      return MOCK_TICKET_STATUSES;
  }
}

export function isTerminalStatus(status) {
  return status === "resolved" || status === "rejected";
}
