import type { Instrumentation } from "next";

// Sunucuda yakalanan her hata (sayfa çizimi, sunucu işlemi, API adresi, proxy) buraya
// düşer. Next.js bunları sadece konsola yazar; burada veritabanına da kaydedilir ki
// Admin "Hata kayıtları" sayfasından görebilsin (bkz. lib/error-log.ts).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Kayıt Node.js ortamında (service role anahtarıyla) yazılır
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { describeError, writeErrorLog } = await import("@/lib/error-log");
  const { message, digest, stack } = describeError(err);
  const agent = request.headers["user-agent"];
  await writeErrorLog({
    source: "server",
    message,
    digest,
    stack,
    path: request.path,
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
    userAgent: Array.isArray(agent) ? agent[0] : agent,
  });
};
