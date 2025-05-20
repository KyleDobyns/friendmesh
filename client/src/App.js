// Import global CSS styles
import './App.css';

// Import React core functions
import React, { useEffect, useState } from 'react';

// Import Supabase client to manage authentication
import { supabase } from './supabaseClient';

// Import custom components
import SignupLogin from './SignupLogin'; // Login & Signup form
import Account from './Account';         // Profile setup (bio + avatar)
import PostForm from './PostForm';       // Main page feed & posting

function App() {
  // State to track the current user session
  const [session, setSession] = useState(null);

  // Run once on component mount to check if user is logged in
  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for login/logout state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Clean up listener when component unmounts
    return () => listener.subscription.unsubscribe();
  }, []);

  // If user is not logged in, show the Signup/Login page
  if (!session) {
    return <SignupLogin onLogin={() => window.location.reload()} />;
  }

  // If user is logged in, show profile setup + main post feed
  return (
    <>
      {/* Logout Button - clears session */}
      <button
        onClick={async () => {
          await supabase.auth.signOut(); // Logs the user out
          window.location.reload();      // Refresh the app
        }}
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        Log Out
      </button>

      {/* Profile setup (bio + avatar upload) */}
      <Account />

      {/* Main post feed with upload + display */}
      <PostForm />
    </>
  );
}

export default App;
