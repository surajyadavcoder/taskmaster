const crypto = require('crypto');
const Team = require('../models/Team');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendNotification } = require('../services/notificationService');

exports.createTeam = catchAsync(async (req, res) => {
  const { name, description } = req.body;

  const team = await Team.create({
    name,
    description,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }],
    inviteCode: crypto.randomBytes(5).toString('hex'),
  });

  res.status(201).json({ success: true, team });
});

exports.getMyTeams = catchAsync(async (req, res) => {
  const teams = await Team.find({ 'members.user': req.user._id })
    .populate('owner', 'name email')
    .populate('members.user', 'name email avatar');

  res.status(200).json({ success: true, count: teams.length, teams });
});

exports.getTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.teamId)
    .populate('owner', 'name email')
    .populate('members.user', 'name email avatar');

  if (!team) return next(new AppError('Team not found.', 404));
  if (!team.isMember(req.user._id)) {
    return next(new AppError('You are not a member of this team.', 403));
  }

  res.status(200).json({ success: true, team });
});

exports.inviteMember = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const team = await Team.findById(req.params.teamId);

  if (!team) return next(new AppError('Team not found.', 404));

  const role = team.getRole(req.user._id);
  if (role !== 'owner' && role !== 'admin') {
    return next(new AppError('Only team owners or admins can invite members.', 403));
  }

  const userToInvite = await User.findOne({ email });
  if (!userToInvite) {
    return next(new AppError('No user found with that email.', 404));
  }

  if (team.isMember(userToInvite._id)) {
    return next(new AppError('This user is already a member of the team.', 409));
  }

  team.members.push({ user: userToInvite._id, role: 'member' });
  await team.save();

  await sendNotification({
    recipient: userToInvite._id,
    type: 'team-invite',
    message: `You were added to the team "${team.name}".`,
    team: team._id,
  });

  res.status(200).json({ success: true, team });
});

exports.joinByInviteCode = catchAsync(async (req, res, next) => {
  const { inviteCode } = req.body;
  const team = await Team.findOne({ inviteCode });

  if (!team) return next(new AppError('Invalid invite code.', 404));
  if (team.isMember(req.user._id)) {
    return next(new AppError('You are already a member of this team.', 409));
  }

  team.members.push({ user: req.user._id, role: 'member' });
  await team.save();

  res.status(200).json({ success: true, team });
});

exports.removeMember = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.teamId);
  if (!team) return next(new AppError('Team not found.', 404));

  const role = team.getRole(req.user._id);
  if (role !== 'owner' && role !== 'admin') {
    return next(new AppError('Only team owners or admins can remove members.', 403));
  }

  if (team.owner.toString() === req.params.userId) {
    return next(new AppError('The team owner cannot be removed.', 400));
  }

  team.members = team.members.filter((m) => m.user.toString() !== req.params.userId);
  await team.save();

  res.status(200).json({ success: true, team });
});
