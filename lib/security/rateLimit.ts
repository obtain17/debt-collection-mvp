type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Proxy runs on the Node.js runtime as a single long-lived process on our
// deployment target, so this in-memory map persists across requests. If this
// ever runs on an edge/multi-instance runtime, swap for a shared store (e.g.
// Redis) since each instance would otherwise track its own counts.
const MAX_TRACKED_KEYS = 10_000;

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
