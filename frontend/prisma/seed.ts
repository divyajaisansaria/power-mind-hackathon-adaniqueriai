import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "shashankmaurya980@gmail.com";
  const firebaseUid = "DhysP8hGXDPzYRy3u6kT9w3kaPi1"; 

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log(`Admin user with email ${email} already exists.`);
    
    if (existing.role !== Role.ADMIN) {
      console.log(`Updating user role to ADMIN...`);
      await prisma.user.update({
        where: { email },
        data: { role: Role.ADMIN }
      });
      console.log("Admin role updated successfully.");
    }
    return;
  }

  await prisma.user.create({
    data: {
      email,
      firebaseUid,
      role: Role.ADMIN
    }
  });

  console.log(`Admin user ${email} created successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
