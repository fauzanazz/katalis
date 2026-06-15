/**
 * Discriminated result convention for TanStack `createServerFn` handlers.
 *
 * Next.js API routes encoded meaning in HTTP status codes (400/401/409/429/500)
 * plus error codes the client branched on. Server functions have no native HTTP
 * status model, so EXPECTED outcomes (invalid credentials, rate limited, email
 * exists, …) return a `Result` object with `ok: false` + a stable `error` code
 * and optional `message`. The RPC call still succeeds (HTTP 200), so the client
 * reads `result.ok` / `result.error` / `result.message` directly.
 *
 * Reserve `throw` for genuinely unexpected failures (caught as a 500 by the
 * client's try/catch), matching the old `500 internal` path.
 */

export type Ok<T> = { ok: true } & T;
export type Err = { ok: false; error: string; message?: string };
export type Result<T> = Ok<T> | Err;

export function ok<T extends object>(data: T): Ok<T> {
  return { ok: true, ...data };
}

export function ok0(): Ok<Record<never, never>> {
  return { ok: true };
}

export function err(error: string, message?: string): Err {
  return message ? { ok: false, error, message } : { ok: false, error };
}
