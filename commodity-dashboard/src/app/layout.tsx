import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PanganArbitrage",
  description: "Dashboard pemantauan harga komoditas pangan — SP2KP, pedagang, komparasi, arbitrase.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,700&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
