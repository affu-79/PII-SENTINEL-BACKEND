/**
 * ContactCard.jsx
 * Reusable contact action card component for quick call-to-action buttons.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { FiArrowRight } from 'react-icons/fi';

const ContactCard = ({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  variant = 'primary',
}) => {
  return (
    <div className={`contact-card contact-card-${variant} d-flex align-items-center justify-content-between`} tabIndex={0}>
      <div className="d-flex align-items-start gap-3">
        <div className="contact-card-icon" aria-hidden="true">
          {icon}
        </div>
        <div>
          <h4 className="contact-card-title mb-1">{title}</h4>
          <p className="contact-card-description mb-0 text-muted">{description}</p>
        </div>
      </div>
      <a
        className="contact-card-link btn btn-link fw-semibold"
        href={actionHref}
        target={actionHref?.startsWith('http') ? '_blank' : undefined}
        rel={actionHref?.startsWith('http') ? 'noopener noreferrer' : undefined}
        aria-label={`${actionLabel} (${title})`}
      >
        <span>{actionLabel}</span>
        <FiArrowRight className="ms-2" />
      </a>
    </div>
  );
};

ContactCard.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  actionLabel: PropTypes.string.isRequired,
  actionHref: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline']),
};

export default ContactCard;

