import { ReadError, readPlaylist } from "../lib/read.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Bu işlem yok." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "İstek okunamadı." });
    return;
  }

  try {
    if (JSON.stringify(body ?? {}).length > 4000) {
      res.status(400).json({ error: "Bağlantı fazla uzun." });
      return;
    }
    const playlist = await readPlaylist(body?.url);
    res.status(200).json(playlist);
  } catch (error) {
    const message =
      error instanceof ReadError ? error.message : "Liste okunamadı. Yeniden dene.";
    res.status(422).json({ error: message });
  }
}
