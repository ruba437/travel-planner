// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'dev-secret';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, displayName: user.displayName },
    SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '請提供 email 和密碼' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email 已被註冊' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (email, displayName, passwordHash) VALUES (?, ?, ?)',
      [email, displayName || email.split('@')[0], passwordHash]
    );

    const token = generateToken({ id: result.id, email, displayName: displayName || email.split('@')[0] });
    res.status(201).json({
      token,
      user: { id: result.insertId, email, displayName: displayName || email.split('@')[0] },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '註冊失敗' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '請提供 email 和密碼' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '沒有這個帳號' });
    }

    // edit 
    const user = rows[0];
    if (!user.passwordHash) {
      return res.status(401).json({ error: '此帳號未設定密碼，請使用其他登入方式' });
    }
    //

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: '密碼錯誤' });
    }

    const token = generateToken({ id: user.id, email: user.email, displayName: user.displayName || user.email.split('@')[0] });
    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName || user.email.split('@')[0] },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登入失敗' });
  }
});

// GET /auth/me
// router.get('/me', authMiddleware, async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       'SELECT id, email, displayName, profilePhoto FROM users WHERE id = ?',
//       [req.user.id]
//     );
//     if (rows.length === 0) return res.status(404).json({ error: '使用者不存在' });
//     res.json({ user: rows[0] });
//   } catch (err) {
//     console.error('Get me error:', err);
//     res.status(500).json({ error: '取得使用者資料失敗' });
//   }
// });

module.exports = router;
