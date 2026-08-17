import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cairo } from "@/lib/fonts";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP — Enterprise Management",
  description: "ERP SaaS — accounting, inventory, manufacturing, HR, and more",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("erp-locale")?.value;
  const locale = cookieLocale === "ar" || cookieLocale === "en" ? cookieLocale : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={cairo.variable}>
      <body>
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}