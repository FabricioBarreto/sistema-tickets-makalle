// scripts/test-unicobros-endpoints.ts
/**
 * Script para probar diferentes endpoints de Unicobros
 * Ejecutar: npx tsx scripts/test-unicobros-endpoints.ts
 */

const UNICOBROS_ACCESS_TOKEN = process.env.UNICOBROS_ACCESS_TOKEN;
const UNICOBROS_BASE_URL =
  process.env.UNICOBROS_BASE_URL || "https://api.unicobros.com.ar";

// Lista de posibles endpoints para probar
const POSSIBLE_ENDPOINTS = [
  "/v1/checkout/preferences",
  "/v1/preferences",
  "/v1/payment/preferences",
  "/v1/checkout",
  "/checkout/preferences",
  "/api/v1/checkout/preferences",
  "/api/v1/preferences",
  "/preferences",
  "/v1/payment-buttons",
  "/v1/orders",
];

// Posibles métodos de autenticación
const AUTH_METHODS = [
  {
    name: "Bearer Token",
    header: { Authorization: `Bearer ${UNICOBROS_ACCESS_TOKEN}` },
  },
  { name: "X-API-Key", header: { "X-API-Key": UNICOBROS_ACCESS_TOKEN } },
  { name: "X-Auth-Token", header: { "X-Auth-Token": UNICOBROS_ACCESS_TOKEN } },
  {
    name: "Basic Auth",
    header: {
      Authorization: `Basic ${Buffer.from(UNICOBROS_ACCESS_TOKEN + ":").toString("base64")}`,
    },
  },
];

const testBody = {
  items: [
    {
      id: "test-123",
      title: "Test Product",
      quantity: 1,
      unit_price: 1000,
      currency_id: "ARS",
    },
  ],
  payer: {
    name: "Test User",
    email: "test@test.com",
  },
  external_reference: "test-order-123",
};

async function testEndpoint(endpoint: string, authMethod: any) {
  const url = `${UNICOBROS_BASE_URL}${endpoint}`;

  try {
    console.log(`\n🧪 Testing: ${authMethod.name} → ${endpoint}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authMethod.header,
      },
      body: JSON.stringify(testBody),
    });

    const status = response.status;
    const statusText = response.statusText;

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS! Status: ${status}`);
      console.log("Response:", JSON.stringify(data, null, 2));
      return { success: true, endpoint, authMethod: authMethod.name, data };
    } else {
      const text = await response.text();
      console.log(`❌ Failed: ${status} ${statusText}`);

      // Mostrar solo las primeras líneas si es HTML
      if (text.includes("<!DOCTYPE")) {
        const firstLine =
          text.split("\n").find((line) => line.includes("<pre>")) ||
          text.split("\n")[0];
        console.log("Response:", firstLine);
      } else {
        console.log("Response:", text.substring(0, 200));
      }

      return {
        success: false,
        endpoint,
        authMethod: authMethod.name,
        status,
        error: text,
      };
    }
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : error}`);
    return { success: false, endpoint, authMethod: authMethod.name, error };
  }
}

async function main() {
  console.log("🚀 Unicobros Endpoint Tester");
  console.log("============================");
  console.log(`Base URL: ${UNICOBROS_BASE_URL}`);
  console.log(
    `Access Token: ${UNICOBROS_ACCESS_TOKEN ? "✅ Configured" : "❌ Missing"}`,
  );

  if (!UNICOBROS_ACCESS_TOKEN) {
    console.error(
      "\n❌ ERROR: UNICOBROS_ACCESS_TOKEN no está configurado en .env.local",
    );
    process.exit(1);
  }

  const results = [];

  // Probar todas las combinaciones
  for (const authMethod of AUTH_METHODS) {
    for (const endpoint of POSSIBLE_ENDPOINTS) {
      const result = await testEndpoint(endpoint, authMethod);
      results.push(result);

      // Si encontramos un endpoint exitoso, mostrar y salir
      if (result.success) {
        console.log("\n\n🎉 ¡ENCONTRADO ENDPOINT CORRECTO!");
        console.log("================================");
        console.log(`Endpoint: ${endpoint}`);
        console.log(`Auth Method: ${authMethod.name}`);
        console.log(`\nActualiza lib/unicobros.ts con:`);
        console.log(`const endpoint = \`\${baseUrl}${endpoint}\`;`);
        console.log(`// Y usa: ${authMethod.name}`);
        return;
      }

      // Pequeña pausa para no saturar la API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log("\n\n❌ No se encontró un endpoint funcional");
  console.log("========================================");
  console.log("\n📝 Próximos pasos:");
  console.log("1. Contacta a Unicobros: soporte@unicobros.com");
  console.log("2. Solicita la documentación oficial de API");
  console.log("3. Pregunta por:");
  console.log("   - Endpoint correcto para crear preferencias");
  console.log("   - Método de autenticación (Bearer, API Key, etc.)");
  console.log("   - Estructura del body requerido");
  console.log("   - URL base correcta (producción y sandbox)");
}

main().catch(console.error);
