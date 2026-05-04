const authService = require('../services/auth.service')
const { success, error } = require('../utils/response.util')

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body
        const result = await authService.register({ name, email, password })
        return success(res, result, 'Registration successful, please setup your PIN', 201)
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        const result = await authService.login({ email, password })
        return success(res, result, 'Login successful, please verify your PIN')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const setupPin = async (req, res) => {
    try {
        const { pin } = req.body
        const tokens = await authService.setupPin(req.user.userId, pin)
        return success(res, tokens, 'PIN setup successful')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const verifyPin = async (req, res) => {
    try {
        const { pin } = req.body
        const tokens = await authService.verifyPin(req.user.userId, pin)
        return success(res, tokens, 'PIN verified')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const verifyByPassword = async (req, res) => {
    try {
        const { password } = req.body
        const tokens = await authService.verifyByPassword(req.user.userId, password)
        return success(res, tokens, 'Password verified')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const setPassword = async (req, res) => {
    try {
        const { password } = req.body
        await authService.setPassword(req.user.userId, password)
        return success(res, null, 'Password set successfully')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body
        await authService.changePassword(req.user.userId, oldPassword, newPassword)
        return success(res, null, 'Password changed successfully')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const changePin = async (req, res) => {
    try {
        const { oldPin, newPin } = req.body
        await authService.changePin(req.user.userId, oldPin, newPin)
        return success(res, null, 'PIN changed successfully')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body
        const result = await authService.googleAuth(idToken)
        return success(res, result, 'Google auth successful')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body
        const tokens = await authService.refreshAccessToken(refreshToken)
        return success(res, tokens, 'Token refreshed')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body
        await authService.logout(refreshToken)
        return success(res, null, 'Logged out successfully')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

const resume = async (req, res) => {
    try {
        const { refreshToken } = req.body
        const result = await authService.resumeSession(refreshToken)
        return success(res, result, 'Session resumed')
    } catch (err) {
        return error(res, err.message, err.statusCode || 500)
    }
}

module.exports = { register, login, setupPin, verifyPin, verifyByPassword, setPassword, changePassword, changePin, googleAuth, refresh, logout, resume }