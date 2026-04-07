const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { ok, err } = require('../utils/response');
const { toHHmm } = require('../utils/formatters');
const crypto = require('crypto');

router.use(authMiddleware);

const CHECKLIST_LIMIT = 10;
const CHECKLIST_TEXT_MAX_LENGTH = 240;

function normalizeChecklistItem(rawItem, fallbackSortOrder = 0) {
  const text = String(rawItem?.text || '').trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
  if (!text) return null;

  const sortOrderValue = Number(rawItem?.sortOrder);
  const sortOrder = Number.isFinite(sortOrderValue) ? Math.max(0, sortOrderValue) : fallbackSortOrder;

  return {
    id: Number.isFinite(Number(rawItem?.id)) ? Number(rawItem.id) : null,
    text,
    checked: Boolean(rawItem?.checked),
    reminder: Boolean(rawItem?.reminder),
    sortOrder,
  };
}

function normalizeChecklistItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item, idx) => normalizeChecklistItem(item, idx))
    .filter(Boolean)
    .slice(0, CHECKLIST_LIMIT);
}

async function readChecklistItemsByUuid(clientOrPool, uuid) {
  try {
    const { rows } = await clientOrPool.query(
      `SELECT id, item_text, is_checked, is_reminder, sort_order
       FROM itinerary_checklist_items
       WHERE itinerary_uuid = $1
       ORDER BY sort_order ASC, id ASC`,
      [uuid]
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.item_text,
      checked: Boolean(row.is_checked),
      reminder: Boolean(row.is_reminder),
      sortOrder: Number(row.sort_order) || 0,
    }));
  } catch (e) {
    if (e.code === '42703') {
      const { rows } = await clientOrPool.query(
        `SELECT id, item_text, is_checked, sort_order
         FROM itinerary_checklist_items
         WHERE itinerary_uuid = $1
         ORDER BY sort_order ASC, id ASC`,
        [uuid]
      );
      return rows.map((row) => ({
        id: row.id,
        text: row.item_text,
        checked: Boolean(row.is_checked),
        reminder: false,
        sortOrder: Number(row.sort_order) || 0,
      }));
    }
    if (e.code === '42P01') return null;
    throw e;
  }
}

async function replaceChecklistItems(client, uuid, rawItems) {
  const items = normalizeChecklistItems(rawItems);
  try {
    await client.query('DELETE FROM itinerary_checklist_items WHERE itinerary_uuid = $1', [uuid]);
    if (!items.length) return;

    const values = [];
    const placeholders = items.map((item, idx) => {
      const base = idx * 5;
      values.push(uuid, item.text, item.checked, item.reminder, item.sortOrder);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await client.query(
      `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, is_reminder, sort_order)
       VALUES ${placeholders.join(', ')}`,
      values
    );
  } catch (e) {
    if (e.code === '42703') {
      await client.query('DELETE FROM itinerary_checklist_items WHERE itinerary_uuid = $1', [uuid]);
      if (!items.length) return;

      const values = [];
      const placeholders = items.map((item, idx) => {
        const base = idx * 4;
        values.push(uuid, item.text, item.checked, item.sortOrder);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });
      await client.query(
        `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, sort_order)
         VALUES ${placeholders.join(', ')}`,
        values
      );
      return;
    }
    if (e.code === '42P01') return;
    throw e;
  }
}

async function itineraryBelongsToUser(clientOrPool, uuid, userId) {
  const { rows } = await clientOrPool.query(
    'SELECT 1 FROM itineraries WHERE uuid = $1 AND userid = $2 LIMIT 1',
    [uuid, userId]
  );
  return rows.length > 0;
}

// ------------------ 行前清單 CRUD ------------------
// GET /api/itineraries/:uuid/checklist
router.get('/:uuid/checklist', async (req, res) => {
  const { uuid } = req.params;
  try {
    const allowed = await itineraryBelongsToUser(pool, uuid, req.user.id);
    if (!allowed) return res.status(404).json({ error: '行程不存在或無權限' });

    const checklistItems = await readChecklistItemsByUuid(pool, uuid);
    res.json({ checklistItems: checklistItems || [] });
  } catch (err) {
    console.error('Get checklist error:', err);
    res.status(500).json({ error: '取得行前清單失敗' });
  }
});

// POST /api/itineraries/:uuid/checklist
router.post('/:uuid/checklist', async (req, res) => {
  const { uuid } = req.params;
  const normalizedItem = normalizeChecklistItem(req.body, 0);
  if (!normalizedItem) return res.status(400).json({ error: '清單項目內容不可為空' });

  try {
    const allowed = await itineraryBelongsToUser(pool, uuid, req.user.id);
    if (!allowed) return res.status(404).json({ error: '行程不存在或無權限' });

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM itinerary_checklist_items WHERE itinerary_uuid = $1',
      [uuid]
    );
    const count = Number(countResult.rows[0]?.count) || 0;
    if (count >= CHECKLIST_LIMIT) {
      return res.status(400).json({ error: `行前清單最多 ${CHECKLIST_LIMIT} 項` });
    }

    const sortOrder = Number.isFinite(Number(req.body?.sortOrder))
      ? Math.max(0, Number(req.body.sortOrder))
      : count;

    try {
      const { rows } = await pool.query(
        `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, is_reminder, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, item_text, is_checked, is_reminder, sort_order`,
        [uuid, normalizedItem.text, normalizedItem.checked, normalizedItem.reminder, sortOrder]
      );

      const row = rows[0];
      return res.status(201).json({
        item: {
          id: row.id,
          text: row.item_text,
          checked: Boolean(row.is_checked),
          reminder: Boolean(row.is_reminder),
          sortOrder: Number(row.sort_order) || 0,
        },
      });
    } catch (e) {
      // 處理舊版資料表 (沒有 is_reminder 欄位) 的情況
      if (e.code !== '42703') throw e;

      const { rows } = await pool.query(
        `INSERT INTO itinerary_checklist_items (itinerary_uuid, item_text, is_checked, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, item_text, is_checked, sort_order`,
        [uuid, normalizedItem.text, normalizedItem.checked, sortOrder]
      );

      const row = rows[0];
      return res.status(201).json({
        item: {
          id: row.id,
          text: row.item_text,
          checked: Boolean(row.is_checked),
          reminder: false,
          sortOrder: Number(row.sort_order) || 0,
        },
      });
    }
  } catch (err) {
    console.error('Create checklist item error:', err);
    res.status(500).json({ error: '新增行前清單項目失敗' });
  }
});

// PATCH /api/itineraries/:uuid/checklist/:itemId
router.patch('/:uuid/checklist/:itemId', async (req, res) => {
  const { uuid, itemId } = req.params;
  const itemIdNum = Number(itemId);
  if (!Number.isFinite(itemIdNum) || itemIdNum <= 0) {
    return res.status(400).json({ error: '項目識別碼格式錯誤' });
  }

  const hasText = Object.prototype.hasOwnProperty.call(req.body || {}, 'text');
  const hasChecked = Object.prototype.hasOwnProperty.call(req.body || {}, 'checked');
  const hasReminder = Object.prototype.hasOwnProperty.call(req.body || {}, 'reminder');
  const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body || {}, 'sortOrder');

  if (!hasText && !hasChecked && !hasReminder && !hasSortOrder) {
    return res.status(400).json({ error: '沒有可更新的欄位' });
  }

  const setClauses = [];
  const values = [];

  if (hasText) {
    // ⚠️ 這裡的 CHECKLIST_TEXT_MAX_LENGTH 我們稍早已經放在這個檔案底部了，所以可以直接用
    const text = String(req.body.text || '').trim().slice(0, CHECKLIST_TEXT_MAX_LENGTH);
    if (!text) return res.status(400).json({ error: '清單項目內容不可為空' });
    values.push(text);
    setClauses.push(`item_text = $${values.length}`);
  }

  if (hasChecked) {
    values.push(Boolean(req.body.checked));
    setClauses.push(`is_checked = $${values.length}`);
  }

  if (hasReminder) {
    values.push(Boolean(req.body.reminder));
    setClauses.push(`is_reminder = $${values.length}`);
  }

  if (hasSortOrder) {
    const sortOrder = Number(req.body.sortOrder);
    if (!Number.isFinite(sortOrder)) return res.status(400).json({ error: '排序值格式錯誤' });
    values.push(Math.max(0, sortOrder));
    setClauses.push(`sort_order = $${values.length}`);
  }

  values.push(uuid, req.user.id, itemIdNum);
  const itineraryUuidIndex = values.length - 2;
  const userIdIndex = values.length - 1;
  const itemIdIndex = values.length;

  const buildUpdateSql = (clauses, includeReminderColumn = true) => {
    const safeClauses = includeReminderColumn
      ? clauses
      : clauses.filter((clause) => !clause.startsWith('is_reminder ='));

    if (safeClauses.length === 0) return null;

    return `UPDATE itinerary_checklist_items c
            SET ${safeClauses.join(', ')},
                updatedat = CURRENT_TIMESTAMP
            FROM itineraries i
            WHERE c.itinerary_uuid = i.uuid
              AND i.uuid = $${itineraryUuidIndex}
              AND i.userid = $${userIdIndex}
              AND c.id = $${itemIdIndex}
            RETURNING c.id, c.item_text, c.is_checked, c.is_reminder, c.sort_order`;
  };

  try {
    let querySql = buildUpdateSql(setClauses, true);
    if (!querySql) return res.status(400).json({ error: '沒有可更新的欄位' });

    let result;
    try {
      result = await pool.query(querySql, values);
    } catch (e) {
      if (e.code !== '42703') throw e;

      querySql = buildUpdateSql(setClauses, false);
      if (!querySql) {
        return res.status(400).json({ error: '目前資料庫尚未支援 reminder 欄位，請先更新資料表' });
      }

      result = await pool.query(
        querySql.replace('c.is_reminder, ', ''),
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '清單項目不存在或無權限' });
      }

      const row = result.rows[0];
      return res.json({
        item: {
          id: row.id,
          text: row.item_text,
          checked: Boolean(row.is_checked),
          reminder: false,
          sortOrder: Number(row.sort_order) || 0,
        },
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '清單項目不存在或無權限' });
    }

    const row = result.rows[0];
    return res.json({
      item: {
        id: row.id,
        text: row.item_text,
        checked: Boolean(row.is_checked),
        reminder: Boolean(row.is_reminder),
        sortOrder: Number(row.sort_order) || 0,
      },
    });
  } catch (err) {
    console.error('Update checklist item error:', err);
    res.status(500).json({ error: '更新行前清單項目失敗' });
  }
});

// DELETE /api/itineraries/:uuid/checklist/:itemId
router.delete('/:uuid/checklist/:itemId', async (req, res) => {
  const { uuid, itemId } = req.params;
  const itemIdNum = Number(itemId);
  if (!Number.isFinite(itemIdNum) || itemIdNum <= 0) {
    return res.status(400).json({ error: '項目識別碼格式錯誤' });
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM itinerary_checklist_items c
       USING itineraries i
       WHERE c.itinerary_uuid = i.uuid
         AND i.uuid = $1
         AND i.userid = $2
         AND c.id = $3`,
      [uuid, req.user.id, itemIdNum]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: '清單項目不存在或無權限' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete checklist item error:', err);
    res.status(500).json({ error: '刪除行前清單項目失敗' });
  }
});

// ------------------ 行程 CRUD ------------------

// GET /api/itineraries (取得行程列表)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT uuid, title, summary, city, startdate, starttime, createdat, updatedat FROM itineraries WHERE userid = $1 ORDER BY updatedat DESC',
      [req.user.id]
    );
    // 確保上方有引入 toHHmm
    res.json({ itineraries: rows.map((row) => ({ ...row, starttime: toHHmm(row.starttime) })) });
  } catch (err) {
    console.error('Get itineraries error:', err);
    res.status(500).json({ error: '取得行程列表失敗' });
  }
});

// POST /api/itineraries (新增行程)
router.post('/', async (req, res) => {
  const { title, summary, city, startDate, startTime, itineraryData, tripNote, checklistItems } = req.body;
  if (!itineraryData) return res.status(400).json({ error: '行程資料不可為空' });
  
  const uuid = crypto.randomUUID(); // 這裡會用到 crypto
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO itineraries (userid, uuid, title, summary, city, startdate, starttime, note, itinerarydata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING uuid, createdat`,
      [
        req.user.id,
        uuid,
        title || '',
        summary || '',
        city || '',
        startDate || null,
        toHHmm(startTime || itineraryData?.startTime),
        tripNote || itineraryData?.tripNote || null,
        JSON.stringify(itineraryData),
      ]
    );

    await replaceChecklistItems(client, uuid, checklistItems || itineraryData?.packingItems || []);
    await client.query('COMMIT');

    res.status(201).json({ uuid: rows[0].uuid, createdAt: rows[0].createdat });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create itinerary error:', err);
    res.status(500).json({ error: '保存行程失敗' });
  } finally {
    client.release();
  }
});

// GET /api/itineraries/:uuid (取得單一行程詳細資料)
router.get('/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM itineraries WHERE uuid = $1 AND userid = $2',
      [uuid, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '行程未公開或不存在' });
    
    const row = rows[0];
    let itineraryData;
    try { itineraryData = JSON.parse(row.itinerarydata); } catch { itineraryData = null; }
    
    const checklistItems = await readChecklistItemsByUuid(pool, row.uuid);
    const fallbackChecklist = normalizeChecklistItems(itineraryData?.packingItems || []).map((item, idx) => ({ ...item, id: `legacy-${idx}` }));
    
    res.json({
      uuid: row.uuid,
      title: row.title,
      summary: row.summary,
      city: row.city,
      startDate: row.startdate,
      startTime: toHHmm(row.starttime || itineraryData?.startTime),
      tripNote: row.note || itineraryData?.tripNote || '',
      checklistItems: checklistItems ?? fallbackChecklist,
      itineraryData,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
    });
    
  } catch (err) {
    console.error('Get itinerary error:', err);
    res.status(500).json({ error: '取得行程失敗' });
  }
});

// PUT /api/itineraries/:uuid (更新行程)
router.put('/:uuid', async (req, res) => {
  const { uuid } = req.params;
  const { title, summary, city, startDate, startTime, itineraryData, tripNote, checklistItems } = req.body;
  if (!itineraryData) return res.status(400).json({ error: '行程資料不可為空' });
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE itineraries
       SET title = $1,
           summary = $2,
           city = $3,
           startdate = $4,
           starttime = $5,
           note = $6,
           itinerarydata = $7,
           updatedat = CURRENT_TIMESTAMP
       WHERE uuid = $8 AND userid = $9`,
      [
        title || '',
        summary || '',
        city || '',
        startDate || null,
        toHHmm(startTime || itineraryData?.startTime), // 確保上方有引入 toHHmm
        tripNote || itineraryData?.tripNote || null,
        JSON.stringify(itineraryData),
        uuid,
        req.user.id,
      ]
    );

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '行程不存在或無權限' });
    }

    // 確保上方有這個輔助函式 replaceChecklistItems
    await replaceChecklistItems(client, uuid, checklistItems || itineraryData?.packingItems || []);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update itinerary error:', err);
    res.status(500).json({ error: '更新行程失敗' });
  } finally {
    client.release();
  }
});

// DELETE /api/itineraries/:uuid (刪除行程)
router.delete('/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM itineraries WHERE uuid = $1 AND userid = $2',
      [uuid, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: '行程不存在或無權限' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete itinerary error:', err);
    res.status(500).json({ error: '刪除行程失敗' });
  }
});

module.exports = router;