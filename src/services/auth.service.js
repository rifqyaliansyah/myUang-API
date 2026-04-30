const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')
const pool = require('../config/database')
const { signAccessToken, signRefreshToken, signTempToken } = require('../utils/jwt.util')
const env = require('../config/env')

const googleClient = new OAuth2Client(env.google.clientId)

const SALT_ROUNDS = 12

const hashValue = (value) => bcrypt.hash(value, SALT_ROUNDS)
const compareValue = (value, hash) => bcrypt.compare(value, hash)

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex')

const issueTokens = async (userId) => {
    const accessToken = signAccessToken({ userId })
    const refreshToken = signRefreshToken({ userId })

    const tokenHash = hashToken(refreshToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 hari

    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt]
    )

    return { accessToken, refreshToken }
}

const register = async ({ name, email, password }) => {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
        throw { statusCode: 409, message: 'Email already registered' }
    }

    const passwordHash = await hashValue(password)

    const result = await pool.query(
        `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email`,
        [name, email, passwordHash]
    )

    const user = result.rows[0]

    await pool.query(
        `INSERT INTO wallets (user_id, name, balance, is_active) VALUES ($1, $2, $3, $4)`,
        [user.id, 'Main Wallet', 0, true]
    )

    const tempToken = signTempToken({ userId: user.id, purpose: 'pin_verification' })

    return { user, tempToken }
}

const login = async ({ email, password }) => {
    const result = await pool.query(
        'SELECT id, name, email, password, pin, is_pin_set FROM users WHERE email = $1',
        [email]
    )

    if (result.rows.length === 0) {
        throw { statusCode: 401, message: 'Invalid email or password' }
    }

    const user = result.rows[0]

    if (!user.password) {
        throw { statusCode: 400, message: 'This account uses Google login' }
    }

    const isValid = await compareValue(password, user.password)
    if (!isValid) {
        throw { statusCode: 401, message: 'Invalid email or password' }
    }

    const tempToken = signTempToken({ userId: user.id })

    return {
        user: { id: user.id, name: user.name, email: user.email },
        tempToken,
        isPinSet: user.is_pin_set,
    }
}

const setupPin = async (userId, pin) => {
    const result = await pool.query('SELECT is_pin_set FROM users WHERE id = $1', [userId])
    if (result.rows[0]?.is_pin_set) {
        throw { statusCode: 400, message: 'PIN already set' }
    }

    const pinHash = await hashValue(pin)
    await pool.query(
        'UPDATE users SET pin = $1, is_pin_set = TRUE, updated_at = NOW() WHERE id = $2',
        [pinHash, userId]
    )

    return issueTokens(userId)
}

const verifyPin = async (userId, pin) => {
    const result = await pool.query('SELECT pin FROM users WHERE id = $1', [userId])
    const user = result.rows[0]

    if (!user?.pin) {
        throw { statusCode: 400, message: 'PIN not set' }
    }

    const isValid = await compareValue(pin, user.pin)
    if (!isValid) {
        throw { statusCode: 401, message: 'Invalid PIN' }
    }

    return issueTokens(userId)
}

const googleAuth = async (idToken) => {
    let payload
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: env.google.clientId,
        })
        payload = ticket.getPayload()
    } catch {
        throw { statusCode: 401, message: 'Invalid Google token' }
    }

    const { sub: googleId, email, name, picture } = payload

    let result = await pool.query(
        'SELECT id, name, email, is_pin_set FROM users WHERE google_id = $1 OR email = $2',
        [googleId, email]
    )

    let user
    let isNewUser = false

    if (result.rows.length === 0) {
        const inserted = await pool.query(
            `INSERT INTO users (name, email, google_id, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, is_pin_set`,
            [name, email, googleId, picture]
        )
        user = inserted.rows[0]
        isNewUser = true

        await pool.query(
            `INSERT INTO wallets (user_id, name, balance, is_active) VALUES ($1, $2, $3, $4)`,
            [user.id, 'Main Wallet', 0, true]
        )
    } else {
        user = result.rows[0]
        if (!user.google_id) {
            await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id])
        }
    }

    const tempToken = signTempToken({ userId: user.id })

    return {
        user: { id: user.id, name: user.name, email: user.email },
        tempToken,
        isNewUser,
        isPinSet: user.is_pin_set,
    }
}

const refreshAccessToken = async (refreshToken) => {
    const { verifyRefreshToken } = require('../utils/jwt.util')

    let decoded
    try {
        decoded = verifyRefreshToken(refreshToken)
    } catch {
        throw { statusCode: 401, message: 'Invalid or expired refresh token' }
    }

    const tokenHash = hashToken(refreshToken)
    const result = await pool.query(
        'SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
        [decoded.userId, tokenHash]
    )

    if (result.rows.length === 0) {
        throw { statusCode: 401, message: 'Refresh token not found or expired' }
    }

    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])

    return issueTokens(decoded.userId)
}

const logout = async (refreshToken) => {
    const tokenHash = hashToken(refreshToken)
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
}

const resumeSession = async (refreshToken) => {
    const { verifyRefreshToken } = require('../utils/jwt.util')

    let decoded
    try {
        decoded = verifyRefreshToken(refreshToken)
    } catch {
        throw { statusCode: 401, message: 'Session expired, please login again' }
    }

    const tokenHash = hashToken(refreshToken)
    const result = await pool.query(
        'SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
        [decoded.userId, tokenHash]
    )

    if (result.rows.length === 0) {
        throw { statusCode: 401, message: 'Session expired, please login again' }
    }

    const tempToken = signTempToken({ userId: decoded.userId })
    return { tempToken }
}

module.exports = {
    register,
    login,
    setupPin,
    verifyPin,
    googleAuth,
    refreshAccessToken,
    logout,
    resumeSession,
}