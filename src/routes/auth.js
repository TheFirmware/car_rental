const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

router.post('/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password.trim()) {
      return res.status(400).json({ success: false, error: 'invalid inputs' });
    }

    const trimmedUser = username.trim();

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [trimmedUser]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [trimmedUser, hashedPassword]
    );

    res.status(201).json({
      success: true,
      data: {
        message: 'User created successfully',
        userId: result.rows[0].id,
      },
    });
  } catch {
    res.status(400).json({ success: false, error: 'invalid inputs' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password.trim()) {
      return res.status(400).json({ success: false, error: 'invalid inputs' });
    }

    const trimmedUser = username.trim();

    const result = await pool.query('SELECT id, username, password FROM users WHERE username = $1', [trimmedUser]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'user does not exist' });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'incorrect password' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      data: {
        message: 'Login successful',
        token,
      },
    });
  } catch {
    res.status(400).json({ success: false, error: 'invalid inputs' });
  }
});

module.exports = router;
