const multer = require('multer')
const transactionService = require('../services/transaction.service')
const { success, error } = require('../utils/response.util')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Only JPEG, PNG, and WEBP images are allowed'))
        }
        cb(null, true)
    },
})

const getTransactions = async (req, res) => {
    try {
        const { walletId, pocketId, goalId, month, year, startDate, endDate, limit = 10, offset = 0 } = req.query
        const type = req.query.type
            ? Array.isArray(req.query.type)
                ? req.query.type
                : String(req.query.type).split(',').map(t => t.trim())
            : undefined
        const result = await transactionService.getTransactions(req.user.userId, {
            walletId, pocketId, goalId, month, year, type, startDate, endDate,
            limit: Number(limit),
            offset: Number(offset),
        })
        return success(res, result, 'Transactions fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const getSummary = async (req, res) => {
    try {
        const { walletId, month, year, startDate, endDate } = req.query
        if (!walletId) return error(res, 'walletId is required', 400)

        const result = await transactionService.getSummary(
            req.user.userId,
            walletId,
            { month, year, startDate, endDate }
        )
        return success(res, result, 'Summary fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const createTransaction = async (req, res) => {
    console.log('content-type:', req.headers['content-type'])
    console.log('req.file:', req.file)
    console.log('req.body:', req.body)
    try {
        const { wallet_id, pocket_id, type, amount, note, date } = req.body
        const result = await transactionService.createTransaction(req.user.userId, {
            wallet_id, pocket_id, type, amount, note, date,
            file: req.file || null,
        })
        return success(res, result, 'Transaction created', 201)
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const deleteTransaction = async (req, res) => {
    try {
        await transactionService.deleteTransaction(req.user.userId, req.params.id)
        return success(res, null, 'Transaction deleted')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { getTransactions, getSummary, createTransaction, deleteTransaction, upload }