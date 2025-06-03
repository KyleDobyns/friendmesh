import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/MessagePage.css'; // Import the CSS file

function Messages() {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastSeenMessages, setLastSeenMessages] = useState(new Set());
  const messagesEndRef = useRef(null);

  // Fetch current user on component mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        await fetchFriends(user.id);
        // Get last seen message timestamp from UserPreferences
        await getLastSeenMessageTime(user.id);
      }
    };
    
    getUser();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Get user's last seen message time
  const getLastSeenMessageTime = async (userId) => {
    try {
      const { data: userPrefs } = await supabase
        .from('UserPreferences')
        .select('last_checked_messages')
        .eq('user_id', userId)
        .single();
      
      if (userPrefs?.last_checked_messages) {
        // Store the timestamp for highlighting new messages
        window.lastCheckedMessages = userPrefs.last_checked_messages;
      }
    } catch (error) {
      console.error('Error fetching last seen time:', error);
    }
  };

  // Update last seen message time when user opens messages
  const updateLastSeenMessageTime = async () => {
    if (!currentUser) return;
    
    try {
      await supabase
        .from('UserPreferences')
        .upsert({
          user_id: currentUser.id,
          last_checked_messages: new Date().toISOString()
        });
      
      // Update the local timestamp
      window.lastCheckedMessages = new Date().toISOString();
      
      // Remove highlighting from all messages since user has now seen them
      setLastSeenMessages(new Set());
    } catch (error) {
      console.error('Error updating last seen time:', error);
    }
  };

  // Fetch friends from Friend table (both directions)
  const fetchFriends = async (currentUserId) => {
    try {
      console.log('Fetching friends for user:', currentUserId);
      
      // Get friends where current user added someone (and accepted)
      const { data: sentFriends, error: sentError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', currentUserId)
        .eq('status', 'accepted');

      // Get friends where someone added current user (and accepted)
      const { data: receivedFriends, error: receivedError } = await supabase
        .from('Friend')
        .select(`
          user_id,
          friend_date,
          User!Friend_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('f_user_id', currentUserId)
        .eq('status', 'accepted');

      if (sentError) {
        console.error('Error fetching sent friends:', sentError);
      }
      if (receivedError) {
        console.error('Error fetching received friends:', receivedError);
      }

      // Combine friends from both directions
      const allFriends = [];
      
      // Add friends where current user sent the friend request
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

      // Add friends where current user received the friend request
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

      // Remove duplicates (in case of bidirectional friendships)
      const uniqueFriends = allFriends.filter((friend, index, self) => 
        index === self.findIndex(f => f.user_id === friend.user_id)
      );

      // Sort friends by most recent message or friendship date
      await sortFriendsByRecentActivity(uniqueFriends, currentUserId);

      console.log('Found friends:', uniqueFriends);
      setFriends(uniqueFriends);
      
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Sort friends by most recent message activity and mark those with new messages
  const sortFriendsByRecentActivity = async (friendsList, currentUserId) => {
    const lastCheckedTime = window.lastCheckedMessages ? new Date(window.lastCheckedMessages) : new Date(0);
    
    for (let friend of friendsList) {
      try {
        // Get most recent message with this friend
        const { data: recentMessage } = await supabase
          .from('Message')
          .select('msg_time, sender_id')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friend.user_id}),and(sender_id.eq.${friend.user_id},receiver_id.eq.${currentUserId})`)
          .order('msg_time', { ascending: false })
          .limit(1)
          .single();
        
        friend.lastMessageTime = recentMessage?.msg_time || friend.friendshipDate;
        
        // Check if this friend has new messages from them (not from current user)
        const { data: newMessages } = await supabase
          .from('Message')
          .select('msg_id')
          .eq('sender_id', friend.user_id)
          .eq('receiver_id', currentUserId)
          .gt('msg_time', lastCheckedTime.toISOString());
        
        friend.hasNewMessages = (newMessages && newMessages.length > 0);
        
      } catch (error) {
        // No messages found, use friendship date
        friend.lastMessageTime = friend.friendshipDate;
        friend.hasNewMessages = false;
      }
    }
    
    // Sort by most recent activity
    friendsList.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
  };

  // Fetch messages between current user and selected friend
  const fetchMessages = async (friendId) => {
    if (!currentUser || !friendId) return;
    
    setLoading(true);
    try {
      console.log('Fetching messages between:', currentUser.id, 'and', friendId);
      
      // Fetch messages using sender_id and receiver_id, ordered by oldest first (normal chat order)
      const { data: messagesData, error } = await supabase
        .from('Message')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .order('msg_time', { ascending: true }); // Oldest first (normal chat)

      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } else {
        console.log('Found messages:', messagesData);
        setMessages(messagesData || []);
        
        // Mark new messages for highlighting
        markNewMessages(messagesData || []);
      }
      
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Mark messages as new if they're after the last checked time
  const markNewMessages = (messagesList) => {
    if (!window.lastCheckedMessages) return;
    
    const lastCheckedTime = new Date(window.lastCheckedMessages);
    const newMessageIds = new Set();
    
    messagesList.forEach(message => {
      const messageTime = new Date(message.msg_time);
      // Only highlight messages from others (not from current user)
      if (messageTime > lastCheckedTime && message.sender_id !== currentUser?.id) {
        newMessageIds.add(message.msg_id);
      }
    });
    
    setLastSeenMessages(newMessageIds);
    
    // Auto-clear highlighting after 5 seconds
    if (newMessageIds.size > 0) {
      setTimeout(() => {
        updateLastSeenMessageTime();
      }, 5000);
    }
  };

  // Filter friends based on search term
  const filteredFriends = friends.filter(friend => {
    const name = friend.userName || friend.email?.split('@')[0] || '';
    const email = friend.email || '';
    const bio = friend.bio || '';
    
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           bio.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSelectFriend = (friend) => {
    console.log('Selected friend:', friend);
    setSelectedFriend(friend);
    fetchMessages(friend.user_id);
    // Update last seen time when selecting a friend
    setTimeout(() => updateLastSeenMessageTime(), 1000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !selectedFriend) return;
    
    setLoading(true);
    try {
      console.log('Sending message from', currentUser.id, 'to', selectedFriend.user_id);
      
      // Prepare message data with your exact schema
      const messageData = {
        sender_id: currentUser.id,
        receiver_id: selectedFriend.user_id,
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
        // Refresh messages
        await fetchMessages(selectedFriend.user_id);
        // Update friends list to reflect new activity
        await fetchFriends(currentUser.id);
      }
      
    } catch (error) {
      console.error('Error in sendMessage:', error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="messages-container">
      {/* Friends sidebar */}
      <div className="contacts-sidebar">
        <h3>Messages</h3>
        
        {/* Search bar */}
        <div style={{ padding: '0 1rem 1rem 1rem' }}>
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '20px',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        {friends.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <p>No friends to message yet.</p>
            <Link 
              to="/friends"
              style={{ 
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Add Friends
            </Link>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
            <p>No friends found matching "{searchTerm}"</p>
            <button 
              onClick={() => setSearchTerm('')}
              style={{
                padding: '4px 8px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
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
                className={`contact-item${selectedFriend?.user_id === friend.user_id ? ' selected' : ''}${friend.hasNewMessages ? ' has-new-messages' : ''}`}
              >
                <div className="contact-avatar-row">
                  <div className="contact-avatar">
                    {friend.avatar_url ? (
                      <img 
                        src={friend.avatar_url} 
                        alt="Avatar" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
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

      {/* Messages area */}
      <div className="messages-area">
        {selectedFriend ? (
          <>
            {/* Contact header */}
            <div className="contact-header">
              <div className="contact-avatar">
                {selectedFriend.avatar_url ? (
                  <img 
                    src={selectedFriend.avatar_url} 
                    alt="Avatar" 
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  (selectedFriend.userName || selectedFriend.email)?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="contact-name">
                  {selectedFriend.userName || selectedFriend.email?.split('@')[0] || 'Unknown User'}
                </div>
                <div className="contact-status">
                  Friends since {new Date(selectedFriend.friendshipDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-list">
              {loading ? (
                <div className="no-messages">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="no-messages">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                <>
                  {messages.map(message => {
                    // Determine if message is from current user using sender_id
                    const isFromCurrentUser = message.sender_id === currentUser?.id;
                    const isNewMessage = lastSeenMessages.has(message.msg_id);
                    
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

            {/* Message input */}
            <div className="message-input-row">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
                disabled={loading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                className="send-button"
                disabled={loading || !newMessage.trim()}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="select-contact-message">
            {friends.length === 0 ? 
              'Add some friends to start messaging!' : 
              filteredFriends.length === 0 ?
                `No friends found matching "${searchTerm}"` :
                'Select a friend to start messaging'
            }
          </div>
        )}
      </div>

      <div className="profile-sidebar">
        {selectedFriend ? (
          <>
            <div className="profile-header">
              {selectedFriend.avatar_url ? (
                <img 
                  src={selectedFriend.avatar_url} 
                  alt={`${selectedFriend.userName || selectedFriend.email?.split('@')[0] || 'User'}'s Avatar`} 
                  className="profile-avatar" 
                />
              ) : (
                <div className="profile-avatar-placeholder">
                  {/* default is the firts letter of username*/}
                  {(selectedFriend.userName || selectedFriend.email)?.charAt(0).toUpperCase() || 'F'}
                </div>
              )}

              {}
              <h3>
                {selectedFriend.userName || selectedFriend.email?.split('@')[0] || 'Unknown User'}
              </h3>
            </div>

            <div className="profile-details">
              {selectedFriend.bio ? (
                <>
                  <h4>Bio:</h4>
                  <p>{selectedFriend.bio}</p>
                </>
              ) : (
                <>
                  <h4>Bio:</h4>
                  <p><em>No bio provided.</em></p>
                </>
              )}

              {selectedFriend.email && (
                <>
                  <h4>Email:</h4>
                  <p>{selectedFriend.email}</p>
                </>
              )}
              
              {selectedFriend.friendshipDate && (
                <>
                  <h4>Friends Since:</h4>
                  <p>{new Date(selectedFriend.friendshipDate).toLocaleDateString()}</p>
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
