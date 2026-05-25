import "./globals.css";
import AppProviders from "@/components/AppProviders";
import { Analytics } from "@vercel/analytics/next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Travelport",
  description: "Travelport demo",
  icons: {
    icon: "/travelport-mark.svg",
    apple: "/travelport-mark.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}

