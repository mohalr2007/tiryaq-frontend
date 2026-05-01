import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import GlobalChrome from "@/components/GlobalChrome";
import {
  isValidLanguage,
  type AppLanguage,
} from "@/lib/i18n-config";

function resolveMetadataBase() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "https://tiryaq-chi.vercel.app";

  try {
    return new URL(configuredOrigin);
  } catch {
    return new URL("https://tiryaq-chi.vercel.app");
  }
}

const metadataBase = resolveMetadataBase();

export const metadata: Metadata = {
  metadataBase,
  applicationName: "TIRYAQ",
  title: "TIRYAQ",
  description: "Plateforme médicale intelligente TIRYAQ",
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    title: "TIRYAQ",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { rel: "icon", url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "TIRYAQ",
    url: "/",
    title: "TIRYAQ",
    description: "Plateforme médicale intelligente TIRYAQ",
    images: [
      {
        url: "/images/logo.png",
        width: 1200,
        height: 630,
        alt: "TIRYAQ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TIRYAQ",
    description: "Plateforme médicale intelligente TIRYAQ",
    images: ["/images/logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get("theme")?.value;
  const savedLanguageValue = cookieStore.get("lang")?.value;
  const savedLanguage: AppLanguage = isValidLanguage(savedLanguageValue) ? savedLanguageValue : "fr";
  const isDarkTheme = savedTheme === "dark";
  const htmlClassName = isDarkTheme ? "dark" : undefined;
  const colorScheme = isDarkTheme ? "dark" : "light";

  return (
    <html
      lang={savedLanguage}
      dir={savedLanguage === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={htmlClassName}
      style={{ colorScheme }}
    >
      <head />
      <body className="antialiased">
        <AppProviders initialLanguage={savedLanguage}>
          <GlobalChrome />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
