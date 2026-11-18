import { parseUserUrl, ReadError } from "./http.mjs";
import { readApple } from "./apple.mjs";
import { readSpotify } from "./spotify.mjs";
import { readYouTube } from "./youtube.mjs";

export async function readPlaylist(raw) {
  const url = parseUserUrl(raw);
  const host = url.hostname.toLowerCase();
  if (host === "open.spotify.com") return readSpotify(url);
  if (host === "music.apple.com") return readApple(url);
  if (
    host === "www.youtube.com" ||
    host === "youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be"
  ) {
    return readYouTube(url);
  }
  throw new ReadError("Bu adresi tanımıyorum.");
}

export { ReadError };
