import React from 'react';

const ProposalPreviewer = ({ proposals, onPreview, onConfirm, onCancel }) => {
  if (!proposals || proposals.length === 0) return null;

  return (
    <div className="az-proposal-view">
      <div className="az-proposal-header">
        <div className="az-proposal-title-row">
          <h3>AI 推薦方案</h3>
          <button className="az-proposal-close-btn" onClick={onCancel}>✕</button>
        </div>
        <p className="az-proposal-subtitle">請選擇一個方案進行預覽或選定：</p>
      </div>
      
      <div className="az-proposal-scroll-area">
        {proposals.map((p, index) => {
          // 🚀 容錯邏輯：如果真的沒資料，就用方案標題組成一個基本的資料包
          const data = p.itineraryData || p.itinerary_data || p.plan || { 
            tripName: p.title, 
            city: "依據對話",
            isPlaceholder: true // 標記為預位符，提醒 PlannerPage 必須擴充
          };

          return (
            <div key={p.id || index} className="az-proposal-item-card">
              <div className="az-card-accent"></div>
              <div className="az-card-content">
                <div className="az-card-tag">方案 {p.id?.replace('prop_', '') || index + 1}</div>
                <h4>{p.title || "未命名行程"}</h4>
                <p className="az-card-desc">{p.description || "暫無描述"}</p>
                
                <div className="az-card-preview">
                  <h5>亮點景點</h5>
                  <ul>
                    {data?.days?.[0]?.items?.slice(0, 3).map((item, i) => (
                      <li key={i}>{item.name}</li>
                    )) || <li>點擊預覽以查看詳細景點</li>}
                  </ul>
                </div>

                <div className="az-card-actions">
                  <button 
                    className="az-card-btn az-btn-preview" 
                    onClick={() => onPreview(data)}
                  >
                    預覽行程
                  </button>
                  <button 
                    className="az-card-btn az-btn-confirm" 
                    onClick={() => onConfirm(data)}
                  >
                    選定此行程
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProposalPreviewer;