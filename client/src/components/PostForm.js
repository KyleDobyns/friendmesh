import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import profileImg from '../images/profile.png';
import UserHoverCard from './UserHoverCard';

function PostForm() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [activeHoverCardPostId, setActiveHoverCardPostId] = useState(null);
  const [profileImage, setProfileImage] = useState(profileImg);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      setUserName(user?.user_metadata?.full_name || user?.email || 'Unknown');

      if (user?.id) {
        const { data, error } = await supabase
          .from('User')
          .select('avatar_url')
          .eq('user_id', user.id)
          .single();
        if (data && data.avatar_url) {
          setProfileImage(data.avatar_url);
        } else {
          setProfileImage(profileImg);
        }
      }
    };
    getUser();
    fetchPosts();
  }, []);

  // Fetch posts, comment counts, and like counts
  const fetchPosts = async () => {
    // Fetch posts and join User table for userName
    const { data: postsData, error } = await supabase
      .from('Post')
      .select('*, User:user_id(userName)')
      .order('post_date', { ascending: false });
    if (error) {
      setErrorMessage("Error fetching posts: " + error?.message);
      return;
    }
    setPosts(postsData || []);

    // Fetch comment counts
    const commentCountsObj = {};
    const likeCountsObj = {};
    if (postsData && postsData.length > 0) {
      const postIds = postsData.map((p) => p.post_id);
      // Comments
      const { data: commentCountData, count: commentCount } = await supabase
        .from('comments')
        .select('post_id', { count: 'exact', head: false })
        .in('post_id', postIds);
      if (commentCountData) {
        const commentCountMap = {};
        commentCountData.forEach((row) => {
          commentCountMap[row.post_id] = (commentCountMap[row.post_id] || 0) + 1;
        });
        Object.assign(commentCountsObj, commentCountMap);
      }
      // Likes
      const { data: likeCountData } = await supabase
        .from('likes')
        .select('post_id', { count: 'exact', head: false })
        .in('post_id', postIds);
      if (likeCountData) {
        const likeCountMap = {};
        likeCountData.forEach((row) => {
          likeCountMap[row.post_id] = (likeCountMap[row.post_id] || 0) + 1;
        });
        Object.assign(likeCountsObj, likeCountMap);
      }
    }
    setCommentCounts(commentCountsObj);
    setLikeCounts(likeCountsObj);
  };

  // Handle submitting a post
  const handlePost = async () => {
    // Prevent empty post if there's no text or image
    if (!content.trim() && !imageFile) return;

    let imageUrl = null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, imageFile);
      if (uploadError) {
        setErrorMessage("Image upload failed: " + uploadError?.message);
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData?.publicUrl || null;
    }

    // Insert post into POSTS table
    const { error } = await supabase.from('Post').insert([
      {
        post_content: content,
        user_id: userId,
        image_url: imageUrl,
      },
    ]);

    if (error) {
      setErrorMessage("Post failed: " + error?.message);
    } else {
      // Clear input fields after successful post
      setContent('');
      setImageFile(null);
      fetchPosts(); // Refresh feed
    }
  };

  // Handle submitting a comment
  const handleComment = async (postId) => {
    const commentText = commentInputs[postId]?.trim();
    if (!commentText) return;
    const { error } = await supabase.from('comments').insert([
      {
        post_id: postId,
        user_id: userId,
        comment_text: commentText,
      },
    ]);
    if (error) {
      setErrorMessage("Comment failed: " + error?.message);
    } else {
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      fetchPosts();
      // Refresh comments for this post if open
      if (showComments[postId]) {
        fetchCommentsForPost(postId);
      }
    }
  };

  // Handle like (toggle like/unlike)
  const handleLike = async (postId) => {
    const { data: existingLike } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingLike) {
      // Unlike: delete the like
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      fetchPosts();
      return;
    }
    // Like: insert new like
    const { error } = await supabase.from('likes').insert([
      {
        post_id: postId,
        user_id: userId,
      },
    ]);
    if (error) {
      setErrorMessage("Like failed: " + error?.message);
    } else {
      fetchPosts();
    }
  };

  // Fetch comments for a post (with userName)
  const fetchCommentsForPost = async (postId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('comment_id, comment_text, user_id, created_at, User:user_id(userName)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (!error) {
      setComments((prev) => ({ ...prev, [postId]: data }));
    }
  };

  // Toggle comments display for a post
  const handleToggleComments = (postId) => {
    setShowComments((prev) => {
      const newState = { ...prev, [postId]: !prev[postId] };
      if (!prev[postId]) {
        // If we are opening the comments, always fetch latest
        fetchCommentsForPost(postId);
      }
      return newState;
    });
  };

  // Handle deleting a post (only by the post's author)
  const handleDeletePost = async (postId, postUserId) => {
    if (userId !== postUserId) return; // Only allow author to delete
    // First, delete all likes and comments for this post
    await supabase.from('likes').delete().eq('post_id', postId);
    await supabase.from('comments').delete().eq('post_id', postId);
    // Then, delete the post itself
    const { error } = await supabase.from('Post').delete().eq('post_id', postId);
    if (error) {
      setErrorMessage("Delete post failed: " + error?.message);
    } else {
      fetchPosts();
    }
  };

  // toggles the user pfp in a post on and off. 
  // when a new user pfp is displayed, hide all others. 
  const toggleHoverCard = (postId) => {
    setActiveHoverCardPostId(prevActiveId => (prevActiveId === postId ? null : postId));
  };

  const handleAddFriendOnFeed = (targetUserId) => {
    if (targetUserId === userId) {
        console.log("you cannot add yourself as a friend");
        return;
    }
    //console.log(`Request to add friend: ${targetUserId}`);
    //todo
    alert(`friend request to user id ${targetUserId} initiated (todo...)`);
  };

  const handleSendMessageOnFeed = (targetUserId) => {
    if (targetUserId === userId) {
        console.log("you cannot message yourself");
        return;
    }
    //console.log(`request to send message to: ${targetUserId}`);
    //todo
    alert(`message to user id ${targetUserId} initiated (todo...))`);
  };

  return (
    <div style={{ backgroundColor: '#f4f0fb', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ display: 'flex', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Sidebar */}
        <div style={{ width: '250px', backgroundColor: '#fff', borderRadius: '8px', padding: '1rem', marginRight: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <img
              src={profileImage}
              alt="profile"
              style={{
                borderRadius: '50%',
                marginBottom: '10px',
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            />
            <h3>{userName}</h3>
            <button onClick={() => window.location.href="/friends"} style={{ fontSize: '0.9em', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer' }}>Find Friends</button>
          </div>
        </div>
        {/* Main Feed Area */}
        <div style={{ flex: 1 }}>
          {/* Post Box */}
          <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <textarea
              rows="3"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                width: '100%',
                fontSize: '1em',
                borderRadius: '5px',
                border: '1px solid #ccc'
              }}
            />
            {/* File input for image */}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              style={{ marginTop: '10px' }}
            />
            <br />
            {/* Submit Post Button */}
            <button
              onClick={handlePost}
              style={{
                marginTop: '10px',
                padding: '8px 20px',
                backgroundColor: '#6c63ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Post
            </button>
          </div>
          {/* Post Feed Display */}
          {posts.map((post) => (
            <div
              key={post.post_id}
              style={{
                backgroundColor: '#fff',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                position: 'relative'
              }}
            >
              {/* X button for deleting post (only for author) */}
              {post.user_id === userId && (
                <button
                  onClick={() => handleDeletePost(post.post_id, post.user_id)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.3em',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                  title="Delete post"
                >
                  ×
                </button>
              )}
              
              <div style={{marginBottom: '0.5rem', fontWeight: 'bold', display: 'flex' }}>
                <div className = 'user-hover-wrapper'>
                  <span style={{ color: '#333', cursor: 'pointer' }} onClick={() => toggleHoverCard(post.post_id)}>
                    {(post.User?.userName || post.user_id)}
                  </span>
                  <span style={{marginLeft: '0.5rem', color: '#777', fontWeight: 'normal' }}>
                    • {new Date(post.post_date).toLocaleString()}
                  </span>

                  {/* toggle the current user pfp on and off. also toggles all others off */}
                  {activeHoverCardPostId === post.post_id && post.User && post.userId !== userId &&(
                    <div className='user-hover-popup-container'>
                      <UserHoverCard
                        user = {post.User}
                        currentUserId={userId}
                        onAddFriend={handleAddFriendOnFeed}
                        onSendMessage={handleSendMessageOnFeed}
                      />
                    </div>
                  )}
                </div>
              </div>

                
              <p>{post.post_content}</p>
              {/* Show image if post has one */}
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="Post"
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginTop: '10px'
                  }}
                />
              )}
              {/* Like and comment counts */}
              <div style={{ fontSize: '0.9em', color: '#777', marginTop: '0.5rem' }}>
                <button onClick={() => handleLike(post.post_id)} style={{ background: 'none', border: 'none', color: '#e25555', cursor: 'pointer' }}>
                  ❤️ {likeCounts[post.post_id] || 0} likes
                </button>
                · <button onClick={() => handleToggleComments(post.post_id)} style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', fontSize: '0.9em' }}>
                  💬 {commentCounts[post.post_id] || 0} comments
                </button>
              </div>
              {/* Show comments if toggled */}
              {showComments[post.post_id] && comments[post.post_id] && (
                <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                  {comments[post.post_id].length === 0 ? (
                    <div style={{ fontSize: '0.85em', color: '#aaa', marginBottom: '4px' }}>No comments yet.</div>
                  ) : (
                    comments[post.post_id].map((comment) => (
                      <div key={comment.comment_id} style={{ fontSize: '0.92em', color: '#444', background: '#f7f7fa', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px', display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.93em', color: '#6c63ff' }}>{comment.User?.userName || comment.user_id}</span>
                        <span style={{ marginLeft: '8px' }}>{comment.comment_text}</span>
                        {comment.user_id === userId && (
                          <button
                            onClick={async () => {
                              await supabase
                                .from('comments')
                                .delete()
                                .eq('comment_id', comment.comment_id);
                              await fetchCommentsForPost(post.post_id);
                              await fetchPosts(); // Ensure both are awaited for correct state update
                            }}
                            style={{
                              marginLeft: 'auto',
                              background: 'none',
                              border: 'none',
                              color: '#e25555',
                              cursor: 'pointer',
                              fontSize: '1.1em',
                              padding: '2px 8px',
                              fontWeight: 'bold',
                              lineHeight: 1
                            }}
                            title="Delete comment"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
              {/* Comment box UI */}
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentInputs[post.post_id] || ''}
                onChange={(e) => setCommentInputs({ ...commentInputs, [post.post_id]: e.target.value })}
                style={{
                  width: '80%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  marginTop: '8px',
                  marginRight: '8px'
                }}
              />
              <button
                onClick={() => handleComment(post.post_id)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#6c63ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Submit
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Error Popup */}
      {errorMessage && (
        <div style={{
          position: 'fixed',
          top: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#e25555',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          zIndex: 1000,
          fontWeight: 500
        }}>
          {errorMessage}
          <button onClick={() => setErrorMessage("")} style={{ marginLeft: 16, background: 'none', border: 'none', color: 'white', fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  );
}

export default PostForm;
