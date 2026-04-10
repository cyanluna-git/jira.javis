import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReadOnlyProvider } from "@/contexts/ReadOnlyContext";
import { resolveServerAccessContext } from "@/lib/access";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IS Software Portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await resolveServerAccessContext();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReadOnlyProvider initialAccess={access}>
          {children}
        </ReadOnlyProvider>
      </body>
    </html>
  );
}
