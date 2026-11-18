import { ReadError, clean, durationFromMs, fetchText } from "./http.mjs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0";
const MAX_TRACKS = 2000;
const MAX_PAGES = 20;
const TRACKS_PATH =
  /^\/v1\/catalog\/[a-z]{2}\/playlists\/pl\.[A-Za-z0-9.-]+\/tracks(?:\?[\w=&%.-]*)?$/;

let catalogToken = "";

export function isApplePlaylist(url) {
  return url.pathname.includes("/playlist/");
}

export async function readApple(url) {
  if (!isApplePlaylist(url)) {
    throw new ReadError("Bu Apple Music bağlantısı bir çalma listesi değil.");
  }

  const html = await fetchText(url);
  const match = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new ReadError("Apple Music sayfası parça listesini vermedi. Liste herkese açık mı?");
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new ReadError("Apple Music sayfası okunamadı.");
  }

  const sections = data?.data?.[0]?.data?.sections;
  if (!Array.isArray(sections)) {
    throw new ReadError("Apple Music sayfası parça listesini vermedi.");
  }

  let header = null;
  const songs = [];
  for (const section of sections) {
    for (const item of section?.items || []) {
      if (!header && typeof item?.title === "string" && "trackCount" in item) header = item;
      if (typeof item?.id !== "string" || !item.id.startsWith("track-lockup")) continue;
      if (item.contentDescriptor?.kind !== "song" || !item.title) continue;
      songs.push({
        title: clean(item.title),
        artist: clean(item.artistName),
        album: Array.isArray(item.tertiaryLinks) ? clean(item.tertiaryLinks[0]?.title) : "",
        duration: durationFromMs(item.duration),
        url: clean(item.contentDescriptor?.url),
      });
    }
  }

  const playlistId = url.pathname.split("/").find((part) => part.startsWith("pl.")) || "";
  const seen = new Set(songs.map((song) => song.url || song.title));
  let nextPath = nextTracksPath(data?.data?.[0]?.data?.nextIntent, playlistId);
  let stoppedEarly = false;
  if (nextPath) {
    const token = await appleCatalogToken(html);
    let pages = 0;
    while (nextPath && songs.length < MAX_TRACKS && pages < MAX_PAGES) {
      pages += 1;
      const before = songs.length;
      try {
        const page = await fetchAppleTracks(nextPath, token);
        for (const item of page?.data || []) {
          const song = songFromCatalog(item);
          const key = song?.url || song?.title;
          if (!song || !key || seen.has(key)) continue;
          seen.add(key);
          songs.push(song);
        }
        const upcoming = nextTracksPath({ url: page?.next, id: playlistId }, playlistId);
        if (!upcoming || songs.length === before) {
          if (songs.length === before) stoppedEarly = true;
          nextPath = "";
          break;
        }
        nextPath = upcoming;
      } catch {
        stoppedEarly = true;
        nextPath = "";
      }
    }
    if (nextPath) stoppedEarly = true;
  }

  const tracks = songs.map((song, index) => ({ position: index + 1, ...song }));
  if (!tracks.length) {
    throw new ReadError("Listede okunacak parça yok. Liste boş olabilir ya da herkese kapalıdır.");
  }

  let note = "";
  if (nextPath && tracks.length >= MAX_TRACKS) {
    note = `Listenin ilk ${MAX_TRACKS} parçası alındı. Devamı bu okumada yok.`;
  } else if (stoppedEarly) {
    note = `Apple Music sayfasının devamı gelmedi. Buraya ${tracks.length} parça geldi.`;
  }

  return {
    source: "Apple Music",
    title: clean(header?.title) || "Apple Music listesi",
    tracks,
    note,
  };
}

function nextTracksPath(intent, playlistId) {
  const path = typeof intent?.url === "string" ? intent.url : "";
  if (!path || !playlistId || !path.includes(`/playlists/${playlistId}/tracks`)) return "";
  try {
    const url = new URL(path, "https://amp-api.music.apple.com");
    if (url.origin !== "https://amp-api.music.apple.com") return "";
    if (!TRACKS_PATH.test(`${url.pathname}${url.search}`)) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function songFromCatalog(item) {
  const attributes = item?.attributes;
  if (!attributes?.name) return null;
  return {
    title: clean(attributes.name),
    artist: clean(attributes.artistName),
    album: clean(attributes.albumName),
    duration: durationFromMs(attributes.durationInMillis),
    url: clean(attributes.url),
  };
}

async function appleCatalogToken(html) {
  if (catalogToken) return catalogToken;
  const src = html.match(/src="(\/assets\/index~[^"]+\.js)"/)?.[1];
  if (!src) return "";
  const js = await fetchText(new URL(src, "https://music.apple.com"));
  catalogToken =
    js.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/)?.[0] || "";
  return catalogToken;
}

async function fetchAppleTracks(path, token) {
  if (!token) throw new ReadError("Apple Music sayfasının devamı gelmedi.");
  const response = await fetch(new URL(path, "https://amp-api.music.apple.com"), {
    headers: {
      authorization: `Bearer ${token}`,
      origin: "https://music.apple.com",
      referer: "https://music.apple.com/",
      accept: "application/json",
      "user-agent": UA,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new ReadError("Apple Music sayfasının devamı gelmedi.");
  return response.json();
}
