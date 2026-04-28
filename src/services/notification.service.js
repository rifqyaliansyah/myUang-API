const pool = require('../config/database')

const getNotifications = async (userId) => {
    const result = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    )
    return result.rows
}

const markAllRead = async (userId) => {
    await pool.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
        [userId]
    )
}

const removeAll = async (userId) => {
    await pool.query(
        'DELETE FROM notifications WHERE user_id = $1',
        [userId]
    )
}

const createNotification = async (userId, { title, body, type }) => {
    const result = await pool.query(
        `INSERT INTO notifications (user_id, title, body, type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, title, body, type]
    )
    return result.rows[0]
}

const getNotificationDetail = async (userId, notifId) => {
    const result = await pool.query(
        'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
        [notifId, userId]
    )
    if (!result.rows[0]) throw new AppError('Notification not found', 404)
    return result.rows[0]
}

const markOneRead = async (userId, notifId) => {
    await pool.query(
        'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
        [notifId, userId]
    )
}

const deleteOne = async (userId, notifId) => {
    const result = await pool.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
        [notifId, userId]
    )
    if (!result.rows[0]) throw new AppError('Notification not found', 404)
}

module.exports = { getNotifications, markAllRead, removeAll, createNotification, getNotificationDetail, markOneRead, deleteOne }