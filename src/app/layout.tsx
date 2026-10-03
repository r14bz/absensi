import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/ui/PwaRegister";

export const metadata: Metadata = {
  title: { default: "Absensi", template: "%s · Absensi" },
  description: "Aplikasi absensi karyawan: absen masuk/pulang, riwayat, izin, dan rekap admin.",
  applicationName: "Absensi",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Absensi", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b8a6b" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
