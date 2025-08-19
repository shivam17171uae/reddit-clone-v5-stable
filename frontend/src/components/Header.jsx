import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Link } from 'react-router-dom';
import AuthModal from './AuthModal';
import SearchBar from './SearchBar'; // Import the new SearchBar component

const NotificationBell = () => {
  const { notifications, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => { setIsOpen(!isOpen); if (!isOpen && unreadCount > 0) markAllAsRead(); }} className="relative">
        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
        {unreadCount > 0 && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-gray-800"></span>}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-700 rounded-lg shadow-xl p-2 z-20">
          {notifications.length === 0 ? <div className="text-gray-400 p-2">No new notifications</div> : notifications.map(n => <div key={n.id} className="p-2 border-b border-gray-600 last:border-b-0">
            <Link to={`/c/general/posts/${n.post_id}`} onClick={() => setIsOpen(false)} className="block hover:bg-gray-600 p-1 rounded"><p className="text-sm text-white"><b>{n.sender_username}</b> replied to your content.</p></Link>
          </div>)}
        </div>
      )}
    </div>
  );
};

function Header() {
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <header className="bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="container mx-auto p-4 max-w-5xl flex justify-between items-center gap-4">
          <Link to="/" className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-green-500">IT IS WORKING NOW</h1>
          </Link>

          <div className="flex-grow flex justify-center px-4">
            <SearchBar />
          </div>

          <div className="flex-shrink-0">
            {user ? (
              <div className="flex items-center space-x-4">
                <NotificationBell />
                <Link to={`/u/${user.username}`} className="text-gray-300 hover:text-white hidden sm:block">Welcome, {user.username}!</Link>
                <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Logout</button>
              </div>
            ) : (
              <button onClick={() => setShowAuth(true)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded">Login / Sign Up</button>
            )}
          </div>
        </div>
      </header>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
};

export default Header;