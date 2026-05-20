require('dotenv').config();
const pool = require('../db');

const SEOUL_GUIDE = {
  city: {
    city: 'Seoul',
    country: 'South Korea',
    description: 'A dynamic capital where modern shopping districts, historic palaces, and mountain scenery coexist. Seoul moves fast, but it still leaves room for hanok villages, peaceful temples, and family-friendly attractions across the city.',
    cover_image: 'https://images.unsplash.com/photo-1601621915196-2621bfb0cd6e?q=80&w=1744&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    latitude: 37.43769,
    longitude: 127.062554,
  },
  places: [
    { name: 'Lotte World', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOWBKNvB4icmwZwLrHet4pFz5AryikcgSLa_4i9pk09JrFaZRwEOEeUfXJNnX_X4Hc_YGsTl6QDSXFFMEt8GKZ2RrDljcc6XAcDH8nmPJG89VNBv2Sum7bv4b1KJKBTum8xqVw8g_jfyQGBAQ=w750' },
    { name: 'Myeong-dong', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOB2aJXts4QXh7dP81cy5-1br2DYW1k4vNTGNCd6gwQh36Ad3nFDQJe6Se2YbL5zmWgAQIOKUr5D-AAZ6OrKZa7DaWKPTnnfh8KgNpH6r2c7pVBJ4OZT23QuOIPmpFsTWQIrMl6XjpXj_TKiQ=w750' },
    { name: 'Gyeongbokgung Palace', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOVs2hS3AijqJMMOWUk4wOyQx6bZMIZYAsxQ_L3hJmHN1T9Li4a4o3otA7FwhM9e7_6Vv76wO7sqSCu1R_gUnXdXRKEMi5SxJ5880Y1EVQ1oAqvGeVAisJJWyfK4PZ2VM7Ei6GNClJl3qh7ZWw=w750' },
    { name: 'Hongdae', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPtr9MJkD2u0JWSlpYxoE-CbLcvHf5fILewOqtgB0ugKljIlIpFJPXZBOPK63D9ErJHz3Adt9Mqo_MsNlN53gbgI60Th_rvqZia4eDnmbsV32lAy7Tlj8SaFw355UDPJDZJ9r4M0AIfWZBRHw5SiBFvgg=w750' },
    { name: 'Gangnam District', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNwwDHmM8sDoBdXQBd38N3x2QGB2EsI-pZYDKyo1P3AAYI-9E-yhRmk_zg_p2mODkwXQNpbTPs7gxncr6IHDic6Z_RgBXd-ZVuaSCrBCFgd2ngKTN39xxyLMCLa7iZPQd5nsmD1_NG8cQTMnL0=w750' },
    { name: 'Namsan Cable Car', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqF3HVXWYUrNsfOJoBhM_zwDzsRtFF2UsDuYHDEq8306zmkz7wuCaBEb8TwE9E8hyIaBlcbpBh-gy4vAgLXRQTs3DQRPqgEop9g=w750' },
    { name: 'Starfield COEX Mall', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZP6uvuQfsO4qLo1XhuNPSED-UIMPHLxDIL-pP3y77e4ubpy7IZRxTeB5W6vAVKrvVjQIMw6hQxEvZd7-v4cMaDmV0GEhi1eDJdKhKpc28S4fWTlj3fsmjlwcAOqM0H6s5e-A8ulfTpzx6bvGw=w750' },
    { name: 'Starfield Library', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNYQIkntGxrvKXrUX71vXHfnHtBcFDUSTs_ae9g2KIjhUCQCB-4fEGR-S2Qyj0Y60r_XcyX9xFfCFOEuKp9GfFwzhUaI0FWshzqapg3gAQjQGgAWmVV-6VJEhqjr_MKjAmtMl1Zz-KF8yrK=w750' },
    { name: 'Bukchon Hanok Village', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNr-V4fodyJC1QxCklR0JVSGRQZHyEjpExpCL-TnpwyvFDlVlR2WLqQ1LoicLB_McU8ecGWdiOJTMG0kR6lZ_-zzPyJmE9ubhho4Cer5zXy__3KuGU45FsdxUqKlQxW_e_jZEMTWS8yXt6ZPO0=w750' },
    { name: 'N Seoul Tower', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZM-uKCAyfn29_cXvJA67TiPdEOR5X02wAWJJ6iRKdqEYekWKa7trIbm3HDXET55DhH_lfJ-nKQpUnQ-ZTULRMqnRaZN370jdybPpLpGdCR3PiGtCpnMFG3C-TLze5jOMrmM7clrVHVVDzR2eCw=w750' },
  ],
  hotels: [
    { name: 'Hanok Hotel DAAM Seoul', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPFA9kk1Coo4Fxz90Kgq-dQDCbNupGqj1XltsAZ6wbUuZzEVqHeEPN50dZ0tCpD2D9fTgceAVzFZMaYo6LMyPpn57aiMtwy4o1OABmLPhy3XReoKmcJCF8V2sBfs3mOEYO0OWlvutTG7OCtZw=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=120188881'},
    { name: 'The Prima Hotel Jongno', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZONu_gwal2T0Ml8q1EuHP9geJnlx5pl1brrNSGe0gZTBVfTRsKhbhE0X5a_d2VXlHuejxYxOGil8qzTUrI9BqlSakiox_LN72csmHcsmQbXxx1Y6xxldZKz-94e7CQV93dpoDwD7FbiT3N7O_c=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=988636'},
    { name: 'Mercure Ambassador Seoul Hongdae', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqF3C8xWXNMORQaxqbUJOG8mWnEv46xR8UQt9aBxaxwTqAh-kSvorPOq0VX-SEJh-Vtfwlg0KTApE3JliPFYG-TJmi5p0pYrm54=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=57079911'},
    { name: 'Hotel Firststay Myeongdong', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPhCz897FE0vvBEgNs11aOy3Z3wcPA6z9sD_nPpH1vT-rU8FjjGirYgOYgBzjXYd5cK65PU5lXfe6NZ-TdOto2XTQUiPwl8cUJC__zYoYmQuJ5BtVl4FmaBR44_LRuQnwut--_Y_j4OCvCHfg=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=102314199'},
    { name: 'L’Escape Hotel', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNWqYNhIU59ZsjarYvsW0Jb2GjrGKPMpJt7g47R3TH1QiRGZ5bfoy5lfzMzJNzLuYBbL-MrIK5XAP5Jxce6Pm_sWfoml4Xq1S6-XeSBIrlWKMoATZJGeh-hD_ZPqM2QsbKZ2HywZkcKP89S3Nc=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=19631550'},
    { name: 'Aloft Seoul Myeongdong', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqE3YDAXSjJFL306fJ0iJlJ0gL7q4x4rTxvM6XjJhlefTQxEKS9GuZ3LCOOq2g4M1EF2TnxqrQHgUX5LXRtAntNzX_yiO2NzN08=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=6596881'},
    { name: 'Hotel28 Myeongdong', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFTc0VtWAAqf4GX6WTyv6uTqqW2aplq-hkj1L_x1vY7hXZYyXidIZWjY4SBJSI-IFNwCxpfucIxEr0pVYSJwFH83_ihbgSIF4A=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=5708545'},
    { name: 'Westin Josun Seoul Hotel', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEpvKMEKlR8VVnT6zo99dkHhWoK6GkhQYiSck8pBK9ZPqcvFdJ5YBxlpfDaZg7CqimbbWf8rAJZAmxglzMsKichT9aQ_XIH9Pw=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=988507'},
    { name: 'Moxy Seoul Insadong', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGosZUOc9plJWsobwg2N0HeMKaP3VDmb5-gkaWLPnNQih9r5zb7FLNmBE_aW5YAdyuCQUcmTYUenepUXNkfdeS576baG6VBjsA=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=688499'},
    { name: 'Mercure Ambassador Seoul Hongdae', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqF3C8xWXNMORQaxqbUJOG8mWnEv46xR8UQt9aBxaxwTqAh-kSvorPOq0VX-SEJh-Vtfwlg0KTApE3JliPFYG-TJmi5p0pYrm54=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=57079911'},
  ],
  restaurants: [],
  activities: [
    { name: 'Lotte World Ticket in Seoul', description: 'Large recreation complex with indoor and outdoor amusement parks.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOWBKNvB4icmwZwLrHet4pFz5AryikcgSLa_4i9pk09JrFaZRwEOEeUfXJNnX_X4Hc_YGsTl6QDSXFFMEt8GKZ2RrDljcc6XAcDH8nmPJG89VNBv2Sum7bv4b1KJKBTum8xqVw8g_jfyQGBAQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/251-lotte-world-seoul/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'N Seoul Tower Observatory Ticket', description: 'Panoramic observation deck above Namsan Mountain.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZM-uKCAyfn29_cXvJA67TiPdEOR5X02wAWJJ6iRKdqEYekWKa7trIbm3HDXET55DhH_lfJ-nKQpUnQ-ZTULRMqnRaZN370jdybPpLpGdCR3PiGtCpnMFG3C-TLze5jOMrmM7clrVHVVDzR2eCw=w750' ,book_url: 'https://www.klook.com/en-US/activity/412-n-seoul-tower-seoul/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Seoul Sky Lotte World Tower Ticket', description: 'Glass-bottomed observation deck from the 117th to 123rd floors.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEQsAl8o-WSJfXiQXDzAp9miqAnCpvmCkGpNP_TfuglKLV809WV96apN6iSCTyq2b6SQ7j4v4pxXSrS6Z5F6zh0SlS6bV_j_hQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/17678-lotte-world-sky-admission/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'SEA LIFE COEX Seoul Aquarium Ticket', description: 'Large aquarium inside COEX Mall with themed zones and sea creatures.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqExi9qgc2R6CcsP5v50LVbT4ezlzeLkOeG_-nedIsZsHUJzuTzBLFelNhyRNGiw_wBE4mVe2keByZm28sHSl8s8DLvp-8AF33M=w750' ,book_url: 'https://www.klook.com/en-US/activity/8185-coex-aquarium-admission-ticket-seoul/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Seoul Everland Theme Park Day Tour with Transfers', description: 'Day tour to Korea’s largest theme park with safari world and festivals.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOJARPPjRnIlsYhL6vCXh8ymj7hUveWmSwQZ5CNSD6ZKknjmSgBFnYXLw-RpeHJT1mThP9bdVKrvItBhu_PronCv3FTO5QhBKydSG3ryJldiW6GNRR_2HbDKWLiF9agEuGm3g841qJQWq3w_w=w750' ,book_url: 'https://www.klook.com/en-US/activity/2968-everland-roundtrip-transfer-gyeonggi-do/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
  ],
};

async function upsertCity(client, city) {
  const existing = await client.query(
    `SELECT id FROM public.cities WHERE lower(city) = lower($1) LIMIT 1`,
    [city.city]
  );

  if (existing.rows.length) {
    const cityId = existing.rows[0].id;
    await client.query(
      `UPDATE public.cities
       SET country = $2,
           description = $3,
           cover_image = $4,
           latitude = $5,
           longitude = $6,
           is_active = true,
           updatedat = NOW()
       WHERE id = $1`,
      [cityId, city.country, city.description, city.cover_image, city.latitude, city.longitude]
    );
    return cityId;
  }

  const inserted = await client.query(
    `INSERT INTO public.cities (city, country, description, cover_image, latitude, longitude, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id`,
    [city.city, city.country, city.description, city.cover_image, city.latitude, city.longitude]
  );

  return inserted.rows[0].id;
}

async function insertPois(client, cityId, category, items) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    await client.query(
      `INSERT INTO public.city_pois
         (city_id, category, name, description, cover_image, latitude, longitude, star_rating, book_url, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
      [
        cityId,
        category,
        item.name,
        item.description ?? null,
        item.cover_image ?? null,
        item.latitude ?? null,
        item.longitude ?? null,
        item.star_rating ?? null,
        item.book_url ?? null,
        index,
      ]
    );
  }
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cityId = await upsertCity(client, SEOUL_GUIDE.city);
    await client.query(`DELETE FROM public.city_pois WHERE city_id = $1`, [cityId]);

    await insertPois(client, cityId, 'place', SEOUL_GUIDE.places);
    await insertPois(client, cityId, 'hotel', SEOUL_GUIDE.hotels);
    await insertPois(client, cityId, 'restaurant', SEOUL_GUIDE.restaurants);
    await insertPois(client, cityId, 'activity', SEOUL_GUIDE.activities);

    await client.query('COMMIT');

    console.log(`Imported Seoul guide from ${SOURCE_URL}`);
    console.log('City: Seoul');
    console.log(`Sections: places=${SEOUL_GUIDE.places.length}, hotels=${SEOUL_GUIDE.hotels.length}, restaurants=${SEOUL_GUIDE.restaurants.length}, activities=${SEOUL_GUIDE.activities.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seoul guide import failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();