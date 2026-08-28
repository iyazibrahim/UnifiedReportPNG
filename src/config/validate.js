const WEAK_SECRETS = new Set([
  "changeme",
  "change-me-in-production",
  "dev-jwt-secret-change-me",
  "dev-settings-key",
]);

export function validateProductionSecrets(config, env = process.env) {
  const warnings = [];
  const errors = [];
  const isProd = env.NODE_ENV === "production";

  if (WEAK_SECRETS.has(config.opsPassword)) {
    const msg = "OPS_PASSWORD is a default value";
    (isProd ? errors : warnings).push(msg);
  }
  if (WEAK_SECRETS.has(config.jwtSecret)) {
    const msg = "JWT_SECRET is a default value";
    (isProd ? errors : warnings).push(msg);
  }
  if (!config.jwtSecret || config.jwtSecret.length < 24) {
    const msg = "JWT_SECRET should be at least 24 characters";
    (isProd ? errors : warnings).push(msg);
  }

  return { ok: errors.length === 0, warnings, errors, isProd };
}

export function assertProductionSecrets(config, env = process.env) {
  const result = validateProductionSecrets(config, env);
  if (!result.ok) {
    console.error("Production secret validation failed:");
    for (const e of result.errors) console.error(`  - ${e}`);
    if (env.NODE_ENV === "production") {
      process.exit(1);
    }
  } else if (result.warnings.length) {
    console.warn("Security warnings:");
    for (const w of result.warnings) console.warn(`  - ${w}`);
  }
  return result;
}
