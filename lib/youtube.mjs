import { ReadError, clean, fetchJson, fetchText } from "./http.mjs";

const MAX_TRACKS = 2000;
const MAX_PAGES = 25;

export function youtubeListId(url) {
  if (url.hostname === "youtu.be") {
    throw new ReadError("Bu bir video bağlantısı. Çalma listesinin kendi adresini yapıştır.");
  }
  const id = url.searchParams.get("list") || "";
  if (!/^[\w-]{8,}$/.test(id)) {
    throw new ReadError("Bu YouTube bağlantısında bir çalma listesi kimliği yok.");
  }
  return id;
}

export async function readYouTube(url) {
  const listId = youtubeListId(url);
  const source = url.hostname === "music.youtube.com" ? "YouTube Music" : "YouTube";
  const pageUrl = new URL("https://www.youtube.com/playlist");
  pageUrl.searchParams.set("list", listId);
  pageUrl.searchParams.set("hl", "tr");

  const html = await fetchText(pageUrl);
  const initial = extractAssignedJson(html, "ytInitialData");
  if (!initial) throw new ReadError("YouTube sayfası parça listesini vermedi.");

  const title =
    clean(initial?.metadata?.playlistMetadataRenderer?.title) ||
    (source === "YouTube Music" ? "YouTube Music listesi" : "YouTube listesi");

  const tracks = [];
  const seen = new Set();
  let continuation = takePage(initial, tracks, seen, true);
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  const visitor = html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1] || "";

  let pages = 0;
  let stoppedEarly = false;
  while (continuation && tracks.length < MAX_TRACKS && key && pages < MAX_PAGES) {
    pages += 1;
    const before = tracks.length;
    const token = continuation;
    try {
      const payload = await fetchContinuation(key, version, visitor, token);
      const next = takePage(payload, tracks, seen, false);
      if (!next || next === token || tracks.length === before) {
        continuation = null;
        if (tracks.length === before) stoppedEarly = true;
        break;
      }
      continuation = next;
    } catch {
      stoppedEarly = true;
      continuation = null;
    }
  }

  if (!tracks.length) {
    throw new ReadError("Listede okunacak video yok. Liste herkese kapalı ya da boş olabilir.");
  }

  tracks.forEach((track, index) => {
    track.position = index + 1;
  });

  const expected = videoCount(initial);
  let note = "";
  if (continuation && tracks.length >= MAX_TRACKS) {
    note = `Listenin ilk ${MAX_TRACKS} parçası alındı. Devamı bu okumada yok.`;
  } else if (stoppedEarly || (expected && tracks.length < expected)) {
    const total = expected ? `YouTube ${expected} video diyor. ` : "";
    note = `${total}Buraya ${tracks.length} parça geldi.`;
  }

  return { source, title, tracks, note };
}

async function fetchContinuation(key, version, visitor, token) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchJson(
        `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB",
                clientVersion: version || "2.20241101.00.00",
                hl: "tr",
                gl: "TR",
                visitorData: visitor,
              },
            },
            continuation: token,
          }),
        }
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function takePage(data, tracks, seen, initial) {
  const blocks = initial
    ? data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents || []
    : (data?.onResponseReceivedActions || []).flatMap(
        (action) => action?.appendContinuationItemsAction?.continuationItems || []
      );

  let continuation = null;
  const rows = initial
    ? blocks.flatMap((block) => block?.itemSectionRenderer?.contents || [])
    : blocks;
  for (const row of rows) {
    addLockup(row?.lockupViewModel, tracks, seen);
    const token = continuationToken(row);
    if (token) continuation = token;
  }
  return continuation;
}

function continuationToken(row) {
  return (
    row?.continuationItemViewModel?.continuationCommand?.innertubeCommand?.continuationCommand
      ?.token || ""
  );
}

function videoCount(data) {
  const stats =
    data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer
      ?.stats;
  const text = (stats?.[0]?.runs || []).map((run) => run.text || "").join("");
  const count = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function addLockup(lockup, tracks, seen) {
  if (lockup?.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return;
  const id = lockup.contentId;
  if (!id || seen.has(id)) return;
  seen.add(id);
  const meta = lockup.metadata?.lockupMetadataViewModel;
  const artist =
    meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text
      ?.content;
  tracks.push({
    title: clean(meta?.title?.content),
    artist: clean(artist),
    album: "",
    duration: durationFromLockup(lockup),
    url: `https://www.youtube.com/watch?v=${id}`,
  });
}

function durationFromLockup(lockup) {
  const overlays = lockup?.contentImage?.thumbnailViewModel?.overlays || [];
  for (const overlay of overlays) {
    const badges = overlay?.thumbnailBottomOverlayViewModel?.badges || [];
    for (const badge of badges) {
      const text = badge?.thumbnailBadgeViewModel?.text;
      if (typeof text === "string" && /^\d+:\d{2}/.test(text)) return text;
    }
  }
  return "";
}

function extractAssignedJson(html, name) {
  const marker = html.indexOf(`${name}`);
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
