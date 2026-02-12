// scripts/test-unicobros-integration.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function testUnicobros() {
  const apiKey = process.env.UNICOBROS_API_KEY;
  const accessToken = process.env.UNICOBROS_ACCESS_TOKEN;
  const baseUrl =
    process.env.UNICOBROS_BASE_URL || "https://api.unicobros.com.ar";

  console.log("🧪 TEST UNICOBROS INTEGRATION\n");
  console.log("=".repeat(60));

  // Verificar credenciales
  console.log("📋 CREDENCIALES:");
  console.log(
    "  API Key:",
    apiKey ? `${apiKey.substring(0, 8)}...` : "❌ FALTANTE",
  );
  console.log(
    "  Access Token:",
    accessToken ? `${accessToken.substring(0, 8)}...` : "❌ FALTANTE",
  );
  console.log("  Base URL:", baseUrl);
  console.log("");

  if (!apiKey || !accessToken) {
    console.error("❌ Faltan credenciales en .env.local");
    return;
  }

  // Test 1: Payload ACTUAL (el que tenés ahora)
  console.log("=".repeat(60));
  console.log("🧪 TEST 1: PAYLOAD ACTUAL (estructura flat)");
  console.log("=".repeat(60));

  const payloadActual = {
    total: 100,
    description: "Test Entrada Carnavales",
    reference: "TEST-" + Date.now(),
    currency: "ARS",
    test: process.env.NODE_ENV !== "production",
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/unicobros/webhook`,
    customer: {
      email: "test@test.com",
      name: "Juan Test",
      identification: "12345678",
    },
  };

  await testPayload("ACTUAL", payloadActual, baseUrl, apiKey, accessToken);

  // Test 2: Payload ALTERNATIVO 1 (estructura con items)
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST 2: PAYLOAD CON ITEMS (estilo MercadoPago)");
  console.log("=".repeat(60));

  const payloadItems = {
    items: [
      {
        id: "entrada-test",
        title: "Test Entrada Carnavales",
        description: "Prueba de integración",
        quantity: 1,
        unit_price: 100,
        currency_id: "ARS",
      },
    ],
    payer: {
      name: "Juan Test",
      email: "test@test.com",
      identification: {
        type: "DNI",
        number: "12345678",
      },
    },
    back_urls: {
      success: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
      failure: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/failure`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/pending`,
    },
    notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/unicobros/webhook`,
    external_reference: "TEST-ITEMS-" + Date.now(),
  };

  await testPayload("CON ITEMS", payloadItems, baseUrl, apiKey, accessToken);

  // Test 3: Payload ALTERNATIVO 2 (sin campo test)
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST 3: PAYLOAD SIN CAMPO TEST");
  console.log("=".repeat(60));

  const payloadSinTest = {
    total: 100,
    description: "Test Entrada Carnavales",
    reference: "TEST-NO-TEST-" + Date.now(),
    currency: "ARS",
    // ❌ SIN campo 'test'
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/unicobros/webhook`,
    customer: {
      email: "test@test.com",
      name: "Juan Test",
      identification: "12345678",
    },
  };

  await testPayload("SIN TEST", payloadSinTest, baseUrl, apiKey, accessToken);

  console.log("\n" + "=".repeat(60));
  console.log("✅ TESTS COMPLETADOS");
  console.log("=".repeat(60));
  console.log("\n💡 Revisá los resultados arriba para ver cuál funcionó\n");
}

async function testPayload(
  nombre: string,
  payload: unknown,
  baseUrl: string,
  apiKey: string,
  accessToken: string,
) {
  try {
    console.log(`\n📤 Enviando payload ${nombre}...`);
    console.log("Body:", JSON.stringify(payload, null, 2));

    const response = await fetch(`${baseUrl}/p/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-access-token": accessToken,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    console.log("\n📥 RESPUESTA:");
    console.log("  Status:", response.status, response.statusText);
    console.log(
      "  Headers:",
      JSON.stringify(Object.fromEntries(response.headers), null, 2),
    );

    if (response.ok) {
      console.log("  ✅ SUCCESS");
      try {
        const data = JSON.parse(responseText);
        console.log("  Body:", JSON.stringify(data, null, 2));

        if (data.data?.id && data.data?.url) {
          console.log("\n  🎉 ¡FUNCIONA! ID:", data.data.id);
          console.log("  🔗 URL:", data.data.url);
        }
      } catch {
        console.log("  Body (raw):", responseText);
      }
    } else {
      console.log("  ❌ ERROR");
      console.log("  Body:", responseText);

      // Diagnóstico del error
      if (response.status === 400) {
        console.log("\n  💡 Error 400 = Estructura del body incorrecta");
      } else if (response.status === 401 || response.status === 403) {
        console.log("\n  💡 Error 401/403 = Credenciales incorrectas");
      } else if (response.status === 404) {
        console.log("\n  💡 Error 404 = Endpoint incorrecto");
      }
    }
  } catch (error) {
    console.error("\n  ❌ EXCEPTION:", error);
  }
}

testUnicobros();
