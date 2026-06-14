import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ element, requiredRole = 'admin' }) => {
  const token = localStorage.getItem('token');
  const userEmail = localStorage.getItem('user_email');
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || 'admin@edupredict.ai')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  // Check if user has a valid token and is an admin
  if (!token) {
    return <Navigate to="/admin-auth" replace />;
  }

  if (requiredRole === 'admin') {
    // Verify admin status
    if (!userEmail || !adminEmails.includes(userEmail.toLowerCase())) {
      // Try to verify via token JWT payload
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.is_admin) {
          return <Navigate to="/login" replace />;
        }
      } catch {
        return <Navigate to="/admin-auth" replace />;
      }
    }
  }

  return element;
};

export default ProtectedRoute;
