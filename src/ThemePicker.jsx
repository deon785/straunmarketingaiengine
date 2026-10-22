import React from 'react';
import { useTheme } from './ThemeContext';

const ThemePicker = ({ onComplete }) => {
    const { setTheme } = useTheme();

    const handleChoose = (choice) => {
        setTheme(choice);
        if (onComplete) onComplete(choice);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.3s ease',
        }}>
            <div style={{
                background: '#1a1a20',
                borderRadius: '20px',
                padding: '32px 24px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎨</div>
                <h2 style={{
                    margin: '0 0 8px 0',
                    color: '#ffffff',
                    fontSize: '22px',
                    fontWeight: '800',
                }}>
                    Choose Your Theme
                </h2>
                <p style={{
                    margin: '0 0 28px 0',
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                }}>
                    Pick how you want the app to look. You can change this later in Settings.
                </p>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '14px',
                }}>
                    {/* LIGHT OPTION */}
                    <button
                        onClick={() => handleChoose('light')}
                        style={{
                            background: '#ffffff',
                            color: '#0d0d10',
                            border: '2px solid #e5e7eb',
                            borderRadius: '14px',
                            padding: '24px 16px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '15px',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(255,255,255,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <span style={{ fontSize: '36px' }}>☀️</span>
                        <span>Light</span>
                    </button>

                    {/* DARK OPTION */}
                    <button
                        onClick={() => handleChoose('dark')}
                        style={{
                            background: '#0d0d10',
                            color: '#ffffff',
                            border: '2px solid #7c3aed',
                            borderRadius: '14px',
                            padding: '24px 16px',
                            cursor: 'pointer',
                            fontWeight: '700',
                            fontSize: '15px',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(124,58,237,0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <span style={{ fontSize: '36px' }}>🌙</span>
                        <span>Dark</span>
                    </button>
                </div>

                <p style={{
                    margin: '20px 0 0 0',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.4)',
                }}>
                    Your choice is saved on this device.
                </p>
            </div>
        </div>
    );
};

export default ThemePicker;