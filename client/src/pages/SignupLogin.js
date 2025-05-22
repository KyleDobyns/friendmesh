import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

function SignupLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  // Handles both login and signup
  const handleAuth = async () => {
    setLoading(true);
    let result;

    if (isSignup) {
      result = await supabase.auth.signUp({ email, password });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    const { error } = result;
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      onLogin(); // parent tells App to refresh
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
      <input
        type="password"
        placeholder="Password"
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
        <button onClick={() => setIsSignup(!isSignup)} style={{ border: 'none', background: 'none', color: '#6c63ff', cursor: 'pointer' }}>
          {isSignup ? 'Log in' : 'Sign up'}
        </button>
      </p>
    </div>
  );
}

export default SignupLogin;