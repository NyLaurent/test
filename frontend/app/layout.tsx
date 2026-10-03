import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/toast/toast-provider";
import "./globals.css";

const powerGrotesk = localFont({
  src: [
    { path: "../public/assets/font/PowerGrotesk-UltraLight.ttf", weight: "200", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-UltraLightItalic.ttf", weight: "200", style: "italic" },
    { path: "../public/assets/font/PowerGrotesk-Light.ttf", weight: "300", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "../public/assets/font/PowerGrotesk-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-Italic.ttf", weight: "400", style: "italic" },
    { path: "../public/assets/font/PowerGrotesk-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../public/assets/font/PowerGrotesk-Heavy.ttf", weight: "700", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-HeavyItalic.ttf", weight: "700", style: "italic" },
    { path: "../public/assets/font/PowerGrotesk-UltraBold.ttf", weight: "800", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-UltraBoldItalic.ttf", weight: "800", style: "italic" },
    { path: "../public/assets/font/PowerGrotesk-Black.ttf", weight: "900", style: "normal" },
    { path: "../public/assets/font/PowerGrotesk-BlackItalic.ttf", weight: "900", style: "italic" },
  ],
  variable: "--font-power-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dataset Request Desk",
  description: "Internal robotics dataset request platform for intake, assignment, and review.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${powerGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
