require('dotenv').config();
const axios = require('axios');
const pool = require('../db');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const REQUEST_DELAY_MS = Number(process.env.POI_BACKFILL_DELAY_MS || 120);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupPoiCoordinates(query) {
  const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
    params: {
      query,
      key: GOOGLE_PLACES_API_KEY,
      language: 'zh-TW',
    },
    timeout: 12000,
  });

  const first = response.data?.results?.[0];
  const lat = Number(first?.geometry?.location?.lat);
  const lng = Number(first?.geometry?.location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng, placeName: first?.name || null };
}

async function main() {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('Missing GOOGLE_PLACES_API_KEY');
  }

  const cityFilter = String(process.argv[2] || '').trim();
  const client = await pool.connect();

  try {
    const params = [];
    let whereClause = 'WHERE p.is_active = true AND (p.latitude IS NULL OR p.longitude IS NULL)';
    if (cityFilter) {
      params.push(cityFilter);
      whereClause += ` AND lower(c.city) = lower($${params.length})`;
    }

    const { rows } = await client.query(
      `SELECT p.id, p.name, p.category, c.city, c.country
       FROM public.city_pois p
       JOIN public.cities c ON c.id = p.city_id
       ${whereClause}
       ORDER BY c.city ASC, p.sort_order ASC, p.id ASC`,
      params
    );

    if (!rows.length) {
      console.log('No POIs need coordinate backfill.');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const poi of rows) {
      const query = `${poi.name} ${poi.city} ${poi.country || ''}`.trim();

      try {
        const coords = await lookupPoiCoordinates(query);
        if (!coords) {
          failed += 1;
          console.log(`[MISS] #${poi.id} ${query}`);
        } else {
          await client.query(
            `UPDATE public.city_pois
             SET latitude = $2,
                 longitude = $3,
                 updatedat = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [poi.id, coords.lat, coords.lng]
          );
          success += 1;
          console.log(`[OK] #${poi.id} ${poi.name} -> ${coords.lat}, ${coords.lng}`);
        }
      } catch (error) {
        failed += 1;
        console.log(`[ERR] #${poi.id} ${query} :: ${error.message}`);
      }

      if (REQUEST_DELAY_MS > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
    }

    console.log('POI coordinate backfill completed.');
    console.log(`Total: ${rows.length}, Success: ${success}, Failed: ${failed}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('POI coordinate backfill failed');
  console.error(error);
  process.exitCode = 1;
});