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

  if (request.nextUrl.pathname === "/api/terminal" || request.nextUrl.pathname === "/api/cron/digest") {
    return response;
  }

  response = await updateSession(request, response);
  return response;
}

export const config = {
  // Skip the hot, public, cacheable endpoints entirely. Running middleware on
  // them adds an Edge invocation per request and can attach Set-Cookie, which
  // makes the responses uncacheable at the CDN. Locale/session handling isn't
  // needed for these, so excluding them lets the edge serve cached responses
  // without ever invoking a function.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/terminal|api/calendar|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
