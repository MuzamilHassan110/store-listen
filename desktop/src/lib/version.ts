export function compareVersions(current: string, other: string): number {
  const a = current.split(".").map((part) => Number.parseInt(part.replace(/\D/g, ""), 10) || 0);
  const b = other.split(".").map((part) => Number.parseInt(part.replace(/\D/g, ""), 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

export function isBelowMinimum(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) < 0;
}
