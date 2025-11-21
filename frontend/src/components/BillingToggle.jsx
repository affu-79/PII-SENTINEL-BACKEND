import React, { useState, useEffect } from 'react';
import './BillingToggle.css';

const BillingToggle = ({ yearly, setYearly }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleToggle = () => {
        setYearly(!yearly);
    };

    const handleMonthlyClick = () => {
        if (yearly) {
            setYearly(false);
        }
    };

    const handleYearlyClick = () => {
        if (!yearly) {
            setYearly(true);
        }
    };

    // Calculate discount percentage (17% based on FAQ)
    const discountPercent = 17;

    // Mobile: Two-button segment control
    if (isMobile) {
        return (
            <div className="billing-toggle-wrapper mobile-toggle">
                <div className="billing-toggle-mobile">
                    <button
                        className={`toggle-option-mobile ${!yearly ? 'active' : ''}`}
                        onClick={handleMonthlyClick}
                        aria-label="Monthly billing"
                    >
                        <span className="toggle-option-text">Monthly</span>
                    </button>
                    <button
                        className={`toggle-option-mobile ${yearly ? 'active' : ''}`}
                        onClick={handleYearlyClick}
                        aria-label="Yearly billing"
                    >
                        <span className="toggle-option-text">Yearly</span>
                        {yearly && (
                            <span className="save-badge-mobile">
                                Save {discountPercent}%
                            </span>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Desktop & Tablet: Toggle switch design
    return (
        <div className="billing-toggle-wrapper">
            <div className="billing-toggle-container">
                <button
                    className={`toggle-label ${!yearly ? 'active' : ''}`}
                    onClick={handleMonthlyClick}
                    aria-label="Monthly billing"
                >
                    <span className="label-text">Monthly</span>
                </button>

                <div className="toggle-switch-wrapper">
                    <button
                        className="toggle-switch"
                        onClick={handleToggle}
                        aria-label="Toggle billing period"
                        aria-pressed={yearly}
                    >
                        <div className={`toggle-slider ${yearly ? 'yearly' : 'monthly'}`}>
                            <div className="toggle-knob"></div>
                        </div>
                    </button>
                </div>

                <button
                    className={`toggle-label ${yearly ? 'active' : ''}`}
                    onClick={handleYearlyClick}
                    aria-label="Yearly billing"
                >
                    <span className="label-text">Yearly</span>
                    {yearly && (
                        <span className="save-badge">
                            Save {discountPercent}%
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BillingToggle;

