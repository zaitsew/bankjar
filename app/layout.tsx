import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { NavLinks } from "../components/NavLinks";
import { DESCRIPTION, SITE_NAME, siteUrl } from "../components/site";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display-face",
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: `${SITE_NAME}: which bank offer pays you most?`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: which bank offer pays you most?`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary", title: SITE_NAME, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

/**
 * Runs before first paint. `?v=a|b` picks the layout, saves it in a cookie and
 * marks <html data-variant>. Pages that render per request read the same cookie.
 */
const VARIANT_SCRIPT = `(function(){try{var m=location.search.match(/[?&]v=(a|b)(?:&|$)/);var c=document.cookie.match(/(?:^|; )bj_v=(a|b)/);var v=m?m[1]:c?c[1]:"a";if(m)document.cookie="bj_v="+v+"; path=/; max-age=31536000; samesite=lax";document.documentElement.setAttribute("data-variant",v)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: VARIANT_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <aside className="rail" aria-label="Site">
          <Logo word={false} />
          <NavLinks label="Primary" />
        </aside>
        <div className="shell">
          <header className="masthead">
            <Logo />
            <NavLinks label="Primary, top bar" />
          </header>
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
