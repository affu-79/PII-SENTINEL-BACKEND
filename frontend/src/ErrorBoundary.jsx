import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Ignore MetaMask and browser extension errors
    if (error?.message?.includes('MetaMask') || 
        error?.message?.includes('Failed to connect') ||
        error?.stack?.includes('chrome-extension://') ||
        error?.stack?.includes('moz-extension://')) {
      // Suppress these errors - they're from browser extensions
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Ignore MetaMask and extension errors
    if (error?.message?.includes('MetaMask') || 
        error?.message?.includes('Failed to connect') ||
        error?.stack?.includes('chrome-extension://') ||
        error?.stack?.includes('moz-extension://')) {
      console.log('Ignoring browser extension error:', error.message);
      return;
    }
    
    // Log other errors
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

