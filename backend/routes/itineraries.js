const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const OpenAI = require('openai');
const { ok, err } = require('../utils/response');
const { toHHmm } = require('../utils/formatters');
const crypto = require('crypto');

router.use(authMiddleware);

const CHECKLIST_LIMIT = 50;
const CHECKLIST_TEXT_MAX_LENGTH = 800;
const CHECKLIST_GENERATION_MIN = 5;
const URL_VERIFY_TIMEOUT_MS = 3500;
const URL_VERIFY_MAX_PER_REQUEST = 8;
const CHECKLIST_MARKDOWN_URL_REGEX = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/gi;
const CHECKLIST_RAW_HTTPS_URL_REGEX = /https:\/\/[^\s)]+/gi;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

function normalizeChecklistTextForCompare(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mergeChecklistItems(existingItems, generatedItems) {
  const normalizedExisting = normalizeChecklistItems(existingItems);
  const normalizedGenerated = normalizeChecklistItems(generatedItems);
  const usedKeys = new Set(
    normalizedExisting
      .map((item) => normalizeChecklistTextForCompare(item.text))
      .filter(Boolean)
  );

  const merged = [...normalizedExisting];

  for (const generated of normalizedGenerated) {
    if (merged.length >= CHECKLIST_LIMIT) break;
    const compareKey = normalizeChecklistTextForCompare(generated.text);
    if (!compareKey || usedKeys.has(compareKey)) continue;
    usedKeys.add(compareKey);
    merged.push({
      ...generated,
      id: null,
      checked: false,
      reminder: false,
    });
  }

  return merged.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function extractChecklistTexts(rawContent) {
  const content = String(rawContent || '').trim();
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed?.items)) {
      return parsed.items.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch (_) {
    // Ignore parsing errors and try line-based fallback below.
  }

  return content
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeExtractedUrl(rawUrl) {
  return String(rawUrl || '').trim().replace(/[),.;!?]+$/g, '');
}

function isPrivateOrLocalHostname(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return true;

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.localdomain') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map((part) => Number(part));
    if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
  }

  if (host.includes(':')) {
    const normalized = host.replace(/^\[|\]$/g, '');
    if (
      normalized === '::1' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd')
    ) {
      return true;
    }
  }

  return false;
}

function extractUniqueUrlsFromText(text) {
  const source = String(text || '');
  if (!source) return [];

  const seen = new Set();
  const urls = [];
  CHECKLIST_MARKDOWN_URL_REGEX.lastIndex = 0;
  CHECKLIST_RAW_HTTPS_URL_REGEX.lastIndex = 0;

  let match;
  while ((match = CHECKLIST_MARKDOWN_URL_REGEX.exec(source)) !== null) {
    const normalized = normalizeExtractedUrl(match[2]);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }

  while ((match = CHECKLIST_RAW_HTTPS_URL_REGEX.exec(source)) !== null) {
    const normalized = normalizeExtractedUrl(match[0]);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
}

function removeUrlFromChecklistText(text, url) {
  const source = String(text || '');
  const targetUrl = normalizeExtractedUrl(url);
  if (!source || !targetUrl) return source.trim();

  const escapedUrl = escapeRegex(targetUrl);
  const markdownUrlRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapedUrl}\\)`, 'gi');
  const rawUrlRegex = new RegExp(escapedUrl, 'gi');

  return source
    .replace(markdownUrlRegex, '$1')
    .replace(rawUrlRegex, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_VERIFY_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function canReachUrl(url) {
  let parsed;
  try {
    parsed = new URL(String(url || '').trim());
  } catch (_) {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (isPrivateOrLocalHostname(parsed.hostname)) return false;

  try {
    const headResponse = await fetchWithTimeout(parsed.toString(), 'HEAD');
    if (headResponse.ok) return true;
  } catch (_) {
    // Some sites reject HEAD, fallback to GET.
  }

  try {
    const getResponse = await fetchWithTimeout(parsed.toString(), 'GET');
    return getResponse.ok;
  } catch (_) {
    return false;
  }
}

async function sanitizeChecklistTextsWithUrlValidation(texts) {
  const source = Array.isArray(texts) ? texts : [];
  const reachabilityCache = new Map();
  let verifyCount = 0;
  const sanitized = [];

  for (const item of source) {
    let cleanedText = String(item || '').trim();
    if (!cleanedText) continue;

    const urls = extractUniqueUrlsFromText(cleanedText);
    for (const url of urls) {
      let reachable;
      if (reachabilityCache.has(url)) {
        reachable = reachabilityCache.get(url);
      } else if (verifyCount >= URL_VERIFY_MAX_PER_REQUEST) {
        reachable = false;
        reachabilityCache.set(url, false);
      } else {
        verifyCount += 1;
        reachable = await canReachUrl(url);
        reachabilityCache.set(url, reachable);
      }

      if (!reachable) {
        cleanedText = removeUrlFromChecklistText(cleanedText, url);
      }
    }

    cleanedText = cleanedText.trim();
    if (cleanedText) sanitized.push(cleanedText);
  }

  return sanitized;
}

function inferActivityTypesFromDays(days = []) {
  const text = Array.isArray(days)
    ? days
        .flatMap((day) => (Array.isArray(day?.items) ? day.items : []))
        .map((item) => `${item?.type || ''} ${item?.name || ''} ${item?.note || ''}`.toLowerCase())
        .join(' ')
    : '';

  const types = [];
  if (/hike|trail|登山|健行|露營|浮潛|潛水|滑雪|衝浪|戶外/.test(text)) types.push('戶外冒險');
  if (/beach|island|海灘|海邊|離島|度假/.test(text)) types.push('海灘度假');
  if (/museum|gallery|寺|廟|文化|歷史|古蹟|展覽|藝術/.test(text)) types.push('文化探訪');
  if (/meeting|conference|商務|拜訪客戶|展會/.test(text)) types.push('商務');
  if (/food|餐|夜市|咖啡|吃|美食/.test(text)) types.push('城市觀光');
  return types.length ? types.join('、') : '城市觀光';
}

function formatItineraryContext(itineraryData = {}, fallback = {}) {
  const days = Array.isArray(itineraryData?.days) ? itineraryData.days : [];
  const daysCount = days.length || Number(fallback?.daysCount) || null;
  const city = itineraryData?.city || fallback?.city || '未提供';
  const startDate = itineraryData?.startDate || fallback?.startDate || '未提供';
  const totalBudget = Number(itineraryData?.totalBudget);
  const budgetText = Number.isFinite(totalBudget) && totalBudget > 0 ? `${totalBudget}` : '未提供';
  const activityType = inferActivityTypesFromDays(days);

  const summaryText = [
    `目的地：${city}`,
    `開始日期：${startDate}`,
    `旅遊天數：${daysCount || '未提供'} 天`,
    `總預算：${budgetText}`,
    `主要活動類型：${activityType}`,
  ].join('\n');

  const detailLines = days.length
    ? days.map((day, dayIdx) => {
        const items = Array.isArray(day?.items) ? day.items : [];
        if (!items.length) return `第${dayIdx + 1}天：尚未安排活動`;
        const detail = items
          .map((item) => {
            const time = String(item?.time || '時間未定').trim();
            const name = String(item?.name || '未命名活動').trim();
            const type = String(item?.type || '').trim();
            const cost = Number(item?.cost);
            const typeSuffix = type ? `/${type}` : '';
            const costSuffix = Number.isFinite(cost) && cost > 0 ? `，花費 ${cost}` : '';
            return `${time} ${name}${typeSuffix}${costSuffix}`;
          })
          .join(' → ');
        return `第${dayIdx + 1}天：${detail}`;
      })
    : ['未提供完整日程'];

  return {
    summaryText,
    detailText: detailLines.join('\n'),
    daysCount,
  };
}

function extractItineraryPoiNames(itineraryData = {}) {
  const days = Array.isArray(itineraryData?.days) ? itineraryData.days : [];
  const seen = new Set();
  const names = [];

  for (const day of days) {
    const items = Array.isArray(day?.items) ? day.items : [];
    for (const item of items) {
      const name = String(item?.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }

  return names;
}

async function generateChecklistSuggestionsWithLLM({
  city,
  startDate,
  daysCount,
  tags,
  summary,
  tripNote,
  existingItemsCount,
  itinerarySummaryText,
  itineraryDetailText,
  itineraryPoiNames,
}) {
  if (!openai) {
    throw new Error('OpenAI 金鑰未設定，無法產生行前清單');
  }

  const today = new Date().toISOString().split('T')[0];
  const tagText = Array.isArray(tags) && tags.length ? tags.join('、') : '未提供';
  const poiText = Array.isArray(itineraryPoiNames) && itineraryPoiNames.length
    ? itineraryPoiNames.join('、')
    : '未提供';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.35,
    messages: [
      {
        role: 'system',
        content: `
        你是一位資深旅遊顧問，專精行前準備與風險規劃。今天日期為 ${today}。
        【任務流程 — 內部思考，不輸出】
          在產生清單前，請依序完成以下分析：
          1. 識別目的地的當前季節與預期天氣類型
          2. 判斷主要活動類型（城市觀光 / 戶外冒險 / 海灘度假 / 商務 / 文化探訪）
          3. 確認是否需要簽證、特殊保險、疫苗或健康文件
          4. 檢視備註與標籤中是否有特殊需求或風險

          完成分析後，才依以下規則輸出清單。

          【行程上下文】
          【行程摘要】
          ${itinerarySummaryText || '未提供'}

          【行程詳情】
          ${itineraryDetailText || '未提供'}

          【輸出格式】
          - 僅回傳 JSON，格式為 {"items":["..."]}
          - 不包含任何說明文字、Markdown、code block 包裹語法
          - 每個項目為繁體中文短句，建議 12-80 字
          - 可包含連結，格式可為 [連結文字](https://...) 或 https://...
          - 不加編號、不加分類標題

          【清單內容要求】
          - 共 ${CHECKLIST_GENERATION_MIN}–${CHECKLIST_LIMIT} 個項目
          - 至少 70% 項目需直接對應行程內景點/活動（名稱或明確上下文）
          - 優先考量：門票預訂、入場規則、預約時段、集合時間、官方資訊核對
          - 涵蓋面向：證件與簽證、金融支付、衣物裝備、藥品安全、通訊網路、交通預訂
          - 每項應具體且可執行，避免空泛建議
          - 針對可預訂門票或需官方資訊的景點，優先附上官方網址
          - 若不確定官方網址，禁止捏造或編造連結
          - 禁止低關聯泛用項目：可重複使用水瓶、查詢醫療機構位置、帶環保筷、記得微笑拍照
          - 避免與現有清單重複（現有項目數：${existingItemsCount}）
        `,
      },
      {
        role: 'user',
        content: `目的地：${city || '未提供'}\n開始日期：${startDate || '未提供'}\n旅遊天數：${daysCount || '未提供'}\n行程摘要：${summary || '未提供'}\n行程景點清單：${poiText}\n標籤：${tagText}\n旅遊備註：${tripNote || '未提供'}\n現有清單項目數：${existingItemsCount}\n請優先產出與行程景點密切相關且可執行的準備項目。`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'checklist_items',
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              minItems: CHECKLIST_GENERATION_MIN,
              maxItems: CHECKLIST_LIMIT,
              items: { type: 'string' },
            },
          },
          required: ['items'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion?.choices?.[0]?.message?.content;
  const texts = extractChecklistTexts(content);
  const sanitizedTexts = await sanitizeChecklistTextsWithUrlValidation(texts);
  return sanitizedTexts.slice(0, CHECKLIST_LIMIT);
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

// POST /api/itineraries/:uuid/generate-checklist
router.post('/:uuid/generate-checklist', async (req, res) => {
  const { uuid } = req.params;
  const replaceExisting = Boolean(req.body?.replaceExisting);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allowed = await itineraryBelongsToUser(client, uuid, req.user.id);
    if (!allowed) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '行程不存在或無權限' });
    }

    const itineraryResult = await client.query(
      `SELECT title, summary, city, startdate, note, itinerarydata
       FROM itineraries
       WHERE uuid = $1 AND userid = $2
       LIMIT 1`,
      [uuid, req.user.id]
    );

    if (itineraryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '行程不存在或無權限' });
    }

    const itineraryRow = itineraryResult.rows[0];
    let itineraryData = {};
    if (itineraryRow.itinerarydata && typeof itineraryRow.itinerarydata === 'object') {
      itineraryData = itineraryRow.itinerarydata;
    } else {
      try {
        itineraryData = JSON.parse(itineraryRow.itinerarydata || '{}') || {};
      } catch (_) {
        itineraryData = {};
      }
    }

    const existingChecklistFromTable = await readChecklistItemsByUuid(client, uuid);
    const existingChecklist = replaceExisting
      ? []
      : (Array.isArray(existingChecklistFromTable) && existingChecklistFromTable.length > 0
          ? existingChecklistFromTable
          : normalizeChecklistItems(itineraryData?.packingItems || []));

    const itineraryContext = formatItineraryContext(itineraryData, {
      city: itineraryRow.city,
      startDate: itineraryRow.startdate,
      daysCount: Array.isArray(itineraryData?.days) ? itineraryData.days.length : null,
    });
    const itineraryPoiNames = extractItineraryPoiNames(itineraryData);

    const suggestionTexts = await generateChecklistSuggestionsWithLLM({
      city: itineraryRow.city || itineraryData?.city,
      startDate: itineraryRow.startdate || itineraryData?.startDate,
      daysCount: Array.isArray(itineraryData?.days) ? itineraryData.days.length : null,
      tags: itineraryData?.tags,
      summary: itineraryRow.summary || itineraryData?.summary || itineraryRow.title,
      tripNote: itineraryRow.note || itineraryData?.tripNote,
      existingItemsCount: existingChecklist.length,
      itinerarySummaryText: itineraryContext.summaryText,
      itineraryDetailText: itineraryContext.detailText,
      itineraryPoiNames,
    });

    const generatedItems = normalizeChecklistItems(
      suggestionTexts.map((text, idx) => ({ text, checked: false, reminder: false, sortOrder: idx }))
    );
    const mergedItems = replaceExisting
      ? generatedItems
      : mergeChecklistItems(existingChecklist, generatedItems);
    const addedCount = replaceExisting
      ? mergedItems.length
      : Math.max(0, mergedItems.length - existingChecklist.length);

    await replaceChecklistItems(client, uuid, mergedItems);

    await client.query('COMMIT');

    const latestChecklistItems = await readChecklistItemsByUuid(pool, uuid);
    return res.json({
      checklistItems: latestChecklistItems || [],
      generated: true,
      addedCount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Generate checklist error:', error);
    return res.status(500).json({ error: error.message || '生成行前清單失敗' });
  } finally {
    client.release();
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