const transactionService = require('../services/transaction.service')
const { success, error } = require('../utils/response.util')

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
        const { walletId, month, year } = req.query
        if (!walletId || !month || !year) {
            return error(res, 'walletId, month, year are required', 400)
        }
        const result = await transactionService.getSummary(req.user.userId, walletId, month, year)
        return success(res, result, 'Summary fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const createTransaction = async (req, res) => {
    try {
        const { wallet_id, pocket_id, type, amount, note, date } = req.body
        const result = await transactionService.createTransaction(req.user.userId, {
            wallet_id, pocket_id, type, amount, note, date
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

module.exports = { getTransactions, getSummary, createTransaction, deleteTransaction }