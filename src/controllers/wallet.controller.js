const walletService = require('../services/wallet.service')
const { success, error } = require('../utils/response.util')

const getWallets = async (req, res) => {
    try {
        const result = await walletService.getWallets(req.user.userId)
        return success(res, result, 'Wallets fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const createWallet = async (req, res) => {
    try {
        const { name, balance } = req.body
        const result = await walletService.createWallet(req.user.userId, { name, balance })
        return success(res, result, 'Wallet created', 201)
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const updateWallet = async (req, res) => {
    try {
        const { name, balance } = req.body
        const result = await walletService.updateWallet(req.user.userId, req.params.id, { name, balance })
        return success(res, result, 'Wallet updated')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const deleteWallet = async (req, res) => {
    try {
        await walletService.deleteWallet(req.user.userId, req.params.id)
        return success(res, null, 'Wallet deleted')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const setActiveWallet = async (req, res) => {
    try {
        const result = await walletService.setActiveWallet(req.user.userId, req.params.id)
        return success(res, result, 'Active wallet updated')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { getWallets, createWallet, updateWallet, deleteWallet, setActiveWallet }