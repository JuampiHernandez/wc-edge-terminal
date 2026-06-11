import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Subscriber = {
  email: string;
  name?: string | null;
  teams: string[];
  updatedAt: number;
};

type SubscriptionRow = {
  user_id: string;
  teams: string[];
  display_name: string | null;
  updated_at: string;
};

export async function upsertSubscriber(
  userId: string,
  teams: string[],
  name?: string | null,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("digest_subscriptions")
    .upsert(
      {
        user_id: userId,
        teams,
        display_name: name ?? null,
        digest_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id, teams, display_name, updated_at")
    .single();

  if (error) throw new Error(error.message);

  const row = data as SubscriptionRow;
  return {
    email: "",
    name: row.display_name,
    teams: row.teams,
    updatedAt: new Date(row.updated_at).getTime(),
  } satisfies Subscriber;
}

export async function getSubscriberForUser(userId: string): Promise<Subscriber | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("digest_subscriptions")
    .select("teams, display_name, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Pick<SubscriptionRow, "teams" | "display_name" | "updated_at">;
  return {
    email: "",
    name: row.display_name,
    teams: row.teams ?? [],
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data: subs, error } = await admin
    .from("digest_subscriptions")
    .select("user_id, teams, display_name, updated_at")
    .eq("digest_enabled", true)
    .not("teams", "eq", "{}");

  if (error) {
    console.warn("[subscribers] list failed:", error.message);
    return [];
  }

  const rows = (subs ?? []) as SubscriptionRow[];
  if (rows.length === 0) return [];

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (usersError) {
    console.warn("[subscribers] list users failed:", usersError.message);
    return [];
  }

  const emailById = new Map(
    (usersData.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const out: Subscriber[] = [];
  for (const row of rows) {
    const email = emailById.get(row.user_id);
    if (!email) continue;
    out.push({
      email,
      name: row.display_name,
      teams: row.teams ?? [],
      updatedAt: new Date(row.updated_at).getTime(),
    });
  }
  return out;
}
