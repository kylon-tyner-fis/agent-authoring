import { Pool } from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

// Prevent multiple instances of Pool in development
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  checkpointer: PostgresSaver | undefined;
  isDbSetup: boolean | undefined;
};

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

export const checkpointer = globalForDb.checkpointer ?? new PostgresSaver(pool);

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.checkpointer = checkpointer;
}

export async function ensureDbSetup() {
  // Use the global variable here to prevent Next.js HMR memory leaks
  if (!globalForDb.isDbSetup) {
    await checkpointer.setup();
    globalForDb.isDbSetup = true;
  }
}
