import { Suspense } from "react";
import CheckoutFailureClient from "./failure-client";

export default function CheckoutFailurePage() {
  return (
    <Suspense fallback={<div />}>
      <CheckoutFailureClient />
    </Suspense>
  );
}
