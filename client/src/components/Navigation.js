import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/Navigation.css';

function Navigation() {
    return (
        <nav className="nav-bar">
            <Link to="/" className="nav-title-link">
                <div className="nav-title">FriendMesh</div>
            </Link>
            <ul className="nav-list">
                <li>
                    <Link to="/messages" className="nav-link">
                        Messages
                    </Link>
                </li>
                <li>
                    <Link to="/edit-account" className="nav-link">
                        Account Settings
                    </Link>
                </li>
                <li>
                    <button
                        className="logout-button"
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.reload();
                        }}
                    >
                        Log Out
                    </button>
                </li>
            </ul>
        </nav>
    );
}

export default Navigation;
