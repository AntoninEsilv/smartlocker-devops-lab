import request from 'supertest'
import app from '../src/app.js'
import { describe, it, expect } from 'vitest'

async function createPending (reservationId, ref) {
  const res = await request(app)
    .post('/api/payments')
    .send({ reservation_id: reservationId, amount: 5, provider_ref: ref })
  return res.body
}

describe('Payments API (SmartLocker CRUD)', () => {
  it('GET /api/payments returns array of payments', async () => {
    const res = await request(app).get('/api/payments')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(2)
  })

  it('GET /api/payments/:id returns a payment (200) or 404', async () => {
    const res = await request(app).get('/api/payments/1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('reservation_id', 101)
    expect(res.body).toHaveProperty('status', 'SUCCEEDED')

    const missing = await request(app).get('/api/payments/999')
    expect(missing.status).toBe(404)
    expect(missing.body).toHaveProperty('error', 'Payment not found')
  })

  it('POST /api/payments creates a PENDING payment (201)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .send({ reservation_id: 103, amount: 5, provider_ref: 'PSP-100103', status: 'PENDING' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('status', 'PENDING')
    expect(res.body).toHaveProperty('amount', 5)
  })

  it('POST /api/payments returns 400 on missing or invalid fields', async () => {
    const empty = await request(app).post('/api/payments')
    expect(empty.status).toBe(400)

    const base = { reservation_id: 103, amount: 5, provider_ref: 'PSP-X' }
    const cases = [
      { ...base, reservation_id: 0 },
      { ...base, amount: 0 },
      { ...base, amount: '5' },
      { ...base, provider_ref: '' }
    ]
    for (const body of cases) {
      const res = await request(app).post('/api/payments').send(body)
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    }
  })

  it('POST /api/payments refuses a status other than PENDING (set by the PSP webhook only)', async () => {
    for (const status of ['SUCCEEDED', 'FAILED', 'REFUNDED', 'WHATEVER']) {
      const res = await request(app)
        .post('/api/payments')
        .send({ reservation_id: 104, amount: 5, provider_ref: 'PSP-S', status })
      expect(res.status).toBe(400)
    }
  })

  it('refuses card data everywhere (no card data stored)', async () => {
    const post = await request(app)
      .post('/api/payments')
      .send({ reservation_id: 105, amount: 5, provider_ref: 'PSP-C', card_number: '4242424242424242' })
    expect(post.status).toBe(400)
    expect(post.body.error).toMatch(/card data/i)

    const put = await request(app).put('/api/payments/1').send({ cvv: '123' })
    expect(put.status).toBe(400)

    const hook = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-100101', status: 'SUCCEEDED', card: '4242' })
    expect(hook.status).toBe(400)

    const all = await request(app).get('/api/payments')
    expect(JSON.stringify(all.body)).not.toMatch(/4242424242424242/)
  })

  it('POST /api/payments/webhook marks a payment SUCCEEDED (and is idempotent)', async () => {
    const p = await createPending(110, 'PSP-WH-110')
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-WH-110', status: 'SUCCEEDED' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('id', p.id)
    expect(res.body).toHaveProperty('status', 'SUCCEEDED')

    const retry = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-WH-110', status: 'SUCCEEDED' })
    expect(retry.status).toBe(200)
  })

  it('POST /api/payments/webhook marks a payment FAILED', async () => {
    await createPending(111, 'PSP-WH-111')
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-WH-111', status: 'FAILED' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'FAILED')
  })

  it('POST /api/payments/webhook returns 400, 404 or 409 when it should', async () => {
    const noRef = await request(app).post('/api/payments/webhook').send({ status: 'SUCCEEDED' })
    expect(noRef.status).toBe(400)

    const badStatus = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-100101', status: 'REFUNDED' })
    expect(badStatus.status).toBe(400)

    const unknown = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-NOPE', status: 'SUCCEEDED' })
    expect(unknown.status).toBe(404)

    await createPending(112, 'PSP-WH-112')
    await request(app).post('/api/payments/webhook').send({ provider_ref: 'PSP-WH-112', status: 'FAILED' })
    const already = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-WH-112', status: 'SUCCEEDED' })
    expect(already.status).toBe(409)
  })

  it('POST /api/payments/webhook returns 409 for a second successful payment on the same reservation', async () => {
    await createPending(101, 'PSP-RETRY-101')
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ provider_ref: 'PSP-RETRY-101', status: 'SUCCEEDED' })
    expect(res.status).toBe(409)
  })

  it('PUT /api/payments/:id updates a payment (200) or 404, 400', async () => {
    const p = await createPending(120, 'PSP-120')

    const ok = await request(app).put(`/api/payments/${p.id}`).send({ amount: 7.5, id: 9999 })
    expect(ok.status).toBe(200)
    expect(ok.body).toHaveProperty('amount', 7.5)
    expect(ok.body).toHaveProperty('id', p.id)

    const missing = await request(app).put('/api/payments/999').send({ amount: 1 })
    expect(missing.status).toBe(404)

    const bad = await request(app).put(`/api/payments/${p.id}`).send({ status: 'NOPE' })
    expect(bad.status).toBe(400)

    const viaPut = await request(app).put(`/api/payments/${p.id}`).send({ status: 'SUCCEEDED' })
    expect(viaPut.status).toBe(400)
  })

  it('PUT /api/payments/:id allows REFUNDED only from SUCCEEDED (else 409)', async () => {
    const refund = await request(app).put('/api/payments/2').send({ status: 'REFUNDED' })
    expect(refund.status).toBe(200)
    expect(refund.body).toHaveProperty('status', 'REFUNDED')

    const p = await createPending(130, 'PSP-130')
    const res = await request(app).put(`/api/payments/${p.id}`).send({ status: 'REFUNDED' })
    expect(res.status).toBe(409)
  })

  it('DELETE /api/payments/:id deletes a payment (204) or 404', async () => {
    const p = await createPending(140, 'PSP-140')
    const res = await request(app).delete(`/api/payments/${p.id}`)
    expect(res.status).toBe(204)

    const missing = await request(app).delete(`/api/payments/${p.id}`)
    expect(missing.status).toBe(404)
  })
})
