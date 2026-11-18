import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Blog Outline to Article Generator",
  description:
    "Outline-first article writer. Type your outline, the agent researches each section via web_search + page_reader, drafts with inline [^c1] citations, lets you regenerate any section, and exports to Markdown/MDX.",
  keywords: [
    "blog outline",
    "article generator",
    "AI writing",
    "research-backed drafting",
    "citation tracking",
    "Next.js",
    "Prisma",
    "z-ai-web-dev-sdk",
  ],
  authors: [{ name: "Blog Outline to Article Generator" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
