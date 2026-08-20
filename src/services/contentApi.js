const API_BASE = "https://myanmarsportstalk.com/api";
const SITE = "https://myanmarsportstalk.com";

async function get(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = { message: text }; }
  if (!response.ok) throw new Error(payload?.error || payload?.message || `MST API ${response.status}`);
  return payload;
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

function absoluteUrl(value) {
  if (!value) return null;
  const text = String(value);
  if (/^https?:\/\//i.test(text)) return text;
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
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticle(raw, index = 0) {
  const categoryRaw = first(raw?.category?.name, raw?.category, raw?.type, raw?.section, raw?.topic, "News");
  const slug = first(raw?.slug, raw?.id, `article-${index}`);
  const image = first(raw?.image, raw?.imageUrl, raw?.image_url, raw?.cover, raw?.coverImage, raw?.featuredImage, raw?.thumbnail, raw?.media?.url);
  const published = first(raw?.publishedAt, raw?.published_at, raw?.date, raw?.createdAt, raw?.created_at, raw?.updatedAt);
  const title = first(raw?.title, raw?.headline, raw?.name, "Myanmar Sports Talk");
  const excerpt = first(raw?.excerpt, raw?.summary, raw?.description, raw?.dek, raw?.content, raw?.body, "");
  return {
    id: String(first(raw?.id, slug, index)),
    slug: String(slug),
    title: cleanText(title),
    excerpt: cleanText(excerpt).slice(0, 280),
    content: cleanText(first(raw?.content, raw?.body, raw?.article, raw?.description, "")),
    category: typeof categoryRaw === "string" ? categoryRaw : first(categoryRaw?.name, categoryRaw?.title, "News"),
    image: absoluteUrl(image),
    author: first(raw?.author?.name, raw?.authorName, raw?.author, "MST Team"),
    publishedAt: published || null,
    url: absoluteUrl(first(raw?.url, raw?.link, `/news/${slug}`)),
    raw,
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
  const thumbnail = first(raw?.thumbnail, raw?.thumbnailUrl, raw?.thumbnail_url, raw?.image, raw?.cover, youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);
  return {
    id: String(id),
    youtubeId: youtubeId || null,
    title: cleanText(first(raw?.title, raw?.name, raw?.caption, "MST Video")),
    thumbnail: absoluteUrl(thumbnail),
    url: absoluteUrl(url) || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null),
    views: first(raw?.views, raw?.viewCount, raw?.view_count, null),
    duration: first(raw?.duration, raw?.length, null),
    publishedAt: first(raw?.publishedAt, raw?.published_at, raw?.date, raw?.createdAt, null),
    platform: first(raw?.platform, youtubeId ? "YouTube" : "Video"),
    raw,
  };
}

export async function fetchArticles() {
  const payload = await get("/content/articles");
  return { payload, articles: arrayFrom(payload, ["posts"]).map(normalizeArticle).filter((x) => x.title) };
}

export async function fetchArticle(slug) {
  const payload = await get(`/content/articles/${encodeURIComponent(slug)}`);
  const raw = payload?.article || payload?.data?.article || payload?.data || payload;
  return { payload, article: normalizeArticle(raw) };
}

export async function fetchSocialVideos() {
  const payload = await get("/social/videos");
  return { payload, videos: arrayFrom(payload, ["posts"]).map(normalizeVideo).filter((x) => x.title) };
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
