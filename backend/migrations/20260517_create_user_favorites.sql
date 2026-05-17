-- Create enum type for item_type
CREATE TYPE favorites_item_type AS ENUM ('attraction', 'poi', 'itinerary');

-- Create user_favorites table
CREATE TABLE user_favorites (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type favorites_item_type NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(userid, item_id, item_type)
);

-- Create indexes for better query performance
CREATE INDEX idx_user_favorites_userid ON user_favorites(userid);
CREATE INDEX idx_user_favorites_userid_item_type ON user_favorites(userid, item_type);
CREATE INDEX idx_user_favorites_item_id_type ON user_favorites(item_id, item_type);

-- Add comment for documentation
COMMENT ON TABLE user_favorites IS 'Stores user favorites for attractions, POIs, and itineraries';
COMMENT ON COLUMN user_favorites.metadata IS 'JSONB metadata: {name, image_url, address, lat, lng} - used for offline display and external map POIs';
