import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KosárRadar",
  description: "A valódi megtakarítás számít."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hu"><body>{children}</body></html>;
}
