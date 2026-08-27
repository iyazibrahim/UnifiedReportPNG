import mongoose from "mongoose";

const defaultToggles = () => ({
  telegramBotEnabled: true,
  llmClassificationEnabled: true,
  keywordFallbackEnabled: true,
  nominatimEnabled: true,
  mockDispatchEnabled: true,
  pearl_mbpp: true,
  aspire_mbsp: true,
  myjalan: true,
  pbapp: true,
  epintas: true,
});

const settingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, unique: true, default: "default" },
    toggles: { type: mongoose.Schema.Types.Mixed, default: defaultToggles },
    config: {
      openRouterModel: { type: String, default: "" },
      nominatimUserAgent: { type: String, default: "" },
      telegramWebhookUrl: { type: String, default: "" },
      mockPortalPin: { type: String, default: "" },
    },
    secrets: {
      telegramBotToken: { type: String, default: "" },
      telegramWebhookSecret: { type: String, default: "" },
      openRouterApiKey: { type: String, default: "" },
      pearlApiKey: { type: String, default: "" },
      aspireApiKey: { type: String, default: "" },
      myjalanApiKey: { type: String, default: "" },
      pbappApiKey: { type: String, default: "" },
      epintasApiKey: { type: String, default: "" },
    },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", settingsSchema);
export { defaultToggles };
