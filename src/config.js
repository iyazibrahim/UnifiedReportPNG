import "dotenv/config";

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3500),
    mongoUri: env.MONGODB_URI || "mongodb://127.0.0.1:27017/unified-report-penang",
    telegramToken: env.TELEGRAM_BOT_TOKEN || "",
    webhookUrl: env.TELEGRAM_WEBHOOK_URL || "",
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || "",
    openRouterKey: env.OPENROUTER_API_KEY || "",
    openRouterModel: env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    nominatimUserAgent:
      env.NOMINATIM_USER_AGENT || "UnifiedReportPenang/1.0",
    opsUser: env.OPS_USER || "ops",
    opsPassword: env.OPS_PASSWORD || "changeme",
    jwtSecret: env.JWT_SECRET || "dev-jwt-secret-change-me",
  };
}
