import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'serve-xkin-dist',
      configureServer(server) {
        const distDir = path.resolve(__dirname, '..', 'dist')
        server.middlewares.use('/xkin', (req, res, next) => {
          if (!req.url) return next()
          const filePath = path.join(distDir, req.url)
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/javascript')
            fs.createReadStream(filePath).pipe(res)
          } else {
            next()
          }
        })
      },
    },
  ],
})
