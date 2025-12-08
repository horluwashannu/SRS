import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Reconciliation",
  description: "Created by Doveshub",
  generator: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Inline JS: Prevent refresh/unload and keep session alive */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // 🔒 Disable manual refresh (F5, Ctrl+R, Cmd+R)
              document.addEventListener('keydown', function(e) {
                if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r') || (e.metaKey && e.key.toLowerCase() === 'r')) {
                  e.preventDefault();
                  alert('🔒 Refresh is disabled to prevent data loss.');
                }
              });

              // 🔒 Warn before closing tab/window
              window.addEventListener('beforeunload', function(e) {
                e.preventDefault();
                e.returnValue = '';
              });

              // 🧩 Keep-alive session heartbeat
              let lastPing = Date.now();
              const keepAlive = setInterval(() => {
                console.debug('🟢 Keep-alive ping at', new Date().toLocaleTimeString());
                lastPing = Date.now();
                window.__activeReconSession = { lastPing };
              }, 1000 * 60); // every 1 min

              // User interaction also refreshes session timer
              ['mousemove', 'keydown', 'click'].forEach(evt => {
                window.addEventListener(evt, () => { lastPing = Date.now(); });
              });
            `,
          }}
        />
      </head>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} bg-white text-gray-900`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
