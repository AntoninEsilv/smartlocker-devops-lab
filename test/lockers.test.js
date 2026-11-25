/**
 * Integration tests for /api/lockers (full CRUD + SMAR-39 acceptance criteria).
 * Tests run in order and share the same in-memory data.
 * Seed data: hubs 1 and 2; reservations 101 (locker 1) and 102 (locker 2) are
 * CONFIRMED and 103 (locker 3) is PENDING_PAYMENT, so lockers 1-3 have active bookings.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'

const newLocker = { number: 'A-04', size: 'M', hub_id: 1 }

describe('Lockers API (/api/lockers) - Full CRUD', () => {
  describe('GET', () => {
    it('GET /api/lockers returns the list of lockers (200)', async () => {
      const res = await request(app).get('/api/lockers')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(5)
      expect(Object.keys(res.body[0]).sort()).toEqual(['hub_id', 'id', 'number', 'size', 'status'])
    })

    it('lockers 1 to 5 exist (they are used by /api/reservations)', async () => {
      const res = await request(app).get('/api/lockers')
      const ids = res.body.map((l) => l.id)
      expect(ids).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]))
    })

    it('GET /api/lockers?status=AVAILABLE returns only available lockers', async () => {
      const res = await request(app).get('/api/lockers?status=AVAILABLE')
      expect(res.status).toBe(200)
      expect(res.body.length).toBeGreaterThan(0)
      expect(res.body.every((l) => l.status === 'AVAILABLE')).toBe(true)
    })

    it('GET /api/lockers?hub_id=2&status=OUT_OF_SERVICE combines both filters', async () => {
      const res = await request(app).get('/api/lockers?hub_id=2&status=OUT_OF_SERVICE')
      expect(res.status).toBe(200)
      expect(res.body).toEqual([{ id: 5, number: 'B-02', size: 'L', hub_id: 2, status: 'OUT_OF_SERVICE' }])
    })

    it('GET /api/lockers?status=BROKEN returns 400', async () => {
      const res = await request(app).get('/api/lockers?status=BROKEN')
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'status must be one of: AVAILABLE, OUT_OF_SERVICE' })
    })

    it('GET /api/lockers?hub_id=abc returns 400', async () => {
      const res = await request(app).get('/api/lockers?hub_id=abc')
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'hub_id must be a positive integer' })
    })

    it('GET /api/lockers/:id returns one locker (200)', async () => {
      const res = await request(app).get('/api/lockers/1')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 1, number: 'A-01', size: 'S', hub_id: 1, status: 'AVAILABLE' })
    })

    it('GET /api/lockers/:id returns 404 for an unknown id', async () => {
      const res = await request(app).get('/api/lockers/999')
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Locker not found' })
    })
  })

  describe('POST', () => {
    it('creates a locker in a hub, AVAILABLE by default (201)', async () => {
      const res = await request(app).post('/api/lockers').send({ ...newLocker, number: '  A-04 ', hub_id: '1' })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ id: 6, ...newLocker, status: 'AVAILABLE' })
    })

    it('creates a locker directly OUT_OF_SERVICE (201)', async () => {
      const res = await request(app).post('/api/lockers').send({ number: 'B-03', size: 'S', hub_id: 2, status: 'OUT_OF_SERVICE' })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ id: 7, status: 'OUT_OF_SERVICE' })
    })

    it('returns 400 when a required field is missing', async () => {
      const res = await request(app).post('/api/lockers').send({ number: 'A-05', size: 'S' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Missing required fields: number, size and hub_id are required' })
    })

    it('returns 400 when number is empty', async () => {
      const res = await request(app).post('/api/lockers').send({ ...newLocker, number: '  ' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'number must be a non-empty string' })
    })

    it('returns 400 when size is invalid', async () => {
      const res = await request(app).post('/api/lockers').send({ ...newLocker, number: 'A-05', size: 'XL' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'size must be one of: S, M, L' })
    })

    it('returns 400 when hub_id is not a positive integer', async () => {
      const res = await request(app).post('/api/lockers').send({ ...newLocker, number: 'A-05', hub_id: 0 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'hub_id must be a positive integer' })
    })

    it('returns 400 when the hub does not exist', async () => {
      const res = await request(app).post('/api/lockers').send({ ...newLocker, number: 'A-05', hub_id: 99 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'hub_id does not match any hub' })
    })

    it('returns 400 when status is invalid', async () => {
      const res = await request(app).post('/api/lockers').send({ ...newLocker, number: 'A-05', status: 'BROKEN' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'status must be one of: AVAILABLE, OUT_OF_SERVICE' })
    })

    it('returns 409 when the number already exists in the same hub', async () => {
      const res = await request(app).post('/api/lockers').send({ number: 'a-01', size: 'S', hub_id: 1 })
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'A locker with this number already exists in this hub' })
    })

    it('accepts the same number in another hub (201)', async () => {
      const res = await request(app).post('/api/lockers').send({ number: 'A-01', size: 'S', hub_id: 2 })
      expect(res.status).toBe(201)
      expect(res.body.id).toBe(8)
    })
  })

  describe('PUT', () => {
    it('puts a locker out of service, keeps the other fields and the id (200)', async () => {
      const res = await request(app).put('/api/lockers/1').send({ status: 'OUT_OF_SERVICE', id: 999 })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 1, number: 'A-01', size: 'S', hub_id: 1, status: 'OUT_OF_SERVICE' })

      const check = await request(app).get('/api/lockers/1')
      expect(check.body.status).toBe('OUT_OF_SERVICE')
    })

    it('changes the size and moves the locker to another hub (200)', async () => {
      const res = await request(app).put('/api/lockers/6').send({ size: 'L', hub_id: 2 })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 6, number: 'A-04', size: 'L', hub_id: 2, status: 'AVAILABLE' })
    })

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/api/lockers/999').send({ status: 'AVAILABLE' })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Locker not found' })
    })

    it('returns 400 for an invalid update', async () => {
      const res = await request(app).put('/api/lockers/1').send({ size: 'XL' })
      expect(res.status).toBe(400)
    })

    it('returns 409 when renaming a locker to a number already used in its hub', async () => {
      const res = await request(app).put('/api/lockers/2').send({ number: 'A-01' })
      expect(res.status).toBe(409)
    })
  })

  describe('DELETE', () => {
    it('refuses to delete a locker with a CONFIRMED booking (409)', async () => {
      const res = await request(app).delete('/api/lockers/1')
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'This locker has an active booking and cannot be deleted' })

      const check = await request(app).get('/api/lockers/1')
      expect(check.status).toBe(200)
    })

    it('refuses to delete a locker held for payment (PENDING_PAYMENT) (409)', async () => {
      const res = await request(app).delete('/api/lockers/3')
      expect(res.status).toBe(409)
    })

    it('allows the deletion once the booking is cancelled (204)', async () => {
      const cancel = await request(app).put('/api/reservations/102').send({ status: 'CANCELLED' })
      expect(cancel.status).toBe(200)

      const res = await request(app).delete('/api/lockers/2')
      expect(res.status).toBe(204)
    })

    it('deletes a locker without booking (204) and it is gone afterwards (404)', async () => {
      const res = await request(app).delete('/api/lockers/8')
      expect(res.status).toBe(204)
      expect(res.body).toEqual({})

      const check = await request(app).get('/api/lockers/8')
      expect(check.status).toBe(404)
    })

    it('gives a new id after a deletion without creating duplicates', async () => {
      const res = await request(app).post('/api/lockers').send({ number: 'B-04', size: 'S', hub_id: 2 })
      expect(res.status).toBe(201)
      expect(res.body.id).toBe(8)

      const list = await request(app).get('/api/lockers')
      const ids = list.body.map((l) => l.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('returns 404 when deleting an unknown id', async () => {
      const res = await request(app).delete('/api/lockers/999')
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Locker not found' })
    })
  })
})
