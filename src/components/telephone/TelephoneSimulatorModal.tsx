import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, Volume2, X, User, Activity } from 'lucide-react';
import { api } from '../../services/api.js';

interface TelephoneSimulatorModalProps {
  onClose: () => void;
}

export const TelephoneSimulatorModal: React.FC<TelephoneSimulatorModalProps> = ({ onClose }) => {
  const [callState, setCallState] = useState<'RINGING' | 'CONNECTED' | 'ENDED'>('RINGING');
  const [duration, setDuration] = useState(0);
  const [patientSpeech, setPatientSpeech] = useState('');
  const [aiSpeech, setAiSpeech] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationId, setConversationId] = useState(`phone-${Date.now()}`);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (callState === 'CONNECTED') {
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      // Speak IVR greeting
      const greeting = "Hello, you have reached OmniHealth Multi-Hospital Access. I am your automated patient assistant. How can I help you today?";
      setAiSpeech(greeting);
      speakText(greeting);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleAnswer = () => {
    setCallState('CONNECTED');
  };

  const handleHangup = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCallState('ENDED');
    setTimeout(onClose, 1000);
  };

  const handleSendUtterance = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setPatientSpeech(textToSend);

    // Cancel active speech on barge-in
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const res = await api.sendAiTurn(textToSend, conversationId, 'pat-1');
      if (res.reply) {
        setAiSpeech(res.reply);
        speakText(res.audioSpeakText || res.reply);
      }
    } catch (err) {
      console.error('Phone AI turn failed:', err);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '32px',
        padding: '2rem 1.5rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(6,182,212,0.15)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Top Close Button */}
        <button 
          onClick={handleHangup}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        {/* Phone Speaker Notch */}
        <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.2)', borderRadius: '9999px', marginBottom: '2rem' }} />

        {/* Caller Avatar */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          marginBottom: '1rem',
          boxShadow: callState === 'RINGING' ? '0 0 25px rgba(6, 182, 212, 0.5)' : 'none',
          animation: callState === 'RINGING' ? 'pulse 1.5s infinite' : 'none'
        }}>
          <User size={40} />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Inbound Patient Call</h3>
        <p style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.2rem' }}>
          Caller ID: +1 (555) 0199 (John Doe)
        </p>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {callState === 'RINGING' && 'Incoming Call...'}
          {callState === 'CONNECTED' && `Connected (${formatTime(duration)})`}
          {callState === 'ENDED' && 'Call Disconnected'}
        </p>

        {/* Live Speech Feedback Box */}
        {callState === 'CONNECTED' && (
          <div style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '1rem',
            margin: '1.5rem 0',
            textAlign: 'left',
            maxHeight: '160px',
            overflowY: 'auto',
            fontSize: '0.85rem'
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              {isSpeaking ? '🎙️ AI Voice Agent is Speaking...' : '👂 Listening for Caller...'}
            </div>
            <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
              {aiSpeech}
            </div>
          </div>
        )}

        {/* Quick Voice Simulation Buttons (Telephone Prompts) */}
        {callState === 'CONNECTED' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => handleSendUtterance("I need to see a specialist for a persistent skin rash this week.")}
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', justifyContent: 'flex-start' }}
            >
              🗣️ "I need to see a specialist for a persistent skin rash this week."
            </button>
            <button 
              onClick={() => handleSendUtterance("Book the earliest 9:00 AM slot please.")}
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', justifyContent: 'flex-start' }}
            >
              🗣️ "Book the earliest 9:00 AM slot please."
            </button>
            <button 
              onClick={() => handleSendUtterance("I have had a stomach ache for the past two days.")}
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', justifyContent: 'flex-start' }}
            >
              🗣️ "I have had a stomach ache for the past two days."
            </button>
          </div>
        )}

        {/* Call Action Controls */}
        <div style={{ display: 'flex', gap: '2rem', marginTop: 'auto' }}>
          {callState === 'RINGING' ? (
            <>
              <button 
                onClick={handleHangup}
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <PhoneOff size={28} />
              </button>
              <button 
                onClick={handleAnswer}
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#10b981', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(16,185,129,0.5)' }}
              >
                <Phone size={28} />
              </button>
            </>
          ) : (
            <button 
              onClick={handleHangup}
              style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(239,68,68,0.4)' }}
            >
              <PhoneOff size={30} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
