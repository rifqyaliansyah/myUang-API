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

module.exports = router