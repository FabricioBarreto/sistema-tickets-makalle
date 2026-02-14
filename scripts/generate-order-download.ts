import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeBaseUrl(raw: string) {
  let url = (raw || "http://localhost:3000").trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url; // ✅ default seguro para prod
  }
  return url;
}

async function main() {
  const quantity = 5;
  const unitPrice = 3000;
  const totalAmount = quantity * unitPrice;

  const downloadToken = crypto.randomUUID().replace(/-/g, "");

  const order = await prisma.order.create({
    data: {
      orderNumber: "TEST-" + Date.now(),
      buyerName: "Gladys Elisabet",
      buyerEmail: "Wamaesqui@yahoo.com.ar",
      buyerPhone: "3734415050",
      unitPrice,
      quantity,
      totalAmount,
      paymentStatus: "COMPLETED",

      // ✅ Para que NO se mezcle en reportes (filtrá Order.status === ACTIVE en reportes)
      status: "CANCELLED",

      // ✅ Uniques: que no choquen nunca
      mercadoPagoId: "TEST-" + crypto.randomUUID(),
      mercadoPagoStatus: "200",
      downloadToken,

      tickets: {
        create: Array.from({ length: quantity }, () => {
          const code = crypto.randomUUID();
          const qrHash = sha256Hex(code);
          return {
            code,
            qrHash,
            status: "PAID",
          };
        }),
      },
    },
    include: { tickets: true },
  });

  const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL || "");
  const downloadUrl = `${baseUrl}/api/tickets/download/${order.downloadToken}`;

  console.log("✅ OrderId:", order.id);
  console.log("✅ OrderNumber:", order.orderNumber);
  console.log("✅ downloadToken:", order.downloadToken);
  console.log("🔗 Link de descarga:", downloadUrl);
  console.log("Tickets (qrHash):");
  for (const t of order.tickets) {
    console.log("-", t.qrHash);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
