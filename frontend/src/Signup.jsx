import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { login, sendOTP, resendOTP, verifyOTP, signInWithGoogle } from './api';
import ScrollButton from './components/ScrollButton';
import './Signup.css';

const COUNTRY_OPTIONS = [
    { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', minLength: 10, maxLength: 10, example: '7483314469' },
    { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', minLength: 10, maxLength: 10, example: '4155552671' },
    { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', minLength: 10, maxLength: 11, example: '7700123456' },
    { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', minLength: 9, maxLength: 9, example: '501234567' },
    { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', minLength: 8, maxLength: 8, example: '91234567' },
    { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', minLength: 9, maxLength: 9, example: '412345678' },
    { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', minLength: 10, maxLength: 10, example: '6045551890' },
    { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', minLength: 10, maxLength: 13, example: '15123456789' }
];

const GoogleSignInButton = ({ onAuthCode, onError, redirectUri }) => {
    const [loading, setLoading] = useState(false);

    const googleLogin = useGoogleLogin({
        flow: 'auth-code',
        scope: 'openid email profile',
        prompt: 'select_account',
        ux_mode: 'popup',
        redirect_uri: redirectUri,
        onSuccess: async (codeResponse) => {
            if (!codeResponse?.code) {
                setLoading(false);
                onError('Google did not return an authorization code. Please try again.');
                return;
            }
            const success = await onAuthCode(codeResponse.code);
            setLoading(false);
            if (!success) {
                return;
            }
        },
        onError: (errorResponse) => {
            console.error('Google OAuth error:', errorResponse);
            const message =
                errorResponse?.error_description ||
                errorResponse?.error ||
                'Google sign-in was cancelled or failed. Please try again.';
            setLoading(false);
            onError(message);
        }
    });

    const handleClick = () => {
        setLoading(true);
        try {
            googleLogin();
        } catch (err) {
            console.error('Failed to initiate Google sign-in:', err);
            setLoading(false);
            onError('Unable to launch Google sign-in. Please refresh the page and try again.');
        }
    };

    return (
        <div className="google-auth-wrapper mb-3">
            <button
                type="button"
                className={`google-signin-btn ${loading ? 'loading' : ''}`}
                onClick={handleClick}
                disabled={loading}
                aria-live="polite"
            >
                <span className="google-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M45.09 23.5c0-1.51-.13-2.98-.38-4.4H23v8.32h12.38a10.6 10.6 0 0 1-4.6 6.96v5.78h7.43c4.36-4.01 6.88-9.91 6.88-16.66Z" fill="#4285F4" />
                        <path d="M23 46c6.23 0 11.46-2.06 15.28-5.84l-7.43-5.78c-2.06 1.39-4.7 2.2-7.85 2.2-6.03 0-11.14-4.07-12.96-9.57H2.37v6.03C6.26 40.41 13.89 46 23 46Z" fill="#34A853" />
                        <path d="M10.04 27.01A13.93 13.93 0 0 1 9.32 23c0-1.39.24-2.74.72-4.01V12.96H2.37A22.95 22.95 0 0 0 0 23c0 3.71.89 7.22 2.37 10.04l7.67-6.03Z" fill="#FBBC05" />
                        <path d="M23 9.14c3.38 0 6.41 1.17 8.79 3.44l6.58-6.58C34.46 2.31 29.23 0 23 0 13.89 0 6.26 5.59 2.37 12.96l7.67 6.03C11.86 13.21 16.97 9.14 23 9.14Z" fill="#EA4335" />
                    </svg>
                </span>
                <span className="google-label">
                    {loading ? 'Connecting to Google...' : 'Sign in with Google'}
                </span>
                {loading && <span className="google-spinner" aria-hidden="true"></span>}
            </button>
        </div>
    );
};

const Signup = ({ onSuccess, onBackHome }) => {
    const navigate = useNavigate();
    const [loginMethod, setLoginMethod] = useState('email'); // 'email', 'google', 'mobile'
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        mobile: '',
        otp: ['', '', '', '', '', ''],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [canResend, setCanResend] = useState(false);
    const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
    const [userNotFoundPhone, setUserNotFoundPhone] = useState(null);
    const [activePhone, setActivePhone] = useState(null);
    const otpInputRefs = useRef([]);
    const countryDropdownRef = useRef(null);
    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
    const googleRedirectUri = process.env.REACT_APP_GOOGLE_REDIRECT_URI || 'postmessage';
    const isGoogleEnabled = Boolean(googleClientId);

    const handleGoogleAuthCode = async (authCode) => {
        setSuccessMessage('');
        setError('');
        try {
            const response = await signInWithGoogle({ authCode });

            if (response?.code === 'USER_NOT_FOUND') {
                setError(response.error || 'No account found for this Google email. Please create an account first.');
                return false;
            }

            if (response?.success) {
                const authToken = response.jwt || response.token;
                if (authToken) {
                    localStorage.setItem('authToken', authToken);
                }
                if (response.user) {
                    localStorage.setItem('userInfo', JSON.stringify(response.user));
                }
                const welcomeName = response.user?.fullName || response.user?.username || response.user?.email || 'Explorer';
                setError('');
                setSuccessMessage(`Welcome back, ${welcomeName}!`);
                setTimeout(() => {
                    if (onSuccess) onSuccess();
                    else navigate('/dashboard');
                }, 1200);
                return true;
            }

            setError(response?.error || 'Unable to sign in with Google. Please try again.');
        } catch (err) {
            console.error('Google sign-in error:', err);
            const apiError =
                err.response?.data?.error ||
                err.response?.data?.message ||
                err.message ||
                'Unable to sign in with Google. Please try again.';
            setError(apiError);
        }
        setSuccessMessage('');
        return false;
    };

    const handleGoogleError = (message) => {
        setSuccessMessage('');
        setError(message);
    };

    const formatPhoneForDisplay = (phone) => {
        if (!phone) return '';
        const dialCode = phone.dialCode || '';
        const digits = (phone.mobile || '').trim();
        if (!digits) {
            return dialCode;
        }
        return `${dialCode} ${digits}`;
    };

    const getCountryConstraints = (country) => ({
        min: country?.minLength ?? 4,
        max: country?.maxLength ?? 15
    });

    const closeCountryDropdown = () => setIsCountryDropdownOpen(false);

    const handleSelectCountry = (country) => {
        if (otpSent) {
            closeCountryDropdown();
            return;
        }
        setSelectedCountry(country);
        closeCountryDropdown();
        setFormData((prev) => {
            const digits = prev.mobile.replace(/\D/g, '');
            const constraints = getCountryConstraints(country);
            return {
                ...prev,
                mobile: digits.slice(0, constraints.max)
            };
        });
        setError('');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'mobile') {
            const digitsOnly = value.replace(/\D/g, '');
            const constraints = getCountryConstraints(selectedCountry);
            setFormData((prev) => ({
                ...prev,
                mobile: digitsOnly.slice(0, constraints.max),
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }

        setError('');
    };

    // Countdown timer effect
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
        } else if (countdown === 0 && otpSent) {
            setCanResend(true);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [countdown, otpSent]);

    useEffect(() => {
        if (!isCountryDropdownOpen) {
            return;
        }

        const handleClickOutside = (event) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
                closeCountryDropdown();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCountryDropdownOpen]);

    // OTP input handlers
    const handleOTPChange = (index, value) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) {
            return;
        }

        const newOtp = [...formData.otp];
        newOtp[index] = value;
        setFormData((prev) => ({
            ...prev,
            otp: newOtp,
        }));
        setError('');

        // Auto-focus next input
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOTPKeyDown = (index, e) => {
        // Handle backspace
        if (e.key === 'Backspace' && !formData.otp[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
        // Handle paste
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6).split('');
                const newOtp = [...formData.otp];
                digits.forEach((digit, i) => {
                    if (index + i < 6) {
                        newOtp[index + i] = digit;
                    }
                });
                setFormData((prev) => ({
                    ...prev,
                    otp: newOtp,
                }));
                // Focus the last filled input or the last input
                const lastFilledIndex = Math.min(index + digits.length - 1, 5);
                otpInputRefs.current[lastFilledIndex]?.focus();
            });
        }
    };


    const handleSendOTP = async () => {
        const currentCountry = selectedCountry;
        const constraints = getCountryConstraints(currentCountry);
        const mobileDigits = formData.mobile.trim().replace(/\D/g, '');

        if (
            !mobileDigits ||
            mobileDigits.length < constraints.min ||
            mobileDigits.length > constraints.max
        ) {
            const example = currentCountry.example ? ` (e.g. ${currentCountry.dialCode} ${currentCountry.example})` : '';
            setError(`Enter a valid ${currentCountry.name} mobile number${example}.`);
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            const response = await sendOTP(mobileDigits, currentCountry.dialCode);
            if (response.success) {
                const phoneDescriptor = { ...currentCountry, mobile: mobileDigits };
                setActivePhone(phoneDescriptor);
                setFormData((prev) => ({
                    ...prev,
                    mobile: mobileDigits
                }));
                setOtpSent(true);
                setCountdown(15);
                setCanResend(false);
                setShowCreateAccountPrompt(false);
                setUserNotFoundPhone(null);
                closeCountryDropdown();
                // Focus first OTP input
                setTimeout(() => {
                    otpInputRefs.current[0]?.focus();
                }, 100);
            } else {
                setError(response.error || 'Failed to send OTP. Please try again.');
            }
        } catch (err) {
            console.error('Send OTP error:', err);
            console.error('Error details:', {
                message: err.message,
                code: err.code,
                response: err.response?.data,
                status: err.response?.status
            });
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (err.response?.status === 401) {
                setError('Authentication failed. Please check your API key.');
            } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
                setError('Network error: Unable to connect to server. Please check if the backend server is running.');
            } else if (err.response?.status) {
                setError(`Server error (${err.response.status}): ${err.response.statusText || 'Failed to send OTP'}`);
            } else {
                setError(err.message || 'Failed to send OTP. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOTP = async () => {
        if (!canResend || countdown > 0) {
            return;
        }

        const phoneDescriptor = activePhone || { ...selectedCountry, mobile: formData.mobile.trim().replace(/\D/g, '') };
        const constraints = getCountryConstraints(phoneDescriptor);
        const mobileDigits = (phoneDescriptor.mobile || '').replace(/\D/g, '');
        const countryLabel = phoneDescriptor.name || selectedCountry.name;

        if (
            !mobileDigits ||
            mobileDigits.length < constraints.min ||
            mobileDigits.length > constraints.max
        ) {
            const example = phoneDescriptor.example ? ` (e.g. ${phoneDescriptor.dialCode} ${phoneDescriptor.example})` : '';
            setError(`Enter a valid ${countryLabel} mobile number${example} before resending.`);
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            const response = await resendOTP(mobileDigits, phoneDescriptor.dialCode);
            if (response.success) {
                const updatedPhone = { ...phoneDescriptor, mobile: mobileDigits };
                setActivePhone(updatedPhone);
                setCountdown(15);
                setCanResend(false);
                setFormData((prev) => ({
                    ...prev,
                    otp: ['', '', '', '', '', ''],
                }));
                setTimeout(() => {
                    otpInputRefs.current[0]?.focus();
                }, 100);
            } else {
                setError(response.error || 'Failed to resend OTP. Please try again.');
            }
        } catch (err) {
            console.error('Resend OTP error:', err);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to resend OTP. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMobileLogin = async (e) => {
        e.preventDefault();
        const otpString = formData.otp.join('');
        if (otpString.length !== 6 || !/^\d{6}$/.test(otpString)) {
            setError('Please enter a valid 6-digit OTP.');
            return;
        }

        const phoneDescriptor = activePhone || { ...selectedCountry, mobile: formData.mobile.trim().replace(/\D/g, '') };
        const constraints = getCountryConstraints(phoneDescriptor);
        const mobileDigits = (phoneDescriptor.mobile || '').replace(/\D/g, '');
        const countryLabel = phoneDescriptor.name || selectedCountry.name;

        if (
            !mobileDigits ||
            mobileDigits.length < constraints.min ||
            mobileDigits.length > constraints.max
        ) {
            const example = phoneDescriptor.example ? ` (e.g. ${phoneDescriptor.dialCode} ${phoneDescriptor.example})` : '';
            setError(`Enter a valid ${countryLabel} mobile number${example} before signing in.`);
            return;
        }

        setIsSubmitting(true);
        setError('');
        setShowCreateAccountPrompt(false);
        try {
            console.log('Verifying OTP:', {
                mobile: mobileDigits,
                country: phoneDescriptor.dialCode,
                otp: otpString,
                otpLength: otpString.length,
                otpArray: formData.otp
            });

            const response = await verifyOTP(mobileDigits, phoneDescriptor.dialCode, otpString);
            console.log('Verify OTP response:', response);

            if (response.success) {
                if (response.token) {
                    localStorage.setItem('authToken', response.token);
                }
                if (response.access_token) {
                    localStorage.setItem('authToken', response.access_token);
                }
                if (response.user) {
                    localStorage.setItem('userInfo', JSON.stringify(response.user));
                }
                const welcomeName = response.user?.fullName || response.user?.name || formatPhoneForDisplay({ dialCode: phoneDescriptor.dialCode, mobile: mobileDigits });
                setSuccessMessage(`Welcome back, ${welcomeName}!`);
                setTimeout(() => {
                    if (onSuccess) onSuccess();
                    else navigate('/dashboard');
                }, 1500);
            } else if (response.otp_verified && response.user_not_found) {
                setShowCreateAccountPrompt(true);
                setUserNotFoundPhone({
                    dialCode: response.country_code || phoneDescriptor.dialCode,
                    mobile: response.mobile || mobileDigits,
                    name: response.country_name || countryLabel
                });
                setError('');
            } else {
                setError(response.message || `Enter valid OTP sent to your mobile number (${formatPhoneForDisplay(phoneDescriptor)}).`);
            }
        } catch (err) {
            console.error('Verify OTP error:', err);
            console.error('Error response data:', err.response?.data);

            const errorData = err.response?.data;
            if (errorData?.otp_verified && errorData?.user_not_found) {
                console.log('OTP verified but user not found - showing create account prompt');
                setShowCreateAccountPrompt(true);
                setUserNotFoundPhone({
                    dialCode: errorData.country_code || phoneDescriptor.dialCode,
                    mobile: errorData.mobile || mobileDigits,
                    name: errorData.country_name || countryLabel
                });
                setError('');
            } else {
                setError(errorData?.message || errorData?.error || `Enter valid OTP sent to your mobile number (${formatPhoneForDisplay(phoneDescriptor)}).`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.password) {
            setError('Please fill in all fields.');
            setSuccessMessage('');
            return;
        }
        setIsSubmitting(true);
        setError('');
        setSuccessMessage('');
        try {
            const response = await login(formData.email, formData.password);

            if (response.success) {
                // Store token if provided
                if (response.token) {
                    localStorage.setItem('authToken', response.token);
                }
                // Store user info
                if (response.user) {
                    localStorage.setItem('userInfo', JSON.stringify(response.user));
                }

                // Show success message
                setSuccessMessage(`Welcome back again, ${response.user?.fullName || formData.email}!`);

                // Navigate after a short delay to show the success message
                setTimeout(() => {
                    if (onSuccess) onSuccess();
                    else navigate('/dashboard');
                }, 1500);
            } else {
                setError(response.error || 'Invalid credentials');
            }
        } catch (err) {
            console.error('Login error:', err);
            // Handle network errors
            if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
                setError('Network error: Unable to connect to server. Please check if the backend server is running.');
            } else if (err.response) {
                // Server responded with error status
                const errorMsg = err.response.data?.error || err.response.statusText || 'Invalid credentials';
                setError(errorMsg);
            } else {
                // Other errors
                const errorMsg = err.message || 'Login failed. Please try again.';
                setError(errorMsg);
            }
            setSuccessMessage('');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForgotPassword = () => {
        // TODO: Navigate to forgot password page or show modal
        console.log('Forgot password clicked');
    };

    const displayCountry = activePhone || selectedCountry;
    const pendingPhoneDisplay = formatPhoneForDisplay(activePhone || { ...selectedCountry, mobile: formData.mobile });
    const userNotFoundDisplay = formatPhoneForDisplay(userNotFoundPhone) || pendingPhoneDisplay;
    const mobileInputValue = otpSent && activePhone ? activePhone.mobile : formData.mobile;
    const mobileConstraints = getCountryConstraints(displayCountry);
    const mobilePlaceholder = displayCountry.example || 'Enter mobile number';

    return (
        <div className="signup-page">
            <div className="back-home-container">
                <button className="back-home-btn" onClick={() => navigate('/')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="back-home-icon">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="back-home-text">Back to Home</span>
                </button>
            </div>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-lg-10 col-xl-9">
                        <div className="card signup-card shadow-sm">
                            <div className="row g-0 align-items-stretch">
                                <div className="col-md-6 gradient-panel d-none d-md-flex">
                                    <div className="panel-content">
                                        <div className="badge text-uppercase">Welcome back</div>
                                        <h2>Sign in to PII Sentinel</h2>
                                        <p>Secure, analyze, and protect your data with our AI-powered PII detection.</p>
                                        <ul className="list-unstyled features">
                                            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Advanced PII detection</li>
                                            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Lightning-fast analysis</li>
                                            <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Compliance ready</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="col-md-6 p-4 p-lg-5 form-side">
                                    <div className="text-center mb-4">
                                        <h3 className="mb-1">Sign in to your account</h3>
                                        <p className="text-muted">Choose your preferred sign-in method</p>
                                    </div>
                                    {showCreateAccountPrompt ? (
                                        <div className="alert alert-info fade show d-flex align-items-center justify-content-between" role="alert" style={{ flexWrap: 'wrap', gap: '12px' }}>
                                            <div style={{ flex: '1', minWidth: '200px' }}>
                                                <strong>User doesn't exist with mobile number {userNotFoundDisplay}.</strong>
                                                <br />
                                                <small>Would you like to create a new account?</small>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => {
                                                    const phoneQuery = userNotFoundPhone
                                                        ? `${userNotFoundPhone.dialCode}${userNotFoundPhone.mobile}`
                                                        : '';
                                                    navigate(`/create-account?mobile=${encodeURIComponent(phoneQuery)}`);
                                                }}
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                Yes
                                            </button>
                                        </div>
                                    ) : error ? (
                                        <div className="alert alert-danger fade show" role="alert">
                                            {error}
                                        </div>
                                    ) : null}
                                    {successMessage && (
                                        <div className="alert alert-success fade show" role="alert">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                <polyline points="22 4 12 14.01 9 11.01" />
                                            </svg>
                                            {successMessage}
                                        </div>
                                    )}

                                    {isGoogleEnabled ? (
                                        <GoogleSignInButton
                                            onAuthCode={handleGoogleAuthCode}
                                            onError={handleGoogleError}
                                            redirectUri={googleRedirectUri}
                                        />
                                    ) : (
                                        <div className="google-auth-wrapper mb-3">
                                            <button
                                                type="button"
                                                className="google-signin-btn"
                                                disabled
                                                aria-live="polite"
                                            >
                                                <span className="google-icon" aria-hidden="true">
                                                    <svg width="22" height="22" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M45.09 23.5c0-1.51-.13-2.98-.38-4.4H23v8.32h12.38a10.6 10.6 0 0 1-4.6 6.96v5.78h7.43c4.36-4.01 6.88-9.91 6.88-16.66Z" fill="#4285F4" />
                                                        <path d="M23 46c6.23 0 11.46-2.06 15.28-5.84l-7.43-5.78c-2.06 1.39-4.7 2.2-7.85 2.2-6.03 0-11.14-4.07-12.96-9.57H2.37v6.03C6.26 40.41 13.89 46 23 46Z" fill="#34A853" />
                                                        <path d="M10.04 27.01A13.93 13.93 0 0 1 9.32 23c0-1.39.24-2.74.72-4.01V12.96H2.37A22.95 22.95 0 0 0 0 23c0 3.71.89 7.22 2.37 10.04l7.67-6.03Z" fill="#FBBC05" />
                                                        <path d="M23 9.14c3.38 0 6.41 1.17 8.79 3.44l6.58-6.58C34.46 2.31 29.23 0 23 0 13.89 0 6.26 5.59 2.37 12.96l7.67 6.03C11.86 13.21 16.97 9.14 23 9.14Z" fill="#EA4335" />
                                                    </svg>
                                                </span>
                                                <span className="google-label">Sign in with Google</span>
                                            </button>
                                            <small className="google-disabled-hint">
                                                Google sign-in is unavailable. Configure REACT_APP_GOOGLE_CLIENT_ID to enable it.
                                            </small>
                                        </div>
                                    )}

                                    {/* Divider */}
                                    <div className="divider mb-3">
                                        <span>OR</span>
                                    </div>

                                    {/* Email/Mobile Toggle */}
                                    {loginMethod === 'mobile' ? (
                                        <form onSubmit={handleMobileLogin}>
                                            {/* Mobile Form Content */}
                                            <div className="mb-3">
                                                <label className="form-label">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                                    Mobile Number
                                                </label>
                                                <div className="phone-field" ref={countryDropdownRef}>
                                                    <div className="phone-input-group">
                                                        <button
                                                            type="button"
                                                            className={`country-select ${isCountryDropdownOpen ? 'open' : ''} ${otpSent ? 'disabled' : ''}`}
                                                            onClick={() => {
                                                                if (!otpSent) {
                                                                    setIsCountryDropdownOpen((prev) => !prev);
                                                                }
                                                            }}
                                                            disabled={otpSent}
                                                            aria-haspopup="listbox"
                                                            aria-expanded={isCountryDropdownOpen}
                                                        >
                                                            <span className="country-flag" aria-hidden="true">{displayCountry.flag}</span>
                                                            <div className="country-meta">
                                                                <span className="country-name">{displayCountry.name}</span>
                                                                <span className="country-code">{displayCountry.dialCode}</span>
                                                            </div>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="country-caret">
                                                                <polyline points="6 9 12 15 18 9" />
                                                            </svg>
                                                        </button>
                                                        <input
                                                            type="tel"
                                                            className="form-control form-control-lg phone-input"
                                                            placeholder={mobilePlaceholder}
                                                            name="mobile"
                                                            value={mobileInputValue}
                                                            onChange={handleChange}
                                                            maxLength={mobileConstraints.max}
                                                            required
                                                            disabled={otpSent}
                                                            inputMode="numeric"
                                                            autoComplete="tel"
                                                        />
                                                    </div>
                                                    {!otpSent && isCountryDropdownOpen && (
                                                        <div className="country-dropdown" role="listbox">
                                                            {COUNTRY_OPTIONS.map((option) => (
                                                                <button
                                                                    type="button"
                                                                    key={option.code}
                                                                    className={`country-option ${option.code === displayCountry.code ? 'active' : ''}`}
                                                                    onClick={() => handleSelectCountry(option)}
                                                                    role="option"
                                                                    aria-selected={option.code === displayCountry.code}
                                                                >
                                                                    <span className="country-flag" aria-hidden="true">{option.flag}</span>
                                                                    <div className="country-meta">
                                                                        <span className="country-name">{option.name}</span>
                                                                        <span className="country-code">{option.dialCode}</span>
                                                                    </div>
                                                                    <span className="country-example">{option.example}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="phone-hint">
                                                    <small className="text-muted">Example: {displayCountry.dialCode} {displayCountry.example}</small>
                                                </div>
                                            </div>
                                            {!otpSent ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary w-100 mb-3"
                                                    onClick={handleSendOTP}
                                                    disabled={isSubmitting}
                                                >
                                                    {isSubmitting ? 'Sending...' : 'Send OTP'}
                                                </button>
                                            ) : (
                                                <>
                                                    <div className="mb-4 otp-section">
                                                        <label className="form-label">Enter OTP</label>
                                                        <div className="otp-input-wrapper">
                                                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                                                <input
                                                                    key={index}
                                                                    ref={(el) => (otpInputRefs.current[index] = el)}
                                                                    type="text"
                                                                    className="otp-input"
                                                                    maxLength="1"
                                                                    value={formData.otp[index]}
                                                                    onChange={(e) => handleOTPChange(index, e.target.value)}
                                                                    onKeyDown={(e) => handleOTPKeyDown(index, e)}
                                                                    required
                                                                    autoComplete="one-time-code"
                                                                />
                                                            ))}
                                                        </div>
                                                        <div className="otp-meta">
                                                            <small className="otp-hint">
                                                                We sent a 6-digit code to <strong>{pendingPhoneDisplay}</strong>
                                                            </small>
                                                        </div>
                                                    </div>
                                                    <div className="otp-actions mb-3">
                                                        <span className="otp-timer">
                                                            {countdown > 0 ? `Resend available in ${countdown}s` : "Didn't get the code?"}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="resend-otp-btn"
                                                            onClick={handleResendOTP}
                                                            disabled={!canResend || countdown > 0 || isSubmitting}
                                                        >
                                                            Resend OTP
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="submit"
                                                        className="btn btn-primary w-100 mb-2"
                                                        disabled={isSubmitting}
                                                    >
                                                        {isSubmitting ? 'Verifying...' : 'Sign In'}
                                                    </button>
                                                </>
                                            )}
                                        </form>
                                    ) : (
                                        /* Email/Password Login */
                                        <form onSubmit={handleEmailLogin}>
                                            <div className="mb-3">
                                                <label className="form-label">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                                    Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    className="form-control form-control-lg"
                                                    placeholder="you@example.com"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                    Password
                                                </label>
                                                <div className="input-group">
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        className="form-control form-control-lg"
                                                        placeholder="••••••••••"
                                                        name="password"
                                                        value={formData.password}
                                                        onChange={handleChange}
                                                        required
                                                    />
                                                    <button
                                                        className="btn btn-outline-secondary"
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                    >
                                                        {showPassword ? (
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="22" y1="2" x2="2" y2="22"></line></svg>
                                                        ) : (
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <div className="form-check">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        id="rememberMe"
                                                    />
                                                    <label className="form-check-label" htmlFor="rememberMe">
                                                        Remember me
                                                    </label>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-link"
                                                    onClick={handleForgotPassword}
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>
                                            <div className="d-grid mb-3">
                                                <button
                                                    className="btn btn-primary btn-lg w-100"
                                                    type="submit"
                                                    disabled={isSubmitting}
                                                >
                                                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Toggle between Email and Mobile */}
                                    <div className="text-center mb-3">
                                        <button
                                            type="button"
                                            className="btn-link"
                                            onClick={() => {
                                                setLoginMethod(loginMethod === 'email' ? 'mobile' : 'email');
                                                setError('');
                                                setOtpSent(false);
                                                setCountdown(0);
                                                setCanResend(false);
                                                setShowCreateAccountPrompt(false);
                                                setUserNotFoundPhone(null);
                                                setActivePhone(null);
                                                setSelectedCountry(COUNTRY_OPTIONS[0]);
                                                setIsCountryDropdownOpen(false);
                                                setFormData({ email: '', password: '', mobile: '', otp: ['', '', '', '', '', ''] });
                                            }}
                                        >
                                            {loginMethod === 'email' ? (
                                                <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                                    Sign in with Mobile Number
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                                    Sign in with Email
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Create Account Link */}
                                    <div className="text-center">
                                        <p className="text-muted small mb-0">
                                            New here?{' '}
                                            <button
                                                className="btn-link fw-bold"
                                                onClick={() => navigate('/create-account')}
                                            >
                                                Create new Account
                                            </button>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ScrollButton />
        </div>
    );
};

export default Signup;
