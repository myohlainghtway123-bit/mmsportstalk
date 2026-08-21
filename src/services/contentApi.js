const API_BASE = "https://myanmarsportstalk.com/api";
const SITE = "https://myanmarsportstalk.com";
const YOUTUBE_CHANNEL = "https://www.youtube.com/@MyanmarSportsTalk/videos";
const TIMEOUT_MS = 9000;

const root = globalThis;
if (!root.__MST_CONTENT_CACHE__) root.__MST_CONTENT_CACHE__ = new Map();
if (!root.__MST_CONTENT_INFLIGHT__) root.__MST_CONTENT_INFLIGHT__ = new Map();
const cache = root.__MST_CONTENT_CACHE__;
const inflight = root.__MST_CONTENT_INFLIGHT__;

function ttlFor(path) {
  if (path.startsWith("/content/articles/")) return 5 * 60 * 1000;
  return 2 * 60 * 1000;
}

async function networkGet(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = { message: text }; }
    if (!response.ok) throw new Error(payload?.error || payload?.message || `MST API ${response.status}`);
    cache.set(path, { payload, fetchedAt: Date.now() });
    return payload;
  } catch (error) {
    const saved = cache.get(path);
    if (saved) return saved.payload;
    if (error?.name === "AbortError") throw new Error("MST content is taking too long. Pull to refresh in a moment.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function get(path, { force = false } = {}) {
  const saved = cache.get(path);
  if (!force && saved && Date.now() - saved.fetchedAt < ttlFor(path)) return saved.payload;
  if (!force && inflight.has(path)) return inflight.get(path);
  const promise = networkGet(path).finally(() => {
    if (inflight.get(path) === promise) inflight.delete(path);
  });
  inflight.set(path, promise);
  return promise;
}

function arrayFrom(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of [...keys, "items", "results", "data", "articles", "videos", "response"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = arrayFrom(value, keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function stringUrl(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return first(value.url, value.src, value.source_url, value.href, value.image, null);
  return null;
}

function absoluteUrl(value) {
  const source = stringUrl(value);
  if (!source) return null;
  const text = String(source).trim();
  if (!text || text === "[object Object]") return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("//")) return `https:${text}`;
  if (text.startsWith("/")) return `${SITE}${text}`;
  return `${SITE}/${text}`;
}

function cleanText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function articleImage(raw) {
  return first(
    raw?.imageUrl, raw?.image_url, raw?.featuredImageUrl, raw?.featured_image_url,
    raw?.featuredImage?.url, raw?.featured_image?.url, raw?.coverImage?.url, raw?.cover_image?.url,
    raw?.thumbnailUrl, raw?.thumbnail_url, raw?.thumbnail?.url, raw?.media?.url, raw?.media?.source_url,
    raw?.image?.url, raw?.image?.src,
    typeof raw?.featuredImage === "string" ? raw.featuredImage : null,
    typeof raw?.coverImage === "string" ? raw.coverImage : null,
    typeof raw?.cover === "string" ? raw.cover : null,
    typeof raw?.thumbnail === "string" ? raw.thumbnail : null,
    typeof raw?.image === "string" ? raw.image : null,
    null
  );
}

export function normalizeArticle(raw, index = 0) {
  const categoryRaw = first(raw?.category?.name, raw?.category, raw?.type, raw?.section, raw?.topic, "News");
  const slug = first(raw?.slug, raw?.id, `article-${index}`);
  const published = first(raw?.publishedAt, raw?.published_at, raw?.date, raw?.createdAt, raw?.created_at, raw?.updatedAt);
  const title = first(raw?.title, raw?.headline, raw?.name, "Myanmar Sports Talk");
  const excerpt = first(raw?.excerpt, raw?.summary, raw?.description, raw?.dek, raw?.content, raw?.body, "");
  return {
    id: String(first(raw?.id, slug, index)), slug: String(slug), title: cleanText(title),
    excerpt: cleanText(excerpt).slice(0, 300), content: cleanText(first(raw?.content, raw?.body, raw?.article, raw?.description, "")),
    category: typeof categoryRaw === "string" ? categoryRaw : first(categoryRaw?.name, categoryRaw?.title, "News"),
    image: absoluteUrl(articleImage(raw)),
    author: first(raw?.author?.name, raw?.authorName, raw?.author_name, typeof raw?.author === "string" ? raw.author : null, "Myanmar Sports Talk"),
    publishedAt: published || null,
    url: absoluteUrl(first(raw?.url, raw?.link, raw?.permalink, `/news/${slug}`)), raw,
  };
}

export function normalizeVideo(raw, index = 0) {
  const id = first(raw?.youtubeId, raw?.youtube_id, raw?.videoId, raw?.video_id, raw?.id, index);
  const url = first(raw?.url, raw?.videoUrl, raw?.video_url, raw?.youtubeUrl, raw?.youtube_url, raw?.link);
  let youtubeId = first(raw?.youtubeId, raw?.youtube_id, raw?.videoId, raw?.video_id);
  if (!youtubeId && url) {
    const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^?&/]+)/i);
    youtubeId = match?.[1] || null;
  }
  const thumbnail = first(
    raw?.thumbnailUrl, raw?.thumbnail_url, raw?.thumbnail?.url, raw?.image?.url,
    typeof raw?.thumbnail === "string" ? raw.thumbnail : null,
    typeof raw?.image === "string" ? raw.image : null,
    raw?.cover?.url, typeof raw?.cover === "string" ? raw.cover : null,
    youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null
  );
  return {
    id: String(id), youtubeId: youtubeId || null,
    title: cleanText(first(raw?.title, raw?.name, raw?.caption, "MST Video")),
    thumbnail: absoluteUrl(thumbnail),
    url: absoluteUrl(url) || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null),
    views: first(raw?.views, raw?.viewCount, raw?.view_count, null),
    duration: first(raw?.duration, raw?.length, null),
    publishedAt: first(raw?.publishedAt, raw?.published_at, raw?.date, raw?.createdAt, null),
    platform: first(raw?.platform, youtubeId ? "YouTube" : "Video"), raw,
  };
}

function decodeYouTubeText(value) {
  if (!value) return "MST YouTube Video";
  try { return JSON.parse(`"${value.replace(/"/g, '\\"')}"`); } catch (_) { return value.replace(/\\u0026/g, "&").replace(/\\n/g, " "); }
}

async function fetchYouTubeFallback() {
  const cacheKey = "youtube-direct";
  const saved = cache.get(cacheKey);
  if (saved && Date.now() - saved.fetchedAt < 3 * 60 * 1000) return saved.payload;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(YOUTUBE_CHANNEL, {
      headers: { Accept: "text/html" }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`YouTube ${response.status}`);
    const html = await response.text();
    const videos = [];
    const seen = new Set();
    const re = /"videoId":"([A-Za-z0-9_-]{11})"/g;
    let match;
    while ((match = re.exec(html)) && videos.length < 24) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const nearby = html.slice(match.index, Math.min(html.length, match.index + 1800));
      const titleMatch = nearby.match(/"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/) || nearby.match(/"title":\{"simpleText":"((?:\\.|[^"\\])*)"/);
      videos.push(normalizeVideo({
        youtubeId: id,
        title: decodeYouTubeText(titleMatch?.[1] || "MST YouTube Video"),
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
        platform: "YouTube",
      }, videos.length));
    }
    cache.set(cacheKey, { payload: videos, fetchedAt: Date.now() });
    return videos;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchArticles(options) {
  const payload = await get("/content/articles", options);
  return { payload, articles: arrayFrom(payload, ["posts"]).map(normalizeArticle).filter((x) => x.title) };
}

export async function fetchArticle(slug, options) {
  const payload = await get(`/content/articles/${encodeURIComponent(slug)}`, options);
  const raw = payload?.article || payload?.data?.article || payload?.data || payload;
  return { payload, article: normalizeArticle(raw) };
}

export async function fetchSocialVideos(options) {
  try {
    const payload = await get("/social/videos", options);
    const videos = arrayFrom(payload, ["posts"]).map(normalizeVideo).filter((x) => x.title);
    if (videos.length) return { payload, videos, source: "mst-api" };
  } catch (_) {}

  try {
    const videos = await fetchYouTubeFallback();
    return { payload: null, videos, source: "youtube" };
  } catch (_) {
    return { payload: null, videos: [], source: "youtube" };
  }
}

export function isTransferArticle(article) {
  const haystack = `${article?.category || ""} ${article?.title || ""} ${article?.excerpt || ""}`.toLowerCase();
  return /transfer|signing|signed|deal|rumou?r|ပြောင်းရွှေ့|ခေါ်ယူ|အပြောင်းအရွှေ့/.test(haystack);
}

export function formatContentDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const MST_SITE_URL = SITE;
export const MST_YOUTUBE_URL = YOUTUBE_CHANNEL;
