const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log("🧹 Iniciando limpieza de base de datos...\n");

  try {
    // Paso 1: Eliminar datos en orden (respetando relaciones)
    console.log("📋 Paso 1: Eliminando registros de validaciones...");
    const deletedValidations = await prisma.validation.deleteMany({});
    console.log(`   ✅ ${deletedValidations.count} validaciones eliminadas`);

    console.log("📋 Paso 2: Eliminando tickets...");
    const deletedTickets = await prisma.ticket.deleteMany({});
    console.log(`   ✅ ${deletedTickets.count} tickets eliminados`);

    console.log("📋 Paso 3: Eliminando órdenes...");
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`   ✅ ${deletedOrders.count} órdenes eliminadas`);

    console.log("📋 Paso 4: Eliminando logs de auditoría...");
    const deletedAuditLogs = await prisma.auditLog.deleteMany({});
    console.log(`   ✅ ${deletedAuditLogs.count} audit logs eliminados`);

    console.log("📋 Paso 5: Eliminando usuarios...");
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`   ✅ ${deletedUsers.count} usuarios eliminados`);

    console.log("📋 Paso 6: Eliminando configuración del sistema...");
    const deletedConfig = await prisma.systemConfig.deleteMany({});
    console.log(`   ✅ ${deletedConfig.count} configuraciones eliminadas`);

    console.log("\n✅ ¡Base de datos limpiada exitosamente!\n");

    // Resumen
    console.log("📊 RESUMEN DE LIMPIEZA:");
    console.log("─────────────────────────────────");
    console.log(`   Validaciones:    ${deletedValidations.count}`);
    console.log(`   Tickets:         ${deletedTickets.count}`);
    console.log(`   Órdenes:         ${deletedOrders.count}`);
    console.log(`   Audit Logs:      ${deletedAuditLogs.count}`);
    console.log(`   Usuarios:        ${deletedUsers.count}`);
    console.log(`   Configuración:   ${deletedConfig.count}`);
    console.log("─────────────────────────────────\n");

    // Verificar que todo esté vacío
    const remainingValidations = await prisma.validation.count();
    const remainingTickets = await prisma.ticket.count();
    const remainingOrders = await prisma.order.count();
    const remainingUsers = await prisma.user.count();
    const remainingConfig = await prisma.systemConfig.count();

    if (
      remainingValidations === 0 &&
      remainingTickets === 0 &&
      remainingOrders === 0 &&
      remainingUsers === 0 &&
      remainingConfig === 0
    ) {
      console.log("✅ Verificación: Base de datos completamente vacía\n");
    } else {
      console.log("⚠️  ADVERTENCIA: Aún quedan registros:");
      if (remainingValidations > 0)
        console.log(`   - Validaciones: ${remainingValidations}`);
      if (remainingTickets > 0)
        console.log(`   - Tickets: ${remainingTickets}`);
      if (remainingOrders > 0) console.log(`   - Órdenes: ${remainingOrders}`);
      if (remainingUsers > 0) console.log(`   - Usuarios: ${remainingUsers}`);
      if (remainingConfig > 0)
        console.log(`   - Configuración: ${remainingConfig}`);
      console.log("");
    }
  } catch (error) {
    console.error("\n❌ Error durante la limpieza:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar con confirmación
console.log(
  "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de la base de datos",
);
console.log("⚠️  Esta acción NO se puede deshacer\n");

// Ejecutar directamente (comentá estas líneas si querés agregar confirmación manual)
cleanDatabase()
  .then(() => {
    console.log("🎉 Proceso completado exitosamente");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  });
