import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { PwaSetup } from "@/components/PwaSetup";
import { EARLY_CAPTURE_SCRIPT } from "@/lib/pwa";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "FinSage.ai — AI research for Indian investors",
  description:
    "Ask anything about NSE/BSE stocks, sectors and personal finance. FinSage combines live news, fundamentals and AI reasoning into one clear answer.",
  applicationName: "FinSage",
  appleWebApp: { capable: true, title: "FinSage", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#062418",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_CAPTURE_SCRIPT }} />
      </head>
      <body className="font-sans">
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
