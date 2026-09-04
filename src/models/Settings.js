import mongoose from "mongoose";

const defaultToggles = () => ({
  telegramBotEnabled: true,
  whatsappBotEnabled: true,
  llmClassificationEnabled: true,
  keywordFallbackEnabled: true,
  nominatimEnabled: true,
  mockDispatchEnabled: true,
  abuseGuardsEnabled: true,
  ragEnabled: true,
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
      aiPrimaryModel: { type: String, default: "" },
      aiStrongModel: { type: String, default: "" },
      aiEmbeddingModel: { type: String, default: "" },
      nominatimUserAgent: { type: String, default: "" },
      telegramWebhookUrl: { type: String, default: "" },
      publicBaseUrl: { type: String, default: "" },
      whatsappPhoneNumberId: { type: String, default: "" },
      mockPortalPin: { type: String, default: "" },
      abuseMaxPerHour: { type: String, default: "5" },
      abuseMaxPerDay: { type: String, default: "15" },
      abuseCooldownSec: { type: String, default: "60" },
      whatsappStatusTemplateName: { type: String, default: "" },
    },
    secrets: {
      telegramBotToken: { type: String, default: "" },
      telegramWebhookSecret: { type: String, default: "" },
      whatsappAccessToken: { type: String, default: "" },
      whatsappAppSecret: { type: String, default: "" },
      whatsappVerifyToken: { type: String, default: "" },
      openRouterApiKey: { type: String, default: "" },
      pearlApiKey: { type: String, default: "" },
      aspireApiKey: { type: String, default: "" },
      myjalanApiKey: { type: String, default: "" },
      pbappApiKey: { type: String, default: "" },
      epintasApiKey: { type: String, default: "" },
    },
    updatedBy: { type: String, default: null },
    governance: {
      dataControllerName: { type: String, default: "" },
      superAdminNames: { type: String, default: "" },
      retentionYearsMetadata: { type: String, default: "7" },
      retentionYearsPhotos: { type: String, default: "2" },
      slaHoursJson: { type: String, default: "{}" },
      vendorAccessNotes: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", settingsSchema);
export { defaultToggles };
