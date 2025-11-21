/**
 * TeamTree.jsx
 * Interactive organisational tree for the About page.
 *
 * Desktop layout mirrors the provided sketch with a horizontal tree and SVG connectors.
 * Mobile switches to stacked cards.
 */
import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FiLinkedin, FiMail, FiExternalLink, FiX } from 'react-icons/fi';

export const flattenTeam = (nodes = []) =>
  nodes.reduce((acc, node) => {
    acc.push(node);
    if (node.children?.length) {
      acc.push(...flattenTeam(node.children));
    }
    return acc;
  }, []);

const TeamTree = ({ data = [], onViewProfile }) => {
  const [activeMember, setActiveMember] = useState(null);
  const flattened = useMemo(() => flattenTeam(data), [data]);

  const root = data?.[0];
  const lead = root?.children?.[0];
  const branches = lead?.children || [];

  const closeModal = useCallback(() => setActiveMember(null), []);

  const handleProfileClick = useCallback(
    (member) => {
      setActiveMember(member);
      if (onViewProfile) {
        onViewProfile(member);
      }
    },
    [onViewProfile]
  );

  if (!root) {
    return null;
  }

  return (
    <div className="team-tree">
      <div className="team-tree-horizontal d-none d-lg-block">
        <svg className="team-tree-svg" viewBox="0 0 1000 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
            <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L10,5 L0,10 z" fill="#7C3AED" />
            </marker>
          </defs>
          <path
            d="M220 160 L440 160"
            stroke="url(#connectorGradient)"
            strokeWidth="6"
            fill="none"
            markerEnd="url(#arrowHead)"
            strokeLinecap="round"
          />
          {lead && branches.length > 0 && (
            <>
              <path
                d="M620 160 C 720 110, 800 90, 880 90"
                stroke="url(#connectorGradient)"
                strokeWidth="6"
                fill="none"
                markerEnd="url(#arrowHead)"
                strokeLinecap="round"
              />
              <path
                d="M620 160 C 720 210, 800 230, 880 230"
                stroke="url(#connectorGradient)"
                strokeWidth="6"
                fill="none"
                markerEnd="url(#arrowHead)"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>

        <div className="team-node-wrapper root" data-animate>
          <TeamNode member={root} onProfile={handleProfileClick} />
        </div>

        {lead && (
          <div className="team-node-wrapper lead" data-animate>
            <TeamNode member={lead} onProfile={handleProfileClick} />
          </div>
        )}

        {branches.map((member, index) => (
          <div
            key={member.id}
            className={`team-node-wrapper branch branch-${index}`}
            data-animate
          >
            <TeamNode member={member} onProfile={handleProfileClick} />
          </div>
        ))}
      </div>

      <div className="team-tree-mobile d-lg-none">
        {flattened.map((member) => (
          <div key={member.id} className="team-mobile-card animated-element" data-animate>
            <TeamNode member={member} onProfile={handleProfileClick} stacked />
          </div>
        ))}
      </div>

      {activeMember && (
        <div
          className="team-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="teamModalTitle"
          onClick={closeModal}
        >
          <div
            className="team-modal-content"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <button className="team-modal-close" type="button" onClick={closeModal} aria-label="Close profile modal">
              <FiX />
            </button>
            <div className="d-flex flex-column align-items-center text-center gap-3">
              <img
                src={activeMember.photo}
                alt={activeMember.name}
                className="team-modal-photo"
                loading="lazy"
              />
              <div>
                <h3 id="teamModalTitle" className="team-modal-title">{activeMember.name}</h3>
                <p className="team-modal-role text-muted">{activeMember.role}</p>
              </div>
              <p className="team-modal-bio">{activeMember.bio}</p>
              <div className="d-flex gap-3">
                {activeMember.email && (
                  <a href={`mailto:${activeMember.email}`} className="team-modal-link" aria-label={`Email ${activeMember.name}`}>
                    <FiMail />
                  </a>
                )}
                {activeMember.linkedin && (
                  <a href={activeMember.linkedin} className="team-modal-link" target="_blank" rel="noopener noreferrer" aria-label={`${activeMember.name} on LinkedIn`}>
                    <FiLinkedin />
                  </a>
                )}
                {activeMember.profile && (
                  <a href={activeMember.profile} className="team-modal-link" target="_blank" rel="noopener noreferrer" aria-label={`View ${activeMember.name} external profile`}>
                    <FiExternalLink />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TeamNode = ({ member, onProfile, stacked = false }) => {
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onProfile(member);
    }
  };

  return (
    <div
      className={`team-node ${stacked ? 'team-node-stacked' : ''}`}
      tabIndex={0}
      role="button"
      onClick={() => onProfile(member)}
      onKeyDown={handleKeyPress}
      aria-label={`View profile of ${member.name}`}
    >
      <div className="team-node-avatar">
        <img src={member.photo} alt={member.name} loading="lazy" />
        <div className="team-node-ring" aria-hidden="true" />
      </div>
      <div className="team-node-info">
        <h4>{member.name}</h4>
        <p className="text-muted mb-2">{member.role}</p>
        <button type="button" className="btn btn-sm btn-outline-light rounded-pill view-profile-btn">
          View profile
        </button>
      </div>
    </div>
  );
};

TeamTree.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      photo: PropTypes.string.isRequired,
      bio: PropTypes.string,
      email: PropTypes.string,
      linkedin: PropTypes.string,
      profile: PropTypes.string,
      children: PropTypes.array,
    })
  ),
  onViewProfile: PropTypes.func,
};

TeamNode.propTypes = {
  member: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    role: PropTypes.string.isRequired,
    photo: PropTypes.string.isRequired,
  }).isRequired,
  onProfile: PropTypes.func.isRequired,
  stacked: PropTypes.bool,
};

export default TeamTree;
