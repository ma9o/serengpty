/**
 * Unified logger for the extension with consistent formatting across different contexts
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = 'content' | 'background' | 'sidepanel' | 'popup';

interface LogOptions {
  action?: string;
  data?: unknown;
  error?: Error;
}

/**
 * Creates a logger with a specific context
 */
export function createLogger(context: LogContext) {
  const prefix = `[serengpty:${context}]`;
  const isProd = import.meta.env.MODE === 'production';
  
  const formatAction = (action?: string): string => {
    return action ? ` ${action}` : '';
  };

  const log = (level: LogLevel, message: string, options: LogOptions = {}) => {
    // Skip debug logs in production
    if (isProd && level === 'debug') return;
    
    // Skip info logs in production unless they are events
    if (isProd && level === 'info' && !options.action) return;
    
    const { action, data, error } = options;
    
    // Format: [serengpty:context] ACTION: Message
    const formattedMessage = `${prefix}${formatAction(action)}: ${message}`;
    
    switch (level) {
      case 'debug':
        if (data) console.debug(formattedMessage, data);
        else console.debug(formattedMessage);
        break;
      case 'info':
        if (data) console.info(formattedMessage, data);
        else console.info(formattedMessage);
        break;
      case 'warn':
        if (data) console.warn(formattedMessage, data);
        else console.warn(formattedMessage);
        break;
      case 'error':
        if (error) console.error(formattedMessage, error);
        else if (data) console.error(formattedMessage, data);
        else console.error(formattedMessage);
        break;
    }
  };

  return {
    debug: (message: string, options?: LogOptions) => log('debug', message, options),
    info: (message: string, options?: LogOptions) => log('info', message, options),
    warn: (message: string, options?: LogOptions) => log('warn', message, options),
    error: (message: string, options?: LogOptions) => log('error', message, options),
    event: (action: string, message: string, data?: unknown) => {
      log('info', message, { action, data });
    },
  };
}

// Export pre-configured loggers for different contexts
export const contentLogger = createLogger('content');
export const backgroundLogger = createLogger('background');
export const sidepanelLogger = createLogger('sidepanel');
export const popupLogger = createLogger('popup');