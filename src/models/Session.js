import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    telegramUserId: { type: String, unique: true, index: true },
    step: { type: String, default: "idle" },
    draft: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", sessionSchema);
