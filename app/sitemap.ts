import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://horizonroadmap.com/landing", changeFrequency: "monthly", priority: 1 },
    { url: "https://horizonroadmap.com/", changeFrequency: "monthly", priority: 0.5 },
    { url: "https://horizonroadmap.com/privacy", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://horizonroadmap.com/security", changeFrequency: "yearly", priority: 0.3 },
  ];
}
