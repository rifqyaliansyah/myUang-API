const { Router } = require('express')
const { body } = require('express-validator')
const controller = require('../controllers/wallet.controller')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()

router.use(authenticate)

router.get('/', controller.getWallets)

router.post('/',
    [
        body('name').trim().notEmpty().withMessage('Wallet name is required'),
        body('balance').isNumeric().withMessage('Balance must be a number'),
    ],
    validate,
    controller.createWallet
)

router.put('/:id',
    [
        body('name').trim().notEmpty().withMessage('Wallet name is required'),
        body('balance').isNumeric().withMessage('Balance must be a number'),
    ],
    validate,
    controller.updateWallet
)

router.delete('/:id', controller.deleteWallet)

router.patch('/:id/active', controller.setActiveWallet)

module.exports = router