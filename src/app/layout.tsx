import type { Metadata } from "next";
import {
  Instrument_Sans,
  Luckiest_Guy,
  Montserrat,
  Schoolbell,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const luckiestGuy = Luckiest_Guy({
  variable: "--font-luckiest-guy",
  subsets: ["latin"],
  weight: "400",
});

const schoolbell = Schoolbell({
  variable: "--font-schoolbell",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Katalis - Discover, Act, Connect",
  description: "A talent discovery and development platform for children",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${montserrat.variable} ${luckiestGuy.variable} ${schoolbell.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
