import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiLock, FiDatabase, FiEye, FiCpu, FiBarChart, FiShield,
  FiArrowRight, FiZap, FiGlobe, FiCheckCircle, FiTrendingUp,
  FiUsers, FiAward, FiCode, FiFileText, FiActivity, FiTarget,
  FiKey, FiAlertCircle, FiServer, FiCloud, FiUserCheck, FiLayers

} from 'react-icons/fi';
import ScrollButton from './components/ScrollButton';
import Footer from './components/Footer';
import './Features.css';

const Features = () => {
  const navigate = useNavigate();
  const [visibleSections, setVisibleSections] = useState(new Set());
  const sectionRefs = useRef({});

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


  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  const handleLearnMore = () => {
    navigate('/howitworks');
  };

  const coreFeatures = [
    {
      icon: <FiEye />,
      title: 'AI-Powered PII Detection',
      description: 'Detect Aadhaar, PAN, and 30+ sensitive entities in real time with advanced machine learning algorithms.'
    },
    {
      icon: <FiFileText />,
      title: 'OCR & Image Scanning',
      description: 'Extract hidden PII from PDFs, images, and screenshots using DeepSeek OCR technology.'
    },
    {
      icon: <FiTarget />,
      title: 'Adaptive Risk Scoring',
      description: 'Assign risk levels based on sensitivity and exposure context with intelligent scoring algorithms.'
    },
    {
      icon: <FiCode />,
      title: 'Real-Time API Integration',
      description: 'Plug into your existing apps, pipelines, or cloud services with seamless REST API integration.'
    },
    {
      icon: <FiShield />,
      title: 'Compliance Intelligence',
      description: 'Automate compliance with GDPR, DPDP, HIPAA, and other global privacy regulations.'
    },
    {
      icon: <FiBarChart />,
      title: 'Privacy Dashboard',
      description: 'Monitor scans, alerts, and reports in one unified dashboard with real-time analytics.'
    }
  ];

  const technicalCapabilities = [
    { icon: <FiCpu />, text: 'DeepSeek OCR integration' },
    { icon: <FiGlobe />, text: 'Multilingual PII detection' },
    { icon: <FiDatabase />, text: 'File, text, and API scanning modes' },
    { icon: <FiZap />, text: 'Real-time risk computation' },
    { icon: <FiLock />, text: 'No data retention — privacy by design' }
  ];

  const securityFeatures = [
    {
      icon: <FiLock />,
      title: 'End-to-End Encryption',
      description: 'All data is encrypted in transit and at rest using industry-standard protocols.'
    },
    {
      icon: <FiShield />,
      title: 'Zero-Storage Data Policy',
      description: 'Your sensitive data is never stored. We process and return results immediately.'
    },
    {
      icon: <FiCheckCircle />,
      title: 'Auditable AI Decisions',
      description: 'Every detection decision is logged and traceable for compliance audits.'
    },
    {
      icon: <FiGlobe />,
      title: 'Global Compliance Frameworks',
      description: 'Built to meet GDPR, DPDP, HIPAA, and other international privacy standards.'
    }
  ];

  const useCases = [
    { icon: <FiUsers />, title: 'Enterprise Data Protection', description: 'Safeguard customer data across all systems' },
    { icon: <FiDatabase />, title: 'Cloud Migration Security', description: 'Scan data before moving to cloud platforms' },
    { icon: <FiFileText />, title: 'Document Redaction', description: 'Automatically identify and mask sensitive information' },
    { icon: <FiCode />, title: 'CI/CD Pipeline Integration', description: 'Prevent PII leaks in code repositories' }
  ];

  return (
    <div className="features-page">
      {/* Back to Home Button */}
      <button className="features-back-btn" onClick={() => navigate('/')} title="Back to Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Hero Section */}
      <section
        id="features-hero"
        ref={el => sectionRefs.current.hero = el}
        className={`features-hero ${visibleSections.has('features-hero') ? 'visible' : ''}`}
      >
        <div className="features-container">
          <div className="hero-content">
            <div className="hero-badge">
              <FiShield className="badge-icon" />
              <span>Why PII Sentinel?</span>
            </div>
            <h1 className="hero-title">
              <span className="word-animate">Protect</span>{' '}
              <span className="word-animate" style={{ animationDelay: '0.1s' }}>What</span>{' '}
              <span className="word-animate" style={{ animationDelay: '0.2s' }}>Matters.</span>
              <br />
              <span className="word-animate gradient-text" style={{ animationDelay: '0.3s' }}>
                Detect PII Anywhere, Instantly.
              </span>
            </h1>
            <p className="hero-subtitle">
              AI-driven privacy intelligence that scans text, documents, and images for sensitive data
              across systems. Built for security teams, developers, and compliance officers.
            </p>
            <div className="hero-buttons">
              <button className="btn-hero-primary" onClick={handleGetStarted}>
                Get Started
                <FiArrowRight className="btn-icon" />
              </button>
              <button className="btn-hero-secondary" onClick={handleLearnMore}>
                Learn More
                <FiZap className="btn-icon" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Animated Features Grid Section */}
      <section
        id="animated-features-grid"
        ref={el => sectionRefs.current.animatedGrid = el}
        className={`animated-features-grid-section ${visibleSections.has('animated-features-grid') ? 'visible' : ''}`}
      >
        {/* Background Animated Icons */}
        <div className="background-icons-container">
          {/* Left Side Icons (3 icons) */}
          <div className="background-icon bg-icon-left-1">
            <FiShield />
          </div>
          <div className="background-icon bg-icon-left-2">
            <FiLock />
          </div>
          <div className="background-icon bg-icon-left-3">
            <FiKey />
          </div>

          {/* Right Side Icons (4 icons) */}
          <div className="background-icon bg-icon-right-1">
            <FiEye />
          </div>
          <div className="background-icon bg-icon-right-2">
            <FiDatabase />
          </div>
          <div className="background-icon bg-icon-right-3">
            <FiUserCheck />
          </div>
          <div className="background-icon bg-icon-right-4">
            <FiServer />
          </div>
        </div>

        <div className="features-container">
          {/* Section Title */}
          <div className="grid-section-header">
            <h2 className="grid-section-title">
              <span className="word-animate gradient-text">Core</span>{' '}
              <span className="word-animate gradient-text" style={{ animationDelay: '0.1s' }}>
                Security Features
              </span>
            </h2>
            <p className="grid-section-subtitle">
              Advanced protection mechanisms built into every component
            </p>
          </div>

          <div className="minimal-animation">
            {/* 2x2 Grid of Animated Divs */}
            <div className="animated-grid">
              {/* Top Left - Appears First */}
              <div className="feature-box box-1">
                <div className="box-icon-wrapper">
                  <FiEye className="box-icon" />
                </div>
                <div className="box-text">AI-Powered Detection</div>
              </div>

              {/* Top Right - Appears Second */}
              <div className="feature-box box-2">
                <div className="box-icon-wrapper">
                  <FiShield className="box-icon" />
                </div>
                <div className="box-text">Real-Time Protection</div>
              </div>

              {/* Bottom Left - Appears Second */}
              <div className="feature-box box-3">
                <div className="box-icon-wrapper">
                  <FiLock className="box-icon" />
                </div>
                <div className="box-text">Secure Encryption</div>
              </div>

              {/* Bottom Right - Appears First */}
              <div className="feature-box box-4">
                <div className="box-icon-wrapper">
                  <FiDatabase className="box-icon" />
                </div>
                <div className="box-text">Data Privacy</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section
        id="core-features-section"
        ref={el => sectionRefs.current.coreFeatures = el}
        className={`core-features-section ${visibleSections.has('core-features-section') ? 'visible' : ''}`}
      >
        <div className="features-container">
          <div className="section-header">
            <span className="section-badge">
              <FiAward className="badge-icon" />
              <span>Powerful Features</span>
            </span>
            <h2 className="section-title">Built for Every Data Guardian</h2>
            <p className="section-subtitle">
              Comprehensive privacy protection tools designed for modern organizations.
            </p>
          </div>
          <div className="features-grid">
            {coreFeatures.map((feature, index) => (
              <div
                key={index}
                className="feature-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="feature-icon-wrapper">
                  <div className="feature-icon">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Capabilities */}
      <section
        id="technical-section"
        ref={el => sectionRefs.current.technical = el}
        className={`technical-section ${visibleSections.has('technical-section') ? 'visible' : ''}`}
      >
        <div className="features-container">
          <div className="technical-content">
            <div className="technical-illustration">
              <div className="neural-network">
                <div className="network-center">
                  <FiCpu />
                </div>
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="network-node"
                    style={{ '--angle': `${i * 45}deg` }}
                  >
                    <div className="node-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="technical-list">
              <div className="section-header technical-section-header">
                <span className="section-badge">
                  <FiCpu className="badge-icon" />
                  <span>Under the Hood</span>
                </span>
                <h2 className="section-title">Intelligence that Works for You</h2>
                <p className="section-subtitle">
                  Advanced technology stack powering every detection.
                </p>
              </div>
              <ul className="capabilities-list">
                {technicalCapabilities.map((capability, index) => (
                  <li key={index} className="capability-item">
                    <div className="capability-icon">{capability.icon}</div>
                    <span>{capability.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Trust */}
      <section
        id="security-section"
        ref={el => sectionRefs.current.security = el}
        className={`security-section ${visibleSections.has('security-section') ? 'visible' : ''}`}
      >
        <div className="features-container">
          <div className="section-header">
            <span className="section-badge">
              <FiLock className="badge-icon" />
              <span>Security First</span>
            </span>
            <h2 className="section-title">Built with Security and Transparency</h2>
            <p className="section-subtitle">
              Your data privacy is our top priority. Every feature is designed with security in mind.
            </p>
          </div>
          <div className="security-grid">
            {securityFeatures.map((feature, index) => (
              <div
                key={index}
                className="security-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="security-icon-wrapper">
                  <div className="security-icon">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="security-title">{feature.title}</h3>
                <p className="security-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Preview */}
      <section
        id="usecases-section"
        ref={el => sectionRefs.current.usecases = el}
        className={`usecases-section ${visibleSections.has('usecases-section') ? 'visible' : ''}`}
      >
        <div className="features-container">
          <div className="section-header">
            <span className="section-badge">
              <FiUsers className="badge-icon" />
              <span>Real-World Applications</span>
            </span>
            <h2 className="section-title">Trusted Across Industries</h2>
            <p className="section-subtitle">
              See how organizations use PII Sentinel to protect their data.
            </p>
          </div>
          <div className="usecases-grid">
            {useCases.map((usecase, index) => (
              <div
                key={index}
                className="usecase-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="usecase-icon-wrapper">
                  <div className="usecase-icon">
                    {usecase.icon}
                  </div>
                </div>
                <h3 className="usecase-title">{usecase.title}</h3>
                <p className="usecase-description">{usecase.description}</p>
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
            <linearGradient id="statIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
          </defs>
        </svg>
        <div className="features-container">
          <div className="section-header">
            <span className="section-badge">
              <FiTrendingUp className="badge-icon" />
              <span>Trusted by Teams</span>
            </span>
            <h2 className="section-title">
              <span className="word-animate gradient-text">Numbers</span>{' '}
              <span className="word-animate gradient-text" style={{ animationDelay: '0.1s' }}>That</span>{' '}
              <span className="word-animate gradient-text" style={{ animationDelay: '0.2s' }}>Speak</span>
            </h2>
            <p className="section-subtitle">
              Real results from organizations protecting their data with PII Sentinel.
            </p>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-icon-wrapper">
                <FiUsers className="stat-icon" />
              </div>
              <div className="stat-number">100</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-wrapper">
                <FiFileText className="stat-icon" />
              </div>
              <div className="stat-number">500</div>
              <div className="stat-label">Documents Scanned</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-wrapper">
                <FiTarget className="stat-icon" />
              </div>
              <div className="stat-number">98.7%</div>
              <div className="stat-label">Detection Accuracy</div>
            </div>
            <div className="stat-item">
              <div className="stat-icon-wrapper">
                <FiCheckCircle className="stat-icon" />
              </div>
              <div className="stat-number">100%</div>
              <div className="stat-label">Compliance Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="cta-section"
        ref={el => sectionRefs.current.cta = el}
        className={`cta-section ${visibleSections.has('cta-section') ? 'visible' : ''}`}
      >
        <div className="features-container">
          <div className="cta-content">
            <h2 className="cta-title">Start Safeguarding Your Data Today</h2>
            <p className="cta-subtitle">
              Join thousands of professionals protecting privacy with AI.
            </p>
            <div className="cta-buttons">
              <button className="btn-cta-primary" onClick={handleGetStarted}>
                Get Started Free
                <FiArrowRight className="btn-icon" />
              </button>
              <button className="btn-cta-secondary" onClick={() => navigate('/pricing')}>
                Explore Docs
                <FiFileText className="btn-icon" />
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

export default Features;

