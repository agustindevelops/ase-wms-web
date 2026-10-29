import { AuthContextProvider } from "@/context/AuthContext";
import { QueryProvider } from "@/lib/query/QueryProvider";
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
  title: "WIS Admin | Warehouse Inventory System",
  description:
    "Warehouse inventory admin for catalog, orders, and day-to-day operations.",
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
        <QueryProvider>
          <AuthContextProvider>{children}</AuthContextProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
