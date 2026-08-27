import mongoose from "mongoose";

const STATUS = ["received", "in_progress", "resolved", "rejected"];

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
        at: { type: Date, default: Date.now },
      },
    ],
    assignedUnit: { type: String, default: null },
  },
  { timestamps: true }
);

export const MockTicket = mongoose.model("MockTicket", mockTicketSchema);
export const MOCK_TICKET_STATUSES = STATUS;
