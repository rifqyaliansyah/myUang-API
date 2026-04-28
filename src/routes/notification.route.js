const { Router } = require('express')
const controller = require('../controllers/notification.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = Router()
router.use(authenticate)

router.get('/', controller.getNotifications)
router.patch('/mark-all-read', controller.markAllRead)
router.delete('/remove-all', controller.removeAll)
router.get('/:id', controller.getNotificationDetail)
router.patch('/:id/read', controller.markOneRead)
router.delete('/:id', controller.deleteOne)

module.exports = router