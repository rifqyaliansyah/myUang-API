const { Router } = require('express')
const { body } = require('express-validator')
const controller = require('../controllers/goal.controller')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()
router.use(authenticate)

router.get('/', controller.getGoals)

router.post('/',
    [
        body('name').trim().notEmpty().withMessage('Goal name is required'),
        body('target_amount').isNumeric().withMessage('Target amount must be a number'),
    ],
    validate,
    controller.createGoal
)

router.put('/:id',
    [
        body('name').trim().notEmpty().withMessage('Goal name is required'),
        body('target_amount').isNumeric().withMessage('Target amount must be a number'),
    ],
    validate,
    controller.updateGoal
)

router.delete('/:id', controller.deleteGoal)

router.post('/:id/topup',
    [
        body('wallet_id').optional({ nullable: true }).custom((val) => {
            if (val === null || val === undefined) return true
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
                throw new Error('wallet_id must be a valid UUID')
            }
            return true
        }),
        body('amount').isNumeric().withMessage('amount must be a number'),
    ],
    validate,
    controller.topUpGoal
)

module.exports = router