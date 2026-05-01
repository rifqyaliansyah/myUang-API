const pool = require('../config/database')
const supabase = require('../config/supabase')
const AppError = require('../utils/AppError')
const notificationService = require('./notification.service')

const BUCKET = process.env.SUPABASE_BUCKET || 'transactions'

const uploadImage = async (file, txId) => {
    const ext = file.originalname.split('.').pop()
    const path = `${txId}.${ext}`

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        })

    if (error) throw new AppError('Failed to upload image', 500)

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
}

const deleteImage = async (imageUrl) => {
    try {
        const url = new URL(imageUrl)
        const parts = url.pathname.split(`/${BUCKET}/`)
        if (parts.length < 2) return
        await supabase.storage.from(BUCKET).remove([parts[1]])
    } catch {
        // silently fail
    }
}

const getTransactions = async (userId, { walletId, pocketId, goalId, month, year, type, startDate, endDate, limit = 10, offset = 0 } = {}) => {
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
    if (goalId) {
        query += ` AND t.goal_id = $${idx++}`
        params.push(goalId)
    }
    if (month && year) {
        query += ` AND EXTRACT(MONTH FROM t.date) = $${idx++} AND EXTRACT(YEAR FROM t.date) = $${idx++}`
        params.push(month, year)
    }
    if (startDate) {
        query += ` AND t.date >= $${idx++}`
        params.push(startDate)
    }
    if (endDate) {
        query += ` AND t.date <= $${idx++}`
        params.push(endDate)
    }
    if (type) {
        const types = Array.isArray(type) ? type : String(type).split(',').map(t => t.trim())
        query += ` AND t.type = ANY($${idx++}::text[])`
        params.push(types)
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC`
    query += ` LIMIT $${idx++} OFFSET $${idx++}`
    params.push(limit, offset)

    const result = await pool.query(query, params)
    return result.rows
}

const getSummary = async (userId, walletId, { month, year, startDate, endDate } = {}) => {
    let query = `
        SELECT
            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
            SUM(CASE WHEN type IN ('expense', 'goal_topup') THEN amount ELSE 0 END) AS total_expense
        FROM transactions
        WHERE user_id = $1 AND wallet_id = $2
    `
    const params = [userId, walletId]
    let idx = 3

    if (month && year) {
        query += ` AND EXTRACT(MONTH FROM date) = $${idx++} AND EXTRACT(YEAR FROM date) = $${idx++}`
        params.push(month, year)
    } else if (startDate && endDate) {
        query += ` AND date >= $${idx++} AND date <= $${idx++}`
        params.push(startDate, endDate)
    }

    const result = await pool.query(query, params)
    return {
        total_income: Number(result.rows[0].total_income) || 0,
        total_expense: Number(result.rows[0].total_expense) || 0,
    }
}

const createTransaction = async (userId, { wallet_id, pocket_id, type, amount, note, date, file }) => {
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

        let tx = result.rows[0]

        // Upload image after commit so we have the tx id
        if (file) {
            const imageUrl = await uploadImage(file, tx.id)
            const updated = await pool.query(
                'UPDATE transactions SET image_url = $1 WHERE id = $2 RETURNING *',
                [imageUrl, tx.id]
            )
            tx = updated.rows[0]
        }

        if (type === 'income') {
            await notificationService.createNotification(userId, {
                title: 'Income received',
                body: `IDR ${Number(amount).toLocaleString('id-ID')} has been added to your wallet.`,
                type: 'income'
            })
        }

        if (type === 'expense' && pocket_id) {
            const pocketRes = await pool.query('SELECT * FROM pockets WHERE id = $1', [pocket_id])
            const pocket = pocketRes.rows[0]
            if (pocket) {
                const percent = (Number(pocket.used) / Number(pocket.budget_limit)) * 100
                if (percent >= 100) {
                    await notificationService.createNotification(userId, {
                        title: `${pocket.emoji} ${pocket.name} is over budget!`,
                        body: `You've exceeded your budget limit of IDR ${Number(pocket.budget_limit).toLocaleString('id-ID')}.`,
                        type: 'pocket_over'
                    })
                } else if (percent >= 80) {
                    await notificationService.createNotification(userId, {
                        title: `${pocket.emoji} ${pocket.name} is almost full`,
                        body: `You've used ${Math.floor(percent)}% of your budget limit.`,
                        type: 'pocket_warning'
                    })
                }
            }
        }

        return tx
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

        if (tx.image_url) await deleteImage(tx.image_url)

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