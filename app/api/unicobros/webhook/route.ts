// app/api/unicobros/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";

// 🛑 WEBHOOK TEMPORALMENTE DESHABILITADO
// Para detener el spam de Unicobros mientras se configura correctamente

export async function POST(request: NextRequest) {
  // Devolver 200 OK sin procesar nada
  // Unicobros recibe confirmación pero no procesamos
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    status: "disabled",
    message: "Webhook temporalmente deshabilitado - configurando Unicobros",
    timestamp: new Date().toISOString(),
  });
}
