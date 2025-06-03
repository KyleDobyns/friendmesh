import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/FriendSystem.css';

const FriendSystem = () => {
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('friends'); // friends, requests, discover
  const [addingFriendUserIds, setAddingFriendUserIds] = useState(new Set());

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchFriends();
      fetchPendingRequests();
      fetchSentRequests();
    }
  }, [currentUser]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('User')
        .select('user_id, userName, email, bio, avatar_url')
        .neq('user_id', currentUser.id);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Fetch accepted friends
  const fetchFriends = async () => {
    try {
      const { data: sentFriends, error: sentError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          friend_note,
          status,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'accepted');

      const { data: receivedFriends, error: receivedError } = await supabase
        .from('Friend')
        .select(`
          user_id,
          friend_date,
          friend_note,
          status,
          User!Friend_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('f_user_id', currentUser.id)
        .eq('status', 'accepted');

      if (sentError || receivedError) {
        throw sentError || receivedError;
      }

      const allFriends = [
        ...(sentFriends || []).map(f => ({ ...f.User, friendshipDate: f.friend_date })),
        ...(receivedFriends || []).map(f => ({ ...f.User, friendshipDate: f.friend_date }))
      ];

      // Remove duplicates
      const uniqueFriends = allFriends.filter((friend, index, self) => 
        index === self.findIndex(f => f.user_id === friend.user_id)
      );

      setFriends(uniqueFriends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Fetch pending friend requests received by current user
  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('Friend')
        .select(`
          user_id,
          friend_date,
          friend_note,
          User!Friend_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('f_user_id', currentUser.id)
        .eq('status', 'pending');

      if (error) throw error;

      const requests = (data || []).map(req => ({
        ...req.User,
        requestDate: req.friend_date,
        requesterId: req.user_id
      }));

      setPendingRequests(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  // Fetch friend requests sent by current user
  const fetchSentRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          friend_note,
          status,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', currentUser.id)
        .eq('status', 'pending');

      if (error) throw error;

      const requests = (data || []).map(req => ({
        ...req.User,
        requestDate: req.friend_date,
        status: req.status
      }));

      setSentRequests(requests);
    } catch (error) {
      console.error('Error fetching sent requests:', error);
    }
  };

  // Send friend request
  const sendFriendRequest = async (friendUserId) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Check if any relationship already exists
      const { data: existingRelation } = await supabase
        .from('Friend')
        .select('*')
        .or(`and(user_id.eq.${currentUser.id},f_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},f_user_id.eq.${currentUser.id})`)
        .single();

      if (existingRelation) {
        if (existingRelation.status === 'accepted') {
          alert('You are already friends with this user!');
        } else if (existingRelation.status === 'pending') {
          alert('A friend request is already pending with this user!');
        }
        setLoading(false);
        return;
      }

      // Send friend request
      const { error } = await supabase
        .from('Friend')
        .insert({
          user_id: currentUser.id,
          f_user_id: friendUserId,
          friend_date: new Date().toISOString(),
          friend_note: '',
          status: 'pending'
        });

      if (error) throw error;

      alert('Friend request sent!');
      await fetchSentRequests();
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request: ' + error.message);
    } finally {
      setLoading(false); 
      setAddingFriendUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(friendUserId);
      return newSet;
    });
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (requesterId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('Friend')
        .update({ 
          status: 'accepted',
          friend_date: new Date().toISOString() // Update to acceptance date
        })
        .eq('user_id', requesterId)
        .eq('f_user_id', currentUser.id)
        .eq('status', 'pending');

      if (error) throw error;

      alert('Friend request accepted!');
      await fetchFriends();
      await fetchPendingRequests();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Failed to accept friend request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Decline friend request
  const declineFriendRequest = async (requesterId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('Friend')
        .delete()
        .eq('user_id', requesterId)
        .eq('f_user_id', currentUser.id)
        .eq('status', 'pending');

      if (error) throw error;

      alert('Friend request declined!');
      await fetchPendingRequests();
    } catch (error) {
      console.error('Error declining friend request:', error);
      alert('Failed to decline friend request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancel sent friend request
  const cancelFriendRequest = async (friendUserId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('Friend')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('f_user_id', friendUserId)
        .eq('status', 'pending');

      if (error) throw error;

      alert('Friend request cancelled!');
      await fetchSentRequests();
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      alert('Failed to cancel friend request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Remove friend
  const removeFriend = async (friendUserId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('Friend')
        .delete()
        .or(`and(user_id.eq.${currentUser.id},f_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},f_user_id.eq.${currentUser.id})`);

      if (error) throw error;

      alert('Friend removed successfully!');
      await fetchFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check relationship status with a user
  const getRelationshipStatus = (userId) => {
    // Check if already friends
    if (friends.some(friend => friend.user_id === userId)) {
      return 'friends';
    }
    // Check if request sent
    if (sentRequests.some(req => req.user_id === userId)) {
      return 'request_sent';
    }
    // Check if request received
    if (pendingRequests.some(req => req.user_id === userId)) {
      return 'request_received';
    }
    return 'none';
  };

  const filteredUsers = users.filter(user =>
    user.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFriends = friends.filter(friend =>
    friend.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPendingRequests = pendingRequests.filter(req =>
    req.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="friend-system-container">
      <h1>Friends</h1>
      
      {/* Search */}
      <div className="friend-search-row">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="friend-search-input"
        />
      </div>

      {/* Tab Navigation */}
      <div className="friend-tabs">
        <button 
          className={`friend-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends ({friends.length})
        </button>
        <button 
          className={`friend-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests ({pendingRequests.length})
        </button>
        <button 
          className={`friend-tab ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'friends' && (
        <div className="friend-tab-content">
          <h2>Your Friends ({friends.length})</h2>
          <div className="friend-card-grid">
            {filteredFriends.map(friend => (
              <div key={friend.user_id} className="friend-card friend-card-friend">
                <div className="friend-card-header">
                  <img
                    src={friend.avatar_url || `https://ui-avatars.com/api/?name=${friend.userName || friend.email}&size=50`}
                    alt="Avatar"
                    className="friend-avatar"
                  />
                  <div>
                    <h4 className="friend-card-title">{friend.userName || friend.email?.split('@')[0]}</h4>
                    <small className="friend-card-email">{friend.email}</small>
                  </div>
                </div>
                {friend.bio && (
                  <p className="friend-card-bio">{friend.bio}</p>
                )}
                <small className="friend-card-date">
                  Friends since: {new Date(friend.friendshipDate).toLocaleDateString()}
                </small>
                <div className="friend-card-actions">
                  <button
                    onClick={() => removeFriend(friend.user_id)}
                    disabled={loading}
                    className="friend-remove-btn"
                  >
                    Remove Friend
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filteredFriends.length === 0 && (
            <p className="friend-empty-msg">No friends found.</p>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="friend-tab-content">
          <h2>Friend Requests ({pendingRequests.length})</h2>
          {pendingRequests.length === 0 ? (
            <p className="friend-empty-msg">No pending friend requests.</p>
          ) : (
            <div className="friend-card-grid">
              {filteredPendingRequests.map(request => (
                <div key={request.user_id} className="friend-card friend-card-request">
                  <div className="friend-card-header">
                    <img
                      src={request.avatar_url || `https://ui-avatars.com/api/?name=${request.userName || request.email}&size=50`}
                      alt="Avatar"
                      className="friend-avatar"
                    />
                    <div>
                      <h4 className="friend-card-title">{request.userName || request.email?.split('@')[0]}</h4>
                      <small className="friend-card-email">{request.email}</small>
                    </div>
                  </div>
                  {request.bio && (
                    <p className="friend-card-bio">{request.bio}</p>
                  )}
                  <small className="friend-card-date">
                    Requested: {new Date(request.requestDate).toLocaleDateString()}
                  </small>
                  <div className="friend-card-actions">
                    <button
                      onClick={() => acceptFriendRequest(request.requesterId)}
                      disabled={loading}
                      className="friend-accept-btn"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineFriendRequest(request.requesterId)}
                      disabled={loading}
                      className="friend-decline-btn"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sentRequests.length > 0 && (
            <>
              <h3>Sent Requests ({sentRequests.length})</h3>
              <div className="friend-card-grid">
                {sentRequests.map(request => (
                  <div key={request.user_id} className="friend-card friend-card-sent">
                    <div className="friend-card-header">
                      <img
                        src={request.avatar_url || `https://ui-avatars.com/api/?name=${request.userName || request.email}&size=50`}
                        alt="Avatar"
                        className="friend-avatar"
                      />
                      <div>
                        <h4 className="friend-card-title">{request.userName || request.email?.split('@')[0]}</h4>
                        <small className="friend-card-email">{request.email}</small>
                      </div>
                    </div>
                    {request.bio && (
                      <p className="friend-card-bio">{request.bio}</p>
                    )}
                    <small className="friend-card-date">
                      Sent: {new Date(request.requestDate).toLocaleDateString()}
                    </small>
                    <div className="friend-card-actions">
                      <button
                        onClick={() => cancelFriendRequest(request.user_id)}
                        disabled={loading}
                        className="friend-cancel-btn"
                      >
                        Cancel Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'discover' && (
        <div className="friend-tab-content">
          <h2>Discover People</h2>
          <div className="friend-card-grid">
            {filteredUsers.map(user => {
              const status = getRelationshipStatus(user.user_id);
              return (
                <div key={user.user_id} className="friend-card">
                  <div className="friend-card-header">
                    <img
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.userName || user.email}&size=50`}
                      alt="Avatar"
                      className="friend-avatar"
                    />
                    <div>
                      <h4 className="friend-card-title">{user.userName || user.email?.split('@')[0]}</h4>
                      <small className="friend-card-email">{user.email}</small>
                    </div>
                  </div>
                  {user.bio && (
                    <p className="friend-card-bio">{user.bio}</p>
                  )}
                  <div className="friend-card-actions">
                    {status === 'friends' && (
                      <button disabled className="friend-friend-btn">
                        ✓ Friends
                      </button>
                    )}
                    {status === 'request_sent' && (
                      <button
                        onClick={() => cancelFriendRequest(user.user_id)}
                        disabled={loading}
                        className="friend-pending-btn"
                      >
                        Request Sent
                      </button>
                    )}
                    {status === 'request_received' && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => acceptFriendRequest(user.user_id)}
                          disabled={loading}
                          className="friend-accept-btn"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => declineFriendRequest(user.user_id)}
                          disabled={loading}
                          className="friend-decline-btn"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {status === 'none' && (
                      <button
                        onClick={() => sendFriendRequest(user.user_id)}
                        disabled={loading || addingFriendUserIds.has(user.user_id)}
                        className="friend-add-btn"
                      >
                        {addingFriendUserIds.has(user.user_id) ? 'Sending...' : 'Add Friend'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredUsers.length === 0 && (
            <p className="friend-empty-msg">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default FriendSystem;
