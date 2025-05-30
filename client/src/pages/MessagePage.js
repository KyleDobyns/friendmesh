import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/MessagePage.css'; // Import the CSS file

function Messages() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user on component mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        fetchAllUsersAsContacts(user.id);
      }
    };
    
    getUser();
  }, []);

  // Temporary solution: fetch all users as potential contacts
  const fetchAllUsersAsContacts = async (currentUserId) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('user_id, userName, bio, email')
        .neq('user_id', currentUserId);
        
      if (userData) {
        setContacts(userData);
      }
      if (userError) {
        console.error('Error fetching users:', userError);
      }
    } catch (error) {
      console.error('Error in fetchAllUsersAsContacts:', error);
    }
  };

/*   const fetchContactsFromFriendTable = async () => {
    try {
      const { data: friendData, error: friendError } = await supabase
        .from('Friend')
        .select('f_user_id, friend_date, friend_note');
      
      if (friendError) {
        console.error('Error fetching from Friend table:', friendError);
        return;
      }

      if (friendData && friendData.length > 0) {
        const friendIds = friendData.map(friend => friend.f_user_id);
        const { data: userData, error: userError } = await supabase
          .from('User')
          .select('user_id, userName, bio, email')
          .in('user_id', friendIds);
        if (userData) {
          setContacts(userData);
        }
        if (userError) {
          console.error('Error fetching friend user details:', userError);
        }
      }
    } catch (error) {
      console.error('Error in fetchContactsFromFriendTable:', error);
    }
  }; */

  const fetchMessages = async (contactId) => {
    if (!currentUser || !contactId) return;
    try {
      const { data, error } = await supabase
        .from('Message')
        .select('*')
        .in('user_id', [currentUser.id, contactId])
        .order('msg_time', { ascending: true });
      if (data) {
        setMessages(data);
      }
      if (error) {
        console.error('Error fetching messages:', error);
      }
    } catch (error) {
      console.error('Error in fetchMessages:', error);
    }
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    fetchMessages(contact.user_id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    try {
      const { error } = await supabase
        .from('Message')
        .insert({
          user_id: currentUser.id,
          msg_content: newMessage,
        });
      if (!error) {
        setNewMessage('');
        if (selectedContact) {
          fetchMessages(selectedContact.user_id);
        }
      } else {
        console.error('Error sending message:', error);
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
    }
  };

  return (
    <div className="messages-container">
      {/* Contacts sidebar */}
      <div className="contacts-sidebar">
        <h3>Contacts</h3>
        {contacts.length === 0 ? (
          <p>No contacts found. Check console for debugging info.</p>
        ) : (
          <ul className="contacts-list">
            {contacts.map(contact => (
              <li
                key={contact.user_id}
                onClick={() => handleSelectContact(contact)}
                className={`contact-item${selectedContact?.user_id === contact.user_id ? ' selected' : ''}`}
              >
                <div className="contact-avatar-row">
                  <div className="contact-avatar">
                    {(contact.userName || contact.email)?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="contact-name">
                      {contact.userName || contact.email?.split('@')[0] || 'Unknown User'}
                    </div>
                    <div className="contact-bio">
                      {contact.bio ? contact.bio.substring(0, 20) + '...' : 'No bio'}
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
        {selectedContact ? (
          <>
            {/* Contact header */}
            <div className="contact-header">
              <div className="contact-avatar">
                {(selectedContact.userName || selectedContact.email)?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="contact-name">
                  {selectedContact.userName || selectedContact.email?.split('@')[0] || 'Unknown User'}
                </div>
                <div className="contact-status">
                  {selectedContact.online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="messages-list">
              {messages.length === 0 ? (
                <div className="no-messages">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                messages.map(message => (
                  <div
                    key={message.msg_id}
                    className={`message-bubble${message.user_id === currentUser?.id ? ' sent' : ' received'}`}
                  >
                    {message.msg_content}
                    <div className="message-time">
                      {new Date(message.msg_time).toLocaleTimeString()}
                    </div>
                  </div>
                ))
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                className="send-button"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="select-contact-message">
            Select a contact to start messaging
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;