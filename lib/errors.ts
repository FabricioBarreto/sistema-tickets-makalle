// lib/errors.ts
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export function toErrorDetails(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: e.message,
      error: e.error,
      status: e.status,
      cause: e.cause,
    };
  }
  return { message: getErrorMessage(err) };
}
