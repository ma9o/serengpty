/**
 * Stream Chat Notification Service
 * 
 * This service provides a platform-agnostic interface for handling 
 * Stream Chat notifications and unread counts.
 */
import { ChatNotificationEvent, NotificationHandler } from './types';

export class ChatNotificationService {
  private handlers: NotificationHandler[] = [];
  
  /**
   * Register a notification handler
   * @param handler The notification handler implementation
   */
  registerHandler(handler: NotificationHandler): void {
    this.handlers.push(handler);
  }
  
  /**
   * Unregister a notification handler
   * @param handler The notification handler to remove
   */
  unregisterHandler(handler: NotificationHandler): void {
    this.handlers = this.handlers.filter(h => h !== handler);
  }
  
  /**
   * Update unread count for all registered handlers
   * @param count The unread message count
   */
  updateUnreadCount(count: number): void {
    this.handlers.forEach(handler => {
      try {
        handler.handleUnreadCount(count);
      } catch (error) {
        console.error('Error in notification handler:', error);
      }
    });
  }
  
  /**
   * Notify all handlers of a new message
   * @param event The notification event data
   */
  notifyNewMessage(event: ChatNotificationEvent): void {
    this.handlers.forEach(handler => {
      try {
        handler.handleNewMessage(event);
      } catch (error) {
        console.error('Error in notification handler:', error);
      }
    });
  }
}