import { Pool } from "pg";
import { config } from "../config.js";

const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.dbSslEnabled ? { rejectUnauthorized: false } : false,
      max: 10,
    })
  : null;

export const hasDatabase = Boolean(pool);

const ensurePool = () => {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return pool;
};

export const query = async (text, params = []) => {
  const activePool = ensurePool();
  return activePool.query(text, params);
};

export const withTransaction = async (callback) => {
  const activePool = ensurePool();
  const client = await activePool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const pingDatabase = async () => {
  const activePool = ensurePool();
  await activePool.query("select 1");
  return true;
};
