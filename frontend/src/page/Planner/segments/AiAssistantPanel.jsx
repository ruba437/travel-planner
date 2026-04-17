import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePlanner } from '../PlannerProvider';
import useVoiceRecording from '../../../hooks/useVoiceRecording';

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

  const {
    isRecording,
    transcript,
    interimTranscript,
    error,
    isSupported,
    toggleRecording,
    resetTranscript,
  } = useVoiceRecording();

  const chatEndRef = useRef(null);

  // 當語音錄音完成時，自動填入或發送文字
  useEffect(() => {
    if (!isRecording && transcript && !isSending) {
      // 停止錄音且有文字內容
      const fullTranscript = transcript.trim();
      if (fullTranscript) {
        setInput(fullTranscript);
        resetTranscript();
      }
    }
  }, [isRecording, transcript, isSending, setInput, resetTranscript]);

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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="az-md-p">{children}</p>,
                strong: ({ children }) => <strong className="az-md-strong">{children}</strong>,
                em: ({ children }) => <em className="az-md-em">{children}</em>,
                ul: ({ children }) => <ul className="az-md-ul">{children}</ul>,
                ol: ({ children }) => <ol className="az-md-ol">{children}</ol>,
                li: ({ children }) => <li className="az-md-li">{children}</li>,
                a: ({ href, children }) => (
                  <a className="az-md-link" href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="az-md-inline-code">{children}</code>
                  ) : (
                    <code className="az-md-code-block">{children}</code>
                  ),
                pre: ({ children }) => <pre className="az-md-pre">{children}</pre>,
              }}
            >
              {String(m.content || '')}
            </ReactMarkdown>
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
          <button 
            className={`az-ai-voice ${isRecording ? 'az-ai-voice--active' : ''} ${!isSupported ? 'az-ai-voice--disabled' : ''}`}
            onClick={toggleRecording}
            disabled={isSending || !isSupported}
            title={isRecording ? '點擊停止錄音' : '點擊開始語音輸入'}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
              <path d="M19 11a7 7 0 0 1-14 0" />
              <path d="M12 18v4" />
              <path d="M8 22h8" />
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

        {/* 語音狀態顯示 */}
        {isRecording && (
          <div className="az-ai-voice-status">
            <div className="az-voice-indicator">
              <span className="az-voice-dot" />
              <span>錄音中...</span>
            </div>
            {interimTranscript && (
              <div className="az-voice-text">{interimTranscript}</div>
            )}
          </div>
        )}

        {error && (
          <div className="az-ai-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiAssistantPanel;