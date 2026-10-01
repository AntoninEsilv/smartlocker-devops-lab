/**
 * Express app configuration.
 * Responsibilities:
 *  - Base routes (/, /health)
 *  - Auto-mount all routers in src/routes/auto/*.route.js
 *  - Global error handler (consistent JSON for errors)
 */
import express from 'express'
import { errorHandler } from './utils/errorHandler.js'
import versionRouter from './routes/auto/version.route.js'
import infoRouter from './routes/auto/info.route.js'
import boomRouter from './routes/auto/boom.route.js'

const app = express()

// Simple root + health endpoints
app.get('/', (_req, res) => res.json({ ok: true, message: 'Hello from CI/CD demo \u{1F44B}' }))
app.get('/health', (_req, res) => res.status(200).send('OK'))

// Mount all route modules
app.use('/', versionRouter)
app.use('/', infoRouter)
app.use('/', boomRouter)

// Global error middleware last
app.use(errorHandler)

export default app
