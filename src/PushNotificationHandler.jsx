import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import './PushNotificationHandler.css';

const PushNotificationHandler = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState('default');
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState(null);
    const [isPromptVisible, setIsPromptVisible] = useState(true);
    const [hasUserDecided, setHasUserDecided] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            const currentPermission = Notification.permission;
            setPermission(currentPermission);
            
            if (currentPermission !== 'default') {
                setIsPromptVisible(false);
                setHasUserDecided(true);
            }
        }

        checkUser();
        
        const interval = setInterval(() => {
            if (isSupported) {
                setPermission(Notification.permission);
            }
        }, 3000);
        
        return () => clearInterval(interval);
    }, [isSupported]);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);
        }
    };

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const registerPushServiceWorker = async () => {
        try {
            console.log('📱 Registering push service worker...');
            
            const registrations = await navigator.serviceWorker.getRegistrations();
            const existingPushSW = registrations.find(reg => 
                reg.active?.scriptURL?.includes('blob:') || 
                (reg.scope === '/' && !reg.active?.scriptURL?.includes('sw.js'))
            );
            
            if (existingPushSW) {
                console.log('✅ Push service worker already registered');
                return existingPushSW;
            }
            
            const response = await fetch('/push-sw.js');
            if (!response.ok) {
                throw new Error(`Failed to fetch push-sw.js: ${response.status}`);
            }
            
            const code = await response.text();
            const blob = new Blob([code], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            
            const registration = await navigator.serviceWorker.register(url, {
                scope: '/',
                updateViaCache: 'none'
            });
            
            console.log('✅ Push service worker registered');
            URL.revokeObjectURL(url);
            
            return registration;
            
        } catch (error) {
            console.error('❌ Failed to register push service worker:', error);
            return null;
        }
    };

    const testNotification = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification('StraunAI Test', {
                body: 'Push notifications are working! 🎉',
                icon: '/pwa-192x192.png',
                badge: '/favicon.ico',
                data: { url: window.location.origin },
                vibrate: [200, 100, 200]
            });
            return true;
        } catch (error) {
            console.error('❌ Failed to show test notification:', error);
            return false;
        }
    };

    const handleAllowClick = async () => {
        setIsLoading(true);
        setStatus('Setting up push notifications...');
        
        try {
            setIsPromptVisible(false);
            setHasUserDecided(true);
            await enablePushNotifications();
            
        } catch (error) {
            console.error('Error in handleAllowClick:', error);
            setStatus(`❌ Error: ${error.message}`);
            setIsLoading(false);
        }
    };

    const handleDenyClick = () => {
        setIsPromptVisible(false);
        setHasUserDecided(true);
        setStatus('Notifications not enabled. You can enable them later.');
        localStorage.setItem('pushNotificationDeclined', 'true');
    };

    const showPromptAgain = () => {
        setIsPromptVisible(true);
        setHasUserDecided(false);
    };

    const unsubscribeFromPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                const successful = await subscription.unsubscribe();
                
                if (successful) {
                    if (userId) {
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('user_id', userId)
                            .eq('endpoint', subscription.endpoint);
                    }
                    
                    setPermission('default');
                    setStatus('✅ Push notifications disabled');
                } else {
                    setStatus('❌ Failed to unsubscribe');
                }
            } else {
                setStatus('❌ No active subscription found');
            }
        } catch (error) {
            console.error('Error unsubscribing:', error);
            setStatus('❌ Error disabling notifications');
        }
    };

    const checkSubscriptionStatus = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (!registration) {
                setStatus('❌ No service worker registered');
                return;
            }
            
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                if (userId) {
                    const { data } = await supabase
                        .from('push_subscriptions')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('endpoint', subscription.endpoint)
                        .single();
                    
                    if (data) {
                        setStatus('✅ Push notifications are active and saved');
                    } else {
                        setStatus('⚠️ Active but not saved to server');
                    }
                } else {
                    setStatus('✅ Active (not logged in)');
                }
            } else {
                setStatus('❌ Not subscribed to push notifications');
            }
        } catch (error) {
            console.error('Error checking status:', error);
            setStatus('❌ Error checking status');
        }
    };

    const debugServiceWorkers = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('=== Service Worker Debug Info ===');
        console.log('Total registrations:', registrations.length);
        
        registrations.forEach((reg, i) => {
            console.log(`\n${i + 1}. Registration:`);
            console.log('   Scope:', reg.scope);
            console.log('   Script URL:', reg.active?.scriptURL);
            console.log('   State:', reg.active?.state);
            
            reg.pushManager.getSubscription().then(sub => {
                console.log('   Push Subscription:', sub ? 'Yes' : 'No');
            });
        });
        
        fetch('/push-sw.js')
            .then(r => console.log('\npush-sw.js status:', r.status))
            .catch(e => console.log('\npush-sw.js error:', e));
        
        fetch('/sw.js')
            .then(r => console.log('sw.js status:', r.status))
            .catch(e => console.log('sw.js error:', e));
    };

    const enablePushNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setStatus('❌ Please login first');
                setIsLoading(false);
                return;
            }
            setUserId(user.id);
            
            if (Notification.permission === 'default') {
                setStatus('Requesting permission...');
                const permissionResult = await Notification.requestPermission();
                setPermission(permissionResult);
                
                if (permissionResult !== 'granted') {
                    setStatus('❌ Permission denied');
                    setIsLoading(false);
                    return;
                }
            } else if (Notification.permission === 'denied') {
                setStatus('❌ Notifications are blocked. Please enable in browser settings.');
                setIsLoading(false);
                return;
            }
            
            setStatus('✅ Permission granted! Registering push service worker...');
            
            const registration = await registerPushServiceWorker();
            if (!registration) {
                setStatus('❌ Failed to register push service worker');
                setIsLoading(false);
                return;
            }
            
            await navigator.serviceWorker.ready;
            setStatus('Subscribing to push notifications...');
            
            const VAPID_PUBLIC_KEY = 'BE0bHzM7cNXwAzyuA6g56NEG7O-4XABAy5gCuiQ64478oryU_iTb9P9IXsMlG3ZQnNFwI0MwjVz3BPUwL_bRo8E';
            
            let subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                console.log('✅ Already subscribed to push');
                setStatus('Already subscribed. Saving to server...');
            } else {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
                console.log('✅ Created new subscription');
            }
            
            setStatus('Saving subscription to database...');
            
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    subscription: subscription.toJSON(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,endpoint'
                });
            
            if (error) throw error;
            
            setPermission('granted'); 
            
            setTimeout(async () => {
                const sent = await testNotification();
                if (sent) {
                    setStatus('✅ Push notifications enabled and tested!');
                } else {
                    setStatus('✅ Push enabled but test failed. Check console.');
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error enabling push:', error);
            setStatus(`❌ Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const sendTestNotification = async () => {
        if (!userId) {
            setStatus('❌ Please login first');
            return;
        }

        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    user_id: userId,
                    message: '🔔 Test Push Notification!',
                    type: 'test',
                    status: 'unread',
                    created_at: new Date().toISOString(),
                    product_image: null,
                    buyer_phone: null
                });

            if (error) throw error;
            
            const sent = await testNotification();
            
            if (sent) {
                setStatus('✅ Test notification sent! Check your notifications.');
            } else {
                setStatus('❌ Could not show notification. Check service worker.');
            }
            
        } catch (error) {
            console.error('Error sending test notification:', error);
            setStatus('❌ Error sending test notification');
        }
    };

    if (!isSupported) {
        return (
            <div className="push-notification-container unsupported">
                <h3>🔔 Push Notifications</h3>
                <div className="notification-message warning">
                    <p><strong>Push notifications are not supported</strong></p>
                    <p>Your browser doesn't support push notifications.</p>
                </div>
            </div>
        );
    }

    // THIS PART MAKES THE CODE DISAPPEAR WHEN ENABLED
    if (permission === 'granted' && !isPromptVisible) {
        return null; 
    }

    return (
        <>
            {isPromptVisible && (
                <div className="push-notification-prompt-overlay">
                    <div className="push-notification-prompt">
                        <div className="prompt-header">
                            <h3>🔔 Enable Push Notifications?</h3>
                            <button 
                                className="close-prompt"
                                onClick={handleDenyClick}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        
                        <div className="prompt-body">
                            <p>Get real-time updates for:</p>
                            <ul>
                                <li>✅ New messages and alerts</li>
                                <li>✅ Important announcements</li>
                                <li>✅ Time-sensitive notifications</li>
                            </ul>
                            <p className="prompt-note">
                                You can change this anytime in settings.
                            </p>
                        </div>
                        
                        <div className="prompt-actions">
                            <button 
                                className="btn btn-primary prompt-allow"
                                onClick={handleAllowClick}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Setting Up...' : 'Allow Notifications'}
                            </button>
                            
                            <button 
                                className="btn btn-secondary prompt-deny"
                                onClick={handleDenyClick}
                            >
                                Not Now
                            </button>
                        </div>
                        
                        <div className="prompt-footer">
                            <small>
                                Notifications help you stay updated even when the app is closed.
                            </small>
                        </div>
                    </div>
                </div>
            )}

            <div className={`push-notification-container ${hasUserDecided ? 'minimized' : ''}`}>
                <h3>🔔 Push Notifications</h3>
                
                {hasUserDecided && (
                    <button 
                        className="btn btn-small show-again"
                        onClick={showPromptAgain}
                    >
                        Show Prompt Again
                    </button>
                )}
                
                <div className="status-indicator">
                    <div className={`status-badge ${permission === 'granted' ? 'granted' : 'not-granted'}`}>
                        {permission === 'granted' ? '✅ Enabled' : '⚠️ Not Enabled'}
                    </div>
                    {userId && <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>User: {userId.substring(0, 8)}...</small>}
                </div>
                
                <div className="button-group">
                    {permission !== 'granted' && (
                        <button 
                            className="btn btn-primary"
                            onClick={handleAllowClick}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Setting Up...' : 'Enable Push Notifications'}
                        </button>
                    )}
                    
                    <button 
                        className="btn btn-secondary"
                        onClick={sendTestNotification}
                        disabled={permission !== 'granted' || !userId}
                    >
                        Test Notification
                    </button>
                    
                    {permission === 'granted' && (
                        <button 
                            className="btn btn-danger"
                            onClick={unsubscribeFromPush}
                        >
                            Disable
                        </button>
                    )}
                    
                    <button 
                        className="btn btn-help"
                        onClick={checkSubscriptionStatus}
                    >
                        Check Status
                    </button>
                </div>
                
                {status && (
                    <div className={`status-message ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : 'info'}`}>
                        {status}
                    </div>
                )}
                
                <div className="instructions">
                    <p><strong>Debug Info:</strong></p>
                    <button 
                        className="btn btn-small"
                        onClick={debugServiceWorkers}
                    >
                        Debug Service Workers
                    </button>
                    
                    <div className="note">
                        <p><strong>How it works:</strong></p>
                        <ol>
                            <li>VitePWA auto-generates <code>/sw.js</code> for caching and offline support</li>
                            <li>Push notifications use a separate <code>/push-sw.js</code> service worker</li>
                            <li>Subscriptions are saved to Supabase database</li>
                        </ol>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PushNotificationHandler;