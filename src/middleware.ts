import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, resolveLocale, LOCALE_HEADER } from "@/lib/i18n";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const country = request.headers.get("x-vercel-ip-country");
  const acceptLanguage = request.headers.get("accept-language");
  const locale = resolveLocale({ cookie: cookieLocale, country, acceptLanguage });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (cookieLocale !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  if (
    request.nextUrl.pathname === "/api/terminal" ||
    request.nextUrl.pathname === "/api/cron/digest" ||
    request.nextUrl.pathname === "/api/calendar"
  ) {
    return response;
  }

  response = await updateSession(request, response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
