import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function createHash(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto
    .createHash("sha256")
    .update(normalized)
    .digest("hex")
    .substring(0, 16);
}

export function createPitchHash(pitchText: string): string {
  return crypto
    .createHash("sha256")
    .update(pitchText.trim())
    .digest("hex")
    .substring(0, 16);
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

export async function writeJsonFile(
  filePath: string,
  data: any,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function readJsonFile<T = any>(
  filePath: string,
): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
