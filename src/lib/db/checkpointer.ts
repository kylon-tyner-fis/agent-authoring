import { Pool } from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

// Prevent multiple instances of Pool in development
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  checkpointer: PostgresSaver | undefined;
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

let isDbSetup = false;
export async function ensureDbSetup() {
  if (!isDbSetup) {
    await checkpointer.setup();
    isDbSetup = true;
  }
}
