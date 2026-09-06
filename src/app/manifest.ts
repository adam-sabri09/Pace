import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pace — Adaptive Study Planner",
    short_name: "Pace",
    description: "Personalised day-by-day study plans for high school students.",
    start_url: "/today",
    display: "standalone",
    background_color: "#fbf8ff",
    theme_color: "#23422a",
    icons: [
      { src: "/pace-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/pace-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
