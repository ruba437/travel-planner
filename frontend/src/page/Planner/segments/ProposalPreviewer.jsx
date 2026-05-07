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
        <p className="az-proposal-subtitle">以下是根據您的需求產生的方案，點擊「選定」後將為您規劃詳細行程與地圖。</p>
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
                {p.highlights
                  ?.filter(tag => !p.title.includes(tag) && !p.description.includes(tag)) // 🚀 前端去重邏輯
                  .map((tag, idx) => (
                    <span key={idx} className="az-q-tag">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))
                }
              </div>

              {/* 🚀 改為純文字行程大綱預覽 */}
              <div className="az-card-preview">
                <h5><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> 每日行程概要</h5>
                <ul className="az-proposal-summary-list">
                  {p.daySummaries?.map((summary, i) => (
                    <li key={i}>
                      <span className="az-day-label">Day {i + 1}</span>
                      {/* 這裡我們將 summary 裡面的 "Day X:" 或 "第 X 天" 移除，以防 AI 還是手癢寫了 */}
                      <span className="az-day-text">
                        {summary.replace(/^(Day\s?\d+:?|第\s?\d+\s?天:?)/i, '').trim()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="az-card-actions">
                <button 
                  className="az-card-btn az-btn-confirm" 
                  onClick={() => onConfirm(p)}
                >
                  選定此行程
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProposalPreviewer;