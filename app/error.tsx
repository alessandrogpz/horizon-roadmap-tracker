'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App-level rendering error caught:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#09090b',
      color: '#e4e4e7',
      fontFamily: 'monospace',
      textAlign: 'center'
    }}>
      <div style={{
        padding: '2rem',
        borderRadius: '8px',
        backgroundColor: '#121214',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <h2 style={{ color: '#f59e0b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Workspace Error
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          A client-side rendering or hydration error occurred while building the dashboard.
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#000',
          borderRadius: '6px',
          textAlign: 'left',
          fontSize: '0.8rem',
          color: '#f87171',
          overflowX: 'auto',
          marginBottom: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <strong>Error:</strong> {error.message || String(error)}
          {error.digest && <div style={{ color: '#71717a', marginTop: '0.5rem' }}>Digest: {error.digest}</div>}
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid #0ea5e9',
              borderRadius: '6px',
              padding: '0.5rem 1.25rem',
              cursor: 'pointer',
              fontWeight: 500,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0ea5e9'; e.currentTarget.style.color = '#000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#fff'; }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent',
              color: '#71717a',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              padding: '0.5rem 1.25rem',
              cursor: 'pointer',
              fontWeight: 500,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = '#71717a'; }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
