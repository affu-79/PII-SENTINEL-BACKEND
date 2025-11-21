import React from 'react';
import { FiInstagram, FiLinkedin } from 'react-icons/fi';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer-container">
            {/* Large Watermark Background Text */}
            <div className="footer-watermark">PII Sentinel</div>

            <div className="footer-content">
                {/* Top Section */}
                <div className="footer-top">
                    {/* Left Side - Description */}
                    <div className="footer-left-text">
                        <p className="footer-description">
                            AI-powered privacy engine that analyzes and secures your sensitive data.
                        </p>
                    </div>

                    {/* Right Side - Company Links */}
                    <div className="footer-right-menu">
                        <h4 className="footer-menu-title">Company</h4>
                        <a href="/about" className="footer-menu-link">About</a>
                        <a href="/about#contact" className="footer-menu-link">Contact</a>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="footer-bottom">
                    {/* Bottom Left - Social Icons */}
                    <div className="footer-socials">
                        <a
                            href="https://instagram.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon"
                            aria-label="Instagram"
                        >
                            <FiInstagram />
                        </a>
                        <a
                            href="https://linkedin.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon"
                            aria-label="LinkedIn"
                        >
                            <FiLinkedin />
                        </a>
                    </div>

                    {/* Bottom Right - Legal Links */}
                    <div className="footer-legal">
                        <a href="/security" className="footer-legal-link">Security</a>
                        <span className="footer-separator">|</span>
                        <a href="/terms" className="footer-legal-link">Terms of Service</a>
                        <span className="footer-separator">|</span>
                        <a href="/privacy" className="footer-legal-link">Privacy Policy</a>
                    </div>
                </div>

                {/* Copyright */}
                <div className="footer-copyright">
                    <span>©2025 PII Sentinel Inc.</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
