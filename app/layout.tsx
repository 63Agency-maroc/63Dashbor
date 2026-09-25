import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { BootstrapClient } from "@/components/providers/BootstrapClient";

export const metadata: Metadata = {
  title: "63 Agency — Dashboard",
  description: "CRM Admin Dashboard — 63 Agency",
  icons: {
    icon: "/assets/images/brand/darck63.png",
    apple: "/assets/images/brand/darck63.png",
  },
};

/**
 * CSS template : <link> vers public/assets.
 * Ne pas bundler styles.css via import — les url() relatives des fonts casseraient.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" data-bs-theme="light" data-app-sidebar="full" data-color-theme="gold" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/libs/flaticon/css/all/all.css" />
        <link rel="stylesheet" href="/assets/libs/lucide/lucide.css" />
        <link rel="stylesheet" href="/assets/libs/fontawesome/css/all.min.css" />
        <link rel="stylesheet" href="/assets/libs/simplebar/simplebar.css" />
        <link rel="stylesheet" href="/assets/libs/node-waves/waves.css" />
        <link rel="stylesheet" href="/assets/css/styles.css" />
        <link rel="stylesheet" href="/assets/css/app-overrides.css" />
        <meta name="theme-color" content="#C9A24B" />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('nexlink-app-settings')||'{}');var d=document.documentElement;if(s.appTheme)d.setAttribute('data-bs-theme',s.appTheme);d.setAttribute('data-color-theme',s.appColor||'gold');if(s.appSidebar&&window.innerWidth>=1191)d.setAttribute('data-app-sidebar',s.appSidebar);}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <BootstrapClient />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
