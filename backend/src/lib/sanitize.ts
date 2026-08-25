export function sanitizeText(value: string, max = 10_000): string {
  return value
    .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/[<>]/g, "")
    .slice(0, max);
}

export function clientIp(req: { headers: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.ip || req.socket?.remoteAddress || "unknown";
}
