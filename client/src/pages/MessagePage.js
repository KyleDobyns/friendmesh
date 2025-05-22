import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

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
      
      // For demo purposes - fetch some mock contacts
      // In a real app, you'd query your database for actual contacts
      fetchContacts(user.id);
    };
    
    getUser();
  }, []);

  // Fetch user's contacts
  const fetchContacts = async (userId) => {
    // This is a placeholder - in a real app, you would:
    // 1. Query USERS table for contacts
    // 2. Or query a separate CONTACTS or FRIENDS table
    const { data, error } = await supabase
      .from('USERS')
      .select('id, email, avatar_url, bio')
      .neq('id', userId); // Everyone except current user
      
    if (data) {
      setContacts(data);
    }
    
    if (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  // Fetch messages between current user and selected contact
  const fetchMessages = async (contactId) => {
    if (!currentUser || !contactId) return;
    
    // This assumes you have a MESSAGES table with sender_id, receiver_id, content, and created_at
    const { data, error } = await supabase
      .from('MESSAGES')
      .select('*')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .or(`sender_id.eq.${contactId},receiver_id.eq.${contactId}`)
      .order('created_at', { ascending: true });
      
    if (data) {
      setMessages(data);
    }
    
    if (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // When a contact is selected
  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    fetchMessages(contact.id);
  };

  // Send a new message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !currentUser) return;
    
    const { error } = await supabase
      .from('MESSAGES')
      .insert({
        sender_id: currentUser.id,
        receiver_id: selectedContact.id,
        content: newMessage,
      });
      
    if (!error) {
      setNewMessage('');
      fetchMessages(selectedContact.id); // Refresh messages
    } else {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', backgroundColor: '#f4f0fb', padding: '1rem' }}>
      {/* Contacts sidebar */}
      <div style={{ 
        width: '250px', 
        backgroundColor: '#fff', 
        borderRadius: '8px', 
        marginRight: '1rem',
        overflow: 'auto',
        padding: '1rem'
      }}>
        <h3>Contacts</h3>
        
        {contacts.length === 0 ? (
          <p>No contacts found</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {contacts.map(contact => (
              <li 
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: selectedContact?.id === contact.id ? '#f0f0ff' : 'transparent',
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%', 
                    backgroundColor: '#6c63ff',
                    marginRight: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    {contact.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{contact.email?.split('@')[0]}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
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
      <div style={{ 
        flex: 1, 
        backgroundColor: '#fff', 
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedContact ? (
          <>
            {/* Contact header */}
            <div style={{ 
              padding: '1rem', 
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                backgroundColor: '#6c63ff',
                marginRight: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                {selectedContact.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 'bold' }}>{selectedContact.email?.split('@')[0]}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  {selectedContact.online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ 
              flex: 1, 
              padding: '1rem',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {messages.length === 0 ? (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  No messages yet. Start a conversation!
                </div>
              ) : (
                messages.map(message => (
                  <div 
                    key={message.id}
                    style={{
                      alignSelf: message.sender_id === currentUser?.id ? 'flex-end' : 'flex-start',
                      backgroundColor: message.sender_id === currentUser?.id ? '#6c63ff' : '#f0f0f0',
                      color: message.sender_id === currentUser?.id ? 'white' : 'black',
                      padding: '0.75rem',
                      borderRadius: '1rem',
                      maxWidth: '70%',
                      marginBottom: '0.5rem'
                    }}
                  >
                    {message.content}
                    <div style={{ 
                      fontSize: '0.7rem', 
                      opacity: 0.7,
                      marginTop: '0.25rem' 
                    }}>
                      {new Date(message.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message input */}
            <div style={{ 
              padding: '1rem', 
              borderTop: '1px solid #eee',
              display: 'flex'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '2rem',
                  border: '1px solid #ddd',
                  marginRight: '0.5rem'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  backgroundColor: '#6c63ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2rem',
                  padding: '0 1.5rem',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666'
          }}>
            Select a contact to start messaging
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;