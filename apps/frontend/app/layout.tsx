import "./globals.css";
export const metadata = { title: "AigileXperience" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
