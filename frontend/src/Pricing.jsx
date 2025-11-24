import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiZap,
    FiTrendingUp,
    FiShield,
    FiArrowRight,
    FiDownload,
    FiPlus,
    FiMinus,
    FiInfo,
    FiCheckCircle,
    FiCheck as FiCheckIcon,
    FiUsers,
    FiBarChart2,
    FiX
} from 'react-icons/fi';
import BillingToggle from './components/BillingToggle';
import Footer from './components/Footer';
import Loader from './components/Loader';
import {
    createPaymentOrder,
    createTokenAddonOrder,
    verifyPayment,
    fetchTokenSummary,
    downloadInvoicePdf,
    fetchInvoiceMetadata
} from './api';
import './Pricing.css';

const ADDON_TOKEN_PRICE = 1;
const ANNUAL_DISCOUNT = 0.17;
const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const SIMULATION_ENABLED = process.env.REACT_APP_ENABLE_PAYMENT_SIMULATION === 'true';

const persistTokenSnapshot = (snapshot) => {
    if (typeof window === 'undefined') {
        return;
    }
    if (snapshot) {
        window.localStorage.setItem('tokenAccountSnapshot', JSON.stringify(snapshot));
    } else {
        window.localStorage.removeItem('tokenAccountSnapshot');
    }
    window.dispatchEvent(new CustomEvent('token-account-updated', { detail: snapshot }));
};

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

const getStoredUser = () => {
    if (typeof window === 'undefined') {
        return null;
    }
    const raw = window.localStorage.getItem('userInfo');
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn('Unable to parse stored user', err);
        return null;
    }
};

const getPrefill = (user = {}) => ({
    name: user.fullName || user.username || (user.email ? user.email.split('@')[0] : 'PII Sentinel User'),
    email: user.email || ''
});

const formatTokens = (value) => {
    if (value === null || value === undefined) {
        return '0';
    }
    if (typeof value === 'string') {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return Number(value).toLocaleString('en-IN');
};

const Pricing = () => {
    const navigate = useNavigate();
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [currentUser, setCurrentUser] = useState(() => getStoredUser());
    const [tokenSummary, setTokenSummary] = useState(null);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const [planLoading, setPlanLoading] = useState(null);
    const [planError, setPlanError] = useState('');
    const [addonTokens, setAddonTokens] = useState(100);
    const [addonLoading, setAddonLoading] = useState(false);
    const [addonError, setAddonError] = useState('');
    const [modalState, setModalState] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceError, setInvoiceError] = useState('');

    useEffect(() => {
        let cancelled = false;
        loadRazorpayScript()
            .then(() => {
                if (!cancelled) {
                    // noop - presence of window.Razorpay is sufficient
                }
            })
            .catch((error) => console.warn(error.message));
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (currentUser) {
            return;
        }
        const stored = getStoredUser();
        if (stored) {
            setCurrentUser(stored);
        }
    }, [currentUser]);

    const refreshTokens = useCallback(async (email) => {
        if (!email) {
            return;
        }
        try {
            setLoadingTokens(true);
            const response = await fetchTokenSummary(email);
            setTokenSummary(response.tokens);
            persistTokenSnapshot(response.tokens);
        } catch (error) {
            console.error('Failed to fetch token summary', error);
        } finally {
            setLoadingTokens(false);
        }
    }, []);

    useEffect(() => {
        if (!currentUser?.email) {
            return;
        }
        refreshTokens(currentUser.email);
    }, [currentUser?.email, refreshTokens]);

    const resolveUser = useCallback(() => {
        if (currentUser?.email) {
            return currentUser;
        }
        const stored = getStoredUser();
        if (stored?.email) {
            setCurrentUser(stored);
            return stored;
        }
        return null;
    }, [currentUser]);

    const ensureAuthenticated = useCallback(
        (setError) => {
            const user = resolveUser();
            if (!user?.email) {
                setError('Please sign in to continue.');
                setTimeout(() => navigate('/signup'), 450);
                return null;
            }
            return user;
        },
        [navigate, resolveUser]
    );

    const handleBillingChange = useCallback((cycle) => {
        setBillingCycle(cycle === 'yearly' ? 'yearly' : 'monthly');
    }, []);

    const prefetchInvoice = useCallback((paymentId, email) => {
        if (!paymentId || !email) {
            return;
        }
        setTimeout(async () => {
            try {
                const data = await fetchInvoiceMetadata({ txId: paymentId, userEmail: email });
                if (data?.invoice) {
                    setModalState((prev) => (prev && prev.paymentId === paymentId ? { ...prev, invoice: data.invoice } : prev));
                }
            } catch (error) {
                // Invoice may not be ready yet; user can download manually later
            }
        }, 1800);
    }, []);

    const plans = useMemo(() => {
        const computeAnnual = (monthly) => (monthly === 0 ? 0 : Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT)));
        const computeSavings = (monthly) => (monthly === 0 ? 0 : monthly * 12 - computeAnnual(monthly));

        return [
        {
                id: 'starter',
            name: 'Starter',
                icon: <FiZap />,
                theme: 'starter',
                badge: 'Free forever',
                caption: 'Daily privacy hygiene for individuals and builders',
                pricing: {
                    monthly: 0,
                    annual: 0
                },
                savings: {
                    annual: 0
                },
                tokens: {
                    headline: '150 tokens every month',
                    subline: 'Auto-refresh: 5 tokens added each day'
                },
            features: [
                    'Document & image uploads consume 1 token per file',
                    'Real-time usage alerts keep you ahead of renewals',
                    'Usage dashboard with daily refresh history'
                ],
                limits: [
                    'Lock JSON not available',
                    'Unlock / Verify JSON not available',
                    'Advanced Analysis Board not available'
                ],
                cta: 'Start for free',
                ctaVariant: 'outline',
                meta: 'Perfect for pilots, demos, and personal privacy workflows.'
            },
            {
                id: 'professional',
            name: 'Professional',
                icon: <FiTrendingUp />,
                theme: 'professional',
                badge: 'Most popular',
                caption: 'Scale with token automation and advanced analytics',
                pricing: {
                    monthly: 999,
                    annual: computeAnnual(999)
                },
                savings: {
                    annual: computeSavings(999)
                },
                tokens: {
                    headline: '2000 tokens every month',
                    subline: 'Lock / Unlock JSON consume 50 tokens per run'
                },
            features: [
                    'Advanced Analysis Board and premium dashboards unlocked',
                    'Priority support with workspace audit trail & alerts',
                    'Role-based access with rolling log retention'
                ],
                limits: ['Unlimited lock/unlock available while tokens remain'],
                cta: 'Upgrade to Professional',
                ctaVariant: 'outline',
                meta: 'Best for SMEs and fast-growing product teams with compliance goals.'
            },
            {
                id: 'enterprise',
            name: 'Enterprise',
                icon: <FiShield />,
                theme: 'enterprise',
                badge: 'Unlimited',
                caption: 'Enterprise-grade privacy automation with concierge support',
                pricing: {
                    monthly: 4999,
                    annual: computeAnnual(4999)
                },
                savings: {
                    annual: computeSavings(4999)
                },
                tokens: {
                    headline: 'Unlimited tokens',
                    subline: 'All premium features, log records, and concierge onboarding included'
                },
            features: [
                    'Dedicated privacy engineer & 24/7 escalation desk',
                    'Granular log records with SIEM integrations & audit exports',
                    'Custom deployment, data residency, and procurement support'
                ],
                limits: [],
                cta: 'Choose Enterprise',
                ctaVariant: 'outline',
                meta: 'Tailored for regulated industries, SOC2-ready teams, and global deployments.'
            }
        ];
    }, []);

    const renderPrice = (plan) => {
        const billingKey = billingCycle === 'yearly' ? 'annual' : 'monthly';
        const price = plan.pricing[billingKey];
        if (!price) {
            return (
                <div className="pricing-card__price-wrapper">
                    <span className="pricing-card__price-value">Free</span>
                    <span className="pricing-card__price-period">forever</span>
                </div>
            );
        }
        if (billingCycle === 'monthly') {
            return (
                <div className="pricing-card__price-wrapper">
                    <span className="pricing-card__price-value">₹{price.toLocaleString('en-IN')}</span>
                    <span className="pricing-card__price-period">/month</span>
                </div>
            );
        }
        const equivalentMonthly = Math.round(price / 12);
        return (
            <div className="pricing-card__price-wrapper">
                <span className="pricing-card__price-value">₹{price.toLocaleString('en-IN')}</span>
                <span className="pricing-card__price-period">/year</span>
                <span className="pricing-card__price-detail">
                    Billed annually (~₹{equivalentMonthly.toLocaleString('en-IN')} / month)
                </span>
                {plan.savings?.annual ? (
                    <span className="pricing-card__price-save">
                        Save ₹{plan.savings.annual.toLocaleString('en-IN')} / year
                    </span>
                ) : null}
            </div>
        );
    };

    const handlePlanCheckout = useCallback(
        async (plan) => {
            setPlanError('');
            const user = ensureAuthenticated(setPlanError);
            if (!user) {
                return;
            }
            
            const email = user.email;
            
            // Free plan - activate immediately
            if (plan.pricing.monthly === 0) {
                setPlanLoading(plan.id);
                try {
                    // For free plan, just show success (backend handles on signup)
                    setModalState({
                        type: 'plan',
                        plan,
                        status: 'activated',
                        paymentId: null,
                        tokensGranted: null
                    });
                    refreshTokens(email);
                } catch (error) {
                    console.error('Error activating free plan', error);
                    setPlanError('Failed to activate free plan. Please try again.');
                } finally {
                    setPlanLoading(null);
                }
                return;
            }
            
            // Paid plans - check if Razorpay is loaded
            if (typeof window !== 'undefined' && !window.Razorpay) {
                setPlanError('Payment gateway is still loading. Please wait a moment and try again.');
                return;
            }
            
            setPlanLoading(plan.id);
            try {
                // Step 1: Create Razorpay order
                console.log(`🔄 Creating payment order for ${plan.name} plan (${billingCycle})...`);
                const orderData = await createPaymentOrder({
                    planId: plan.id,
                    userEmail: email,
                    userId: email,
                    billingPeriod: billingCycle  // Pass 'monthly' or 'yearly'
                });

                console.log('✓ Payment order created:', orderData.order_id);

                // Step 2: Open Razorpay Checkout
                const rzp = new window.Razorpay({
                    key: orderData.key,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    name: 'PII Sentinel',
                    description: `${plan.name} Plan Subscription`,
                    image: '/logo.png',
                    order_id: orderData.order_id,
                    
                    handler: async function (response) {
                        try {
                            console.log('🔄 Payment successful, verifying...');
                            setPlanLoading(plan.id);
                            
                            // Step 3: Verify payment signature on backend
                            const verificationResult = await verifyPayment({
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature,
                                userEmail: email,
                                planId: plan.id
                            });

                            if (verificationResult.success) {
                                console.log('✅ Payment verified successfully!');
                                
                                // Show success modal
                                setModalState({
                                    type: 'plan',
                                    plan,
                                    status: 'activated',
                                    paymentId: response.razorpay_payment_id,
                                    tokensGranted: null
                                });
                                
                                // Refresh tokens
                                refreshTokens(email);
                                
                                // Reload page after 2 seconds to show updated plan
                                setTimeout(() => {
                                    window.location.reload();
                                }, 2000);
                            } else {
                                throw new Error('Payment verification failed');
                            }
                        } catch (error) {
                            console.error('❌ Payment verification error:', error);
                            setPlanError('Payment verification failed. Please contact support.');
                            setModalState({
                                type: 'error',
                                title: 'Payment Verification Failed',
                                message: 'Your payment was successful but verification failed. Please contact support with your payment ID.'
                            });
                        } finally {
                            setPlanLoading(null);
                        }
                    },
                    
                    prefill: getPrefill(user),
                    
                    notes: {
                        plan_id: plan.id,
                        user_email: email
                    },
                    
                    theme: {
                        color: '#5c6ded'
                    },
                    
                    modal: {
                        ondismiss: function() {
                            console.log('Payment canceled by user');
                            setPlanLoading(null);
                            setPlanError('Payment canceled');
                        }
                    }
                });
                
                rzp.on('payment.failed', function (response) {
                    console.error('Payment failed:', response.error);
                    setPlanLoading(null);
                    setPlanError(response.error.description || 'Payment failed');
                    setModalState({
                        type: 'error',
                        title: 'Payment Failed',
                        message: response.error.description || 'Payment could not be completed. Please try again.'
                    });
                });
                
                rzp.open();

            } catch (error) {
                console.error('Plan purchase failed', error);
                const message =
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    error.message ||
                    'Unable to process plan purchase right now.';
                setPlanError(message);
            } finally {
                setPlanLoading(null);
            }
        },
        [billingCycle, ensureAuthenticated, prefetchInvoice, refreshTokens]
    );

    const addonTotal = Math.max(0, addonTokens) * ADDON_TOKEN_PRICE;

    const updateAddonTokens = (value) => {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
            setAddonTokens(0);
            return;
        }
        const sanitized = Math.max(1, Math.min(10000, Math.round(numeric)));
        setAddonTokens(sanitized);
        setAddonError('');
    };

    const incrementAddonTokens = (step = 25) => {
        setAddonTokens((prev) => Math.max(1, Math.min(10000, Math.round(prev + step))));
        setAddonError('');
    };

    const decrementAddonTokens = (step = 25) => {
        setAddonTokens((prev) => Math.max(1, Math.min(10000, Math.round(prev - step))));
        setAddonError('');
    };

    const handleAddonPurchase = useCallback(async () => {
        setAddonError('');
        if (addonTokens <= 0) {
            setAddonError('Please enter how many tokens you need.');
            return;
        }
        const user = ensureAuthenticated(setAddonError);
        if (!user) {
            return;
        }
        const email = user.email;
        if (typeof window !== 'undefined' && !window.Razorpay) {
            setAddonError('Payment gateway is still loading. Please wait a moment and try again.');
            return;
        }
        setAddonLoading(true);
        try {
            // Step 1: Create Razorpay order for token addon
            console.log(`🔄 Creating token addon order for ${addonTokens} tokens...`);
            const orderData = await createTokenAddonOrder({
                tokenAmount: addonTokens,
                userEmail: email,
                userId: email
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
                            userEmail: email,
                            tokenAmount: addonTokens
                        });

                        if (verificationResult.success) {
                            console.log('✅ Payment verified successfully!');
                            
                            // Show success modal
                            setModalState({
                                type: 'addon',
                                status: 'credited',
                                tokensGranted: addonTokens,
                                paymentId: response.razorpay_payment_id
                            });
                            
                            // Refresh tokens
                            refreshTokens(email);
                            
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
                        setModalState({
                            type: 'error',
                            title: 'Payment Verification Failed',
                            message: 'Your payment was successful but verification failed. Please contact support with your payment ID.'
                        });
                    } finally {
                        setAddonLoading(false);
                    }
                },
                
                prefill: getPrefill(user),
                
                notes: {
                    token_amount: addonTokens,
                    user_email: email
                },
                
                theme: {
                    color: '#5c6ded'
                },
                
                modal: {
                    ondismiss: function() {
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
                setModalState({
                    type: 'error',
                    title: 'Payment Failed',
                    message: response.error.description || 'Payment could not be completed. Please try again.'
                });
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
    }, [addonTokens, ensureAuthenticated, refreshTokens]);

    const handleInvoiceDownload = useCallback(
        async (txId) => {
            if (!txId || !currentUser?.email) {
                setInvoiceError('Invoice will be available once Razorpay confirms the payment.');
                return;
            }
            try {
                setInvoiceLoading(true);
                setInvoiceError('');
                const blob = await downloadInvoicePdf({ txId, userEmail: currentUser.email });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `PII-Sentinel-Invoice-${txId}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Invoice download failed', error);
                const message =
                    error.response?.data?.message ||
                    error.response?.data?.error ||
                    'Invoice is still being generated. Please try again shortly.';
                setInvoiceError(message);
            } finally {
                setInvoiceLoading(false);
            }
        },
        [currentUser?.email]
    );

    const handleModalClose = () => {
        setModalState(null);
        setInvoiceError('');
        setInvoiceLoading(false);
    };

    return (
        <div className="pricing-page">
            {/* Show loader when processing payments */}
            {(planLoading || addonLoading) && (
                <Loader 
                    fullScreen 
                    message={planLoading ? "Processing plan upgrade..." : "Processing token purchase..."} 
                    size="medium"
                />
            )}
            
            {SIMULATION_ENABLED && (
                <div className="pricing-simulation-banner">
                    Sandbox mode enabled – paid checkouts simulate token credits without charging your card.
                </div>
            )}
            <div className="back-home-container">
                <button className="back-home-btn" onClick={() => navigate('/')} title="Back to Home">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="back-home-icon">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                    <span className="back-home-text">Back to Home</span>
            </button>
            </div>
            <header className="pricing-hero">
                <span className="pricing-hero__badge">Token-first pricing</span>
                <h1 className="pricing-hero__title">Plans tuned for privacy automation</h1>
                <p className="pricing-hero__subtitle">
                    Switch from feature-based bundles to flexible token balances. Upload documents, lock or unlock JSON, and
                    power advanced analyses—all from the same balance.
                </p>
                {currentUser?.email && (
                    <div className="pricing-hero__metrics">
                        <div className="metrics-card">
                            <span className="metrics-card__label">Current plan</span>
                            <span className="metrics-card__value">
                                {tokenSummary?.plan_details?.name || 'Starter'}
                            </span>
                            <span className="metrics-card__caption">
                                {loadingTokens
                                    ? 'Refreshing token balance…'
                                    : `${formatTokens(tokenSummary?.tokens_balance ?? 0)} tokens remaining`}
                            </span>
                        </div>
                        <div className="metrics-card">
                            <span className="metrics-card__label">Tokens used this cycle</span>
                            <span className="metrics-card__value">
                                {formatTokens(tokenSummary?.tokens_used ?? 0)}
                            </span>
                            <span className="metrics-card__caption">
                                Resets monthly • {tokenSummary?.token_period || 'current period'}
                        </span>
                        </div>
                    </div>
                )}
            </header>

            <BillingToggle defaultCycle={billingCycle} onBillingChange={handleBillingChange} />

            {planError && <div className="pricing-message pricing-message--error">{planError}</div>}

            <div className="pricing-grid">
                {plans.map((plan) => (
                    <div key={plan.id} className={`pricing-card pricing-card--${plan.theme}`}>
                        {plan.badge && <span className="pricing-card__badge">{plan.badge}</span>}
                        <div className="pricing-card__header">
                            <span className="pricing-card__icon">{plan.icon}</span>
                            <h3 className="pricing-card__title">{plan.name}</h3>
                            <p className="pricing-card__caption">{plan.caption}</p>
                                </div>
                        {renderPrice(plan)}
                        <div className="pricing-card__tokens">
                            <span className="pricing-card__tokens-amount">{plan.tokens.headline}</span>
                            <span className="pricing-card__tokens-note">{plan.tokens.subline}</span>
                                    </div>
                        <ul className="pricing-card__features">
                            {plan.features.map((feature) => (
                                <li key={feature}>
                                    <span className="pricing-card__bullet" />
                                            <span>{feature}</span>
                                </li>
                                    ))}
                        </ul>
                        {plan.limits.length > 0 && (
                            <ul className="pricing-card__limits">
                                {plan.limits.map((limit) => (
                                    <li key={limit}>
                                        <span className="pricing-card__bullet pricing-card__bullet--muted" />
                                        <span>{limit}</span>
                                    </li>
                                        ))}
                            </ul>
                                )}
                        <div className="pricing-card__cta">
                                <button
                                className={`pricing-button pricing-button--${plan.ctaVariant}`}
                                onClick={() => handlePlanCheckout(plan)}
                                disabled={planLoading === plan.id}
                                >
                                {planLoading === plan.id ? 'Preparing checkout…' : plan.cta}
                                <FiArrowRight />
                                </button>
                        </div>
                        <p className="pricing-card__meta">{plan.meta}</p>
                                    </div>
                ))}

                <div className="pricing-card pricing-card--addon" id="addons">
                    <div className="pricing-card__header">
                        <span className="pricing-card__icon pricing-card__icon--addon">
                            <FiPlus />
                        </span>
                        <h3 className="pricing-card__title">Add-on tokens</h3>
                        <p className="pricing-card__caption">
                            Top up tokens on demand without touching your base subscription.
                        </p>
                            </div>
                    <div className="addon-card__body">
                        <label htmlFor="addonTokens" className="addon-card__label">
                            Tokens needed
                        </label>
                        <div className="addon-card__stepper">
                            <button type="button" onClick={() => decrementAddonTokens()} aria-label="Decrease tokens">
                                <FiMinus />
                            </button>
                            <input
                                id="addonTokens"
                                type="number"
                                min="1"
                                step="25"
                                value={addonTokens}
                                onChange={(event) => updateAddonTokens(event.target.value)}
                            />
                            <button type="button" onClick={() => incrementAddonTokens()} aria-label="Increase tokens">
                                <FiPlus />
                            </button>
                        </div>
                        <p className="addon-card__hint">
                            Each token costs ₹{ADDON_TOKEN_PRICE}. Use tokens for uploads, locking/unlocking JSON, and premium analysis jobs.
                        </p>
                    </div>
                    <div className="addon-card__summary">
                        <span>Total</span>
                        <strong>₹{addonTotal.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="pricing-card__cta">
                        <button
                            className="pricing-button pricing-button--outline"
                            onClick={handleAddonPurchase}
                            disabled={addonLoading}
                        >
                            {addonLoading ? 'Processing…' : 'Purchase tokens'}
                            <FiArrowRight />
                        </button>
                        {addonError && <p className="pricing-card__error">{addonError}</p>}
                    </div>
                    <p className="pricing-card__meta">
                        Invoices are generated automatically. Tokens credit instantly once payment succeeds.
                    </p>
                </div>
            </div>

            <section className="pricing-how">
                <div className="pricing-container">
                    <h2 className="pricing-how__title">How to Choose the Right Plan</h2>
                    <p className="pricing-how__subtitle">
                        Select a plan based on your usage volume, team size, and feature requirements.
                        </p>
                    <div className="pricing-how__grid">
                        <article className="pricing-how__card">
                            <div className="pricing-how__icon">
                                <FiUsers />
                            </div>
                            <div className="pricing-how__content">
                                <h3>By Team Size &amp; Business Type</h3>
                                <p>Evaluate your organisation’s scale and internal privacy needs.</p>
                                <ul>
                                    <li><strong>Starter:</strong> Ideal for individuals, founders, students, or small teams piloting privacy automation.</li>
                                    <li><strong>Professional:</strong> Built for SMEs and fast-growing companies that require advanced analytics and premium support.</li>
                                    <li><strong>Enterprise:</strong> Designed for large corporations, banks, insurers, and compliance teams needing concierge onboarding.</li>
                                </ul>
                            </div>
                        </article>
                        <article className="pricing-how__card">
                            <div className="pricing-how__icon">
                                <FiBarChart2 />
                            </div>
                            <div className="pricing-how__content">
                                <h3>By Usage Volume &amp; Requirements</h3>
                                <p>Match your monthly automation throughput with the right token pool.</p>
                                <ul>
                                    <li><strong>Starter:</strong> Perfect if you scan light daily volumes with uploads only (150 tokens/month).</li>
                                    <li><strong>Professional:</strong> Great for recurring lock/unlock workflows and analytics (2000 tokens/month).</li>
                                    <li><strong>Enterprise:</strong> Unlimited usage with log records, dedicated support, and bespoke integrations.</li>
                                </ul>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section className="pricing-comparison">
                <div className="pricing-container">
                    <div className="pricing-comparison__header">
                        <h2>Plan Comparison</h2>
                        <p>Compare allowance, premium features, and support tiers side-by-side.</p>
                    </div>
                    <div className="pricing-comparison__table-wrapper">
                        <table className="pricing-comparison__table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Starter</th>
                                    <th>Professional</th>
                                    <th>Enterprise</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    {
                                        feature: 'Monthly token allowance',
                                        starter: '150 tokens (5/day refresh)',
                                        professional: '2000 tokens',
                                        enterprise: 'Unlimited tokens'
                                    },
                                    {
                                        feature: 'Upload documents & images',
                                        starter: true,
                                        professional: true,
                                        enterprise: true
                                    },
                                    {
                                        feature: 'Lock JSON (5 tokens/run)',
                                        starter: false,
                                        professional: true,
                                        enterprise: true
                                    },
                                    {
                                        feature: 'Unlock / verify JSON (5 tokens/run)',
                                        starter: false,
                                        professional: true,
                                        enterprise: true
                                    },
                                    {
                                        feature: 'Advanced Analysis Board',
                                        starter: false,
                                        professional: true,
                                        enterprise: true
                                    },
                                    {
                                        feature: 'Token rollover / reset',
                                        starter: 'Daily refresh up to 150/month',
                                        professional: 'Resets monthly',
                                        enterprise: 'Not required'
                                    },
                                    {
                                        feature: 'Support',
                                        starter: 'Email (48h SLA)',
                                        professional: 'Priority email & chat',
                                        enterprise: '24×7 concierge desk'
                                    }
                                ].map((row) => (
                                    <tr key={row.feature}>
                                        <td>{row.feature}</td>
                                        {[row.starter, row.professional, row.enterprise].map((value, idx) => (
                                            <td key={idx}>
                                                {typeof value === 'boolean' ? (
                                                    value ? (
                                                        <FiCheckIcon className="pricing-comparison__check" />
                                                    ) : (
                                                        <FiX className="pricing-comparison__cross" />
                                                    )
                                                ) : (
                                                    value
                                                )}
                                            </td>
                                        ))}
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="pricing-faq">
                <div className="pricing-faq__header">
                    <h2>Token billing essentials</h2>
                    <p>Answers to the most common questions about the new token-based plans.</p>
                    </div>
                <div className="pricing-faq__grid">
                    {[
                        {
                            question: 'How are tokens consumed?',
                            answer:
                                'Uploads cost 1 token each. Locking or unlocking JSON deducts 5 tokens per run. Enterprise plans include unlimited usage.'
                        },
                        {
                            question: 'Do tokens expire?',
                            answer:
                                'Starter tokens refresh daily up to 150 per month. Professional tokens reset monthly. Add-on tokens never expire until they are consumed.'
                        },
                        {
                            question: 'Can I change plans later?',
                            answer:
                                'Yes. Upgrade or downgrade any time. New token balances apply immediately and existing tokens remain in your account.'
                        },
                        {
                            question: 'What payment methods are supported?',
                            answer:
                                'Razorpay supports UPI, credit/debit cards, net banking, and bank transfers. Enterprise customers can also pay via invoice.'
                        },
                        {
                            question: 'Are invoices GST compliant?',
                            answer:
                                'Every successful plan or add-on purchase generates a GST-ready PDF invoice with Razorpay transaction details.'
                        },
                        {
                            question: 'Can teammates share the same tokens?',
                            answer:
                                'Yes. Tokens are pooled per workspace so every teammate draws from the same balance. Admins can monitor usage in the profile dashboard.'
                        },
                        {
                            question: 'What happens if token deduction fails?',
                            answer:
                                'The action is paused and you’ll see an upgrade prompt. Top up tokens or upgrade your plan to continue without interruption.'
                        },
                        {
                            question: 'Do add-on tokens roll over?',
                            answer:
                                'Add-on tokens never expire. They sit in your balance until you use them—great for seasonal bursts or audits.'
                        }
                    ].map((faq) => (
                        <article className="pricing-faq__item" key={faq.question}>
                            <h3>{faq.question}</h3>
                            <p>{faq.answer}</p>
                        </article>
                    ))}
                        </div>
            </section>

            <div className="pricing-contact">
                <div className="pricing-contact__content">
                    <h3>Need a bespoke token pool or enterprise paperwork?</h3>
                    <p>
                        Our team can help with volume discounts, procurement documents, custom SLAs, and dedicated onboarding for your organisation.
                            </p>
                        </div>
                <button
                    className="pricing-button pricing-button--outline"
                    onClick={() => navigate('/about#contact')}
                >
                    Contact sales
                    <FiArrowRight />
                </button>
                        </div>

            <Footer />

            {modalState && (
                <div className="pricing-modal" role="dialog" aria-modal="true">
                    <div className="pricing-modal__card">
                        <button className="pricing-modal__close" onClick={handleModalClose} aria-label="Close">
                            <FiX />
                        </button>
                        <div className={`pricing-modal__icon ${modalState.type === 'error' ? 'error' : ''}`}>
                            {modalState.type === 'error' ? <FiInfo /> : <FiCheckCircle />}
                        </div>
                        <h3 className="pricing-modal__title">
                            {modalState.type === 'error'
                                ? modalState.title || 'Payment update'
                                : modalState.type === 'addon'
                                ? modalState.status === 'credited'
                                    ? 'Tokens added successfully'
                                    : 'Token purchase processing'
                                : modalState.status === 'activated'
                                ? 'Plan activated'
                                : 'Plan upgrade processing'}
                        </h3>
                        <p className="pricing-modal__description">
                            {modalState.type === 'error'
                                ? modalState.message
                                : modalState.type === 'addon'
                                ? modalState.status === 'credited'
                                    ? 'Additional tokens are now available in your balance. You can start using them right away.'
                                    : 'We are finalising your add-on token purchase. Tokens and invoice will appear once Razorpay confirms payment.'
                                : modalState.status === 'activated'
                                ? `${modalState.plan?.name || 'Starter'} is active. Tokens have been updated for your account.`
                                : 'Payment is underway. Tokens and your GST invoice will update automatically after Razorpay confirms the charge.'}
                        </p>
                        {modalState.paymentId && (
                            <div className="pricing-modal__meta">
                                <span>Payment ID</span>
                                <code>{modalState.paymentId}</code>
                        </div>
                        )}
                        {modalState.tokensGranted && modalState.tokensGranted > 0 && (
                            <div className="pricing-modal__badge">+{modalState.tokensGranted.toLocaleString('en-IN')} tokens</div>
                        )}
                        {modalState.type !== 'error' && (
                            <div className="pricing-modal__actions">
                                {modalState.paymentId && (
                                    <button
                                        className="pricing-button pricing-button--outline"
                                        onClick={() => handleInvoiceDownload(modalState.paymentId)}
                                        disabled={invoiceLoading}
                                    >
                                        {invoiceLoading ? 'Preparing invoice…' : 'Download invoice'}
                                        <FiDownload />
                                    </button>
                                )}
                                <button
                                    className="pricing-button pricing-button--ghost"
                                    onClick={() => {
                                        handleModalClose();
                                        navigate('/profile');
                                    }}
                                >
                                    View tokens in profile
                                    <FiArrowRight />
                                </button>
                        </div>
                        )}
                        {invoiceError && <p className="pricing-modal__error">{invoiceError}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pricing;
