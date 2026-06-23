const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    res.status(400);
    throw new Error('All fields are required.');
  }

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error('Passwords do not match.');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400);
    throw new Error('An account with this email already exists.');
  }

  const user = await User.create({ name, email, password });
  res.status(201).json({
    user,
    token: generateToken(user._id),
  });
});

// POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password.');
  }

  res.json({
    user,
    token: generateToken(user._id),
  });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User does not exist.');
  }

  user.name = req.body.name ?? user.name;
  user.email = req.body.email ?? user.email;
  if (req.body.preferences) {
    user.preferences = { ...user.preferences?.toObject?.(), ...req.body.preferences };
  }
  if (req.body.password) user.password = req.body.password;

  const updated = await user.save();
  res.json(updated);
});

module.exports = { registerUser, loginUser, getMe, updateMe };
