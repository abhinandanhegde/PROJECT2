import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BugNexus — Deterministic Bug Tracking",
  description:
    "BugNexus: a production-grade bug tracker with lifecycle state control, per-project access, and deterministic, instant intelligence",
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
