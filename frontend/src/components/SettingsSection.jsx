import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    updateAccountStatus,
    updateSecurity,
    updatePreferences,
    downloadUserData,
    clearActivityLogs,
    logoutUser,
    deleteAccount,
    createPaymentOrder,
    createTokenAddonOrder,
    verifyPayment
} from '../api';
import useTokenAccount from '../hooks/useTokenAccount';
import Loader from './Loader';
import './SettingsSection.css';

const ADDON_TOKEN_PRICE = 1;
const ANNUAL_DISCOUNT = 0.17;
const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = () =>
    new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            resolve(false);
            return;
        }
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = RAZORPAY_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
        document.body.appendChild(script);
    });

const SIMULATION_ENABLED = process.env.REACT_APP_ENABLE_PAYMENT_SIMULATION === 'true';

const formatTokens = (value) => {
    if (value === null || value === undefined) {
        return '0';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (Number.isFinite(value)) {
        return Number(value).toLocaleString('en-IN');
    }
    return String(value);
};

const normalizePlanId = (plan) => {
    if (!plan) return 'starter';
    const value = String(plan).toLowerCase();
    if (['starter', 'free', 'basic'].includes(value)) return 'starter';
    if (['professional', 'pro'].includes(value)) return 'professional';
    if (['enterprise', 'unlimited'].includes(value)) return 'enterprise';
    return value;
};

const getPrefill = (user = {}) => ({
    name: user.fullName || user.username || (user.email ? user.email.split('@')[0] : 'PII Sentinel User'),
    email: user.email || ''
});

const SettingsSection = ({ user, onUserUpdate }) => {
    const navigate = useNavigate();
    const [expandedSections, setExpandedSections] = useState({});
    const [loading, setLoading] = useState({});
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Debug: Log user data to see account_status
    React.useEffect(() => {
        console.log('SettingsSection - User data:', user);
        console.log('SettingsSection - account_status:', user?.account_status);
    }, [user]);

    // Refs for tracking section positions
    const sectionRefs = useRef({});
    const leftColumnRef = useRef(null);
    const indicatorRef = useRef(null);
    const [indicatorPosition, setIndicatorPosition] = useState({ top: 0, height: 0 });

    // Form states
    const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
    const [planData, setPlanData] = useState({
        plan: normalizePlanId(
            user?.plan_id ||
            user?.subscription?.plan_id ||
            user?.subscription?.plan_name ||
            user?.subscription?.plan_type ||
            user?.plan ||
            'starter'
        ),
        billing: (user?.subscription?.billing_period === 'annual' ? 'yearly' : user?.subscription?.billing_period) || 'monthly'
    });

    // Sync planData with user prop changes
    useEffect(() => {
        if (user) {
            const actualPlan = normalizePlanId(
                user.plan_id ||
                user.subscription?.plan_id ||
                user.subscription?.plan_name ||
                user.subscription?.plan_type ||
                user.plan ||
                'starter'
            );
            const actualBilling = (user.subscription?.billing_period === 'annual' ? 'yearly' : user.subscription?.billing_period) || 'monthly';

            console.log('SettingsSection - Syncing plan data:', {
                user_plan_id: user.plan_id,
                subscription_plan_id: user.subscription?.plan_id,
                actualPlan,
                actualBilling
            });

            setPlanData({
                plan: actualPlan,
                billing: actualBilling
            });
        }
    }, [user, user?.plan_id, user?.subscription]);

    const [preferences, setPreferences] = useState({
        emailUpdates: user?.receiveUpdates || user?.emailUpdates || false,
        dataConsent: user?.consentDataProcessing || user?.dataConsent || false
    });
    const [deleteAccountData, setDeleteAccountData] = useState({ reason: '', confirmText: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [planLoading, setPlanLoading] = useState('');
    const [planError, setPlanError] = useState('');
    const [addonTokens, setAddonTokens] = useState(100);
    const [addonLoading, setAddonLoading] = useState(false);
    const [addonError, setAddonError] = useState('');

    const { tokenAccount, refresh: refreshTokenAccount, loading: tokenAccountLoading } = useTokenAccount();

    const googleLinked = (() => {
        if (!user) return false;

        // Check if user logged in via Google
        const hasGoogleAuth =
            (typeof user.is_google_user === 'boolean' && user.is_google_user) ||
            !!user.google_id ||
            !!user.googleId ||
            user.googleLinked === true ||
            user.googleLinked === 'linked' ||
            user.googleLinked === 'Linked' ||
            (typeof user.authProvider === 'string' && user.authProvider.toLowerCase() === 'google') ||
            (Array.isArray(user.authProviders) && user.authProviders.some((provider) => String(provider).toLowerCase() === 'google')) ||
            // If user has profile_picture from Google (starts with https://lh3.googleusercontent.com)
            (user.profile_picture && user.profile_picture.includes('googleusercontent.com'));

        console.log('SettingsSection - Google link status:', {
            hasGoogleAuth,
            is_google_user: user.is_google_user,
            google_id: user.google_id,
            profile_picture: user.profile_picture?.substring(0, 50)
        });
        return hasGoogleAuth;
    })();

    useEffect(() => {
        if (!user) {
            return;
        }
        setPlanData({
            plan: normalizePlanId(
                user.subscription?.plan_id ||
                user.subscription?.plan_name ||
                user.subscription?.plan_type ||
                user.plan ||
                'starter'
            ),
            billing: (user.subscription?.billing_period === 'annual' ? 'yearly' : user.subscription?.billing_period) || 'monthly'
        });
        setPreferences({
            emailUpdates: user.receiveUpdates || false,
            dataConsent: user.consentDataProcessing || false
        });
    }, [user]);

    useEffect(() => {
        loadRazorpayScript().catch((error) => {
            console.warn(error.message);
        });
    }, []);

    const plans = useMemo(() => {
        const computeAnnual = (monthly) => (monthly === 0 ? 0 : Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT)));
        const computeSavings = (monthly) => (monthly === 0 ? 0 : monthly * 12 - computeAnnual(monthly));
        return [
            {
                id: 'starter',
                name: 'Starter',
                priceLabel: 'Free forever',
                pricing: {
                    monthly: 0,
                    yearly: 0
                },
                savings: 0,
                features: [
                    '150 tokens per month',
                    'Create batch: 5 tokens',
                    'Process file: 2 tokens per file',
                    'Download masked file: 5 tokens per file',
                    'Usage dashboard with daily refresh',
                    'Email support'
                ],
                badge: 'Current plan'
            },
            {
                id: 'professional',
                name: 'Professional',
                priceLabel: '₹999/mo',
                pricing: {
                    monthly: 999,
                    yearly: computeAnnual(999)
                },
                savings: computeSavings(999),
                features: [
                    '2000 tokens every month',
                    'Lock/Unlock JSON: 50 tokens each',
                    'Download masked file: 5 tokens per file',
                    'Export PIIs to JSON',
                    'Advanced Analysis Board',
                    'Priority support with audit trail'
                ],
                badge: 'Most popular'
            },
            {
                id: 'enterprise',
                name: 'Enterprise',
                priceLabel: '₹4999/mo',
                pricing: {
                    monthly: 4999,
                    yearly: computeAnnual(4999)
                },
                savings: computeSavings(4999),
                features: [
                    'Unlimited tokens & log records',
                    'All Professional features included',
                    'Dedicated privacy engineer',
                    '24/7 escalation support',
                    'Custom deployment & data residency',
                    'SIEM integrations & audit exports'
                ],
                badge: 'Unlimited'
            }
        ];
    }, []);

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
            // Special handling for nested sections like planDetails
            if (section === 'planDetails') {
                // Just toggle planDetails without affecting other sections
                return { ...prev, planDetails: !prev.planDetails };
            }

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

    const handlePlanCheckout = useCallback(
        async (targetPlan) => {
            if (!user?.email) {
                setPlanError('Please sign in again to manage your plan.');
                return;
            }
            const currentPlanId = normalizePlanId(planData.plan);
            if (targetPlan.id === currentPlanId) {
                setSuccessMessage(`You're already on the ${targetPlan.name} plan.`);
                setTimeout(() => setSuccessMessage(''), 2500);
                return;
            }
            setPlanError('');
            setError('');

            const billingKey = planData.billing === 'yearly' ? 'yearly' : 'monthly';
            const price = targetPlan.pricing[billingKey];

            // Free plan - activate immediately
            if (price === 0) {
                setPlanLoading(targetPlan.id);
                try {
                    setPlanData((prev) => ({ ...prev, plan: targetPlan.id }));
                    setSuccessMessage(`You're now on the ${targetPlan.name} plan.`);
                    setTimeout(() => setSuccessMessage(''), 3200);
                    refreshTokenAccount();
                } catch (error) {
                    console.error('Error switching to free plan', error);
                    setPlanError('Failed to switch plan. Please try again.');
                } finally {
                    setPlanLoading('');
                }
                return;
            }

            if (typeof window === 'undefined' || !window.Razorpay) {
                setPlanError('Payment gateway is still loading. Please wait a moment and try again.');
                return;
            }

            setPlanLoading(targetPlan.id);
            try {
                // Step 1: Create Razorpay order
                console.log(`🔄 Creating payment order for ${targetPlan.name} plan (${planData.billing})...`);
                const orderData = await createPaymentOrder({
                    planId: targetPlan.id,
                    userEmail: user.email,
                    userId: user.email,
                    billingPeriod: planData.billing  // Pass 'monthly' or 'yearly'
                });

                console.log('✓ Payment order created:', orderData.order_id);

                // Step 2: Open Razorpay Checkout
                const rzp = new window.Razorpay({
                    key: orderData.key,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: 'PII Sentinel',
                    description: `${targetPlan.name} Plan Subscription`,
                    image: '/logo.png',
                    order_id: orderData.order_id,

                    handler: async function (response) {
                        try {
                            console.log('🔄 Payment successful, verifying...');

                            // Step 3: Verify payment signature on backend
                            const verificationResult = await verifyPayment({
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                                userEmail: user.email,
                                planId: targetPlan.id
                            });

                            if (verificationResult.success) {
                                console.log('✅ Payment verified successfully!');

                                // Update local state
                                setPlanData((prev) => ({ ...prev, plan: targetPlan.id }));
                                setSuccessMessage(`✅ Payment successful! Upgraded to ${targetPlan.name} plan!`);

                                // Refresh token account
                                refreshTokenAccount();

                                // Reload page after 2 seconds
                                setTimeout(() => {
                                    window.location.reload();
                                }, 2000);
                            } else {
                                throw new Error('Payment verification failed');
                            }
                        } catch (error) {
                            console.error('❌ Payment verification error:', error);
                            setPlanError('Payment verification failed. Please contact support with your payment ID.');
                        } finally {
                            setPlanLoading('');
                        }
                    },

                    prefill: getPrefill(user),

                    notes: {
                        plan_id: targetPlan.id,
                        user_email: user.email
                    },

                    theme: {
                        color: '#5c6ded'
                    },

                    modal: {
                        ondismiss: function () {
                            console.log('Payment canceled by user');
                            setPlanLoading('');
                            setPlanError('Payment canceled');
                        }
                    }
                });

                rzp.on('payment.failed', function (response) {
                    console.error('Payment failed:', response.error);
                    setPlanLoading('');
                    setPlanError(response.error.description || 'Payment failed. You can try again anytime.');
                });

                rzp.open();

            } catch (err) {
                console.error('Plan update failed', err);
                const message =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    err.message ||
                    'Unable to update plan right now.';
                setPlanError(message);
                setPlanLoading('');
            }
        },
        [onUserUpdate, planData.billing, planData.plan, refreshTokenAccount, user?.email]
    );

    const sanitizeAddonInput = useCallback((raw) => {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            return addonTokens;
        }
        return Math.max(1, Math.min(10000, Math.round(parsed)));
    }, [addonTokens]);

    const incrementAddonTokens = useCallback(
        (step = 25) => {
            setAddonTokens((prev) => Math.max(1, Math.min(10000, Math.round(prev + step))));
            setAddonError('');
        },
        []
    );

    const decrementAddonTokens = useCallback(
        (step = 25) => {
            setAddonTokens((prev) => Math.max(1, Math.min(10000, Math.round(prev - step))));
            setAddonError('');
        },
        []
    );

    const addonTotal = useMemo(() => addonTokens * ADDON_TOKEN_PRICE, [addonTokens]);

    const handleAddonPurchase = useCallback(async () => {
        setAddonError('');
        setError('');
        if (!user?.email) {
            setAddonError('Please sign in to purchase tokens.');
            return;
        }
        if (addonTokens <= 0) {
            setAddonError('Please enter how many tokens you need.');
            return;
        }
        if (typeof window === 'undefined' || !window.Razorpay) {
            setAddonError('Payment gateway is still loading. Please wait a moment and try again.');
            return;
        }
        setAddonLoading(true);
        try {
            // Step 1: Create Razorpay order for token addon
            console.log(`🔄 Creating token addon order for ${addonTokens} tokens...`);
            const orderData = await createTokenAddonOrder({
                tokenAmount: addonTokens,
                userEmail: user.email,
                userId: user.email
            });

            console.log('✓ Token addon order created:', orderData.order_id);

            const totalAmount = orderData.amount / 100; // Convert from paise to rupees

            // Step 2: Open Razorpay Checkout
            const rzp = new window.Razorpay({
                key: orderData.key,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'PII Sentinel',
                description: `${addonTokens} Tokens Addon (₹${totalAmount})`,
                image: '/logo.png',
                order_id: orderData.order_id,

                handler: async function (response) {
                    try {
                        console.log('🔄 Payment successful, verifying...');
                        setAddonLoading(true);

                        // Step 3: Verify payment signature on backend
                        const verificationResult = await verifyPayment({
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            userEmail: user.email,
                            tokenAmount: addonTokens
                        });

                        if (verificationResult.success) {
                            console.log('✅ Payment verified successfully!');

                            // Show success message
                            setSuccessMessage(`${addonTokens} tokens added to your account.`);
                            setTimeout(() => setSuccessMessage(''), 3200);

                            // Refresh tokens
                            refreshTokenAccount();

                            // Reload page after 2 seconds
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        } else {
                            throw new Error('Payment verification failed');
                        }
                    } catch (error) {
                        console.error('❌ Payment verification error:', error);
                        setAddonError('Payment verification failed. Please contact support.');
                    } finally {
                        setAddonLoading(false);
                    }
                },

                prefill: getPrefill(user),

                notes: {
                    token_amount: addonTokens,
                    user_email: user.email
                },

                theme: {
                    color: '#5c6ded'
                },

                modal: {
                    ondismiss: function () {
                        console.log('Payment canceled by user');
                        setAddonLoading(false);
                        setAddonError('Payment canceled');
                    }
                }
            });

            rzp.on('payment.failed', function (response) {
                console.error('Payment failed:', response.error);
                setAddonLoading(false);
                setAddonError(response.error.description || 'Payment failed');
            });

            rzp.open();

        } catch (error) {
            console.error('Addon purchase failed', error);
            const message =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                'Unable to purchase tokens right now.';
            setAddonError(message);
            setAddonLoading(false);
        }
    }, [addonTokens, refreshTokenAccount, user?.email, user, setSuccessMessage]);

    const handleAddonInputChange = useCallback(
        (event) => {
            setAddonTokens(sanitizeAddonInput(event.target.value));
            setAddonError('');
        },
        [sanitizeAddonInput]
    );

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
            const result = await downloadUserData(user.email);
            if (result.success && result.blob) {
                const blobUrl = window.URL.createObjectURL(new Blob([result.blob], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = result.fileName || `PII-Sentinel-DataExport-${Date.now()}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
                setSuccessMessage(result.message || 'Data export ready');
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(result.error || 'Failed to prepare data download');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to download data');
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

    const billingKey = planData.billing === 'yearly' ? 'yearly' : 'monthly';
    const currentPlanId = normalizePlanId(planData.plan);
    const currentPlanDefinition = useMemo(
        () => plans.find((plan) => plan.id === currentPlanId) || plans[0],
        [plans, currentPlanId]
    );

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

    const renderPlanSelection = (options = {}) => {
        const showAddonSection = options.showAddonSection ?? false;
        return (
            <div className="plan-selection">
                <div className="billing-toggle">
                    <button
                        className={`billing-btn ${planData.billing === 'monthly' ? 'active' : ''}`}
                        onClick={() => {
                            setPlanData((prev) => ({ ...prev, billing: 'monthly' }));
                            setPlanError('');
                        }}
                    >
                        Monthly
                    </button>
                    <button
                        className={`billing-btn ${planData.billing === 'yearly' ? 'active' : ''}`}
                        onClick={() => {
                            setPlanData((prev) => ({ ...prev, billing: 'yearly' }));
                            setPlanError('');
                        }}
                    >
                        Yearly
                        <span className="billing-savings">Save 17%</span>
                    </button>
                </div>
                {planError && <p className="settings-error">{planError}</p>}
                <div className="plans-grid">
                    {plans.map((plan) => {
                        const isCurrent = plan.id === currentPlanId;
                        const priceValue = plan.pricing[billingKey];
                        const displayPrice =
                            priceValue === 0
                                ? 'Free'
                                : `₹${priceValue.toLocaleString('en-IN')}/${billingKey === 'yearly' ? 'yr' : 'mo'}`;
                        const equivalentMonthly =
                            billingKey === 'yearly' && plan.pricing.yearly
                                ? Math.round((plan.pricing.yearly || 0) / 12)
                                : plan.pricing.monthly;
                        const isLoading = planLoading === plan.id;
                        return (
                            <div
                                key={plan.id}
                                className={`plan-card ${isCurrent ? 'selected' : ''}`}
                            >
                                {plan.badge && <span className="plan-card__badge">{plan.badge}</span>}
                                <h4>{plan.name}</h4>
                                <div className="plan-price">
                                    <span className="plan-price__value">{displayPrice}</span>
                                    {billingKey === 'yearly' && plan.pricing.monthly > 0 && (
                                        <span className="plan-price__sub">
                                            ~₹{equivalentMonthly.toLocaleString('en-IN')}/mo billed yearly
                                        </span>
                                    )}
                                </div>
                                <ul className="plan-features-list">
                                    {plan.features.map((feature) => (
                                        <li key={feature}>{feature}</li>
                                    ))}
                                </ul>
                                <button
                                    className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'} btn-sm plan-card-btn`}
                                    onClick={() => handlePlanCheckout(plan)}
                                    disabled={isLoading || isCurrent}
                                >
                                    {isLoading
                                        ? 'Preparing checkout…'
                                        : isCurrent
                                            ? 'Current Plan'
                                            : plan.pricing[billingKey] === 0
                                                ? 'Activate'
                                                : 'Upgrade'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {showAddonSection && (
                    <div className="plan-addon-wrapper">
                        <div className="token-summary-card">
                            <h4>Token overview</h4>
                            <div className="token-summary-grid">
                                <div className="token-metric">
                                    <span className="token-metric__label">Total</span>
                                    <span className="token-metric__value">
                                        {formatTokens(tokenAccount?.tokens_total)}
                                    </span>
                                </div>
                                <div className="token-metric">
                                    <span className="token-metric__label">Used</span>
                                    <span className="token-metric__value">
                                        {formatTokens(tokenAccount?.tokens_used)}
                                    </span>
                                </div>
                                <div className="token-metric">
                                    <span className="token-metric__label">Balance</span>
                                    <span className="token-metric__value">
                                        {formatTokens(tokenAccount?.tokens_balance)}
                                    </span>
                                </div>
                            </div>
                            <p className="token-summary-note">
                                {tokenAccountLoading
                                    ? 'Refreshing usage…'
                                    : tokenAccount?.token_period
                                        ? `Cycle: ${tokenAccount.token_period}`
                                        : 'Token balances refresh monthly.'}
                            </p>
                        </div>

                        <div className="settings-addon-card">
                            <div className="settings-addon-card__header">
                                <h4>Need more tokens?</h4>
                                <span>₹{ADDON_TOKEN_PRICE} per token</span>
                            </div>
                            <p className="settings-addon-card__hint">
                                Add-on tokens credit instantly once payment succeeds.
                            </p>
                            <div className="addon-stepper">
                                <button type="button" onClick={() => decrementAddonTokens()} aria-label="Decrease tokens">
                                    −
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    step="25"
                                    value={addonTokens}
                                    onChange={handleAddonInputChange}
                                />
                                <button type="button" onClick={() => incrementAddonTokens()} aria-label="Increase tokens">
                                    +
                                </button>
                            </div>
                            <div className="addon-total">
                                <span>Total</span>
                                <strong>₹{addonTotal.toLocaleString('en-IN')}</strong>
                            </div>
                            {addonError && <p className="settings-error">{addonError}</p>}
                            <button
                                className="btn btn-outline-primary"
                                onClick={handleAddonPurchase}
                                disabled={addonLoading}
                            >
                                {addonLoading ? 'Processing…' : 'Purchase tokens'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="settings-section">
            {/* Show loader when processing payments */}
            {(planLoading || addonLoading) && (
                <Loader
                    fullScreen
                    message={planLoading ? "Processing plan change..." : "Processing token purchase..."}
                    size="medium"
                />
            )}

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
                                </div>
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => toggleSection('planDetails')}
                                >
                                    View Plan Details
                                </button>
                                {expandedSections.planDetails && (
                                    <div className="plan-details-dropdown">
                                        <h4>Plan features</h4>
                                        <ul>
                                            {currentPlanDefinition.features.map((feature, idx) => (
                                                <li key={idx}>{feature}</li>
                                            ))}
                                        </ul>
                                        <div className="plan-info">
                                            <p>
                                                <strong>Monthly price:</strong>{' '}
                                                {currentPlanDefinition.pricing.monthly === 0
                                                    ? 'Free'
                                                    : `₹${currentPlanDefinition.pricing.monthly.toLocaleString('en-IN')}`}
                                            </p>
                                            {currentPlanDefinition.pricing.yearly > 0 && (
                                                <p>
                                                    <strong>Yearly price:</strong>{' '}
                                                    ₹{currentPlanDefinition.pricing.yearly.toLocaleString('en-IN')} (save 17%)
                                                </p>
                                            )}
                                            <p>
                                                <strong>Billing cadence:</strong> {planData.billing === 'yearly' ? 'Yearly' : 'Monthly'}
                                            </p>
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
                                {renderPlanSelection()}
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
                                            <p>{googleLinked ? 'Linked' : 'Not linked'}</p>
                                        </div>
                                        <span className={`status-badge ${googleLinked ? 'status-active' : 'status-inactive'}`}>
                                            {googleLinked ? 'Linked' : 'Not Linked'}
                                        </span>
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
                                    </div>
                                    <button
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={() => toggleSection('planDetails')}
                                    >
                                        View Plan Details
                                    </button>
                                    {expandedSections.planDetails && (
                                        <div className="plan-details-dropdown">
                                            <h4>Plan features</h4>
                                            <ul>
                                                {currentPlanDefinition.features.map((feature, idx) => (
                                                    <li key={idx}>{feature}</li>
                                                ))}
                                            </ul>
                                            <div className="plan-info">
                                                <p>
                                                    <strong>Monthly price:</strong>{' '}
                                                    {currentPlanDefinition.pricing.monthly === 0
                                                        ? 'Free'
                                                        : `₹${currentPlanDefinition.pricing.monthly.toLocaleString('en-IN')}`}
                                                </p>
                                                {currentPlanDefinition.pricing.yearly > 0 && (
                                                    <p>
                                                        <strong>Yearly price:</strong>{' '}
                                                        ₹{currentPlanDefinition.pricing.yearly.toLocaleString('en-IN')} (save 17%)
                                                    </p>
                                                )}
                                                <p>
                                                    <strong>Billing cadence:</strong>{' '}
                                                    {planData.billing === 'yearly' ? 'Yearly' : 'Monthly'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {expandedSections.plan && (
                            <div className="settings-card expanded-content">
                                <div className="settings-card-content expanded">
                                    {renderPlanSelection({ showAddonSection: true })}
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
                                                <p>{googleLinked ? 'Linked' : 'Not linked'}</p>
                                            </div>
                                            <span className={`status-badge ${googleLinked ? 'status-active' : 'status-inactive'}`}>
                                                {googleLinked ? 'Linked' : 'Not Linked'}
                                            </span>
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

