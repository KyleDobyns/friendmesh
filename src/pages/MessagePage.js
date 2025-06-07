import React, { useState, useEffect, useRef, useMemo, useReducer } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/MessagePage.css';

// reducer
const initialState = {
  friends: [],
  selectedFriend: null,
  messages: [],
  loading: false,
  error: null
};

function messagesReducer(state, action) {
  switch (action.type) {
    case 'SET_FRIENDS':
      return { ...state, friends: action.payload };
    case 'SELECT_FRIEND':
      return { ...state, selectedFriend: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

function useFriends(userId) {
  const [friends, setFriends] = useState([]);
  
  const fetchFriends = async () => {
    if (!userId) return;
    
    try {
      console.log('Fetching friends for user:', userId);
      
      const { data: sentFriends, error: sentError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const { data: receivedFriends, error: receivedError } = await supabase
        .from('Friend')
        .select(`
          user_id,
          friend_date,
          User!Friend_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('f_user_id', userId)
        .eq('status', 'accepted');

      if (sentError) console.error('Error fetching sent friends:', sentError);
      if (receivedError) console.error('Error fetching received friends:', receivedError);

      const allFriends = [];
      
      if (sentFriends) {
        sentFriends.forEach(friend => {
          if (friend.User) {
            allFriends.push({
              ...friend.User,
              friendshipDate: friend.friend_date
            });
          }
        });
      }

      if (receivedFriends) {
        receivedFriends.forEach(friend => {
          if (friend.User) {
            allFriends.push({
              ...friend.User,
              friendshipDate: friend.friend_date
            });
          }
        });
      }

      const uniqueFriends = allFriends.filter((friend, index, self) => 
        index === self.findIndex(f => f.user_id === friend.user_id)
      );

      // sort friends by recent activity
      await sortFriendsByRecentActivity(uniqueFriends, userId);
      
      console.log('Found friends:', uniqueFriends);
      setFriends(uniqueFriends);
      
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriends([]);
    }
  };

  const sortFriendsByRecentActivity = async (friendsList, currentUserId) => {
    const lastCheckedTime = window.lastCheckedMessages ? new Date(window.lastCheckedMessages) : new Date(0);
    
    for (let friend of friendsList) {
      try {
        const { data: recentMessage } = await supabase
          .from('Message')
          .select('msg_time, sender_id')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friend.user_id}),and(sender_id.eq.${friend.user_id},receiver_id.eq.${currentUserId})`)
          .order('msg_time', { ascending: false })
          .limit(1)
          .single();
        
        friend.lastMessageTime = recentMessage?.msg_time || friend.friendshipDate;
        
        const { data: newMessages } = await supabase
          .from('Message')
          .select('msg_id')
          .eq('sender_id', friend.user_id)
          .eq('receiver_id', currentUserId)
          .gt('msg_time', lastCheckedTime.toISOString());
        
        friend.hasNewMessages = (newMessages && newMessages.length > 0);
        
      } catch (error) {
        friend.lastMessageTime = friend.friendshipDate;
        friend.hasNewMessages = false;
      }
    }
    
    friendsList.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  };

  useEffect(() => {
    fetchFriends();
  }, [userId]);

  return { friends, refetchFriends: fetchFriends };
}

function Messages() {
  const [state, dispatch] = useReducer(messagesReducer, initialState);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // use refs to reduce useStates
  const currentUserRef = useRef(null);
  const lastCheckedTimeRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  
  const [userId, setUserId] = useState(null);
  
  
  const { friends, refetchFriends } = useFriends(userId);
  
  useEffect(() => {
    dispatch({ type: 'SET_FRIENDS', payload: friends });
  }, [friends]);

  // last seen time
  useEffect(() => {
    const initializeUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserRef.current = user;
      setUserId(user?.id);
      
      if (user) {
        // last seen message time
        try {
          const { data: userPrefs } = await supabase
            .from('UserPreferences')
            .select('last_checked_messages')
            .eq('user_id', user.id)
            .single();
          
          if (userPrefs?.last_checked_messages) {
            window.lastCheckedMessages = userPrefs.last_checked_messages;
            lastCheckedTimeRef.current = userPrefs.last_checked_messages;
          }
        } catch (error) {
          console.error('Error fetching last seen time:', error);
        }
      }
    };
    
    initializeUser();
  }, []);

  // scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);


  const filteredFriends = useMemo(() => {
    return state.friends.filter(friend => {
      const searchLower = searchTerm.toLowerCase();
      const name = friend.userName || friend.email?.split('@')[0] || '';
      const email = friend.email || '';
      const bio = friend.bio || '';
      
      return name.toLowerCase().includes(searchLower) ||
             email.toLowerCase().includes(searchLower) ||
             bio.toLowerCase().includes(searchLower);
    });
  }, [state.friends, searchTerm]);

  // new message IDs
  const newMessageIds = useMemo(() => {
    if (!lastCheckedTimeRef.current || !state.messages.length) return new Set();
    
    const lastChecked = new Date(lastCheckedTimeRef.current);
    return new Set(
      state.messages
        .filter(msg => 
          new Date(msg.msg_time) > lastChecked && 
          msg.sender_id !== currentUserRef.current?.id
        )
        .map(msg => msg.msg_id)
    );
  }, [state.messages]);

  // last seen message time update
  const updateLastSeenMessageTime = async () => {
    if (!currentUserRef.current) return;
    
    try {
      const now = new Date().toISOString();
      await supabase
        .from('UserPreferences')
        .upsert({
          user_id: currentUserRef.current.id,
          last_checked_messages: now
        });
      
      window.lastCheckedMessages = now;
      lastCheckedTimeRef.current = now;
    } catch (error) {
      console.error('Error updating last seen time:', error);
    }
  };

  // get messages
  const fetchMessages = async (friendId) => {
    if (!currentUserRef.current || !friendId) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      console.log('Fetching messages between:', currentUserRef.current.id, 'and', friendId);
      
      const { data: messagesData, error } = await supabase
        .from('Message')
        .select('*')
        .or(`and(sender_id.eq.${currentUserRef.current.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserRef.current.id})`)
        .order('msg_time', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        dispatch({ type: 'SET_MESSAGES', payload: [] });
      } else {
        console.log('Found messages:', messagesData);
        dispatch({ type: 'SET_MESSAGES', payload: messagesData || [] });
        
        if (messagesData?.some(msg => 
          new Date(msg.msg_time) > new Date(lastCheckedTimeRef.current || 0) && 
          msg.sender_id !== currentUserRef.current?.id
        )) {
          setTimeout(() => updateLastSeenMessageTime(), 5000);
        }
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      dispatch({ type: 'SET_MESSAGES', payload: [] });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSelectFriend = (friend) => {
    console.log('Selected friend:', friend);
    dispatch({ type: 'SELECT_FRIEND', payload: friend });
    fetchMessages(friend.user_id);
    setTimeout(() => updateLastSeenMessageTime(), 1000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserRef.current || !state.selectedFriend) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      console.log('Sending message from', currentUserRef.current.id, 'to', state.selectedFriend.user_id);
      
      const messageData = {
        sender_id: currentUserRef.current.id,
        receiver_id: state.selectedFriend.user_id,
        msg_content: newMessage.trim(),
        msg_time: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('Message')
        .insert(messageData)
        .select();

      if (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
      } else {
        console.log('Message sent successfully:', data);
        setNewMessage('');
        await fetchMessages(state.selectedFriend.user_id);
        await refetchFriends();
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      alert('Failed to send message');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className="messages-container">
      <div className="contacts-sidebar">
        <h3>Messages</h3>
        
        <div className="search-bar-container">
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar-input"
          />
        </div>
        
        {state.friends.length === 0 ? (
          <div className="no-friends-message">
            <p>No friends to message yet.</p>
            <a 
              href="/friends"
              className="add-friends-btn"
            >
              Add Friends
            </a>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className="no-friends-message no-friends-filtered">
            <p>No friends found matching "{searchTerm}"</p>
            <button 
              onClick={() => setSearchTerm('')}
              className="clear-search-btn"
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul className="contacts-list">
            {filteredFriends.map(friend => (
              <li
                key={friend.user_id}
                onClick={() => handleSelectFriend(friend)}
                className={`contact-item${state.selectedFriend?.user_id === friend.user_id ? ' selected' : ''}${friend.hasNewMessages ? ' has-new-messages' : ''}`}
              >
                <div className="contact-avatar-row">
                  <div className="contact-avatar">
                    {friend.avatar_url ? (
                      <img 
                        src={friend.avatar_url} 
                        alt="Avatar" 
                        className="avatar-img"
                      />
                    ) : (
                      (friend.userName || friend.email)?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="contact-name">
                      {friend.userName || friend.email?.split('@')[0] || 'Unknown User'}
                    </div>
                    <div className="contact-bio">
                      {friend.bio ? friend.bio.substring(0, 20) + '...' : 'No bio'}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="messages-area">
        {state.selectedFriend ? (
          <>
            <div className="contact-header">
              <div className="contact-avatar">
                {state.selectedFriend.avatar_url ? (
                  <img 
                    src={state.selectedFriend.avatar_url} 
                    alt="Avatar" 
                    className="avatar-img"
                  />
                ) : (
                  (state.selectedFriend.userName || state.selectedFriend.email)?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="contact-name">
                  {state.selectedFriend.userName || state.selectedFriend.email?.split('@')[0] || 'Unknown User'}
                </div>
                <div className="contact-status">
                  Friends since {new Date(state.selectedFriend.friendshipDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="messages-list">
              {state.loading ? (
                <div className="no-messages">Loading messages...</div>
              ) : state.messages.length === 0 ? (
                <div className="no-messages">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                <>
                  {state.messages.map(message => {
                    const isFromCurrentUser = message.sender_id === currentUserRef.current?.id;
                    const isNewMessage = newMessageIds.has(message.msg_id);
                    
                    return (
                      <div
                        key={message.msg_id}
                        className={`message-bubble${isFromCurrentUser ? ' sent' : ' received'}${isNewMessage ? ' new-message' : ''}`}
                      >
                        {isNewMessage && !isFromCurrentUser && (
                          <div className="new-message-indicator">New</div>
                        )}
                        {message.msg_content}
                        <div className="message-time">
                          {new Date(message.msg_time).toLocaleTimeString()}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="message-input-row">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
                disabled={state.loading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !state.loading) {
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                className="send-button"
                disabled={state.loading || !newMessage.trim()}
              >
                {state.loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="select-contact-message">
            {state.friends.length === 0 ? 
              'Add some friends to start messaging!' : 
              filteredFriends.length === 0 ?
                `No friends found matching "${searchTerm}"` :
                'Select a friend to start messaging'
            }
          </div>
        )}
      </div>

      <div className="profile-sidebar">
        {state.selectedFriend ? (
          <>
            <div className="profile-header">
              {state.selectedFriend.avatar_url ? (
                <img 
                  src={state.selectedFriend.avatar_url} 
                  alt={`${state.selectedFriend.userName || state.selectedFriend.email?.split('@')[0] || 'User'}'s Avatar`} 
                  className="profile-avatar" 
                />
              ) : (
                <div className="profile-avatar-placeholder">
                  {(state.selectedFriend.userName || state.selectedFriend.email)?.charAt(0).toUpperCase() || 'F'}
                </div>
              )}

              <h3>
                {state.selectedFriend.userName || state.selectedFriend.email?.split('@')[0] || 'Unknown User'}
              </h3>
            </div>

            <div className="profile-details">
              {state.selectedFriend.bio ? (
                <>
                  <h4>Bio:</h4>
                  <p>{state.selectedFriend.bio}</p>
                </>
              ) : (
                <>
                  <h4>Bio:</h4>
                  <p><em>No bio provided.</em></p>
                </>
              )}

              {state.selectedFriend.email && (
                <>
                  <h4>Email:</h4>
                  <p>{state.selectedFriend.email}</p>
                </>
              )}
              
              {state.selectedFriend.friendshipDate && (
                <>
                  <h4>Friends Since:</h4>
                  <p>{new Date(state.selectedFriend.friendshipDate).toLocaleDateString()}</p>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="no-profile-selected">
            <p></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;