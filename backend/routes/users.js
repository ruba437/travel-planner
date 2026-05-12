const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { ok, err } = require('../utils/response');

function normalizeProfilePhoto(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch (_e) {
    return null;
  }
}

function normalizeDisplayName(value) {
  const text = String(value || '').trim();
  return text;
}

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, displayname, profilephoto FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return err(res, '使用者不存在', 404);
    }

    return ok(res, rows[0]);
  } catch (e) {
    console.error('Get user profile error:', e);
    return err(res, '取得使用者資料失敗');
  }
});

// PATCH /api/users/me
router.patch('/me', authMiddleware, async (req, res) => {
  const canUpdateDisplayName = Object.prototype.hasOwnProperty.call(req.body || {}, 'displayname');
  const canUpdateProfilePhoto = Object.prototype.hasOwnProperty.call(req.body || {}, 'profilephoto');

  if (!canUpdateDisplayName && !canUpdateProfilePhoto) {
    return err(res, '可更新欄位僅支援 displayname 與 profilephoto', 400);
  }

  const values = [];
  const assignments = [];

  if (canUpdateDisplayName) {
    const displayname = normalizeDisplayName(req.body.displayname);
    if (!displayname || displayname.length > 60) {
      return err(res, 'displayname 長度需介於 1 到 60 字', 400);
    }
    values.push(displayname);
    assignments.push(`displayname = $${values.length}`);
  }

  if (canUpdateProfilePhoto) {
    const profilephoto = normalizeProfilePhoto(req.body.profilephoto);
    if (req.body.profilephoto && !profilephoto) {
      return err(res, 'profilephoto 必須是有效的 http/https URL', 400);
    }
    values.push(profilephoto);
    assignments.push(`profilephoto = $${values.length}`);
  }

  values.push(req.user.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET ${assignments.join(', ')}, updatedat = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING id, email, displayname, profilephoto`,
      values
    );

    if (rows.length === 0) {
      return err(res, '使用者不存在', 404);
    }

    return ok(res, rows[0]);
  } catch (e) {
    console.error('Update user profile error:', e);
    return err(res, '更新使用者資料失敗');
  }
});

module.exports = router;
