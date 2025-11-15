"use client";

import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import BroadcastListener from "./BroadcastListener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
        />
      </head>

      <body className={geistSans.variable + " " + geistMono.variable + " antialiased"}>
        {/* GLOBAL BROADCAST LISTENER */}
        <BroadcastListener />

        {children}
      </body>
    </html>
  );
}