import React, { useCallback, useEffect, useRef, useState } from 'react';
import './BillingToggle.css';

const normalizeCycle = (value) => (value === 'yearly' ? 'yearly' : 'monthly');

const BillingToggle = ({ defaultCycle = 'monthly', onBillingChange }) => {
    const [billingCycle, setBillingCycle] = useState(() => normalizeCycle(defaultCycle));
    const hasMountedRef = useRef(false);

    useEffect(() => {
        setBillingCycle(normalizeCycle(defaultCycle));
    }, [defaultCycle]);

    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }
        if (typeof onBillingChange === 'function') {
            onBillingChange(billingCycle);
        }
    }, [billingCycle, onBillingChange]);

    const handleSelect = useCallback((cycle) => {
        setBillingCycle((prev) => (prev === cycle ? prev : cycle));
    }, []);

    const isMonthly = billingCycle === 'monthly';
    const isYearly = billingCycle === 'yearly';

    return (
        <section className="billing-toggle-section" aria-label="Billing cadence selector">
            <div className="billing-toggle-shell" data-cycle={billingCycle}>
                <button
                    type="button"
                    className={`billing-toggle-option ${isMonthly ? 'is-active' : ''}`}
                    onClick={() => handleSelect('monthly')}
                    aria-pressed={isMonthly}
                >
                    <span className="billing-toggle-option__label">Monthly</span>
                </button>

                <button
                    type="button"
                    className={`billing-toggle-option ${isYearly ? 'is-active' : ''}`}
                    onClick={() => handleSelect('yearly')}
                    aria-pressed={isYearly}
                >
                    <span className="billing-toggle-option__label">Yearly</span>
                    <span className="billing-toggle-option__badge">Save 17%</span>
                </button>

                <span className="billing-toggle-slider" aria-hidden="true">
                    <span className="billing-toggle-slider__track" />
                    <span className="billing-toggle-slider__thumb" />
                </span>
            </div>
        </section>
    );
};

export default BillingToggle;

