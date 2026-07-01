const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');
const taskController = require('../controllers/taskController');
const commentController = require('../controllers/commentController');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Task title is required'),
    body('team').notEmpty().withMessage('Team is required'),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('priority').optional().isIn(['low', 'medium', 'high']),
  ],
  validate,
  taskController.createTask
);

router.get('/', taskController.getTasks);
router.get('/mine', taskController.getMyTasks);

router.post(
  '/generate-description',
  [body('prompt').trim().notEmpty().withMessage('A prompt is required')],
  validate,
  taskController.generateDescription
);

router.get('/:taskId', taskController.getTask);

router.patch(
  '/:taskId',
  [
    body('status').optional().isIn(['open', 'in-progress', 'completed']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  ],
  validate,
  taskController.updateTask
);

router.delete('/:taskId', taskController.deleteTask);

router.post('/:taskId/attachments', upload.single('file'), taskController.addAttachment);

router.get('/:taskId/comments', commentController.getComments);
router.post(
  '/:taskId/comments',
  [body('text').trim().notEmpty().withMessage('Comment text cannot be empty')],
  validate,
  commentController.addComment
);

module.exports = router;
