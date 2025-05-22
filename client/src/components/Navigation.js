import React from 'react';
import {Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
function Navigation() {
    return (
        <nav style={{ 
          backgroundColor: '#6c63ff', 
          padding: '1rem', 
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <ul style={{ 
            display: 'flex', 
            listStyle: 'none', 
            margin: 0, 
            padding: 0,
            gap: '2rem'
          }}>
            <li>
              <Link to="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/messages" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
                Messages
              </Link>
            </li>
                <Link to="/edit-account" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>
                Account Settings
              </Link>
            <li>
                        {/* Logout Button - clears session */}
                <button
                onClick={async () => {
                await supabase.auth.signOut(); // Logs the user out
                window.location.reload();      // Refresh the app
                }}
                style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'white', color: '#6c63ff' }}
            >
            Log Out
            </button>
            </li>
          </ul>
        </nav>
    );
}

export default Navigation;