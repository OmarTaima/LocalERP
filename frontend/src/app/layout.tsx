import type { Metadata } from "next";
import { cairo } from "@/lib/fonts";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP — Enterprise Management",
  description: "ERP SaaS — accounting, inventory, manufacturing, HR, and more",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cairo.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}