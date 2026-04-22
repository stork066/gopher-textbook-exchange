const { Router } = require('express')
const { ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')

const router = Router()

// GET /api/departments
router.get('/', async (_req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: 'Departments' }))
    const sorted = result.Items.sort((a, b) =>
      a.department_code.localeCompare(b.department_code)
    )
    res.json(sorted)
  } catch (err) {
    console.error('GET /api/departments error:', err.message)
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

module.exports = router
