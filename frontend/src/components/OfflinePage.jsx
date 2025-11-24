import React, { useEffect, useState } from 'react';
import './OfflinePage.css';

const OfflinePage = () => {
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = () => {
        setIsRetrying(true);
        // Check if connection is back
        setTimeout(() => {
            if (navigator.onLine) {
                window.location.reload();
            } else {
                setIsRetrying(false);
            }
        }, 1000);
    };

    useEffect(() => {
        // Listen for online event
        const handleOnline = () => {
            window.location.reload();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    return (
        <div className="offline-page">
            <div className="offline-container">
                {/* Animated Disconnected Icon */}
                <div className="offline-icon-wrapper">
                    <div className="offline-icon">
                        <div className="wifi-symbol">
                            <div className="wifi-arc wifi-arc-1"></div>
                            <div className="wifi-arc wifi-arc-2"></div>
                            <div className="wifi-arc wifi-arc-3"></div>
                            <div className="wifi-dot"></div>
                        </div>
                        <div className="disconnect-slash"></div>
                    </div>
                </div>

                {/* Content */}
                <div className="offline-content">
                    <h1 className="offline-title">Oops!</h1>
                    <h2 className="offline-subtitle">Connection Lost</h2>
                    <p className="offline-message">
                        Sorry, it looks like your internet connection has been lost.
                        <br />
                        Please check your connection and try again.
                    </p>

                    {/* Error Details */}
                    <div className="offline-error-box">
                        <div className="error-icon">⚠️</div>
                        <div className="error-text">
                            <strong>Network Error</strong>
                            <span>Unable to reach PII Sentinel servers</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="offline-actions">
                        <button 
                            className="btn-retry" 
                            onClick={handleRetry}
                            disabled={isRetrying}
                        >
                            {isRetrying ? (
                                <>
                                    <span className="retry-spinner"></span>
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <span className="retry-icon">↻</span>
                                    Try Again
                                </>
                            )}
                        </button>
                        <button 
                            className="btn-home" 
                            onClick={() => window.location.href = '/'}
                        >
                            <span className="home-icon">🏠</span>
                            Go Home
                        </button>
                    </div>

                    {/* Tips */}
                    <div className="offline-tips">
                        <h3>Troubleshooting Tips:</h3>
                        <ul>
                            <li>Check if your Wi-Fi or mobile data is turned on</li>
                            <li>Try restarting your router</li>
                            <li>Check if other websites are loading</li>
                            <li>Contact your ISP if the problem persists</li>
                        </ul>
                    </div>
                </div>

                {/* Floating particles for animation */}
                <div className="offline-particles">
                    <div className="particle particle-1"></div>
                    <div className="particle particle-2"></div>
                    <div className="particle particle-3"></div>
                    <div className="particle particle-4"></div>
                    <div className="particle particle-5"></div>
                </div>
            </div>
        </div>
    );
};

export default OfflinePage;

