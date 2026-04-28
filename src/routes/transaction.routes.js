const { Router } = require('express')
const { body } = require('express-validator')
const controller = require('../controllers/transaction.controller')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()
router.use(authenticate)

router.get('/', controller.getTransactions)
router.get('/summary', controller.getSummary)

router.post('/',
    [
        body('wallet_id').notEmpty().withMessage('wallet_id is required'),
        body('type').isIn(['income', 'expense']).withMessage('type must be income or expense'),
        body('amount').isNumeric().withMessage('amount must be a number'),
    ],
    validate,
    controller.createTransaction
)

router.delete('/:id', controller.deleteTransaction)

module.exports = router