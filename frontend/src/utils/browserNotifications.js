/**
 * Browser Notification API utilities
 * Provides functions to request notification permission and show notifications
 */

/**
 * Request permission to show browser notifications
 * Returns the permission state: 'granted', 'denied', or 'default'
 */
export async function requestNotificationPermission() {
  // Check if browser supports Notification API
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return 'unsupported';
  }

  // If already granted, return immediately
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  // If already denied, return immediately
  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Request permission (only works with user interaction)
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Show a browser notification
 * @param {string} title - Notification title
 * @param {Object} options - Notification options (body, icon, badge, tag, etc.)
 * @returns {Notification|null} - Notification object or null if not supported/denied
 */
export function showNotification(title, options = {}) {
  // Check if browser supports Notification API
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return null;
  }

  // Check if permission is granted
  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }

  // Create and show notification
  const notification = new Notification(title, {
    icon: '/favicon.ico', // Your app icon
    badge: '/favicon.ico',
    requireInteraction: false,
    ...options, // Allow override of defaults
  });

  // Optional: Close notification after 5 seconds
  if (!options.requireInteraction) {
    setTimeout(() => notification.close(), 5000);
  }

  return notification;
}

/**
 * Show notification with retry if permission not granted
 * Useful for calling without pre-checking permission
 */
export async function showNotificationWithPrompt(title, options = {}) {
  const permission = await requestNotificationPermission();
  
  if (permission === 'granted') {
    return showNotification(title, options);
  }
  
  return null;
}
