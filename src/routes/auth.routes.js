const { Router } = require('express')
const { body } = require('express-validator')
const controller = require('../controllers/auth.controller')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate, authenticateTemp } = require('../middlewares/auth.middleware')

const router = Router()

router.post('/register',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
    ],
    validate,
    controller.register
)

router.post('/login',
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    validate,
    controller.login
)

router.post('/setup-pin',
    authenticateTemp,
    [body('pin').isLength({ min: 4, max: 4 }).isNumeric().withMessage('PIN must be 4 digits')],
    validate,
    controller.setupPin
)

router.post('/verify-pin',
    authenticateTemp,
    [body('pin').isLength({ min: 4, max: 4 }).isNumeric().withMessage('PIN must be 4 digits')],
    validate,
    controller.verifyPin
)

router.post('/set-password',
    authenticateTemp,
    [body('password').isLength({ min: 8 }).withMessage('Password min 8 characters')],
    validate,
    controller.setPassword
)

router.post('/google',
    [body('idToken').notEmpty().withMessage('idToken required')],
    validate,
    controller.googleAuth
)

router.post('/refresh',
    [body('refreshToken').notEmpty()],
    validate,
    controller.refresh
)

router.post('/resume',
    [body('refreshToken').notEmpty()],
    validate,
    controller.resume
)

router.post('/logout', authenticate, controller.logout)

module.exports = router