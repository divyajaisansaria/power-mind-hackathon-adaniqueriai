import prisma from '../lib/prisma';

async function test() {
  const uid = "DhysP8hGXDPzYRy3u6kT9w3kaPi1";
  const user = await prisma.user.findUnique({
    where: { firebaseUid: uid }
  });
  console.log("Found User:", user);
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
