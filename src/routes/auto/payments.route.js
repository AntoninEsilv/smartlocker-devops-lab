import express from 'express'
const router = express.Router()

const STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']
const WEBHOOK_STATUSES = ['SUCCEEDED', 'FAILED']
// Card data must never reach our API or our storage (SMAR-28 acceptance criteria)
const CARD_FIELDS = ['card_number', 'cvv', 'cvc', 'expiry', 'card']

let payments = [
  { id: 1, reservation_id: 101, amount: 5.0, provider_ref: 'PSP-100101', status: 'SUCCEEDED' },
  { id: 2, reservation_id: 102, amount: 5.0, provider_ref: 'PSP-100102', status: 'SUCCEEDED' }
]

function isPositiveInt (v) {
  return Number.isInteger(v) && v > 0
}

function isNonEmptyString (v) {
  return typeof v === 'string' && v.trim() !== ''
}

function hasCardData (body) {
  return CARD_FIELDS.some(f => body[f] !== undefined)
}

// Returns an error message if the fields present in `data` are invalid
function validate (data, requireAll) {
  if (requireAll || data.reservation_id !== undefined) {
    if (!isPositiveInt(data.reservation_id)) return 'reservation_id must be a positive integer'
  }
  if (requireAll || data.amount !== undefined) {
    if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0) {
      return 'amount must be a number greater than 0'
    }
  }
  if (requireAll || data.provider_ref !== undefined) {
    if (!isNonEmptyString(data.provider_ref)) return 'provider_ref must be a non-empty string'
  }
  if (data.status !== undefined && !STATUSES.includes(data.status)) {
    return `status must be one of: ${STATUSES.join(', ')}`
  }
  return null
}

// GET all payments
router.get('/', (_req, res) => {
  res.status(200).json(payments)
})

// POST PSP webhook: the ONLY way a payment becomes SUCCEEDED or FAILED.
// The booking must be confirmed (PUT /api/reservations/:id { status: 'CONFIRMED' })
// only after a SUCCEEDED answer. A FAILED or abandoned payment leaves the reservation
// in PENDING_PAYMENT, so the 15-minute hold expires and the locker is released.
router.post('/webhook', (req, res) => {
  const body = req.body || {}
  if (hasCardData(body)) {
    return res.status(400).json({ error: 'Card data must not be sent to this API' })
  }
  if (!isNonEmptyString(body.provider_ref)) {
    return res.status(400).json({ error: 'provider_ref must be a non-empty string' })
  }
  if (!WEBHOOK_STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `status must be one of: ${WEBHOOK_STATUSES.join(', ')}` })
  }
  const payment = payments.find(p => p.provider_ref === body.provider_ref)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })

  if (payment.status === body.status) return res.json(payment) // idempotent retry from the PSP
  if (payment.status !== 'PENDING') {
    return res.status(409).json({ error: `Payment is already ${payment.status}` })
  }
  if (body.status === 'SUCCEEDED' &&
    payments.some(p => p.id !== payment.id && p.reservation_id === payment.reservation_id && p.status === 'SUCCEEDED')) {
    return res.status(409).json({ error: 'This reservation already has a successful payment' })
  }
  payment.status = body.status
  res.json(payment)
})

// GET payment by ID
router.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  const payment = payments.find(p => p.id === id)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json(payment)
})

// POST create a payment: always PENDING, until the PSP webhook answers
router.post('/', (req, res) => {
  const body = req.body || {}
  if (hasCardData(body)) {
    return res.status(400).json({ error: 'Card data must not be sent to this API' })
  }
  if (body.status !== undefined && body.status !== 'PENDING') {
    return res.status(400).json({ error: 'status is set by the PSP webhook, a new payment is PENDING' })
  }
  const data = {
    reservation_id: body.reservation_id,
    amount: body.amount,
    provider_ref: body.provider_ref,
    status: 'PENDING'
  }
  const invalid = validate(data, true)
  if (invalid) return res.status(400).json({ error: invalid })

  const nextId = payments.reduce((max, p) => Math.max(max, p.id), 0) + 1
  const newPayment = { id: nextId, ...data }
  payments.push(newPayment)
  res.status(201).json(newPayment)
})

// PUT update a payment by ID (only the sent fields change)
router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const index = payments.findIndex(p => p.id === id)
  if (index === -1) return res.status(404).json({ error: 'Payment not found' })

  const body = req.body || {}
  if (hasCardData(body)) {
    return res.status(400).json({ error: 'Card data must not be sent to this API' })
  }
  const data = {}
  for (const key of ['reservation_id', 'amount', 'provider_ref', 'status']) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  const invalid = validate(data, false)
  if (invalid) return res.status(400).json({ error: invalid })
  if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
    if (data.status !== payments[index].status) {
      return res.status(400).json({ error: 'status SUCCEEDED or FAILED can only be set by the PSP webhook' })
    }
  }

  const current = payments[index]
  if (data.status === 'REFUNDED' && current.status !== 'REFUNDED' && current.status !== 'SUCCEEDED') {
    return res.status(409).json({ error: 'A payment can only be refunded after it has succeeded' })
  }

  payments[index] = { ...current, ...data, id }
  res.json(payments[index])
})

// DELETE a payment by ID
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const before = payments.length
  payments = payments.filter(p => p.id !== id)
  if (payments.length === before) return res.status(404).json({ error: 'Payment not found' })
  res.status(204).end()
})

export default router
