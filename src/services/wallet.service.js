const db = require('../config/database')
const AppError = require('../utils/AppError')

const getWallets = async (userId) => {
    const result = await db.query(
        'SELECT * FROM wallets WHERE user_id = $1 ORDER BY is_active DESC, created_at ASC',
        [userId]
    )
    return result.rows
}

const createWallet = async (userId, { name, balance }) => {
    const existing = await db.query('SELECT id FROM wallets WHERE user_id = $1', [userId])
    const isActive = existing.rows.length === 0

    const result = await db.query(
        `INSERT INTO wallets (user_id, name, balance, is_active)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, name, balance, isActive]
    )
    return result.rows[0]
}

const updateWallet = async (userId, walletId, { name, balance }) => {
    const result = await db.query(
        `UPDATE wallets SET name = $1, balance = $2, updated_at = NOW()
         WHERE id = $3 AND user_id = $4 RETURNING *`,
        [name, balance, walletId, userId]
    )
    if (!result.rows[0]) throw new AppError('Wallet not found', 404)
    return result.rows[0]
}

const deleteWallet = async (userId, walletId) => {
    const wallet = await db.query(
        'SELECT * FROM wallets WHERE id = $1 AND user_id = $2',
        [walletId, userId]
    )
    if (!wallet.rows[0]) throw new AppError('Wallet not found', 404)

    await db.query('DELETE FROM wallets WHERE id = $1', [walletId])

    if (wallet.rows[0].is_active) {
        await db.query(
            `UPDATE wallets SET is_active = TRUE, updated_at = NOW()
             WHERE user_id = $1 AND id = (SELECT id FROM wallets WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1)`,
            [userId]
        )
    }
}

const setActiveWallet = async (userId, walletId) => {
    await db.query(
        'UPDATE wallets SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1',
        [userId]
    )
    const result = await db.query(
        'UPDATE wallets SET is_active = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
        [walletId, userId]
    )
    if (!result.rows[0]) throw new AppError('Wallet not found', 404)
    return result.rows[0]
}

module.exports = { getWallets, createWallet, updateWallet, deleteWallet, setActiveWallet }