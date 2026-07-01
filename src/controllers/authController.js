const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { signToken } = require('../utils/jwt');

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('An account with this email already exists.', 409));
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: user.toSafeObject(),
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    token,
    user: user.toSafeObject(),
  });
});

exports.getProfile = catchAsync(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, bio, avatar } = req.body;

  if (name !== undefined) req.user.name = name;
  if (bio !== undefined) req.user.bio = bio;
  if (avatar !== undefined) req.user.avatar = avatar;

  await req.user.save();

  res.status(200).json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

exports.logout = catchAsync(async (req, res) => {
  // JWTs are stateless, so logout is handled client-side by discarding the token.
  // This endpoint exists for API completeness and to give the frontend a clean call to make.
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});
