import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiBarChart2, FiLock, FiRefreshCcw, FiUnlock } from 'react-icons/fi';
import { getProfile, updateProfile, getUserActivityLog } from './api';
import ScrollButton from './components/ScrollButton';
import Footer from './components/Footer';
import SettingsSection from './components/SettingsSection';
import useTokenAccount from './hooks/useTokenAccount';
import './Profile.css';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editedUser, setEditedUser] = useState(null);
    const [accountStrength, setAccountStrength] = useState(0);
    const [activityLog, setActivityLog] = useState({
        lastLogin: null,
        lastBatchCreated: null,
        lastPiiScanCompleted: null
    });
    const sectionRefs = useRef({});

    const { tokenAccount, featuresEnabled, loading: tokensLoading, refresh: refreshTokenAccount } = useTokenAccount();

    // Initialize all fields from CreateAccount.jsx
    const initializeUserData = (userData) => {
        return {
            // Step 1: Personal & Account Information
            username: userData?.username || '',
            fullName: userData?.fullName || '',
            email: userData?.email || '',
            phoneNumber: userData?.phoneNumber || '',
            country: userData?.country || '',
            preferredLanguage: userData?.preferredLanguage || '',
            profilePicture: userData?.profilePicture || null,
            profilePicturePreview: userData?.profilePicture || null,
            // Step 2: Professional & Company Details
            userType: userData?.userType || '',
            organizationName: userData?.organizationName || '',
            organizationType: userData?.organizationType || '',
            industry: userData?.industry || '',
            companySize: userData?.companySize || '',
            website: userData?.website || '',
            designation: userData?.designation || '',
            department: userData?.department || '',
            yearsOfExperience: userData?.yearsOfExperience || '',
            complianceFrameworks: userData?.complianceFrameworks || [],
            teamSize: userData?.teamSize || '',
            companyLocation: userData?.companyLocation || '',
            // Step 3: Use Case & Motivation
            primaryGoal: userData?.primaryGoal || '',
            reason: userData?.reason || '',
            dataTypes: userData?.dataTypes || [],
            usageEnvironment: userData?.usageEnvironment || '',
            averageVolume: userData?.averageVolume || '',
            needApiAccess: userData?.needApiAccess || false,
            internalUsers: userData?.internalUsers || [],
            deploymentPlan: userData?.deploymentPlan || '',
            // Step 4: Security & Consent
            enable2FA: userData?.enable2FA || false,
            preferredAuthMethod: userData?.preferredAuthMethod || '',
            acceptTerms: userData?.acceptTerms || false,
            acceptPrivacy: userData?.acceptPrivacy || false,
            consentDataProcessing: userData?.consentDataProcessing || false,
            receiveUpdates: userData?.receiveUpdates || false,
        };
    };

    useEffect(() => {
        // Check if user is logged in
        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) {
            setShowSignupModal(true);
            setLoading(false);
            return;
        }

        // Fetch profile data
        const fetchProfile = async () => {
            try {
                const userData = JSON.parse(userInfo);
                const response = await getProfile(userData.username || null, userData.email || null);

                if (response && response.success) {
                    const initializedData = initializeUserData(response.user);
                    setUser(response.user);
                    setEditedUser(initializedData);
                    setStats(response.stats);
                    setError(''); // Clear any previous errors

                    // Calculate account strength
                    const strength = calculateAccountStrength(response.user);
                    setAccountStrength(strength);

                    // Fetch activity log
                    const userId = response.user.email || response.user.username || response.user.mobile;
                    if (userId) {
                        const activity = await getUserActivityLog(userId);
                        setActivityLog({
                            lastLogin: response.user.lastLogin || response.user.updated_at || null,
                            lastBatchCreated: activity.lastBatchCreated,
                            lastPiiScanCompleted: activity.lastPiiScanCompleted
                        });
                    }
                } else {
                    const errorMsg = response?.error || 'Failed to load profile';
                    console.error('Profile fetch error:', errorMsg);
                    setError(errorMsg);
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                const errorMsg = err.response?.data?.error || err.message || 'Failed to load profile. Please try again.';
                setError(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    // Calculate account strength based on user data
    const calculateAccountStrength = (userData) => {
        if (!userData) return 0;

        let score = 0;
        let total = 0;

        // Email verified
        total++;
        if (userData.email && userData.emailVerified !== false) {
            score++;
        }

        // Profile complete (check if key fields are filled)
        total++;
        const requiredFields = ['fullName', 'email', 'country'];
        const hasRequiredFields = requiredFields.every(field => userData[field]);
        if (hasRequiredFields) {
            score++;
        }

        // 2FA enabled
        total++;
        if (userData.enable2FA || userData.twoFactorEnabled) {
            score++;
        }

        return Math.round((score / total) * 100);
    };

    const formatTokenValue = (value) => {
        if (value === null || value === undefined) {
            return '—';
        }
        if (value === 'unlimited') {
            return 'Unlimited';
        }
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
            return String(value);
        }
        return numeric.toLocaleString('en-IN');
    };

    // Format timestamp to human-readable format
    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'Never';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
        }
        return date.toLocaleDateString();
    };

    // Quick Actions handlers
    const handleNewBatch = () => {
        navigate('/dashboard');
    };

    const handleUploadFiles = () => {
        navigate('/dashboard');
    };

    const handleViewAnalytics = () => {
        navigate('/dashboard');
    };

    const handleSupport = () => {
        window.open('mailto:support@piisentinel.com', '_blank');
    };

    const handleRefreshTokens = () => {
        if (typeof refreshTokenAccount === 'function') {
            refreshTokenAccount();
        }
    };

    useEffect(() => {
        // Scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                }
            });
        }, observerOptions);

        Object.values(sectionRefs.current).forEach(ref => {
            if (ref) observer.observe(ref);
        });

        return () => {
            Object.values(sectionRefs.current).forEach(ref => {
                if (ref) observer.unobserve(ref);
            });
        };
    }, [user, stats]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            if (name === 'complianceFrameworks' || name === 'dataTypes' || name === 'internalUsers') {
                const currentValue = editedUser[name] || [];
                setEditedUser(prev => ({
                    ...prev,
                    [name]: currentValue.includes(value)
                        ? currentValue.filter(item => item !== value)
                        : [...currentValue, value]
                }));
            } else {
                setEditedUser(prev => ({ ...prev, [name]: checked }));
            }
        } else {
            setEditedUser(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedUser(prev => ({
                    ...prev,
                    profilePicture: file,
                    profilePicturePreview: reader.result
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        setSuccessMessage('');

        try {
            const response = await updateProfile({
                username: editedUser.username,
                email: editedUser.email,
                ...editedUser,
                profilePicture: editedUser.profilePicturePreview
            });

            if (response.success) {
                setUser(response.user);
                const initializedData = initializeUserData(response.user);
                setEditedUser(initializedData);
                setIsEditing(false);
                setSuccessMessage('Profile updated successfully!');

                // Update localStorage
                localStorage.setItem('userInfo', JSON.stringify(response.user));

                // Clear success message after 3 seconds
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(response.error || 'Failed to update profile');
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            setError(err.response?.data?.error || err.message || 'Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        const initializedData = initializeUserData(user);
        setEditedUser(initializedData);
        setIsEditing(false);
        setError('');
    };


    const displayUser = isEditing ? editedUser : user;
    const displayValue = (field) => {
        if (isEditing) {
            return editedUser?.[field] || '';
        }
        return user?.[field] || 'N/A';
    };

    const planName = tokenAccount?.plan_details?.name || 'Starter';
    const planStatus = (tokenAccount?.subscription?.status || 'active').toLowerCase();
    const tokensTotalDisplay = tokenAccount
        ? tokenAccount.tokens_total === null
            ? 'Unlimited'
            : formatTokenValue(tokenAccount.tokens_total)
        : '—';
    const tokensUsedDisplay = tokenAccount ? formatTokenValue(tokenAccount.tokens_used || 0) : '—';
    const tokensBalanceDisplay = tokenAccount
        ? tokenAccount.tokens_balance === null || tokenAccount.tokens_balance === 'unlimited'
            ? 'Unlimited'
            : formatTokenValue(tokenAccount.tokens_balance)
        : '—';
    const tokenCycleLabel = tokenAccount?.token_period ? `Cycle: ${tokenAccount.token_period}` : null;
    const lastResetLabel = tokenAccount?.last_token_reset
        ? `Last reset ${new Date(tokenAccount.last_token_reset).toLocaleDateString()}`
        : null;

    const planFeaturePills = [
        {
            key: 'lock_json',
            label: 'Lock JSON',
            icon: <FiLock />,
            enabled: !!featuresEnabled.lock_json,
        },
        {
            key: 'unlock_json',
            label: 'Unlock JSON',
            icon: <FiUnlock />,
            enabled: !!featuresEnabled.unlock_json,
        },
        {
            key: 'advanced_analysis',
            label: 'Advanced Analysis Board',
            icon: <FiBarChart2 />,
            enabled: !!featuresEnabled.advanced_analysis,
        },
    ];

    // Removed the explicit loading check, profile content will render immediately
    // and data will populate as it becomes available.

    if (showSignupModal) {
        return (
            <div className="profile-page">
                <div className="signup-modal-overlay">
                    <div className="signup-modal">
                        <div className="signup-modal-content">
                            <div className="signup-icon-3d">
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <h2 className="signup-modal-title">Account Required</h2>
                            <p className="signup-modal-text">
                                You need to create an account to access your profile and view your PII detection statistics.
                            </p>
                            <div className="signup-warnings">
                                <div className="warning-item">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>Create an account to track your batches and files</span>
                                </div>
                                <div className="warning-item">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>View detailed PII detection analytics</span>
                                </div>
                                <div className="warning-item">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>Access your profile settings and preferences</span>
                                </div>
                            </div>
                            <button
                                className="btn btn-primary btn-lg signup-modal-btn"
                                onClick={() => navigate('/create-account')}
                            >
                                Create Account Now
                            </button>
                            <button
                                className="btn btn-link"
                                onClick={() => navigate('/')}
                            >
                                Back to Homepage
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            {/* Animated Background Elements */}
            <div className="profile-bg-blobs">
                <div className="bg-blob blob-1"></div>
                <div className="bg-blob blob-2"></div>
                <div className="bg-blob blob-3"></div>
            </div>
            <div className="profile-bg-particles">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="particle" style={{ '--delay': `${i * 0.1}s` }}></div>
                ))}
            </div>

            <div className="back-home-container">
                <button className="back-home-btn" onClick={() => navigate('/')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="back-home-icon">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="back-home-text">Back to Home</span>
                </button>
            </div>

            <div className="container profile-container">
                {/* Premium Header Section */}
                <div className="profile-header premium-header" ref={el => sectionRefs.current.header = el}>
                    <div className="profile-header-card">
                        <div className="profile-avatar-section">
                            <div className="avatar-wrapper">
                                {isEditing ? (
                                    <div className="profile-picture-upload-edit">
                                        <input
                                            type="file"
                                            id="profilePictureEdit"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="d-none"
                                        />
                                        <label htmlFor="profilePictureEdit" className="profile-picture-label-edit">
                                            {editedUser?.profilePicturePreview ? (
                                                <img src={editedUser.profilePicturePreview} alt="Profile" className="profile-avatar" />
                                            ) : (
                                                <div className="profile-avatar-placeholder">
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                        <circle cx="12" cy="7" r="4" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div className="edit-overlay">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </div>
                                        </label>
                                    </div>
                                ) : (
                                    <>
                                        {user?.profilePicture ? (
                                            <img src={user.profilePicture} alt="Profile" className="profile-avatar" />
                                        ) : (
                                            <div className="profile-avatar-placeholder">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                    <circle cx="12" cy="7" r="4" />
                                                </svg>
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="avatar-glow-ring"></div>
                            </div>
                            <div className="profile-info">
                                <h1 className="profile-name">{displayValue('fullName')}</h1>
                                <p className="profile-username">@{displayValue('username')}</p>
                                <div className="profile-badge">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                    <span>Verified User</span>
                                </div>
                            </div>
                        </div>
                        <div className="profile-actions">
                            {!isEditing ? (
                                <button className="btn btn-primary btn-edit premium-btn" onClick={() => setIsEditing(true)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    Edit Profile
                                </button>
                            ) : (
                                <div className="edit-actions">
                                    <button className="btn btn-secondary btn-cancel premium-btn" onClick={handleCancel} disabled={isSaving}>
                                        Cancel
                                    </button>
                                    <button className="btn btn-primary btn-save premium-btn" onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="alert alert-danger fade show" role="alert" ref={el => sectionRefs.current.error = el}>
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div className="alert alert-success fade show" role="alert" ref={el => sectionRefs.current.success = el}>
                        {successMessage}
                    </div>
                )}

                <div className="plan-overview-card glass-card" ref={el => sectionRefs.current.plan = el}>
                    <div className="plan-overview-card__header">
                        <div>
                            <span className="plan-overview-card__label">Current Plan</span>
                            <div className="plan-overview-card__plan-row">
                                <h3 className="plan-overview-card__plan-name">{planName}</h3>
                                <span className={`plan-overview-card__status plan-overview-card__status--${planStatus}`}>
                                    {planStatus}
                                </span>
                            </div>
                        </div>
                        <button
                            className="plan-overview-card__refresh"
                            onClick={handleRefreshTokens}
                            disabled={tokensLoading}
                            aria-busy={tokensLoading}
                        >
                            <FiRefreshCcw /> {tokensLoading ? 'Refreshing…' : 'Refresh balance'}
                        </button>
                    </div>

                    <div className="plan-overview-card__metrics">
                        <div className="plan-metric">
                            <span className="plan-metric__label">Tokens total</span>
                            <span className="plan-metric__value">{tokensTotalDisplay}</span>
                        </div>
                        <div className="plan-metric">
                            <span className="plan-metric__label">Tokens used</span>
                            <span className="plan-metric__value">{tokensUsedDisplay}</span>
                        </div>
                        <div className="plan-metric">
                            <span className="plan-metric__label">Balance</span>
                            <span className="plan-metric__value plan-metric__value--accent">{tokensBalanceDisplay}</span>
                        </div>
                    </div>

                    {(tokenCycleLabel || lastResetLabel) && (
                        <div className="plan-overview-card__meta">
                            {tokenCycleLabel && <span>{tokenCycleLabel}</span>}
                            {lastResetLabel && <span>{lastResetLabel}</span>}
                        </div>
                    )}

                    <div className="plan-overview-card__actions">
                        <button
                            className="plan-overview-card__btn"
                            onClick={() => navigate('/pricing')}
                        >
                            <FiArrowRight /> Upgrade plan
                        </button>
                        <button
                            className="plan-overview-card__btn plan-overview-card__btn--accent"
                            onClick={() => navigate('/pricing#addons')}
                        >
                            <FiArrowRight /> Top-up tokens
                        </button>
                    </div>

                    <div className="plan-overview-card__features">
                        {planFeaturePills.map((feature) => (
                            <span
                                key={feature.key}
                                className={`plan-feature-pill ${feature.enabled ? 'plan-feature-pill--enabled' : 'plan-feature-pill--disabled'}`}
                            >
                                {feature.icon}
                                {feature.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Premium Stats Cards with Glassmorphism */}
                <div className="stats-grid premium-stats" ref={el => sectionRefs.current.stats = el}>
                    <div className="stat-card glass-card stat-card-1">
                        <div className="stat-card-bg"></div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_batches || 0}</div>
                            <div className="stat-label">Total Batches</div>
                        </div>
                    </div>
                    <div className="stat-card glass-card stat-card-2">
                        <div className="stat-card-bg"></div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_files || 0}</div>
                            <div className="stat-label">Files Scanned</div>
                        </div>
                    </div>
                    <div className="stat-card glass-card stat-card-3">
                        <div className="stat-card-bg"></div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.total_piis || 0}</div>
                            <div className="stat-label">PIIs Detected</div>
                        </div>
                    </div>
                </div>

                {/* Optional Premium UI Sections - Frontend Only */}
                <div className="premium-sections">
                    {/* Quick Actions Row */}
                    <div className="quick-actions-card glass-card" ref={el => sectionRefs.current.quickActions = el}>
                        <h3 className="section-title">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                            Quick Actions
                        </h3>
                        <div className="quick-actions-grid">
                            <button className="quick-action-btn" onClick={handleNewBatch}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                </svg>
                                <span>New Batch</span>
                            </button>
                            <button className="quick-action-btn" onClick={handleUploadFiles}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span>Upload Files</span>
                            </button>
                            <button className="quick-action-btn" onClick={handleViewAnalytics}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                                <span>View Analytics</span>
                            </button>
                            <button className="quick-action-btn" onClick={handleSupport}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>Support</span>
                            </button>
                        </div>
                    </div>

                    {/* Account Strength Meter */}
                    <div className="account-strength-card glass-card" ref={el => sectionRefs.current.strength = el}>
                        <h3 className="section-title">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            Account Strength
                        </h3>
                        <div className="strength-meter">
                            <div className="strength-bar">
                                <div className="strength-fill" style={{ width: `${accountStrength}%` }}></div>
                            </div>
                            <div className="strength-info">
                                <span className="strength-value">{accountStrength}%</span>
                                <span className="strength-label">
                                    {accountStrength >= 80 ? 'Strong' : accountStrength >= 50 ? 'Moderate' : 'Weak'}
                                </span>
                            </div>
                        </div>
                        <div className="strength-features">
                            <div className={`strength-feature ${user?.email && user?.emailVerified !== false ? 'completed' : ''}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Email Verified</span>
                            </div>
                            <div className={`strength-feature ${user?.fullName && user?.email && user?.country ? 'completed' : ''}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Profile Complete</span>
                            </div>
                            <div className={`strength-feature ${user?.enable2FA || user?.twoFactorEnabled ? 'completed' : ''}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>2FA Enabled</span>
                            </div>
                        </div>
                    </div>

                    {/* Last Login & Activity */}
                    <div className="activity-card glass-card" ref={el => sectionRefs.current.activity = el}>
                        <h3 className="section-title">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            Recent Activity
                        </h3>
                        <div className="activity-timeline">
                            <div className="activity-item">
                                <div className="activity-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div className="activity-content">
                                    <div className="activity-title">Last Login</div>
                                    <div className="activity-time">{formatTimeAgo(activityLog.lastLogin)}</div>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                    </svg>
                                </div>
                                <div className="activity-content">
                                    <div className="activity-title">Batch Created</div>
                                    <div className="activity-time">{formatTimeAgo(activityLog.lastBatchCreated)}</div>
                                </div>
                            </div>
                            <div className="activity-item">
                                <div className="activity-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                </div>
                                <div className="activity-content">
                                    <div className="activity-title">PII Scan Completed</div>
                                    <div className="activity-time">{formatTimeAgo(activityLog.lastPiiScanCompleted)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* User Information Sections with Premium Glassmorphism */}
                <div className="info-sections premium-info-sections">
                    {/* Step 1: Personal & Account Information */}
                    <div className="info-card glass-card premium-info-card" ref={el => sectionRefs.current.personal = el}>
                        <div className="info-card-header">
                            <h3 className="info-card-title">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                Personal & Account Information
                            </h3>
                        </div>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Username</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="username"
                                        value={displayValue('username')}
                                        onChange={handleChange}
                                        disabled
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('username')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Full Name</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="fullName"
                                        value={displayValue('fullName')}
                                        onChange={handleChange}
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('fullName')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Email</span>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        className="form-control"
                                        name="email"
                                        value={displayValue('email')}
                                        onChange={handleChange}
                                        disabled
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('email')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Phone Number</span>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        className="form-control"
                                        name="phoneNumber"
                                        value={displayValue('phoneNumber')}
                                        onChange={handleChange}
                                        placeholder="+91 98765 43210"
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('phoneNumber')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Country</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="country"
                                        value={displayValue('country')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Country</option>
                                        <option value="US">United States</option>
                                        <option value="IN">India</option>
                                        <option value="GB">United Kingdom</option>
                                        <option value="CA">Canada</option>
                                        <option value="AU">Australia</option>
                                        <option value="DE">Germany</option>
                                        <option value="FR">France</option>
                                        <option value="JP">Japan</option>
                                        <option value="CN">China</option>
                                        <option value="BR">Brazil</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('country')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Preferred Language</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="preferredLanguage"
                                        value={displayValue('preferredLanguage')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Language</option>
                                        <option value="en">English</option>
                                        <option value="es">Spanish</option>
                                        <option value="fr">French</option>
                                        <option value="de">German</option>
                                        <option value="hi">Hindi</option>
                                        <option value="zh">Chinese</option>
                                        <option value="ja">Japanese</option>
                                        <option value="pt">Portuguese</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('preferredLanguage')}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Professional & Company Details */}
                    <div className="info-card glass-card premium-info-card" ref={el => sectionRefs.current.professional = el}>
                        <div className="info-card-header">
                            <h3 className="info-card-title">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="8.5" cy="7" r="4" />
                                    <path d="M20 8v6M23 11h-6" />
                                </svg>
                                Professional & Company Details
                            </h3>
                        </div>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">User Type</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="userType"
                                        value={displayValue('userType')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select User Type</option>
                                        <option value="Individual">Individual</option>
                                        <option value="Professional">Professional</option>
                                        <option value="Company">Company</option>
                                        <option value="Government">Government</option>
                                        <option value="Academic">Academic</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('userType')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Organization Name</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="organizationName"
                                        value={displayValue('organizationName')}
                                        onChange={handleChange}
                                        placeholder="Acme Corporation"
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('organizationName')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Organization Type</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="organizationType"
                                        value={displayValue('organizationType')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Type</option>
                                        <option value="Private">Private</option>
                                        <option value="Public">Public</option>
                                        <option value="Non-Profit">Non-Profit</option>
                                        <option value="Government">Government</option>
                                        <option value="Educational">Educational</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('organizationType')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Industry</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="industry"
                                        value={displayValue('industry')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Industry</option>
                                        <option value="Technology">Technology</option>
                                        <option value="Healthcare">Healthcare</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Education">Education</option>
                                        <option value="Retail">Retail</option>
                                        <option value="Manufacturing">Manufacturing</option>
                                        <option value="Government">Government</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('industry')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Company Size</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="companySize"
                                        value={displayValue('companySize')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Size</option>
                                        <option value="1-10">1-10 employees</option>
                                        <option value="11-50">11-50 employees</option>
                                        <option value="51-200">51-200 employees</option>
                                        <option value="201-500">201-500 employees</option>
                                        <option value="501-1000">501-1000 employees</option>
                                        <option value="1000+">1000+ employees</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('companySize')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Website</span>
                                {isEditing ? (
                                    <input
                                        type="url"
                                        className="form-control"
                                        name="website"
                                        value={displayValue('website')}
                                        onChange={handleChange}
                                        placeholder="https://www.company.com"
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('website')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Designation</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="designation"
                                        value={displayValue('designation')}
                                        onChange={handleChange}
                                        placeholder="e.g., Data Protection Officer"
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('designation')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Department</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="department"
                                        value={displayValue('department')}
                                        onChange={handleChange}
                                        placeholder="e.g., IT Security"
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('department')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Years of Experience</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="yearsOfExperience"
                                        value={displayValue('yearsOfExperience')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Experience</option>
                                        <option value="0-1">0-1 years</option>
                                        <option value="2-5">2-5 years</option>
                                        <option value="6-10">6-10 years</option>
                                        <option value="11-15">11-15 years</option>
                                        <option value="16+">16+ years</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('yearsOfExperience')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Team Size</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="teamSize"
                                        value={displayValue('teamSize')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Team Size</option>
                                        <option value="1-5">1-5 members</option>
                                        <option value="6-10">6-10 members</option>
                                        <option value="11-20">11-20 members</option>
                                        <option value="21-50">21-50 members</option>
                                        <option value="50+">50+ members</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('teamSize')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Company Location</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className="form-control"
                                        name="companyLocation"
                                        value={displayValue('companyLocation')}
                                        onChange={handleChange}
                                        placeholder="City, Country"
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('companyLocation')}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label">Compliance Frameworks</span>
                                {isEditing ? (
                                    <div className="compliance-checkboxes">
                                        {['GDPR', 'HIPAA', 'PCI-DSS', 'SOC 2', 'ISO 27001', 'CCPA', 'PIPEDA', 'LGPD'].map(framework => (
                                            <div key={framework} className="form-check form-check-inline">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    name="complianceFrameworks"
                                                    value={framework}
                                                    checked={(editedUser?.complianceFrameworks || []).includes(framework)}
                                                    onChange={handleChange}
                                                    id={`framework-${framework}`}
                                                />
                                                <label className="form-check-label" htmlFor={`framework-${framework}`}>
                                                    {framework}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="info-value">
                                        {(user?.complianceFrameworks || []).length > 0
                                            ? user.complianceFrameworks.join(', ')
                                            : 'N/A'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Use Case & Motivation */}
                    <div className="info-card glass-card premium-info-card" ref={el => sectionRefs.current.usecase = el}>
                        <div className="info-card-header">
                            <h3 className="info-card-title">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                </svg>
                                Use Case & Motivation
                            </h3>
                        </div>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Primary Goal</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="primaryGoal"
                                        value={displayValue('primaryGoal')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Primary Goal</option>
                                        <option value="Compliance">Compliance & Regulatory Requirements</option>
                                        <option value="Data Protection">Data Protection & Privacy</option>
                                        <option value="Risk Assessment">Risk Assessment & Management</option>
                                        <option value="Audit">Audit & Reporting</option>
                                        <option value="Automation">Process Automation</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('primaryGoal')}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label">Reason</span>
                                {isEditing ? (
                                    <textarea
                                        className="form-control"
                                        name="reason"
                                        value={displayValue('reason')}
                                        onChange={handleChange}
                                        rows="4"
                                        placeholder="Tell us about your specific use case..."
                                    />
                                ) : (
                                    <span className="info-value">{displayValue('reason')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Usage Environment</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="usageEnvironment"
                                        value={displayValue('usageEnvironment')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Environment</option>
                                        <option value="Cloud">Cloud</option>
                                        <option value="On-Premise">On-Premise</option>
                                        <option value="Hybrid">Hybrid</option>
                                        <option value="SaaS">SaaS</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('usageEnvironment')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Average Volume</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="averageVolume"
                                        value={displayValue('averageVolume')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Volume</option>
                                        <option value="<100">Less than 100</option>
                                        <option value="100-500">100-500</option>
                                        <option value="500-1000">500-1,000</option>
                                        <option value="1000-5000">1,000-5,000</option>
                                        <option value="5000+">5,000+</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('averageVolume')}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Deployment Plan</span>
                                {isEditing ? (
                                    <select
                                        className="form-select"
                                        name="deploymentPlan"
                                        value={displayValue('deploymentPlan')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Timeline</option>
                                        <option value="Immediately">Immediately</option>
                                        <option value="Within 1 month">Within 1 month</option>
                                        <option value="1-3 months">1-3 months</option>
                                        <option value="3-6 months">3-6 months</option>
                                        <option value="6+ months">6+ months</option>
                                        <option value="Exploring">Just exploring</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{displayValue('deploymentPlan')}</span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label">Data Types</span>
                                {isEditing ? (
                                    <div className="data-types-checkboxes">
                                        {['Personal Identifiers', 'Financial Data', 'Health Records', 'Biometric Data', 'Location Data', 'Behavioral Data', 'Communication Data', 'Other'].map(type => (
                                            <div key={type} className="form-check form-check-inline">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    name="dataTypes"
                                                    value={type}
                                                    checked={(editedUser?.dataTypes || []).includes(type)}
                                                    onChange={handleChange}
                                                    id={`datatype-${type}`}
                                                />
                                                <label className="form-check-label" htmlFor={`datatype-${type}`}>
                                                    {type}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="info-value">
                                        {(user?.dataTypes || []).length > 0
                                            ? user.dataTypes.join(', ')
                                            : 'N/A'}
                                    </span>
                                )}
                            </div>
                            <div className="info-item full-width">
                                <span className="info-label">Internal Users</span>
                                {isEditing ? (
                                    <div className="internal-users-checkboxes">
                                        {['IT Team', 'Security Team', 'Compliance Team', 'Data Protection Officer', 'Legal Team', 'Management', 'All Employees'].map(userType => (
                                            <div key={userType} className="form-check form-check-inline">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    name="internalUsers"
                                                    value={userType}
                                                    checked={(editedUser?.internalUsers || []).includes(userType)}
                                                    onChange={handleChange}
                                                    id={`user-${userType}`}
                                                />
                                                <label className="form-check-label" htmlFor={`user-${userType}`}>
                                                    {userType}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="info-value">
                                        {(user?.internalUsers || []).length > 0
                                            ? user.internalUsers.join(', ')
                                            : 'N/A'}
                                    </span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Need API Access</span>
                                {isEditing ? (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            name="needApiAccess"
                                            checked={editedUser?.needApiAccess || false}
                                            onChange={handleChange}
                                            id="needApiAccess"
                                        />
                                        <label className="form-check-label" htmlFor="needApiAccess">
                                            {editedUser?.needApiAccess ? 'Yes' : 'No'}
                                        </label>
                                    </div>
                                ) : (
                                    <span className="info-value">{user?.needApiAccess ? 'Yes' : 'No'}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Step 4: Security & Consent */}
                    <div className="info-card glass-card premium-info-card" ref={el => sectionRefs.current.security = el}>
                        <div className="info-card-header">
                            <h3 className="info-card-title">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Security & Consent
                            </h3>
                        </div>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Enable 2FA</span>
                                {isEditing ? (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            name="enable2FA"
                                            checked={editedUser?.enable2FA || false}
                                            onChange={handleChange}
                                            id="enable2FA"
                                        />
                                        <label className="form-check-label" htmlFor="enable2FA">
                                            {editedUser?.enable2FA ? 'Enabled' : 'Disabled'}
                                        </label>
                                    </div>
                                ) : (
                                    <span className="info-value">{user?.enable2FA ? 'Enabled' : 'Disabled'}</span>
                                )}
                            </div>
                            {isEditing && editedUser?.enable2FA && (
                                <div className="info-item">
                                    <span className="info-label">Preferred Auth Method</span>
                                    <select
                                        className="form-select"
                                        name="preferredAuthMethod"
                                        value={displayValue('preferredAuthMethod')}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select Method</option>
                                        <option value="SMS">SMS</option>
                                        <option value="Email">Email</option>
                                        <option value="Authenticator App">Authenticator App</option>
                                        <option value="Hardware Token">Hardware Token</option>
                                    </select>
                                </div>
                            )}
                            {!isEditing && user?.enable2FA && (
                                <div className="info-item">
                                    <span className="info-label">Preferred Auth Method</span>
                                    <span className="info-value">{displayValue('preferredAuthMethod')}</span>
                                </div>
                            )}
                            <div className="info-item">
                                <span className="info-label">Accept Terms</span>
                                {isEditing ? (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            name="acceptTerms"
                                            checked={editedUser?.acceptTerms || false}
                                            onChange={handleChange}
                                            id="acceptTerms"
                                        />
                                        <label className="form-check-label" htmlFor="acceptTerms">
                                            {editedUser?.acceptTerms ? 'Accepted' : 'Not Accepted'}
                                        </label>
                                    </div>
                                ) : (
                                    <span className="info-value">{user?.acceptTerms ? 'Accepted' : 'Not Accepted'}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Accept Privacy</span>
                                {isEditing ? (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            name="acceptPrivacy"
                                            checked={editedUser?.acceptPrivacy || false}
                                            onChange={handleChange}
                                            id="acceptPrivacy"
                                        />
                                        <label className="form-check-label" htmlFor="acceptPrivacy">
                                            {editedUser?.acceptPrivacy ? 'Accepted' : 'Not Accepted'}
                                        </label>
                                    </div>
                                ) : (
                                    <span className="info-value">{user?.acceptPrivacy ? 'Accepted' : 'Not Accepted'}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Consent Data Processing</span>
                                {isEditing ? (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            name="consentDataProcessing"
                                            checked={editedUser?.consentDataProcessing || false}
                                            onChange={handleChange}
                                            id="consentDataProcessing"
                                        />
                                        <label className="form-check-label" htmlFor="consentDataProcessing">
                                            {editedUser?.consentDataProcessing ? 'Consented' : 'Not Consented'}
                                        </label>
                                    </div>
                                ) : (
                                    <span className="info-value">{user?.consentDataProcessing ? 'Consented' : 'Not Consented'}</span>
                                )}
                            </div>
                            <div className="info-item">
                                <span className="info-label">Receive Updates</span>
                                {isEditing ? (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            name="receiveUpdates"
                                            checked={editedUser?.receiveUpdates || false}
                                            onChange={handleChange}
                                            id="receiveUpdates"
                                        />
                                        <label className="form-check-label" htmlFor="receiveUpdates">
                                            {editedUser?.receiveUpdates ? 'Yes' : 'No'}
                                        </label>
                                    </div>
                                ) : (
                                    <span className="info-value">{user?.receiveUpdates ? 'Yes' : 'No'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings Section */}
                <SettingsSection user={user} onUserUpdate={(updatedUser) => {
                    setUser(updatedUser);
                    const initializedData = initializeUserData(updatedUser);
                    setEditedUser(initializedData);
                }} />
            </div>
            <ScrollButton />
            <Footer />
        </div>
    );
};

export default Profile;
