const { verifyAccessToken } = require('../utils/jwt.util')
const { error } = require('../utils/response.util')

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader?.startsWith('Bearer ')) {
            return error(res, 'Unauthorized', 401)
        }

        const token = authHeader.split(' ')[1]
        const decoded = verifyAccessToken(token)

        if (decoded.purpose === 'pin_verification') {
            return error(res, 'PIN verification required', 403)
        }

        req.user = decoded
        next()
    } catch {
        return error(res, 'Unauthorized', 401)
    }
}

const authenticateTemp = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader?.startsWith('Bearer ')) {
            return error(res, 'Unauthorized', 401)
        }

        const token = authHeader.split(' ')[1]
        const decoded = verifyAccessToken(token)

        if (decoded.purpose !== 'pin_verification') {
            return error(res, 'Invalid token type', 403)
        }

        req.user = decoded
        next()
    } catch {
        return error(res, 'Unauthorized', 401)
    }
}

module.exports = { authenticate, authenticateTemp }