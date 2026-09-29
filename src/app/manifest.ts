import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GitHub Changes AI",
    short_name: "GH Changes",
    description: "AI summaries for GitHub changes",
    start_url: "/",
    display: "standalone",
    background_color: "#080a0f",
    theme_color: "#080a0f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
