/**
 * Hubs API (SmartLocker) - full CRUD
 * Jira SMAR-39 - US6.3 Manage hubs and lockers
 * "As an operator, I want to create and edit my hubs and their lockers,
 *  so that renters can find them."
 *
 * GET    /api/hubs      → list all hubs
 * GET    /api/hubs/:id  → one hub (404 if unknown)
 * POST   /api/hubs      → create { name, address, opening_hours }
 * PUT    /api/hubs/:id  → update (partial body accepted)
 * DELETE /api/hubs/:id  → delete (204)
 *
 * Acceptance criteria:
 *  - Hub = name, address, opening hours
 * Rules:
 *  - two hubs cannot have the same name (409)
 *  - a hub that still has lockers cannot be deleted (409)
 */
import express from 'express'
import { countLockersInHub } from './lockers.route.js'

const router = express.Router()

const ADDRESS = '12 avenue Léonard de Vinci, 92400 Courbevoie'

let hubs = [
  { id: 1, name: 'Pôle Léonard de Vinci – Hall A', address: ADDRESS, opening_hours: 'Mon-Fri 07:30-20:00' },
  { id: 2, name: 'Pôle Léonard de Vinci – Hall B', address: ADDRESS, opening_hours: 'Mon-Sat 08:00-19:00' }
]

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

// Returns an error message, or null when the hub is valid
function validate (hub) {
  const { name, address, opening_hours: openingHours } = hub
  if (name === undefined || address === undefined || openingHours === undefined) {
    return 'Missing required fields: name, address and opening_hours are required'
  }
  if (!isNonEmptyString(name)) {
    return 'name must be a non-empty string'
  }
  if (!isNonEmptyString(address)) {
    return 'address must be a non-empty string'
  }
  if (!isNonEmptyString(openingHours)) {
    return 'opening_hours must be a non-empty string'
  }
  return null
}

const normalise = (h) => ({
  id: h.id,
  name: h.name.trim(),
  address: h.address.trim(),
  opening_hours: h.opening_hours.trim()
})

const isDuplicate = (hub) =>
  hubs.some((h) => h.id !== hub.id && h.name.toLowerCase() === hub.name.toLowerCase())

const findIndexById = (id) => hubs.findIndex((h) => h.id === Number(id))

// Used by /api/lockers to check that a locker belongs to an existing hub
export const hubExists = (id) => findIndexById(id) !== -1

// GET all hubs
router.get('/', (_req, res) => {
  res.status(200).json(hubs)
})

// GET one hub by ID
router.get('/:id', (req, res) => {
  const hub = hubs[findIndexById(req.params.id)]
  if (!hub) {
    return res.status(404).json({ error: 'Hub not found' })
  }
  res.status(200).json(hub)
})

// POST create a hub
router.post('/', (req, res) => {
  const error = validate(req.body)
  if (error) {
    return res.status(400).json({ error })
  }
  const newId = hubs.reduce((max, h) => Math.max(max, h.id), 0) + 1
  const hub = normalise({ ...req.body, id: newId })
  if (isDuplicate(hub)) {
    return res.status(409).json({ error: 'A hub with this name already exists' })
  }
  hubs.push(hub)
  res.status(201).json(hub)
})

// PUT update a hub (fields not sent are kept, the id never changes)
router.put('/:id', (req, res) => {
  const index = findIndexById(req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Hub not found' })
  }
  const candidate = { ...hubs[index], ...req.body, id: hubs[index].id }
  const error = validate(candidate)
  if (error) {
    return res.status(400).json({ error })
  }
  const updated = normalise(candidate)
  if (isDuplicate(updated)) {
    return res.status(409).json({ error: 'A hub with this name already exists' })
  }
  hubs[index] = updated
  res.status(200).json(updated)
})

// DELETE a hub (only when it has no lockers left)
router.delete('/:id', (req, res) => {
  const index = findIndexById(req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Hub not found' })
  }
  const { id } = hubs[index]
  if (countLockersInHub(id) > 0) {
    return res.status(409).json({ error: 'This hub still has lockers: delete or move them first' })
  }
  hubs = hubs.filter((h) => h.id !== id)
  res.status(204).end()
})

export default router
