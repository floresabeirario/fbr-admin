import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FBR Admin",
  description: "Painel de administração — Flores à Beira Rio",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#FAF8F5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`${googleSans.variable} h-full`}>
      <body className="min-h-full font-[var(--font-google-sans)] antialiased">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
