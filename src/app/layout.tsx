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

export const metadata: Metadata = {
  title: "IIM Bound",
  description:
    "A daily logbook for CAT preparation: drills with a timer, mocks scored in attempts and accuracy, syllabus coverage and an error log with causes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
