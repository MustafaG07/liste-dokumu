export class ReadError extends Error {
  constructor(message: string)
}

export function readPlaylist(raw: unknown): Promise<{
  source: string
  title: string
  tracks: Array<{
    position: number
    title: string
    artist: string
    album: string
    duration: string
    url: string
  }>
  note: string
}>
