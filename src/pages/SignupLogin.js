import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

function SignupLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  // Handle user creation in React after successful auth signup
  const handleAuth = async () => {
    setLoading(true);
    
    try {
      let result;

      if (isSignup) {
        console.log('Step 1: Creating auth user...');
        
        // Step 1: Create auth user
        result = await supabase.auth.signUp({ 
          email, 
          password
        });
        
        console.log('Auth signup result:', result);
        
        if (result.error) {
          console.error('Auth signup failed:', result.error);
          alert(`Signup failed: ${result.error.message}`);
          setLoading(false);
          return;
        }

        // Step 2: If auth user was created, add to User table
        if (result.data.user) {
          console.log('Step 2: Adding user to User table...');
          
          try {
            const { error: userTableError } = await supabase
              .from('User')
              .insert({
                user_id: result.data.user.id,
                email: email,
                userName: userName || email.split('@')[0],
                bio: '',
                created_at: new Date().toISOString()
              });
              
            if (userTableError) {
              console.error('Failed to add user to User table:', userTableError);
              alert(`Account created but profile setup failed: ${userTableError.message}. You can still log in.`);
            } else {
              console.log('User successfully added to User table');
              alert('Account created successfully!');
            }
          } catch (userError) {
            console.error('Error adding to User table:', userError);
            alert('Account created but there was an issue setting up your profile. You can still log in.');
          }
        }
        
      } else {
        // Regular login
        console.log('Attempting login...');
        result = await supabase.auth.signInWithPassword({ email, password });
        console.log('Login result:', result);
        
        if (result.error) {
          console.error('Login failed:', result.error);
          alert(`Login failed: ${result.error.message}`);
        } else if (result.data.session) {
          console.log('Login successful');
          onLogin(); // parent tells App to refresh
        }
      }

      setLoading(false);
      
    } catch (error) {
      console.error('Unexpected error:', error);
      alert(`Unexpected error: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto', textAlign: 'center' }}>
      <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>
      
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 8, marginBottom: 10, width: '100%' }}
      />
      
      {/* Show username field only during signup */}
      {isSignup && (
        <input
          type="text"
          placeholder="Username (optional)"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ padding: 8, marginBottom: 10, width: '100%' }}
        />
      )}
      
      <input
        type="password"
        placeholder="Password (min 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 8, marginBottom: 10, width: '100%' }}
      />
      
      <br />
      
      <button onClick={handleAuth} disabled={loading}>
        {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Login'}
      </button>
      
      <p style={{ marginTop: 20 }}>
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button 
          onClick={() => {
            setIsSignup(!isSignup);
            setUserName(''); // Clear username when switching
          }} 
          style={{ border: 'none', background: 'none', color: '#6c63ff', cursor: 'pointer' }}
        >
          {isSignup ? 'Log in' : 'Sign up'}
        </button>
      </p>
      
      {isSignup && (
        <p style={{ fontSize: '12px', color: '#666', marginTop: '1rem' }}>
          You'll receive an email to confirm your account before you can log in
        </p>
      )}
    </div>
  );
}

export default SignupLogin;