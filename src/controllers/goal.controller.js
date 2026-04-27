const goalService = require('../services/goal.service')
const { success, error } = require('../utils/response.util')

const getGoals = async (req, res) => {
    try {
        const result = await goalService.getGoals(req.user.userId)
        return success(res, result, 'Goals fetched')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const createGoal = async (req, res) => {
    try {
        const { name, target_amount, description } = req.body
        const result = await goalService.createGoal(req.user.userId, { name, target_amount, description })
        return success(res, result, 'Goal created', 201)
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const updateGoal = async (req, res) => {
    try {
        const { name, target_amount, description } = req.body
        const result = await goalService.updateGoal(req.user.userId, req.params.id, { name, target_amount, description })
        return success(res, result, 'Goal updated')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const deleteGoal = async (req, res) => {
    try {
        await goalService.deleteGoal(req.user.userId, req.params.id)
        return success(res, null, 'Goal deleted')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { getGoals, createGoal, updateGoal, deleteGoal }