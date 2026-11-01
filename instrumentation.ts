import type { Instrumentation } from "next";

export async function register() {}

/** Every error thrown while handling a request on the server goes to our own error log. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logAppError } = await import("./src/lib/error-log");
  const err = error as Error & { digest?: string };
  await logAppError({
    source: "server",
    message: `${err.name || "Error"}: ${err.message || "Unknown error"} (${context.routeType} ${request.method})`,
    path: request.path,
    digest: err.digest,
  });
};
