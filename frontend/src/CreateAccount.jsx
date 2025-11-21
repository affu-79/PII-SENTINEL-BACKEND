import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAccount } from './api';
import ScrollButton from './components/ScrollButton';
import './CreateAccount.css';

const CreateAccount = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [formData, setFormData] = useState({
        // Step 1
        profilePicture: null,
        profilePicturePreview: null,
        username: '',
        fullName: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        country: '',
        preferredLanguage: '',
        // Step 2
        userType: '',
        organizationName: '',
        organizationType: '',
        industry: '',
        companySize: '',
        website: '',
        designation: '',
        department: '',
        yearsOfExperience: '',
        complianceFrameworks: [],
        teamSize: '',
        companyLocation: '',
        // Step 3
        primaryGoal: '',
        reason: '',
        dataTypes: [],
        usageEnvironment: '',
        averageVolume: '',
        needApiAccess: false,
        internalUsers: [],
        deploymentPlan: '',
        // Step 4
        enable2FA: false,
        preferredAuthMethod: '',
        acceptTerms: false,
        acceptPrivacy: false,
        consentDataProcessing: false,
        receiveUpdates: false,
    });
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const totalSteps = 4;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            if (name === 'complianceFrameworks' || name === 'dataTypes' || name === 'internalUsers') {
                setFormData(prev => ({
                    ...prev,
                    [name]: prev[name].includes(value)
                        ? prev[name].filter(item => item !== value)
                        : [...prev[name], value]
                }));
            } else {
                setFormData(prev => ({ ...prev, [name]: checked }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({ ...prev, profilePicture: 'File size must be less than 5MB' }));
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    profilePicture: file,
                    profilePicturePreview: reader.result
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const validateStep = (step) => {
        const newErrors = {};

        if (step === 1) {
            if (!formData.username.trim()) newErrors.username = 'Username is required';
            else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
            else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) newErrors.username = 'Username can only contain letters, numbers, and underscores';
            if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
            if (!formData.email.trim()) newErrors.email = 'Email is required';
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
            if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
            if (!formData.password) newErrors.password = 'Password is required';
            else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
            if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm password';
            else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
            if (!formData.country) newErrors.country = 'Country is required';
            if (!formData.preferredLanguage) newErrors.preferredLanguage = 'Preferred language is required';
        } else if (step === 2) {
            if (!formData.userType) newErrors.userType = 'User type is required';
            if (formData.userType !== 'Individual' && !formData.organizationName.trim()) {
                newErrors.organizationName = 'Organization name is required';
            }
        } else if (step === 3) {
            if (!formData.primaryGoal) newErrors.primaryGoal = 'Primary goal is required';
            if (!formData.reason.trim()) newErrors.reason = 'Please describe your reason';
        } else if (step === 4) {
            if (!formData.acceptTerms) newErrors.acceptTerms = 'You must accept Terms of Use';
            if (!formData.acceptPrivacy) newErrors.acceptPrivacy = 'You must accept Privacy Policy';
            if (!formData.consentDataProcessing) newErrors.consentDataProcessing = 'You must consent to data processing';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps));
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validateStep(4)) {
            setIsSubmitting(true);
            setError('');

            try {
                // Prepare data for API (exclude confirmPassword)
                const { confirmPassword, ...submitData } = formData;

                // Call API to create account
                const response = await createAccount({
                    ...submitData,
                    profilePicturePreview: formData.profilePicturePreview || null
                });

                if (response.success) {
                    console.log('Account created successfully:', response);
                    setShowSuccessModal(true);
                } else {
                    setError(response.error || 'Failed to create account');
                }
            } catch (err) {
                console.error('Error creating account:', err);
                setError(err.response?.data?.error || err.message || 'Failed to create account. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const progressPercentage = (currentStep / totalSteps) * 100;

    return (
        <div className="create-account-page">
            {/* Back to Home Button */}
            <div className="back-home-container">
                <button className="back-home-btn" onClick={() => navigate('/')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="back-home-icon">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="back-home-text">Back to Home</span>
                </button>
            </div>

            <div className="container create-account-container">
                <div className="row justify-content-center">
                    <div className="col-lg-10 col-xl-9">
                        {/* Header */}
                        <div className="text-center mb-4">
                            <h1 className="create-account-title">Create Your Account</h1>
                            <p className="create-account-subtitle">Join PII Sentinel and secure your data</p>
                        </div>

                        {/* Progress Bar */}
                        <div className="progress-container mb-5">
                            <div className="progress" style={{ height: '8px', borderRadius: '10px', backgroundColor: '#e5e7eb' }}>
                                <div
                                    className="progress-bar"
                                    role="progressbar"
                                    style={{
                                        width: `${progressPercentage}%`,
                                        backgroundColor: '#667eea',
                                        borderRadius: '10px',
                                        transition: 'width 0.5s ease'
                                    }}
                                />
                            </div>
                            <div className="progress-steps mt-3">
                                {[1, 2, 3, 4].map(step => (
                                    <div key={step} className={`progress-step ${currentStep >= step ? 'active' : ''}`}>
                                        <div className="progress-step-circle">{step}</div>
                                        <span className="progress-step-label">
                                            {step === 1 && 'Personal'}
                                            {step === 2 && 'Professional'}
                                            {step === 3 && 'Use Case'}
                                            {step === 4 && 'Security'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Form Card */}
                        <div className="card create-account-card shadow-lg">
                            <div className="card-body p-4 p-lg-5">
                                {error && (
                                    <div className="alert alert-danger fade show mb-4" role="alert">
                                        {error}
                                    </div>
                                )}
                                <form onSubmit={handleSubmit}>
                                    {/* Step 1: Personal & Account Information */}
                                    {currentStep === 1 && (
                                        <div className="step-content fade-in">
                                            <h3 className="step-title mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="step-icon">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                    <circle cx="12" cy="7" r="4" />
                                                </svg>
                                                Personal & Account Information
                                            </h3>

                                            <div className="row">
                                                <div className="col-12 text-center mb-4">
                                                    <div className="profile-picture-upload">
                                                        <input
                                                            type="file"
                                                            id="profilePicture"
                                                            accept="image/*"
                                                            onChange={handleFileChange}
                                                            className="d-none"
                                                        />
                                                        <label htmlFor="profilePicture" className="profile-picture-label">
                                                            {formData.profilePicturePreview ? (
                                                                <img
                                                                    src={formData.profilePicturePreview}
                                                                    alt="Profile"
                                                                    className="profile-picture-preview"
                                                                />
                                                            ) : (
                                                                <div className="profile-picture-placeholder">
                                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                                        <circle cx="12" cy="7" r="4" />
                                                                    </svg>
                                                                    <span>Upload Photo</span>
                                                                </div>
                                                            )}
                                                        </label>
                                                        {errors.profilePicture && <div className="text-danger small mt-2">{errors.profilePicture}</div>}
                                                    </div>
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                        Username <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className={`form-control form-control-lg ${errors.username ? 'is-invalid' : ''}`}
                                                        name="username"
                                                        value={formData.username}
                                                        onChange={handleChange}
                                                        placeholder="johndoe"
                                                    />
                                                    {errors.username && <div className="invalid-feedback">{errors.username}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                        Full Name <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className={`form-control form-control-lg ${errors.fullName ? 'is-invalid' : ''}`}
                                                        name="fullName"
                                                        value={formData.fullName}
                                                        onChange={handleChange}
                                                        placeholder="John Doe"
                                                    />
                                                    {errors.fullName && <div className="invalid-feedback">{errors.fullName}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                            <polyline points="22,6 12,13 2,6" />
                                                        </svg>
                                                        Official Email ID <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="email"
                                                        className={`form-control form-control-lg ${errors.email ? 'is-invalid' : ''}`}
                                                        name="email"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        placeholder="john.doe@company.com"
                                                    />
                                                    {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                        </svg>
                                                        Phone Number <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        className={`form-control form-control-lg ${errors.phoneNumber ? 'is-invalid' : ''}`}
                                                        name="phoneNumber"
                                                        value={formData.phoneNumber}
                                                        onChange={handleChange}
                                                        placeholder="+91 98765 43210"
                                                    />
                                                    {errors.phoneNumber && <div className="invalid-feedback">{errors.phoneNumber}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                        </svg>
                                                        Password <span className="text-danger">*</span>
                                                    </label>
                                                    <div className="input-group">
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            className={`form-control form-control-lg ${errors.password ? 'is-invalid' : ''}`}
                                                            name="password"
                                                            value={formData.password}
                                                            onChange={handleChange}
                                                            placeholder="••••••••"
                                                        />
                                                        <button
                                                            className="btn btn-outline-secondary"
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                        >
                                                            {showPassword ? (
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                    <circle cx="12" cy="12" r="3" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {errors.password && <div className="invalid-feedback d-block">{errors.password}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                        </svg>
                                                        Confirm Password <span className="text-danger">*</span>
                                                    </label>
                                                    <div className="input-group">
                                                        <input
                                                            type={showConfirmPassword ? "text" : "password"}
                                                            className={`form-control form-control-lg ${errors.confirmPassword ? 'is-invalid' : ''}`}
                                                            name="confirmPassword"
                                                            value={formData.confirmPassword}
                                                            onChange={handleChange}
                                                            placeholder="••••••••"
                                                        />
                                                        <button
                                                            className="btn btn-outline-secondary"
                                                            type="button"
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        >
                                                            {showConfirmPassword ? (
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                    <circle cx="12" cy="12" r="3" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {errors.confirmPassword && <div className="invalid-feedback d-block">{errors.confirmPassword}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        Country / Region <span className="text-danger">*</span>
                                                    </label>
                                                    <select
                                                        className={`form-select form-select-lg ${errors.country ? 'is-invalid' : ''}`}
                                                        name="country"
                                                        value={formData.country}
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
                                                    {errors.country && <div className="invalid-feedback">{errors.country}</div>}
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="2" y1="12" x2="22" y2="12" />
                                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                                        </svg>
                                                        Preferred Language <span className="text-danger">*</span>
                                                    </label>
                                                    <select
                                                        className={`form-select form-select-lg ${errors.preferredLanguage ? 'is-invalid' : ''}`}
                                                        name="preferredLanguage"
                                                        value={formData.preferredLanguage}
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
                                                    {errors.preferredLanguage && <div className="invalid-feedback">{errors.preferredLanguage}</div>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Professional & Company Details */}
                                    {currentStep === 2 && (
                                        <div className="step-content fade-in">
                                            <h3 className="step-title mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="step-icon">
                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle cx="8.5" cy="7" r="4" />
                                                    <path d="M20 8v6M23 11h-6" />
                                                </svg>
                                                Professional & Company Details
                                            </h3>

                                            <div className="row">
                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                        User Type <span className="text-danger">*</span>
                                                    </label>
                                                    <select
                                                        className={`form-select form-select-lg ${errors.userType ? 'is-invalid' : ''}`}
                                                        name="userType"
                                                        value={formData.userType}
                                                        onChange={handleChange}
                                                    >
                                                        <option value="">Select User Type</option>
                                                        <option value="Individual">Individual</option>
                                                        <option value="Professional">Professional</option>
                                                        <option value="Company">Company</option>
                                                        <option value="Government">Government</option>
                                                        <option value="Academic">Academic</option>
                                                    </select>
                                                    {errors.userType && <div className="invalid-feedback">{errors.userType}</div>}
                                                </div>

                                                {formData.userType && formData.userType !== 'Individual' && (
                                                    <>
                                                        <div className="col-md-6 mb-3">
                                                            <label className="form-label">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                                    <circle cx="12" cy="10" r="3" />
                                                                </svg>
                                                                Organization / Company Name <span className="text-danger">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className={`form-control form-control-lg ${errors.organizationName ? 'is-invalid' : ''}`}
                                                                name="organizationName"
                                                                value={formData.organizationName}
                                                                onChange={handleChange}
                                                                placeholder="Acme Corporation"
                                                            />
                                                            {errors.organizationName && <div className="invalid-feedback">{errors.organizationName}</div>}
                                                        </div>

                                                        <div className="col-md-6 mb-3">
                                                            <label className="form-label">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                                </svg>
                                                                Organization Type
                                                            </label>
                                                            <select
                                                                className="form-select form-select-lg"
                                                                name="organizationType"
                                                                value={formData.organizationType}
                                                                onChange={handleChange}
                                                            >
                                                                <option value="">Select Type</option>
                                                                <option value="Private">Private</option>
                                                                <option value="Public">Public</option>
                                                                <option value="Non-Profit">Non-Profit</option>
                                                                <option value="Government">Government</option>
                                                                <option value="Educational">Educational</option>
                                                            </select>
                                                        </div>

                                                        <div className="col-md-6 mb-3">
                                                            <label className="form-label">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                                </svg>
                                                                Industry / Sector
                                                            </label>
                                                            <select
                                                                className="form-select form-select-lg"
                                                                name="industry"
                                                                value={formData.industry}
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
                                                        </div>

                                                        <div className="col-md-6 mb-3">
                                                            <label className="form-label">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                                    <circle cx="9" cy="7" r="4" />
                                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                                </svg>
                                                                Company Size
                                                            </label>
                                                            <select
                                                                className="form-select form-select-lg"
                                                                name="companySize"
                                                                value={formData.companySize}
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
                                                        </div>

                                                        <div className="col-md-6 mb-3">
                                                            <label className="form-label">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <circle cx="12" cy="12" r="10" />
                                                                    <line x1="2" y1="12" x2="22" y2="12" />
                                                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                                                </svg>
                                                                Website / Domain
                                                            </label>
                                                            <input
                                                                type="url"
                                                                className="form-control form-control-lg"
                                                                name="website"
                                                                value={formData.website}
                                                                onChange={handleChange}
                                                                placeholder="https://www.company.com"
                                                            />
                                                        </div>

                                                        <div className="col-md-6 mb-3">
                                                            <label className="form-label">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                                    <circle cx="12" cy="7" r="4" />
                                                                </svg>
                                                                Company Location / Headquarters
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-lg"
                                                                name="companyLocation"
                                                                value={formData.companyLocation}
                                                                onChange={handleChange}
                                                                placeholder="City, Country"
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                            <circle cx="12" cy="7" r="4" />
                                                        </svg>
                                                        Designation / Role
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-lg"
                                                        name="designation"
                                                        value={formData.designation}
                                                        onChange={handleChange}
                                                        placeholder="e.g., Data Protection Officer"
                                                    />
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                            <line x1="16" y1="2" x2="16" y2="6" />
                                                            <line x1="8" y1="2" x2="8" y2="6" />
                                                            <line x1="3" y1="10" x2="21" y2="10" />
                                                        </svg>
                                                        Department
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-lg"
                                                        name="department"
                                                        value={formData.department}
                                                        onChange={handleChange}
                                                        placeholder="e.g., IT Security"
                                                    />
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        Years of Experience
                                                    </label>
                                                    <select
                                                        className="form-select form-select-lg"
                                                        name="yearsOfExperience"
                                                        value={formData.yearsOfExperience}
                                                        onChange={handleChange}
                                                    >
                                                        <option value="">Select Experience</option>
                                                        <option value="0-1">0-1 years</option>
                                                        <option value="2-5">2-5 years</option>
                                                        <option value="6-10">6-10 years</option>
                                                        <option value="11-15">11-15 years</option>
                                                        <option value="16+">16+ years</option>
                                                    </select>
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                            <circle cx="9" cy="7" r="4" />
                                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                        </svg>
                                                        Team Size
                                                    </label>
                                                    <select
                                                        className="form-select form-select-lg"
                                                        name="teamSize"
                                                        value={formData.teamSize}
                                                        onChange={handleChange}
                                                    >
                                                        <option value="">Select Team Size</option>
                                                        <option value="1-5">1-5 members</option>
                                                        <option value="6-10">6-10 members</option>
                                                        <option value="11-20">11-20 members</option>
                                                        <option value="21-50">21-50 members</option>
                                                        <option value="50+">50+ members</option>
                                                    </select>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M9 11l3 3L22 4" />
                                                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                                        </svg>
                                                        Compliance Frameworks Followed
                                                    </label>
                                                    <div className="compliance-checkboxes">
                                                        {['GDPR', 'HIPAA', 'PCI-DSS', 'SOC 2', 'ISO 27001', 'CCPA', 'PIPEDA', 'LGPD'].map(framework => (
                                                            <div key={framework} className="form-check form-check-inline">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    name="complianceFrameworks"
                                                                    value={framework}
                                                                    checked={formData.complianceFrameworks.includes(framework)}
                                                                    onChange={handleChange}
                                                                    id={`framework-${framework}`}
                                                                />
                                                                <label className="form-check-label" htmlFor={`framework-${framework}`}>
                                                                    {framework}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Use Case & Motivation */}
                                    {currentStep === 3 && (
                                        <div className="step-content fade-in">
                                            <h3 className="step-title mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="step-icon">
                                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                    <line x1="12" y1="22.08" x2="12" y2="12" />
                                                </svg>
                                                Use Case & Motivation
                                            </h3>

                                            <div className="row">
                                                <div className="col-12 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        Primary Goal <span className="text-danger">*</span>
                                                    </label>
                                                    <select
                                                        className={`form-select form-select-lg ${errors.primaryGoal ? 'is-invalid' : ''}`}
                                                        name="primaryGoal"
                                                        value={formData.primaryGoal}
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
                                                    {errors.primaryGoal && <div className="invalid-feedback">{errors.primaryGoal}</div>}
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                            <line x1="16" y1="13" x2="8" y2="13" />
                                                            <line x1="16" y1="17" x2="8" y2="17" />
                                                            <polyline points="10 9 9 9 8 9" />
                                                        </svg>
                                                        Describe your reason for using PII Sentinel <span className="text-danger">*</span>
                                                    </label>
                                                    <textarea
                                                        className={`form-control ${errors.reason ? 'is-invalid' : ''}`}
                                                        name="reason"
                                                        value={formData.reason}
                                                        onChange={handleChange}
                                                        rows="4"
                                                        placeholder="Tell us about your specific use case and how PII Sentinel will help you..."
                                                    />
                                                    {errors.reason && <div className="invalid-feedback">{errors.reason}</div>}
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        </svg>
                                                        Data Types You Handle
                                                    </label>
                                                    <div className="data-types-checkboxes">
                                                        {['Personal Identifiers', 'Financial Data', 'Health Records', 'Biometric Data', 'Location Data', 'Behavioral Data', 'Communication Data', 'Other'].map(type => (
                                                            <div key={type} className="form-check form-check-inline">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    name="dataTypes"
                                                                    value={type}
                                                                    checked={formData.dataTypes.includes(type)}
                                                                    onChange={handleChange}
                                                                    id={`datatype-${type}`}
                                                                />
                                                                <label className="form-check-label" htmlFor={`datatype-${type}`}>
                                                                    {type}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                            <line x1="3" y1="9" x2="21" y2="9" />
                                                            <line x1="9" y1="21" x2="9" y2="9" />
                                                        </svg>
                                                        Expected Usage Environment
                                                    </label>
                                                    <select
                                                        className="form-select form-select-lg"
                                                        name="usageEnvironment"
                                                        value={formData.usageEnvironment}
                                                        onChange={handleChange}
                                                    >
                                                        <option value="">Select Environment</option>
                                                        <option value="Cloud">Cloud</option>
                                                        <option value="On-Premise">On-Premise</option>
                                                        <option value="Hybrid">Hybrid</option>
                                                        <option value="SaaS">SaaS</option>
                                                    </select>
                                                </div>

                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        </svg>
                                                        Average Volume of Files Scanned Weekly
                                                    </label>
                                                    <select
                                                        className="form-select form-select-lg"
                                                        name="averageVolume"
                                                        value={formData.averageVolume}
                                                        onChange={handleChange}
                                                    >
                                                        <option value="">Select Volume</option>
                                                        <option value="<100">Less than 100</option>
                                                        <option value="100-500">100-500</option>
                                                        <option value="500-1000">500-1,000</option>
                                                        <option value="1000-5000">1,000-5,000</option>
                                                        <option value="5000+">5,000+</option>
                                                    </select>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <div className="form-check">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            name="needApiAccess"
                                                            checked={formData.needApiAccess}
                                                            onChange={handleChange}
                                                            id="needApiAccess"
                                                        />
                                                        <label className="form-check-label" htmlFor="needApiAccess">
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                                                                <polyline points="16 18 22 12 16 6" />
                                                                <polyline points="8 6 2 12 8 18" />
                                                            </svg>
                                                            Do you need API / SDK access?
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                            <circle cx="9" cy="7" r="4" />
                                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                        </svg>
                                                        Who will use this tool internally?
                                                    </label>
                                                    <div className="internal-users-checkboxes">
                                                        {['IT Team', 'Security Team', 'Compliance Team', 'Data Protection Officer', 'Legal Team', 'Management', 'All Employees'].map(user => (
                                                            <div key={user} className="form-check form-check-inline">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    name="internalUsers"
                                                                    value={user}
                                                                    checked={formData.internalUsers.includes(user)}
                                                                    onChange={handleChange}
                                                                    id={`user-${user}`}
                                                                />
                                                                <label className="form-check-label" htmlFor={`user-${user}`}>
                                                                    {user}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <label className="form-label">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </svg>
                                                        When do you plan to deploy?
                                                    </label>
                                                    <select
                                                        className="form-select form-select-lg"
                                                        name="deploymentPlan"
                                                        value={formData.deploymentPlan}
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
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4: Security & Consent */}
                                    {currentStep === 4 && (
                                        <div className="step-content fade-in">
                                            <h3 className="step-title mb-4">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="step-icon">
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                </svg>
                                                Security & Consent
                                            </h3>

                                            <div className="row">
                                                <div className="col-12 mb-4">
                                                    <div className="form-check form-switch">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            name="enable2FA"
                                                            checked={formData.enable2FA}
                                                            onChange={handleChange}
                                                            id="enable2FA"
                                                        />
                                                        <label className="form-check-label" htmlFor="enable2FA">
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                            </svg>
                                                            Enable Two-Factor Authentication (2FA)
                                                        </label>
                                                    </div>
                                                </div>

                                                {formData.enable2FA && (
                                                    <div className="col-md-6 mb-3">
                                                        <label className="form-label">
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                            </svg>
                                                            Preferred Auth Method
                                                        </label>
                                                        <select
                                                            className="form-select form-select-lg"
                                                            name="preferredAuthMethod"
                                                            value={formData.preferredAuthMethod}
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

                                                <div className="col-12 mb-3">
                                                    <div className="form-check">
                                                        <input
                                                            className={`form-check-input ${errors.acceptTerms ? 'is-invalid' : ''}`}
                                                            type="checkbox"
                                                            name="acceptTerms"
                                                            checked={formData.acceptTerms}
                                                            onChange={handleChange}
                                                            id="acceptTerms"
                                                        />
                                                        <label className="form-check-label" htmlFor="acceptTerms">
                                                            I accept the <a href="#" className="text-primary">Terms of Use</a> <span className="text-danger">*</span>
                                                        </label>
                                                        {errors.acceptTerms && <div className="invalid-feedback d-block">{errors.acceptTerms}</div>}
                                                    </div>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <div className="form-check">
                                                        <input
                                                            className={`form-check-input ${errors.acceptPrivacy ? 'is-invalid' : ''}`}
                                                            type="checkbox"
                                                            name="acceptPrivacy"
                                                            checked={formData.acceptPrivacy}
                                                            onChange={handleChange}
                                                            id="acceptPrivacy"
                                                        />
                                                        <label className="form-check-label" htmlFor="acceptPrivacy">
                                                            I accept the <a href="#" className="text-primary">Privacy Policy</a> <span className="text-danger">*</span>
                                                        </label>
                                                        {errors.acceptPrivacy && <div className="invalid-feedback d-block">{errors.acceptPrivacy}</div>}
                                                    </div>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <div className="form-check">
                                                        <input
                                                            className={`form-check-input ${errors.consentDataProcessing ? 'is-invalid' : ''}`}
                                                            type="checkbox"
                                                            name="consentDataProcessing"
                                                            checked={formData.consentDataProcessing}
                                                            onChange={handleChange}
                                                            id="consentDataProcessing"
                                                        />
                                                        <label className="form-check-label" htmlFor="consentDataProcessing">
                                                            I consent to data processing for account management <span className="text-danger">*</span>
                                                        </label>
                                                        {errors.consentDataProcessing && <div className="invalid-feedback d-block">{errors.consentDataProcessing}</div>}
                                                    </div>
                                                </div>

                                                <div className="col-12 mb-3">
                                                    <div className="form-check">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            name="receiveUpdates"
                                                            checked={formData.receiveUpdates}
                                                            onChange={handleChange}
                                                            id="receiveUpdates"
                                                        />
                                                        <label className="form-check-label" htmlFor="receiveUpdates">
                                                            I would like to receive product updates and newsletters
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Navigation Buttons */}
                                    <div className="d-flex justify-content-between mt-5 pt-4 border-top">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary btn-lg"
                                            onClick={handleBack}
                                            disabled={currentStep === 1}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                                                <polyline points="15 18 9 12 15 6" />
                                            </svg>
                                            Back
                                        </button>
                                        {currentStep < totalSteps ? (
                                            <button
                                                type="button"
                                                className="btn btn-primary btn-lg"
                                                onClick={handleNext}
                                            >
                                                Next
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                className="btn btn-primary btn-lg"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? 'Creating Account...' : 'Create Account'}
                                                {!isSubmitting && (
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '8px', verticalAlign: 'middle' }}>
                                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                        <polyline points="22 4 12 14.01 9 11.01" />
                                                    </svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-body text-center p-5">
                                <div className="success-icon mb-4">
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <h3 className="mb-3">Account Successfully Created!</h3>
                                <p className="text-muted mb-4">Welcome to PII Sentinel. Your account has been created successfully.</p>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        navigate('/dashboard');
                                    }}
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ScrollButton />
        </div>
    );
};

export default CreateAccount;
