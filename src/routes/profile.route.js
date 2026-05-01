const { Router } = require('express')
const { body } = require('express-validator')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate } = require('../middlewares/auth.middleware')
const controller = require('../controllers/profile.controller')

const router = Router()

router.get('/', authenticate, controller.getProfile)

router.put('/',
    authenticate,
    controller.upload.single('avatar'),
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('quotes').optional().isString(),
    ],
    validate,
    controller.updateProfile
)

module.exports = router