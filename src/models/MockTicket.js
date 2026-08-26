import mongoose from "mongoose";

const mockTicketSchema = new mongoose.Schema(
  {
    adapterId: String,
    externalRef: { type: String, index: true },
    caseRef: String,
    payload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const MockTicket = mongoose.model("MockTicket", mockTicketSchema);
