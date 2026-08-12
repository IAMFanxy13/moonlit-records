import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the moonlit song catalog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en"/);
  assert.match(html, /<title>Moonlit Records · Your Keyboard, in Concert<\/title>/i);
  assert.match(html, /Find your song/);
  assert.match(html, /Twinkle, Twinkle, Little Star/);
  assert.match(html, /Search title, artist, or lyric/);
  assert.match(html, /https:\/\/moonlit-records-piano\.nieqingcao-stu1\.chatgpt\.site\/og\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});
