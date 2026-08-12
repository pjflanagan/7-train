import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.scss";
import { SubwayTileBackground } from "../components/elements/SubwayTileBackground/SubwayTileBackground";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

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
      <body className={jakarta.className}>
        {children}
        <Toaster />
        <SubwayTileBackground />
      </body>
    </html>
  );
}
