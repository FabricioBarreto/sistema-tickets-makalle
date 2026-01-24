import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const SALT = process.env.QR_SALT || "carnaval-secret-salt-2026";

function generateQRHash(orderId: string, ticketIndex: number): string {
  const data = `${orderId}-${ticketIndex}-${Date.now()}`;
  const hash = crypto.createHmac("sha256", SALT).update(data).digest("hex");
  return hash.substring(0, 32).toUpperCase();
}

async function main() {
  console.log("🌱 Iniciando seed...");

  // Limpiar datos existentes
  console.log("🧹 Limpiando datos existentes...");
  await prisma.validation.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.systemConfig.deleteMany({});

  // 1. Crear usuario admin
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@carnaval.com",
      name: "Administrador",
      password: hashedPassword,
      role: "ADMIN",
      active: true,
    },
  });

  console.log("✅ Usuario admin creado:", admin.email);

  // 2. Crear usuario operador
  const operator = await prisma.user.create({
    data: {
      email: "operador@carnaval.com",
      name: "Operador de Puerta",
      password: hashedPassword,
      role: "OPERATOR",
      active: true,
    },
  });

  console.log("✅ Usuario operador creado:", operator.email);

  // 3. Crear configuración del sistema
  // ✅ SIN credenciales de Mercado Pago (ahora están en .env)
  const config = await prisma.systemConfig.create({
    data: {
      ticketPrice: 2000,
      totalAvailable: 1000,
      maxPerPurchase: 10,
      salesEnabled: true,
      eventDate: new Date("2026-02-14T20:00:00"),
      eventName: "Carnaval Makalle 2026",
      eventLocation: "Anfiteatro Municipal",
      emailFrom: "noreply@carnaval.com",
      emailEnabled: true,
    },
  });

  console.log("✅ Configuración del sistema creada");
  console.log(
    "   💡 Recordá configurar MERCADOPAGO_ACCESS_TOKEN en .env.local",
  );

  // 4. Crear órdenes y tickets de ejemplo
  const ordersData = [
    {
      buyerName: "Juan Pérez",
      buyerEmail: "juan.perez@example.com",
      buyerPhone: "+54 362 123-4567",
      buyerDNI: "35123456",
      quantity: 2,
    },
    {
      buyerName: "María González",
      buyerEmail: "maria.gonzalez@example.com",
      buyerPhone: "+54 362 234-5678",
      buyerDNI: "40234567",
      quantity: 1,
    },
    {
      buyerName: "Carlos Rodríguez",
      buyerEmail: "carlos.rodriguez@example.com",
      buyerPhone: "+54 362 345-6789",
      buyerDNI: "38345678",
      quantity: 4,
    },
    {
      buyerName: "Ana Martínez",
      buyerEmail: "ana.martinez@example.com",
      buyerPhone: "+54 362 456-7890",
      buyerDNI: "42456789",
      quantity: 3,
    },
  ];

  console.log("\n📝 Creando órdenes y tickets...\n");

  for (const orderData of ordersData) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${random}`;
    const unitPrice = 2000;
    const totalAmount = unitPrice * orderData.quantity;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        buyerName: orderData.buyerName,
        buyerEmail: orderData.buyerEmail,
        buyerPhone: orderData.buyerPhone,
        buyerDNI: orderData.buyerDNI,
        unitPrice,
        quantity: orderData.quantity,
        totalAmount,
        paymentStatus: "COMPLETED",
        status: "ACTIVE",
      },
    });

    console.log(`📦 Orden: ${orderNumber}`);
    console.log(`   Comprador: ${orderData.buyerName}`);
    console.log(`   Cantidad: ${orderData.quantity} tickets`);

    // Crear tickets individuales para esta orden
    for (let i = 0; i < orderData.quantity; i++) {
      // Código legible más simple
      const code = `${random}-${(i + 1).toString().padStart(2, "0")}`;
      const qrHash = generateQRHash(order.id, i);

      const ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          code,
          qrHash,
          status: "PAID",
          validated: false,
        },
      });

      console.log(`   ✓ Ticket ${i + 1}: ${code}`);
      console.log(`     QR Hash: ${qrHash}`);
    }
    console.log("");
  }

  // 5. Mostrar resumen de tickets para validación
  const allTickets = await prisma.ticket.findMany({
    include: {
      order: {
        select: {
          orderNumber: true,
          buyerName: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  console.log("\n" + "=".repeat(60));
  console.log("🎫 CÓDIGOS PARA VALIDACIÓN MANUAL:");
  console.log("=".repeat(60));

  allTickets.forEach((ticket, index) => {
    console.log(`\n${index + 1}. ${ticket.order.buyerName}`);
    console.log(`   Código: ${ticket.code}`);
    console.log(`   QR Hash: ${ticket.qrHash}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("\n🎉 Seed completado exitosamente!");
  console.log("\n📋 CREDENCIALES DE ACCESO:");
  console.log("   👤 Admin: admin@carnaval.com / admin123");
  console.log("   👤 Operador: operador@carnaval.com / admin123");
  console.log("\n🔗 URLs:");
  console.log("   🌐 Local: http://localhost:3000/admin/login");
  console.log("   📱 Red: http://192.168.20.114:3000/admin/login");
  console.log("\n⚙️  CONFIGURACIÓN REQUERIDA:");
  console.log("   ⚠️  Agregá las siguientes variables a tu .env.local:");
  console.log("   MERCADOPAGO_ACCESS_TOKEN=TEST-xxxx-xxxx-xxxx");
  console.log("   MERCADOPAGO_PUBLIC_KEY=TEST-xxxx-xxxx-xxxx");
  console.log("\n💡 IMPORTANTE para móvil:");
  console.log("   Para usar la cámara en red local, necesitas HTTPS");
  console.log("   Usa ingreso MANUAL con los códigos mostrados arriba");
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
