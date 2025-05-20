import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function PostForm() {
  // State to hold the post text
  const [content, setContent] = useState('');
  // State to hold selected image file
  const [imageFile, setImageFile] = useState(null);
  // State to store list of posts
  const [posts, setPosts] = useState([]);

  // Fetch all posts from Supabase on component mount
  useEffect(() => {
    fetchPosts();
  }, []);

  // Fetch posts ordered by latest
  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('POSTS')
      .select('*')
      .order('post_date', { ascending: false });

    if (data) setPosts(data);
    if (error) console.error('Error fetching posts:', error);
  };

  // Handle submitting a post
  const handlePost = async () => {
    // Prevent empty post if there's no text or image
    if (!content.trim() && !imageFile) return;

    let imageUrl = null;

    // If an image was selected, upload it to Supabase Storage
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        console.error('Image upload failed:', uploadError);
        return;
      }

      // Get public URL of uploaded image
      const { publicURL } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      imageUrl = publicURL;
    }

    // Insert post into POSTS table
    const { error } = await supabase.from('POSTS').insert([
      {
        post_content: content,
        user_id: 1, // NOTE: Hardcoded user_id for now
        image_url: imageUrl,
      },
    ]);

    if (!error) {
      // Clear input fields after successful post
      setContent('');
      setImageFile(null);
      fetchPosts(); // Refresh feed
    } else {
      console.error('Post failed:', error);
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f0fb', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ display: 'flex', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Sidebar */}
        <div style={{ width: '250px', backgroundColor: '#fff', borderRadius: '8px', padding: '1rem', marginRight: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <img
              src="https://via.placeholder.com/80"
              alt="profile"
              style={{ borderRadius: '50%', marginBottom: '10px' }}
            />
            <h3>Sarah123</h3>
            <a href="#" style={{ fontSize: '0.9em', color: '#007bff' }}>Find Friends</a>
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
                padding: '10px',
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
                marginBottom: '1rem'
              }}
            >
              <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Sarah123 • {new Date(post.post_date).toLocaleString()}
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

              {/* Placeholder for likes and comments */}
              <div style={{ fontSize: '0.9em', color: '#777', marginTop: '0.5rem' }}>
                ❤️ 0 likes · 💬 Comment
              </div>

              {/* Comment box UI (front-end only for now) */}
              <input
                type="text"
                placeholder="Write a comment..."
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
    </div>
  );
}

export default PostForm;
