const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  const adminEmail = 'abubakarrshadrachk@gmail.com';
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  
  if (user) {
    console.log('Admin found:', user);
    if (user.role !== 'ADMIN') {
      console.log('Updating user to ADMIN role...');
      await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'ADMIN' }
      });
      console.log('User updated to ADMIN.');
    }
  } else {
    console.log('Admin user NOT found in database.');
  }
}

checkAdmin()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
