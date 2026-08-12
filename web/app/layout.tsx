import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "月光唱片 · 用你的键盘，弹一首歌",
  description: "跟着双行歌词，按亮起的电脑键盘。弹错不会跳过，弹对才继续。",
  applicationName: "月光唱片",
  keywords: ["键盘钢琴", "网页钢琴", "歌词钢琴", "音乐游戏"],
  openGraph: {
    title: "月光唱片 · 用你的键盘，弹一首歌",
    description: "不必会钢琴，让电脑键盘替你唱。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "月光唱片" }],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
