// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 30;
const FORGOT_PASSWORD_RESPONSE = '如果帳號存在，我們已寄出密碼重設信。';

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
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email 已被註冊' });
    }

    const passwordhash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      'INSERT INTO users (email, displayname, passwordhash) VALUES ($1, $2, $3) RETURNING id',
      [email, displayName || email.split('@')[0], passwordhash]
    );

    const newId = rows[0].id;
    const token = generateToken({ id: newId, email, displayName: displayName || email.split('@')[0] });
    res.status(201).json({
      token,
      user: {
        id: newId,
        email,
        displayName: displayName || email.split('@')[0],
        gender: null,
        location: null,
        birthday: null,
      },
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
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '沒有這個帳號' });
    }

    // edit 
    const user = rows[0];
    if (!user.passwordhash) {
      return res.status(401).json({ error: '此帳號未設定密碼，請使用其他登入方式' });
    }
    //

    const match = await bcrypt.compare(password, user.passwordhash);
    if (!match) {
      return res.status(401).json({ error: '密碼錯誤' });
    }

    const token = generateToken({ id: user.id, email: user.email, displayName: user.displayname || user.email.split('@')[0] });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayname || user.email.split('@')[0],
        gender: user.gender || null,
        location: user.location || null,
        birthday: user.birthday || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登入失敗' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, displayname, gender, location, birthday FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '使用者不存在' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: '取得使用者資料失敗' });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: '請提供 email' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, displayname FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.json({ message: FORGOT_PASSWORD_RESPONSE });
    }

    const user = rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await pool.query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 || ' minutes')::interval)`,
      [user.id, tokenHash, String(RESET_TOKEN_TTL_MINUTES)]
    );

    try {
      await sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayname,
        rawToken,
      });
    } catch (mailErr) {
      console.error('Forgot password email error:', mailErr);
    }

    return res.json({ message: FORGOT_PASSWORD_RESPONSE });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: '忘記密碼流程失敗' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!token || !newPassword) {
    return res.status(400).json({ error: '請提供 token 和新密碼' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: '新密碼至少 8 碼' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '重設連結無效或已過期' });
    }

    const resetToken = rows[0];

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await client.query(
      `UPDATE users
       SET passwordhash = $1, updatedat = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, resetToken.user_id]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND used_at IS NULL`,
      [resetToken.user_id]
    );

    await client.query('COMMIT');
    return res.json({ message: '密碼已重設成功，請重新登入' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset password error:', err);
    return res.status(500).json({ error: '重設密碼失敗' });
  } finally {
    client.release();
  }
});

module.exports = router;
