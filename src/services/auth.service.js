const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { OAuth2Client } = require('google-auth-library')
const pool = require('../config/database')
const { signAccessToken, signRefreshToken, signTempToken } = require('../utils/jwt.util')
const env = require('../config/env')
const nodemailer = require('nodemailer')

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

const setPassword = async (userId, password) => {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId])
    const user = result.rows[0]

    if (!user) {
        throw { statusCode: 404, message: 'User not found' }
    }

    if (user.password) {
        throw { statusCode: 400, message: 'Password already set' }
    }

    const passwordHash = await hashValue(password)
    await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, userId]
    )
}

const verifyByPassword = async (userId, password) => {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId])
    const user = result.rows[0]

    if (!user) {
        throw { statusCode: 404, message: 'User not found' }
    }

    if (!user.password) {
        throw { statusCode: 400, message: 'This account has no password set' }
    }

    const isValid = await compareValue(password, user.password)
    if (!isValid) {
        throw { statusCode: 401, message: 'Incorrect password' }
    }

    return issueTokens(userId)
}

const changePassword = async (userId, oldPassword, newPassword) => {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId])
    const user = result.rows[0]

    if (!user) {
        throw { statusCode: 404, message: 'User not found' }
    }

    if (!user.password) {
        throw { statusCode: 400, message: 'This account uses Google login' }
    }

    const isValid = await compareValue(oldPassword, user.password)
    if (!isValid) {
        throw { statusCode: 401, message: 'Old password is incorrect' }
    }

    const passwordHash = await hashValue(newPassword)
    await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, userId]
    )
}

const changePin = async (userId, oldPin, newPin) => {
    const result = await pool.query('SELECT pin FROM users WHERE id = $1', [userId])
    const user = result.rows[0]

    if (!user) {
        throw { statusCode: 404, message: 'User not found' }
    }

    if (!user.pin) {
        throw { statusCode: 400, message: 'PIN not set' }
    }

    const isValid = await compareValue(oldPin, user.pin)
    if (!isValid) {
        throw { statusCode: 401, message: 'Old PIN is incorrect' }
    }

    const pinHash = await hashValue(newPin)
    await pool.query(
        'UPDATE users SET pin = $1, updated_at = NOW() WHERE id = $2',
        [pinHash, userId]
    )
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
        'SELECT id, name, email, is_pin_set, password FROM users WHERE google_id = $1 OR email = $2',
        [googleId, email]
    )

    let user
    let isNewUser = false

    if (result.rows.length === 0) {
        const inserted = await pool.query(
            `INSERT INTO users (name, email, google_id, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, is_pin_set, password`,
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
        hasPassword: !!user.password,
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

const getMailTransporter = () => nodemailer.createTransport({
    host: env.mailtrap.host,
    port: env.mailtrap.port,
    auth: {
        user: env.mailtrap.user,
        pass: env.mailtrap.pass,
    },
})

const forgotPassword = async (email) => {
    const result = await pool.query(
        'SELECT id, name FROM users WHERE email = $1',
        [email]
    )

    // Selalu return sukses meskipun email tidak ditemukan (security best practice)
    if (result.rows.length === 0) return

    const user = result.rows[0]

    // Generate token random
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 jam

    // Hapus token lama kalau ada, simpan yang baru
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id])
    await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
    )

    const resetLink = `${env.appUrl}/reset-password?token=${rawToken}`

    const transporter = getMailTransporter()
    await transporter.sendMail({
        from: '"MyUang" <noreply@myuang.app>',
        to: email,
        subject: 'Reset Your Password - MyUang',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Reset Your Password</h2>
                <p>Hi ${user.name},</p>
                <p>We received a request to reset your password. Click the button below to continue:</p>
                <a href="${resetLink}" style="
                    display: inline-block;
                    background: #3077E3;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    margin: 16px 0;
                ">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
        `,
    })
}

const resetPassword = async (rawToken, newPassword) => {
    const tokenHash = hashToken(rawToken)

    const result = await pool.query(
        `SELECT user_id FROM password_reset_tokens 
         WHERE token_hash = $1 AND expires_at > NOW()`,
        [tokenHash]
    )

    if (result.rows.length === 0) {
        throw { statusCode: 400, message: 'Reset link is invalid or has expired' }
    }

    const { user_id } = result.rows[0]

    const passwordHash = await hashValue(newPassword)
    await pool.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, user_id]
    )

    // Hapus token setelah dipakai
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash])

    // Logout semua sesi aktif untuk keamanan
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user_id])
}

module.exports = {
    register,
    login,
    setupPin,
    verifyPin,
    verifyByPassword,
    setPassword,
    changePassword,
    changePin,
    googleAuth,
    refreshAccessToken,
    logout,
    resumeSession,
    forgotPassword,
    resetPassword,
}