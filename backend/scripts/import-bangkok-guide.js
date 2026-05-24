require('dotenv').config();
const pool = require('../db');

const BANGKOK_GUIDE = {
  city: {
    city: 'Bangkok',
    country: 'Thailand',
    description: 'A vibrant capital where ornate temples, modern malls, floating markets, and late-night food scenes sit side by side. Bangkok blends river life, street energy, and large-scale attractions into one compact and highly walkable destination.',
    cover_image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1650&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    latitude: 13.7563,
    longitude: 100.5018,
  },
  places: [
    { name: 'The Grand Palace', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPSWf4QDG-PR7c0s7MeJux6WnsJlnKu1WN1WJY8ki6A_p8Vj8IITE_LHHQsf6JHRbu_t3BaqYUbX4i9TpluL6HlYtSYGa3q2BFMmlMv3tgIlbxmnU7_yk58h3LPZ3APmGhyLx5P5Psnf8Y4Bg=w750' },
    { name: 'Wat Phra Kaew (Temple of the Emerald Buddha)', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOvJLtFwjmHeiAHVgizSCGxOvZCpn8QWxCdyXVLcjrCNuPnVMWgQ1kTw4xVVoPNReHrQwjM2eEH6jdUU14dIN0oOQgaO9FUn2Iv1WoSECz74IMek5_6Q-BvbAIU6xVRIrI3Pszy56aeDa0erA=w750' },
    { name: 'Wat Arun (Temple of Dawn)', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPHkG7f-zN1rPnU9ba3Jdp8zs2L7Y-2cPJoyDAyoBdprtlWaTm-EcH7GeyYva_df5PO4l-63rwZ6gHL3ZqlV1VEwmoBUwJHbJsPKYmts1OBN1QIzey3BUpVuGhRPgXGNLENuVID4KiPQS0malI=w750' },
    { name: 'Wat Pho (Temple of the Reclining Buddha)', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMyptjPkBLDeAXzjBkDdMgebwr7o7PzlDL74G-Mmku7pMSvuoTfnEUAdddoQc8HSTVq51KyAFCk4lKqJqQNa3WP6EjLjsJJRXTFZ_CarHe3RX-WR6xAGJxt7SEwa5es7NdbbB0lrrEVGMZx8_g=w750' },
    { name: 'ICONSIAM', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN9a-b9p1OkGpTGHJCjps7KuMvJowCAR5wfyJCcAgHILTyGv8x4r6l52PjL_Eg9JOOBWbJPXfKQVf-d-JTdfZdzCvbpF-wZxXq4Q9xhZV5UbUREsR3Zuoht-9vAO7R3MV6EF68-DO4PTeNVufZIAvrd=w750' },
    { name: 'Siam Paragon', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO15KMrkZS8SSwQH1CpwYdxjOA9dCf7KSOZyuj-_bOYqWTK_beS_uwSQO9Lv8ysun8k_zE4W2X_w1s3sLhnoKVsAT-hpStIJDbw-TgSpeG0UfH8vO4sfEM4wV-C9ia8lxBJdqgsg8kQzbWC7fE=w750' },
    { name: 'CentralWorld', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNHrOvic2RrdAjLtQWIFQmzvEqjthNs57bPp8nwnbXC7JlDPT1N0Wudz5Jour31QNQPoRnzyiFP_lwxGreH760bwlK4HO9CF60i84bdOKBtJQnIlLZ6MPG_h3OA8WLCfWU6z1zzGehoMsGrAHY0rJi7yA=w750' },
    { name: 'Chatuchak Weekend Market', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMrwi3KYHMt7JqRGAw3PDFXLLxz4h-rVj5TbQMChObFc14ty4FyV9LvZNxaf_gdHr_kh2INgN0lRmCz8EKsdrXTC13UISNRvW8lM8s8AqVDyDsyUOwrd7co8TaOaapo6I-LlflrQXyOInOcyQ=w750' },
    { name: 'Jodd Fairs Night Market', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNYQNuRMWxpIFgpMQyGVMv8lbCvb1K1Xcn9SWbORjaw02iHNCtSdGtCfygQ_gbg-uFOrZEUcWX4ugz3WNGBV4BOAhWmDCIO1ITTHfdHCYI-lzYxWQ297SmJHl0JLtIXEpG0FHH6nzaK0NjSwA=w750' },
    { name: 'King Power Mahanakhon', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNYQNuRMWxpIFgpMQyGVMv8lbCvb1K1Xcn9SWbORjaw02iHNCtSdGtCfygQ_gbg-uFOrZEUcWX4ugz3WNGBV4BOAhWmDCIO1ITTHfdHCYI-lzYxWQ297SmJHl0JLtIXEpG0FHH6nzaK0NjSwA=w750' },
  ],
  hotels: [
    { name: 'Oriole Residence', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHjnxDYn2OBlRoycMi2F3Pgaoc5-jnSpiSDpPRaYF3BPx6WsZyN5TmI8UkuRkD_wHBwpBKSyShU9DCBfiKTaLICjiWR-lWt_Kc=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=113606838' },
    { name: 'The Residence Airport Hotel', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGt5ll2RoKqz3iCfdPxIUQ89iSPu3mxQjslvLrpn1fFGg7E5PU4tvrbo-YUjg0hfBNh3aL4EneusEHArcXnlzIFw4uQQ-bTe1E=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=703034'},
    { name: 'AETAS Lumpini Hotel', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqEOcGnrivpzUT7dbrkd7rEGN6nWH_Rd51Xz2swRO_cLXpxMgE4x7keZ6cy9VTvvXD6gqY-Dm88hJ-b65EB_rvGeYOIiNxXk8-c=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=700709'},
    { name: 'The Salil Hotel Riverside Bangkok', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGaA1PnXPi0yjoFdjuNISURQfFZRHs6IxYA57ahPUjaNsxUwZofa1LTD-LscGDf8p-n3DztYnkHtybl9oP_FyUayxopOfMXdec=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=98944902' },
    { name: 'JC Kevin Sathorn Bangkok Hotel', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNmfK9CAN51JtB6IBFe2NYFEy1Q6RWPAnqJ6ZIy0nYjaC6k2qtZQ4Zb50TOc92vaOhu3q0dJQ1ziAQS5qA8GGOMBIiznHLtBad8mWH3aYFXu5_3CAh3tIkxSpzcqVR_hfqTIb13b7dgnBqNHA=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=924146' },
    { name: 'Lebua at State Tower', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMEpcUBADcIbxuAiElfb4HsLaXXPeOTDvmoyJgNcxzOfTv9sVeOwkazJZ1m38XAYM6l0br4uoiBl5oLzKdE36AUOW-E5K0l-NtPdU3O8sRzr7Uc-Z6ewVha8_ynZVKcQjaCT8DZDvlSUFCqxKE=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=996638' },
    { name: 'Grande Centre Point Hotel Ratchadamri', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqHL_N0kMDB3kfQhf05Ine02TyvN95ffZbHKbXq2ZfWdkxUC_9elpZ4u_z3SrL5SjF9PJMiAykph2LxcZ3Jj4imyc-ZLoSLasQE=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=996732' },
    { name: 'Tower Club at Lebua', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNtutIpWnrIC7GSTJyA99g0Itg5LK28EdYveEpiHkq6eFYTR_CUBvSJHSYQOgv4UkphClUduBrMgcQ1uk20GJux7jywBnkVm9buLboqbmFCjeUfv2rxbWP1T4-3i05-nqsP4TVeMc6nHyWPJag=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=996750' },
    { name: 'Oakwood Suites Bangkok', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqE0TjkMmvoWZDKuZqlLkY93SBr-dUHbfNH0qRB3fgC4cwbGor7b-NjZV2MAeiS7N6JJP787EpKIudA9F26dnZCusb2PNDt3gkg=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=97396186' },
    { name: 'Marriott Executive Apartments Sukhumvit Park', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqFKz2g11jwxrYyQG6RtQtHno_jNS0K8tsSVqKOMFKeMZ5k-iFytaurAtB1MVGm2XXWcc29iZth9g2rcF0Pqpj9Gf2m5DLm7JQ=w750' ,book_url: 'https://www.trip.com/hotels/detail/?hotelId=1706936' },
  ],
  restaurants: [
    { name: 'Jay Fai', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOIZ8gJxypkesUoKAOTv-eIppP_IGKxsodu-y1RFevQtqQ8qdRPIGR39pX_U0vpgOJG8e1lbSZHTIuLtZxoAlmRMfeCt5XCIbiTisd1Xr1Mugnc4heRTTMsGcj2A92WPzd27Gi6gBzCRVJ6s-fYeXnDbQ=w750' },
    { name: 'Somsak Pu Ob', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOuo6UlBJz4XBNJkfUh1gjyUlMnm6X-ysIF73fovSEHmHxfmyRhiH6ALfsWqccb6byfFVneiWDG6gfaY2tkc6-qwn0HTBxW5TFUrOmAT_wMZ0Kf9N-cP2806gxZmcC-FDnJQRzRNnI6CBSuPg=w750' },
    { name: 'Jeh O Chula', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPbanCfNBIqfxsPP6VbwfSexP7BEnJXAXCtrPFmkBBsevyUMaZWr4fpz9hiGUmFqSiCT_3UIn2ULoQFxsXqmFixixQBWO5gHTXFU_6vSFcyPkh-Z6rjqaAe6EphRsuQIMss-3NDqoltY-4JsQ=w750' },
    { name: 'Inter Restaurants Since 1981', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGXsnn1IXfITkc2RV_i6c_xMhe7R5dDfR-jqdIAe9VrewuTdVEeEky0KNn1u0avt2-dfHJZ8iVqSNxe7z0J7ZI5Vh2JvcEKrww=w750' },
    { name: 'Somtam Nua', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNtKGuVx13kGJ7qj4HT__JohdzVFnBtOq28B2WaTUH0kuwKmJvaG4S7jt1ZkmF0U7v354ST-ACKsEYEAOJHjEUa184dlU26yzqsn8ZtKU030dtRZeV4JR8SmEeIMTkgZI4U_3Tb-hdpt8a_gQ=w750' },
    { name: 'Go-Ang Kaomunkai Pratunam', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOCtwypZHYRd6rBaWN7yRtYTrGxugspNpSje8uh3DFdk8gj5UG1b06W5sbqv7oJ0yqU4Y-khSvNN_mSGZjKpgovk2CCVCWfLxsR1nmoUFmXQoxBZ-zPgmT6NjJcC4Jnx3z_rAv6l4GGdcVffp9Wdd9P=w750' },
    { name: 'Ong Tong Khao Soi', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqG7uG9r2QnX2B1B4H0lQjz1XHn0XJXQ0m0jXzK1g7hPz1dS0G1u6Qj3m4YzR0vM4d6JQxG3X1JrQhPqZ8p0u2y7xQ8ZyE7Q=w750' },
    { name: 'Mae Varee', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNmbKeVaTwTamdW6q6rq03HG-JwRueVxzeRTT66DFwpUAzP8T8WfTr-S5RBl7tOggqqPMDZWQZSxPzs8zimZmlwXOX1Wny-FtDeuY-t00WOUyzv7KwKYec9QpkzrufdACXn4PoaOJfBtwxDhLkKPiaU7g=w750' },
    { name: 'Bubble In The Forest', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZP6hM7EEUqdCnvZqjQ0f4WvSIxW7boxRNna8SlRZjVXvPcd1lNpy6g32W155Pk50ZdOrloG_UXrvfb3uU13qfKXgemH0QUlaVbYLrqzkrm0EW6vvydRlEt6N_Qv6orAk4k6afaJKeEIcCrTco4=w750' },
    { name: 'The Cassette Coffee Bar', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZObGcZUniiuYBiKAvNziyf_ED87B76Z_Rwo0p2TzKyTlemkxWlZr9Kp00u89EnGQdkP9kCtU8Z9xqUEPat1IixsTpSCsbuBlx1G-yf5uIqFoHNzNYEkcdQx7sCny0iWpDhajrBIseWeENkjwHA=w750' },
  ],
  activities: [
    { name: 'Safari World Bangkok Ticket', description: 'Open-air zoo with exotic animals and marine shows.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPFntXvmmXsKflFyyQNkvWR0Dp3hLbuWu3bPo-WgntWHgf99aR58TjBmESLZs9jFZoPsk7ggvM9YganQRd7DFtwEpTZgd3SHzlm4fgAD397kUi8MJN5UcI-mx--NNW4tRLkPxbXt2U9JwA1trA=w750' ,book_url: 'https://www.klook.com/en-US/activity/365-safari-world-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Sea Life Bangkok Ocean World Ticket', description: 'Southeast Asia aquarium with thousands of marine creatures.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOzHGNMHE__jo4c40gGSdB0idRmrVBbNbMM5SnfayAdX0785vxdQhbbDyOapQtx8wD55F4QEoz_Aarm0UuKHvaABT-lxCvWNJ3MDld9xIFbPaZx4VCZZTeHDMzHswHOi3ps52W4S3jMFwvjfg=w750' ,book_url: 'https://www.klook.com/en-US/activity/357-sea-life-bangkok-ocean-world-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Chao Phraya Princess Cruise in Bangkok', description: 'Dinner cruise with live music and buffet on the river.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqE59fSS79wPGsb4PGXMtsAmeQiUhLXiSJBDfO4Fg6YkzCp2bukvaF78iiZIy9RQ51BPtB8Nf3iJTq2blhyiiIqhia--Z3gs5LA=w750' ,book_url: 'https://www.klook.com/en-US/activity/375-chao-phraya-princess-cruise-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Ancient City Bangkok and Erawan Museum Ticket', description: 'Historical replicas and a dramatic elephant sculpture museum.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNGAOYMmpqap2Tel6hp7sp23H6P2YXZI1KtcQLcsbRw-KKTjDNyEuhdHs2vZ1PmKvXbBSDgFxFVA8ToEAFfXmVE6nMtGUj-s69xoGNPDqq5Tw0v7qjs1rrfjPKnC_Yhu24WqSiEot_ZUL2Tew=w750' ,book_url: 'https://www.klook.com/en-US/activity/368-ancient-city-erawan-museum-ticket-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Mahanakhon SkyWalk Ticket in Bangkok', description: 'Sky deck experience with 360-degree city views.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNYQNuRMWxpIFgpMQyGVMv8lbCvb1K1Xcn9SWbORjaw02iHNCtSdGtCfygQ_gbg-uFOrZEUcWX4ugz3WNGBV4BOAhWmDCIO1ITTHfdHCYI-lzYxWQ297SmJHl0JLtIXEpG0FHH6nzaK0NjSwA=w750' ,book_url: 'https://www.klook.com/en-US/activity/16870-king-power-mahanakhon-skywalk-ticket-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Let\'s Relax Spa at Central World in Bangkok', description: 'Signature Thai massage treatments inside a major shopping complex.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPKubdSM0fkIFVMssIbh7kzS3lEe33GrmNel1p9Bo7k0N21reMlcWWsEmDxNHUeb0BE04KUppiYYUun6J-82BSvmTIQuv_qXqlUAdrZLjIkieVT9gbZN6o0qhfA1eHW6B4EfNmQm8cNqE92W0U=w750' ,book_url: 'https://www.klook.com/en-US/activity/65634-lets-relax-spa-treatment-central-world-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Damnoen Saduak Floating Market & Maeklong Railway', description: 'Traditional canal commerce paired with the famous train market.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNWo8UfJKMBEmcM9P9FXg7f1wFe4RrIYXqMmYb-8bdPEJcjY09EUTSIAv858-i-rhkS7IMKpC4miNt1VPgiFuNgE3WAaSUuq3Sk3kmAEMVtUYmwEZnYueAaMi8cPGOZVY4Yz3k4yEYlaMUKwy4=w750' ,book_url: 'https://www.klook.com/en-US/activity/127327-damnoen-saduak-floating-market-maeklong-railway-market/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Chao Phraya White Orchid Cruise in Bangkok', description: 'Night cruise with cabaret show and international buffet.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqPrg7ge4Qr48Go-ANtBDW5puzQ3vIHYDMp0hVm_vZyKuAod1cUHfM7ovjB3pngYFM-lsZt1ZNKlp7Mo3NTpyh_kwG4xlJPZG6JrpO9EOQ8h3kTVBCISkqVBbG-_4q5tXhLxF1HGj1IPZrklcP3LSuhSIQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/10538-chao-phraya-white-orchid-river-cruise-bangkok/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Bangkok Safari World Shared and Private Transfers Service', description: 'Convenient transfer service to the safari park.', cover_image: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPCyn_sNhvglLgyVlVWcaOK9KUOzIalUxcjwZRGUTavKG6svOAt31GNwtsQXQtPR7kPWstp13cItccqjrmEm0YcSqllKgQa0DfSluQD-i7FQygi_9A-s8HYSBVmfP_aYNoJqNBrPjHc9zKQ=w750' ,book_url: 'https://www.klook.com/en-US/activity/81157-safari-world-bangkok-shared-and-private-transfer/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
    { name: 'Baiyoke Sky Hotel 78th Floor Bangkok Sky Buffet', description: 'High-floor buffet with observation deck access.', cover_image: 'https://lh3.googleusercontent.com/places/ANXAkqGLVtNL7Jm78lxJWHS37dg0Ne4ITyTBuHB5TBqYJVNVIwnCzrCKfdEkdVIwlWYmLm6SRg1R1FM8V7zHszO1nKqTq3OZF0CX3q8=w750' ,book_url: 'https://www.klook.com/en-US/activity/88067-baiyoke-sky-hotel-observation-deck-buffet/?aid=99362&utm_medium=affiliate-alwayson&utm_source=non-network&utm_campaign=99362&utm_term=' },
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

    const cityId = await upsertCity(client, BANGKOK_GUIDE.city);
    await client.query(`DELETE FROM public.city_pois WHERE city_id = $1`, [cityId]);

    await insertPois(client, cityId, 'place', BANGKOK_GUIDE.places);
    await insertPois(client, cityId, 'hotel', BANGKOK_GUIDE.hotels);
    await insertPois(client, cityId, 'restaurant', BANGKOK_GUIDE.restaurants);
    await insertPois(client, cityId, 'activity', BANGKOK_GUIDE.activities);

    await client.query('COMMIT');

    console.log(`Imported Bangkok guide from ${SOURCE_URL}`);
    console.log('City: Bangkok');
    console.log(`Sections: places=${BANGKOK_GUIDE.places.length}, hotels=${BANGKOK_GUIDE.hotels.length}, restaurants=${BANGKOK_GUIDE.restaurants.length}, activities=${BANGKOK_GUIDE.activities.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bangkok guide import failed');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();