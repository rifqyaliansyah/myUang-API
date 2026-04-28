const notificationService = require('../services/notification.service')
const { success, error } = require('../utils/response.util')

const getNotifications = async (req, res) => {
    try {
        const result = await notificationService.getNotifications(req.user.userId)
        return success(res, result, 'Notifications fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const markAllRead = async (req, res) => {
    try {
        await notificationService.markAllRead(req.user.userId)
        return success(res, null, 'All notifications marked as read')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const removeAll = async (req, res) => {
    try {
        await notificationService.removeAll(req.user.userId)
        return success(res, null, 'All notifications removed')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const getNotificationDetail = async (req, res) => {
    try {
        const result = await notificationService.getNotificationDetail(req.user.userId, req.params.id)
        return success(res, result, 'Notification fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const markOneRead = async (req, res) => {
    try {
        await notificationService.markOneRead(req.user.userId, req.params.id)
        return success(res, null, 'Notification marked as read')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const deleteOne = async (req, res) => {
    try {
        await notificationService.deleteOne(req.user.userId, req.params.id)
        return success(res, null, 'Notification deleted')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { getNotifications, markAllRead, removeAll, getNotificationDetail, markOneRead, deleteOne }