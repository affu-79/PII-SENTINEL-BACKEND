import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AccountDeleted.css';

const AccountDeleted = () => {
    const navigate = useNavigate();

    return (
        <div className="account-deleted-page">
            <div className="account-deleted-container">
                <div className="account-deleted-content">
                    <div className="deleted-icon">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" />
                        </svg>
                    </div>
                    <h1 className="deleted-title">Account Successfully Removed</h1>
                    <p className="deleted-message">
                        Your account and all associated data have been permanently deleted from our system.
                    </p>
                    <p className="deleted-submessage">
                        We're sorry to see you go. If you change your mind, you can always create a new account.
                    </p>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={() => navigate('/')}
                    >
                        Return to Homepage
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountDeleted;

