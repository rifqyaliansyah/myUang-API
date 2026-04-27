const { Router } = require('express')
const { body } = require('express-validator')
const controller = require('../controllers/pocket.controller')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()
router.use(authenticate)

router.get('/', controller.getPockets)

router.post('/',
    [
        body('name').trim().notEmpty().withMessage('Pocket name is required'),
        body('budget_limit').isNumeric().withMessage('Budget limit must be a number'),
    ],
    validate,
    controller.createPocket
)

router.put('/:id',
    [
        body('name').trim().notEmpty().withMessage('Pocket name is required'),
        body('budget_limit').isNumeric().withMessage('Budget limit must be a number'),
    ],
    validate,
    controller.updatePocket
)

router.delete('/:id', controller.deletePocket)

module.exports = router