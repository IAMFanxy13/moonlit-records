import { describe, expect, it } from "vitest";
import { buildMetadata } from "./layout";

describe("site metadata", () => {
  it("uses international copy and an absolute social image for the request origin", () => {
    const metadata = buildMetadata("https://moonlit.example");

    expect(metadata.title).toBe("Moonlit Records · Your Keyboard, in Concert");
    expect(metadata.description).toContain("free piano");
    expect(metadata.openGraph).toEqual(expect.objectContaining({
      title: "Moonlit Records · Your Keyboard, in Concert",
      images: [expect.objectContaining({ url: "https://moonlit.example/og.png" })],
    }));
  });
});
