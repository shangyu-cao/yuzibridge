import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.API_PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  dbSslEnabled: (process.env.DB_SSL ?? "false").toLowerCase() === "true",
  jwtSecret: process.env.JWT_SECRET ?? "replace-this-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  googleTranslateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY ?? "",
};
