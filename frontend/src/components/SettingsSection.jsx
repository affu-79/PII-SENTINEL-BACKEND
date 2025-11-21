import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    updateAccountStatus,
    updatePlan,
    updateSecurity,
    updatePreferences,
    downloadUserData,
    clearActivityLogs,
    logoutUser,
    deleteAccount
} from '../api';
import './SettingsSection.css';

const SettingsSection = ({ user, onUserUpdate }) => {
    const navigate = useNavigate();
    const [expandedSections, setExpandedSections] = useState({});
    const [loading, setLoading] = useState({});
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    // Refs for tracking section positions
    const sectionRefs = useRef({});
    const leftColumnRef = useRef(null);
    const indicatorRef = useRef(null);
    const [indicatorPosition, setIndicatorPosition] = useState({ top: 0, height: 0 });

    // Form states
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [planData, setPlanData] = useState({ 
        plan: user?.subscription?.plan_name || user?.subscription?.plan_type || user?.plan || 'free', 
        billing: user?.subscription?.billing_period || 'monthly' 
    });
    const [preferences, setPreferences] = useState({
        emailUpdates: user?.receiveUpdates || user?.emailUpdates || false,
        dataConsent: user?.consentDataProcessing || user?.dataConsent || false
    });
    const [deleteAccountData, setDeleteAccountData] = useState({ reason: '', confirmText: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (user) {
            setPlanData({
                plan: user.subscription?.plan_name || 'free',
                billing: user.subscription?.billing_period || 'monthly'
            });
            setPreferences({
                emailUpdates: user.receiveUpdates || false,
                dataConsent: user.consentDataProcessing || false
            });
        }
    }, [user]);

    // Calculate indicator position based on active section
    const updateIndicatorPosition = React.useCallback(() => {
        if (!leftColumnRef.current) return;
        
        const activeSection = Object.keys(expandedSections).find(key => expandedSections[key]);
        const targetSection = activeSection || 'account'; // Default to first section
        
        const sectionElement = sectionRefs.current[targetSection];
        if (!sectionElement) {
            // Try again after a short delay if element not ready
            setTimeout(() => {
                const retryElement = sectionRefs.current[targetSection];
                if (retryElement && leftColumnRef.current) {
                    const containerRect = leftColumnRef.current.getBoundingClientRect();
                    const sectionRect = retryElement.getBoundingClientRect();
                    // Find the header element within the section
                    const headerElement = retryElement.querySelector('.settings-card-header');
                    const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : sectionRect.height;
                    
                    setIndicatorPosition({
                        top: sectionRect.top - containerRect.top,
                        height: headerHeight
                    });
                }
            }, 50);
            return;
        }

        const containerRect = leftColumnRef.current.getBoundingClientRect();
        const sectionRect = sectionElement.getBoundingClientRect();
        
        // Find the header element to get its exact height
        const headerElement = sectionElement.querySelector('.settings-card-header');
        const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : sectionRect.height;
        
        setIndicatorPosition({
            top: sectionRect.top - containerRect.top,
            height: headerHeight
        });
    }, [expandedSections]);

    // Update indicator position when expanded sections change
    useEffect(() => {
        const timer = setTimeout(() => {
            updateIndicatorPosition();
        }, 50);
        
        return () => clearTimeout(timer);
    }, [expandedSections, updateIndicatorPosition]);

    // Update on window resize
    useEffect(() => {
        const handleResize = () => {
            setTimeout(updateIndicatorPosition, 100);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateIndicatorPosition]);

    // Initial position on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            updateIndicatorPosition();
        }, 150);
        
        return () => clearTimeout(timer);
    }, [updateIndicatorPosition]);

    const toggleSection = (section) => {
        setExpandedSections(prev => {
            // If clicking the same section, toggle it
            if (prev[section]) {
                return { [section]: false };
            }
            // Otherwise, close all and open the clicked one (accordion behavior)
            return { [section]: true };
        });
    };

    const handleUpdateStatus = async (newStatus) => {
        setLoading(prev => ({ ...prev, status: true }));
        setError('');
        try {
            const response = await updateAccountStatus(user.email, newStatus);
            if (response.success) {
                setSuccessMessage('Account status updated successfully');
                if (onUserUpdate) onUserUpdate(response.user);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to update status');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update account status');
        } finally {
            setLoading(prev => ({ ...prev, status: false }));
        }
    };

    const handleChangePlan = async (newPlan, billingPeriod) => {
        setLoading(prev => ({ ...prev, plan: true }));
        setError('');
        try {
            const response = await updatePlan(user.email, newPlan, billingPeriod);
            if (response.success) {
                setSuccessMessage(`Plan updated to ${newPlan} (${billingPeriod})`);
                setPlanData({ plan: newPlan, billing: billingPeriod });
                if (onUserUpdate) onUserUpdate(response.user);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to update plan');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update plan');
        } finally {
            setLoading(prev => ({ ...prev, plan: false }));
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            setError('New passwords do not match');
            return;
        }
        if (passwordData.new.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(prev => ({ ...prev, password: true }));
        setError('');
        try {
            const response = await updateSecurity({
                email: user.email,
                currentPassword: passwordData.current,
                newPassword: passwordData.new
            });
            if (response.success) {
                setSuccessMessage('Password changed successfully');
                setPasswordData({ current: '', new: '', confirm: '' });
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to change password');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password');
        } finally {
            setLoading(prev => ({ ...prev, password: false }));
        }
    };

    const handleToggle2FA = async () => {
        setLoading(prev => ({ ...prev, twoFA: true }));
        setError('');
        try {
            const response = await updateSecurity({
                email: user.email,
                twoFactorEnabled: !user.twoFactorEnabled
            });
            if (response.success) {
                setSuccessMessage(`2FA ${!user.twoFactorEnabled ? 'enabled' : 'disabled'}`);
                if (onUserUpdate) onUserUpdate(response.user);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to update 2FA');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update 2FA');
        } finally {
            setLoading(prev => ({ ...prev, twoFA: false }));
        }
    };

    const handleResetSessions = async () => {
        if (!window.confirm('This will log you out from all devices. Continue?')) return;
        
        setLoading(prev => ({ ...prev, sessions: true }));
        setError('');
        try {
            const response = await updateSecurity({
                email: user.email,
                resetSessions: true
            });
            if (response.success) {
                setSuccessMessage('All sessions reset. Please log in again.');
                setTimeout(() => {
                    localStorage.clear();
                    navigate('/signup');
                }, 2000);
            } else {
                setError(response.error || 'Failed to reset sessions');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset sessions');
        } finally {
            setLoading(prev => ({ ...prev, sessions: false }));
        }
    };

    const handleUpdatePreferences = async () => {
        setLoading(prev => ({ ...prev, preferences: true }));
        setError('');
        try {
            const response = await updatePreferences({
                email: user.email,
                emailUpdates: preferences.emailUpdates,
                dataConsent: preferences.dataConsent
            });
            if (response.success) {
                setSuccessMessage('Preferences updated successfully');
                if (onUserUpdate) onUserUpdate(response.user);
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to update preferences');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update preferences');
        } finally {
            setLoading(prev => ({ ...prev, preferences: false }));
        }
    };

    const handleDownloadData = async () => {
        setLoading(prev => ({ ...prev, download: true }));
        setError('');
        try {
            const response = await downloadUserData(user.email);
            if (response.success && response.downloadUrl) {
                window.open(response.downloadUrl, '_blank');
                setSuccessMessage('Data download started');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to prepare data download');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to download data');
        } finally {
            setLoading(prev => ({ ...prev, download: false }));
        }
    };

    const handleClearActivity = async () => {
        if (!window.confirm('This will permanently delete your activity logs. Continue?')) return;
        
        setLoading(prev => ({ ...prev, clearActivity: true }));
        setError('');
        try {
            const response = await clearActivityLogs(user.email);
            if (response.success) {
                setSuccessMessage('Activity logs cleared successfully');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to clear activity logs');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to clear activity logs');
        } finally {
            setLoading(prev => ({ ...prev, clearActivity: false }));
        }
    };

    const handleLogout = async () => {
        setLoading(prev => ({ ...prev, logout: true }));
        setError('');
        try {
            await logoutUser(user.email);
            localStorage.clear();
            navigate('/signup');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to logout');
            setLoading(prev => ({ ...prev, logout: false }));
        }
    };

    const handleDeleteAccount = async () => {
        if (!deleteAccountData.reason) {
            setError('Please select a reason for deletion');
            return;
        }
        if (deleteAccountData.confirmText !== 'DELETE') {
            setError('Please type DELETE to confirm');
            return;
        }

        setLoading(prev => ({ ...prev, delete: true }));
        setError('');
        try {
            const response = await deleteAccount({
                email: user.email,
                reason: deleteAccountData.reason
            });
            if (response.success) {
                localStorage.clear();
                navigate('/account-deleted');
            } else {
                setError(response.error || 'Failed to delete account');
                setLoading(prev => ({ ...prev, delete: false }));
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete account');
            setLoading(prev => ({ ...prev, delete: false }));
        }
    };

    const plans = {
        free: {
            name: 'Free',
            monthly: 0,
            yearly: 0,
            storage: '1 GB',
            apiLimit: '100 requests/month',
            features: ['Basic PII detection', 'Up to 10 files per batch', 'Email support']
        },
        pro: {
            name: 'Pro',
            monthly: 29,
            yearly: 290,
            storage: '50 GB',
            apiLimit: '10,000 requests/month',
            features: ['Advanced PII detection', 'Unlimited files per batch', 'Priority support', 'API access', 'Custom PII types']
        },
        enterprise: {
            name: 'Enterprise',
            monthly: 99,
            yearly: 990,
            storage: 'Unlimited',
            apiLimit: 'Unlimited',
            features: ['All Pro features', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-premise deployment']
        }
    };

    if (!user) return null;

    // Check if any section is expanded
    const hasExpanded = Object.values(expandedSections).some(v => v);
    
    // Get the name of the expanded section
    const expandedSectionName = Object.keys(expandedSections).find(key => expandedSections[key]) || null;

    // Define all section keys
    const allSections = ['account', 'plan', 'security', 'privacy', 'logout', 'delete'];

    // Render a single settings card
    const renderSettingsCard = (sectionKey, title, icon, content) => {
        const isExpanded = expandedSections[sectionKey];
        return (
            <div key={sectionKey} className={`settings-card ${sectionKey === 'delete' ? 'danger-zone' : ''}`}>
                <div className="settings-card-header" onClick={() => toggleSection(sectionKey)}>
                    <div className="settings-card-title">
                        {icon}
                        {title}
                    </div>
                    <svg 
                        className={`settings-chevron ${isExpanded ? 'expanded' : ''}`}
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>
                <div className={`settings-card-content ${isExpanded ? 'expanded' : ''}`}>
                    {content}
                </div>
            </div>
        );
    };

    return (
        <div className="settings-section">
            <div className="settings-header">
                <h2 className="settings-title">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
                    </svg>
                    Settings
                </h2>
            </div>

            {error && (
                <div className="alert alert-danger fade show">
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="alert alert-success fade show">
                    {successMessage}
                </div>
            )}

            <div className={`settings-container ${hasExpanded ? 'has-expanded' : ''}`}>
                {/* Left Column: Collapsed Sections */}
                <div className="settings-left-column" ref={leftColumnRef}>
                    {/* Vertical Scroller Indicator */}
                    <div className="settings-scroller-bar">
                        <div 
                            className="settings-scroller-indicator"
                            ref={indicatorRef}
                            style={{
                                top: `${indicatorPosition.top}px`,
                                height: `${indicatorPosition.height}px`,
                                transition: 'top 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        />
                    </div>
                    
                    {/* Account Status */}
                    <div 
                        className={`settings-card ${expandedSections.account ? 'expanded-card' : ''}`}
                        ref={el => sectionRefs.current['account'] = el}
                    >
                    <div className="settings-card-header" onClick={() => toggleSection('account')}>
                        <div className="settings-card-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Account Status
                        </div>
                        <svg 
                            className={`settings-chevron ${expandedSections.account ? 'expanded' : ''}`}
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {!expandedSections.account && (
                        <div className={`settings-card-content ${expandedSections.account ? 'expanded' : ''}`}>
                            <div className="account-info">
                            <div className="info-row">
                                <span className="info-label">Name:</span>
                                <span className="info-value">{user.fullName || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Username:</span>
                                <span className="info-value">@{user.username || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Email:</span>
                                <span className="info-value">{user.email || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Current Plan:</span>
                                <span className={`plan-badge plan-${planData.plan}`}>
                                    {planData.plan.charAt(0).toUpperCase() + planData.plan.slice(1)}
                                </span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Status:</span>
                                <span className={`status-badge status-${user.account_status || 'active'}`}>
                                    {user.account_status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        <button 
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => toggleSection('planDetails')}
                        >
                            View Plan Details
                        </button>
                        {expandedSections.planDetails && (
                            <div className="plan-details-dropdown">
                                <h4>Plan Features</h4>
                                <ul>
                                    {plans[planData.plan]?.features.map((feature, idx) => (
                                        <li key={idx}>{feature}</li>
                                    ))}
                                </ul>
                                <div className="plan-info">
                                    <p><strong>Storage:</strong> {plans[planData.plan]?.storage}</p>
                                    <p><strong>API Limit:</strong> {plans[planData.plan]?.apiLimit}</p>
                                    <p><strong>Billing:</strong> {planData.billing.charAt(0).toUpperCase() + planData.billing.slice(1)}</p>
                                </div>
                            </div>
                        )}
                        </div>
                    )}
                </div>

                    {/* Change Plan */}
                    <div 
                        className={`settings-card ${expandedSections.plan ? 'expanded-card' : ''}`}
                        ref={el => sectionRefs.current['plan'] = el}
                    >
                    <div className="settings-card-header" onClick={() => toggleSection('plan')}>
                        <div className="settings-card-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            </svg>
                            Change Plan
                        </div>
                        <svg 
                            className={`settings-chevron ${expandedSections.plan ? 'expanded' : ''}`}
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {!expandedSections.plan && (
                        <div className={`settings-card-content ${expandedSections.plan ? 'expanded' : ''}`}>
                            <div className="plan-selection">
                            <div className="billing-toggle">
                                <button
                                    className={`billing-btn ${planData.billing === 'monthly' ? 'active' : ''}`}
                                    onClick={() => setPlanData({ ...planData, billing: 'monthly' })}
                                >
                                    Monthly
                                </button>
                                <button
                                    className={`billing-btn ${planData.billing === 'yearly' ? 'active' : ''}`}
                                    onClick={() => setPlanData({ ...planData, billing: 'yearly' })}
                                >
                                    Yearly
                                </button>
                            </div>
                            <div className="plans-grid">
                                {Object.entries(plans).map(([key, plan]) => (
                                    <div key={key} className={`plan-card ${planData.plan === key ? 'selected' : ''}`}>
                                        <h4>{plan.name}</h4>
                                        <div className="plan-price">
                                            ${planData.billing === 'monthly' ? plan.monthly : plan.yearly}
                                            <span>/{planData.billing === 'monthly' ? 'mo' : 'yr'}</span>
                                        </div>
                                        <ul className="plan-features-list">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx}>{feature}</li>
                                            ))}
                                        </ul>
                                        <button
                                            className={`btn ${planData.plan === key ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                                            onClick={() => handleChangePlan(key, planData.billing)}
                                            disabled={loading.plan || planData.plan === key}
                                        >
                                            {loading.plan ? 'Updating...' : planData.plan === key ? 'Current Plan' : planData.plan === 'free' && key !== 'free' ? 'Upgrade' : planData.plan !== 'free' && key === 'free' ? 'Downgrade' : 'Select'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        </div>
                    )}
                </div>

                    {/* Security Settings */}
                    <div 
                        className={`settings-card ${expandedSections.security ? 'expanded-card' : ''}`}
                        ref={el => sectionRefs.current['security'] = el}
                    >
                    <div className="settings-card-header" onClick={() => toggleSection('security')}>
                        <div className="settings-card-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Security Settings
                        </div>
                        <svg 
                            className={`settings-chevron ${expandedSections.security ? 'expanded' : ''}`}
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {!expandedSections.security && (
                        <div className={`settings-card-content ${expandedSections.security ? 'expanded' : ''}`}>
                            <form onSubmit={handleChangePassword} className="security-form">
                            <h4>Change Password</h4>
                            <div className="form-group">
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordData.current}
                                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordData.new}
                                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                    required
                                    minLength="8"
                                />
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={passwordData.confirm}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                    required
                                    minLength="8"
                                />
                            </div>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={loading.password}>
                                {loading.password ? 'Changing...' : 'Change Password'}
                            </button>
                        </form>

                        <div className="security-options">
                            <div className="security-option">
                                <div className="option-info">
                                    <h4>Two-Factor Authentication</h4>
                                    <p>Add an extra layer of security to your account</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={user.twoFactorEnabled || false}
                                        onChange={handleToggle2FA}
                                        disabled={loading.twoFA}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="security-option">
                                <div className="option-info">
                                    <h4>Google Login</h4>
                                    <p>{user.googleLinked ? 'Linked' : 'Not linked'}</p>
                                </div>
                                <span className="status-badge status-active">{user.googleLinked ? 'Linked' : 'Not Linked'}</span>
                            </div>

                            <div className="security-option">
                                <div className="option-info">
                                    <h4>Email Login</h4>
                                    <p>{user.emailLoginEnabled !== false ? 'Active' : 'Inactive'}</p>
                                </div>
                                <span className="status-badge status-active">{user.emailLoginEnabled !== false ? 'Active' : 'Inactive'}</span>
                            </div>

                            <div className="security-option">
                                <div className="option-info">
                                    <h4>Reset All Sessions</h4>
                                    <p>Log out from all devices</p>
                                </div>
                                <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={handleResetSessions}
                                    disabled={loading.sessions}
                                >
                                    {loading.sessions ? 'Resetting...' : 'Reset Sessions'}
                                </button>
                            </div>
                        </div>
                        </div>
                    )}
                </div>

                    {/* Privacy & Data Control */}
                    <div 
                        className={`settings-card ${expandedSections.privacy ? 'expanded-card' : ''}`}
                        ref={el => sectionRefs.current['privacy'] = el}
                    >
                    <div className="settings-card-header" onClick={() => toggleSection('privacy')}>
                        <div className="settings-card-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            Privacy & Data Control
                        </div>
                        <svg 
                            className={`settings-chevron ${expandedSections.privacy ? 'expanded' : ''}`}
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {!expandedSections.privacy && (
                        <div className={`settings-card-content ${expandedSections.privacy ? 'expanded' : ''}`}>
                            <div className="privacy-options">
                            <div className="privacy-option">
                                <div className="option-info">
                                    <h4>Email Updates</h4>
                                    <p>Receive product updates and newsletters</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.emailUpdates}
                                        onChange={(e) => setPreferences({ ...preferences, emailUpdates: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="privacy-option">
                                <div className="option-info">
                                    <h4>Data Collection Consent</h4>
                                    <p>Allow us to collect usage data for improvements</p>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.dataConsent}
                                        onChange={(e) => setPreferences({ ...preferences, dataConsent: e.target.checked })}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleUpdatePreferences}
                                disabled={loading.preferences}
                            >
                                {loading.preferences ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>

                        <div className="data-actions">
                            <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={handleDownloadData}
                                disabled={loading.download}
                            >
                                {loading.download ? 'Preparing...' : 'Download My Data'}
                            </button>
                            <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={handleClearActivity}
                                disabled={loading.clearActivity}
                            >
                                {loading.clearActivity ? 'Clearing...' : 'Clear Activity Logs'}
                            </button>
                        </div>
                        </div>
                    )}
                </div>

                    {/* Logout */}
                    <div 
                        className={`settings-card ${expandedSections.logout ? 'expanded-card' : ''}`}
                        ref={el => sectionRefs.current['logout'] = el}
                    >
                    <div className="settings-card-header" onClick={() => toggleSection('logout')}>
                        <div className="settings-card-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Logout
                        </div>
                        <svg 
                            className={`settings-chevron ${expandedSections.logout ? 'expanded' : ''}`}
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {!expandedSections.logout && (
                        <div className={`settings-card-content ${expandedSections.logout ? 'expanded' : ''}`}>
                            <p>Sign out from your account. You will need to log in again to access your data.</p>
                        <button
                            className="btn btn-primary btn-logout"
                            onClick={handleLogout}
                            disabled={loading.logout}
                        >
                            {loading.logout ? 'Logging out...' : 'Logout'}
                        </button>
                        </div>
                    )}
                </div>

                    {/* Delete Account */}
                    <div 
                        className={`settings-card danger-zone ${expandedSections.delete ? 'expanded-card' : ''}`}
                        ref={el => sectionRefs.current['delete'] = el}
                    >
                    <div className="settings-card-header" onClick={() => toggleSection('delete')}>
                        <div className="settings-card-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete Account
                        </div>
                        <svg 
                            className={`settings-chevron ${expandedSections.delete ? 'expanded' : ''}`}
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {!expandedSections.delete && (
                        <div className={`settings-card-content ${expandedSections.delete ? 'expanded' : ''}`}>
                            <div className="danger-warning">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <p><strong>Warning:</strong> This action is irreversible. Your account and all related data will be permanently deleted.</p>
                        </div>

                        {!showDeleteConfirm ? (
                            <button
                                className="btn btn-danger"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                Delete My Account
                            </button>
                        ) : (
                            <div className="delete-confirm-form">
                                <div className="form-group">
                                    <label>Reason for deletion</label>
                                    <select
                                        className="form-control"
                                        value={deleteAccountData.reason}
                                        onChange={(e) => setDeleteAccountData({ ...deleteAccountData, reason: e.target.value })}
                                        required
                                    >
                                        <option value="">Select a reason</option>
                                        <option value="Privacy concerns">Privacy concerns</option>
                                        <option value="Not useful for me">Not useful for me</option>
                                        <option value="Switching to another service">Switching to another service</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Type <strong>DELETE</strong> to confirm</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={deleteAccountData.confirmText}
                                        onChange={(e) => setDeleteAccountData({ ...deleteAccountData, confirmText: e.target.value })}
                                        placeholder="DELETE"
                                        required
                                    />
                                </div>
                                <div className="delete-actions">
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeleteAccountData({ reason: '', confirmText: '' });
                                        }}
                                        disabled={loading.delete}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className={`btn btn-danger btn-sm ${deleteAccountData.confirmText === 'DELETE' ? 'shake' : ''}`}
                                        onClick={handleDeleteAccount}
                                        disabled={loading.delete || deleteAccountData.confirmText !== 'DELETE'}
                                    >
                                        {loading.delete ? 'Deleting...' : 'Permanently Delete Account'}
                                    </button>
                                </div>
                                        </div>
                                    )}
                        </div>
                    )}
                </div>
            </div>
                
                {/* Right Column: Expanded Section Content */}
                {hasExpanded && (
                    <div className="settings-right-column">
                        {expandedSections.account && (
                            <div className="settings-card expanded-content">
                                <div className="settings-card-content expanded">
                                    <div className="account-info">
                                        <div className="info-row">
                                            <span className="info-label">Name:</span>
                                            <span className="info-value">{user.fullName || 'N/A'}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Username:</span>
                                            <span className="info-value">@{user.username || 'N/A'}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Email:</span>
                                            <span className="info-value">{user.email || 'N/A'}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Current Plan:</span>
                                            <span className={`plan-badge plan-${planData.plan}`}>
                                                {planData.plan.charAt(0).toUpperCase() + planData.plan.slice(1)}
                                            </span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Status:</span>
                                            <span className={`status-badge status-${user.account_status || 'active'}`}>
                                                {user.account_status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={() => toggleSection('planDetails')}
                                    >
                                        View Plan Details
                                    </button>
                                    {expandedSections.planDetails && (
                                        <div className="plan-details-dropdown">
                                            <h4>Plan Features</h4>
                                            <ul>
                                                {plans[planData.plan]?.features.map((feature, idx) => (
                                                    <li key={idx}>{feature}</li>
                                                ))}
                                            </ul>
                                            <div className="plan-info">
                                                <p><strong>Storage:</strong> {plans[planData.plan]?.storage}</p>
                                                <p><strong>API Limit:</strong> {plans[planData.plan]?.apiLimit}</p>
                                                <p><strong>Billing:</strong> {planData.billing.charAt(0).toUpperCase() + planData.billing.slice(1)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {expandedSections.plan && (
                            <div className="settings-card expanded-content">
                                <div className="settings-card-content expanded">
                                    <div className="plan-selection">
                                        <div className="billing-toggle">
                                            <button
                                                className={`billing-btn ${planData.billing === 'monthly' ? 'active' : ''}`}
                                                onClick={() => setPlanData({ ...planData, billing: 'monthly' })}
                                            >
                                                Monthly
                                            </button>
                                            <button
                                                className={`billing-btn ${planData.billing === 'yearly' ? 'active' : ''}`}
                                                onClick={() => setPlanData({ ...planData, billing: 'yearly' })}
                                            >
                                                Yearly
                                            </button>
                                        </div>
                                        <div className="plans-grid">
                                            {Object.entries(plans).map(([key, plan]) => (
                                                <div key={key} className={`plan-card ${planData.plan === key ? 'selected' : ''}`}>
                                                    <h4>{plan.name}</h4>
                                                    <div className="plan-price">
                                                        ${planData.billing === 'monthly' ? plan.monthly : plan.yearly}
                                                        <span>/{planData.billing === 'monthly' ? 'mo' : 'yr'}</span>
                                                    </div>
                                                    <ul className="plan-features-list">
                                                        {plan.features.map((feature, idx) => (
                                                            <li key={idx}>{feature}</li>
                                                        ))}
                                                    </ul>
                                                    <button
                                                        className={`btn plan-card-btn ${planData.plan === key ? 'btn-secondary' : 'btn-primary'}`}
                                                        onClick={() => handleChangePlan(key, planData.billing)}
                                                        disabled={loading.plan || planData.plan === key}
                                                    >
                                                        {loading.plan ? 'Updating...' : planData.plan === key ? 'Current Plan' : planData.plan === 'free' && key !== 'free' ? 'Upgrade' : planData.plan !== 'free' && key === 'free' ? 'Downgrade' : 'Select'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {expandedSections.security && (
                            <div className="settings-card expanded-content">
                                <div className="settings-card-content expanded">
                                    <form onSubmit={handleChangePassword} className="security-form">
                                        <h4>Change Password</h4>
                                        <div className="form-group">
                                            <label>Current Password</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                value={passwordData.current}
                                                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>New Password</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                value={passwordData.new}
                                                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                                                required
                                                minLength="8"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Confirm New Password</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                value={passwordData.confirm}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                                required
                                                minLength="8"
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading.password}>
                                            {loading.password ? 'Changing...' : 'Change Password'}
                                        </button>
                                    </form>

                                    <div className="security-options">
                                        <div className="security-option">
                                            <div className="option-info">
                                                <h4>Two-Factor Authentication</h4>
                                                <p>Add an extra layer of security to your account</p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={user.twoFactorEnabled || false}
                                                    onChange={handleToggle2FA}
                                                    disabled={loading.twoFA}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        <div className="security-option">
                                            <div className="option-info">
                                                <h4>Google Login</h4>
                                                <p>{user.googleLinked ? 'Linked' : 'Not linked'}</p>
                                            </div>
                                            <span className="status-badge status-active">{user.googleLinked ? 'Linked' : 'Not Linked'}</span>
                                        </div>

                                        <div className="security-option">
                                            <div className="option-info">
                                                <h4>Email Login</h4>
                                                <p>{user.emailLoginEnabled !== false ? 'Active' : 'Inactive'}</p>
                                            </div>
                                            <span className="status-badge status-active">{user.emailLoginEnabled !== false ? 'Active' : 'Inactive'}</span>
                                        </div>

                                        <div className="security-option">
                                            <div className="option-info">
                                                <h4>Reset All Sessions</h4>
                                                <p>Log out from all devices</p>
                                            </div>
                                            <button
                                                className="btn btn-outline-danger btn-sm"
                                                onClick={handleResetSessions}
                                                disabled={loading.sessions}
                                            >
                                                {loading.sessions ? 'Resetting...' : 'Reset Sessions'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {expandedSections.privacy && (
                            <div className="settings-card expanded-content">
                                <div className="settings-card-content expanded">
                                    <div className="privacy-options">
                                        <div className="privacy-option">
                                            <div className="option-info">
                                                <h4>Email Updates</h4>
                                                <p>Receive product updates and newsletters</p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={preferences.emailUpdates}
                                                    onChange={(e) => setPreferences({ ...preferences, emailUpdates: e.target.checked })}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        <div className="privacy-option">
                                            <div className="option-info">
                                                <h4>Data Collection Consent</h4>
                                                <p>Allow us to collect usage data for improvements</p>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={preferences.dataConsent}
                                                    onChange={(e) => setPreferences({ ...preferences, dataConsent: e.target.checked })}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={handleUpdatePreferences}
                                            disabled={loading.preferences}
                                        >
                                            {loading.preferences ? 'Saving...' : 'Save Preferences'}
                                        </button>
                                    </div>

                                    <div className="data-actions">
                                        <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={handleDownloadData}
                                            disabled={loading.download}
                                        >
                                            {loading.download ? 'Preparing...' : 'Download My Data'}
                                        </button>
                                        <button
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={handleClearActivity}
                                            disabled={loading.clearActivity}
                                        >
                                            {loading.clearActivity ? 'Clearing...' : 'Clear Activity Logs'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {expandedSections.logout && (
                            <div className="settings-card expanded-content">
                                <div className="settings-card-content expanded">
                                    <p>Sign out from your account. You will need to log in again to access your data.</p>
                                    <button
                                        className="btn btn-primary btn-logout"
                                        onClick={handleLogout}
                                        disabled={loading.logout}
                                    >
                                        {loading.logout ? 'Logging out...' : 'Logout'}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {expandedSections.delete && (
                            <div className="settings-card danger-zone expanded-content">
                                <div className="settings-card-content expanded">
                                    <div className="danger-warning">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" />
                                            <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        <p><strong>Warning:</strong> This action is irreversible. Your account and all related data will be permanently deleted.</p>
                                    </div>

                                    {!showDeleteConfirm ? (
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => setShowDeleteConfirm(true)}
                                        >
                                            Delete My Account
                                        </button>
                                    ) : (
                                        <div className="delete-confirm-form">
                                            <div className="form-group">
                                                <label>Reason for deletion</label>
                                                <select
                                                    className="form-control"
                                                    value={deleteAccountData.reason}
                                                    onChange={(e) => setDeleteAccountData({ ...deleteAccountData, reason: e.target.value })}
                                                    required
                                                >
                                                    <option value="">Select a reason</option>
                                                    <option value="Privacy concerns">Privacy concerns</option>
                                                    <option value="Not useful for me">Not useful for me</option>
                                                    <option value="Switching to another service">Switching to another service</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Type <strong>DELETE</strong> to confirm</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={deleteAccountData.confirmText}
                                                    onChange={(e) => setDeleteAccountData({ ...deleteAccountData, confirmText: e.target.value })}
                                                    placeholder="DELETE"
                                                    required
                                                />
                                            </div>
                                            <div className="delete-actions">
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setShowDeleteConfirm(false);
                                                        setDeleteAccountData({ reason: '', confirmText: '' });
                                                    }}
                                                    disabled={loading.delete}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    className={`btn btn-danger btn-sm ${deleteAccountData.confirmText === 'DELETE' ? 'shake' : ''}`}
                                                    onClick={handleDeleteAccount}
                                                    disabled={loading.delete || deleteAccountData.confirmText !== 'DELETE'}
                                                >
                                                    {loading.delete ? 'Deleting...' : 'Permanently Delete Account'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsSection;

