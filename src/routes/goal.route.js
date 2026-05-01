const { Router } = require('express')
const { body } = require('express-validator')
const multer = require('multer')
const controller = require('../controllers/goal.controller')
const { validate } = require('../middlewares/validate.middleware')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()
router.use(authenticate)

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Only JPEG, PNG, and WEBP images are allowed'))
        }
        cb(null, true)
    },
})

router.get('/', controller.getGoals)

router.post('/', upload.single('image'), controller.createGoal)

router.put('/:id', upload.single('image'), controller.updateGoal)

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