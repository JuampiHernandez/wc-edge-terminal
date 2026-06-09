import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./constants";
import { getMessages } from "./index";
import { LOCALE_HEADER, resolveLocale } from "./resolve-locale";

function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "es";
}

export async function getServerLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = headerStore.get(LOCALE_HEADER);
  if (isLocale(fromHeader)) return fromHeader;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const country = headerStore.get("x-vercel-ip-country");
  const acceptLanguage = headerStore.get("accept-language");
  return resolveLocale({ country, acceptLanguage });
}

export async function getServerMessages() {
  return getMessages(await getServerLocale());
}
