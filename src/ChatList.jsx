import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const ChatList = ({ userId, onSelectChat, onClose }) => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadConversations();
        
        // Subscribe to new messages
        const subscription = supabase
            .channel('chat-list')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${userId}`
            }, () => {
                loadConversations();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'conversations',
                filter: `participant1_id=eq.${userId},participant2_id=eq.${userId}`
            }, () => {
                loadConversations();
            })
            .subscribe();
            
        return () => supabase.removeChannel(subscription);
    }, [userId]);

    const loadConversations = async () => {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                product:product_id (name, price, image_url),
                participant1:participant1_id (username, location),
                participant2:participant2_id (username, location)
            `)
            .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

        if (!error && data) {
            const formatted = data.map(conv => {
                const otherUser = conv.participant1_id === userId 
                    ? conv.participant2 
                    : conv.participant1;
                const unreadCount = conv.participant1_id === userId 
                    ? conv.unread_count_p1 
                    : conv.unread_count_p2;
                
                return {
                    ...conv,
                    otherUser,
                    unreadCount,
                    otherUserId: otherUser?.user_id
                };
            });
            setConversations(formatted);
        }
        setLoading(false);
    };

    const formatTime = (date) => {
        if (!date) return '';
        const diff = Date.now() - new Date(date).getTime();
        const hours = diff / (1000 * 60 * 60);
        
        if (hours < 24) {
            return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (hours < 48) {
            return 'Yesterday';
        } else {
            return new Date(date).toLocaleDateString();
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading conversations...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button onClick={onClose} style={styles.closeButton}>←</button>
                <h3 style={styles.title}>💬 Messages</h3>
            </div>
            
            {conversations.length === 0 ? (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>💬</div>
                    <p>No conversations yet</p>
                    <p style={styles.emptySubtext}>Start a chat by contacting a seller or buyer</p>
                </div>
            ) : (
                <div style={styles.list}>
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectChat(conv)}
                            style={{
                                ...styles.chatItem,
                                background: conv.unreadCount > 0 ? '#f0f7ff' : 'white'
                            }}
                        >
                            <div style={styles.avatar}>
                                {conv.otherUser?.username?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div style={styles.chatInfo}>
                                <div style={styles.chatHeader}>
                                    <span style={styles.chatName}>
                                        {conv.otherUser?.username || 'User'}
                                    </span>
                                    <span style={styles.chatTime}>
                                        {formatTime(conv.last_message_time)}
                                    </span>
                                </div>
                                <div style={styles.chatPreview}>
                                    {conv.product?.name && (
                                        <span style={styles.productBadge}>
                                            📦 {conv.product.name.substring(0, 20)}
                                        </span>
                                    )}
                                    <span style={styles.lastMessage}>
                                        {conv.last_message?.substring(0, 40)}
                                        {conv.last_message?.length > 40 && '...'}
                                    </span>
                                </div>
                            </div>
                            {conv.unreadCount > 0 && (
                                <div style={styles.unreadBadge}>
                                    {conv.unreadCount}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        height: '100%',
        maxHeight: '600px',
        display: 'flex',
        flexDirection: 'column'
    },
    header: {
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    closeButton: {
        background: 'rgba(255,255,255,0.2)',
        border: 'none',
        color: 'white',
        fontSize: '18px',
        cursor: 'pointer',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    title: {
        margin: 0,
        fontSize: '18px'
    },
    list: {
        flex: 1,
        overflowY: 'auto'
    },
    chatItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '15px',
        borderBottom: '1px solid #e0e0e0',
        cursor: 'pointer',
        transition: 'background 0.2s',
        position: 'relative'
    },
    avatar: {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '18px',
        marginRight: '12px',
        flexShrink: 0
    },
    chatInfo: {
        flex: 1,
        minWidth: 0
    },
    chatHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '5px'
    },
    chatName: {
        fontWeight: 'bold',
        fontSize: '14px'
    },
    chatTime: {
        fontSize: '11px',
        color: '#999'
    },
    chatPreview: {
        fontSize: '13px',
        color: '#666',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    productBadge: {
        background: '#f0f0f0',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        color: '#667eea'
    },
    lastMessage: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    unreadBadge: {
        background: '#667eea',
        color: 'white',
        borderRadius: '50%',
        minWidth: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '8px',
        padding: '0 5px'
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
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
        color: '#999'
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '15px'
    },
    emptySubtext: {
        fontSize: '12px',
        marginTop: '8px'
    }
};

export default ChatList;