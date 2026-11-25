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
import usersRouter from './routes/auto/users.route.js'
import notificationsRouter from './routes/auto/notifications.route.js'
import reservationsRouter from './routes/auto/reservations.route.js'
import managementRouter from './routes/auto/management.route.js'
import teachersRouter from './routes/auto/teachers.route.js'
import hubsRouter from './routes/auto/hubs.route.js'
import lockersRouter from './routes/auto/lockers.route.js'

const app = express()

// Parse JSON bodies before handling requests
app.use(express.json())

// Simple root + health endpoints
app.get('/', (_req, res) => res.json({ ok: true, message: 'Hello from CI/CD demo \u{1F44B}' }))
app.get('/health', (_req, res) => res.status(200).send('OK'))

// Mount all route modules
app.use('/', versionRouter)
app.use('/', infoRouter)
app.use('/', boomRouter)
app.use('/api/users', usersRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/reservations', reservationsRouter)
app.use('/api/management', managementRouter)
app.use('/api/teachers', teachersRouter)
app.use('/api/hubs', hubsRouter)
app.use('/api/lockers', lockersRouter)

// Global error middleware last
app.use(errorHandler)

export default app
