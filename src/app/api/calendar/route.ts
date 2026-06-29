import {
  filteredCalendarIcs,
  fullCalendarIcs,
  parseTeamQuery,
  roundOf32CalendarIcs,
} from "@/lib/calendar-ics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const round = params.get("round")?.toLowerCase();
  if (round === "r32" || round === "32") {
    const body = roundOf32CalendarIcs();
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="world_cup_2026_r32.ics"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const teams = parseTeamQuery(params.get("teams"));
  const body = teams.length > 0 ? filteredCalendarIcs(teams) : fullCalendarIcs();

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="world_cup_2026.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
