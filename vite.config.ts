import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { ReadError, readPlaylist } from "./lib/read.mjs"

function playlistApi(): Plugin {
  return {
    name: "playlist-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://127.0.0.1")
        if (req.method !== "POST" || url.pathname !== "/api/playlist") {
          next()
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        try {
          for await (const chunk of req) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            size += buf.length
            if (size > 4000) {
              res.statusCode = 400
              res.setHeader("content-type", "application/json; charset=utf-8")
              res.end(JSON.stringify({ error: "Bağlantı fazla uzun." }))
              return
            }
            chunks.push(buf)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            url?: string
          }
          const playlist = await readPlaylist(body.url)
          res.statusCode = 200
          res.setHeader("content-type", "application/json; charset=utf-8")
          res.end(JSON.stringify(playlist))
        } catch (error) {
          const message =
            error instanceof ReadError
              ? error.message
              : "Liste okunamadı. Yeniden dene."
          res.statusCode = 422
          res.setHeader("content-type", "application/json; charset=utf-8")
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss(), playlistApi()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
