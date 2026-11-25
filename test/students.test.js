import request from 'supertest'
import app from '../src/app.js'
import { describe, it, expect } from 'vitest'

describe('Students API (SmartLocker CRUD)', () => {
  it('GET /api/students returns array of students', async () => {
    const res = await request(app).get('/api/students')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/students/:id returns a student (200) or 404', async () => {
    const res = await request(app).get('/api/students/1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id: 1, user_id: 1, student_number: 'S2026001' })

    const missing = await request(app).get('/api/students/999')
    expect(missing.status).toBe(404)
    expect(missing.body).toHaveProperty('error', 'Student not found')
  })

  it('POST /api/students creates a student (201)', async () => {
    const res = await request(app)
      .post('/api/students')
      .send({ user_id: 10, student_number: 'S2026010' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body).toHaveProperty('user_id', 10)
    expect(res.body).toHaveProperty('student_number', 'S2026010')
  })

  it('POST /api/students returns 400 on missing or invalid fields', async () => {
    const empty = await request(app).post('/api/students')
    expect(empty.status).toBe(400)

    const noNumber = await request(app).post('/api/students').send({ user_id: 11 })
    expect(noNumber.status).toBe(400)
    expect(noNumber.body).toHaveProperty('error')

    const badUser = await request(app)
      .post('/api/students')
      .send({ user_id: -1, student_number: 'S2026011' })
    expect(badUser.status).toBe(400)

    const blankNumber = await request(app)
      .post('/api/students')
      .send({ user_id: 11, student_number: '   ' })
    expect(blankNumber.status).toBe(400)
  })

  it('POST /api/students returns 409 for duplicate user_id or student_number', async () => {
    const sameUser = await request(app)
      .post('/api/students')
      .send({ user_id: 1, student_number: 'S2026999' })
    expect(sameUser.status).toBe(409)

    const sameNumber = await request(app)
      .post('/api/students')
      .send({ user_id: 99, student_number: 'S2026001' })
    expect(sameNumber.status).toBe(409)
  })

  it('PUT /api/students/:id updates a student (200), 404, 400 or 409', async () => {
    const created = await request(app)
      .post('/api/students')
      .send({ user_id: 20, student_number: 'S2026020' })

    const res = await request(app)
      .put(`/api/students/${created.body.id}`)
      .send({ student_number: 'S2026021', id: 12345 })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('student_number', 'S2026021')
    expect(res.body).toHaveProperty('user_id', 20)
    expect(res.body).toHaveProperty('id', created.body.id)

    const missing = await request(app).put('/api/students/999').send({ student_number: 'X' })
    expect(missing.status).toBe(404)

    const bad = await request(app)
      .put(`/api/students/${created.body.id}`)
      .send({ student_number: '' })
    expect(bad.status).toBe(400)

    const conflict = await request(app)
      .put(`/api/students/${created.body.id}`)
      .send({ student_number: 'S2026001' })
    expect(conflict.status).toBe(409)
  })

  it('DELETE /api/students/:id deletes a student (204) or 404, ids are never reused', async () => {
    const a = await request(app)
      .post('/api/students')
      .send({ user_id: 30, student_number: 'S2026030' })
    const b = await request(app)
      .post('/api/students')
      .send({ user_id: 31, student_number: 'S2026031' })

    const res = await request(app).delete(`/api/students/${a.body.id}`)
    expect(res.status).toBe(204)

    const missing = await request(app).delete(`/api/students/${a.body.id}`)
    expect(missing.status).toBe(404)

    const c = await request(app)
      .post('/api/students')
      .send({ user_id: 32, student_number: 'S2026032' })
    expect(c.body.id).toBeGreaterThan(b.body.id)
  })
})
