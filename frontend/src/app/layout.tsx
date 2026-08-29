import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T2 Bug Tracker",
  description: "Modern developer bug-tracking platform",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark';document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
