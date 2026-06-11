import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/calendar.ics", destination: "/api/calendar" }];
  },
};

export default nextConfig;
