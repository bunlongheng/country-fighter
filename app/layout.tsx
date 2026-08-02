import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./components/RegisterServiceWorker";

const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://country-fighter-bheng.vercel.app"),
  title: "Country Fighter",
  description:
    "Pick any 2 of the world's 194 countries, watch their glossy 3D flag marbles battle it out in a bouncy arena, and crown a champion. A tiny, playful game for kids.",
  applicationName: "Country Fighter",
  manifest: "/manifest.json",
  // Big link-preview card when shared (hero auto-linked from app/opengraph-image.png).
  openGraph: {
    title: "Country Fighter",
    description: "Pick 2 of 194 countries and watch their 3D flag marbles battle in a bouncy arena. Crown a champion.",
    url: "https://country-fighter-bheng.vercel.app",
    siteName: "Country Fighter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Country Fighter",
    description: "Pick 2 of 194 countries and watch their 3D flag marbles battle in a bouncy arena.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Country Fighter",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fredoka.variable} h-full antialiased`}>
      <body className="min-h-full" suppressHydrationWarning>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
