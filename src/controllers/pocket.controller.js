const pocketService = require('../services/pocket.service')
const { success, error } = require('../utils/response.util')

const getPockets = async (req, res) => {
    try {
        const result = await pocketService.getPockets(req.user.userId)
        return success(res, result, 'Pockets fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const createPocket = async (req, res) => {
    try {
        const { emoji, name, budget_limit, description } = req.body
        const result = await pocketService.createPocket(req.user.userId, { emoji, name, budget_limit, description })
        return success(res, result, 'Pocket created', 201)
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const updatePocket = async (req, res) => {
    try {
        const { emoji, name, budget_limit, description } = req.body
        const result = await pocketService.updatePocket(req.user.userId, req.params.id, { emoji, name, budget_limit, description })
        return success(res, result, 'Pocket updated')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const deletePocket = async (req, res) => {
    try {
        await pocketService.deletePocket(req.user.userId, req.params.id)
        return success(res, null, 'Pocket deleted')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { getPockets, createPocket, updatePocket, deletePocket }