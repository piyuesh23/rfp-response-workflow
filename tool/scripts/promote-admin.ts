/**
 * One-time script to promote a user to ADMIN role.
 *
 * Usage (inside container):
 *   npx tsx scripts/promote-admin.ts user@example.com
 *
 * Usage (from host with docker):
 *   docker exec tool-app-1 npx tsx scripts/promote-admin.ts user@example.com
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/promote-admin.ts <email>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User with email "${email}" not found. Sign in first to create the account.`);
    process.exit(1);
  }

  if (user.role === "ADMIN") {
    console.log(`${user.name} (${email}) is already an ADMIN.`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`Promoted ${user.name} (${email}) from ${user.role} to ADMIN.`);
}

main()
  .catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
