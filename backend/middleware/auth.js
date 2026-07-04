// ─────────────────────────────────────────────
//  middleware/auth.js
//  Runs before any protected route.
//  Reads the token from the request header,
//  checks it's valid, and attaches the user
//  info to the request so routes can use it.
// ─────────────────────────────────────────────

const jwt    = require('jsonwebtoken');
const config = require('../config');

module.exports = function requireAuth(req, res, next) {
  // Token is sent as:  Authorization: Bearer <token>
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const token = header.split(' ')[1];

  try {
    // Verify the token was signed by us and hasn't expired
    req.user = jwt.verify(token, config.jwtSecret);
    next(); // token is valid — continue to the route
  } catch {
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
};
