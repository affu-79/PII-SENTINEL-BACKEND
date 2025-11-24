// Welcome.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiTarget, FiTrendingUp, FiZap, FiDollarSign, FiShield, FiCheckCircle,
  FiArrowRight, FiStar, FiAward, FiActivity, FiBarChart, FiCpu, FiDatabase,
  FiLock, FiEye, FiGlobe, FiUsers, FiCode, FiFileText, FiSettings, FiUser
} from "react-icons/fi";
import ScrollButton from "./components/ScrollButton";
import Footer from "./components/Footer";
import "./welcome.css";
import demoVideo from "./assets/vedio.webm";

const Welcome = ({
  onOpenProfile = () => { },
  onOpenSignup = () => { },
  onOpenPricing = () => { }
}) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const demoVideoRef = useRef(null);

  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  useEffect(() => {
    // Close mobile menu when clicking outside
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen &&
        !event.target.closest('.nav-menu-mobile') &&
        !event.target.closest('.nav-hamburger') &&
        !event.target.closest('.nav-container')) {
        setIsMobileMenuOpen(false);
      }
    };

    // Close mobile menu on escape key
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const words = [
      { text: 'The', color: '#667eea' },
      { text: 'Most', color: '#764ba2' },
      { text: 'Intelligent', color: '#f093fb' },
      { text: 'And', color: '#f5576c' },
      { text: 'Powerful', color: '#4facfe' }
    ];

    let currentIndex = 0;
    const animatedWordElement = document.getElementById('animated-word');

    const animateWords = () => {
      if (animatedWordElement) {
        animatedWordElement.style.animation = 'flipOut 0.5s ease-in';

        setTimeout(() => {
          currentIndex = (currentIndex + 1) % words.length;
          animatedWordElement.textContent = words[currentIndex].text;
          animatedWordElement.style.setProperty('color', words[currentIndex].color, 'important');
          animatedWordElement.style.background = 'none';
          animatedWordElement.style.webkitTextFillColor = words[currentIndex].color;
          animatedWordElement.style.animation = 'flipIn 0.5s ease-out';
        }, 500);
      }
    };

    // Initialize the first word color
    if (animatedWordElement) {
      animatedWordElement.style.setProperty('color', words[0].color, 'important');
      animatedWordElement.style.background = 'none';
      animatedWordElement.style.webkitTextFillColor = words[0].color;
    }

    // Scroll detection for navbar
    const handleScroll = () => {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        if (window.scrollY > 50) {
          navbar.classList.add('scrolled');
          console.log('Navbar scrolled class added');
        } else {
          navbar.classList.remove('scrolled');
          console.log('Navbar scrolled class removed');
        }
      }
    };

    // Scroll detection for overview section animations
    const handleOverviewScroll = () => {
      const overviewLeft = document.getElementById('overview-left');
      const overviewRight = document.getElementById('overview-right');

      if (overviewLeft && overviewRight) {
        const overviewSection = overviewLeft.closest('.overview-section');
        if (overviewSection) {
          const rect = overviewSection.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;

          if (isVisible) {
            overviewLeft.classList.add('animate');
            overviewRight.classList.add('animate');
          }
        }
      }

      // Scroll detection for verification section animations
      const verificationSection = document.getElementById('verification-section');
      if (verificationSection) {
        const rect = verificationSection.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;

        if (isVisible) {
          // Animate fade-in-up elements
          const fadeElements = verificationSection.querySelectorAll('.fade-in-up');
          fadeElements.forEach((el, index) => {
            const delay = parseInt(el.getAttribute('data-delay') || 0) + (index * 50);
            setTimeout(() => {
              el.classList.add('visible');
            }, delay);
          });

          // Animate words in title
          const wordElements = verificationSection.querySelectorAll('.word-animate');
          wordElements.forEach((word, index) => {
            setTimeout(() => {
              word.classList.add('visible');
            }, 300 + (index * 100));
          });
        }
      }
    };

    // Add scroll listeners with passive option
    const scrollHandler = (e) => {
      handleScroll();
      handleOverviewScroll();
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });

    const interval = setInterval(animateWords, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', scrollHandler, { passive: true });
    };
  }, []);

  useEffect(() => {
    const video = demoVideoRef.current;
    if (!video) return;

    const TRIM_START = 4;
    const seekToTrimPoint = () => {
      if (!video.duration || video.duration <= TRIM_START) {
        return;
      }
      if (video.currentTime < TRIM_START - 0.05) {
        try {
          video.currentTime = TRIM_START;
        } catch (err) {
          // Some browsers prevent setting currentTime immediately; ignore.
        }
      }
    };

    const handleLoaded = () => {
      seekToTrimPoint();
      video.play().catch(() => {
        /* Autoplay might be blocked; ignore. */
      });
    };

    const handleEnded = () => {
      seekToTrimPoint();
      video.play().catch(() => {
        /* Ignore playback failures */
      });
    };

    const handlePlay = () => {
      seekToTrimPoint();
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);


  return (
    <div className="welcome-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-bg-wrapper">
          <div className="navbar-rotating-ring"></div>
          <div className="navbar-content">
            <div className="nav-container">
              <div className="nav-logo">
                <h2>PII Sentinel</h2>
              </div>
              <div className="nav-menu-desktop">
                <a href="/features" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/features'); }}>Features</a>
                <a href="/usecases" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/usecases'); }}>Use Cases</a>
                <a href="/howitworks" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/howitworks'); }}>How it Works</a>
                <button className="nav-link nav-ghost-btn" onClick={() => navigate('/pricing')}>Pricing</button>
                <button className="nav-signup-btn" onClick={() => navigate('/signup')}>Sign Up</button>
                <button className="nav-avatar-btn" aria-label="Open profile" onClick={() => navigate('/profile')}>
                  <span className="nav-avatar" />
                </button>
              </div>
              <button
                className={`nav-hamburger ${isMobileMenuOpen ? 'nav-hamburger-open' : ''}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
              </button>
            </div>
            <div className="nav-avatar-tooltip">
              <span className="tooltip-text">Edit Profile</span>
              <div className="tooltip-shimmer"></div>
            </div>
            {/* Mobile Menu Dropdown */}
            <div className={`nav-menu-mobile ${isMobileMenuOpen ? 'nav-menu-mobile-open' : ''}`}>
              <div className="nav-menu-mobile-content">
                <a href="/features" className="nav-link-mobile" onClick={(e) => { e.preventDefault(); navigate('/features'); setIsMobileMenuOpen(false); }}>Features</a>
                <a href="/usecases" className="nav-link-mobile" onClick={(e) => { e.preventDefault(); navigate('/usecases'); setIsMobileMenuOpen(false); }}>Use Cases</a>
                <a href="/howitworks" className="nav-link-mobile" onClick={(e) => { e.preventDefault(); navigate('/howitworks'); setIsMobileMenuOpen(false); }}>How it Works</a>
                <button className="nav-link-mobile nav-ghost-btn-mobile" onClick={() => { navigate('/pricing'); setIsMobileMenuOpen(false); }}>Pricing</button>
                <button className="nav-signup-btn-mobile" onClick={() => { navigate('/signup'); setIsMobileMenuOpen(false); }}>Sign Up</button>
                <button className="nav-profile-btn-mobile" onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }}>
                  <FiUser className="nav-profile-icon" />
                  <span>Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Announcement Banner */}
      <div className="announcement-banner">
        <div className="container">
          <p>🚀 Announcing our latest AI-powered PII detection technology</p>
        </div>
      </div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>AI-Powered Data Protection</span>
            </div>
            <h1 className="hero-title">
              Secure Your Data with
              <br className="hero-break" />
              <span className="animated-word-wrapper">
                <span className="animated-word" id="animated-word">The</span>
                <span className="word-after">PII Detection</span>
              </span>
            </h1>
            <p className="hero-subtitle">
              Advanced AI technology that identifies and protects sensitive information
              in your documents, ensuring compliance and data security.
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary btn-pill animated-pill" onClick={handleGetStarted}>
                <span>Try Free</span>
              </button>
              <button className="btn btn-outline-primary btn-pill animated-pill" onClick={handleGetStarted}>
                <span>Get Demo</span>
              </button>
            </div>
            <p className="hero-caption">
              Imagine securing your sensitive data before it becomes vulnerable
            </p>
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="demo-video-section">
        <div className="container">
          <div className="demo-video-header">
            <div className="demo-video-badge">
              <span>See it in action</span>
            </div>
            <h2 className="demo-video-title">Experience the PII Sentinel workflow in seconds</h2>
            <p className="demo-video-subtitle">
              Watch how our automated detection, review, and remediation loop keeps your most sensitive data safe.
            </p>
          </div>
          <div className="demo-video-sketch">
            <div className="demo-video-browser">
              <div className="demo-video-browser-bar">
                <span className="browser-dot" />
                <span className="browser-dot" />
                <span className="browser-dot" />
              </div>
              <video
                ref={demoVideoRef}
                className="demo-video-player"
                muted
                playsInline
                autoPlay
                preload="metadata"
              >
                <source src={demoVideo} type="video/webm" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="demo-video-scribble demo-video-scribble-left" aria-hidden="true" />
            <div className="demo-video-scribble demo-video-scribble-right" aria-hidden="true" />
            <div className="demo-video-shadow" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="trusted-section">
        <div className="container">
          <p className="trusted-text">Trusted by leading organizations</p>
          <div className="trusted-logos">
            <div className="marquee-container">
              <div className="logo-item">Microsoft</div>
              <div className="logo-item">Google</div>
              <div className="logo-item">Amazon</div>
              <div className="logo-item">IBM</div>
              <div className="logo-item">Oracle</div>
              <div className="logo-item">Salesforce</div>
              <div className="logo-item">Netflix</div>
              <div className="logo-item">Tesla</div>
              <div className="logo-item">Apple</div>
              <div className="logo-item">Meta</div>
              {/* Duplicate for seamless loop */}
              <div className="logo-item">Microsoft</div>
              <div className="logo-item">Google</div>
              <div className="logo-item">Amazon</div>
              <div className="logo-item">IBM</div>
              <div className="logo-item">Oracle</div>
              <div className="logo-item">Salesforce</div>
              <div className="logo-item">Netflix</div>
              <div className="logo-item">Tesla</div>
              <div className="logo-item">Apple</div>
              <div className="logo-item">Meta</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {/* Product Overview */}
      <section className="overview-section">
        <div className="container">
          <div className="overview-header">
            <div className="overview-badge">
              <FiStar className="badge-icon" />
              <span>AI-Powered Intelligence</span>
            </div>
            <h2 className="overview-title">Product Overview</h2>
            <p className="section-subtitle">
              Advanced PII detection technology that automatically identifies and
              protects sensitive information in your documents and data streams.
            </p>
          </div>

          <div className="overview-content">
            <div className="overview-left" id="overview-left">
              {/* Feature Cards Grid */}
              <div className="overview-features-grid">
                <div className="overview-feature-card">
                  <div className="feature-card-icon-wrapper">
                    <FiTarget className="feature-card-icon" />
                  </div>
                  <h3>Targeted Detection</h3>
                  <p>Accurately identify sensitive data patterns with precision AI algorithms</p>
                  <div className="feature-card-stats">
                    <span className="stat-badge">
                      <FiCheckCircle /> 98.7% Accuracy
                    </span>
                  </div>
                </div>

                <div className="overview-feature-card">
                  <div className="feature-card-icon-wrapper">
                    <FiTrendingUp className="feature-card-icon" />
                  </div>
                  <h3>Scalable Processing</h3>
                  <p>Process any volume of documents or data streams seamlessly</p>
                  <div className="feature-card-stats">
                    <span className="stat-badge">
                      <FiActivity /> 1M+ Documents
                    </span>
                  </div>
                </div>

                <div className="overview-feature-card">
                  <div className="feature-card-icon-wrapper">
                    <FiZap className="feature-card-icon" />
                  </div>
                  <h3>Rapid Analysis</h3>
                  <p>Get results in seconds, not hours with optimized processing</p>
                  <div className="feature-card-stats">
                    <span className="stat-badge">
                      <FiZap /> &lt;5s Average
                    </span>
                  </div>
                </div>

                <div className="overview-feature-card">
                  <div className="feature-card-icon-wrapper">
                    <FiDollarSign className="feature-card-icon" />
                  </div>
                  <h3>Affordable Pricing</h3>
                  <p>A fraction of traditional compliance costs with transparent pricing</p>
                  <div className="feature-card-stats">
                    <span className="stat-badge">
                      <FiAward /> Cost-Effective
                    </span>
                  </div>
                </div>
              </div>

              {/* Additional Features List */}
              <div className="overview-additional-features">
                <h3 className="additional-features-title">
                  <FiShield className="title-icon" />
                  Enterprise-Grade Features
                </h3>
                <div className="additional-features-list">
                  <div className="additional-feature-item">
                    <FiCheckCircle className="check-icon" />
                    <span>Real-time API integration for seamless workflows</span>
                  </div>
                  <div className="additional-feature-item">
                    <FiCheckCircle className="check-icon" />
                    <span>Multi-format support: PDF, DOCX, Images, CSV</span>
                  </div>
                  <div className="additional-feature-item">
                    <FiCheckCircle className="check-icon" />
                    <span>Advanced OCR with DeepSeek technology</span>
                  </div>
                  <div className="additional-feature-item">
                    <FiCheckCircle className="check-icon" />
                    <span>Compliance with GDPR, DPDP, HIPAA standards</span>
                  </div>
                  <div className="additional-feature-item">
                    <FiCheckCircle className="check-icon" />
                    <span>Zero data retention policy for maximum security</span>
                  </div>
                  <div className="additional-feature-item">
                    <FiCheckCircle className="check-icon" />
                    <span>Detailed risk scoring and analytics dashboard</span>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="overview-cta">
                <button className="btn btn-primary btn-pill overview-cta-btn" onClick={() => navigate('/features')}>
                  <span>Explore Features</span>
                  <FiArrowRight className="btn-icon" />
                </button>
                <button className="btn btn-outline-primary btn-pill overview-cta-btn" onClick={() => navigate('/pricing')}>
                  <span>View Pricing</span>
                  <FiArrowRight className="btn-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title center">Secure, analyze, and protect your data</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-number">1</div>
              <h3>Upload Any Document</h3>
              <p>Support for multiple file formats including PDFs, Word documents, images, and text files.</p>
            </div>
            <div className="feature-card">
              <div className="feature-number">2</div>
              <h3>Run AI Analysis</h3>
              <p>Advanced machine learning algorithms scan your documents for sensitive information patterns.</p>
            </div>
            <div className="feature-card">
              <div className="feature-number">3</div>
              <h3>Get Detailed Reports</h3>
              <p>Comprehensive analysis with highlighted PII instances, risk scores, and compliance recommendations.</p>
            </div>
            <div className="feature-card">
              <div className="feature-number">4</div>
              <h3>Secure Your Data</h3>
              <p>Implement automated data protection measures and maintain compliance with industry standards.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Verification Section */}
      <section className="verification-feature-section" id="verification-section">
        <div className="container">
          <div className="verification-feature-content">
            <div className="verification-feature-badge fade-in-up" data-delay="0">
              <span className="badge-icon">🔐</span>
              <span>PII Verification</span>
            </div>
            <h2 className="verification-feature-title fade-in-up" data-delay="100">
              <span className="word-animate">Decrypt</span>
              <span className="word-animate">&</span>
              <span className="word-animate">Verify</span>
              <span className="word-animate">Locked</span>
              <span className="word-animate">JSON</span>
              <span className="word-animate">Files</span>
            </h2>
            <p className="verification-feature-description fade-in-up" data-delay="200">
              Our advanced verification system allows you to securely decrypt and verify your locked JSON files containing sensitive PII data.
              With enterprise-grade encryption and authentication, ensure your data remains protected while maintaining full control over access and verification processes.
            </p>

            {/* Security & Authentication Info */}
            <div className="verification-info-grid fade-in-up" data-delay="300">
              <div className="verification-info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <h3>Enterprise Security</h3>
                <p>Military-grade AES-GCM encryption ensures your PII data is protected with industry-leading security standards.</p>
              </div>
              <div className="verification-info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3>Password Authentication</h3>
                <p>Bcrypt-hashed passwords provide secure authentication, ensuring only authorized users can decrypt your sensitive data.</p>
              </div>
              <div className="verification-info-card">
                <div className="info-card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" />
                    <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
                    <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
                    <path d="M12 21c0-1-1-3-3-3s-3 2-3 3 1 3 3 3 3-2 3-3z" />
                    <path d="M12 3c0 1-1 3-3 3S6 4 6 3s1-3 3-3 3 2 3 3z" />
                  </svg>
                </div>
                <h3>Data Verification</h3>
                <p>Comprehensive verification process validates file integrity and ensures all PII data is accurately decrypted and displayed.</p>
              </div>
            </div>

            {/* Features List */}
            <div className="verification-features-list fade-in-up" data-delay="400">
              <div className="verification-feature-item feature-3d">
                <div className="verification-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="verification-feature-text">
                  <strong>Secure Decryption</strong>
                  <p>Decrypt locked JSON files using your encryption password with AES-GCM algorithm</p>
                </div>
              </div>
              <div className="verification-feature-item feature-3d">
                <div className="verification-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3zM9 9h6v6H9z" />
                    <path d="M21 9l-6 6M9 21l-6-6" />
                  </svg>
                </div>
                <div className="verification-feature-text">
                  <strong>Organized View</strong>
                  <p>View decrypted PIIs organized by type in an intuitive, interactive interface</p>
                </div>
              </div>
              <div className="verification-feature-item feature-3d">
                <div className="verification-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="verification-feature-text">
                  <strong>Easy Download</strong>
                  <p>Download decrypted files individually or all at once with a single click</p>
                </div>
              </div>
              <div className="verification-feature-item feature-3d">
                <div className="verification-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div className="verification-feature-text">
                  <strong>Metadata Tracking</strong>
                  <p>Complete metadata tracking including batch ID, export date, and file information</p>
                </div>
              </div>
            </div>

            {/* Why Section */}
            <div className="verification-why-section fade-in-up" data-delay="500">
              <h3 className="why-title">Why PII Verification Matters</h3>
              <div className="why-content">
                <div className="why-item">
                  <div className="why-number">01</div>
                  <div className="why-text">
                    <h4>Compliance & Audit</h4>
                    <p>Maintain compliance with GDPR, CCPA, and other data protection regulations by verifying encrypted PII data.</p>
                  </div>
                </div>
                <div className="why-item">
                  <div className="why-number">02</div>
                  <div className="why-text">
                    <h4>Data Recovery</h4>
                    <p>Securely recover and access your encrypted PII data when needed for business operations or legal requirements.</p>
                  </div>
                </div>
                <div className="why-item">
                  <div className="why-number">03</div>
                  <div className="why-text">
                    <h4>Access Control</h4>
                    <p>Ensure only authorized personnel with the correct password can decrypt and view sensitive PII information.</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="btn-verification animated-btn btn-3d"
              onClick={() => navigate('/verification')}
            >
              <span>Verify & Decrypt JSON Files</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <div className="cta-badge">
              <FiShield className="cta-badge-icon" />
              <span>Start Protecting Your Data</span>
            </div>
            <h2>Ready to secure your sensitive data?</h2>
            <p>Start protecting your information with our AI-powered PII detection today.</p>
            <div className="cta-buttons">
              <button className="btn btn-primary btn-pill animated-pill btn-lg" onClick={handleGetStarted}>
                <span>Get Started Free</span>
                <FiArrowRight className="btn-icon" />
              </button>
              <button className="btn btn-outline-light btn-pill animated-pill btn-lg" onClick={handleGetStarted}>
                <span>Get Demo</span>
                <FiArrowRight className="btn-icon" />
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
        </div>
      </section>
      <ScrollButton />
      <Footer />
    </div >
  );
};

export default Welcome;
