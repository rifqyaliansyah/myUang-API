const pool = require('../config/database')
const AppError = require('../utils/AppError')

const getTransactions = async (userId, { walletId, pocketId, month, year, type } = {}) => {
    let query = `
        SELECT 
            t.*,
            p.name AS pocket_name,
            p.emoji AS pocket_emoji,
            g.name AS goal_name
        FROM transactions t
        LEFT JOIN pockets p ON t.pocket_id = p.id
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.user_id = $1
    `
    const params = [userId]
    let idx = 2

    if (walletId) {
        query += ` AND t.wallet_id = $${idx++}`
        params.push(walletId)
    }
    if (pocketId) {
        query += ` AND t.pocket_id = $${idx++}`
        params.push(pocketId)
    }
    if (month && year) {
        query += ` AND EXTRACT(MONTH FROM t.date) = $${idx++} AND EXTRACT(YEAR FROM t.date) = $${idx++}`
        params.push(month, year)
    }
    if (type) {
        query += ` AND t.type = $${idx++}`
        params.push(type)
    }

    query += ' ORDER BY t.date DESC, t.created_at DESC'

    const result = await pool.query(query, params)
    return result.rows
}

const getSummary = async (userId, walletId, month, year) => {
    const result = await pool.query(
        `SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
            SUM(CASE WHEN type IN ('expense', 'goal_topup') THEN amount ELSE 0 END) AS total_expense
         FROM transactions
         WHERE user_id = $1 AND wallet_id = $2
           AND EXTRACT(MONTH FROM date) = $3
           AND EXTRACT(YEAR FROM date) = $4`,
        [userId, walletId, month, year]
    )
    return {
        total_income: Number(result.rows[0].total_income) || 0,
        total_expense: Number(result.rows[0].total_expense) || 0,
    }
}

const createTransaction = async (userId, { wallet_id, pocket_id, type, amount, note, date }) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        const walletRes = await client.query(
            'SELECT * FROM wallets WHERE id = $1 AND user_id = $2',
            [wallet_id, userId]
        )
        if (!walletRes.rows[0]) throw new AppError('Wallet not found', 404)

        const wallet = walletRes.rows[0]

        if (type === 'income') {
            await client.query(
                'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
                [amount, wallet_id]
            )
        } else {
            if (Number(wallet.balance) < Number(amount)) throw new AppError('Insufficient balance', 400)
            await client.query(
                'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
                [amount, wallet_id]
            )
            if (pocket_id) {
                const pocketRes = await client.query(
                    'SELECT id FROM pockets WHERE id = $1 AND user_id = $2',
                    [pocket_id, userId]
                )
                if (pocketRes.rows[0]) {
                    await client.query(
                        'UPDATE pockets SET used = used + $1, updated_at = NOW() WHERE id = $2',
                        [amount, pocket_id]
                    )
                }
            }
        }

        const result = await client.query(
            `INSERT INTO transactions (user_id, wallet_id, pocket_id, type, amount, note, date)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, wallet_id, pocket_id || null, type, amount, note || '', date || new Date()]
        )

        await client.query('COMMIT')
        return result.rows[0]
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    } finally {
        client.release()
    }
}

const deleteTransaction = async (userId, transactionId) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        const txRes = await client.query(
            'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
            [transactionId, userId]
        )
        if (!txRes.rows[0]) throw new AppError('Transaction not found', 404)

        const tx = txRes.rows[0]

        if (tx.type === 'income') {
            await client.query(
                'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
                [tx.amount, tx.wallet_id]
            )
        } else {
            await client.query(
                'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
                [tx.amount, tx.wallet_id]
            )
            if (tx.pocket_id) {
                await client.query(
                    'UPDATE pockets SET used = GREATEST(used - $1, 0), updated_at = NOW() WHERE id = $2',
                    [tx.amount, tx.pocket_id]
                )
            }
        }

        await client.query('DELETE FROM transactions WHERE id = $1', [transactionId])
        await client.query('COMMIT')
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    } finally {
        client.release()
    }
}

module.exports = { getTransactions, getSummary, createTransaction, deleteTransaction }