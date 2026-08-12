import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.scss";
import { SubwayTileBackground } from "../components/elements/SubwayTileBackground/SubwayTileBackground";

export const metadata: Metadata = {
  title: "7 Train",
  description: "Plan your weekly workouts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SubwayTileBackground />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
