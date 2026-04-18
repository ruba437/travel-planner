const axios = require('axios');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const isUnstableImageUrl = (url) => {
  const text = String(url || '').trim().toLowerCase();
  return text.includes('source.unsplash.com');
};

const buildPhotoReference = (place) => place?.photos?.[0]?.photo_reference || null;

const searchPlace = async (query, city) => {
  if (!GOOGLE_PLACES_API_KEY || !query) return null;

  const fullQuery = city ? `${city} ${query}` : query;
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
    params: {
      query: fullQuery,
      key: GOOGLE_PLACES_API_KEY,
      language: 'zh-TW',
    },
  });

  const firstPlace = data?.results?.[0];
  if (!firstPlace) return null;

  return {
    placeId: firstPlace.place_id || null,
    photoReference: buildPhotoReference(firstPlace),
  };
};

const fetchPlaceDetails = async (placeId) => {
  if (!GOOGLE_PLACES_API_KEY || !placeId) return null;

  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params: {
      place_id: placeId,
      fields: 'photos',
      language: 'zh-TW',
      key: GOOGLE_PLACES_API_KEY,
    },
  });

  return data?.result || null;
};

const enrichItineraryItem = async (item, city) => {
  if (!item || typeof item !== 'object') return item;

  const rawImageUrl = String(item.imageUrl || '').trim() || null;
  const directImageUrl = rawImageUrl && !isUnstableImageUrl(rawImageUrl) ? rawImageUrl : null;
  if (directImageUrl || item.photoReference) {
    return item;
  }

  let nextPlaceId = item.placeId || null;
  let nextPhotoReference = null;

  if (nextPlaceId) {
    try {
      const details = await fetchPlaceDetails(nextPlaceId);
      nextPhotoReference = buildPhotoReference(details);
    } catch (error) {
      console.warn('Failed to fetch place details for itinerary item:', error.message || error);
    }
  }

  if (!nextPhotoReference && item.name) {
    try {
      const searchResult = await searchPlace(item.name, city);
      if (searchResult?.placeId) {
        nextPlaceId = searchResult.placeId;
      }

      if (nextPlaceId) {
        const details = await fetchPlaceDetails(nextPlaceId);
        nextPhotoReference = buildPhotoReference(details) || searchResult?.photoReference || null;
      } else {
        nextPhotoReference = searchResult?.photoReference || null;
      }
    } catch (error) {
      console.warn('Failed to enrich itinerary item image:', error.message || error);
    }
  }

  if (!nextPhotoReference) return item;

  return {
    ...item,
    placeId: nextPlaceId || item.placeId || null,
    photoReference: nextPhotoReference,
  };
};

const enrichItineraryImages = async (itineraryData) => {
  if (!itineraryData || !Array.isArray(itineraryData.days)) return itineraryData;

  const city = String(itineraryData.city || '').trim();
  const days = await Promise.all(
    itineraryData.days.map(async (day) => {
      const items = Array.isArray(day?.items) ? day.items : [];
      const enrichedItems = await Promise.all(items.map((item) => enrichItineraryItem(item, city)));

      return {
        ...day,
        items: enrichedItems,
      };
    })
  );

  return {
    ...itineraryData,
    days,
  };
};

module.exports = {
  enrichItineraryImages,
};
