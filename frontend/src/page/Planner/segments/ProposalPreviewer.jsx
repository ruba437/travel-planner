import React from 'react';

const ProposalPreviewer = ({ proposals, onConfirm, onCancel }) => {
  if (!proposals || proposals.length === 0) return null;

  return (
    <div className="az-proposal-view">
      <div className="az-proposal-header">
        <div className="az-proposal-title-row">
          <h3>AI 推薦方案比較</h3>
          <button className="az-proposal-close-btn" onClick={onCancel}>✕</button>
        </div>
        <p className="az-proposal-subtitle">選定後將為您規劃這 {proposals[0]?.daySummaries?.length} 天的詳細點位。</p>
      </div>
      
      <div className="az-proposal-scroll-area">
        {proposals.map((p, index) => (
          <div key={p.id || index} className="az-proposal-item-card">
            <div className="az-card-accent"></div>
            <div className="az-card-content">
              <div className="az-card-tag">方案 {index + 1}</div>
              <h4>{p.title}</h4>
              <p className="az-card-desc">{p.description}</p>
              
              <div className="az-card-hashtags">
                {p.highlights?.filter(tag => !p.title.includes(tag)).map((tag, idx) => (
                  <span key={idx} className="az-q-tag">#{tag.replace('#', '')}</span>
                ))}
              </div>

              <div className="az-card-preview">
                <h5>每日行程大綱</h5>
                <ul className="az-proposal-summary-list">
                  {p.daySummaries?.map((summary, i) => (
                    <li key={i}>
                      <span className="az-day-label">Day {i + 1}</span>
                      <span className="az-day-text">{summary.replace(/^(Day\s?\d+:?|第\s?\d+\s?天:?)/i, '').trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="az-card-actions">
                <button className="az-card-btn az-btn-confirm" onClick={() => onConfirm(p)}>選定此行程</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalPreviewer;