import React, { useEffect, useRef } from 'react';
import { usePlanner } from '../PlannerProvider';

const AiAssistantPanel = () => {
  const { 
    messages, 
    setMessages, 
    input, 
    setInput, 
    isSending, 
    handleSend, 
    autoApprove, 
    setAutoApprove 
  } = usePlanner();

  const chatEndRef = useRef(null);

  // 自動捲動到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 處理 Enter 發送
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 清空對話
  const clearMessages = () => {
    setMessages([{ role: 'assistant', content: '嗨，我是旅遊小助手！我可以幫你安排行程。' }]);
  };

  return (
    <div className="az-ai-panel">
      {/* ── Header ── */}
      <div className="az-ai-header">
        <span className="az-ai-title">AI 助手</span>
        <button className="az-icon-btn" onClick={clearMessages} title="清空對話">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6l-1,14a2,2,0,01-2,2H8a2,2,0,01-2-2L5,6"/>
            <path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
          </svg>
        </button>
      </div>

      {/* ── Message List ── */}
      <div className="az-ai-messages">
        {messages.map((m, idx) => (
          <div key={idx} className={`az-ai-msg ${m.role === 'user' ? 'az-ai-msg--user' : 'az-ai-msg--bot'}`}>
            {m.content.split('\n').map((line, i) => (
              <div key={i}>{line || '\u00A0'}</div>
            ))}
          </div>
        ))}
        {isSending && (
          <div className="az-ai-msg az-ai-msg--bot az-ai-typing">
            <span /><span /><span />
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* ── Quick Actions ── */}
      <div className="az-ai-quick">
        {['行程多一點', '行程少一點', '推薦住宿', '推薦美食'].map((q, i) => (
          <button 
            key={i} 
            className="az-quick-chip" 
            onClick={() => handleSend(q)} 
            disabled={isSending}
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── Footer Input ── */}
      <div className="az-ai-footer">
        <label className="az-auto-approve">
          <input 
            type="checkbox" 
            checked={autoApprove} 
            onChange={(e) => setAutoApprove(e.target.checked)} 
          />
          自動核准所有動作
        </label>
        
        <div className="az-ai-input-row">
          <button className="az-ai-attach">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          </button>
          
          <textarea
            className="az-ai-textarea"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="向 AI 詢問旅程規劃..."
          />
          
          <button 
            className="az-ai-send" 
            onClick={() => handleSend()} 
            disabled={isSending || !input.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistantPanel;