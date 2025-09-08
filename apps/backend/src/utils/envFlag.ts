export function envFlag(name: string, def = false): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return String(v).trim().toLowerCase() === "true";
}
