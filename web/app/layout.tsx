import type { Metadata } from "next";
import "./globals.css";

export function buildMetadata(origin: string): Metadata {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const title = "Moonlit Records · Your Keyboard, in Concert";
  const description = "A free piano with lyric-initial guidance, expressive sampled voices, and a concert-hall tail that stays until the final resonance fades.";

  return {
    title,
    description,
    applicationName: "Moonlit Records",
    keywords: ["keyboard piano", "web piano", "lyric piano", "free piano", "music game"],
    openGraph: {
      title,
      description,
      type: "website",
      images: [{
        url: `${normalizedOrigin}/og.png`,
        width: 1200,
        height: 630,
        alt: "Moonlit Records · Your Keyboard, in Concert",
      }],
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export const metadata = buildMetadata(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://moonlit-records-piano.nieqingcao-stu1.chatgpt.site",
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
