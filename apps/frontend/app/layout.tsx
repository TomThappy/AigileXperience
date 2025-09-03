import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata = { title: "AigileXperience" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const Right = <></>;
  return (
    <html lang="de">
      <body className="antialiased">
        <AppShell right={Right}>{children}</AppShell>
      </body>
    </html>
  );
}
