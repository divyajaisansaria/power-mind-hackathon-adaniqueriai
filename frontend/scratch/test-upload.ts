import prisma from '../lib/prisma';

async function testUpload() {
  const uid = "DhysP8hGXDPzYRy3u6kT9w3kaPi1";
  console.log("Testing upload for UID:", uid);
  
  const user = await prisma.user.findUnique({
    where: { firebaseUid: uid }
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log("Found user:", user.email);

  const doc = await prisma.document.create({
    data: {
      title: "Manual Test Document",
      fileUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      allowedRoles: ['ADMIN', 'MANAGER'],
      authorId: user.id
    }
  });

  console.log("Document created successfully:", doc);
}

testUpload()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
