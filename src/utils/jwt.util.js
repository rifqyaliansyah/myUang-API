const jwt = require('jsonwebtoken')
const env = require('../config/env')

const signAccessToken = (payload) => {
    return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires })
}

const signRefreshToken = (payload) => {
    return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires })
}

const signTempToken = (payload) => {
    return jwt.sign(
        { ...payload, purpose: 'pin_verification' },
        env.jwt.accessSecret,
        { expiresIn: env.jwt.tempExpires }
    )
}

const verifyAccessToken = (token) => {
    return jwt.verify(token, env.jwt.accessSecret)
}

const verifyRefreshToken = (token) => {
    return jwt.verify(token, env.jwt.refreshSecret)
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    signTempToken,
    verifyAccessToken,
    verifyRefreshToken,
}