// backend/utils/guides.js
const { toISODate } = require('./formatters');
const pool = require('../db');

function safeParseItineraryData(rawValue) {
  if (!rawValue) return null;
  if (typeof rawValue === 'object') return rawValue;
  try {
    return JSON.parse(rawValue);
  } catch (_e) {
    return null;
  }
}

function toGuideTripInfo(itineraryData) {
  const days = Array.isArray(itineraryData?.days) ? itineraryData.days : [];
  const dayCount = days.length || null;
  return {
    days: dayCount,
    nights: dayCount ? Math.max(dayCount - 1, 0) : null,
  };
}

function buildGuideBody(row, itineraryData) {
  const lines = [];
  const summary = String(row.summary || '').trim();
  const note = String(row.note || '').trim();

  if (summary) lines.push(summary);
  if (note && note !== summary) lines.push(note);

  const days = Array.isArray(itineraryData?.days) ? itineraryData.days : [];
  days.forEach((day, index) => {
    const dayNumber = Number(day?.day) || index + 1;
    const title = String(day?.title || `第 ${dayNumber} 天`).trim();
    lines.push(`${title}`);

    const items = Array.isArray(day?.items) ? day.items : [];
    items.forEach((item) => {
      const time = String(item?.time || '').trim();
      const name = String(item?.name || '').trim() || '未命名項目';
      const itemNote = String(item?.note || '').trim();
      lines.push(`- ${[time, name].filter(Boolean).join(' ')}${itemNote ? `：${itemNote}` : ''}`);
    });
  });

  return lines.join('\n');
}

function mapItineraryToGuideRow(row) {
  const itineraryData = safeParseItineraryData(row.itinerarydata);

  return {
    id: `guide-${row.uuid}`,
    slug: row.uuid,
    title: row.title || row.summary || '未命名指南',
    summary: row.summary || '',
    city: row.city || '',
    authorName: row.displayname || row.email || '匿名旅人',
    authorUsername: row.username || null,
    coverImage: row.cover_image || '',
    publishedAt: toISODate(row.updatedat || row.createdat || row.startdate), // 確保 toISODate 有引入
    guideCode: null,
    tripInfo: toGuideTripInfo(itineraryData),
  };
}

function mapItineraryToGuideDetailRow(row) {
  const itineraryData = safeParseItineraryData(row.itinerarydata);

  return {
    id: `guide-${row.uuid}`,
    slug: row.uuid,
    guideCode: null,
    city: row.city || '',
    country: '',
    title: row.title || row.summary || '未命名指南',
    summary: row.summary || '',
    body: buildGuideBody(row, itineraryData),
    coverImage: '',
    tags: Array.isArray(itineraryData?.tags) ? itineraryData.tags : [],
    tripInfo: toGuideTripInfo(itineraryData),
    author: {
      displayName: row.displayname || row.email || '匿名旅人',
      username: row.username || null,
      avatar: row.profilephoto || '',
    },
    publishedAt: toISODate(row.updatedat || row.createdat || row.startdate),
    viewCount: 0,
  };
}

async function fetchPublicGuideRows(limit, { city = '', keyword = '' } = {}) {
  const params = [];
  let sql = `SELECT i.uuid, i.title, i.summary, i.city, i.startdate, i.note, i.itinerarydata,
                    i.createdat, i.updatedat,
                    u.displayname, u.email, u.username, u.profilephoto
             FROM itineraries i
             JOIN users u ON u.id = i.userid
             WHERE i.ispublic = true`;

  if (city) {
    params.push(`%${city}%`);
    sql += ` AND i.city ILIKE $${params.length}`;
  }

  if (keyword) {
    params.push(`%${keyword}%`);
    sql += ` AND (i.title ILIKE $${params.length} OR i.summary ILIKE $${params.length})`;
  }

  params.push(limit);
  sql += ` ORDER BY i.updatedat DESC, i.createdat DESC LIMIT $${params.length}`;

  const { rows } = await pool.query(sql, params);
  return rows;
}

async function getPublicGuideBySlug(slugFromPath) {
  const decoded = (() => {
    try {
      return decodeURIComponent(slugFromPath);
    } catch (_e) {
      return slugFromPath;
    }
  })();

  const { rows } = await pool.query(
    `SELECT i.uuid, i.title, i.summary, i.city, i.startdate, i.note, i.itinerarydata,
            i.createdat, i.updatedat,
            u.displayname, u.email, u.username, u.profilephoto
     FROM itineraries i
     JOIN users u ON u.id = i.userid
     WHERE i.ispublic = true AND i.uuid = $1
     LIMIT 1`,
    [decoded]
  );

  if (rows.length > 0) return mapItineraryToGuideDetailRow(rows[0]);

  const fallbackRows = await fetchPublicGuideRows(200);
  const normalizedTarget = String(decoded || '').trim().toLowerCase();
  const matchRow = fallbackRows.find((row) => String(row.uuid).toLowerCase() === normalizedTarget || String(row.title || '').trim().toLowerCase() === normalizedTarget);
  return matchRow ? mapItineraryToGuideDetailRow(matchRow) : null;
}

module.exports = {
  safeParseItineraryData,
  toGuideTripInfo,
  buildGuideBody,
  mapItineraryToGuideRow,
  mapItineraryToGuideDetailRow,
  fetchPublicGuideRows,
  getPublicGuideBySlug
};