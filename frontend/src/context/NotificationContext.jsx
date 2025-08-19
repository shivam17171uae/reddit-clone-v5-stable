import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [ws, setWs] = useState(null);
  const { token } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      if (ws) ws.close();
      return;
    }

    fetchNotifications();
    
    // --- THIS IS THE FINAL, CORRECTED LOGIC ---
    // The check now correctly includes the colon
    const socketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${socketProtocol}://${window.location.host}/socket?token=${token}`);
    
    setWs(socket);

    socket.onopen = () => {
      console.log(`[WebSocket] Connection established successfully using ${socketProtocol}://`);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'NEW_NOTIFICATION') {
          setNotifications(prev => [message.payload, ...prev]);
        }
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    };

    socket.onclose = () => {
      console.log("[WebSocket] Connection closed.");
    };
    
    socket.onerror = (error) => {
        console.error("[WebSocket] An error occurred:", error);
    };

    return () => {
      socket.close();
    };
  }, [token, fetchNotifications]);

  const markAllAsRead = async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error("Failed to mark notifications as read", e);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);