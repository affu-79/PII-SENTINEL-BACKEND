import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiShield, FiArrowRight, FiArrowLeft, FiUpload, FiCpu, FiFileText, FiCheckCircle,
    FiActivity, FiUsers, FiTrendingUp, FiGlobe, FiZap, FiAward,
    FiCode, FiDatabase, FiLock, FiBarChart, FiSettings, FiBook,
    FiHeart, FiDollarSign, FiUser, FiBriefcase, FiBookOpen,
    FiEye, FiTarget, FiClock, FiStar, FiDownload, FiPlay
} from 'react-icons/fi';
import ScrollButton from './components/ScrollButton';
import Footer from './components/Footer';
import './UseCases.css';

const UseCases = () => {
    const navigate = useNavigate();
    const [visibleSections, setVisibleSections] = useState(new Set());
    const [currentRoleIndex, setCurrentRoleIndex] = useState(0);
    const sectionRefs = useRef({});

    // 3D Tilt Effect Handler
    const handleMouseMove = (e) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate rotation based on mouse position relative to center
        // More pronounced effect - smaller divisor means larger rotation
        const rotateX = (y - centerY) / 4;
        const rotateY = (centerX - x) / 4;

        // Limit rotation to prevent extreme angles
        const maxRotate = 20;
        const clampedRotateX = Math.max(-maxRotate, Math.min(maxRotate, rotateX));
        const clampedRotateY = Math.max(-maxRotate, Math.min(maxRotate, rotateY));

        // Remove any transition during mouse move for instant response
        card.style.transition = 'none';

        // Apply 3D transform with perspective - more pronounced scale
        // Keep opacity at 1 to prevent vanishing
        card.style.opacity = '1';
        card.style.transform = `perspective(1000px) rotateX(${clampedRotateX}deg) rotateY(${clampedRotateY}deg) scale3d(1.05, 1.05, 1.05)`;
        card.style.transformStyle = 'preserve-3d';
    };

    const handleMouseLeave = (e) => {
        const card = e.currentTarget;
        // Smoothly return to original position
        card.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        card.style.opacity = '1';
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';

        // Remove transition after animation completes
        setTimeout(() => {
            card.style.transition = '';
        }, 600);
    };

    useEffect(() => {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setVisibleSections(prev => new Set([...prev, entry.target.id]));
                }
            });
        }, observerOptions);

        Object.values(sectionRefs.current).forEach((ref) => {
            if (ref) observer.observe(ref);
        });

        return () => {
            Object.values(sectionRefs.current).forEach((ref) => {
                if (ref) observer.unobserve(ref);
            });
        };
    }, []);

    // Auto-rotate role cards
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentRoleIndex((prev) => (prev + 1) % roleBasedUseCases.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleGetStarted = () => {
        navigate('/dashboard');
    };

    const handleExploreFeatures = () => {
        navigate('/features');
    };

    const handleRequestDemo = () => {
        navigate('/pricing');
    };

    const industryUseCases = [
        {
            icon: <FiHeart />,
            title: 'Healthcare',
            description: 'Detect and mask patient identifiers in medical reports, ensuring HIPAA compliance and protecting sensitive health information.'
        },
        {
            icon: <FiDollarSign />,
            title: 'Finance',
            description: 'Audit customer data and transaction logs for PII leaks, ensuring PCI-DSS compliance and financial data security.'
        },
        {
            icon: <FiShield />,
            title: 'Government & Public Sector',
            description: 'Protect citizen data in forms and documents, ensuring compliance with data protection regulations and public trust.'
        },
        {
            icon: <FiCode />,
            title: 'Developers',
            description: 'Integrate privacy scanning into CI/CD pipelines, preventing PII leaks in code repositories and deployment processes.'
        },
        {
            icon: <FiFileText />,
            title: 'Legal & Compliance',
            description: 'Automate redaction and audit readiness, ensuring legal documents meet privacy requirements and compliance standards.'
        },
        {
            icon: <FiBookOpen />,
            title: 'Education & Research',
            description: 'Safeguard sensitive research participant data, ensuring academic integrity and protecting student privacy information.'
        }
    ];

    const roleBasedUseCases = [
        {
            icon: <FiShield />,
            title: 'Security Engineer',
            description: 'Protect your organization\'s digital assets with comprehensive PII detection.',
            responsibilities: [
                'Scan systems and detect data leaks in real-time',
                'Automate security alerts for PII exposure',
                'Monitor compliance across all data repositories',
                'Generate security audit reports'
            ]
        },
        {
            icon: <FiDatabase />,
            title: 'Data Scientist',
            description: 'Clean datasets of PII before AI model training and analysis.',
            responsibilities: [
                'Remove sensitive data from training datasets',
                'Ensure data privacy in ML pipelines',
                'Anonymize datasets for research purposes',
                'Validate data quality and compliance'
            ]
        },
        {
            icon: <FiFileText />,
            title: 'Compliance Officer',
            description: 'Generate audit-ready privacy reports and ensure regulatory compliance.',
            responsibilities: [
                'Automate compliance documentation',
                'Track PII handling across systems',
                'Generate audit-ready reports',
                'Ensure GDPR, DPDP, HIPAA compliance'
            ]
        },
        {
            icon: <FiTrendingUp />,
            title: 'CTO / CIO',
            description: 'Monitor enterprise data exposure in real-time across all systems.',
            responsibilities: [
                'Real-time data exposure monitoring',
                'Enterprise-wide privacy dashboard',
                'Risk assessment and mitigation',
                'Strategic privacy planning'
            ]
        },
        {
            icon: <FiBook />,
            title: 'Student / Researcher',
            description: 'Study anonymized datasets safely without compromising privacy.',
            responsibilities: [
                'Anonymize research data',
                'Ensure participant privacy',
                'Comply with research ethics',
                'Protect sensitive study information'
            ]
        }
    ];

    const workflowSteps = [
        {
            icon: <FiUpload />,
            title: 'Upload or Connect',
            description: 'Upload files or connect your data source through API integration.'
        },
        {
            icon: <FiCpu />,
            title: 'AI Scans & Detects',
            description: 'Advanced AI algorithms scan and detect sensitive information across all data types.'
        },
        {
            icon: <FiBarChart />,
            title: 'Generate Reports',
            description: 'Get comprehensive risk scores and compliance-ready reports instantly.'
        }
    ];

    const benefits = [
        {
            icon: <FiZap />,
            title: 'Real-Time Detection',
            description: 'Instant PII detection across text, documents, and images with minimal latency.'
        },
        {
            icon: <FiTarget />,
            title: 'High Accuracy',
            description: '98.7% detection accuracy with advanced pattern recognition and AI validation.'
        },
        {
            icon: <FiLock />,
            title: 'Privacy First',
            description: 'Zero-storage policy ensures your sensitive data is never retained.'
        },
        {
            icon: <FiGlobe />,
            title: 'Global Compliance',
            description: 'Built to meet GDPR, DPDP, HIPAA, and other international privacy standards.'
        },
        {
            icon: <FiSettings />,
            title: 'Easy Integration',
            description: 'Seamless API integration with your existing systems and workflows.'
        },
        {
            icon: <FiAward />,
            title: 'Enterprise Ready',
            description: 'Scalable solution designed for organizations of all sizes.'
        }
    ];

    const stats = [
        { icon: <FiUsers />, number: '100', label: 'Active Users' },
        { icon: <FiFileText />, number: '1000', label: 'Documents Scanned' },
        { icon: <FiTarget />, number: '98.7%', label: 'Detection Accuracy' },
        { icon: <FiGlobe />, number: '1', label: 'India Specific' }
    ];

    return (
        <div className="usecases-page">
            {/* Back to Home Button */}
            <button className="usecases-back-btn" onClick={() => navigate('/')} title="Back to Home">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Hero Section */}
            <section
                id="usecases-hero"
                ref={el => sectionRefs.current.hero = el}
                className={`usecases-hero ${visibleSections.has('usecases-hero') ? 'visible' : ''}`}
            >
                <div className="usecases-container">
                    <div className="hero-content-wrapper">
                        <div className="hero-content">
                            <div className="hero-badge">
                                <FiShield className="badge-icon" />
                                <span>Trusted Across Industries</span>
                            </div>
                            <h1 className="hero-title">
                                <span className="word-animate">Trusted</span>{' '}
                                <span className="word-animate" style={{ animationDelay: '0.1s' }}>Across</span>{' '}
                                <span className="word-animate" style={{ animationDelay: '0.2s' }}>Industries</span>
                                <br />
                                <span className="word-animate gradient-text" style={{ animationDelay: '0.3s' }}>
                                    for Privacy Protection
                                </span>
                            </h1>
                            <p className="hero-subtitle">
                                From developers to governments — PII Sentinel adapts to every environment.
                                Discover how organizations use our AI-powered privacy intelligence to protect sensitive data.
                            </p>
                            <div className="hero-buttons">
                                <button className="btn-hero-primary" onClick={handleExploreFeatures}>
                                    Explore Features
                                    <FiArrowRight className="btn-icon" />
                                </button>
                                <button className="btn-hero-secondary" onClick={handleGetStarted}>
                                    Get Started Free
                                    <FiZap className="btn-icon" />
                                </button>
                            </div>
                        </div>
                        <div className="hero-illustration">
                            <div className="illustration-network">
                                <div className="network-center">
                                    <FiShield />
                                </div>
                                {[...Array(8)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="network-node"
                                        style={{ '--angle': `${i * 45}deg` }}
                                    >
                                        <div className="node-icon">
                                            {i === 0 && <FiHeart />}
                                            {i === 1 && <FiDollarSign />}
                                            {i === 2 && <FiShield />}
                                            {i === 3 && <FiCode />}
                                            {i === 4 && <FiFileText />}
                                            {i === 5 && <FiBookOpen />}
                                            {i === 6 && <FiUsers />}
                                            {i === 7 && <FiDatabase />}
                                        </div>
                                        <div className="node-connection"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Industry Use Cases Section */}
            <section
                id="industry-section"
                ref={el => sectionRefs.current.industry = el}
                className={`industry-section ${visibleSections.has('industry-section') ? 'visible' : ''}`}
            >
                <div className="usecases-container">
                    <div className="section-header">
                        <span className="section-badge">
                            <FiUsers className="badge-icon" />
                            <span>Who Uses PII Sentinel?</span>
                        </span>
                        <h2 className="section-title">Tailored Privacy Intelligence for Every Sector</h2>
                        <p className="section-subtitle">
                            Industry-specific solutions designed to meet the unique privacy challenges of each sector.
                        </p>
                    </div>
                    <div className="industry-grid">
                        {industryUseCases.map((usecase, index) => (
                            <div
                                key={index}
                                className="industry-card"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="industry-hover-effect"></div>
                                <div className="industry-icon-wrapper">
                                    <div className="industry-icon">
                                        {usecase.icon}
                                    </div>
                                </div>
                                <h3 className="industry-title">{usecase.title}</h3>
                                <p className="industry-description">{usecase.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Role-Based Use Cases Section */}
            <section
                id="roles-section"
                ref={el => sectionRefs.current.roles = el}
                className={`roles-section ${visibleSections.has('roles-section') ? 'visible' : ''}`}
            >
                <div className="usecases-container">
                    <div className="section-header">
                        <span className="section-badge">
                            <FiUser className="badge-icon" />
                            <span>Empowering Every Professional</span>
                        </span>
                        <h2 className="section-title">Purpose-Built Intelligence for Different Roles</h2>
                        <p className="section-subtitle">
                            Discover how PII Sentinel empowers professionals across different roles and responsibilities.
                        </p>
                    </div>
                    <div className="roles-carousel-container">
                        <div className="roles-carousel-wrapper">
                            <div
                                className="roles-carousel"
                                style={{ transform: `translateX(-${currentRoleIndex * 100}%)` }}
                            >
                                {roleBasedUseCases.map((role, index) => (
                                    <div key={index} className="role-card-wrapper">
                                        <div className="role-card">
                                            <div className="role-header">
                                                <div className="role-icon-wrapper">
                                                    <div className="role-icon">
                                                        {role.icon}
                                                    </div>
                                                </div>
                                                <h3 className="role-title">{role.title}</h3>
                                                <p className="role-description">{role.description}</p>
                                            </div>
                                            <div className="role-responsibilities">
                                                <h4 className="responsibilities-title">Key Responsibilities:</h4>
                                                <ul className="responsibilities-list">
                                                    {role.responsibilities.map((responsibility, idx) => (
                                                        <li key={idx}>
                                                            <FiCheckCircle className="check-icon" />
                                                            <span>{responsibility}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="carousel-controls">
                            <button
                                className="carousel-btn prev"
                                onClick={() => setCurrentRoleIndex((prev) => (prev - 1 + roleBasedUseCases.length) % roleBasedUseCases.length)}
                                aria-label="Previous card"
                            >
                                <FiArrowLeft />
                            </button>
                            <button
                                className="carousel-btn next"
                                onClick={() => setCurrentRoleIndex((prev) => (prev + 1) % roleBasedUseCases.length)}
                                aria-label="Next card"
                            >
                                <FiArrowRight />
                            </button>
                        </div>
                        <div className="carousel-indicators">
                            {roleBasedUseCases.map((_, index) => (
                                <button
                                    key={index}
                                    className={`indicator ${currentRoleIndex === index ? 'active' : ''}`}
                                    onClick={() => setCurrentRoleIndex(index)}
                                    aria-label={`Go to card ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Workflow Showcase Section */}
            <section
                id="workflow-section"
                ref={el => sectionRefs.current.workflow = el}
                className={`workflow-section ${visibleSections.has('workflow-section') ? 'visible' : ''}`}
            >
                <div className="usecases-container">
                    <div className="section-header">
                        <span className="section-badge">
                            <FiActivity className="badge-icon" />
                            <span>How PII Sentinel Fits Into Your Workflow</span>
                        </span>
                        <h2 className="section-title">Simple Three-Step Process</h2>
                        <p className="section-subtitle">
                            From data input to actionable insights — see how PII Sentinel integrates seamlessly into your workflow.
                        </p>
                    </div>
                    <div className="workflow-timeline">
                        {workflowSteps.map((step, index) => (
                            <React.Fragment key={index}>
                                <div
                                    className="workflow-step"
                                    style={{ animationDelay: `${index * 0.15}s` }}
                                >
                                    <div className="step-card">
                                        <div className="step-number-container">
                                            <div className="step-number-bg"></div>
                                            <div className="step-number">{index + 1}</div>
                                            <div className="step-number-glow"></div>
                                        </div>
                                        <div className="step-icon-wrapper">
                                            <div className="step-icon-bg"></div>
                                            <div className="step-icon">
                                                {step.icon}
                                            </div>
                                            <div className="step-icon-pulse"></div>
                                        </div>
                                        <div className="step-content">
                                            <h3 className="step-title">{step.title}</h3>
                                            <p className="step-description">{step.description}</p>
                                        </div>
                                        <div className="step-hover-effect"></div>
                                    </div>
                                </div>
                                {index < workflowSteps.length - 1 && (
                                    <div className="step-connector" style={{ animationDelay: `${(index + 1) * 0.15}s` }}>
                                        <div className="connector-line">
                                            <div className="connector-line-fill"></div>
                                        </div>
                                        <div className="connector-arrow">
                                            <FiArrowRight />
                                            <div className="connector-arrow-glow"></div>
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section
                id="benefits-section"
                ref={el => sectionRefs.current.benefits = el}
                className={`benefits-section ${visibleSections.has('benefits-section') ? 'visible' : ''}`}
            >
                <div className="usecases-container">
                    <div className="section-header">
                        <span className="section-badge">
                            <FiStar className="badge-icon" />
                            <span>Why Choose PII Sentinel?</span>
                        </span>
                        <h2 className="section-title">Benefits That Matter</h2>
                        <p className="section-subtitle">
                            Discover the advantages that make PII Sentinel the preferred choice for privacy protection.
                        </p>
                    </div>
                    <div className="benefits-grid">
                        {benefits.map((benefit, index) => (
                            <div
                                key={index}
                                className="benefit-card"
                                style={{ animationDelay: `${index * 0.1}s` }}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                            >
                                <div className="benefit-icon-wrapper">
                                    <div className="benefit-icon">
                                        {benefit.icon}
                                    </div>
                                </div>
                                <h3 className="benefit-title">{benefit.title}</h3>
                                <p className="benefit-description">{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section
                id="stats-section"
                ref={el => sectionRefs.current.stats = el}
                className={`stats-section ${visibleSections.has('stats-section') ? 'visible' : ''}`}
            >
                {/* SVG Gradient Definition for Icons */}
                <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
                    <defs>
                        <linearGradient id="useCaseStatIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#667eea" />
                            <stop offset="100%" stopColor="#764ba2" />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="usecases-container">
                    <div className="section-header">
                        <span className="section-badge">
                            <FiTrendingUp className="badge-icon" />
                            <span>Trusted by Hundreds</span>
                        </span>
                        <h2 className="section-title">
                            <span className="word-animate gradient-text">Numbers</span>{' '}
                            <span className="word-animate gradient-text" style={{ animationDelay: '0.1s' }}>That</span>{' '}
                            <span className="word-animate gradient-text" style={{ animationDelay: '0.2s' }}>Speak</span>
                        </h2>
                        <p className="section-subtitle">
                            Join Tens of organizations protecting their data with PII Sentinel.
                        </p>
                    </div>
                    <div className="stats-grid">
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                className="stat-item"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="stat-icon-wrapper">
                                    <div className="stat-icon">{stat.icon}</div>
                                </div>
                                <div className="stat-number">{stat.number}</div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section
                id="cta-section"
                ref={el => sectionRefs.current.cta = el}
                className={`cta-section ${visibleSections.has('cta-section') ? 'visible' : ''}`}
            >
                <div className="usecases-container">
                    <div className="cta-content">
                        <h2 className="cta-title">Ready to Safeguard Your Data?</h2>
                        <p className="cta-subtitle">
                            Start scanning and securing your digital assets today. Join thousands of professionals protecting privacy with AI.
                        </p>
                        <div className="cta-buttons">
                            <button className="btn-cta-primary" onClick={handleGetStarted}>
                                Try Now
                                <FiPlay className="btn-icon" />
                            </button>
                            <button className="btn-cta-secondary" onClick={handleRequestDemo}>
                                Request Demo
                                <FiDownload className="btn-icon" />
                            </button>
                        </div>
                        <div className="cta-features">
                            <div className="cta-feature-item">
                                <FiCheckCircle />
                                <span>No credit card required</span>
                            </div>
                            <div className="cta-feature-item">
                                <FiCheckCircle />
                                <span>14-day free trial</span>
                            </div>
                            <div className="cta-feature-item">
                                <FiCheckCircle />
                                <span>Cancel anytime</span>
                            </div>
                        </div>
                    </div>
                    <div className="cta-background">
                        <div className="wave-animation"></div>
                        <div className="cta-glow"></div>
                    </div>
                </div>
            </section>
            <ScrollButton />
            <Footer />
        </div>
    );
};

export default UseCases;

