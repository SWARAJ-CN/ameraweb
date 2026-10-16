import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { InlineScript } from "@/components/InlineScript";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Amare Handmades · Admin",
    template: "%s · Amare Handmades",
  },
  description:
    "Sales, expenses, products, reports and settings for the Amare Handmades studio.",
  applicationName: "Amare Handmades Admin",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17111c" },
  ],
};

// Applies the saved theme and brand colour before first paint so the page
// never flashes the defaults. HeroUI switches on `data-theme`/`class`, so
// "system" is resolved to a concrete scheme here.
const themeScript = `(function(){try{
var t=localStorage.getItem('amare.theme');
var m=(t==='light'||t==='dark')?t:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
var r=document.documentElement;
r.dataset.theme=m;
r.classList.add(m);
r.classList.remove(m==='dark'?'light':'dark');
var b=localStorage.getItem('amare.brand.vars.v2');
if(b){var v=JSON.parse(b);for(var k in v){if(Object.prototype.hasOwnProperty.call(v,k)){r.style.setProperty(k,v[k]);}}}
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
