import type { Metadata } from "next";
import { getServerMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerMessages();
  const title = `${t.calendar.title} · World Cup Terminal`;
  return {
    title,
    description: t.calendar.subtitle,
    openGraph: {
      title,
      description: t.calendar.subtitle,
      siteName: "World Cup Terminal",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.calendar.subtitle,
    },
  };
}

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
