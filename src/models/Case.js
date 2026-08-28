import mongoose from "mongoose";

const caseSchema = new mongoose.Schema(
  {
    ref: { type: String, unique: true, index: true },
    channel: { type: String, default: "telegram", index: true },
    reporter: {
      channelUserId: String,
      /** @deprecated prefer channelUserId; kept for Telegram compatibility */
      telegramUserId: String,
      displayName: String,
    },
    intake: {
      text: String,
      photoFileIds: [String],
      language: { type: String, default: "ms" },
    },
    location: { type: mongoose.Schema.Types.Mixed },
    classification: { type: mongoose.Schema.Types.Mixed },
    jurisdiction: { type: mongoose.Schema.Types.Mixed },
    dispatch: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: [
        "draft",
        "awaiting_location",
        "classified",
        "dispatched",
        "triaged",
        "failed",
        "cancelled",
      ],
      default: "draft",
    },
    consentAt: { type: Date, default: null },
    hidden: { type: Boolean, default: false, index: true },
    hiddenAt: { type: Date, default: null },
    hiddenBy: { type: String, default: null },
    hiddenReason: { type: String, default: null },
  },
  { timestamps: true }
);

export const Case = mongoose.model("Case", caseSchema);

/** Query filter for a reporter on a given channel (supports legacy telegramUserId). */
export function reporterFilter(channel, channelUserId) {
  const id = String(channelUserId);
  if (channel === "telegram") {
    return {
      $or: [
        { channel: "telegram", "reporter.channelUserId": id },
        { "reporter.telegramUserId": id },
      ],
    };
  }
  return { channel, "reporter.channelUserId": id };
}
