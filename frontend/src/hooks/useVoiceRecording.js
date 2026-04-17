import { useState, useEffect, useRef } from 'react';

const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    // 初始化 Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('瀏覽器不支援語音輸入');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'zh-TW';
    recognition.interimResults = true;

    // 開始錄音
    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
      finalTranscriptRef.current = '';
      setTranscript('');
      setInterimTranscript('');
    };

    // 接收結果
    recognition.onresult = (event) => {
      let interim = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcriptSegment + ' ';
        } else {
          interim += transcriptSegment;
        }
      }
      
      setInterimTranscript(interim);
      setTranscript(finalTranscriptRef.current);
    };

    // 停止錄音
    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
    };

    // 錯誤處理
    recognition.onerror = (event) => {
      const errorMessages = {
        'no-speech': '沒有檢測到語音，請重試',
        'audio-capture': '無法存取麥克風，請檢查權限',
        'network': '網路連線故障',
        'not-allowed': '麥克風使用被拒絕',
      };
      
      const errorMsg = errorMessages[event.error] || `語音錯誤: ${event.error}`;
      setError(errorMsg);
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startRecording = () => {
    setError(null);
    if (recognitionRef.current && !isRecording) {
      recognitionRef.current.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const resetTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return {
    isRecording,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    resetTranscript,
  };
};

export default useVoiceRecording;
