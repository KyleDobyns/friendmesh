import './App.css';
import React, { useEffect, useState } from 'react';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { supabase } from './supabaseClient';

// Import custom components
import SignupLogin from './pages/SignupLogin';
import Account from './pages/Account';
import PostForm from './components/PostForm';
import Messages from './pages/MessagePage';
import Navigation from './components/Navigation';   
import FriendSystem from './components/FriendSystem';

function App() {
  //track the current user session
  const [session, setSession] = useState(null);

  // Run once on component mount to check if user is logged in
  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session loaded:', session?.user?.id);
      setSession(session);
    });

    // Listen for login/logout state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', session?.user?.id);
      setSession(session);
    });

    // Clean up listener when component unmounts
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // Debug URL changes
  useEffect(() => {
    console.log('App rendered, current URL:', window.location.pathname);
  });

  // If user is not logged in, show the Signup/Login page
  if (!session) {
    return <SignupLogin onLogin={() => window.location.reload()} />;
  }

  console.log('Rendering app for user:', session.user.id);
  
  // If user is logged in, show the app with navigation
  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Navigation bar */}
        <Navigation />

        {/* Routes */}
        <Routes>
          {/* Home route - shows the post feed */}
          <Route path="/" element={<PostForm />} />

          
          <Route path="/edit-account" element={<Account />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/friends" element={<FriendSystem />} />
          
          {/* Redirect any other routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;