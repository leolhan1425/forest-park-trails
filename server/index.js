import express from 'express'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8059

// Serve static frontend
app.use(express.static(join(__dirname, '..', 'dist')))

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Forest Park Trails server running on port ${PORT}`)
})
