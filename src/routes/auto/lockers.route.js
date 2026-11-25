/**
 * Lockers API (SmartLocker) - full CRUD
 * Jira SMAR-39 - US6.3 Manage hubs and lockers
 * "As an operator, I want to create and edit my hubs and their lockers,
 *  so that renters can find them."
 *
 * GET    /api/lockers                   → list all lockers
 * GET    /api/lockers?status=AVAILABLE  → only the lockers with this status
 * GET    /api/lockers?hub_id=1          → only the lockers of this hub
 * GET    /api/lockers/:id               → one locker (404 if unknown)
 * POST   /api/lockers                   → create { number, size, hub_id, status? }
 * PUT    /api/lockers/:id               → update (partial body accepted), e.g. { status: 'OUT_OF_SERVICE' }
 * DELETE /api/lockers/:id               → delete (204)
 *
 * Acceptance criteria:
 *  - Locker = ID, size, hub (hub_id must match an existing hub of /api/hubs)
 *  - a locker with an active booking cannot be deleted (409)
 * Rules:
 *  - size is S, M or L; status is AVAILABLE (default) or OUT_OF_SERVICE
 *  - two lockers of the same hub cannot have the same number (409)
 */
import express from 'express'
import { hubExists } from './hubs.route.js'
import { hasActiveReservation } from './reservations.route.js'

const router = express.Router()

export const LOCKER_SIZES = ['S', 'M', 'L']
export const LOCKER_STATUSES = ['AVAILABLE', 'OUT_OF_SERVICE']

// Ids 1-5 match the locker_id values used by /api/reservations (and its tests)
let lockers = [
  { id: 1, number: 'A-01', size: 'S', hub_id: 1, status: 'AVAILABLE' },
  { id: 2, number: 'A-02', size: 'M', hub_id: 1, status: 'AVAILABLE' },
  { id: 3, number: 'A-03', size: 'L', hub_id: 1, status: 'AVAILABLE' },
  { id: 4, number: 'B-01', size: 'M', hub_id: 2, status: 'AVAILABLE' },
  { id: 5, number: 'B-02', size: 'L', hub_id: 2, status: 'OUT_OF_SERVICE' }
]

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

// Used by /api/hubs: a hub that still has lockers cannot be deleted
export const countLockersInHub = (hubId) => lockers.filter((l) => l.hub_id === Number(hubId)).length

// Returns an error message, or null when the locker is valid
function validate (locker) {
  const { number, size, hub_id: hubId, status } = locker
  if (number === undefined || size === undefined || hubId === undefined) {
    return 'Missing required fields: number, size and hub_id are required'
  }
  if (!isNonEmptyString(number)) {
    return 'number must be a non-empty string'
  }
  if (!LOCKER_SIZES.includes(size)) {
    return `size must be one of: ${LOCKER_SIZES.join(', ')}`
  }
  if (!isPositiveInteger(hubId)) {
    return 'hub_id must be a positive integer'
  }
  if (!hubExists(hubId)) {
    return 'hub_id does not match any hub'
  }
  if (!LOCKER_STATUSES.includes(status)) {
    return `status must be one of: ${LOCKER_STATUSES.join(', ')}`
  }
  return null
}

const normalise = (l) => ({
  id: l.id,
  number: l.number.trim(),
  size: l.size,
  hub_id: Number(l.hub_id),
  status: l.status
})

const isDuplicate = (locker) =>
  lockers.some((l) => l.id !== locker.id && l.hub_id === locker.hub_id && l.number.toLowerCase() === locker.number.toLowerCase())

const findIndexById = (id) => lockers.findIndex((l) => l.id === Number(id))

// GET all lockers, optionally filtered by status and/or hub
router.get('/', (req, res) => {
  const { status, hub_id: hubId } = req.query
  if (status !== undefined && !LOCKER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${LOCKER_STATUSES.join(', ')}` })
  }
  if (hubId !== undefined && !isPositiveInteger(hubId)) {
    return res.status(400).json({ error: 'hub_id must be a positive integer' })
  }
  const result = lockers.filter((l) =>
    (status === undefined || l.status === status) &&
    (hubId === undefined || l.hub_id === Number(hubId))
  )
  res.status(200).json(result)
})

// GET one locker by ID
router.get('/:id', (req, res) => {
  const locker = lockers[findIndexById(req.params.id)]
  if (!locker) {
    return res.status(404).json({ error: 'Locker not found' })
  }
  res.status(200).json(locker)
})

// POST create a locker (AVAILABLE by default)
router.post('/', (req, res) => {
  const newId = lockers.reduce((max, l) => Math.max(max, l.id), 0) + 1
  const candidate = { status: 'AVAILABLE', ...req.body, id: newId }
  const error = validate(candidate)
  if (error) {
    return res.status(400).json({ error })
  }
  const locker = normalise(candidate)
  if (isDuplicate(locker)) {
    return res.status(409).json({ error: 'A locker with this number already exists in this hub' })
  }
  lockers.push(locker)
  res.status(201).json(locker)
})

// PUT update a locker (fields not sent are kept, the id never changes)
router.put('/:id', (req, res) => {
  const index = findIndexById(req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Locker not found' })
  }
  const candidate = { ...lockers[index], ...req.body, id: lockers[index].id }
  const error = validate(candidate)
  if (error) {
    return res.status(400).json({ error })
  }
  const updated = normalise(candidate)
  if (isDuplicate(updated)) {
    return res.status(409).json({ error: 'A locker with this number already exists in this hub' })
  }
  lockers[index] = updated
  res.status(200).json(updated)
})

// DELETE a locker (refused while it has an active booking)
router.delete('/:id', (req, res) => {
  const index = findIndexById(req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Locker not found' })
  }
  const { id } = lockers[index]
  if (hasActiveReservation(id)) {
    return res.status(409).json({ error: 'This locker has an active booking and cannot be deleted' })
  }
  lockers = lockers.filter((l) => l.id !== id)
  res.status(204).end()
})

export default router
