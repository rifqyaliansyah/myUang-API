const pool = require('../config/database')
const supabase = require('../config/supabase')
const AppError = require('../utils/AppError')
const notificationService = require('./notification.service')

const BUCKET = process.env.SUPABASE_BUCKET || 'goals'

const uploadImage = async (file, goalId) => {
    const ext = file.originalname.split('.').pop()
    const path = `${goalId}.${ext}`

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
        const path = parts[1]
        await supabase.storage.from(BUCKET).remove([path])
    } catch {
        // silently fail, not critical
    }
}

const getGoals = async (userId) => {
    const result = await pool.query(
        'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at ASC',
        [userId]
    )
    return result.rows
}

const createGoal = async (userId, { name, target_amount, description, file }) => {
    const result = await pool.query(
        `INSERT INTO goals (user_id, name, target_amount, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, name, target_amount || 0, description || '']
    )
    let goal = result.rows[0]

    if (file) {
        const imageUrl = await uploadImage(file, goal.id)
        const updated = await pool.query(
            'UPDATE goals SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [imageUrl, goal.id]
        )
        goal = updated.rows[0]
    }

    return goal
}

const updateGoal = async (userId, goalId, { name, target_amount, description, file }) => {
    const existing = await pool.query(
        'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
        [goalId, userId]
    )
    if (!existing.rows[0]) throw new AppError('Goal not found', 404)

    let imageUrl = existing.rows[0].image_url

    if (file) {
        if (imageUrl) await deleteImage(imageUrl)
        imageUrl = await uploadImage(file, goalId)
    }

    const result = await pool.query(
        `UPDATE goals
         SET name = $1, target_amount = $2, description = $3, image_url = $4, updated_at = NOW()
         WHERE id = $5 AND user_id = $6 RETURNING *`,
        [name, target_amount, description, imageUrl, goalId, userId]
    )
    return result.rows[0]
}

const deleteGoal = async (userId, goalId) => {
    const existing = await pool.query(
        'SELECT image_url FROM goals WHERE id = $1 AND user_id = $2',
        [goalId, userId]
    )
    if (!existing.rows[0]) throw new AppError('Goal not found', 404)

    if (existing.rows[0].image_url) {
        await deleteImage(existing.rows[0].image_url)
    }

    await pool.query(
        'DELETE FROM goals WHERE id = $1 AND user_id = $2',
        [goalId, userId]
    )
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
            [userId, wallet_id || null, goalId, amount, note || null]
        )

        const updatedGoal = await client.query(
            `UPDATE goals SET reached = reached + $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3 RETURNING *`,
            [amount, goalId, userId]
        )

        await client.query('COMMIT')

        const updatedData = updatedGoal.rows[0]
        const percent = (Number(updatedData.reached) / Number(updatedData.target_amount)) * 100

        if (percent >= 100) {
            await notificationService.createNotification(userId, {
                title: `🎉 Goal "${updatedData.name}" completed!`,
                body: `Congrats! You've reached your target of IDR ${Number(updatedData.target_amount).toLocaleString('id-ID')}.`,
                type: 'goal_complete'
            })
        } else if (percent >= 80) {
            await notificationService.createNotification(userId, {
                title: `Goal "${updatedData.name}" almost there!`,
                body: `You've reached ${Math.floor(percent)}% of your goal. Keep it up!`,
                type: 'goal_progress'
            })
        }

        return updatedData
    } catch (err) {
        await client.query('ROLLBACK')
        throw err
    } finally {
        client.release()
    }
}

module.exports = { getGoals, createGoal, updateGoal, deleteGoal, topUpGoal }