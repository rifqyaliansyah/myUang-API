const db = require('../config/database')
const AppError = require('../utils/AppError')

const getGoals = async (userId) => {
    const result = await db.query(
        'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at ASC',
        [userId]
    )
    return result.rows
}

const createGoal = async (userId, { name, target_amount, description }) => {
    const result = await db.query(
        `INSERT INTO goals (user_id, name, target_amount, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, name, target_amount || 0, description || '']
    )
    return result.rows[0]
}

const updateGoal = async (userId, goalId, { name, target_amount, description }) => {
    const result = await db.query(
        `UPDATE goals SET name = $1, target_amount = $2, description = $3, updated_at = NOW()
         WHERE id = $4 AND user_id = $5 RETURNING *`,
        [name, target_amount, description, goalId, userId]
    )
    if (!result.rows[0]) throw new AppError('Goal not found', 404)
    return result.rows[0]
}

const deleteGoal = async (userId, goalId) => {
    const result = await db.query(
        'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
        [goalId, userId]
    )
    if (!result.rows[0]) throw new AppError('Goal not found', 404)
}

module.exports = { getGoals, createGoal, updateGoal, deleteGoal }