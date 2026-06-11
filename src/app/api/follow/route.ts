import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscriberForUser, upsertSubscriber } from "@/lib/subscribers";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });
  }

  const sub = await getSubscriberForUser(user.id);
  return NextResponse.json({ teams: sub?.teams ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });
  }

  const body = (await req.json()) as { teams?: string[] };
  const teams = Array.isArray(body.teams) ? body.teams.filter((t) => typeof t === "string") : [];
  if (teams.length === 0) {
    return NextResponse.json({ error: "Select at least one team" }, { status: 400 });
  }

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  await upsertSubscriber(user.id, teams, name);
  return NextResponse.json({ ok: true, teams, digest: "daily at 8pm UTC" });
}
