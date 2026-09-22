import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://horizonroadmap.com/landing", changeFrequency: "monthly", priority: 1 },
    { url: "https://horizonroadmap.com/", changeFrequency: "monthly", priority: 0.5 },
  ];
}
