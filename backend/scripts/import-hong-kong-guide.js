require('dotenv').config();
const pool = require('../db');

const HONG_KONG_GUIDE = {
  city: {
    city: 'Hong Kong',
    country: 'Hong Kong',
    description: 'A high-energy hub where steep mountains meet a dense skyline. Hong Kong blends traditional street markets, historic ferries, world-class museums, and high-end dining into one compact and fast-moving city.',
    cover_image: 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4MDMwMjZ8MHwxfHNlYXJjaHwxfHxIb25nJTIwS29uZ3xlbnwxfDB8fHwxNzcxOTk2Nzg1fDA&ixlib=rb-4.1.0&q=85',
    latitude: 22.3193,
    longitude: 114.1694,
  },
  places: [
    { name: 'The Peak Tram', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN9OJZYfLed2jcGd56Q0HAXFX3Ir1cAI3Q4Tugt0977yxt3g7Pd01PVaBMmdMBkHdUleU4ykV3kYXRn7d1zaFR2sQG1eN94kXGyGwDqS6K8AWrvB3JaQI2YMcOD-exNJNh8FiChlO9NAe2-=w750' },
    { name: 'Ngong Ping 360 Cable Car', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMP6TF5GICujGaOhahlDNc3puz2cLidMbonU6trD6OF_A5H-fZy4cCISVTBa1AM483fFFhVvDu_7kD5WyH1sOJGpk3IiMQL41XK8BFDjLHRZ1mDnbbURpV4As6SzUaLN7a8NkJDwoPbgrU6wAx2G5UM4g=w750' },
    { name: 'Sky 100 Hong Kong Observation Deck', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOswzu2CI5P0nq74qQQfgDnuF-lGAev0Fyi8wEatOmpkRzUqTjfvJ1S4GCvsTMmgx2nlwcERxIPlY981MTHE9osOFMC913fcEEweDe2mZkoZIyG21UuydwJCaSHsg6PurXwg2MpyrTQd_Ujbw=w750' },
    { name: 'The Hong Kong Observation Wheel', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFYK4e-oCZIvco3LvXR0MmnoL0sxVFd2DhD066w-eQwMfeCxyHUVPbd3BjdOrzdO8xvKrDc6xyky6pn2cdPWjEOi5024FqQzl8=w750' },
    { name: 'Hong Kong Disneyland', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOQGnpTPYmcDqg4J2eVrndxCC_RTdKbvLdkhebIzN2atZIauZzdtb3s-Myzr8s-bAv7eqzSBZsgAFLwyJs8P80RGnjVXW20PwVL2JpNJ5PC0mJyyT0SsiG2-eA0N9by_twcUJGYFurdbXxk=w750' },
    { name: 'Ocean Park Hong Kong', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOZTK9sss_kKpC2eyomj1ZEHCTWFjTfThTR0sk2BqPhb3B_BOoi3xPf320ByHo_h-ell4VCowxxNpkmB8D2lb_O8DJV8pNGgO09slQv3B2rrb2chzHwpkr9_0WLD8d8FOynctFq5g8dwz_Z=w750' },
    { name: 'Water World Ocean Park Hong Kong', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGzK8be8sKxF_QK1j4WPH7330kNXdOu71R7DwNsxAft3iX-UtQT4r-665Wg7ccgNkmP8Zk5-TiEhQtG_UQAFc12NakjO5Xbs04=w750' },
    { name: 'M+ Museum', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNDS8TZTUB6I5w_owa2pfCpMhNJwKHNqh9u8Vu8nHKWUO8GY_PJvg4C8L1TudbHRSoLaokKooW6xDhMCErjfF_-UfpbuUq57KlGZiiMf62ZnWIy847vs0Xoy5MIWCVPu20AIswUikUwY78cq2c=w750' },
    { name: 'Hong Kong Palace Museum', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMMgDri0tVGe_whQmHL6wOTI8AXPbUAcuthRvVZotmM2pSoLCsl6hd3ZhpwginahEOX8PHeE4-NSoN921AAt9yhqbzsmf9w8tzWL0VD1pypHQxVqmnqijvJjAc5ePZEuhBpO8ftFA89smByFAI=w750' },
    { name: 'Tai Kwun', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNAqKbLzcR2DOVbrUPUyvme95ao5JF5tlwBuLdGtYARzhm2kudQy7Yx6eJEGSJ6X_5pdp2vCp01EPlpSj6fJWieA6HXnqbV4grhjDxRq9N4T3CDw_clRY9MPDRyat6MhSE-CRVe7T1M7yUvdMc=w750' },
  ],
  hotels: [
    { name: 'The Emperor Hotel', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGIUCIEV4MjcCESalzn62USlBMCh6XKTGrbMVs6GhVDh1yCP7PVUrsukGpUJ_mvsGE-NOs74p5auiTAyu4h1oF2BvnXJEbXCQc=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=12543906' },
    { name: 'Hotel Indigo HK Island', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEXsJSv87iv78B6ni89O76TPFxmqygwhcUrrP5JLbeRCXFmpLS-Zynu_KkiP_e-qWAMHYm1b_KzlBlUdkM5txLKNQJhD29LUXs=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=447607' },
    { name: 'The Arca', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGTleOBQuAXCgNT16bLqP7BNYhFhP43SaH7J8M3x3fIKhYdudpESgcvtb28nmQWMQmHA_WKCtLst8Cud7yoczazK58ZVAzX9pY=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=80400156' },
    { name: 'Rosedale Hotel HK', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqF8YytzdQRx-1mIrksfpQVzxAuqrmwal0ZRHnPRv7bY5x1J4uVyeAI7zXF0BmfajMoyKYWz2oi3I8z7vlcEHSs0H-Ay6eZQaSs=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=428254' },
    { name: 'Best Western Plus HK', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPOLWZCOXcfLgJT1N85TEmRelYCEh29LuB8JveF1YSbWEV9_Yqln7Gyf8_XbzPALLnCH36SWFeJgUQf_hil4JZJRmdOW5DgpV64AmAlyw47jeskwRIzKy2pdl0m2XtM-Uclx1CWO8IIrr4gE-c=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=425087' },
    { name: 'The Kimberley Hotel', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMBMDiHrIGov3y4qriT5Cm1xMXXsAhUnpSm0EnET43tpZjloiFlN1RpjaACqfyR5gNFiVwCg2x4szQiqOuR1WbVyVrDtRIW99r_sGIGFS6ZOmOCwG2mUul8ytJRN3mw7ZW-Z3lJlg-hCMF35A=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=425443' },
    { name: 'Harbour Plaza Metropolis', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEn_Xcx65rTKuiCkMZPYA6Ykl8YfCajmhxh3q10sm3ZF0qCSnaGXxOImPWKX27WUMcLjnY8eTlBfp0iw3R9ixEObfCuop41Oog=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=344975' },
    { name: 'Iclub Sheung Wan', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqH2UunKoBGct7kkJz79XDjXFni1R1h8Tsrs57SsaoTSI4G3hcMa1tiS4869n6tVc_9mftU52HSmX0e6S0qpy_zNUOfeZf12X-Q=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=968753' },
    { name: 'B P International', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqERMIRhO7LelNHu6QI1c8rnS9_0Roy002X4_Wmj0bWYdjvmBTunA3tK3Sq_3LPg5JFg9uk-_WYdLX8imJvf3vjur0_oeQzlXp4=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=436496' },
    { name: 'Metropark Hotel Mongkok', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNtiiDEnDV6pc72QxeA_QKPJ2Ygudz-8EJ68jniHibN-ffO5Kn97AjQr_iRdhqAdza1v7PTLd-dkzILOvMOMnRJotizwkvrh_ZbpGn-I1kuPsth9I6E4y1JWmkqxLhm0p4E-on-eTqig4c4LA=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=344970' },
  ],
  restaurants: [
    { name: '8 1/2 Otto e Mezzo - Bombana', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNjqbq9UMYQgngQlg7OZ9-xC6LyYM-3LRZf6Ivr2LQCIFaUivLF79FXyzNGQVqhcoOlHdXbF_M4gMn43ip03VEr2sNBX_reo2hmXNviHApxle-w12-YjmyXfLPIcPxjglJ1yB7p_2SQezkcDZu3WY-g=w750' },
    { name: 'Amber', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHu4sY4MeBiq4lbVKyoZpoMmElP6uuXloj6G14WLDpHKKzOWUihCliiQuHeyt2Rsew_FQvMQR1mNJn_g2VzucZftIwGVjPF-4w=w750' },
    { name: 'Caprice', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGJe7o3O28-ZQ5CRuM4OT59M-PAp6ANlIfrT-z8Wws2jvt_g_mTQKfSpZf__a2tT-WTA36cTaJmvLFqZaSeSv1eyinkKNt52Yg=w750' },
    { name: 'Forum', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEJwq-pEUJ1lDHn-zkiws88dl6iArw27FTE8ztBHCTFXw2N7K-W0ijcVcWzd98PVr7AhJyvc2z4m2oYNzDgJhMNeP7F-JOY2UQ=w750' },
    { name: 'Sushi Shikon', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFaxMVR7D4FWAx0IPhI4ghEfSzkkmhItMQErBBgrp_rq5qT7ITC7wDNLbRHTT16YrYva1boFWUV-f2JfvUfUex6c6kbSRi1iI4=w750' },
    { name: 'Ta Vie', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPF88A24braAcxBzY0uAdVsHG9rDWR9w0ii4-DfogBNhj85iGMMWz7jtJDxDwZS6F6f846hJYrn-wFVplrg7zneb_vxvTR3VWw8yVJSeeoywTV71TWrAGnbKYjwgYuqBbSFdAYWwO7V_RNot-A=w750' },
    { name: "T'ang Court", cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEWN2Sv7l-Zwd3KouvfTfv1dk7Od7grCBa7-oV6PVVfiyIl3urzoGyCSxUc8iPxkEQJzsMS1fALaflBaQdLzOBXH1ivi1A1jls=w750' },
    { name: 'Arbor', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEl592tD4n1FT68qt5rsMn4_Gv8H24raB0mFkcEWOPEvpb4MyznvOkYUbj9X5sdCHOLtqx-X8FNCJOxd6BhkLgHZBqX6CILtxs=w750' },
    { name: 'Bo Innovation', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOyY1ew48a1UOMuxWIzwv5rSc8XeamQY3WrRyik9OSosQUHClYfTZZCKocq7IDQ8EjkQK_jf4Jt5ykcDv4SimIrXXO2X_ceC_ujpg1jU7fUvSEoKf4IfD1r8sDS2rSNGTFxECAADAxm-Qo_=w750' },
    { name: 'Lai Ching Heen', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEEOJLsfwLOLvcTfzTNSa-0ZGu89Wlkfl0Gkx4GvQHgrZTEEd0OugHKbxyXxGUqlJn0WHqaTqFNpERho23Q8GhwkW_Bp40GnMA=w750' },
  ],
  activities: [
    { name: 'Ocean Park Hong Kong', description: 'Premier theme park with world-class animal exhibits, thrill rides, and marine conservation.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOZTK9sss_kKpC2eyomj1ZEHCTWFjTfThTR0sk2BqPhb3B_BOoi3xPf320ByHo_h-ell4VCowxxNpkmB8D2lb_O8DJV8pNGgO09slQv3B2rrb2chzHwpkr9_0WLD8d8FOynctFq5g8dwz_Z=w750' ,book_url: 'https://www.klook.com/en-US/activity/23-ocean-park-hong-kong-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Hong Kong Palace Museum', description: 'Modernist museum showcasing imperial treasures and Chinese history.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMMgDri0tVGe_whQmHL6wOTI8AXPbUAcuthRvVZotmM2pSoLCsl6hd3ZhpwginahEOX8PHeE4-NSoN921AAt9yhqbzsmf9w8tzWL0VD1pypHQxVqmnqijvJjAc5ePZEuhBpO8ftFA89smByFAI=w750' ,book_url: 'https://www.klook.com/en-US/activity/73590-hong-kong-palace-museum-ticket/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Ngong Ping 360 Cable Car', description: 'Scenic aerial journey over Lantau Island to Big Buddha and Ngong Ping Village.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMP6TF5GICujGaOhahlDNc3puz2cLidMbonU6trD6OF_A5H-fZy4cCISVTBa1AM483fFFhVvDu_7kD5WyH1sOJGpk3IiMQL41XK8BFDjLHRZ1mDnbbURpV4As6SzUaLN7a8NkJDwoPbgrU6wAx2G5UM4g=w750' ,book_url: 'https://www.klook.com/en-US/activity/45-ngong-ping-360-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'The Peak Tram', description: 'Historic funicular railway with panoramic skyline views.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN9OJZYfLed2jcGd56Q0HAXFX3Ir1cAI3Q4Tugt0977yxt3g7Pd01PVaBMmdMBkHdUleU4ykV3kYXRn7d1zaFR2sQG1eN94kXGyGwDqS6K8AWrvB3JaQI2YMcOD-exNJNh8FiChlO9NAe2-=w750' ,book_url: 'https://www.klook.com/en-US/activity/765-peak-tram-sky-terrace-hongkong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Hong Kong Disneyland', description: 'Magical resort featuring multiple themed lands and family attractions.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOQGnpTPYmcDqg4J2eVrndxCC_RTdKbvLdkhebIzN2atZIauZzdtb3s-Myzr8s-bAv7eqzSBZsgAFLwyJs8P80RGnjVXW20PwVL2JpNJ5PC0mJyyT0SsiG2-eA0N9by_twcUJGYFurdbXxk=w750' ,book_url: 'https://www.klook.com/en-US/activity/39-hong-kong-disneyland-resort-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Hong Kong Open Top Sightseeing Bus Tour | Temple St', description: 'Open-air city sightseeing tour across major landmarks and districts.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN_oym32aXfUSkSYV0H7a7yApcHVHnJYUhrYFelMLuRkkDlMAXZou3FvDpJw1ojKCZz3922n6E1YZz1rtOif15POpFoxDomIcAbGSyVk-38fItfDb8vg5RM6NPQtmVCJQ-JXHMzwdV9NZ9VyOIvuBvE4w=w750' ,book_url: 'https://www.klook.com/en-US/activity/122582-open-top-bus-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'M+ Museum', description: 'Leading museum for contemporary visual culture, design, and moving images.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNDS8TZTUB6I5w_owa2pfCpMhNJwKHNqh9u8Vu8nHKWUO8GY_PJvg4C8L1TudbHRSoLaokKooW6xDhMCErjfF_-UfpbuUq57KlGZiiMf62ZnWIy847vs0Xoy5MIWCVPu20AIswUikUwY78cq2c=w750' ,book_url: 'https://www.klook.com/en-US/activity/77795-m-plus-admission-ticket/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'The Hong Kong Observation Wheel', description: 'Large Ferris wheel with views of Central and Victoria Harbour.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFYK4e-oCZIvco3LvXR0MmnoL0sxVFd2DhD066w-eQwMfeCxyHUVPbd3BjdOrzdO8xvKrDc6xyky6pn2cdPWjEOi5024FqQzl8=w750' ,book_url: 'https://www.klook.com/en-US/activity/18856-observation-wheel-ticket-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Madame Tussauds Hong Kong', description: 'Interactive gallery with lifelike figures of global and Asian icons.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPlrmmFusmFoerDbLnFGwV_wHICJTrR_OKmNkQNGZn0ChrUptuRVQgz8lnYkBCEvwaEEzuecBSJr4luZBWoqHYoVKe6wlNb6Bii5VoXKGb9XtpANzYeBqKRW16gsYKC_-g2GamBBzvf6heG6w=w750' ,book_url: 'https://www.klook.com/en-US/activity/42-madame-tussauds-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Aqua Luna Victoria Harbour Cruise Experience', description: 'Traditional red-sailed junk boat cruise in Victoria Harbour.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHa9OWRkFh0oTZmf8izUmnjCW1Qdf9WFzMOKpXoSx06GuLzzqk6ySHguup14eEhHFS_6ooxwNxpZWqxi2vg9rwrgJopHRTMcGU=w750' ,book_url: 'https://www.klook.com/en-US/activity/659-aqualuna-evening-sail-hong-kong/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
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

    const cityId = await upsertCity(client, HONG_KONG_GUIDE.city);
    await client.query(`DELETE FROM public.city_pois WHERE city_id = $1`, [cityId]);

    await insertPois(client, cityId, 'place', HONG_KONG_GUIDE.places);
    await insertPois(client, cityId, 'hotel', HONG_KONG_GUIDE.hotels);
    await insertPois(client, cityId, 'restaurant', HONG_KONG_GUIDE.restaurants);
    await insertPois(client, cityId, 'activity', HONG_KONG_GUIDE.activities);

    await client.query('COMMIT');

    console.log(`Imported Hong Kong guide from ${SOURCE_URL}`);
    console.log('City: Hong Kong');
    console.log(`Sections: places=${HONG_KONG_GUIDE.places.length}, hotels=${HONG_KONG_GUIDE.hotels.length}, restaurants=${HONG_KONG_GUIDE.restaurants.length}, activities=${HONG_KONG_GUIDE.activities.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Hong Kong guide import failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();