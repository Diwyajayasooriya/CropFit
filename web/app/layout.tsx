import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  AuthGuard,
  LayoutWrapper,
  ToastContainer,
  ErrorBoundary,
} from "@/components";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CropFit — Smart Greenhouse IoT Hub",
  description:
    "Offline-resilient edge gateway for smart greenhouse device orchestration, telemetry, and automation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
        <ErrorBoundary>
          <AuthGuard>
            <LayoutWrapper>{children}</LayoutWrapper>
            <ToastContainer />
          </AuthGuard>
        </ErrorBoundary>
      </body>
    </html>
  );
}
