import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    channel: { type: String, default: "telegram", index: true },
    channelUserId: { type: String, index: true },
    /** @deprecated legacy Telegram-only key; kept for migration reads */
    telegramUserId: { type: String, index: true },
    step: { type: String, default: "idle" },
    draft: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

sessionSchema.index(
  { channel: 1, channelUserId: 1 },
  { unique: true, partialFilterExpression: { channelUserId: { $type: "string" } } }
);

export const Session = mongoose.model("Session", sessionSchema);
