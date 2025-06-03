import React, { useEffect, useState } from 'react';

// Type declarations are handled in preload script

interface DebugInfo {
  electronAPIAvailable: boolean;
  electronAPIMethods: string[];
  location: string;
  userAgent: string;
  platform?: string;
  appVersion?: string;
  errors: string[];
}

export const DebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    electronAPIAvailable: false,
    electronAPIMethods: [],
    location: '',
    userAgent: '',
    errors: []
  });
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    const collectDebugInfo = async () => {
      const info: DebugInfo = {
        electronAPIAvailable: typeof window.electronAPI !== 'undefined',
        electronAPIMethods: typeof window.electronAPI !== 'undefined' 
          ? Object.keys(window.electronAPI) 
          : [],
        location: window.location.href,
        userAgent: navigator.userAgent,
        errors: []
      };

      // Try to get platform and version info
      if (typeof window.electronAPI !== 'undefined') {
        try {
          info.platform = await window.electronAPI.getPlatform();
          info.appVersion = await window.electronAPI.getVersion();
        } catch (error) {
          info.errors.push(`Failed to get platform info: ${error}`);
        }
      }

      setDebugInfo(info);
    };

    collectDebugInfo();

    // Listen for errors
    const errorHandler = (event: ErrorEvent) => {
      setDebugInfo(prev => ({
        ...prev,
        errors: [...prev.errors, `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`]
      }));
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '5px 10px',
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 9999
        }}
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '400px',
      maxHeight: '80vh',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: '#00ff00',
      padding: '20px',
      borderRadius: '10px',
      fontFamily: 'monospace',
      fontSize: '12px',
      overflow: 'auto',
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, color: '#00ff00' }}>🐛 DEBUG PANEL</h3>
        <button
          onClick={() => setShowDebug(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff4444',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ borderTop: '1px solid #00ff00', paddingTop: '10px' }}>
        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#ffff00' }}>🔌 Electron API Status:</strong>
          <div style={{ marginLeft: '20px', marginTop: '5px' }}>
            {debugInfo.electronAPIAvailable ? (
              <>
                <div style={{ color: '#00ff00' }}>✅ Available</div>
                <div style={{ marginTop: '5px' }}>
                  <strong>Methods:</strong>
                  <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                    {debugInfo.electronAPIMethods.map(method => (
                      <li key={method}>{method}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div style={{ color: '#ff4444' }}>❌ NOT AVAILABLE - Preload script may have failed!</div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#ffff00' }}>📍 Location:</strong>
          <div style={{ marginLeft: '20px', wordBreak: 'break-all' }}>{debugInfo.location}</div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#ffff00' }}>🖥️ Platform:</strong>
          <div style={{ marginLeft: '20px' }}>{debugInfo.platform || 'Unknown'}</div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#ffff00' }}>📦 App Version:</strong>
          <div style={{ marginLeft: '20px' }}>{debugInfo.appVersion || 'Unknown'}</div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#ffff00' }}>🌐 User Agent:</strong>
          <div style={{ marginLeft: '20px', fontSize: '10px', wordBreak: 'break-all' }}>
            {debugInfo.userAgent}
          </div>
        </div>

        {debugInfo.errors.length > 0 && (
          <div>
            <strong style={{ color: '#ff4444' }}>❌ Errors:</strong>
            <div style={{ marginLeft: '20px', marginTop: '5px' }}>
              {debugInfo.errors.map((error, index) => (
                <div key={index} style={{ 
                  marginBottom: '5px', 
                  padding: '5px', 
                  backgroundColor: 'rgba(255, 0, 0, 0.2)',
                  borderRadius: '3px'
                }}>
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};