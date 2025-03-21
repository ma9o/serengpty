import { ChatNotificationEvent } from '@enclaveid/shared-utils';

/**
 * Show a browser notification for a new chat message
 * @param notification The notification event data
 */
export function showChatNotification(notification: ChatNotificationEvent) {
  // Check if browser notifications are supported
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notifications');
    return;
  }

  // Check if we have permission to show notifications
  if (Notification.permission === 'granted') {
    createNotification(notification);
  } else if (Notification.permission !== 'denied') {
    // Request permission
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        createNotification(notification);
      }
    });
  }
}

/**
 * Create and show a notification
 * @param data The notification data
 */
function createNotification(data: ChatNotificationEvent) {
  const { messageText, senderName } = data;
  
  if (!messageText || !senderName) return;
  
  // Create notification
  const notification = new Notification('New message from SerenGPTy', {
    body: `${senderName}: ${messageText}`,
    icon: '/icon-128.png',
  });
  
  // Close notification after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);
  
  // Optional: handle notification click
  notification.onclick = () => {
    // This could open your extension's sidepanel or focus the tab
    window.focus();
    notification.close();
  };
}