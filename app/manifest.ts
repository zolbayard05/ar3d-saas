import type { MetadataRoute } from "next";

// Next auto-injects <link rel="manifest"> whenever this file exists — see
// node_modules/next/dist/docs/.../manifest.md. #050505 matches
// styles/themes.css's --color-bg (oklch(0.115 0 0)) — same conversion
// lib/renderThumbnail.ts's BACKDROP_HEX and scripts/generate-pwa-icons.mjs
// already use, so the manifest, the render backdrop, and the icon
// background are all one color, not three separately-eyeballed ones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AR3D",
    short_name: "AR3D",
    description: "Turn a photo into a 3D model you can place in AR.",
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
