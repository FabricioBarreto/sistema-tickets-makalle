import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Validador QR - Carnaval Makallé",
  description: "Aplicación de validación de entradas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Validador QR",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#9333ea",
};

export default function OperadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
