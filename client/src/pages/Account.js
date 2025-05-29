import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function Account() {
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    getUser();
  }, []);

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data, error } = await supabase
        .from('User')
        .select('bio, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url || '');
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    let newAvatarUrl = avatarUrl;

    if (avatar) {
      const fileExt = avatar.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatar);

      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      newAvatarUrl = publicUrlData?.publicUrl || '';
      setAvatarUrl(newAvatarUrl);
    }

    const { error } = await supabase
      .from('User')
      .upsert(
        { user_id: user.id, bio: bio, avatar_url: newAvatarUrl },
        { onConflict: 'user_id' }
      );

    if (!error) {
      alert('Profile updated!');
    } else {
      alert('Failed to save profile');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2rem', backgroundColor: '#f8f2ff', minHeight: '100vh' }}>
      <div style={{ flex: 1, maxWidth: '300px', background: 'white', padding: '1.5rem', borderRadius: '10px' }}>
        <h3>Profile</h3>
        {avatarUrl && (
          <img src={avatarUrl} alt="avatar" style={{ width: '100%', borderRadius: '10px', marginBottom: '1rem' }} />
        )}
        <strong>{user?.email?.split('@')[0]}</strong>
        <p style={{ fontStyle: 'italic', color: '#666' }}>{bio}</p>
        <a href="#">Find Friends</a>
      </div>

      <div style={{ flex: 2, marginLeft: '2rem', background: 'white', padding: '2rem', borderRadius: '10px' }}>
        <h2>Set Up Your Profile</h2>
        <textarea
          rows="3"
          placeholder="Your bio..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem', padding: '10px' }}
        />
        <input type="file" accept="image/*" onChange={(e) => {
          setAvatar(e.target.files[0]);
          if (e.target.files[0]) {
            setAvatarUrl(URL.createObjectURL(e.target.files[0]));
          }
        }} />
        <br />
        <button
          onClick={handleSave}
          style={{ marginTop: '1rem', padding: '10px 20px', backgroundColor: '#6c63ff', color: '#fff', border: 'none', borderRadius: '6px' }}
        >
          Save Profile
        </button>
      </div>
    </div>
  );
}

export default Account;