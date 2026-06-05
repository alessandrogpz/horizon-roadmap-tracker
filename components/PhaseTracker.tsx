"use client";

import React from "react";

export default function PhaseTracker({ phases, currentPhase, onPhaseClick }: { phases: any[], currentPhase: number, onPhaseClick: (phase: any) => void }) {
  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h2 className="section-title">Roadmap Timeline</h2>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Timeline Line */}
        <div style={{
          position: 'absolute',
          left: '12px',
          top: '18px',
          bottom: '18px',
          width: '2px',
          background: 'linear-gradient(to bottom, var(--success) 0%, var(--accent) 50%, var(--card-border) 100%)',
          opacity: 0.3,
        }} />

        {phases.map((phase) => {
          const isActive = phase.id === currentPhase;
          const isPast = phase.id < currentPhase;
          
          return (
            <div 
              key={phase.id} 
              onClick={() => onPhaseClick(phase)}
              style={{
                position: 'relative',
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                cursor: 'pointer',
                opacity: isPast ? 0.65 : 1,
                transition: 'all 0.2s ease',
                padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Timeline Indicator Dot */}
              <div style={{
                position: 'absolute',
                left: '5px',
                top: '10px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: isActive ? 'var(--background)' : isPast ? 'var(--success)' : '#18181b',
                border: isActive ? '3px solid var(--accent)' : isPast ? '2px solid var(--success)' : '2px solid var(--card-border)',
                boxShadow: isActive ? '0 0 8px var(--accent)' : 'none',
                zIndex: 1,
                transition: 'all 0.2s ease',
              }} />

              {/* Header Title Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontFamily: 'monospace', 
                  color: isActive ? 'var(--accent)' : isPast ? 'var(--success)' : '#71717a',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em'
                }}>
                  PHASE 0{phase.id}
                </span>
                <h3 style={{ 
                  fontSize: '0.95rem', 
                  color: isActive ? '#fff' : '#e4e4e7', 
                  fontWeight: 600,
                  margin: 0
                }}>
                  {phase.title.replace(/Phase \d+:\s*/, "")}
                </h3>
              </div>
              
              <p style={{ 
                fontSize: '0.8rem', 
                color: '#a1a1aa', 
                margin: 0
              }}>
                {phase.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
