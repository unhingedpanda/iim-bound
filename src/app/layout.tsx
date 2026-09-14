import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Archivo, Instrument_Sans } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

/**
 * A publishable key is what ClerkProvider needs to not throw; a missing one
 * (a bare preview with no Clerk configured) mounts the pages without Clerk,
 * so the landing and demo render and the login page shows its notice.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const metadata: Metadata = {
  title: "IIM Bound",
  description:
    "A daily logbook for CAT preparation: drills with a timer, mocks scored in attempts and accuracy, syllabus coverage and an error log with causes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable}`}>
      <body>
        {PUBLISHABLE_KEY ? (
          <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
            {children}
            <Analytics />
            <SpeedInsights />
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
