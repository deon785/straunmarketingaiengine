import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase'; 

// ✅ Add fetchWithRetry helper
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  throw lastError;
};

const ChatSystem = ({ currentUserId, otherUserId, otherUserName, productId, productName, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [conversationId, setConversationId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [typing, setTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    // Get or create conversation
    const getOrCreateConversation = async () => {
        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() =>
                supabase.rpc('get_or_create_conversation', {
                    p_user1_id: currentUserId,
                    p_user2_id: otherUserId,
                    p_product_id: productId
                })
            );

            if (result.error) {
                console.error('Error getting conversation:', result.error);
                setError('Failed to start conversation');
                return null;
            }
            return result.data;
        } catch (err) {
            console.error('Unexpected error getting conversation:', err);
            setError('Unable to start chat');
            return null;
        }
    };

    // Load messages
    const loadMessages = async () => {
        if (!conversationId) return;

        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() =>
                supabase
                    .from('messages')
                    .select(`
                        *,
                        reply_to:reply_to_id (
                            id,
                            message,
                            sender_id
                        )
                    `)
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true })
            );

            if (!result.error && result.data) {
                setMessages(result.data);
                scrollToBottom();
                
                try {
                    await supabase.rpc('mark_conversation_read', {
                        p_conversation_id: conversationId,
                        p_user_id: currentUserId
                    });
                } catch (readErr) {
                    console.error('Error marking messages as read:', readErr);
                }
            } else if (result.error) {
                console.error('Error loading messages:', result.error);
            }
        } catch (err) {
            console.error('Unexpected error loading messages:', err);
        }
    };

    // Send message
    const sendMessage = async () => {
        // ✅ Check offline status
        if (!navigator.onLine) {
            setError('You are offline. Please connect to the internet to send messages.');
            return;
        }
        
        if ((!newMessage.trim() && !uploadingImage) || sending) return;
        if (!conversationId) {
            setError('Conversation not initialized');
            return;
        }

        setSending(true);
        const messageText = newMessage.trim();
        setNewMessage('');

        const messageData = {
            conversation_id: conversationId,
            sender_id: currentUserId,
            receiver_id: otherUserId,
            message: messageText,
            reply_to_id: replyTo?.id || null,
            created_at: new Date().toISOString()
        };

        // Optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            ...messageData,
            is_read: false,
            is_delivered: false,
            is_temp: true
        };
        setMessages(prev => [...prev, optimisticMessage]);
        scrollToBottom();
        setReplyTo(null);

        try {
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() =>
                supabase
                    .from('messages')
                    .insert(messageData)
                    .select()
                    .single()
            );

            if (!result.error && result.data) {
                // Replace temp message with real one
                setMessages(prev => prev.map(msg => 
                    msg.id === tempId ? result.data : msg
                ));
                
                await supabase
                    .from('conversations')
                    .update({
                        last_message: messageText,
                        last_message_time: new Date().toISOString(),
                        last_message_sender_id: currentUserId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversationId);
                
                await supabase.from('notifications').insert({
                    user_id: otherUserId,
                    sender_id: currentUserId,
                    message: `💬 New message: ${messageText.substring(0, 50)}`,
                    link_type: 'chat',
                    metadata: { conversation_id: conversationId }
                });
            } else if (result.error) {
                console.error('Error sending message:', result.error);
                // Remove optimistic message
                setMessages(prev => prev.filter(msg => msg.id !== tempId));
                setError('Failed to send message');
            }
        } catch (err) {
            console.error('Unexpected error sending message:', err);
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
            setError('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    // Handle typing indicator
    const handleTyping = useCallback(async () => {
        if (!conversationId) return;
        
        if (!typing) {
            setTyping(true);
            try {
                // ✅ Use fetchWithRetry
                await fetchWithRetry(() =>
                    supabase
                        .from('typing_status')
                        .upsert({
                            conversation_id: conversationId,
                            user_id: currentUserId,
                            is_typing: true,
                            updated_at: new Date().toISOString()
                        })
                );
            } catch (err) {
                console.error('Error setting typing status:', err);
            }
        }
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
            setTyping(false);
            try {
                // ✅ Use fetchWithRetry
                await fetchWithRetry(() =>
                    supabase
                        .from('typing_status')
                        .upsert({
                            conversation_id: conversationId,
                            user_id: currentUserId,
                            is_typing: false,
                            updated_at: new Date().toISOString()
                        })
                );
            } catch (err) {
                console.error('Error clearing typing status:', err);
            }
        }, 1000);
    }, [typing, conversationId, currentUserId]);

    // Upload image
    const uploadImage = async (file) => {
        if (!file || !conversationId) {
            setError('Cannot upload image at this time');
            return;
        }
        
        setUploadingImage(true);
        setError(null);
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `chat-images/${conversationId}/${fileName}`;
            
            // ✅ Use fetchWithRetry
            const { error: uploadError } = await fetchWithRetry(() =>
                supabase.storage
                    .from('chat-attachments')
                    .upload(filePath, file)
            );
            
            if (uploadError) {
                console.error('Upload error:', uploadError);
                setError('Failed to upload image');
                setUploadingImage(false);
                return;
            }
            
            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);
            
            // Send message with image
            const messageData = {
                conversation_id: conversationId,
                sender_id: currentUserId,
                receiver_id: otherUserId,
                message: '📷 Image',
                image_url: publicUrl,
                created_at: new Date().toISOString()
            };
            
            // ✅ Use fetchWithRetry
            const result = await fetchWithRetry(() =>
                supabase.from('messages').insert(messageData)
            );
            
            if (result.error) {
                console.error('Error sending image message:', result.error);
                setError('Failed to send image');
            } else {
                await loadMessages();
            }
        } catch (err) {
            console.error('Unexpected error uploading image:', err);
            setError('Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    // Real-time message listener
    useEffect(() => {
        if (!conversationId) return;

        let subscription = null;
        
        try {
            subscription = supabase
                .channel(`chat-${conversationId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                }, (payload) => {
                    if (payload.new && payload.new.sender_id !== currentUserId) {
                        setMessages(prev => [...prev, payload.new]);
                        scrollToBottom();
                        
                        try {
                            const audio = new Audio('/notification.mp3');
                            audio.volume = 0.3;
                            audio.play().catch(e => console.log('Audio play failed:', e));
                        } catch (audioErr) {
                            console.log('Audio not supported');
                        }
                        
                        supabase.rpc('mark_conversation_read', {
                            p_conversation_id: conversationId,
                            p_user_id: currentUserId
                        }).catch(err => console.error('Error marking read:', err));
                    }
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'typing_status',
                    filter: `conversation_id=eq.${conversationId}`
                }, (payload) => {
                    if (payload.new && payload.new.user_id !== currentUserId) {
                        setOtherUserTyping(payload.new.is_typing || false);
                    }
                })
                .subscribe((status, err) => {
                    if (status === 'CHANNEL_ERROR') {
                        console.error('Chat subscription error:', err);
                    }
                });
        } catch (err) {
            console.error('Failed to create subscription:', err);
        }

        return () => {
            if (subscription) {
                try {
                    supabase.removeChannel(subscription);
                } catch (err) {
                    console.error('Error removing channel:', err);
                }
            }
        };
    }, [conversationId, currentUserId]);

    // Initialize chat
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);
            
            if (!currentUserId || !otherUserId) {
                setError('Invalid user information');
                setLoading(false);
                return;
            }
            
            const convId = await getOrCreateConversation();
            if (convId) {
                setConversationId(convId);
                await loadMessages();
            }
            setLoading(false);
        };
        init();
    }, [currentUserId, otherUserId]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const formatTime = (date) => {
        if (!date) return '';
        try {
            return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (err) {
            return '';
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading conversation...</p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={styles.chatContainer}>
            {/* Chat Header */}
            <div style={styles.chatHeader}>
                <button onClick={onClose} style={styles.backButton}>←</button>
                <div>
                    <div style={styles.headerName}>{otherUserName || 'User'}</div>
                    {productName && <div style={styles.headerProduct}>📦 {productName}</div>}
                </div>
                {otherUserTyping && <div style={styles.typingIndicator}>typing...</div>}
            </div>

            {/* Error Message */}
            {error && (
                <div style={styles.errorBanner}>
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)} style={styles.errorClose}>×</button>
                </div>
            )}

            {/* Messages Area */}
            <div style={styles.messagesArea}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            ...styles.messageWrapper,
                            justifyContent: msg.sender_id === currentUserId ? 'flex-end' : 'flex-start'
                        }}
                    >
                        {msg.reply_to && msg.reply_to.message && (
                            <div style={styles.replyPreview}>
                                <div>↳ {msg.reply_to.message.substring(0, 50)}</div>
                            </div>
                        )}
                        <div
                            style={{
                                ...styles.messageBubble,
                                backgroundColor: msg.sender_id === currentUserId ? '#667eea' : '#f1f1f1',
                                color: msg.sender_id === currentUserId ? 'white' : '#333'
                            }}
                        >
                            {msg.image_url && (
                                <img 
                                    src={msg.image_url} 
                                    alt="Shared"
                                    style={styles.messageImage}
                                    onClick={() => window.open(msg.image_url, '_blank')}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            )}
                            {msg.message && <div>{msg.message}</div>}
                            <div style={styles.messageTime}>
                                {formatTime(msg.created_at)}
                                {msg.sender_id === currentUserId && (
                                    <span style={{ marginLeft: '5px' }}>
                                        {msg.is_read ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {uploadingImage && (
                    <div style={styles.uploadingIndicator}>
                        <div style={styles.spinnerSmall}></div>
                        <span>Uploading image...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            {replyTo && replyTo.message && (
                <div style={styles.replyBar}>
                    <span>Replying to: {replyTo.message.substring(0, 50)}</span>
                    <button onClick={() => setReplyTo(null)} style={styles.cancelReply}>×</button>
                </div>
            )}

            {/* Input Area */}
            <div style={styles.inputArea}>
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    style={styles.attachButton}
                    disabled={uploadingImage}
                >
                    📎
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={(e) => uploadImage(e.target.files?.[0])}
                />
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                        handleTyping();
                    }}
                    placeholder="Type a message..."
                    style={styles.messageInput}
                    disabled={sending}
                />
                <button 
                    onClick={sendMessage} 
                    style={styles.sendButton}
                    disabled={sending || (!newMessage.trim() && !uploadingImage)}
                >
                    {sending ? '...' : 'Send'}
                </button>
            </div>
        </div>
    );
};

const styles = {
    chatContainer: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '600px',
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    },
    chatHeader: {
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        position: 'relative'
    },
    backButton: {
        background: 'rgba(255,255,255,0.2)',
        border: 'none',
        color: 'white',
        fontSize: '20px',
        cursor: 'pointer',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerName: {
        fontWeight: 'bold',
        fontSize: '16px'
    },
    headerProduct: {
        fontSize: '12px',
        opacity: 0.8
    },
    typingIndicator: {
        position: 'absolute',
        bottom: '5px',
        right: '20px',
        fontSize: '11px',
        opacity: 0.7,
        fontStyle: 'italic'
    },
    errorBanner: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 15px',
        background: '#fee',
        color: '#c00',
        fontSize: '13px',
        borderBottom: '1px solid #fcc'
    },
    errorClose: {
        background: 'none',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        color: '#c00'
    },
    messagesArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: '#f8f9fa'
    },
    messageWrapper: {
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '70%'
    },
    messageBubble: {
        padding: '10px 12px',
        borderRadius: '18px',
        position: 'relative',
        wordWrap: 'break-word'
    },
    messageTime: {
        fontSize: '10px',
        opacity: 0.6,
        marginTop: '4px',
        textAlign: 'right'
    },
    messageImage: {
        maxWidth: '200px',
        maxHeight: '200px',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: '5px'
    },
    inputArea: {
        display: 'flex',
        padding: '12px',
        gap: '8px',
        background: 'white',
        borderTop: '1px solid #e0e0e0',
        alignItems: 'center'
    },
    messageInput: {
        flex: 1,
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '20px',
        fontSize: '14px',
        outline: 'none'
    },
    sendButton: {
        background: '#667eea',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '20px',
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    attachButton: {
        background: '#f1f1f1',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '50%',
        cursor: 'pointer',
        fontSize: '18px'
    },
    replyPreview: {
        fontSize: '11px',
        color: '#666',
        marginBottom: '3px',
        paddingLeft: '10px'
    },
    replyBar: {
        padding: '8px 12px',
        background: '#f1f1f1',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #e0e0e0'
    },
    cancelReply: {
        background: 'none',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        color: '#999'
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        gap: '15px'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    spinnerSmall: {
        width: '16px',
        height: '16px',
        border: '2px solid #f3f3f3',
        borderTop: '2px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    uploadingIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px',
        justifyContent: 'center'
    }
};

export default React.memo(ChatSystem);