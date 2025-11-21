/**
 * TeamCarousel.jsx
 * Animated carousel that cycles through team members every two seconds.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FiLinkedin, FiMail, FiExternalLink, FiX } from 'react-icons/fi';

const flattenTeam = (nodes = []) =>
  nodes.reduce((acc, node) => {
    acc.push(node);
    if (node.children?.length) {
      acc.push(...flattenTeam(node.children));
    }
    return acc;
  }, []);

const TeamCarousel = ({ data = [], onViewProfile }) => {
  const flattened = useMemo(() => flattenTeam(data), [data]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeMember, setActiveMember] = useState(null);

  useEffect(() => {
    if (!flattened.length) return undefined;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % flattened.length);
    }, 2000);
    return () => clearInterval(id);
  }, [flattened.length]);

  const handleProfileClick = useCallback(
    (member) => {
      setActiveMember(member);
      if (onViewProfile) {
        onViewProfile(member);
      }
    },
    [onViewProfile]
  );

  if (!flattened.length) {
    return null;
  }

  const active = flattened[activeIndex];
  const nextSlides = [1, 2].map((offset) => flattened[(activeIndex + offset) % flattened.length]);

  return (
    <div className="team-carousel">
      <div className="team-carousel-main" data-animate>
        <div className="team-carousel-avatar">
          <img src={active.photo} alt={active.name} loading="lazy" />
        </div>
        <h3 className="team-carousel-name">{active.name}</h3>
        <p className="team-carousel-role">{active.role}</p>
        <p className="team-carousel-bio text-muted">{active.bio}</p>
        <div className="d-flex gap-2 justify-content-center">
          {active.email && (
            <a href={`mailto:${active.email}`} className="team-carousel-action" aria-label={`Email ${active.name}`}>
              <FiMail />
            </a>
          )}
          {active.linkedin && (
            <a
              href={active.linkedin}
              className="team-carousel-action"
              aria-label={`${active.name} on LinkedIn`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FiLinkedin />
            </a>
          )}
          {active.profile && (
            <a
              href={active.profile}
              className="team-carousel-action"
              aria-label={`View ${active.name} external profile`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FiExternalLink />
            </a>
          )}
        </div>
        <button type="button" className="btn btn-outline-primary rounded-pill mt-3" onClick={() => handleProfileClick(active)}>
          View profile
        </button>
      </div>

      <div className="team-carousel-stack">
        {nextSlides.map((member, idx) => (
          <div key={member.id} className={`team-carousel-card offset-${idx}`}>
            <div className="team-carousel-card-avatar">
              <img src={member.photo} alt={member.name} loading="lazy" />
            </div>
            <div className="team-carousel-card-info">
              <h5>{member.name}</h5>
              <p>{member.role}</p>
            </div>
          </div>
        ))}
      </div>

      {activeMember && (
        <div className="team-modal" role="dialog" aria-modal="true" aria-labelledby="teamModalTitle" onClick={() => setActiveMember(null)}>
          <div className="team-modal-content" onClick={(e) => e.stopPropagation()} tabIndex={-1}>
            <button className="team-modal-close" type="button" onClick={() => setActiveMember(null)} aria-label="Close profile modal">
              <FiX />
            </button>
            <div className="d-flex flex-column align-items-center text-center gap-3">
              <img src={activeMember.photo} alt={activeMember.name} className="team-modal-photo" loading="lazy" />
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

TeamCarousel.propTypes = {
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

export default TeamCarousel;
