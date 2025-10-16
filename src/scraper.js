import axios from "axios";
import * as cheerio from "cheerio";

const url = "https://www.insightsonindia.com/current-affairs-upsc/";

async function getHtml(url) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return cheerio.load(data);
}

function parseDateFromString(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  // Try some common human formats; let Date parse them
  try {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  } catch (_) {}
  return null;
}

function extractPublishedDate($) {
  const metaContent =
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='article:published_time']").attr("content") ||
    $("meta[property='og:updated_time']").attr("content");
  let dt = parseDateFromString(metaContent);
  if (dt) return dt;

  const timeAttr = $("time[datetime]").attr("datetime");
  dt = parseDateFromString(timeAttr);
  if (dt) return dt;

  const timeText = $("time").first().text();
  dt = parseDateFromString(timeText);
  if (dt) return dt;

  const entryDate = $(".entry-date, .posted-on time, .updated").first().text();
  dt = parseDateFromString(entryDate);
  if (dt) return dt;

  try {
    const ld = $("script[type='application/ld+json']").first().text();
    if (ld) {
      const json = JSON.parse(ld);
      const dateStr = json?.datePublished || json?.[0]?.datePublished;
      dt = parseDateFromString(dateStr);
      if (dt) return dt;
    }
  } catch (_) {}
  return null;
}

export async function scrapeCompilationLinks(range) {
  const $ = await getHtml(url);

  const compilationLinks = [];
  $('a, h2 a, .elementor-post__title a').each((_, el) => {
    const title = $(el).text().trim();
    const link = $(el).attr("href");
    if (title.toUpperCase().includes("[COMPILATION]") && link) {
      compilationLinks.push({ title, link });
    }
  });
  console.log(`🔍 Found ${compilationLinks.length} compilation posts`);

  const results = [];
  for (const { title, link } of compilationLinks) {
    console.log(`\n📄 Fetching: ${title}`);
    const $post = await getHtml(link);
    const publishedAt = extractPublishedDate($post);

    if (range && (range.start || range.end) && publishedAt instanceof Date) {
      if (range.start && publishedAt < range.start) {
        console.log(`   ↳ Skipped (before range): ${publishedAt.toISOString()}`);
        continue;
      }
      if (range.end && publishedAt > range.end) {
        console.log(`   ↳ Skipped (after range): ${publishedAt.toISOString()}`);
        continue;
      }
    }

    const downloadLinks = [];

    // Try to find any direct download or PDF URLs in the post
    $post("a").each((_, el) => {
      const href = $post(el).attr("href");
      const text = $post(el).text().toLowerCase();
      const hrefUpper = (href || "").toUpperCase();
      const hrefMatches =
        hrefUpper.includes("MONTHLY") ||
        hrefUpper.includes("CME") ||
        hrefUpper.includes("COMBINED");
  

      if (href && href.endsWith(".pdf") && hrefMatches) {
        downloadLinks.push(href);
      }
    });
    results.push({
      title,
      link,
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      downloadLinks,
    });
  }
  return results;
}

export default { scrapeCompilationLinks };


