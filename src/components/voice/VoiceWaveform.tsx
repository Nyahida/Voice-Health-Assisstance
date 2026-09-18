import React from 'react';

interface VoiceWaveformProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ status }) => {
  const isPlaying = status === 'listening' || status === 'speaking';
  const barCount = 18;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div className="audio-visualizer">
        {Array.from({ length: barCount }).map((_, i) => {
          const delay = `${(i * 0.08).toFixed(2)}s`;
          const baseHeight = isPlaying 
            ? `${10 + Math.sin(i) * 20}px` 
            : status === 'thinking' ? '6px' : '4px';

          return (
            <div
              key={i}
              className={`wave-bar ${isPlaying ? 'pulse' : ''}`}
              style={{
                animationDelay: delay,
                height: baseHeight,
                background: status === 'speaking' 
                  ? 'linear-gradient(to top, #10b981, #06b6d4)' 
                  : status === 'listening' 
                  ? '#3b82f6' 
                  : status === 'thinking' 
                  ? '#f59e0b' 
                  : '#475569'
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
        <span 
          style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%',
            background: status === 'speaking' ? '#10b981' : status === 'listening' ? '#3b82f6' : status === 'thinking' ? '#f59e0b' : '#64748b',
            boxShadow: isPlaying ? '0 0 10px currentColor' : 'none'
          }} 
        />
        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          {status === 'speaking' && 'AI Speaking (Barge-in enabled)'}
          {status === 'listening' && 'Listening to your voice...'}
          {status === 'thinking' && 'Analyzing intent & checking availability...'}
          {status === 'idle' && 'Microphone Ready — Press to Speak'}
        </span>
      </div>
    </div>
  );
};
