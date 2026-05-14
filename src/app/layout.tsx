import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { InstallPrompt } from "@/components/install-prompt";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FBR Admin",
  description: "Painel de administração — Flores à Beira Rio",
  applicationName: "FBR Admin",
  appleWebApp: {
    capable: true,
    title: "FBR Admin",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: { url: "/favicon/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`${googleSans.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-[var(--font-google-sans)] antialiased">
        <Providers>
          <TooltipProvider>
            {children}
            <Toaster />
            <InstallPrompt />
          </TooltipProvider>
        </Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
