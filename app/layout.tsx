import type { Metadata } from "next";
import { Cabin, Albert_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/shared/Providers";

const cabin = Cabin({
  subsets: ["latin"],
  variable: "--font-cabin",
  display: "swap",
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-albert-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Pengadaan & Inventory",
  description: "Sistem Pengadaan & Inventory",
  keywords: ["Pengadaan", "Inventory", "Sistem"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${cabin.variable} ${albertSans.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
