import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execFileSync } from "child_process";

let container: Awaited<ReturnType<typeof PostgreSqlContainer.prototype.start>> | null = null;

export async function setup() {
  // pgvector extension required by the schema — use the pgvector image
  const pg = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();
  container = pg;

  const url = pg.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.TEST_DATABASE_URL = url;

  // Enable pgvector inside the container before running prisma db push
  await container.exec([
    "psql",
    "-U", pg.getUsername(),
    "-d", pg.getDatabase(),
    "-c", "CREATE EXTENSION IF NOT EXISTS vector;",
  ]);

  // Push schema (avoids running formal migrations against a fresh test DB)
  execFileSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

export async function teardown() {
  if (container) await container.stop();
}
