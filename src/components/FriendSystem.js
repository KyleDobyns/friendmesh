import React, { useState, useEffect, useReducer, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/FriendSystem.css';

// reducer
const initialState = {
  users: [],
  friends: [],
  pendingRequests: [],
  sentRequests: [],
  loading: false,
  loadingUserIds: new Set()
};

function friendReducer(state, action) {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_FRIENDS':
      return { ...state, friends: action.payload };
    case 'SET_PENDING_REQUESTS':
      return { ...state, pendingRequests: action.payload };
    case 'SET_SENT_REQUESTS':
      return { ...state, sentRequests: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'ADD_LOADING_USER':
      return {
        ...state,
        loadingUserIds: new Set([...state.loadingUserIds, action.payload])
      };
    case 'REMOVE_LOADING_USER':
      const newSet = new Set(state.loadingUserIds);
      newSet.delete(action.payload);
      return { ...state, loadingUserIds: newSet };
    case 'SET_ALL_DATA':
      return {
        ...state,
        users: action.payload.users,
        friends: action.payload.friends,
        pendingRequests: action.payload.pendingRequests,
        sentRequests: action.payload.sentRequests
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

// friend data fetching
function useFriendData(userId) {
  const [state, dispatch] = useReducer(friendReducer, initialState);

  const fetchAllData = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: usersData, error: usersError } = await supabase
        .from('User')
        .select('user_id, userName, email, bio, avatar_url')
        .neq('user_id', userId);

      if (usersError) throw usersError;

      // accepted friends
      const { data: sentFriends, error: sentError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          friend_note,
          status,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', userId)
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
        .eq('f_user_id', userId)
        .eq('status', 'accepted');

      if (sentError || receivedError) {
        throw sentError || receivedError;
      }

      // process friends
      const allFriends = [
        ...(sentFriends || []).map(f => ({ ...f.User, friendshipDate: f.friend_date })),
        ...(receivedFriends || []).map(f => ({ ...f.User, friendshipDate: f.friend_date }))
      ];

      const uniqueFriends = allFriends.filter((friend, index, self) => 
        index === self.findIndex(f => f.user_id === friend.user_id)
      );

      // fetch pending requests
      const { data: pendingData, error: pendingError } = await supabase
        .from('Friend')
        .select(`
          user_id,
          friend_date,
          friend_note,
          User!Friend_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('f_user_id', userId)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      const pendingRequests = (pendingData || []).map(req => ({
        ...req.User,
        requestDate: req.friend_date,
        requesterId: req.user_id
      }));

      // fetch sent requests
      const { data: sentData, error: sentReqError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          friend_note,
          status,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (sentReqError) throw sentReqError;

      const sentRequests = (sentData || []).map(req => ({
        ...req.User,
        requestDate: req.friend_date,
        status: req.status
      }));

      // update all state at once
      dispatch({
        type: 'SET_ALL_DATA',
        payload: {
          users: usersData || [],
          friends: uniqueFriends,
          pendingRequests,
          sentRequests
        }
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { state, dispatch, refetchData: fetchAllData };
}

const FriendSystem = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('friends');
  
  const { userId, userRef } = useCurrentUser();
  const { state, dispatch, refetchData } = useFriendData(userId);

  // relationship status checker
  const getRelationshipStatus = useCallback((targetUserId) => {
    if (state.friends.some(friend => friend.user_id === targetUserId)) {
      return 'friends';
    }
    if (state.sentRequests.some(req => req.user_id === targetUserId)) {
      return 'request_sent';
    }
    if (state.pendingRequests.some(req => req.user_id === targetUserId)) {
      return 'request_received';
    }
    return 'none';
  }, [state.friends, state.sentRequests, state.pendingRequests]);

  //filtered lists
  const filteredUsers = useMemo(() => 
    state.users.filter(user =>
      user.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [state.users, searchTerm]
  );

  const filteredFriends = useMemo(() => 
    state.friends.filter(friend =>
      friend.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [state.friends, searchTerm]
  );

  const filteredPendingRequests = useMemo(() => 
    state.pendingRequests.filter(req =>
      req.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [state.pendingRequests, searchTerm]
  );


  const sendFriendRequest = async (friendUserId) => {
    if (!userRef.current) return;
    
    dispatch({ type: 'ADD_LOADING_USER', payload: friendUserId });
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const { data: existingRelation } = await supabase
        .from('Friend')
        .select('*')
        .or(`and(user_id.eq.${userRef.current.id},f_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},f_user_id.eq.${userRef.current.id})`)
        .single();

      if (existingRelation) {
        if (existingRelation.status === 'accepted') {
          alert('You are already friends with this user!');
        } else if (existingRelation.status === 'pending') {
          alert('A friend request is already pending with this user!');
        }
        return;
      }

      const { error } = await supabase
        .from('Friend')
        .insert({
          user_id: userRef.current.id,
          f_user_id: friendUserId,
          friend_date: new Date().toISOString(),
          friend_note: '',
          status: 'pending'
        });

      if (error) throw error;

      alert('Friend request sent!');
      
      //fetch sent requests
      const { data, error: fetchError } = await supabase
        .from('Friend')
        .select(`
          f_user_id,
          friend_date,
          friend_note,
          status,
          User!Friend_f_user_id_fkey(user_id, userName, email, bio, avatar_url)
        `)
        .eq('user_id', userRef.current.id)
        .eq('status', 'pending');

      if (!fetchError) {
        const requests = (data || []).map(req => ({
          ...req.User,
          requestDate: req.friend_date,
          status: req.status
        }));
        dispatch({ type: 'SET_SENT_REQUESTS', payload: requests });
      }
      
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request: ' + error.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'REMOVE_LOADING_USER', payload: friendUserId });
    }
  };

  const acceptFriendRequest = async (requesterId) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { error } = await supabase
        .from('Friend')
        .update({ 
          status: 'accepted',
          friend_date: new Date().toISOString()
        })
        .eq('user_id', requesterId)
        .eq('f_user_id', userRef.current.id)
        .eq('status', 'pending');

      if (error) throw error;

      alert('Friend request accepted!');
      await refetchData();
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Failed to accept friend request: ' + error.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const declineFriendRequest = async (requesterId) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { error } = await supabase
        .from('Friend')
        .delete()
        .eq('user_id', requesterId)
        .eq('f_user_id', userRef.current.id)
        .eq('status', 'pending');

      if (error) throw error;

      alert('Friend request declined!');
      
      // pending requests
      const updatedRequests = state.pendingRequests.filter(req => req.requesterId !== requesterId);
      dispatch({ type: 'SET_PENDING_REQUESTS', payload: updatedRequests });
      
    } catch (error) {
      console.error('Error declining friend request:', error);
      alert('Failed to decline friend request: ' + error.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const cancelFriendRequest = async (friendUserId) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { error } = await supabase
        .from('Friend')
        .delete()
        .eq('user_id', userRef.current.id)
        .eq('f_user_id', friendUserId)
        .eq('status', 'pending');

      if (error) throw error;

      alert('Friend request cancelled!');
      
      //only sent requests
      const updatedRequests = state.sentRequests.filter(req => req.user_id !== friendUserId);
      dispatch({ type: 'SET_SENT_REQUESTS', payload: updatedRequests });
      
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      alert('Failed to cancel friend request: ' + error.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const removeFriend = async (friendUserId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { error } = await supabase
        .from('Friend')
        .delete()
        .or(`and(user_id.eq.${userRef.current.id},f_user_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},f_user_id.eq.${userRef.current.id})`);

      if (error) throw error;

      alert('Friend removed successfully!');
      
      // only friends list
      const updatedFriends = state.friends.filter(friend => friend.user_id !== friendUserId);
      dispatch({ type: 'SET_FRIENDS', payload: updatedFriends });
      
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend: ' + error.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className="friend-system-container">
      <h1>Friends</h1>
      <div className="friend-search-row">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="friend-search-input"
        />
      </div>
      <div className="friend-tabs">
        <button 
          className={`friend-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends ({state.friends.length})
        </button>
        <button 
          className={`friend-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Requests ({state.pendingRequests.length})
        </button>
        <button 
          className={`friend-tab ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover
        </button>
      </div>
      
      {activeTab === 'friends' && (
        <div className="friend-tab-content">
          <h2>Your Friends ({state.friends.length})</h2>
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
                    disabled={state.loading}
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
          <h2>Friend Requests ({state.pendingRequests.length})</h2>
          {state.pendingRequests.length === 0 ? (
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
                      disabled={state.loading}
                      className="friend-accept-btn"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineFriendRequest(request.requesterId)}
                      disabled={state.loading}
                      className="friend-decline-btn"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {state.sentRequests.length > 0 && (
            <>
              <h3>Sent Requests ({state.sentRequests.length})</h3>
              <div className="friend-card-grid">
                {state.sentRequests.map(request => (
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
                        disabled={state.loading}
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
                        disabled={state.loading}
                        className="friend-pending-btn"
                      >
                        Request Sent
                      </button>
                    )}
                    {status === 'request_received' && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => acceptFriendRequest(user.user_id)}
                          disabled={state.loading}
                          className="friend-accept-btn"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => declineFriendRequest(user.user_id)}
                          disabled={state.loading}
                          className="friend-decline-btn"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {status === 'none' && (
                      <button
                        onClick={() => sendFriendRequest(user.user_id)}
                        disabled={state.loading || state.loadingUserIds.has(user.user_id)}
                        className="friend-add-btn"
                      >
                        {state.loadingUserIds.has(user.user_id) ? 'Sending...' : 'Add Friend'}
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