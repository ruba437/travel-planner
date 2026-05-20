require('dotenv').config();
const pool = require('../db');

const TOKYO_GUIDE = {
  city: {
    city: 'Tokyo',
    country: 'Japan',
    description: 'A vast, organized metropolis that rewards exploration. Tokyo is famous for its seamless mix of hyper-modern districts and quiet, historic shrines. It offers an incredible range of experiences, from the organized chaos of Shibuya to the artisan coffee shops and craft boutiques of its quieter neighborhoods. It values both cutting-edge innovation and deep-rooted tradition.',
    cover_image: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?q=80&w=1744&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    latitude: 35.6762,
    longitude: 139.6503,
  },
  places: [
    { name: 'Ginza', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMya2N48gTFFqaT29s16o1zcS8zdd49eUDmQN-KCjKvAb71cEqyPlGMwzozDtT8YhBQvTlf5EONRaPYR6S3sCLG-5sK0tdFjRyZnRkGwHw4sH0w1HWtVSISOkoHjz5nbhGPNT3OPDAora9cjw=w750' },
    { name: 'SHIBUYA SKY', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZM8CYVx6mmnKukBLHDQyTjaaDYH8CAbOIyGDVlZB3goKsTDRx2VQolNQf40Zm2uxMsVseUBe5eQ_XG11lk0Tox9AW9T9mW5uf7RoLGvoleDAsxSYzMBO_wuxwvUDo__EEflOyaX9-hT0xWg=w750' },
    { name: 'Ghibli Museum, Mitaka', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZObYTZzkAhCuobEXidKugQVLi7jfST7mDGPcSw1s9rbznpDi2YkPFLL61jEonoAnwimcrOi4W48WjkRYevdp_LbOhh86adU-Nt5BgpmZAzzYWkW4kBcbJPXFAVZ3JIHs80rJHnhJCakcoyK0pg=w750' },
    { name: 'Asakusa', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPtBrNh4imOETmbXqwZq_z0YgJxDMwk30qiF9Li1fiEjpcpNooBrgBqoHXRj_pBh4LSTkGzmvLYNhzkBFCaVVxzFyYWddIHKkPLX3C3ucGImY3VPIkX0BqIShLLyXlh5HyNU9sXDXQN7B-C6g=w750' },
    { name: 'Tokyo Skytree', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZM6E-YhO9vE6eC-qoTia4sgkhVhoEPouR5hVF67IKBNOenjGn_dEGeajNRipAGCZL1iqH3d72gTVQ4XxQAw8Jy1OE3jHNUffsuc1KSTo__paynaPsMm4aj09YZt80KBgpZuiwf42HMsk8vA-g=w750' },
    { name: 'Tokyo Tower', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMQ2R9G0msyKr1USA_UYhr4le93ept247NFUaFCGY8ZBJ_SPqYk49ZzUi4oXpMCwwu5CwjVHPY0XFUbagtm7swbM1Wl7gU4Zj8D0m9QIfh6peqXV-IYWWKdMH0PVoh1HndlAGIzr0D59BRJZw=w750' },
    { name: 'Odaiba', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNEPpv5qjz2N1-YFi4X0SztnA_Rwzn6fubj1NBdHiHiajpxjG40zyJtFoRfZViw3wt2Dml9_h2EDX3u8kFHkwBWhymZM-PtiXb3xnYrPflqanuFZ_atMMQ9v4CUNt1R4VhYlUjXT4vbBBkPKrU=w750' },
    { name: 'Imperial Palace', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMr9ikH39Ndzs9DDQaQda29mDWapqfeitJcqkR26HNwJ7ceK47l8y-npVS1dx_vz51Jg6xorXq7RHYALQWjyDZspCAkfCY-ZPzwzjWPM7e0QD6-ay67OR1kl9K3vttPByIJK89ZldGpJ8mFtw=w750' },
    { name: 'Akihabara', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO73322MNGGShiRDrQNLlv4FpCqhpgmxUh1ubIO0zF0yjdGL9grjJjUZJsB3cFjiSGWeRdVg7Mt87iMm2mhRET3VpATd3aBaGTfbJklMsVD0t2LZ37pOKkMZWPd_XShttj0kLd6K21VcDILdA=w750' },
    { name: 'Tokyo Station', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO_JpfA1S5mh6gwjVQEC5PI0RMo6mo7wVNPlNiRi5uc6Lw01J3VkzdOSOiNJfAH6JmBj7CBI3vwSryfMWfC0P4xj4ha9jwEpiO2hMnsSJF1zVhqjIdGtyHrJ1Xd0I7mOHj1j_yVsb3jvnJn=w750' },
  ],
  hotels: [
    { name: 'Hotel Knot Tokyo Shinjuku', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO4qFGB-lzLGPOBUXSBwMWETaGxS6fJkqUDwy1NMC73HA-Pqg14HfvcqgtaPIrvLw4M_hImQGPn-VKpQgWMf878PaShGMqCuiAxv6GNov14EMUcON7PuMjqEm5hEYauRMHFbhG2Y2QrXZ6SRA=w750', book_url:'https://www.trip.com/hotels/detail/?hotelId=17015322' },
    { name: 'Shinjuku Washington Hotel (Main)', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEuSmiftRFLkWiurGko9sAeiFBNlqaz35mIHC2i-5IaaEB_XxkHHF9RShS2lVg5xPbRTXFcT-Et9LhrM_3F3_ia8E9pWJIKrQ=w750', book_url:'https://www.trip.com/hotels/detail/?hotelId=994914' },
    { name: 'Rose Garden Hotel Shinjuku', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqG1tIc7zdfStQGz_Fr0uO0SPWg51R0mXGsP6-eMG5oQ7S0sxSTXLJZDvPvoJrZtpMc-7GieA4TQg6q6g6sjLkqL6-BXWrY9fl0=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=688577' },
    { name: 'Ours Inn Hankyu', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNRFs7Sryx-h8-e_AciG-5LGlhqBCaJwFztI6gXi45v5LrQHvnRSciVbDMtnxyihkpN-k8oLB5kh2GQ1SyYMqxL6dCig-2Gi7nDi8NZ3ArKv5uV2BkTSbJUWnRQO94N07DK-Vfa8I3Wmi_rYA=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=11870008' },
    { name: 'Super Hotel Premier Tokyo Station Yaesu-Chuo', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGcwhbwaGOSDxFiA9TTSUbDhSGIMwB8yf1hsscMySxyhqtYQ3XfozwVsUhTmAtd5Q9RnduU8UVGz0gTVcWM9SWzaco8yr7FBt0=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=2695279' },
    { name: 'Super Hotel Premier Ginza', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqE1-bwZffrusGGlYVwHF1KPBh3Z2QpFTN6ky4HuW9ExSE8xHXVstMtL4amWM-PWyHy-59zQGXnILnVk7s0GLMva1lhKaizhlYI=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=23207244' },
    { name: 'Mitsui Garden Hotel Ueno', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHVSmiSxHLm-z3L3y3fajE9FgaNxajSPI8fGt3WhNoj_D7N-BUhDO6GniYsiEvdaZ6QnPe0hzOFEuQy7E_Ri9-p-LcokdSjpwg=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=688243' },
    { name: 'Shibuya Tokyu REI Hotel', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGvvjePa3TL4rl__r0jWArRLIuZ1PxlApUM2srT705yQF4Qa9Ba2OcYjAADFu11TA2PvxN2Z-lNCMOIsktuJQgchk6hWspLJ94=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=759797' },
    { name: 'JR East Hotel Mets Ikebukuro', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqG2lFYcZwxTQen6tfbYjTWyaoiak3Tsjn2yvQ_PZMNd6vOMl9wg31VdtTYyWq5Ek_fAyrxrTOtowe7K_HZZaPxtxAiyjbkk1gs=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=1489108' },
    { name: 'Keio Presso Inn Ikebukuro', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOe1O7WpNeTm72mcPysTTZZoDtAbKmmzUoKotFgOA4OvBuqxiLWucTlTha6VuM87vdn0RMv90EY3tgM6nYbmCzjFw-M2LTDqXJnvhoqv2JvyqZ-ReMOSMy2t7BB5rF_cM5Y8yzZf9bzZ3A10X0=w750', book_url: 'https://www.trip.com/hotels/detail/?hotelId=994538' },
  ],
  restaurants: [
    { name: 'Myojaku', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGfQ0EL1FaOXHvwBo75Rp1Xmc01E70LDyYxHwxYSZP1-BXE6VddjdnBjl9-MdhDARY-HMu75qKiE5HrF3FWeBZy5H_mSEIDmFs=w750' },
    { name: '西麻布 鮨 真', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOsK6loALdi7K_MykZbag2bqklwNyJERSag2GNGOej4-1KFsQA6bfoUqcyqoMt97qv3y8_mP6V2_IbUXFKnzb8a7NEhJtBm021zXV2f4QMbWdpKOpFEwLJ2EeXE_cIFlPEDvHam_TohRK4tGw=w750'},
    { name: 'Hakuun', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqG7_OrFZ6xbik5ZJxnvWh4UdojcAWlgdnEPRZPq0iUbq2bgxVtUmzahwfZ8achXNurrxWckEvZB17NWFAyZ7p38gBP-otQH-EI=w750' },
    { name: 'Ensui', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPh8Ry-fG8_oJNFyODLxnKdWRiUIW_8-R8_DjaseNjEqFH_lRmdprZ1krnRx3Oo4wJqwOsVbFVmPITBrdMKeaGEeIVoWDuzFEmI4sS4PYEQXA7pQjMtAiC4edIbWJeCca0FbB5BZu-H_zS2XLfvspfz=w750'},
    { name: 'KIBUN', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFsZUMWolJFR10pyBM3pl-nsEMEX3mMD-GxZez6iA3fiizQD5b39RytXePeeLUrtyC-nVHFPjeUC8AcW4eTQiUV9ElLazyUdNc=w750' },
    { name: 'Sushi Miura', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOW8bLNq4-uQfUdPe-uOOo_pTUcHa95rOO4qQueHfV2z1IXY9JtLuihnoXHDJQHo2uRbNxYD3_WDjqUWKXLGDAhydTPqICLyUfAu4HBlcvrWI36DhbrOphP3LEytEKVvYTXzp0vdtgmSQpsWPW9vxFH-Q=w750'},
    { name: 'Sassa', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqH3X8J-K9BGoULz5t6lBRV_LlfWBbU0aMSvcQKbY4nUSa9YcLQelWxJ8FZlp1D_CYlw__LmFI5iAaG2rxj-JBYUYlh0AU7UqJY=w750' },
    { name: 'MANOIR', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOmjdMGLyTB2E3sHQm9MT6j4ivwCERnpm4qK1tbTjKcA0xjyDuG_7didYWF76j-tEXkfYx9Nr309WIHyszrJH-ia04HPm_hyd9kaT3z1U-bqsQKciL_CW3u-KSQ6VyWgVa5z_7Qhd-xnd_X=w750' },
    { name: 'Sushi Oya', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFrvVcPkxjB8CVmcTOI0ykEmkQMgDSeC61hNqc-ynGEO1b8FbN5zvcLjkpOKEg1rU64BNXuF20ECjp8dYgSP47k84dYFWwcTjU=w750'},
    { name: 'Takumi Tatsuhiro', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqG-nqXGFYbPYh1YTHRGQ0_q2f62FA1OOrdTmFXPX4Yu_PjjYFcFFHgWqygt373zdniazZAHCTkvOSMQgjzizktFQjiQl2x-Cow=w750'},
  ],
  activities: [
    { name: 'SHIBUYA SKY', description: 'Rooftop entry for panoramic Tokyo city views.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZM8CYVx6mmnKukBLHDQyTjaaDYH8CAbOIyGDVlZB3goKsTDRx2VQolNQf40Zm2uxMsVseUBe5eQ_XG11lk0Tox9AW9T9mW5uf7RoLGvoleDAsxSYzMBO_wuxwvUDo__EEflOyaX9-hT0xWg=w750' ,book_url: 'https://www.klook.com/en-US/activity/70672-shibuya-sky-tokyo/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Tokyo Disney Resort', description: 'Iconic park with Disneyland and DisneySea.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPhB9Er6u8Ad3uBkwH2hhuUcqRWzqtvbvwk-t8_8Jd65lxhWvsUfoaOC7mMWs33VeJ5xN5KUlOWr_7gTVU1hR0eZLqzDleqqvDVFdecmANLcajm9-L9SRdXs3QkAbah9vrSZAvjOEyoLJroohhUOxVB=w750' ,book_url: 'https://www.klook.com/en-US/activity/695-tokyo-disney-resort-1-day-pass-tokyo/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'teamLab Borderless', description: 'Immersive digital art world with no boundaries.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPpRDpYqvZgIwcCrjer7rW3KqGMgWZqkebtx6YPXR-M3_u5SaOe-v3EoluPuXwckNDV3V9L9EslkfTU4iJOMiM2tIF0A8_ktS09E5VdKb4M_uDHg98GfO8DMsoou4IQxXabLMIbhLda69GwHQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/20707-teamlab-borderless-admission-ticket-tokyo/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'teamLab Planets TOKYO', description: 'Body-immersive art gallery where you walk through water.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZP2taPoB9B-KdUpUHXjYhwic9D97mA-rv_R7k_etHS6y7CsAKWSsUNxzNvSTWaA_bZrvp8IHEupVs1PyttQruTxO8SrTOLSe6eI7LK0TM4tyZBlFIpd4tO3LaMy_tCwNBgCUbKmMRTrHdoO7e0=w750' ,book_url: 'https://www.klook.com/en-US/activity/25300-teamlab-planets-toyosu-tokyo-ticket/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Tokyo Skytree Ticket', description: "Access to observation decks of the world's tallest tower.", cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZM6E-YhO9vE6eC-qoTia4sgkhVhoEPouR5hVF67IKBNOenjGn_dEGeajNRipAGCZL1iqH3d72gTVQ4XxQAw8Jy1OE3jHNUffsuc1KSTo__paynaPsMm4aj09YZt80KBgpZuiwf42HMsk8vA-g=w750' ,book_url: 'https://www.klook.com/en-US/activity/41352-tokyo-skytree/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Warner Bros. Studio Tour Tokyo', description: 'Behind-the-scenes look at the Making of Harry Potter.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOcVc3d3OGy2IS7y2kuWPr1kMXqYGUvj5NcK69JFr858Bznl4xgaZwQpVqG9Fc242skm5loOnIMe7pOaBc8-syOGLxWdQW801Semy1X9frhbigKB3m6-kS8Ec1HlqRq_kVp91wmTnSckGBE71_C0AH0VA=w750' ,book_url: 'https://www.klook.com/en-US/activity/84374-warner-bros-studio-tour-tokyo-making-harry-potter/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Mount Fuji One-Day Tour', description: "Scenic day trip to Fuji's most famous photo spots.", cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNYbf5ccS0htsNvTKk0sfKWBSKlIgmuRgQufDjgr_X1vVmqQ60pYUrfQrq-F_jyeyJzTLjkENZdFqjUn_WQ_VbC6I4cemeo1ijq_KzNj4sn3oBSK3XPZvgxDdN5BJhIX38MuGhWQ8F_Uc8-=w750' ,book_url: 'https://www.klook.com/en-US/activity/93901-mtfuji-one-day-tour-tokyo/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Tokyo Tower Ticket', description: 'Entry to the observatory of the iconic red tower.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMQ2R9G0msyKr1USA_UYhr4le93ept247NFUaFCGY8ZBJ_SPqYk49ZzUi4oXpMCwwu5CwjVHPY0XFUbagtm7swbM1Wl7gU4Zj8D0m9QIfh6peqXV-IYWWKdMH0PVoh1HndlAGIzr0D59BRJZw=w750' ,book_url: 'https://www.klook.com/en-US/activity/4911-tokyo-tower-main-observatory-ticket-tokyo/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Roppongi Hills Tokyo City View', description: 'Stunning open-air views of Tokyo Tower.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZP7nPwWiLjVvrPP7JA9mKfHBJLYVqtW4Hzr_Un4Yc-EStyEGPT8bdRnWXK9M4W3G7tUs8T0EEximI4gSgTx6qN43z_VfhaXfclL0jfN6ux2c4NEGQCctRiZMnVpRPqtmEt71g_bbvgu12POp2c=w750' ,book_url: 'https://www.klook.com/en-US/activity/15762-roppongi-hills-observatory-deck-tokyo/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
    { name: 'Tokyo Chiikawa Park Ticket', description: 'Theme park for the popular Chiikawa characters.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPg0RTDrxxFrN2whu1YC6Q31cZIOlP-ZRl2pYG69O0Eon1KJRmQi1D35FUd5__psJOmgLTSpTrOBafad71hOON8rNEgnOWjiG8fXu3NHLP7PRH7m0AMFy42NFRrQ75p3P6wEGKD6X-orcIxrMrQ-dp5-Q=w750' ,book_url: 'https://www.klook.com/en-US/activity/171099-chiikawa-park/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term='},
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

    const cityId = await upsertCity(client, TOKYO_GUIDE.city);
    await client.query(`DELETE FROM public.city_pois WHERE city_id = $1`, [cityId]);

    await insertPois(client, cityId, 'place', TOKYO_GUIDE.places);
    await insertPois(client, cityId, 'hotel', TOKYO_GUIDE.hotels);
    await insertPois(client, cityId, 'restaurant', TOKYO_GUIDE.restaurants);
    await insertPois(client, cityId, 'activity', TOKYO_GUIDE.activities);

    await client.query('COMMIT');

    console.log(`Imported Tokyo guide from ${SOURCE_URL}`);
    console.log('City: Tokyo');
    console.log(`Sections: places=${TOKYO_GUIDE.places.length}, hotels=${TOKYO_GUIDE.hotels.length}, restaurants=${TOKYO_GUIDE.restaurants.length}, activities=${TOKYO_GUIDE.activities.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Tokyo guide import failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();