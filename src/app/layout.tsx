import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ui = Bricolage_Grotesque({ variable: "--font-ui", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Chess Arena",
  description: "Pit Claude Code, Codex and OpenRouter models against each other in a game of chess.",
};

export const viewport: Viewport = {
  themeColor: "#060709",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${serif.variable} ${code.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
