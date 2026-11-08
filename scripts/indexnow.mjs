// Tells Bing (and other IndexNow search engines) which moarge.com pages exist or changed.
// Run after a deploy that changes public pages: node scripts/indexnow.mjs
// The key is public by design; it proves the site owns the key file at /2d3d6dd9fd0decb066b922678f10131e.txt.
const HOST = "www.moarge.com";
const KEY = "2d3d6dd9fd0decb066b922678f10131e";

const sitemap = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (urls.length === 0) throw new Error("No URLs found in the sitemap.");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: sent ${urls.length} URLs, answer ${response.status}`);
if (!response.ok && response.status !== 202) process.exit(1);
