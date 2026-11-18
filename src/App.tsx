import { useState, type FormEvent } from "react"
import { useTheme } from "@/components/theme-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Track = {
  position: number
  title: string
  artist: string
  album: string
  duration: string
  durationMs?: number
  uri?: string
  isrc?: string
  releaseDate?: string
  explicit?: boolean
  url: string
}

type Playlist = {
  source: string
  title: string
  tracks: Track[]
  note: string
}

function fileName(title: string) {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return `${cleaned || "liste"}.csv`
}

const CSV_HEADER = [
  "Track URI",
  "ISRC",
  "Track Name",
  "Album Name",
  "Artist Name(s)",
  "Release Date",
  "Duration (ms)",
  "Popularity",
  "Explicit",
  "Added By",
  "Added At",
  "Genres",
  "Record Label",
  "Danceability",
  "Energy",
  "Key",
  "Loudness",
  "Mode",
  "Speechiness",
  "Acousticness",
  "Instrumentalness",
  "Liveness",
  "Valence",
  "Tempo",
  "Time Signature",
]

function quoted(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function plain(value: string) {
  if (!value) return ""
  return /[,"\n]/.test(value) ? quoted(value) : value
}

function artistNames(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .split(/\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
    .join(";")
}

function csv(playlist: Playlist) {
  const rows = playlist.tracks.map((track) => {
    const durationMs =
      track.durationMs && track.durationMs > 0
        ? String(Math.round(track.durationMs))
        : ""
    return [
      plain(track.uri || ""),
      plain(track.isrc || ""),
      quoted(track.title),
      quoted(track.album),
      quoted(artistNames(track.artist)),
      plain(track.releaseDate || ""),
      durationMs,
      "",
      typeof track.explicit === "boolean" ? String(track.explicit) : "",
      "",
      "",
      quoted(""),
      quoted(""),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(",")
  })
  return `\uFEFF${[CSV_HEADER.join(","), ...rows].join("\n")}`
}

function download(playlist: Playlist) {
  const blob = new Blob([csv(playlist)], { type: "text/csv;charset=utf-8" })
  const href = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = href
  link.download = fileName(playlist.title)
  link.click()
  URL.revokeObjectURL(href)
}

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function App() {
  const { theme, setTheme } = useTheme()
  const [url, setUrl] = useState("")
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")
  const [loading, setLoading] = useState(false)
  const dark =
    theme === "dark" || (theme === "system" && prefersDark())

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setSaved("")
    setPlaylist(null)
    try {
      const response = await fetch("/api/playlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const text = await response.text()
      let body: { error?: unknown }
      try {
        body = JSON.parse(text)
      } catch {
        setError("Liste okunamadı. Sunucu parça listesi yerine bir sayfa gönderdi.")
        return
      }
      if (!response.ok) {
        setError(
          typeof body.error === "string"
            ? body.error
            : "Liste okunamadı. Yeniden dene.",
        )
        return
      }
      setPlaylist(body as Playlist)
    } catch {
      setError("Liste okunamadı. Yeniden dene.")
    } finally {
      setLoading(false)
    }
  }

  function onDownload() {
    if (!playlist) return
    download(playlist)
    setSaved(`${playlist.tracks.length} parça CSV olarak indi.`)
  }

  const count = playlist
    ? `${playlist.tracks.length} parça`
    : "Henüz liste yok"

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <h1 className="text-2xl font-medium tracking-tight">
            Parçaları CSV yap
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Herkese açık bir Spotify, Apple Music veya YouTube Music listesinin
            bağlantısını yapıştır. Parçalar tabloya gelir, CSV iner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{count}</Badge>
          <Button
            type="button"
            variant="outline"
            aria-pressed={dark}
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            {dark ? "Açık zemin" : "Koyu zemin"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste bağlantısı</CardTitle>
          <CardDescription>
            Hesap bağlanmaz. Kapalı ve kişisel listeler okunmaz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <Label htmlFor="playlist-url">Bağlantı</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="playlist-url"
                name="url"
                type="url"
                required
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://open.spotify.com/playlist/…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Okunuyor" : "Listeyi oku"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Liste okunuyor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Liste açılmadı</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {playlist ? (
        <Card>
          <CardHeader>
            <CardTitle>{playlist.title}</CardTitle>
            <CardDescription>
              {playlist.source}. {playlist.tracks.length} parça okundu.
            </CardDescription>
            <CardAction>
              <Button type="button" onClick={onDownload}>
                CSV indir
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            {saved ? (
              <Alert>
                <AlertDescription>{saved}</AlertDescription>
              </Alert>
            ) : null}
            {playlist.note ? (
              <Alert>
                <AlertDescription>{playlist.note}</AlertDescription>
              </Alert>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sıra</TableHead>
                  <TableHead>Parça</TableHead>
                  <TableHead>Sanatçı</TableHead>
                  <TableHead>Albüm</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Bağlantı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playlist.tracks.map((track) => (
                  <TableRow key={`${track.position}-${track.url}`}>
                    <TableCell>{track.position}</TableCell>
                    <TableCell>{track.title}</TableCell>
                    <TableCell>{track.artist}</TableCell>
                    <TableCell>{track.album}</TableCell>
                    <TableCell>{track.duration}</TableCell>
                    <TableCell>
                      {track.url ? (
                        <a
                          href={track.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4"
                        >
                          Parçayı aç
                        </a>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {!playlist && !loading && !error ? (
        <Alert>
          <AlertTitle>Henüz liste yok</AlertTitle>
          <AlertDescription>
            Bağlantıyı yapıştır, sonra Listeyi oku.
          </AlertDescription>
        </Alert>
      ) : null}

      <Separator />
      <p className="text-sm text-muted-foreground">
        CSV, örnek dosyadaki sütunlarla iner: Track URI, ISRC, parça adı, albüm,
        sanatçı ve süre milisaniye. Sayfanın vermediği ölçüler boş kalır.
      </p>
    </main>
  )
}
