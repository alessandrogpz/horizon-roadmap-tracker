import type { MetadataRoute } from "next";

// The landing page is the part meant to be found. The app itself is a single
// page that renders from the browser's own storage, so there is nothing for a
// crawler to read there, and the API routes answer only to signed-in requests.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: "https://horizonroadmap.com/sitemap.xml",
  };
}
