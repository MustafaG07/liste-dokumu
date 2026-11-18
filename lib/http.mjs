const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0";

const ALLOWED = new Set([
  "open.spotify.com",
  "music.apple.com",
  "www.youtube.com",
  "youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export class ReadError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReadError";
  }
}

export function parseUserUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    throw new ReadError("Bu bir bağlantı değil. Adres çubuğundaki tam bağlantıyı yapıştır.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ReadError("Bağlantı https ile başlamalı.");
  }
  const host = url.hostname.toLowerCase();
  if (!ALLOWED.has(host)) {
    throw new ReadError(
      "Bu adresi tanımıyorum. Spotify, Apple Music veya YouTube Music çalma listesi olmalı."
    );
  }
  return url;
}

export async function fetchText(url, { maxBytes = 6_000_000, redirects = 0 } = {}) {
  if (redirects > 3) throw new ReadError("Sayfa çok fazla yönlendirdi.");
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "tr,en;q=0.8",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (response.status >= 300 && response.status < 400) {
    const next = response.headers.get("location");
    if (!next) throw new ReadError("Sayfa yönlendirme verdi ama hedefi yok.");
    const resolved = new URL(next, url);
    parseUserUrl(resolved.href);
    return fetchText(resolved, { maxBytes, redirects: redirects + 1 });
  }

  if (!response.ok) {
    throw new ReadError("Sayfa açılmadı. Liste herkese açık mı, bağlantı duruyor mu, bir bak.");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new ReadError("Sayfa beklenenden büyük. Liste okunamadı.");
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
    headers: {
      "user-agent": UA,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new ReadError("Listenin devamı gelmedi. Elindeki parçalarla sürebilirsin ya da yeniden dene.");
  }
  try {
    return await response.json();
  } catch {
    throw new ReadError("Listenin devamı parça listesi olarak gelmedi.");
  }
}

export function durationFromMs(ms) {
  const total = Math.round(Number(ms) / 1000);
  if (!Number.isFinite(total) || total < 0) return "";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function clean(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
