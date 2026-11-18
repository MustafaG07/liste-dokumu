import { ReadError, clean, durationFromMs, fetchText } from "./http.mjs";

const ID = /^[A-Za-z0-9]{10,}$/;

export function spotifyId(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.lastIndexOf("playlist");
  const id = index >= 0 ? parts[index + 1] : "";
  if (!ID.test(id)) {
    throw new ReadError("Bu Spotify bağlantısında bir çalma listesi kimliği yok.");
  }
  return id;
}

export async function readSpotify(url) {
  const id = spotifyId(url);
  const html = await fetchText(new URL(`https://open.spotify.com/embed/playlist/${id}`));
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new ReadError("Spotify sayfası parça listesini vermedi. Liste herkese açık mı?");
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new ReadError("Spotify sayfası okunamadı.");
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  const list = Array.isArray(entity?.trackList) ? entity.trackList : null;
  if (!entity || entity.type !== "playlist" || !list) {
    throw new ReadError("Bu Spotify listesi herkese açık değil, ya da bağlantı bir çalma listesi değil.");
  }

  const tracks = list
    .filter((track) => track && track.entityType !== "episode" && track.title)
    .map((track, index) => {
      const trackId = String(track.uri || "").split(":").pop();
      return {
        position: index + 1,
        uri: clean(track.uri),
        title: clean(track.title),
        artist: clean(track.subtitle),
        album: "",
        duration: durationFromMs(track.duration),
        durationMs: Number(track.duration) || 0,
        explicit: Boolean(track.isExplicit),
        url: trackId ? `https://open.spotify.com/track/${trackId}` : "",
      };
    });

  if (!tracks.length) {
    throw new ReadError("Listede okunacak parça yok. Liste boş olabilir ya da herkese kapalıdır.");
  }

  return {
    source: "Spotify",
    title: clean(entity.name || entity.title) || "Spotify listesi",
    tracks,
    note:
      tracks.length >= 100
        ? "Spotify'nin herkese açık gömülü sayfası en fazla 100 parça veriyor. Listen daha uzunsa devamı bu yolla gelmez."
        : "",
  };
}
