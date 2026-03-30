BEGIN;

-- users: id is not GENERATED ALWAYS, direct insert is allowed.
INSERT INTO public.users (
  id,
  email,
  username,
  displayname,
  profilephoto,
  passwordhash,
  createdat,
  updatedat,
  isactive
) OVERRIDING SYSTEM VALUE VALUES
  (3, 'a35744830@gmail.com', NULL, 'easn', NULL, '$2b$10$yaPRk8OfgHBvcMjqfxzq/ua5qzbGtqeK75iOJ2IbyEFKJRTQGzqZ6', '2026-03-11 03:01:06.217914', '2026-03-11 03:01:06.217914', TRUE),
  (4, 'jinxintee@gmail.com', NULL, 'hahaha', NULL, '$2b$10$rPW6I.ruFd5cf9dPeBi73em7BG6EDHNBxbo0lJYdsvY9BcOdzuOi6', '2026-03-12 01:10:03.120194', '2026-03-12 01:10:03.120194', TRUE),
  (5, 'test@gmail.com', NULL, 'test', NULL, '$2b$10$ZTngJ5Wp76XFZYQb4xBdW.kHHHytiv6KrAzC0rcDybpR8rUIGePw2', '2026-03-12 03:03:03.220486', '2026-03-12 03:03:03.220486', TRUE),
  (6, 'ruba20021216@gmail.com', NULL, 'ruba', NULL, '$2b$10$82rvoT8j0raH2mLw1GZX2u2st0Bhs0lTz71w5.ijaCkuwtEpDLFaq', '2026-03-12 12:17:36.157074', '2026-03-12 12:17:36.157074', TRUE),
  (7, 'coswer.yang@gmail.com', NULL, 'coswer_sb', NULL, '$2b$10$oE7sDh50JswZZwhMO/iR9OORYBAVW1uP9EklS4Q/riQzK/FxJPqwS', '2026-03-13 03:04:39.172697', '2026-03-13 03:04:39.172697', TRUE),
  (8, 'mr.liu.journey.builders@gmail.com', NULL, 'coswer', NULL, '$2b$10$Tle9xvT5gA5gE4QutjO0n.ZtQke8b5gYOau9IWI7lZLXJVHoWO6Se', '2026-03-13 12:19:26.758579', '2026-03-13 12:19:26.758579', TRUE);

-- Identity columns need OVERRIDING SYSTEM VALUE when id is provided.
INSERT INTO public.cities (
  id,
  city,
  country,
  description,
  cover_image,
  latitude,
  longitude,
  is_active,
  createdat,
  updatedat,
  score
) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Tokyo', 'Japan', '東京是一座井然有序、值得細細探索的巨型都市。它以超現代街區與寧靜古老神社的完美共存而聞名。從澀谷繁忙的人潮，到靜謐巷弄裡的精品咖啡店與職人小店，東京提供了極其豐富的旅行體驗，是一座既追求尖端創新，又深耕傳統文化的城市。', 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&auto=format', 35.676200, 139.650300, TRUE, '2026-03-16 12:35:24.246416', '2026-03-16 12:35:24.246416', 5);

INSERT INTO public.city_pois (
  id,
  city_id,
  category,
  name,
  description,
  cover_image,
  star_rating,
  book_url,
  sort_order,
  is_active,
  createdat,
  updatedat
) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'place', 'Ginza', NULL, 'https://images.unsplash.com/photo-1610882648335-ced8fc8fa6b6?w=400&auto=format&fit=crop', NULL, NULL, 1, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051'),
  (2, 1, 'place', 'Shibuya Sky', NULL, 'https://images.unsplash.com/photo-1554797589-7241bb691973?w=400&auto=format&fit=crop', NULL, NULL, 2, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051'),
  (3, 1, 'place', 'Asakusa', NULL, 'https://images.unsplash.com/photo-1490761668535-35497054516e?w=400&auto=format&fit=crop', NULL, NULL, 3, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051'),
  (4, 1, 'hotel', 'Hotel Knot Tokyo', 'Stylish hotel in Shinjuku.', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&auto=format&fit=crop', 3, '#', 1, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051'),
  (5, 1, 'restaurant', 'Myojaku', 'Traditional kaiseki in a beautiful setting.', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&auto=format&fit=crop', NULL, '#', 1, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051'),
  (6, 1, 'activity', 'teamLab Borderless', 'Immersive digital art world.', 'https://images.unsplash.com/photo-1549490349-8643362247b5?w=400&auto=format&fit=crop', NULL, '#', 1, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051'),
  (7, 1, 'transport', 'Tokyo Subway Ticket', 'Convenient city transport pass.', NULL, NULL, '#', 1, TRUE, '2026-03-16 13:37:46.731051', '2026-03-16 13:37:46.731051');

INSERT INTO public.travel_guides (
  id,
  city,
  country,
  title,
  summary,
  body,
  cover_image,
  author_name,
  author_username,
  author_avatar,
  slug,
  guide_code,
  trip_days,
  trip_nights,
  tags,
  view_count,
  is_published,
  publishedat,
  createdat,
  updatedat
) OVERRIDING SYSTEM VALUE VALUES
  (1, '東京', '日本', '東京 4 天 3 夜節奏攻略', '以區域分日，搭配地鐵轉乘與雨天替代景點，適合第一次自由行。', '建議先鎖定住宿區域，再以地鐵線分日安排。', NULL, 'Travel Planner Team', 'travel-planner', NULL, '東京-4天3夜節奏攻略-TK01', 'TK01', 4, 3, ARRAY['都會','自由行'], 0, TRUE, '2026-03-16 03:42:20.563685', '2026-03-16 03:42:20.563685', '2026-03-16 03:42:20.563685'),
  (2, '大阪', '日本', '大阪美食與景點平衡路線', '白天景點、晚餐在地名店，並保留夜間彈性活動時段。', '以梅田、心齋橋、天王寺三區分流，降低折返。', NULL, 'Travel Planner Team', 'travel-planner', NULL, '大阪美食與景點平衡路線-OS02', 'OS02', 4, 3, ARRAY['美食','城市散步'], 0, TRUE, '2026-03-16 03:42:20.563685', '2026-03-16 03:42:20.563685', '2026-03-16 03:42:20.563685'),
  (3, '中國內蒙古自治區呼倫貝爾市', '中國', '中國內蒙古自治區呼倫貝爾市', '草原、濕地與邊境風景兼具，適合慢節奏自然旅行。', '建議以海拉爾為樞紐，安排莫日格勒河、額爾古納濕地與滿洲里邊境風景，並依天候保留彈性。', NULL, 'reanna.sun', 'reanna.sun', NULL, '中國內蒙古自治區呼倫貝爾市-ALQ8', 'ALQ8', 5, 4, ARRAY['草原','自然風景','慢旅行'], 0, TRUE, '2026-03-16 03:42:20.563685', '2026-03-16 03:42:20.563685', '2026-03-16 03:42:20.563685');

INSERT INTO public.itineraries (
  id,
  userid,
  uuid,
  title,
  summary,
  city,
  startdate,
  itinerarydata,
  createdat,
  updatedat,
  ispublic
) OVERRIDING SYSTEM VALUE VALUES
  (1, 5, '42743f8f-62d0-41b8-a404-178da61a29e3', '台北一日遊', '台北一日遊', '台灣台北', NULL, '{"summary":"台北一日遊","city":"台灣台北","days":[{"day":1,"title":"台北一日遊","items":[{"time":"morning","name":"故宮博物院","type":"sight","note":"欣賞中國古代藝術","cost":350},{"time":"noon","name":"鼎泰豐","type":"food","note":"品嚐小籠包","cost":500},{"time":"afternoon","name":"士林夜市","type":"shopping","note":"逛街和小吃","cost":400},{"time":"evening","name":"台北101觀景台","type":"sight","note":"俯瞰台北市全景","cost":600},{"time":"night","name":"饒河街夜市","type":"food","note":"體驗台灣夜市文化","cost":300}]}],"totalBudget":5000}', '2026-03-12 03:29:59.589934', '2026-03-12 03:42:12.67294', TRUE),
  (4, 3, '8fc5a98f-d0d5-4176-a414-e1fcedacb426', '東京兩天一夜行程', '東京兩天一夜行程', '日本東京', '2026-03-23', '{"summary":"東京兩天一夜行程","city":"日本東京","startDate":"2026-03-23","startLocation":"台北車站","startTime":"09:00","days":[{"day":1,"items":[{"time":"09:30~11:00","name":"台北車站到桃園國際機場","type":"activity","note":"乘坐機場巴士","cost":200},{"name":"青埔","type":"neighborhood","time":"11:30~13:30","cost":0,"note":"手動從地圖加入 (第 1 天)","location":{"lat":25.00659493658024,"lng":121.21490478515625}},{"time":"14:00~15:30","name":"航班抵達東京成田機場","type":"activity","note":"飛行時間約1.5小時","cost":0},{"time":"16:00~17:30","name":"雷門周邊自由活動","type":"sight","note":"","cost":0},{"time":"18:00~19:30","name":"成田機場到市區的交通","type":"activity","note":"乘坐火車或巴士","cost":300},{"time":"20:00~21:30","name":"午餐 - 鳥貴族燒鳥","type":"food","note":"","cost":150},{"time":"22:00~00:00","name":"淺草寺","type":"sight","note":"參觀並拍照","cost":0},{"time":"00:30~02:00","name":"晚餐 - 築地市場海鮮","type":"food","note":"","cost":200},{"time":"02:30~04:00","name":"回飯店休息","type":"activity","note":"","cost":500}]},{"day":2,"items":[{"time":"09:30~11:00","name":"早餐 - 當地便當","type":"food","note":"","cost":100},{"time":"11:30~13:30","name":"東京塔","type":"sight","note":"上塔觀景","cost":100},{"time":"14:00~15:00","name":"午餐 - 章魚燒","type":"food","note":"","cost":150},{"time":"15:30~17:00","name":"原宿購物","type":"shopping","note":"","cost":500},{"time":"17:30~19:30","name":"明治神宮","type":"sight","note":"","cost":0},{"time":"20:00~21:00","name":"晚餐 - 拉麵","type":"food","note":"","cost":200},{"time":"21:30~23:30","name":"回程到機場","type":"activity","note":"","cost":300},{"time":"00:00~01:30","name":"航班回台北","type":"activity","note":"","cost":0}]}],"totalBudget":50000}', '2026-03-23 03:22:48.179982', '2026-03-23 03:23:33.445018', FALSE),
  (5, 3, 'f08ac122-a053-46bb-8ecf-0165d95045cd', '五天四夜東京旅遊行程', '五天四夜東京旅遊行程', '日本東京', '2026-03-20', '{"summary":"五天四夜東京旅遊行程","city":"日本東京","startDate":"2026-03-20","startLocation":"台北車站","startTime":"09:00","days":[{"day":1,"title":"東京探索","items":[{"name":"天主教輔仁大學","type":"establishment","time":"09:30~11:30","cost":0,"note":"手動從地圖加入 (第 1 天)","location":{"lat":25.03646068459294,"lng":121.43257141113281}},{"time":"12:00~15:00","name":"淺草寺","type":"sight","cost":0},{"time":"15:30~17:00","name":"淺草小吃街","type":"food","cost":15},{"time":"17:30~19:30","name":"晴空塔","type":"sight","cost":20},{"time":"20:00~21:30","name":"上野公園","type":"sight","cost":0},{"time":"22:00~23:30","name":"上野動物園","type":"sight","cost":30},{"time":"00:00~01:30","name":"上野周邊晚餐","type":"food","cost":20}]},{"day":2,"title":"東京現代","items":[{"time":"09:30~11:30","name":"東京塔","type":"sight","cost":15},{"time":"12:00~13:30","name":"六本木之丘","type":"sight","cost":20},{"time":"14:00~15:30","name":"築地市場","type":"food","cost":25},{"time":"16:00~18:00","name":"表參道及原宿逛街","type":"shopping","cost":0},{"time":"18:30~20:30","name":"明治神宮","type":"sight","cost":0},{"time":"21:00~22:30","name":"新宿晚餐","type":"food","cost":20}]},{"day":3,"title":"東京文化","items":[{"time":"09:30~11:30","name":"國立西洋美術館","type":"sight","cost":15},{"time":"12:00~13:30","name":"上野藝術劇場","type":"sight","cost":10},{"time":"14:00~15:30","name":"日式咖啡館午餐","type":"food","cost":10},{"time":"16:00~18:00","name":"東京國立博物館","type":"sight","cost":15},{"time":"18:30~20:30","name":"秋葉原電子商場","type":"shopping","cost":0},{"time":"21:00~23:00","name":"秋葉原晚餐","type":"food","cost":20}]},{"day":4,"title":"東京周邊","items":[{"time":"09:30~11:30","name":"迪士尼樂園","type":"activity","cost":80},{"time":"12:00~14:30","name":"迪士尼樂園逛","type":"activity","cost":0},{"time":"15:00~16:30","name":"迪士尼樂園午餐","type":"food","cost":25},{"time":"17:00~20:00","name":"迪士尼樂園繼續玩","type":"activity","cost":0},{"time":"20:30~22:30","name":"東京迪士尼晚餐","type":"food","cost":30}]},{"day":5,"title":"東京自由活動","items":[{"time":"09:30~11:30","name":"自由活動（建議台場）","type":"sight","cost":0},{"time":"12:00~14:00","name":"台場附近午餐","type":"food","cost":25},{"time":"14:30~17:30","name":"返回台北","type":"activity","cost":200}]}],"totalBudget":50000}', '2026-03-23 03:26:40.107521', '2026-03-23 03:26:40.107521', FALSE),
  (6, 3, '9e091f2a-ca21-435a-b12f-c3d916aa2c23', '台北三天行程', '台北三天行程', '台北', '2026-03-23', '{"summary":"台北三天行程","city":"台北","startDate":"2026-03-23","startLocation":"台北車站","startTime":"09:00","days":[{"day":1,"title":"台北市內觀光","items":[{"time":"09:30~10:30","name":"台北車站","type":"sight","cost":0},{"time":"11:00~13:00","name":"中正紀念堂","type":"sight","cost":200},{"time":"13:30~15:00","name":"午餐：鼎泰豐小籠包","type":"food","cost":300},{"time":"15:30~17:00","name":"故宮博物院","type":"sight","cost":350},{"time":"17:30~18:00","name":"交通到士林夜市","type":"activity","cost":50},{"time":"18:30~21:00","name":"士林夜市","type":"activity","cost":0},{"time":"21:30~23:00","name":"晚餐：小籠包","type":"food","cost":300}]},{"day":2,"title":"台北周邊景點","items":[{"time":"09:30~11:00","name":"陽明山國家公園","type":"sight","cost":100},{"name":"大基隆駕訓班(小客車、大貨車、大客車、大重機、露拖)","type":"establishment","time":"11:30~13:30","cost":0,"note":"手動從地圖加入 (第 2 天)","location":{"lat":25.117893419479977,"lng":121.83043956756592}},{"name":"南港軟體工業園區","type":"neighborhood","time":"14:00~16:00","cost":0,"note":"手動從地圖加入 (第 2 天)","location":{"lat":25.057611191431437,"lng":121.61247253417969}},{"time":"16:30~18:00","name":"交通到北投","type":"activity","cost":50},{"time":"18:30~20:00","name":"午餐：北投溫泉區餐廳","type":"food","cost":400},{"time":"20:30~22:00","name":"北投溫泉博物館","type":"sight","cost":0},{"time":"22:30~00:30","name":"九份老街","type":"activity","cost":0},{"time":"01:00~03:00","name":"交通到九份","type":"activity","cost":150},{"time":"03:30~05:00","name":"晚餐：九份特色餐","type":"food","cost":500}]},{"day":3,"title":"台北文化探索","items":[{"time":"09:30~11:30","name":"台北當代藝術館","type":"sight","cost":150},{"time":"12:00~13:30","name":"午餐：永康街美食","type":"food","cost":300},{"time":"14:00~15:30","name":"台北101觀景台","type":"sight","cost":600},{"time":"16:00~17:00","name":"交通回台北車站","type":"activity","cost":50},{"time":"17:30~19:30","name":"購物：信義商圈","type":"shopping","cost":0},{"time":"20:00~22:00","name":"晚餐：信義區餐廳","type":"food","cost":600}]}],"totalBudget":50000}', '2026-03-23 11:40:44.213676', '2026-03-30 03:11:36.703596', FALSE);

-- Reset sequences/identity after manual id inserts, to avoid next insert conflicts.
SELECT setval(pg_get_serial_sequence('public.users', 'id'), COALESCE((SELECT MAX(id) FROM public.users), 1), true);
SELECT setval(pg_get_serial_sequence('public.cities', 'id'), COALESCE((SELECT MAX(id) FROM public.cities), 1), true);
SELECT setval(pg_get_serial_sequence('public.city_pois', 'id'), COALESCE((SELECT MAX(id) FROM public.city_pois), 1), true);
SELECT setval(pg_get_serial_sequence('public.travel_guides', 'id'), COALESCE((SELECT MAX(id) FROM public.travel_guides), 1), true);
SELECT setval(pg_get_serial_sequence('public.itineraries', 'id'), COALESCE((SELECT MAX(id) FROM public.itineraries), 1), true);

COMMIT;
