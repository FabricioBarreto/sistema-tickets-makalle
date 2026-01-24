import { Suspense } from "react";
import CheckoutPendingClient from "./pending-client";

export default function CheckoutPendingPage() {
  return (
    <Suspense fallback={<div />}>
      <CheckoutPendingClient />
    </Suspense>
  );
}
