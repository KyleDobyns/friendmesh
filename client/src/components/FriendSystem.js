import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/FriendSystem.css';

const FriendSystem = () => {
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchFriends();
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

  const fetchFriends = async () => {
    try {
      const { data: sentFriends, error: sentError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          friend_note,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', currentUser.id);

      const { data: receivedFriends, error: receivedError } = await supabase
        .from('Friend')
        .select(`
          user_id,
          friend_date,
          friend_note,
          User!Friend_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('f_user_id', currentUser.id);

      if (sentError || receivedError) {
        throw sentError || receivedError;
      }

      const allFriends = [
        ...(sentFriends || []).map(f => ({ ...f.User, friendshipDate: f.friend_date })),
        ...(receivedFriends || []).map(f => ({ ...f.User, friendshipDate: f.friend_date }))
      ];

      setFriends(allFriends);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const addFriend = async (friendUserId) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data: existingFriend } = await supabase
        .from('Friend')
        .select('*')
        .or(`and(user_id.eq.${currentUser.id},f_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},f_user_id.eq.${currentUser.id})`)
        .single();

      if (existingFriend) {
        alert('You are already friends with this user!');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('Friend')
        .insert({
          user_id: currentUser.id,
          f_user_id: friendUserId,
          friend_date: new Date().toISOString(),
          friend_note: ''
        });

      if (error) throw error;

      alert('Friend added successfully!');
      await fetchFriends();
    } catch (error) {
      console.error('Error adding friend:', error);
      alert('Failed to add friend: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  const isFriend = (userId) => {
    return friends.some(friend => friend.user_id === userId);
  };

  const filteredUsers = users.filter(user =>
    user.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFriends = friends.filter(friend =>
    friend.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="friend-system-container">
      <h1>Friends</h1>
      {/* Search */}
      <div className="friend-search-row">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="friend-search-input"
        />
      </div>

      <div className="friend-columns">
        {/* Friends List */}
        <div className="friend-col">
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
                  <p className="friend-card-bio">
                    {friend.bio}
                  </p>
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

        {/* All Users */}
        <div className="friend-col">
          <h2>Add Friends</h2>
          <div className="friend-card-grid">
            {filteredUsers.map(user => (
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
                  <p className="friend-card-bio">
                    {user.bio}
                  </p>
                )}
                <div className="friend-card-actions">
                  {isFriend(user.user_id) ? (
                    <button
                      disabled
                      className="friend-friend-btn"
                    >
                      ✓ Friends
                    </button>
                  ) : (
                    <button
                      onClick={() => addFriend(user.user_id)}
                      disabled={loading}
                      className="friend-add-btn"
                    >
                      {loading ? 'Adding...' : 'Add Friend'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {filteredUsers.length === 0 && (
            <p className="friend-empty-msg">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendSystem;