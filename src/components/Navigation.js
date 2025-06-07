import React, { useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/Navigation.css';

// reducer
const initialState = {
  friendRequestCount: 0,
  unreadMessageCount: 0,
  notifications: [],
  showNotifications: false
};

function notificationReducer(state, action) {
  switch (action.type) {
    case 'SET_COUNTS':
      return {
        ...state,
        friendRequestCount: action.payload.friendRequestCount,
        unreadMessageCount: action.payload.unreadMessageCount,
        notifications: action.payload.notifications
      };
    case 'TOGGLE_NOTIFICATIONS':
      return { ...state, showNotifications: !state.showNotifications };
    case 'HIDE_NOTIFICATIONS':
      return { ...state, showNotifications: false };
    case 'CLEAR_MESSAGES':
      return { ...state, unreadMessageCount: 0 };
    case 'CLEAR_ALL_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
        friendRequestCount: 0,
        showNotifications: false
      };
    default:
      return state;
  }
}

// managing current user
function useCurrentUser() {
  const [userId, setUserId] = useState(null);
  const userRef = useRef(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userRef.current = user;
      setUserId(user?.id);
    };
    
    getCurrentUser();
  }, []);

  return { userId, userRef };
}

// notification fetching
function useNotifications(userId, userRef) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const lastCheckedRef = useRef({
    notifications: null,
    messages: null
  });

  const fetchNotificationCounts = async () => {
    if (!userId || !userRef.current) return;
    
    try {
      const { data: userPrefs, error: prefsError } = await supabase
        .from('UserPreferences')
        .select('last_checked_notifications, last_checked_messages')
        .eq('user_id', userId)
        .single();

      let lastCheckedNotifications, lastCheckedMessages;
      
      if (prefsError || !userPrefs) {
        const epochTime = '1970-01-01T00:00:00.000Z';
        const { error: insertError } = await supabase
          .from('UserPreferences')
          .insert({
            user_id: userId,
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


      lastCheckedRef.current = {
        notifications: lastCheckedNotifications,
        messages: lastCheckedMessages
      };

      // fetch friend requests
      const { data: friendRequests, error: friendError } = await supabase
        .from('Friend')
        .select('user_id, friend_date, User!Friend_user_id_fkey(userName, email)')
        .eq('f_user_id', userId)
        .eq('status', 'pending')
        .gt('friend_date', lastCheckedNotifications);

      // fetch unread messages
      const { data: recentMessages, error: messageError } = await supabase
        .from('Message')
        .select('sender_id, msg_time, msg_content')
        .eq('receiver_id', userId)
        .gt('msg_time', lastCheckedMessages);

      console.log('Checking for new messages for user:', userId);
      console.log('Last checked messages:', lastCheckedMessages);
      console.log('Found new messages:', recentMessages);

      if (messageError) {
        console.error('Error fetching messages:', messageError);
      }

      const bellNotifications = (friendRequests || []).map(req => ({
        id: `friend_${req.user_id}`,
        type: 'friend_request',
        message: `${req.User?.userName || req.User?.email?.split('@')[0]} sent you a friend request`,
        userId: req.user_id,
        timestamp: new Date(req.friend_date)
      }));

      dispatch({
        type: 'SET_COUNTS',
        payload: {
          friendRequestCount: friendRequests?.length || 0,
          unreadMessageCount: recentMessages?.length || 0,
          notifications: bellNotifications
        }
      });

    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotificationCounts();
      const interval = setInterval(fetchNotificationCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  return { state, dispatch, fetchNotificationCounts, lastCheckedRef };
}

function Navigation() {
  const { userId, userRef } = useCurrentUser();
  const { state, dispatch, lastCheckedRef } = useNotifications(userId, userRef);

  // close notifications
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.nav-notification-container')) {
        dispatch({ type: 'HIDE_NOTIFICATIONS' });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // time formatting
  const formatTimeAgo = useMemo(() => (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  const handleMessagesClick = async (e) => {
    if (!userId) return;
    
    console.log('Messages link clicked');
    
    try {
      await supabase
        .from('UserPreferences')
        .upsert({
          user_id: userId,
          last_checked_messages: new Date().toISOString()
        });
      
      dispatch({ type: 'CLEAR_MESSAGES' });
      
    } catch (error) {
      console.error('Error updating message check time:', error);
    }
  };

  const handleBellClick = async (e) => {
    e.preventDefault();
    
    if (state.showNotifications) {
      try {
        await supabase
          .from('UserPreferences')
          .upsert({
            user_id: userId,
            last_checked_notifications: new Date().toISOString()
          });
        
        dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' });
        
      } catch (error) {
        console.error('Error updating notification check time:', error);
      }
    } else {
      dispatch({ type: 'TOGGLE_NOTIFICATIONS' });
    }
  };

  const clearAllNotifications = async (e) => {
    e.stopPropagation();
    
    try {
      await supabase
        .from('UserPreferences')
        .upsert({
          user_id: userId,
          last_checked_notifications: new Date().toISOString()
        });
      
      dispatch({ type: 'CLEAR_ALL_NOTIFICATIONS' });
      
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  return (
    <nav className="nav-bar">
      <a href="/" className="nav-title-link">
        <div className="nav-title">FriendMesh</div>
      </a>
      <ul className="nav-list">
        <li className="nav-notification-container">
          <button 
            className="nav-notification-btn"
            onClick={handleBellClick}
          >
            <svg className="bell-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {state.notifications.length > 0 && (
              <span className="nav-badge nav-badge-bell">{state.notifications.length}</span>
            )}
          </button>

          {state.showNotifications && (
            <div className="nav-notification-dropdown">
              <div className="nav-notification-header">
                <h3>Notifications</h3>
                <span className="nav-notification-count">
                  {state.notifications.length} new
                </span>
              </div>
              <div className="nav-notification-list">
                {state.notifications.length === 0 ? (
                  <div className="nav-notification-empty">
                    No new notifications
                  </div>
                ) : (
                  state.notifications.map(notification => (
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
              {state.notifications.length > 0 && (
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
        <li className="nav-item-with-badge">
          <a 
            href="/messages" 
            className="nav-link" 
            onClick={handleMessagesClick}
          >
            Messages
            {state.unreadMessageCount > 0 && (
              <span className="nav-badge nav-badge-messages">{state.unreadMessageCount}</span>
            )}
          </a>
        </li>

        <li>
          <a href="/edit-account" className="nav-link">
            Account Settings
          </a>
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