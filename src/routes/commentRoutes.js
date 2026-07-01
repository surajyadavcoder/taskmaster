const express = require('express');
const { protect } = require('../middleware/auth');
const commentController = require('../controllers/commentController');

const router = express.Router();

router.use(protect);

router.delete('/:commentId', commentController.deleteComment);

module.exports = router;
