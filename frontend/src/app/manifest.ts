import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FinSage.ai — AI research for Indian investors",
    short_name: "FinSage",
    description:
      "Ask about NSE/BSE stocks, mutual funds, SIPs and tax. Answers grounded in live Indian market data, with every figure checked.",
    start_url: "/chat?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#062418",
    theme_color: "#062418",
    lang: "en-IN",
    categories: ["finance", "education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Ask FinSage",
        short_name: "Ask",
        url: "/chat?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "SIP calculator",
        short_name: "SIP",
        url: "/?source=shortcut#sip-calculator",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
