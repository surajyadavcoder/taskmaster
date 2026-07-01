const Task = require('../models/Task');
const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendNotification } = require('../services/notificationService');
const { generateTaskDescription } = require('../services/aiService');

async function assertTeamMembership(teamId, userId, next) {
  const team = await Team.findById(teamId);
  if (!team) {
    next(new AppError('Team not found.', 404));
    return null;
  }
  if (!team.isMember(userId)) {
    next(new AppError('You are not a member of this team.', 403));
    return null;
  }
  return team;
}

exports.createTask = catchAsync(async (req, res, next) => {
  const { title, description, dueDate, priority, team, assignedTo } = req.body;

  const teamDoc = await assertTeamMembership(team, req.user._id, next);
  if (!teamDoc) return;

  if (assignedTo && !teamDoc.isMember(assignedTo)) {
    return next(new AppError('Cannot assign task to a user outside the team.', 400));
  }

  const task = await Task.create({
    title,
    description,
    dueDate,
    priority,
    team,
    assignedTo: assignedTo || null,
    createdBy: req.user._id,
  });

  if (assignedTo && assignedTo !== req.user._id.toString()) {
    await sendNotification({
      recipient: assignedTo,
      type: 'task-assigned',
      message: `You were assigned the task "${task.title}".`,
      task: task._id,
      team: teamDoc._id,
    });
  }

  res.status(201).json({ success: true, task });
});

exports.getTasks = catchAsync(async (req, res, next) => {
  const { team, status, priority, assignedTo, search, sortBy, order, page, limit } = req.query;

  if (!team) return next(new AppError('A team query parameter is required.', 400));

  const teamDoc = await assertTeamMembership(team, req.user._id, next);
  if (!teamDoc) return;

  const filter = { team };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (search) filter.$text = { $search: search };

  const sortField = sortBy || 'createdAt';
  const sortOrder = order === 'asc' ? 1 : -1;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(parseInt(limit, 10) || 20, 100);

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email'),
    Task.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: tasks.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
    tasks,
  });
});

exports.getMyTasks = catchAsync(async (req, res) => {
  const { status } = req.query;
  const filter = { assignedTo: req.user._id };
  if (status) filter.status = status;

  const tasks = await Task.find(filter)
    .sort({ dueDate: 1 })
    .populate('team', 'name')
    .populate('createdBy', 'name email');

  res.status(200).json({ success: true, count: tasks.length, tasks });
});

exports.getTask = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId)
    .populate('assignedTo', 'name email avatar')
    .populate('createdBy', 'name email');

  if (!task) return next(new AppError('Task not found.', 404));

  const teamDoc = await assertTeamMembership(task.team, req.user._id, next);
  if (!teamDoc) return;

  res.status(200).json({ success: true, task });
});

exports.updateTask = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return next(new AppError('Task not found.', 404));

  const teamDoc = await assertTeamMembership(task.team, req.user._id, next);
  if (!teamDoc) return;

  const allowedFields = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo'];
  const previousAssignee = task.assignedTo ? task.assignedTo.toString() : null;

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      task[field] = req.body[field];
    }
  });

  if (req.body.assignedTo && !teamDoc.isMember(req.body.assignedTo)) {
    return next(new AppError('Cannot assign task to a user outside the team.', 400));
  }

  await task.save();

  const newAssignee = task.assignedTo ? task.assignedTo.toString() : null;
  if (newAssignee && newAssignee !== previousAssignee) {
    await sendNotification({
      recipient: newAssignee,
      type: 'task-assigned',
      message: `You were assigned the task "${task.title}".`,
      task: task._id,
      team: teamDoc._id,
    });
  } else if (previousAssignee) {
    await sendNotification({
      recipient: previousAssignee,
      type: 'task-updated',
      message: `The task "${task.title}" was updated.`,
      task: task._id,
      team: teamDoc._id,
    });
  }

  res.status(200).json({ success: true, task });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return next(new AppError('Task not found.', 404));

  const teamDoc = await assertTeamMembership(task.team, req.user._id, next);
  if (!teamDoc) return;

  if (task.createdBy.toString() !== req.user._id.toString() && teamDoc.getRole(req.user._id) === 'member') {
    return next(new AppError('Only the task creator or a team admin can delete this task.', 403));
  }

  await task.deleteOne();

  res.status(200).json({ success: true, message: 'Task deleted.' });
});

exports.addAttachment = catchAsync(async (req, res, next) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return next(new AppError('Task not found.', 404));

  const teamDoc = await assertTeamMembership(task.team, req.user._id, next);
  if (!teamDoc) return;

  if (!req.file) {
    return next(new AppError('No file was uploaded.', 400));
  }

  task.attachments.push({
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user._id,
  });

  await task.save();

  res.status(201).json({ success: true, task });
});

exports.generateDescription = catchAsync(async (req, res, next) => {
  const { prompt } = req.body;

  if (!prompt || !prompt.trim()) {
    return next(new AppError('A prompt is required to generate a description.', 400));
  }

  const description = await generateTaskDescription(prompt.trim());

  res.status(200).json({ success: true, description });
});
