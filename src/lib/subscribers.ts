// Simple file-backed store for email digest subscribers (dev / single-node).
// For production at scale, swap to Postgres / Supabase.

import { promises as fs } from "fs";
import path from "path";

export type Subscriber = {
  email: string;
  name?: string | null;
  teams: string[]; // team codes
  updatedAt: number;
};

const FILE = path.join(process.cwd(), ".data", "subscribers.json");

async function ensure(): Promise<Subscriber[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Subscriber[];
  } catch {
    return [];
  }
}

async function save(rows: Subscriber[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

export async function upsertSubscriber(email: string, teams: string[], name?: string | null) {
  const rows = await ensure();
  const i = rows.findIndex((r) => r.email === email);
  const row: Subscriber = { email, name, teams, updatedAt: Date.now() };
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  await save(rows);
  return row;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  return ensure();
}
