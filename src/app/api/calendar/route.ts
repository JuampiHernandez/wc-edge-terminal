import { filteredCalendarIcs, fullCalendarIcs, normalizeCalendarIcs, parseTeamQuery } from "@/lib/calendar-ics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const teams = parseTeamQuery(new URL(req.url).searchParams.get("teams"));
  const raw = teams.length > 0 ? filteredCalendarIcs(teams) : fullCalendarIcs();
  const body = normalizeCalendarIcs(raw);

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="world_cup_2026.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
