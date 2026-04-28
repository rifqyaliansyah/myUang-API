const pool = require('../config/database')
const AppError = require('../utils/AppError')

const getGoals = async (userId) => {
    const result = await pool.query(
        'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at ASC',
        [userId]
    )
    return result.rows
}

const createGoal = async (userId, { name, target_amount, description }) => {
    const result = await pool.query(
        `INSERT INTO goals (user_id, name, target_amount, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, name, target_amount || 0, description || '']
    )
    return result.rows[0]
}

const updateGoal = async (userId, goalId, { name, target_amount, description }) => {
    const result = await pool.query(
        `UPDATE goals SET name = $1, target_amount = $2, description = $3, updated_at = NOW()
         WHERE id = $4 AND user_id = $5 RETURNING *`,
        [name, target_amount, description, goalId, userId]
    )
    if (!result.rows[0]) throw new AppError('Goal not found', 404)
    return result.rows[0]
}

const deleteGoal = async (userId, goalId) => {
    const result = await pool.query(
        'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
        [goalId, userId]
    )
    if (!result.rows[0]) throw new AppError('Goal not found', 404)
}

const topUpGoal = async (userId, goalId, { wallet_id, amount, note }) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        const goalRes = await client.query(
            'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
            [goalId, userId]
        )
        if (!goalRes.rows[0]) throw new AppError('Goal not found', 404)

        if (wallet_id) {
            const walletRes = await client.query(
                'SELECT * FROM wallets WHERE id = $1 AND user_id = $2',
                [wallet_id, userId]
            )
            if (!walletRes.rows[0]) throw new AppError('Wallet not found', 404)
            if (Number(walletRes.rows[0].balance) < Number(amount))
                throw new AppError('Insufficient balance', 400)

            await client.query(
                'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
                [amount, wallet_id]
            )
        }

        await client.query(
            `INSERT INTO transactions (user_id, wallet_id, goal_id, type, amount, note, date)
            VALUES ($1, $2, $3, 'goal_topup', $4, $5, CURRENT_DATE)`,
            [userId, wallet_id || null, goalId, amount, note || null] // ← null, bukan fallback string
        )

        const updatedGoal = await client.query(
            `UPDATE goals SET reached = reached + $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3 RETURNING *`,
            [amount, goalId, userId]
        )

        await client.query('COMMIT')
        return updatedGoal.rows[0]
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    } finally {
        client.release()
    }
}

module.exports = { getGoals, createGoal, updateGoal, deleteGoal, topUpGoal }