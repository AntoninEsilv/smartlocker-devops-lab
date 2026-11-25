import express from 'express'
const router = express.Router()

let students = [
  { id: 1, user_id: 1, student_number: 'S2026001' }
]

function isPositiveInt (v) {
  return Number.isInteger(v) && v > 0
}

function isNonEmptyString (v) {
  return typeof v === 'string' && v.trim() !== ''
}

// Returns an error message if the fields present in `data` are invalid
function validate (data, requireAll) {
  if (requireAll || data.user_id !== undefined) {
    if (!isPositiveInt(data.user_id)) return 'user_id must be a positive integer'
  }
  if (requireAll || data.student_number !== undefined) {
    if (!isNonEmptyString(data.student_number)) return 'student_number must be a non-empty string'
  }
  return null
}

// Returns an error message if the profile or the student number is already used
function findConflict (data, ignoreId) {
  const others = students.filter(s => s.id !== ignoreId)
  if (data.user_id !== undefined && others.some(s => s.user_id === data.user_id)) {
    return 'A student profile already exists for this user'
  }
  if (data.student_number !== undefined && others.some(s => s.student_number === data.student_number)) {
    return 'student_number already in use'
  }
  return null
}

// GET all students
router.get('/', (_req, res) => {
  res.status(200).json(students)
})

// GET student by ID
router.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  const student = students.find(s => s.id === id)
  if (!student) return res.status(404).json({ error: 'Student not found' })
  res.json(student)
})

// POST create a new student profile
router.post('/', (req, res) => {
  const { user_id: userId, student_number: studentNumber } = req.body || {}
  const data = { user_id: userId, student_number: studentNumber }
  const invalid = validate(data, true)
  if (invalid) return res.status(400).json({ error: invalid })
  const conflict = findConflict(data)
  if (conflict) return res.status(409).json({ error: conflict })

  const nextId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1
  const newStudent = { id: nextId, ...data }
  students.push(newStudent)
  res.status(201).json(newStudent)
})

// PUT update a student by ID (only the sent fields change)
router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const index = students.findIndex(s => s.id === id)
  if (index === -1) return res.status(404).json({ error: 'Student not found' })

  const data = {}
  if (req.body && req.body.user_id !== undefined) data.user_id = req.body.user_id
  if (req.body && req.body.student_number !== undefined) data.student_number = req.body.student_number

  const invalid = validate(data, false)
  if (invalid) return res.status(400).json({ error: invalid })
  const conflict = findConflict(data, id)
  if (conflict) return res.status(409).json({ error: conflict })

  students[index] = { ...students[index], ...data, id }
  res.json(students[index])
})

// DELETE a student by ID
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const before = students.length
  students = students.filter(s => s.id !== id)
  if (students.length === before) return res.status(404).json({ error: 'Student not found' })
  res.status(204).end()
})

export default router
