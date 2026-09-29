import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Changes AI",
  description: "Human-readable AI summaries for GitHub changes",
  applicationName: "GitHub Changes",
  appleWebApp: { capable: true, title: "GitHub Changes", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#080a0f", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <div className="nav"><div className="navInner">
      <Link className="brand" href="/">GitHub Changes</Link>
      <Link href="/daily">Daily</Link>
      <Link href="/ask">Ask AI</Link>
      <Link href="/search">Search</Link>
      <Link href="/settings/ai">Settings</Link>
    </div></div>
    <main className="shell">{children}</main>
  </body></html>;
}
