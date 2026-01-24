"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refrescar cada 5 minutos en lugar de constantemente
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}
