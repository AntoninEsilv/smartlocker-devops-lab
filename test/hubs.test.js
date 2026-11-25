/**
 * Integration tests for /api/hubs (full CRUD + SMAR-39 acceptance criteria).
 * Tests run in order and share the same in-memory data.
 * Seed data: hub 1 (lockers 1-3) and hub 2 (lockers 4-5).
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'

const ADDRESS = '12 avenue Léonard de Vinci, 92400 Courbevoie'
const newHub = { name: 'Campus Nanterre – Bâtiment C', address: '200 avenue de la République, 92000 Nanterre', opening_hours: 'Mon-Fri 08:00-18:00' }

describe('Hubs API (/api/hubs) - Full CRUD', () => {
  describe('GET', () => {
    it('GET /api/hubs returns the list of hubs (200)', async () => {
      const res = await request(app).get('/api/hubs')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(2)
      expect(Object.keys(res.body[0]).sort()).toEqual(['address', 'id', 'name', 'opening_hours'])
    })

    it('GET /api/hubs/:id returns one hub (200)', async () => {
      const res = await request(app).get('/api/hubs/1')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 1, name: 'Pôle Léonard de Vinci – Hall A', address: ADDRESS, opening_hours: 'Mon-Fri 07:30-20:00' })
    })

    it('GET /api/hubs/:id returns 404 for an unknown id', async () => {
      const res = await request(app).get('/api/hubs/999')
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Hub not found' })
    })
  })

  describe('POST', () => {
    it('creates a hub with trimmed fields (201)', async () => {
      const res = await request(app).post('/api/hubs').send({ ...newHub, name: `  ${newHub.name}  ` })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ id: 3, ...newHub })
    })

    it('returns 400 when a required field is missing', async () => {
      const res = await request(app).post('/api/hubs').send({ name: 'Hub D', address: ADDRESS })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Missing required fields: name, address and opening_hours are required' })
    })

    it('returns 400 when name is empty', async () => {
      const res = await request(app).post('/api/hubs').send({ ...newHub, name: ' ' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'name must be a non-empty string' })
    })

    it('returns 400 when address is not a string', async () => {
      const res = await request(app).post('/api/hubs').send({ ...newHub, name: 'Hub D', address: 12 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'address must be a non-empty string' })
    })

    it('returns 400 when opening_hours is empty', async () => {
      const res = await request(app).post('/api/hubs').send({ ...newHub, name: 'Hub D', opening_hours: '' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'opening_hours must be a non-empty string' })
    })

    it('returns 409 when a hub with the same name exists', async () => {
      const res = await request(app).post('/api/hubs').send({ ...newHub, name: 'pôle léonard de vinci – hall a' })
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'A hub with this name already exists' })
    })
  })

  describe('PUT', () => {
    it('updates only the opening hours and keeps the id (200)', async () => {
      const res = await request(app).put('/api/hubs/1').send({ opening_hours: 'Mon-Sat 07:00-21:00', id: 999 })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 1, name: 'Pôle Léonard de Vinci – Hall A', address: ADDRESS, opening_hours: 'Mon-Sat 07:00-21:00' })

      const check = await request(app).get('/api/hubs/1')
      expect(check.body.opening_hours).toBe('Mon-Sat 07:00-21:00')
    })

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/api/hubs/999').send({ opening_hours: 'Mon-Fri 08:00-18:00' })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Hub not found' })
    })

    it('returns 400 for an invalid update', async () => {
      const res = await request(app).put('/api/hubs/1').send({ address: '' })
      expect(res.status).toBe(400)
    })

    it('returns 409 when renaming a hub to an existing name', async () => {
      const res = await request(app).put('/api/hubs/3').send({ name: 'Pôle Léonard de Vinci – Hall B' })
      expect(res.status).toBe(409)
    })
  })

  describe('DELETE', () => {
    it('refuses to delete a hub that still has lockers (409)', async () => {
      const res = await request(app).delete('/api/hubs/2')
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'This hub still has lockers: delete or move them first' })
    })

    it('deletes an empty hub (204) and it is gone afterwards (404)', async () => {
      const res = await request(app).delete('/api/hubs/3')
      expect(res.status).toBe(204)

      const check = await request(app).get('/api/hubs/3')
      expect(check.status).toBe(404)
    })

    it('a locker cannot be created in a deleted hub (400)', async () => {
      const res = await request(app).post('/api/lockers').send({ number: 'C-01', size: 'S', hub_id: 3 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'hub_id does not match any hub' })
    })

    it('returns 404 when deleting an unknown id', async () => {
      const res = await request(app).delete('/api/hubs/999')
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Hub not found' })
    })
  })
})
