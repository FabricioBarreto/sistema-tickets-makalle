import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const buyerEmail = "fabrib40@gmail.com";
  const buyerName = "Fabricio Barreto";

  const orders = await prisma.order.findMany({
    where: {
      buyerEmail,
      buyerName,
      orderNumber: { startsWith: "TEST-" }, // extra seguridad
    },
    select: { id: true, orderNumber: true },
  });

  if (orders.length === 0) {
    console.log("⚠️ No se encontraron órdenes de prueba.");
    return;
  }

  console.log("🗑 Eliminando órdenes:");
  orders.forEach(o => console.log("-", o.orderNumber));

  await prisma.order.deleteMany({
    where: {
      buyerEmail,
      buyerName,
      orderNumber: { startsWith: "TEST-" },
    },
  });

  console.log("✅ Órdenes y tickets eliminados correctamente.");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
