import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/Navigation.css';

function Navigation() {
    const [currentUser, setCurrentUser] = useState(null);
    const [friendRequestCount, setFriendRequestCount] = useState(0);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        getCurrentUser();
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchNotificationCounts();
            const interval = setInterval(fetchNotificationCounts, 30000);
            return () => clearInterval(interval);
        }
    }, [currentUser]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.nav-notification-container')) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
    };

    const fetchNotificationCounts = async () => {
        if (!currentUser) return;
        
        try {
            // Get user's last checked timestamps
            const { data: userPrefs, error: prefsError } = await supabase
                .from('UserPreferences')
                .select('last_checked_notifications, last_checked_messages')
                .eq('user_id', currentUser.id)
                .single();

            let lastCheckedNotifications, lastCheckedMessages;
            
            if (prefsError || !userPrefs) {
                // Create preferences record if it doesn't exist
                // Set initial timestamps to epoch (1970) so existing notifications show up
                const epochTime = '1970-01-01T00:00:00.000Z';
                const { error: insertError } = await supabase
                    .from('UserPreferences')
                    .insert({
                        user_id: currentUser.id,
                        last_checked_notifications: epochTime,
                        last_checked_messages: epochTime
                    });
                
                if (insertError) {
                    console.error('Error creating user preferences:', insertError);
                }
                
                lastCheckedNotifications = epochTime;
                lastCheckedMessages = epochTime;
            } else {
                lastCheckedNotifications = userPrefs.last_checked_notifications;
                lastCheckedMessages = userPrefs.last_checked_messages;
            }

            // Fetch NEW friend requests (created after last check)
            const { data: friendRequests, error: friendError } = await supabase
                .from('Friend')
                .select('user_id, friend_date, User!Friend_user_id_fkey(userName, email)')
                .eq('f_user_id', currentUser.id)
                .eq('status', 'pending')
                .gt('friend_date', lastCheckedNotifications);

            if (!friendError) {
                setFriendRequestCount(friendRequests?.length || 0);
            }

            // Fetch NEW messages (received after last check)
            const { data: recentMessages, error: messageError } = await supabase
                .from('Message')
                .select('sender_id, msg_time, msg_content')
                .eq('receiver_id', currentUser.id)
                .gt('msg_time', lastCheckedMessages);

            console.log('Checking for new messages for user:', currentUser.id);
            console.log('Last checked messages:', lastCheckedMessages);
            console.log('Found new messages:', recentMessages);

            if (!messageError) {
                const messageCount = recentMessages?.length || 0;
                console.log('Setting unread message count to:', messageCount);
                setUnreadMessageCount(messageCount);
                
                // DO NOT redirect automatically - just update the count
                // The user should click Messages themselves
                
            } else {
                console.error('Error fetching messages:', messageError);
            }

            // Prepare notifications for bell (only NEW friend requests)
            const bellNotifications = [
                ...(friendRequests || []).map(req => ({
                    id: `friend_${req.user_id}`,
                    type: 'friend_request',
                    message: `${req.User?.userName || req.User?.email?.split('@')[0]} sent you a friend request`,
                    userId: req.user_id,
                    timestamp: new Date(req.friend_date)
                }))
                // Future: Add post notifications here
            ];

            setNotifications(bellNotifications);

        } catch (error) {
            console.error('Error fetching notification counts:', error);
        }
    };

    // Remove the handleNotificationClick function since we're handling it inline
    
    const handleMessagesClick = async (e) => {
        // Only update the timestamp, don't cause any redirects
        if (!currentUser) return;
        
        console.log('Messages link clicked');
        
        try {
            await supabase
                .from('UserPreferences')
                .upsert({
                    user_id: currentUser.id,
                    last_checked_messages: new Date().toISOString()
                });
            
            // Clear message count immediately
            setUnreadMessageCount(0);
            
        } catch (error) {
            console.error('Error updating message check time:', error);
        }
        
        // Let the Link component handle the navigation naturally
    };

    const handleBellClick = async (e) => {
        e.preventDefault();
        
        if (showNotifications) {
            // If closing the dropdown, mark notifications as seen
            try {
                await supabase
                    .from('UserPreferences')
                    .upsert({
                        user_id: currentUser.id,
                        last_checked_notifications: new Date().toISOString()
                    });
                
                // Clear notifications from UI
                setNotifications([]);
                setFriendRequestCount(0);
                
            } catch (error) {
                console.error('Error updating notification check time:', error);
            }
        }
        
        setShowNotifications(!showNotifications);
    };

    const clearAllNotifications = async (e) => {
        e.stopPropagation();
        
        try {
            // Update last checked time to now
            await supabase
                .from('UserPreferences')
                .upsert({
                    user_id: currentUser.id,
                    last_checked_notifications: new Date().toISOString()
                });
            
            // Clear local state
            setNotifications([]);
            setFriendRequestCount(0);
            setShowNotifications(false);
            
        } catch (error) {
            console.error('Error clearing all notifications:', error);
        }
    };

    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const diff = now - new Date(timestamp);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    return (
        <nav className="nav-bar">
            <Link to="/" className="nav-title-link">
                <div className="nav-title">FriendMesh</div>
            </Link>
            <ul className="nav-list">
                {/* Notification Bell - comes first */}
                <li className="nav-notification-container">
                    <button 
                        className="nav-notification-btn"
                        onClick={handleBellClick}
                    >
                        <svg className="bell-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {notifications.length > 0 && (
                            <span className="nav-badge nav-badge-bell">{notifications.length}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="nav-notification-dropdown">
                            <div className="nav-notification-header">
                                <h3>Notifications</h3>
                                <span className="nav-notification-count">
                                    {notifications.length} new
                                </span>
                            </div>
                            <div className="nav-notification-list">
                                {notifications.length === 0 ? (
                                    <div className="nav-notification-empty">
                                        No new notifications
                                    </div>
                                ) : (
                                    notifications.map(notification => (
                                        <div 
                                            key={notification.id}
                                            className={`nav-notification-item ${notification.type}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (notification.type === 'friend_request') {
                                                    window.location.href = '/friends';
                                                }
                                            }}
                                        >
                                            <div className="nav-notification-icon">
                                                {notification.type === 'friend_request' && (
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                        <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                                                        <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                        <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="nav-notification-content">
                                                <div className="nav-notification-message">
                                                    {notification.message}
                                                </div>
                                                <div className="nav-notification-time">
                                                    {formatTimeAgo(notification.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {notifications.length > 0 && (
                                <div className="nav-notification-footer">
                                    <button 
                                        className="nav-notification-clear"
                                        onClick={clearAllNotifications}
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </li>

                {/* Messages with badge */}
                <li className="nav-item-with-badge">
                    <Link 
                        to="/messages" 
                        className="nav-link" 
                        onClick={handleMessagesClick}
                    >
                        Messages
                        {unreadMessageCount > 0 && (
                            <span className="nav-badge nav-badge-messages">{unreadMessageCount}</span>
                        )}
                    </Link>
                </li>

                <li>
                    <Link to="/edit-account" className="nav-link">
                        Account Settings
                    </Link>
                </li>
                <li>
                    <button
                        className="logout-button"
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.reload();
                        }}
                    >
                        Log Out
                    </button>
                </li>
            </ul>
        </nav>
    );
}

export default Navigation;