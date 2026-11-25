/**
 * Integration tests for /api/teachers (full CRUD).
 * Tests run in order and share the same in-memory data.
 */
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'

const newTeacher = { user_id: 4, specialty: 'Computer Science' }

describe('Teachers API (/api/teachers) - Full CRUD', () => {
  describe('GET', () => {
    it('GET /api/teachers returns the list of teachers (200)', async () => {
      const res = await request(app).get('/api/teachers')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThanOrEqual(1)
      expect(res.body[0]).toHaveProperty('user_id')
      expect(res.body[0]).toHaveProperty('specialty')
    })

    it('GET /api/teachers/:id returns one teacher (200)', async () => {
      const res = await request(app).get('/api/teachers/1')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 1, user_id: 2, specialty: 'Mathematics' })
    })

    it('GET /api/teachers/:id returns 404 for an unknown id', async () => {
      const res = await request(app).get('/api/teachers/999')
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Teacher not found' })
    })
  })

  describe('POST', () => {
    it('creates a teacher and trims the specialty (201)', async () => {
      const res = await request(app).post('/api/teachers').send({ ...newTeacher, specialty: '  Computer Science  ' })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ id: 2, ...newTeacher })
    })

    it('accepts user_id sent as a numeric string and stores a number (201)', async () => {
      const res = await request(app).post('/api/teachers').send({ user_id: '5', specialty: 'Physics' })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({ id: 3, user_id: 5, specialty: 'Physics' })
    })

    it('returns 400 when a required field is missing', async () => {
      const res = await request(app).post('/api/teachers').send({ user_id: 6 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Missing required fields: user_id and specialty are required' })
    })

    it('returns 400 when user_id is not a positive integer', async () => {
      const res = await request(app).post('/api/teachers').send({ ...newTeacher, user_id: -1 })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'user_id must be a positive integer' })
    })

    it('returns 400 when specialty is empty', async () => {
      const res = await request(app).post('/api/teachers').send({ user_id: 6, specialty: '   ' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'specialty must be a non-empty string' })
    })

    it('returns 409 when the user already has a teacher profile', async () => {
      const res = await request(app).post('/api/teachers').send({ user_id: 2, specialty: 'Physics' })
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'This user already has a teacher profile' })
    })
  })

  describe('PUT', () => {
    it('updates only the fields sent and keeps the id (200)', async () => {
      const res = await request(app).put('/api/teachers/1').send({ specialty: 'Statistics', id: 999 })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 1, user_id: 2, specialty: 'Statistics' })

      const check = await request(app).get('/api/teachers/1')
      expect(check.body.specialty).toBe('Statistics')
    })

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).put('/api/teachers/999').send({ specialty: 'Mathematics' })
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Teacher not found' })
    })

    it('returns 400 for an invalid update', async () => {
      const res = await request(app).put('/api/teachers/1').send({ specialty: '' })
      expect(res.status).toBe(400)
    })

    it('returns 409 when moving the profile to a user who already has one', async () => {
      const res = await request(app).put('/api/teachers/2').send({ user_id: 2 })
      expect(res.status).toBe(409)
    })
  })

  describe('DELETE', () => {
    it('deletes a teacher (204) and it is gone afterwards (404)', async () => {
      const res = await request(app).delete('/api/teachers/3')
      expect(res.status).toBe(204)

      const check = await request(app).get('/api/teachers/3')
      expect(check.status).toBe(404)
    })

    it('returns 404 when deleting an unknown id', async () => {
      const res = await request(app).delete('/api/teachers/999')
      expect(res.status).toBe(404)
      expect(res.body).toEqual({ error: 'Teacher not found' })
    })
  })
})
