import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('Error caught by Error Boundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // You can also send to error tracking service like Sentry:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optional: navigate to home or refresh
    // window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          padding: '20px',
          maxWidth: '600px',
          margin: '50px auto',
          background: '#fff5f5',
          border: '1px solid #feb2b2',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#c53030', marginBottom: '15px' }}>
            ⚠️ Something went wrong
          </h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            We're sorry for the inconvenience. Please try refreshing the page or contact support if the problem persists.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details style={{ 
              textAlign: 'left', 
              background: 'white',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '20px',
              border: '1px solid #ddd'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details (Development Only)
              </summary>
              <pre style={{ 
                overflow: 'auto', 
                fontSize: '12px',
                color: '#c53030'
              }}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          
          <button
            onClick={this.handleReset}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent',
              color: '#667eea',
              border: '2px solid #667eea',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;