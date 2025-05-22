// Import global CSS styles
import './App.css';

// Import React core functions
import React, { useEffect, useState } from 'react';

// Import React Router components
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

// Import Supabase client to manage authentication
import { supabase } from './supabaseClient';

// Import custom components
import SignupLogin from './pages/SignupLogin'; // Login & Signup form
import Account from './pages/Account';         // Profile setup (bio + avatar)
import PostForm from './components/PostForm';       // Main page feed & posting
import Messages from './pages/MessagePage';       // Messages component
import Navigation from './components/Navigation';   // Navigation bar component

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
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // If user is not logged in, show the Signup/Login page
  if (!session) {
    return <SignupLogin onLogin={() => window.location.reload()} />;
  }

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

          <Route path="edit-account" element={<Account />} />
          {/* Messages route */}
          <Route path="/messages" element={<Messages />} />
          
          {/* Redirect any other routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;