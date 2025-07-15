/**
 * Debug utility for conditional logging based on development mode and admin privileges
 */

// Check if we're in development mode
const isDevelopment = import.meta.env.MODE === 'development';

// Global state for admin status
let isCurrentUserAdmin = false;

// Function to set admin status (called from auth context)
export const setAdminStatus = (isAdmin: boolean) => {
  isCurrentUserAdmin = isAdmin;
};

// Function to check if debugging should be enabled
const shouldDebug = (): boolean => {
  // In development mode, always allow debug
  if (isDevelopment) {
    return true;
  }
  
  // In production, only allow debug if user is admin
  return isCurrentUserAdmin;
};

// Debug utility functions
export const debug = {
  log: (...args: any[]) => {
    if (shouldDebug()) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (shouldDebug()) {
      console.error(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (shouldDebug()) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (shouldDebug()) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (shouldDebug()) {
      console.debug(...args);
    }
  }
};

// Export for convenience
export default debug;