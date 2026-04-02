/**
 * Database connection — Drizzle ORM on top of Neon (serverless PostgreSQL).
 *
 * The `db` export is used throughout the Elysia API for all database
 * operations. Connection is pooled via Neon's serverless driver.
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
