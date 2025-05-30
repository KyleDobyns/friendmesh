import React from 'react';
import '../styles/UserHoverCard.css';

const DEFAULT_PFP_URL = 'https://via.placeholder.com/60/ced4da/808080?Text=User';

function UserHoverCard({ user, onAddFriend, onSendMessage, currentUserId }) {
  if (!user) {
    return null;
  }

  const pfpUrl = user.profile_picture_url || DEFAULT_PFP_URL;
  const bio = user.bio || 'No bio available.';
  const userName = user.userName || 'Unknown User';

  // dont show for cur user
  if (!user.id || user.id === currentUserId) {

  }


  return (
    <div className="user-hover-card">
      <img src={pfpUrl} alt={`${userName}'s profile`} className="hover-card-pfp" />
      <div className="hover-card-username">{userName}</div>
      <p className="hover-card-bio">{bio}</p>
      <div className="hover-card-actions">
        {

        }
        {user.id !== currentUserId && (
          <>
            <button onClick={() => window.location.href="/friends"} className="hover-action-button">
              Add Friend
            </button>
            <button onClick={() => onSendMessage(user.id)} className="hover-action-button">
              Send Message
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default UserHoverCard;
