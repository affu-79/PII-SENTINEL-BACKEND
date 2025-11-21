import React from 'react';
import { FiArrowRight, FiX } from 'react-icons/fi';
import './FeatureUpgradeModal.css';

const FEATURE_COPY = {
  upload: {
    title: 'Need more tokens to upload',
    body: 'Uploading files consumes tokens on Starter and Professional plans. Top up tokens or upgrade your plan to continue processing documents without interruptions.'
  },
  lock_json: {
    title: 'Lock JSON is a premium feature',
    body: 'Password-locking exported JSON files is available on the Professional plan and above. Upgrade to secure your exported PIIs with encryption-ready files.'
  },
  unlock_json: {
    title: 'Unlock JSON is a premium feature',
    body: 'Decrypting locked JSON files is reserved for Professional and Enterprise plans. Upgrade to verify encrypted PIIs seamlessly.'
  },
  advanced_analysis: {
    title: 'Advanced Analysis requires an upgrade',
    body: 'Drill-down dashboards, predictive alerts, and premium analytics are unlocked on the Professional plan and above. Upgrade to access the full Analysis Board.'
  }
};

const FeatureUpgradeModal = ({ feature = 'advanced_analysis', description, onClose, onUpgrade }) => {
  const copy = FEATURE_COPY[feature] || FEATURE_COPY.advanced_analysis;
  return (
    <div className="feature-upgrade-modal__backdrop" role="dialog" aria-modal="true">
      <div className="feature-upgrade-modal__card">
        <button className="feature-upgrade-modal__close" onClick={onClose} aria-label="Close">
          <FiX />
        </button>
        <div className="feature-upgrade-modal__icon">
          <FiArrowRight />
        </div>
        <h3 className="feature-upgrade-modal__title">{copy.title}</h3>
        <p className="feature-upgrade-modal__body">{description || copy.body}</p>
        <div className="feature-upgrade-modal__actions">
          <button className="feature-upgrade-modal__btn feature-upgrade-modal__btn-primary" onClick={onUpgrade}>
            Explore plans
            <FiArrowRight />
          </button>
          <button className="feature-upgrade-modal__btn feature-upgrade-modal__btn-secondary" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureUpgradeModal;
