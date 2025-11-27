/**
 * About.jsx
 * Premium About & Contact experience for PII Sentinel.
 *
 * README:
 *  - Import styles with: `import './About.css';`
 *  - Update image/video assets in about.assets.json and adjust the constants below.
 *  - Replace the fetch stub in handleBackendSubmit with a real /api/contact integration.
 *  - Optional: fetch team structure from /api/team instead of the static config.
 *  - Register the page route: `<Route path="/about" element={<About />} />`
 */
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  FiArrowRight,
  FiTarget,
  FiTrendingUp,
  FiAward,
  FiPhone,
  FiMail,
  FiLinkedin,
  FiInstagram,
  FiMessageCircle,
  FiCalendar,
  FiUsers,
  FiGlobe,
  FiVolumeX,
  FiVolume2,
} from 'react-icons/fi';
import ContactCard from '../components/ContactCard';
import TeamCarousel from '../components/TeamCarousel';
import heroImage from '../assets/afnan.jpeg';
import afnanPortrait from '../assets/afnan.jpeg';
import farhanaPortrait from '../assets/farhana.jpeg';
import adityaPortrait from '../assets/Aditya.jpeg';
import giridharPortrait from '../assets/giridhar.jpeg';
import './About.css';

const ABOUT_COPY = {
  hero: {
    headline: 'About PII Sentinel',
    subheadline: 'Anoryx Tech Solutions Pvt Ltd — PII Sentinel — AI-powered PII detection',
    summary: [
      { label: 'Incorporated', value: 'September 4, 2025' },
      { label: 'Flagship Product', value: 'PII Sentinel Platform' },
      { label: 'Focus', value: 'Enterprise-grade privacy automation & compliance' },
    ],
  },
  companySnapshot: [
    { label: 'Founded', value: 'September 4, 2025', icon: <FiCalendar /> },
    { label: 'Customers', value: 'Global enterprises & partners (growing)', icon: <FiUsers /> },
    { label: 'Headquarters', value: 'Bangalore, India', icon: <FiGlobe /> },
  ],
  missionVisionValues: [
    {
      title: 'Mission',
      description: 'Empower organisations to detect, classify, and safeguard personally identifiable information at scale.',
      icon: <FiTarget />,
    },
    {
      title: 'Vision',
      description: 'Create a privacy-first world where every data workflow is trustworthy, auditable, and compliant by design.',
      icon: <FiTrendingUp />,
    },
    {
      title: 'Values',
      description: 'Integrity, innovation, and measurable impact for customers and their end-users.',
      icon: <FiAward />,
    },
  ],
  team: {
    description: 'Leadership team combining AI, security, finance, and research expertise to power privacy innovation.',
  },
  founderVideo: {
    description: 'Founder Afnan Pasha shares why PII Sentinel was built and how the team is reimagining data privacy automation.',
    quote: '“Privacy is not a compliance checkbox — it is a customer promise. We are here to make that promise effortless for every organisation.”',
    founderName: 'Afnan Pasha',
  },
  timeline: [
    {
      date: 'Sep 2025',
      title: 'Anoryx Tech Solutions incorporated',
      description: 'Company founded to reimagine AI-driven privacy detection with enterprise-grade guardrails.',
    },
    {
      date: 'Jan 2026',
      title: 'PII Sentinel Alpha',
      description: 'First prototype detecting 100+ PII entities across structured and unstructured data sources.',
    },
    {
      date: 'May 2026',
      title: 'Enterprise Partner Program',
      description: 'Onboarded anchor customers in BFSI, healthcare, and telecom with dedicated privacy playbooks.',
    },
    {
      date: 'Dec 2026',
      title: 'Unified Privacy Fabric',
      description: 'Public launch with multi-cloud native deployments, PII redaction, analytics dashboards, and APIs.',
    },
  ],
  pressLogos: ['PrivSec', 'DataGuardian', 'InfosecToday', 'AI Compliance Weekly', 'SecureAI Labs', 'CloudShield'],
  contact: {
    company: 'Anoryx Tech Solutions Pvt Ltd',
    email: 'anoryxtechsolutions@gmail.com',
    phone: '+91 7483314469',
    whatsapp: '+91 9481419480',
    address: 'In front of RT Nagar, Bangalore, Karnataka, India 560032',
    linkedin: 'https://www.linkedin.com/company/anoryx-tech-solutions/?viewAsMember=true',
    instagram: 'https://www.instagram.com/anoryx_tech?igsh=MXUzZHg3ZGszYXE0eA==',
  },
  responseTime: 'We typically respond within 1 business day. Support hours: Monday–Friday, 9:00 – 18:00 IST.',
};

const HERO_IMAGE = heroImage;
const AFNAN_PORTRAIT = afnanPortrait;
const FARHANA_PORTRAIT = farhanaPortrait;
const ADITYA_PORTRAIT = adityaPortrait;
const GIRIDHAR_PORTRAIT = giridharPortrait;
const BASE_VIDEO_URL = 'https://www.youtube.com/embed/IXJ8AcBMbXs?autoplay=1&loop=1&playlist=IXJ8AcBMbXs';

const About = () => {
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const [activeTimeline, setActiveTimeline] = useState(0);
  const timelineRefs = useRef([]);

  const teamData = useMemo(
    () => [
      {
        id: 'ceo',
        name: 'Afnan Pasha',
        role: 'CEO & CTO',
        photo: AFNAN_PORTRAIT,
        bio: 'AI researcher and privacy advocate; leading PII Sentinel’s product vision and technology roadmap.',
        email: 'afnan@anoryxtech.com',
        linkedin: 'https://www.linkedin.com/in/afnanpasha',
        children: [
          {
            id: 'director',
            name: 'Farhana Uneesa',
            role: 'Managing Director',
            photo: FARHANA_PORTRAIT,
            bio: 'Heads operations and customer delivery, ensuring every deployment hits enterprise-grade SLAs.',
            linkedin: 'https://www.linkedin.com',
            children: [
              {
                id: 'cfo',
                name: 'Aditya Sahani',
                role: 'Sales Head & CFO',
                photo: ADITYA_PORTRAIT,
                bio: 'Drives commercial strategy, partnerships, and investor relations for Anoryx Tech.',
                linkedin: 'https://www.linkedin.com',
              },
              {
                id: 'researcher',
                name: 'Giridhar',
                role: 'Lead Researcher',
                photo: GIRIDHAR_PORTRAIT,
                bio: 'Leads applied ML research across NLP, OCR, and multimodal privacy detection.',
                linkedin: 'https://www.linkedin.com',
              },
            ],
          },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    const animated = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    animated.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    timelineRefs.current = timelineRefs.current.slice(0, ABOUT_COPY.timeline.length);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!Number.isNaN(idx)) {
              setActiveTimeline(idx);
            }
          }
        });
      },
      { threshold: 0.6, rootMargin: '-140px 0px -140px 0px' }
    );
    timelineRefs.current.forEach((ref) => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, []);

  const validateForm = useCallback(() => {
    const nextErrors = {};
    if (!contactForm.name.trim()) nextErrors.name = 'Please enter your name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactForm.email)) nextErrors.email = 'Please enter a valid email.';
    if (!contactForm.subject.trim()) nextErrors.subject = 'Subject is required.';
    if (contactForm.message.trim().length < 10) nextErrors.message = 'Message should be at least 10 characters.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [contactForm]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleMailto = useCallback(() => {
    if (!validateForm()) return;
    const { subject, message } = contactForm;
    window.location.href = `mailto:${ABOUT_COPY.contact.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(message)}`;
    showToast('success', 'Mail client opened. We look forward to hearing from you!');
  }, [contactForm, showToast, validateForm]);

  const handleBackendSubmit = useCallback(async () => {
    if (!validateForm()) return;
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      showToast('success', 'Thank you! Our team will reach out shortly.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Contact submission failed', error);
      showToast('error', 'Unable to send message via backend. Please try again or use email/WhatsApp.');
    }
  }, [contactForm, showToast, validateForm]);

  const toggleVideoSound = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const url = new URL(BASE_VIDEO_URL);
    url.searchParams.set('mute', nextMuted ? '1' : '0');
    videoRef.current.src = url.toString();
  }, [isMuted]);

  return (
    <div className="about-page">
      {/* Back to Home Button */}
      <a
        href="/"
        className="about-back-btn"
        title="Back to Home"
        aria-label="Back to Home"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </a>
      <section className="about-hero">
        <div className="about-hero-decor orb-left" aria-hidden="true" />
        <div className="about-hero-decor orb-right" aria-hidden="true" />
        <div className="container position-relative">
          <div className="row align-items-center gx-5 gy-5">
            <div className="col-lg-6 about-hero-content">
              <span className="badge rounded-pill bg-light text-dark mb-3 px-3 py-2 fw-semibold">
                Built in India. Securing global enterprises.
              </span>
              <h1 className="display-4 mb-3">{ABOUT_COPY.hero.headline}</h1>
              <p className="lead mb-4">{ABOUT_COPY.hero.subheadline}</p>
              <div className="d-flex flex-wrap gap-3 mb-4 justify-content-center justify-content-md-start">
                <a href="/signup" className="btn hero-outline-btn" data-animate>
                  Get Started <FiArrowRight className="ms-2" />
                </a>
                <a href="/contact" className="btn hero-outline-btn" data-animate>
                  Request Demo
                </a>
              </div>
              <div className="about-hero-summary animated-element" data-animate>
                <div className="row g-3">
                  {ABOUT_COPY.hero.summary.map((item) => (
                    <div className="col-12 col-md-4" key={item.label}>
                      <p className="text-uppercase small text-white-50 mb-1">{item.label}</p>
                      <h6 className="mb-0">{item.value}</h6>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="about-hero-image" data-animate>
                <div className="hero-orbit" aria-hidden="true">
                  <img src={HERO_IMAGE} alt="PII Sentinel Founder" loading="lazy" />
                </div>
                <div className="hero-watermark" aria-hidden="true">
                  PII Sentinel
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <div className="row g-4">
            {ABOUT_COPY.companySnapshot.map((item) => (
              <div className="col-12 col-md-4" key={item.label}>
                <div className="snapshot-card h-100 animated-element" data-animate>
                  <div className="d-flex align-items-center gap-3">
                    <div className="fs-3 text-primary-emphasis">{item.icon}</div>
                    <div>
                      <p className="text-uppercase text-muted small mb-1">{item.label}</p>
                      <h4 className="mb-0">{item.value}</h4>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="fw-bold" data-animate>Mission, Vision & Values</h2>
            <p className="text-muted mx-auto" style={{ maxWidth: '640px' }}>
              We reimagine how organisations discover and secure sensitive data, combining AI with a relentless focus on measurable privacy outcomes.
            </p>
          </div>
          <div className="row g-4">
            {ABOUT_COPY.missionVisionValues.map((card) => (
              <div className="col-12 col-md-4" key={card.title}>
                <div className="mission-card h-100 animated-element" data-animate>
                  <div className="fs-2 text-primary mb-3">{card.icon}</div>
                  <h4 className="mb-2">{card.title}</h4>
                  <p className="text-muted">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-5 bg-light position-relative overflow-hidden">
        <div className="floating-dots" aria-hidden="true" />
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="fw-bold" data-animate>Our Team</h2>
            <p className="text-muted">{ABOUT_COPY.team.description}</p>
          </div>
          <div data-animate>
            <TeamCarousel data={teamData} onViewProfile={(member) => console.log('Viewing profile:', member.name)} />
          </div>
        </div>
      </section>

      <section className="py-5 quote-section">
        <div className="container">
          <div className="quote-banner animated-element" data-animate>
            <blockquote>
              {ABOUT_COPY.founderVideo.quote}
              <span className="founder-quote-author">— {ABOUT_COPY.founderVideo.founderName}</span>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <div className="row g-5 align-items-start founder-section">
            <div className="col-lg-6">
              <div className="founder-video-wrapper animated-element" data-animate>
                <div className="video-frame mb-3">
                  <iframe
                    ref={videoRef}
                    src={`${BASE_VIDEO_URL}&mute=1`}
                    title="Founder Vision"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    className={`video-sound-toggle ${isMuted ? 'muted' : 'unmuted'}`}
                    onClick={toggleVideoSound}
                    aria-label={isMuted ? 'Unmute founder video' : 'Mute founder video'}
                  >
                    {isMuted ? <FiVolumeX /> : <FiVolume2 />}
                  </button>
                  <div className="video-legend">
                    Founder keynote & product vision
                  </div>
                </div>
                <p className="text-muted">{ABOUT_COPY.founderVideo.description}</p>
                <button type="button" className="btn btn-primary rounded-pill video-play-btn">
                  Play founder video
                </button>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="timeline-stack">
                {ABOUT_COPY.timeline.map((item, idx) => (
                  <div
                    key={item.date}
                    ref={(el) => {
                      timelineRefs.current[idx] = el;
                    }}
                    data-index={idx}
                    className={`timeline-card ${activeTimeline === idx ? 'active' : ''}`}
                  >
                    <h6 className="text-primary text-uppercase small mb-1">{item.date}</h6>
                    <h4 className="mb-2">{item.title}</h4>
                    <p className="text-muted mb-0">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 bg-white">
        <div className="container">
          <div className="text-center mb-4">
            <h5 className="text-uppercase text-muted letter-spacing-1" data-animate>Trusted by innovators</h5>
          </div>
          <div className="row g-4 justify-content-center">
            {ABOUT_COPY.pressLogos.map((logo) => (
              <div className="col-12 col-lg-2 d-flex justify-content-center" key={logo}>
                <div className="press-logo text-center fw-semibold animated-element" data-animate>{logo}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <div className="cta-gradient animated-element" data-animate>
            <div className="row align-items-center gy-3">
              <div className="col-lg-8">
                <h2 className="fw-bold mb-2">Ready to put privacy automation on autopilot?</h2>
                <p className="mb-0">
                  Talk to our sales team or book a live product walkthrough. We tailor onboarding to your data estate.
                </p>
              </div>
              <div className="col-lg-4 d-flex flex-wrap gap-2 justify-content-lg-end">
                <a href="/contact" className="btn cta-action">
                  Talk to Sales
                </a>
                <a href="/demo" className="btn cta-action">
                  Get a Demo
                </a>
                <a href="https://cal.com/" className="btn cta-action" target="_blank" rel="noopener noreferrer">
                  Book a Call
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="fw-bold" data-animate>Contact Us</h2>
            <p className="text-muted mx-auto" style={{ maxWidth: '640px' }}>
              We’d love to partner with you. Please share your goals and we’ll assemble our privacy specialists for a tailored response.
            </p>
          </div>
          <div className="row g-4">
            <div className="col-lg-5">
              <div className="d-flex flex-column gap-3">
                <ContactCard
                  icon={<FiMail />}
                  title="Email"
                  description={ABOUT_COPY.contact.email}
                  actionLabel="Email Us"
                  actionHref={`mailto:${ABOUT_COPY.contact.email}`}
                  variant="primary"
                />
                <ContactCard
                  icon={<FiPhone />}
                  title="Phone"
                  description={ABOUT_COPY.contact.phone}
                  actionLabel="Call Now"
                  actionHref={`tel:${ABOUT_COPY.contact.phone.replace(/\s+/g, '')}`}
                />
                <ContactCard
                  icon={<FiMessageCircle />}
                  title="WhatsApp"
                  description={ABOUT_COPY.contact.whatsapp}
                  actionLabel="Chat on WhatsApp"
                  actionHref="https://wa.me/919481419480"
                />
                <ContactCard
                  icon={<FiLinkedin />}
                  title="LinkedIn"
                  description="Follow our product updates"
                  actionLabel="Visit LinkedIn"
                  actionHref={ABOUT_COPY.contact.linkedin}
                />
                <ContactCard
                  icon={<FiInstagram />}
                  title="Instagram"
                  description="Latest stories & behind the scenes"
                  actionLabel="Visit Instagram"
                  actionHref={ABOUT_COPY.contact.instagram}
                />
                <div className="contact-map-callout animated-element" data-animate>
                  <h5 className="mb-2">Visit our studio</h5>
                  <p className="mb-3 text-muted">
                    We are minutes away from RT Nagar, Bangalore. Schedule a visit to experience PII Sentinel in action.
                  </p>
                  <a
                    className="btn btn-outline-primary rounded-pill"
                    href="https://maps.google.com/?q=Anoryx+Tech+Solutions+Pvt+Ltd+RT+Nagar+Bangalore+560032"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Google Maps
                  </a>
                </div>
                <small className="text-muted">{ABOUT_COPY.responseTime}</small>
              </div>
            </div>
            <div className="col-lg-7">
              <div className="contact-form-card animated-element" data-animate>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleBackendSubmit();
                  }}
                  noValidate
                >
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="contactName" className="form-label">
                        Full Name
                      </label>
                      <input
                        id="contactName"
                        name="name"
                        type="text"
                        className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                        value={contactForm.name}
                        onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                      {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="contactEmail" className="form-label">
                        Work Email
                      </label>
                      <input
                        id="contactEmail"
                        name="email"
                        type="email"
                        className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                        value={contactForm.email}
                        onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                        required
                      />
                      {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                    </div>
                    <div className="col-12">
                      <label htmlFor="contactSubject" className="form-label">
                        Subject
                      </label>
                      <input
                        id="contactSubject"
                        name="subject"
                        type="text"
                        className={`form-control ${errors.subject ? 'is-invalid' : ''}`}
                        value={contactForm.subject}
                        onChange={(e) => setContactForm((prev) => ({ ...prev, subject: e.target.value }))}
                        required
                      />
                      {errors.subject && <div className="invalid-feedback">{errors.subject}</div>}
                    </div>
                    <div className="col-12">
                      <label htmlFor="contactMessage" className="form-label">
                        Message
                      </label>
                      <textarea
                        id="contactMessage"
                        name="message"
                        rows={5}
                        className={`form-control ${errors.message ? 'is-invalid' : ''}`}
                        value={contactForm.message}
                        onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))}
                        required
                      />
                      {errors.message && <div className="invalid-feedback">{errors.message}</div>}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-3 mt-4 contact-actions">
                    <button type="button" className="btn btn-primary rounded-pill contact-action-btn" onClick={handleMailto}>
                      Send Email
                    </button>
                    <button type="submit" className="btn btn-outline-primary rounded-pill contact-action-btn">
                      Send via Backend
                    </button>
                    <a className="btn btn-outline-secondary rounded-pill contact-action-btn" href="tel:+917483314469">
                      Call Us
                    </a>
                    <a className="btn btn-outline-success rounded-pill contact-action-btn" href="https://wa.me/919481419480" target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="text-center footer-cta animated-element" data-animate>
            <h4 className="mb-3">Need an enterprise proof-of-concept?</h4>
            <p className="text-muted mb-3">We’ll co-design a privacy risk workshop with your security and compliance stakeholders.</p>
            <a href="/pricing" className="btn btn-primary rounded-pill">
              Request Enterprise Demo
            </a>
          </div>
        </div>
      </section>

      {toast && (
        <div className="contact-toast" role="status" aria-live="polite">
          <strong className="d-block mb-1 text-capitalize">{toast.type}</strong>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default About;

