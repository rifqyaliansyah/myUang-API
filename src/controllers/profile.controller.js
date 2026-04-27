const pool = require('../config/database')
const { success, error } = require('../utils/response.util')

const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, avatar_url, quotes FROM users WHERE id = $1',
            [req.user.userId]
        )
        if (result.rows.length === 0) {
            return error(res, 'User not found', 404)
        }
        return success(res, result.rows[0], 'Profile fetched')
    } catch (err) {
        return error(res, err.message, 500)
    }
}

const updateProfile = async (req, res) => {
    try {
        const { name, quotes } = req.body
        const result = await pool.query(
            'UPDATE users SET name = $1, quotes = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, email, avatar_url, quotes',
            [name, quotes || null, req.user.userId]
        )
        return success(res, result.rows[0], 'Profile updated')
    } catch (err) {
        return error(res, err.message, 500)
    }
}

module.exports = { getProfile, updateProfile }