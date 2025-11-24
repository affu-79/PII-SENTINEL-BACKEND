import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthPromptModal.css';

function AuthPromptModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCreateAccount = () => {
    navigate('/create-account');
    onClose();
  };

  const handleSignIn = () => {
    navigate('/signup');
    onClose();
  };

  return (
    <>
      {/* Blur Background */}
      <div className="auth-modal-backdrop" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="auth-modal-overlay">
        <div className="auth-modal-content">
          {/* Close Button */}
          <button className="auth-modal-close" onClick={onClose} title="Close">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* Icon */}
          <div className="auth-modal-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
              <path d="M16 11h6"></path>
              <path d="M16 7h6"></path>
            </svg>
          </div>

          {/* Title */}
          <h2 className="auth-modal-title">Sign In or Create Account</h2>

          {/* Message */}
          <p className="auth-modal-message">
            Please create an account in PII Sentinel or sign in if you already have an account to create batches and process documents.
          </p>

          {/* Feature Highlights */}
          <div className="auth-modal-features">
            <div className="feature-item">
              <span
                className="feature-icon"
                aria-hidden="true"
                style={{ width: 20, height: 20, minWidth: 20 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </span>
              <span className="feature-text">Create &amp; Manage Batches</span>
            </div>
            <div className="feature-item">
              <span
                className="feature-icon"
                aria-hidden="true"
                style={{ width: 20, height: 20, minWidth: 20 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              <span className="feature-text">Secure PII Detection</span>
            </div>
            <div className="feature-item">
              <span
                className="feature-icon"
                aria-hidden="true"
                style={{ width: 20, height: 20, minWidth: 20 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </span>
              <span className="feature-text">Fast Results</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="auth-modal-buttons">
            <button
              className="auth-modal-btn btn-create-account"
              onClick={handleCreateAccount}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14"></path>
              </svg>
              <span>Create New Account</span>
            </button>

            <button
              className="auth-modal-btn btn-sign-in"
              onClick={handleSignIn}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>Sign In</span>
            </button>
          </div>

          {/* Footer */}
          <p className="auth-modal-footer">
            Get started in seconds and secure your data with PII Sentinel
          </p>
        </div>
      </div>
    </>
  );
}

export default AuthPromptModal;

