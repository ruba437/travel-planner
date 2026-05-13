const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { ok, err } = require('../utils/response');

function normalizeDisplayName(value) {
  const text = String(value || '').trim();
  return text;
}

function normalizeGender(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().toLowerCase();
  return ['male', 'female', 'other', 'secret'].includes(text) ? text : null;
}

function normalizeLocation(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeBirthday(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === text ? text : null;
}

// GET /api/users/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, displayname, gender, location, birthday FROM users WHERE id = $1',
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
  const canUpdateGender = Object.prototype.hasOwnProperty.call(req.body || {}, 'gender');
  const canUpdateLocation = Object.prototype.hasOwnProperty.call(req.body || {}, 'location');
  const canUpdateBirthday = Object.prototype.hasOwnProperty.call(req.body || {}, 'birthday');

  if (!canUpdateDisplayName && !canUpdateGender && !canUpdateLocation && !canUpdateBirthday) {
    return err(res, '可更新欄位僅支援 displayname、gender、location 與 birthday', 400);
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

  if (canUpdateGender) {
    const gender = normalizeGender(req.body.gender);
    if (req.body.gender !== null && req.body.gender !== undefined && req.body.gender !== '' && !gender) {
      return err(res, 'gender 僅支援 male、female、other、secret', 400);
    }
    values.push(gender);
    assignments.push(`gender = $${values.length}`);
  }

  if (canUpdateLocation) {
    const location = normalizeLocation(req.body.location);
    if (location && location.length > 120) {
      return err(res, 'location 最多 120 字', 400);
    }
    values.push(location);
    assignments.push(`location = $${values.length}`);
  }

  if (canUpdateBirthday) {
    const birthday = normalizeBirthday(req.body.birthday);
    if (req.body.birthday !== null && req.body.birthday !== undefined && req.body.birthday !== '' && !birthday) {
      return err(res, 'birthday 必須是有效日期，格式為 YYYY-MM-DD', 400);
    }
    values.push(birthday);
    assignments.push(`birthday = $${values.length}`);
  }

  values.push(req.user.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET ${assignments.join(', ')}, updatedat = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING id, email, displayname, gender, location, birthday`,
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
