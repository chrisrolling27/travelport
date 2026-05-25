import "./globals.css";
import AppProviders from "@/components/AppProviders";
import { Analytics } from "@vercel/analytics/next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "CardPortal",
  description: "Adyen Balance Platform fintech demo",
  icons: {
    icon: "/cardportal-mark.svg",
    apple: "/cardportal-mark.svg",
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

