import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Smart City Intelligence System",
  description: "Real-time urban monitoring, flood simulation, and city weakness analysis for Bangalore",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`}>
      <body className="h-full overflow-hidden bg-[#0a0e1a] text-white">
        {children}
      </body>
    </html>
  );
}
