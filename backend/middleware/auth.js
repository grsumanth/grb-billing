const jwt = require('jsonwebtoken');

// Failed attempt tracker (in-memory)
const failedAttempts = {};

module.exports = function auth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  const ip     = req.ip || req.connection.remoteAddress;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please login.' });
  }

  // Check if JWT_SECRET is set
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set!');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check token has required fields
    if (!decoded.id || !decoded.email) {
      return res.status(401).json({ error: 'Invalid token format. Please login again.' });
    }

    // Clear failed attempts on success
    delete failedAttempts[ip];

    req.user = decoded;
    next();
  } catch (err) {
    // Track failed attempts
    if (!failedAttempts[ip]) failedAttempts[ip] = { count: 0, firstAttempt: Date.now() };
    failedAttempts[ip].count++;

    // Reset after 15 minutes
    if (Date.now() - failedAttempts[ip].firstAttempt > 15 * 60 * 1000) {
      failedAttempts[ip] = { count: 1, firstAttempt: Date.now() };
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token. Please login again.' });
    }
    return res.status(401).json({ error: 'Authentication failed. Please login again.' });
  }
};