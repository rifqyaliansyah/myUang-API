const db = require('../config/database')
const AppError = require('../utils/AppError')

const getPockets = async (userId) => {
    const result = await db.query(
        'SELECT * FROM pockets WHERE user_id = $1 ORDER BY created_at ASC',
        [userId]
    )
    return result.rows
}

const createPocket = async (userId, { emoji, name, budget_limit, description }) => {
    const result = await db.query(
        `INSERT INTO pockets (user_id, emoji, name, budget_limit, description)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, emoji || '😊', name, budget_limit || 0, description || '']
    )
    return result.rows[0]
}

const updatePocket = async (userId, pocketId, { emoji, name, budget_limit, description }) => {
    const result = await db.query(
        `UPDATE pockets SET emoji = $1, name = $2, budget_limit = $3, description = $4, updated_at = NOW()
         WHERE id = $5 AND user_id = $6 RETURNING *`,
        [emoji, name, budget_limit, description, pocketId, userId]
    )
    if (!result.rows[0]) throw new AppError('Pocket not found', 404)
    return result.rows[0]
}

const deletePocket = async (userId, pocketId) => {
    const result = await db.query(
        'DELETE FROM pockets WHERE id = $1 AND user_id = $2 RETURNING id',
        [pocketId, userId]
    )
    if (!result.rows[0]) throw new AppError('Pocket not found', 404)
}

module.exports = { getPockets, createPocket, updatePocket, deletePocket }