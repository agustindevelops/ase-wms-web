import { AuthContextProvider } from "@/context/AuthContext";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const nickainley = localFont({
  src: "../../public/fonts/Nickainley-Normal.otf",
  variable: "--font-nickainley",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ASE WMS Admin | Aniah Social Events",
  description:
    "Warehouse management admin for Aniah Social Events inventory, labels, and operations.",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${nickainley.variable} bg-cream text-brown-800 antialiased`}
      >
        <AuthContextProvider>{children}</AuthContextProvider>
      </body>
    </html>
  );
}
