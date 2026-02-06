const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Iniciando seed de base de datos...\n");

  try {
    // 1. Crear usuario administrador
    console.log("👤 Creando usuario administrador...");
    const adminPassword = await bcrypt.hash("admin123", 10);
    const admin = await prisma.user.create({
      data: {
        email: "admin@carnaval.com",
        name: "Administrador",
        password: adminPassword,
        role: "ADMIN",
        active: true,
      },
    });
    console.log(`   ✅ Admin creado: ${admin.email}`);

    // 2. Crear usuario operador
    console.log("👤 Creando usuario operador...");
    const operatorPassword = await bcrypt.hash("operador123", 10);
    const operator = await prisma.user.create({
      data: {
        email: "operador@carnaval.com",
        name: "Operador",
        password: operatorPassword,
        role: "OPERATOR",
        active: true,
      },
    });
    console.log(`   ✅ Operador creado: ${operator.email}`);

    // 3. Crear configuración del sistema
    console.log("⚙️  Creando configuración del sistema...");
    const config = await prisma.systemConfig.create({
      data: {
        ticketPrice: 2000, // $2000 por entrada
        totalAvailable: 1000, // 1000 entradas disponibles
        maxPerPurchase: 10,
        salesEnabled: true,
        eventDate: new Date("2026-02-14T20:00:00.000Z"), // 14 de Febrero 2026, 20:00
        eventName: "Carnavales Makallé 2026",
        eventLocation: "Corsódromo Makallé, Resistencia, Chaco",
        emailFrom: "noreply@carnaval.com",
        emailEnabled: true,
      },
    });
    console.log(`   ✅ Configuración creada: ${config.eventName}`);

    console.log("\n✅ ¡Seed completado exitosamente!\n");

    // Resumen
    console.log("📊 DATOS INICIALES CREADOS:");
    console.log("─────────────────────────────────");
    console.log("👥 USUARIOS:");
    console.log(`   Admin:    ${admin.email}`);
    console.log(`   Password: admin123`);
    console.log("");
    console.log(`   Operador: ${operator.email}`);
    console.log(`   Password: operador123`);
    console.log("");
    console.log("🎫 EVENTO:");
    console.log(`   Nombre:    ${config.eventName}`);
    console.log(
      `   Fecha:     ${config.eventDate.toLocaleDateString("es-AR")}`,
    );
    console.log(`   Ubicación: ${config.eventLocation}`);
    console.log(`   Precio:    $${config.ticketPrice}`);
    console.log(`   Stock:     ${config.totalAvailable} entradas`);
    console.log(
      `   Ventas:    ${config.salesEnabled ? "ACTIVAS" : "INACTIVAS"}`,
    );
    console.log("─────────────────────────────────\n");
  } catch (error) {
    console.error("\n❌ Error durante el seed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .then(() => {
    console.log("🎉 Base de datos inicializada correctamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  });
