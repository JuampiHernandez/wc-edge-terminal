import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/Providers";
import { getServerLocale, getServerMessages } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerMessages();
  return {
    title: t.meta.title,
    description: t.meta.description,
    applicationName: "World Cup Terminal",
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      siteName: "World Cup Terminal",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.title,
      description: t.meta.description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isCal=location.pathname==="/calendar"||location.pathname.indexOf("/calendar/")===0;if(isCal){var fromApp=false;try{fromApp=sessionStorage.getItem("wc-from-app")==="1"||(document.referrer&&new URL(document.referrer).origin===location.origin)}catch(e){}if(fromApp){var t=localStorage.getItem("wc-edge-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);return}}document.documentElement.setAttribute("data-theme","light");return}var t=localStorage.getItem("wc-edge-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="h-dvh overflow-hidden">
        <Providers locale={locale}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
