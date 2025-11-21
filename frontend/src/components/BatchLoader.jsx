import React from 'react';
import './BatchLoader.css';

/**
 * Batch Loader Component
 * Two modes: 
 * 1. Full-screen loader (modal-style)
 * 2. Inline loader for sidebar
 */
function BatchLoader({ isVisible, message = "Loading batches...", inline = false }) {
  if (!isVisible) return null;

  // Inline loader for sidebar
  if (inline) {
    return (
      <div className="sidebar-batch-loader-inline">
        <div className="sidebar-loader-spinner">
          <div className="sidebar-loader-dot"></div>
          <div className="sidebar-loader-dot"></div>
          <div className="sidebar-loader-dot"></div>
        </div>
        <span className="sidebar-loader-text">{message}</span>
      </div>
    );
  }

  // Full-screen loader
  return (
    <div className="batch-loader-container">
      <div className="batch-loader-content">
        <div className="batch-loader-spinner">
          <div className="spinner-dot"></div>
          <div className="spinner-dot"></div>
          <div className="spinner-dot"></div>
        </div>
        <p className="batch-loader-text">{message}</p>
      </div>
    </div>
  );
}

export default BatchLoader;

