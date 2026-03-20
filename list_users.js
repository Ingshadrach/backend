const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany();
  console.log('Total Users:', users.length);
  users.forEach(u => {
    console.log(`- ${u.id}: ${u.name} (${u.email || u.phone}) [${u.role}]`);
  });
}

listUsers()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
