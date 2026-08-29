import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Booker — AI Ebook Reader",
  description: "A mobile-first EPUB & TXT reader with AI-powered help.",
  applicationName: "Booker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Booker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iOS Safari: without this, the double-tap zoom gesture recognizer swallows
  // the second tap of a fast double-tap (no touchstart/touchend fires), which
  // breaks the tap-word-then-tap-again translate flow. Pinch zoom on iOS stays
  // available (WebKit exempts it for accessibility).
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0c0e",
};

const themeInitScript = `
(function(){try{var raw=localStorage.getItem('ebook-reader:settings');var theme='dark';if(raw){var parsed=JSON.parse(raw);theme=(parsed&&parsed.state&&parsed.state.theme)||'dark';}if(theme==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){document.documentElement.classList.add('dark');}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
