import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { upsertSubscriber } from "@/lib/subscribers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });
  }

  const body = (await req.json()) as { teams?: string[] };
  const teams = Array.isArray(body.teams) ? body.teams.filter((t) => typeof t === "string") : [];
  if (teams.length === 0) {
    return NextResponse.json({ error: "Select at least one team" }, { status: 400 });
  }

  await upsertSubscriber(email, teams, session.user?.name);
  return NextResponse.json({ ok: true, teams, digest: "daily at 8pm UTC" });
}
