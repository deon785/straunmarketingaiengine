import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';

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
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    // Get or create conversation
    const getOrCreateConversation = async () => {
        const { data, error } = await supabase
            .rpc('get_or_create_conversation', {
                p_user1_id: currentUserId,
                p_user2_id: otherUserId,
                p_product_id: productId
            });

        if (error) {
            console.error('Error getting conversation:', error);
            return null;
        }
        return data;
    };

    // Load messages
    const loadMessages = async () => {
        if (!conversationId) return;

        const { data, error } = await supabase
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
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data);
            scrollToBottom();
            
            // Mark messages as read
            await supabase.rpc('mark_conversation_read', {
                p_conversation_id: conversationId,
                p_user_id: currentUserId
            });
        }
    };

    // Send message
    const sendMessage = async () => {
        if (!newMessage.trim() && !uploadingImage) return;
        if (sending) return;

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

        const { data, error } = await supabase
            .from('messages')
            .insert(messageData)
            .select()
            .single();

        if (!error && data) {
            // Replace temp message with real one
            setMessages(prev => prev.map(msg => 
                msg.id === tempId ? data : msg
            ));
            
            // Update conversation last message
            await supabase
                .from('conversations')
                .update({
                    last_message: messageText,
                    last_message_time: new Date().toISOString(),
                    last_message_sender_id: currentUserId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', conversationId);
            
            // Send notification
            await supabase.from('notifications').insert({
                user_id: otherUserId,
                sender_id: currentUserId,
                message: `💬 New message from ${otherUserName}: ${messageText.substring(0, 50)}`,
                link_type: 'chat',
                metadata: { conversation_id: conversationId }
            });
        }
        
        setSending(false);
    };

    // Handle typing indicator
    const handleTyping = useCallback(async () => {
        if (!typing) {
            setTyping(true);
            await supabase
                .from('typing_status')
                .upsert({
                    conversation_id: conversationId,
                    user_id: currentUserId,
                    is_typing: true,
                    updated_at: new Date().toISOString()
                });
        }
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
            setTyping(false);
            await supabase
                .from('typing_status')
                .upsert({
                    conversation_id: conversationId,
                    user_id: currentUserId,
                    is_typing: false,
                    updated_at: new Date().toISOString()
                });
        }, 1000);
    }, [typing, conversationId, currentUserId]);

    // Upload image
    const uploadImage = async (file) => {
        if (!file) return;
        
        setUploadingImage(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `chat-images/${conversationId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);
        
        if (uploadError) {
            console.error('Upload error:', uploadError);
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
        
        const { error } = await supabase
            .from('messages')
            .insert(messageData);
        
        if (!error) {
            await loadMessages();
        }
        
        setUploadingImage(false);
    };

    // Real-time message listener
    useEffect(() => {
        if (!conversationId) return;

        const subscription = supabase
            .channel(`chat-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
            }, (payload) => {
                if (payload.new.sender_id !== currentUserId) {
                    setMessages(prev => [...prev, payload.new]);
                    scrollToBottom();
                    
                    // Play notification sound
                    const audio = new Audio('/notification.mp3');
                    audio.play().catch(e => console.log('Audio play failed'));
                    
                    // Mark as read
                    supabase.rpc('mark_conversation_read', {
                        p_conversation_id: conversationId,
                        p_user_id: currentUserId
                    });
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'typing_status',
                filter: `conversation_id=eq.${conversationId}`
            }, (payload) => {
                if (payload.new.user_id !== currentUserId) {
                    setOtherUserTyping(payload.new.is_typing);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [conversationId, currentUserId]);

    // Initialize chat
    useEffect(() => {
        const init = async () => {
            const convId = await getOrCreateConversation();
            setConversationId(convId);
            await loadMessages();
            setLoading(false);
        };
        init();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading conversation...</p>
            </div>
        );
    }

    return (
        <div style={styles.chatContainer}>
            {/* Chat Header */}
            <div style={styles.chatHeader}>
                <button onClick={onClose} style={styles.backButton}>←</button>
                <div>
                    <div style={styles.headerName}>{otherUserName}</div>
                    {productName && <div style={styles.headerProduct}>📦 {productName}</div>}
                </div>
                {otherUserTyping && <div style={styles.typingIndicator}>typing...</div>}
            </div>

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
                        {msg.reply_to && (
                            <div style={styles.replyPreview}>
                                <div>↳ {msg.reply_to.message?.substring(0, 50)}</div>
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
                                    onClick={() => window.open(msg.image_url)}
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
            {replyTo && (
                <div style={styles.replyBar}>
                    <span>Replying to: {replyTo.message?.substring(0, 50)}</span>
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
                    onChange={(e) => uploadImage(e.target.files[0])}
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

export default ChatSystem;