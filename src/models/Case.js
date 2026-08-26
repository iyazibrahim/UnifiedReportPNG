import mongoose from "mongoose";

const caseSchema = new mongoose.Schema(
  {
    ref: { type: String, unique: true, index: true },
    channel: { type: String, default: "telegram" },
    reporter: {
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
      ],
      default: "draft",
    },
  },
  { timestamps: true }
);

export const Case = mongoose.model("Case", caseSchema);
