import { ReadError, clean, durationFromMs, fetchText } from "./http.mjs";

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

  const tracks = songs.map((song, index) => ({ position: index + 1, ...song }));
  if (!tracks.length) {
    throw new ReadError("Listede okunacak parça yok. Liste boş olabilir ya da herkese kapalıdır.");
  }

  const expected = Number(header?.trackCount);
  let note = "";
  if (Number.isFinite(expected) && expected > tracks.length) {
    note = `Apple Music sayfası ${expected} parça diyor. Buraya ${tracks.length} tanesi geldi.`;
  }

  return {
    source: "Apple Music",
    title: clean(header?.title) || "Apple Music listesi",
    tracks,
    note,
  };
}
