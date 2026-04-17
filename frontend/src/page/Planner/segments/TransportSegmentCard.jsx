import React from 'react';

const MODE_ICON = {
  TRANSIT: '🚇',
  DRIVING: '🚗',
  WALKING: '🚶',
  BICYCLING: '🚲',
};

const TransportSegmentCard = ({ id, mode = 'TRANSIT', durationText, distanceText, directionsUrl }) => {
  return (
    <div className="az-transport-row" key={id}>
      <div className="az-transport-node" aria-hidden="true">+</div>

      <div className="az-transport-card">
        <div className="az-transport-meta">
          <span className="az-transport-icon">{MODE_ICON[mode] || '🚗'}</span>
          <span className="az-transport-duration">{durationText || '15 min'}</span>
          {distanceText && <span className="az-transport-distance">· {distanceText}</span>}
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="az-transport-link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Directions
        </a>
      </div>
    </div>
  );
};

export default TransportSegmentCard;
