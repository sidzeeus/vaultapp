// ─────────────────────────────────────────────
//  routes/auth.js
//  POST /api/auth/register  — create an account
//  POST /api/auth/login     — sign in
// ─────────────────────────────────────────────

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db      = require('../db/dynamo');
const config  = require('../config');

const router = express.Router();

// ── Register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });

    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Make sure no one else has this email
    const existing = await db.getUserByEmail(email.toLowerCase());
    if (existing)
      return res.status(409).json({ error: 'An account with this email already exists' });

    // Hash the password before saving — never store plain text passwords
    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      userId:       uuid(),
      email:        email.toLowerCase(),
      name:         name.trim(),
      passwordHash,
      createdAt:    new Date().toISOString(),
    };

    await db.createUser(user);

    // Create a token so they're logged in immediately after registering
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });

  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── Login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await db.getUserByEmail(email.toLowerCase());

    // Use the same error message whether email or password is wrong
    // (telling attackers which one is wrong is a security issue)
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });

  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Helpers ───────────────────────────────────

/** Create a JWT that expires in 7 days */
function signToken(user) {
  return jwt.sign(
    { userId: user.userId, email: user.email, name: user.name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

/** Strip the password hash before sending user data to the browser */
function publicUser(user) {
  return { userId: user.userId, email: user.email, name: user.name };
}

module.exports = router;
