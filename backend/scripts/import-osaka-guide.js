require('dotenv').config();
const pool = require('../db');

const OSAKA_GUIDE = {
  city: {
    city: 'Osaka',
    country: 'Japan',
    description: 'A welcoming city known for bold flavors, friendly energy, neon districts, and easy access to iconic attractions. Osaka balances street food, riverside walks, shopping, and classic landmarks in a way that feels lively without being overwhelming.',
    cover_image: 'https://images.unsplash.com/photo-1589452271712-64b8a66c7b71?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    latitude: 34.6937,
    longitude: 135.5023,
  },
  places: [
    { name: 'Universal Studios Japan', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOYaRU0eVGQW9-yiEPt8t55Nr3UfMflR3LoOnODSFlTnHRnXV_MxiekatcDW00Yzm-GPgEe6l46K4zTccldziYbFUv3LCJsQdMAHYL5cqvbiZb9PR1e3mqVHEe_JwMGWyBFD35Iv7H-nQf1zQ=w750' },
    { name: 'Osaka Aquarium Kaiyukan', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO5Mz3CRXOoq09vJnydw6uAKWHumsseRvz_ZfmP6qb6QZUBi7qVpnGA2h6y_2Mi-iFpoPpq1M0ES7rD9JGCm9vKv1tYfTqd6qs3W35VtRkaUnkufAvRRblI9SE10oKsiYcVK2cI1t0yj4gsCg=w750' },
    { name: 'Osaka Castle', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO008zLs2HoxSpq4qknuQHIQjFZd3WX5ATckKEvhl8Nslw8RkK9K_j_5FmR710NIwKWQE-YoPNWS9bN3raG6QUgX5QRs7crv6Kh2JP6l7E3hrCUGd-TfnOfLyMMu3ew1qQPSOZtAmkK2s3lHQ=w750' },
    { name: 'Dotonbori', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNCToDwNe-ybggTS19sPbB0qHEP3OI7Sr0-oHFxUGzx8TqBBhjCBvcrqbLjoi4ovfBgRjvl4vx_oS6M7ufDtaAB6PzWjaRtyvfV8RRk9j0dsE9a1T02uyU1qxJbLdZ6q1ifngIeBjMZ3i6_dA=w750' },
    { name: 'Umeda Sky Building', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPhshwMC-gVLaCZrJv30iA8hm4QLBUYogZMUFzGzctNqyRP97XipJs3Y6hGcCW26BTvTG5GVzowy5qYzakB7728VR7JhoON-Ky1oGXyoB_PQn82zSHbb1kYYTOVvojsTfHIeta7cGwW3tU7B7w=w750' },
    { name: 'Namba', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMPzEsPLeBcdRKIEK9QaQ-eyx5uT-jWHYn3YqBfR4kkRF63lQUrVG-NohfZZpVA2JllrOH2BpilmnzF2vpq3RXk8kbylQQNDhCP422-OwxoJD515XzYS7uvtzvul3FJrVM_BnfxvbbdiIC7SQ=w750' },
    { name: 'teamLab Botanical Garden Osaka', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHMnLgdmHQbqqyFCHrthNEktHP-SwpAU9Im2D30ns0kkg_BKwG6slNaEm_NaFSUHU2K8sFquB5cu8ofZs0wgnIElwMS_ReICuM=w750' },
    { name: 'Umeda', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNaGRGumwVfnDtlKD98PmMkl8P9DfmJdoCJOpqelw13Y3dAeo-XyNGkv10RAtyOkxYTiXJXL9dHuJnVmBs9Ymd92sOmn9sh2UctXTkh88iC3i0P2rqi4WgqQWGzlT1ZzTFiXHzLaCW-erRH=w750' },
    { name: 'Tennoji Zoo', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMgIk3TCg-rMXwVzsixezYFvS2ToKhgbiiCOGW9Xa8u9B26_EBbpo6e1w7wCtEN4QKTtFOjW09ddPR9Lobwr3Nv9CujkH60QxIcdIWBLOLCXMizj6EnCFIKEDHZIcOqz42-7mMY3k4He6o0Sw=w750' },
    { name: 'Pokémon Center Osaka', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN5ExU-vJnkLDlLGSiSP9s3vQlrmNPwd2o5ssXk4Llnz6ouPNIZxmqB4O-Xca0tGmtt933wAGcSbaSs-YLK__Do5h9Q7QLh7zeP0yAo7v12xk1kweYE1XqgzD6Z7pQ-UmZSOKI5-ueuueSiizU=w750' },
  ],
  hotels: [
    { name: 'Hotel Hankyu RESPIRE Osaka', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGBd9E63qydlo3nryjBplYRi9p5tgJCk5uowpV_jby94Vk2YivFP1PXnZPmiXC2Dn51NE3IUTpOZFA8rEO2mW20h0VH__1vwHE=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=123078966'},
    { name: 'Hotel Nikko Osaka', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFm_W-_DQWxy19F9RmorpwIDniiB45NvsVoN5ErVl1wC-Pp417vnqOwcFqsMxne0WpE5wqC4WRUM4VwNsnwuI2vFzFsa31bSg=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=688209'},
    { name: 'Dormy Inn PREMIUM Osaka Kitahama', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGcjz7XF4A59NsNuCzpHBqTBrJOW0XO8CThnuU4IQZV-yvRYUA6S4D__-aBcTjENSw699Ws6t_IzDxWDpDymzcBNX9PzdLqNuk=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=21916108'},
    { name: 'Dormy Inn PREMIUM Namba ANNEX', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMiBUM8I7h_BOH8Sji6_EA1GhmjjO5frXw2YosNXPW-XdiFCxJTOCuIWf-FkkJ92NeWLij7iQmXi99e9Gq0Y72iD7k_AHK8t2MBmjlS5HdsXeE9EYnthx19DYbL_EhIf6vo74kRbvUp4mNMIc4=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=18431746'},
    { name: 'Hotel Granvia Osaka', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHCYWz5vVii97V8zC3XeQR-WGBeL3qIVarDq6QjIcatRFi9xSxYZpa8eWXTUhwpMeCc2N5fjBt7i7fGcEy9ouZoftLRoo544Sg=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=480887'},
    { name: 'Hotel Gracery Osaka Namba', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN7yStAvR3pxZHvtLZAX-NoyvN5TYKEkM8Qgb2owfgHjciLwFHuZ-fWVRFMg01VqqxRjuY9_lbogSNP4fjFrhobsDAVfShhPoPksfFioAQkv1A-hfmaLo1S2pDyPSdeaRneSkxwW1Ct945t068=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=29903490'},
    { name: 'Hearton Hotel Shinsaibashi Nagahoridouri', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqF9IYdPoyI-lwBy4LRQ57MUYsbr8spW3RpztqJxYbeoHkoDTTudV4ViXuwrUfHJigvlLTeWaS4jmPZMg7EPaX30vPbvxVdDK6c=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=13906758'},
    { name: 'Candeo Hotels Osaka Namba', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFjcCY-4SbJ3vcAlklHex17YJFm_B0CiQlNwKHA03JAXdCH9B2WmAwWXlp5ynttNV8J3kd5M_-UeZkzitHnkBgB94FFJ0Qd4fg=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=6666605'},
    { name: 'Hotel Monterey Grasmere Osaka', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEpMn5NmNU1_qsSJNPk5NtarOnq2vvw9BKQkkLqFN4wzivz8F4xNIfs3GoeZpQCYXDRyrOsQn8mJ_RIExjuXHq2OPfEStgF9BQ=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=688216'},
    { name: 'Osaka Hinode Hotel Nipponbashi', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGpCC9hLfPd9f3LFAZQ3OjsLvUg9Yr-8gokKveoiEefYaK97dg200979rBX2FvI5S7r9tQizRptUbX3MBvqJV9nRL-Vgu6-aNg=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=10836901'},
  ],
  restaurants: [],
  activities: [
    { name: 'Universal Studios Japan Studio Pass', description: 'Standard admission ticket for the park and its attractions.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOYaRU0eVGQW9-yiEPt8t55Nr3UfMflR3LoOnODSFlTnHRnXV_MxiekatcDW00Yzm-GPgEe6l46K4zTccldziYbFUv3LCJsQdMAHYL5cqvbiZb9PR1e3mqVHEe_JwMGWyBFD35Iv7H-nQf1zQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/46604-universal-studios-japan-e-ticket-osaka-qr-code-direct-entry/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Universal Studios Japan Express Pass', description: 'A separate pass that reduces wait times for popular rides.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOYaRU0eVGQW9-yiEPt8t55Nr3UfMflR3LoOnODSFlTnHRnXV_MxiekatcDW00Yzm-GPgEe6l46K4zTccldziYbFUv3LCJsQdMAHYL5cqvbiZb9PR1e3mqVHEe_JwMGWyBFD35Iv7H-nQf1zQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/3407-universal-studios-japan-express-pass-osaka/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Osaka Aquarium Kaiyukan Ticket', description: 'One of the world’s largest aquariums, famous for its giant tank and whale sharks.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO5Mz3CRXOoq09vJnydw6uAKWHumsseRvz_ZfmP6qb6QZUBi7qVpnGA2h6y_2Mi-iFpoPpq1M0ES7rD9JGCm9vKv1tYfTqd6qs3W35VtRkaUnkufAvRRblI9SE10oKsiYcVK2cI1t0yj4gsCg=w750' ,book_url: 'https://www.klook.com/en-US/activity/598-osaka-aquarium-kaiyukan-japan/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Osaka Castle Ticket', description: 'Entry to the historic main tower museum and samurai history exhibits.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPe3dyxfU6dPVKdlhjqs-dBizSb9T18lH0NAJCmsNRyuwGBLKEP5Azt1AjjbxzJ1d0Ivupd8dhAX4IRQYXJwYJzpEZQq_V9w-OREg8BpxJ50wwlvgge4-_OW1yXgsCg8a6jbSpAzjB7_PrJoZAbeZkg-g=w750' ,book_url: 'https://www.klook.com/en-US/activity/30110-osaka-castle-ticket/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Umeda Sky Building & Kuchu Teien Observatory Ticket', description: 'A futuristic landmark with a 360-degree open-air observatory.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPhshwMC-gVLaCZrJv30iA8hm4QLBUYogZMUFzGzctNqyRP97XipJs3Y6hGcCW26BTvTG5GVzowy5qYzakB7728VR7JhoON-Ky1oGXyoB_PQn82zSHbb1kYYTOVvojsTfHIeta7cGwW3tU7B7w=w750' ,book_url: 'https://www.klook.com/en-US/activity/35861-umeda-sky-building-kuchu-teien-observatory-ticket/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'HARUKAS 300 Observatory Ticket', description: 'Sky-high views from Japan’s tallest building.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMjR4Zsxj-2mB-TdQNUB9yR1Krz65rye4F5UwtVBPdmE2cLRe6dcbsb450waNhkUpW5A3IqLyJ8k80_RzHI013nQsT36F38sox5Gr8acrmNeQrlpOS_NMfgpkoZQYljly4MOT-W7sX8nTOp-3s=w750' ,book_url: 'https://www.klook.com/en-US/activity/2424-harukas-300-observatory-ticket-osaka/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'teamLab Botanical Garden Osaka Ticket', description: 'Nighttime botanical art exhibition blending nature and digital light.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHMnLgdmHQbqqyFCHrthNEktHP-SwpAU9Im2D30ns0kkg_BKwG6slNaEm_NaFSUHU2K8sFquB5cu8ofZs0wgnIElwMS_ReICuM=w750' ,book_url: 'https://www.klook.com/en-US/activity/73632-teamlab-botanical-garden-osaka/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Solaniwa Onsen Ticket in Osaka', description: 'Large hot spring theme park with a nostalgic Japanese atmosphere.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFRH0iZzEAZ-VwJltdTMvwvS_aq8fWgAkwodyXE03t3NS2tWRRxDBiQG2PFv3AQy_vG4EoEzUNKjjuIUtl5Sc-RaWaxVY6o4t4=w750' ,book_url: 'https://www.klook.com/en-US/activity/21381-solaniwa-onsen-admission-ticket-osaka/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
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

    const cityId = await upsertCity(client, OSAKA_GUIDE.city);
    await client.query(`DELETE FROM public.city_pois WHERE city_id = $1`, [cityId]);

    await insertPois(client, cityId, 'place', OSAKA_GUIDE.places);
    await insertPois(client, cityId, 'hotel', OSAKA_GUIDE.hotels);
    await insertPois(client, cityId, 'restaurant', OSAKA_GUIDE.restaurants);
    await insertPois(client, cityId, 'activity', OSAKA_GUIDE.activities);

    await client.query('COMMIT');

    console.log(`Imported Osaka guide from ${SOURCE_URL}`);
    console.log('City: Osaka');
    console.log(`Sections: places=${OSAKA_GUIDE.places.length}, hotels=${OSAKA_GUIDE.hotels.length}, restaurants=${OSAKA_GUIDE.restaurants.length}, activities=${OSAKA_GUIDE.activities.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Osaka guide import failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();