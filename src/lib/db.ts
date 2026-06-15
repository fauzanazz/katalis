import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLTransaction } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

function createDb() {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
};

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

/** Use as parameter type in functions that accept either db or a transaction. */
export type DbOrTx =
  | typeof db
  | LibSQLTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
