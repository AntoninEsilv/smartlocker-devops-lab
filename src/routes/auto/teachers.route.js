/**
 * Teachers API (SmartLocker) - full CRUD
 * Teacher = staff who check the lockers and report problems.
 * Like Student (student_number) and Management (job), it is a profile
 * linked to a User (identity: name, email, role) and adds its own field: specialty.
 *
 * GET    /api/teachers      → list all teachers
 * GET    /api/teachers/:id  → one teacher (404 if unknown)
 * POST   /api/teachers      → create { user_id, specialty }
 * PUT    /api/teachers/:id  → update (partial body accepted)
 * DELETE /api/teachers/:id  → delete (204)
 *
 * Rules:
 *  - one teacher profile per user (409 if the user_id is already used)
 */
import express from 'express'

const router = express.Router()

// user_id 2 is "Marc Dubois" (role Teacher) in /api/users
let teachers = [
  { id: 1, user_id: 2, specialty: 'Mathematics' }
]

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

// Returns an error message, or null when the teacher is valid
function validate (teacher) {
  const { user_id: userId, specialty } = teacher
  if (userId === undefined || specialty === undefined) {
    return 'Missing required fields: user_id and specialty are required'
  }
  if (!isPositiveInteger(userId)) {
    return 'user_id must be a positive integer'
  }
  if (!isNonEmptyString(specialty)) {
    return 'specialty must be a non-empty string'
  }
  return null
}

const normalise = (t) => ({
  id: t.id,
  user_id: Number(t.user_id),
  specialty: t.specialty.trim()
})

const userAlreadyTeacher = (teacher) =>
  teachers.some((t) => t.id !== teacher.id && t.user_id === teacher.user_id)

const findIndexById = (id) => teachers.findIndex((t) => t.id === Number(id))

// GET all teachers
router.get('/', (_req, res) => {
  res.status(200).json(teachers)
})

// GET one teacher by ID
router.get('/:id', (req, res) => {
  const teacher = teachers[findIndexById(req.params.id)]
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' })
  }
  res.status(200).json(teacher)
})

// POST create a teacher profile
router.post('/', (req, res) => {
  const error = validate(req.body)
  if (error) {
    return res.status(400).json({ error })
  }
  const newId = teachers.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const teacher = normalise({ ...req.body, id: newId })
  if (userAlreadyTeacher(teacher)) {
    return res.status(409).json({ error: 'This user already has a teacher profile' })
  }
  teachers.push(teacher)
  res.status(201).json(teacher)
})

// PUT update a teacher profile (fields not sent are kept, the id never changes)
router.put('/:id', (req, res) => {
  const index = findIndexById(req.params.id)
  if (index === -1) {
    return res.status(404).json({ error: 'Teacher not found' })
  }
  const candidate = { ...teachers[index], ...req.body, id: teachers[index].id }
  const error = validate(candidate)
  if (error) {
    return res.status(400).json({ error })
  }
  const updated = normalise(candidate)
  if (userAlreadyTeacher(updated)) {
    return res.status(409).json({ error: 'This user already has a teacher profile' })
  }
  teachers[index] = updated
  res.status(200).json(updated)
})

// DELETE a teacher profile
router.delete('/:id', (req, res) => {
  const before = teachers.length
  teachers = teachers.filter((t) => t.id !== Number(req.params.id))
  if (teachers.length === before) {
    return res.status(404).json({ error: 'Teacher not found' })
  }
  res.status(204).end()
})

export default router
