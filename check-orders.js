const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const total = await prisma.order.count();
  const completed = await prisma.order.count({ 
    where: { paymentStatus: 'COMPLETED' } 
  });
  
  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'COMPLETED' },
    select: {
      orderNumber: true,
      purchaseDate: true,
      quantity: true,
      totalAmount: true,
      paymentStatus: true,
    }
  });
  
  console.log('Total órdenes:', total);
  console.log('Órdenes completadas:', completed);
  console.log('Detalles:', JSON.stringify(orders, null, 2));
  
  await prisma.$disconnect();
}

check();
