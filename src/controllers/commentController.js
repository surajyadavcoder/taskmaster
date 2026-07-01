const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendNotification } = require('../services/notificationService');

exports.addComment = catchAsync(async (req, res, next) => {
  const { text } = req.body;
  const task = await Task.findById(req.params.taskId);

  if (!task) return next(new AppError('Task not found.', 404));

  const team = await Team.findById(task.team);
  if (!team.isMember(req.user._id)) {
    return next(new AppError('You are not a member of this task\'s team.', 403));
  }

  const comment = await Comment.create({
    task: task._id,
    author: req.user._id,
    text,
  });

  await comment.populate('author', 'name email avatar');

  if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
    await sendNotification({
      recipient: task.assignedTo,
      type: 'comment-added',
      message: `New comment on task "${task.title}".`,
      task: task._id,
      team: team._id,
    });
  }

  res.status(201).json({ success: true, comment });
});

exports.getComments = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return next(new AppError('Task not found.', 404));

  const team = await Team.findById(task.team);
  if (!team.isMember(req.user._id)) {
    return next(new AppError('You are not a member of this task\'s team.', 403));
  }

  const comments = await Comment.find({ task: task._id })
    .sort({ createdAt: 1 })
    .populate('author', 'name email avatar');

  res.status(200).json({ success: true, count: comments.length, comments });
});

exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return next(new AppError('Comment not found.', 404));

  if (comment.author.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only delete your own comments.', 403));
  }

  await comment.deleteOne();

  res.status(200).json({ success: true, message: 'Comment deleted.' });
});
