import { NextResponse } from "next/server";
import { sendTicketEmailWithGmail } from "@/lib/email-gmail";

export async function GET() {
  console.log("🔍 Testing Gmail configuration...");
  console.log("GMAIL_USER:", process.env.GMAIL_USER);
  console.log(
    "GMAIL_APP_PASSWORD:",
    process.env.GMAIL_APP_PASSWORD ? "✅ Set" : "❌ Not set",
  );

  const result = await sendTicketEmailWithGmail({
    to: "fabriciobarreto2610@gmail.com",
    orderNumber: "TEST-001",
    buyerName: "Fabricio Test",
    tickets: [
      {
        id: "test-1",
        qrCode: "ABC123XYZ",
        order: {
          orderNumber: "TEST-001",
          buyerName: "Fabricio Test",
        },
      },
    ],
    eventName: "Carnavales Makallé 2026",
    eventDate: "15 de febrero de 2026",
    eventLocation: "Makallé, Chaco",
    downloadUrl: "https://test.com/download/test",
  });

  return NextResponse.json(result);
}
