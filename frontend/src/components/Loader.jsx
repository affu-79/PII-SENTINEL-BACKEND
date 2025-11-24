import React from 'react';
import { FiShield } from 'react-icons/fi';
import './Loader.css';

const Loader = ({ 
    fullScreen = false, 
    message = 'Loading...', 
    size = 'medium'
}) => {
    const loaderClass = `loader-wrapper ${fullScreen ? 'loader-fullscreen' : ''} loader-${size}`;

    return (
        <div className={loaderClass}>
            <div className="loader-container">
                {/* Simple Spinner */}
                <div className="loader-spinner">
                    <div className="spinner-ring"></div>
                    <div className="spinner-icon-wrapper">
                        <FiShield className="spinner-icon" />
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className="loader-message">
                        <p className="loader-text">{message}</p>
                        <div className="loader-dots">
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Compact inline loader
export const CompactLoader = ({ size = 'small' }) => {
    return (
        <div className={`compact-loader compact-loader-${size}`}>
            <div className="compact-spinner"></div>
        </div>
    );
};

// Skeleton loader for content placeholders
export const SkeletonLoader = ({ 
    type = 'text', 
    count = 1, 
    height = '20px',
    width = '100%' 
}) => {
    const items = Array.from({ length: count }, (_, i) => i);
    
    const getClassName = () => {
        switch(type) {
            case 'text': return 'skeleton-text';
            case 'circle': return 'skeleton-circle';
            case 'rect': return 'skeleton-rect';
            default: return 'skeleton-text';
        }
    };

    return (
        <div className="skeleton-loader">
            {items.map(i => (
                <div 
                    key={i}
                    className={`skeleton-item ${getClassName()}`}
                    style={{ height, width }}
                />
            ))}
        </div>
    );
};

export default Loader;

