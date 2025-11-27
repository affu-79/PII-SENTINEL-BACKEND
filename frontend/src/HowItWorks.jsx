import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiShield, FiArrowRight, FiCpu, FiDatabase, FiSearch, FiActivity,
  FiCheckCircle, FiFileText, FiTrendingUp, FiZap, FiGlobe, FiCode,
  FiEye, FiTarget, FiBarChart, FiSettings, FiDownload, FiBook,
  FiPlay, FiLayers, FiFilter, FiAward, FiRefreshCw, FiLock,
  FiArrowDown, FiArrowUp, FiArrowLeft, FiStar, FiUsers, FiAperture, FiTrendingDown
} from 'react-icons/fi';
import ScrollButton from './components/ScrollButton';
import Footer from './components/Footer';
import './HowItWorks.css';

const HowItWorks = () => {
  const navigate = useNavigate();
  const [visibleSections, setVisibleSections] = useState(new Set());
  const [activeStep, setActiveStep] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1920));
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
          
          // Animate metrics when visible
          if (entry.target.id === 'metrics-section') {
            animateMetrics();
          }
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

  // Watch viewport for responsive flow layout
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isTabletOrMobile = viewportWidth <= 1024;

  const renderFlowNode = (node, index) => (
    <React.Fragment key={`node-${index}`}>
      <div className="flow-node" style={{ animationDelay: `${index * 0.1}s` }}>
        <div className="node-glow" style={{ background: `radial-gradient(circle, ${node.color}40, transparent)` }}></div>
        <div className="node-icon-wrapper" style={{ background: `linear-gradient(135deg, ${node.color}20, ${node.color}10)` }}>
          <div className="node-icon" style={{ color: node.color }}>
            {node.icon}
          </div>
        </div>
        <div className="node-label">{node.label}</div>
        <div className="node-pulse-ring" style={{ borderColor: node.color }}></div>
      </div>
    </React.Fragment>
  );

  const animateMetrics = () => {
    const metrics = [
      { id: 'accuracy', target: 98.7 },
      { id: 'false-positives', target: 2 },
      { id: 'pii-types', target: 36 },
      { id: 'model-loss', target: 27 },
      { id: 'precision', target: 11 },
      { id: 'recall', target: 9 }
    ];

    metrics.forEach((metric) => {
      const element = document.getElementById(metric.id);
      if (element && !element.classList.contains('animated')) {
        element.classList.add('animated');
        const duration = 2000;
        const increment = metric.target / (duration / 16);
        let current = 0;
        
        const updateCounter = () => {
          current += increment;
          if (current < metric.target) {
            if (metric.id === 'accuracy' || metric.id === 'false-positives') {
              element.textContent = current.toFixed(1);
            } else {
              element.textContent = Math.floor(current);
            }
            requestAnimationFrame(updateCounter);
          } else {
            if (metric.id === 'accuracy' || metric.id === 'false-positives') {
              element.textContent = metric.target.toFixed(1);
            } else {
              element.textContent = metric.target;
            }
          }
        };
        
        updateCounter();
      }
    });
  };

  const handleStartScanning = () => {
    navigate('/dashboard');
  };

  const handleExploreArchitecture = () => {
    const architectureSection = document.getElementById('architecture-section');
    if (architectureSection) {
      architectureSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleTryDemo = () => {
    navigate('/dashboard');
  };

  const handleReadDocs = () => {
    navigate('/features');
  };

  const architectureModules = [
    {
      icon: <FiDatabase />,
      title: 'Input & Data Preprocessing',
      description: 'Receives files, extracts content, normalizes formats',
      color: '#667eea',
      delay: '0s'
    },
    {
      icon: <FiEye />,
      title: 'DeepSeek OCR Engine',
      description: 'Advanced OCR extracts text from images and PDFs',
      color: '#764ba2',
      delay: '0.1s'
    },
    {
      icon: <FiSearch />,
      title: 'Pattern Recognition',
      description: 'Regex matching for structured PII patterns',
      color: '#f093fb',
      delay: '0.2s'
    },
    {
      icon: <FiCpu />,
      title: 'AI Classifier',
      description: 'ML models detect unstructured PII with context',
      color: '#4facfe',
      delay: '0.3s'
    },
    {
      icon: <FiBarChart />,
      title: 'Risk Scoring',
      description: 'Calculates confidence and risk levels',
      color: '#43e97b',
      delay: '0.4s'
    },
    {
      icon: <FiFileText />,
      title: 'Output Formatter',
      description: 'Generates structured reports and API responses',
      color: '#f5576c',
      delay: '0.5s'
    }
  ];

  const pipelineSteps = [
    {
      icon: <FiDatabase />,
      title: 'Data Ingestion',
      description: 'Raw text, PDFs, images, or logs are received through API or file upload. Supports multiple formats including DOCX, TXT, CSV, PNG, JPEG, and SVG.',
      color: '#667eea'
    },
    {
      icon: <FiFilter />,
      title: 'Preprocessing',
      description: 'DeepSeek OCR engine extracts textual content from non-text sources. Text normalization, encoding detection, and format standardization occur here.',
      color: '#764ba2'
    },
    {
      icon: <FiSearch />,
      title: 'Hybrid Detection',
      description: 'Pattern-matching engine identifies structured identifiers (Aadhaar, PAN, SSN, etc.), while ML classifiers detect unstructured PII using contextual understanding.',
      color: '#f093fb'
    },
    {
      icon: <FiTarget />,
      title: 'Validation & Scoring',
      description: 'AI verifies matches using linguistic and semantic context. Confidence scores are assigned based on pattern strength and contextual relevance.',
      color: '#4facfe'
    },
    {
      icon: <FiRefreshCw />,
      title: 'Error Correction',
      description: 'False positives reduced using feedback loop and statistical calibration. Adaptive thresholds adjust based on document type and content structure.',
      color: '#43e97b'
    },
    {
      icon: <FiBarChart />,
      title: 'Risk Computation',
      description: 'Generates comprehensive risk scores and structured JSON reports. Visual analytics and compliance-ready documentation are produced automatically.',
      color: '#f5576c'
    }
  ];

  const flowNodes = [
    { icon: <FiDatabase />, label: 'Input', color: '#667eea' },
    { icon: <FiEye />, label: 'OCR', color: '#764ba2' },
    { icon: <FiSearch />, label: 'Regex', color: '#f093fb' },
    { icon: <FiCpu />, label: 'AI Classifier', color: '#4facfe' },
    { icon: <FiBarChart />, label: 'Risk Analyzer', color: '#43e97b' },
    { icon: <FiLock />, label: 'Secure Output', color: '#f5576c' }
  ];

  return (
    <div className="howitworks-page">
      {/* Back to Home Button */}
      <button className="howitworks-back-btn" onClick={() => navigate('/')} title="Back to Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Hero Section */}
      <section 
        id="howitworks-hero"
        ref={el => sectionRefs.current.hero = el}
        className={`howitworks-hero ${visibleSections.has('howitworks-hero') ? 'visible' : ''}`}
      >
        <div className="howitworks-container">
          <div className="hero-content">
            <div className="hero-badge">
              <FiCpu className="badge-icon" />
              <span>AI-Powered Intelligence</span>
            </div>
            <h1 className="hero-title">
              <span className="word-animate">How</span>{' '}
              <span className="word-animate" style={{ animationDelay: '0.1s' }}>PII</span>{' '}
              <span className="word-animate" style={{ animationDelay: '0.2s' }}>Sentinel</span>
              <br />
              <span className="word-animate gradient-text" style={{ animationDelay: '0.3s' }}>
                Understands and Protects Your Data
              </span>
            </h1>
            <p className="hero-subtitle">
              A multi-layer AI pipeline that detects, validates, and secures sensitive information 
              across any file type. Built with precision engineering and layered intelligence.
            </p>
            <div className="hero-buttons">
              <button className="btn-hero-primary" onClick={handleExploreArchitecture}>
                Explore Architecture
                <FiArrowRight className="btn-icon" />
              </button>
              <button className="btn-hero-secondary" onClick={handleStartScanning}>
                Start Scanning Now
                <FiZap className="btn-icon" />
              </button>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="ai-brain">
              <div className="brain-core">
                <FiCpu />
              </div>
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i}
                  className="brain-node"
                  style={{
                    '--angle': `${i * 30}deg`,
                    animationDelay: `${i * 0.1}s`
                  }}
                >
                  <div className="node-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section 
        id="architecture-section"
        ref={el => sectionRefs.current.architecture = el}
        className={`architecture-section ${visibleSections.has('architecture-section') ? 'visible' : ''}`}
      >
        <div className="howitworks-container">
          <div className="section-header">
            <span className="section-badge">
              <FiLayers className="badge-icon" />
              <span>System Architecture</span>
            </span>
            <h2 className="section-title">Our Intelligent Architecture</h2>
            <p className="section-subtitle">
              Every detection starts with precision engineering and layered intelligence. 
              Each module works in harmony to deliver unmatched accuracy.
            </p>
          </div>
          <div className="architecture-flow">
            {architectureModules.map((module, index) => (
              <React.Fragment key={index}>
                <div 
                  className="architecture-module"
                  style={{ animationDelay: module.delay }}
                >
                  <div className="module-icon-wrapper" style={{ background: `linear-gradient(135deg, ${module.color}20, ${module.color}10)` }}>
                    <div className="module-icon" style={{ color: module.color }}>
                      {module.icon}
                    </div>
                  </div>
                  <h3 className="module-title">{module.title}</h3>
                  <p className="module-description">{module.description}</p>
                  <div className="module-number">{index + 1}</div>
                </div>
                {index < architectureModules.length - 1 && (
                  <div className="flow-arrow">
                    <FiArrowRight />
                    <div className="arrow-pulse"></div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Section */}
      <section 
        id="pipeline-section"
        ref={el => sectionRefs.current.pipeline = el}
        className={`pipeline-section ${visibleSections.has('pipeline-section') ? 'visible' : ''}`}
      >
        <div className="howitworks-container">
          <div className="section-header">
            <span className="section-badge">
              <FiActivity className="badge-icon" />
              <span>Detection Pipeline</span>
            </span>
            <h2 className="section-title">From Data to Intelligence — The PII Detection Pipeline</h2>
            <p className="section-subtitle">
              A step-by-step journey through our advanced detection system, 
              from raw input to actionable insights.
            </p>
          </div>
          <div className="pipeline-timeline">
            {pipelineSteps.map((step, index) => (
              <div 
                key={index}
                className={`pipeline-step ${activeStep === index ? 'active' : ''}`}
                onClick={() => setActiveStep(index)}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="step-connector-top"></div>
                <div className="step-content">
                  <div className="step-icon-wrapper" style={{ background: `linear-gradient(135deg, ${step.color}20, ${step.color}10)` }}>
                    <div className="step-icon" style={{ color: step.color }}>
                      {step.icon}
                    </div>
                  </div>
                  <div className="step-number">{index + 1}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">{step.description}</p>
                </div>
                <div className="step-connector-bottom"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pattern Recognition Section */}
      <section 
        id="pattern-section"
        ref={el => sectionRefs.current.pattern = el}
        className={`pattern-section ${visibleSections.has('pattern-section') ? 'visible' : ''}`}
      >
        <div className="howitworks-container">
          <div className="section-header">
            <span className="section-badge">
              <FiTarget className="badge-icon" />
              <span>Pattern Recognition</span>
            </span>
            <h2 className="section-title">Precision Through Pattern Recognition</h2>
            <p className="section-subtitle">
              Regex meets Deep Learning for maximum accuracy. 
              Our hybrid approach ensures both speed and precision.
            </p>
          </div>
          <div className="pattern-grid">
            <div className="pattern-card regex-card">
              <div className="card-header">
                <div className="card-icon-wrapper" style={{ background: 'linear-gradient(135deg, #667eea20, #667eea10)' }}>
                  <FiCode style={{ color: '#667eea' }} />
                </div>
                <h3 className="card-title">Regex Engine</h3>
              </div>
              <div className="card-content">
                <p className="card-description">
                  Pattern templates for structured identifiers including Aadhaar, PAN, SSN, 
                  email, IP addresses, credit cards, and more. Each pattern includes validation 
                  algorithms like Verhoeff checksum and Luhn algorithm.
                </p>
                <div className="code-example">
                  <div className="code-header">
                    <span className="code-label">Example Pattern</span>
                  </div>
                  <pre className="code-block">
                    <code>
{`Aadhaar: /\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}/
PAN: /[A-Z]{5}\\d{4}[A-Z]/
Email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/`}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
            <div className="pattern-card ml-card">
              <div className="card-header">
                <div className="card-icon-wrapper" style={{ background: 'linear-gradient(135deg, #764ba220, #764ba210)' }}>
                  <FiCpu style={{ color: '#764ba2' }} />
                </div>
                <h3 className="card-title">Error Correction Layer</h3>
              </div>
              <div className="card-content">
                <p className="card-description">
                  Advanced post-processing reduces false positives through:
                </p>
                <ul className="feature-list">
                  <li>
                    <FiCheckCircle className="list-icon" />
                    <span>Adaptive thresholds based on document context</span>
                  </li>
                  <li>
                    <FiCheckCircle className="list-icon" />
                    <span>Context re-validation using semantic analysis</span>
                  </li>
                  <li>
                    <FiCheckCircle className="list-icon" />
                    <span>Statistical calibration for confidence scores</span>
                  </li>
                  <li>
                    <FiCheckCircle className="list-icon" />
                    <span>Cross-type duplicate detection and filtering</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div id="metrics-section" className="metrics-display">
            <div className="metric-card">
              <div className="metric-icon">
                <FiAward />
              </div>
              <div className="metric-value">
                <span id="accuracy">0</span>%
              </div>
              <div className="metric-label">Detection Accuracy</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">
                <FiTarget />
              </div>
              <div className="metric-value">
                &lt; <span id="false-positives">0</span>%
              </div>
              <div className="metric-label">False Positives</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">
                <FiLayers />
              </div>
              <div className="metric-value">
                <span id="pii-types">0</span>+
              </div>
              <div className="metric-label">Supported PII Types</div>
            </div>
          </div>
        </div>
      </section>

      {/* Loss Analysis Section */}
      <section 
        id="loss-section"
        ref={el => sectionRefs.current.loss = el}
        className={`loss-section ${visibleSections.has('loss-section') ? 'visible' : ''}`}
      >
        <div className="howitworks-container">
          <div className="row g-4 align-items-center">
            <div className="col-lg-6">
              <div className="animated-data-flow">
                <div className="flow-container">
                  {/* Animated particles flowing */}
                  {[...Array(15)].map((_, i) => (
                    <div 
                      key={i}
                      className="flow-particle"
                      style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: `${3 + Math.random() * 2}s`
                      }}
                    >
                      <div className="particle-core"></div>
                    </div>
                  ))}
                  
                  {/* Data streams */}
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={`stream-${i}`}
                      className="data-stream"
                      style={{
                        left: `${10 + i * 12}%`,
                        animationDelay: `${i * 0.3}s`
                      }}
                    >
                      <div className="stream-line"></div>
                      <div className="stream-pulse"></div>
                    </div>
                  ))}
                  
                  {/* Animated progress rings */}
                  <div className="progress-ring-container">
                    <div className="progress-ring ring-1">
                      <svg className="ring-svg" viewBox="0 0 120 120">
                        <circle className="ring-bg" cx="60" cy="60" r="50"></circle>
                        <circle className="ring-progress" cx="60" cy="60" r="50"></circle>
                      </svg>
                      <div className="ring-content">
                        <FiTrendingUp className="ring-icon" />
                      </div>
                    </div>
                    <div className="progress-ring ring-2">
                      <svg className="ring-svg" viewBox="0 0 120 120">
                        <circle className="ring-bg" cx="60" cy="60" r="50"></circle>
                        <circle className="ring-progress" cx="60" cy="60" r="50"></circle>
                      </svg>
                      <div className="ring-content">
                        <FiActivity className="ring-icon" />
                      </div>
                    </div>
                    <div className="progress-ring ring-3">
                      <svg className="ring-svg" viewBox="0 0 120 120">
                        <circle className="ring-bg" cx="60" cy="60" r="50"></circle>
                        <circle className="ring-progress" cx="60" cy="60" r="50"></circle>
                      </svg>
                      <div className="ring-content">
                        <FiBarChart className="ring-icon" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="loss-content">
                <span className="section-badge">
                  <FiTrendingUp className="badge-icon" />
                  <span>Continuous Learning</span>
                </span>
                <h2 className="section-title">Smarter with Every Scan</h2>
                <p className="section-subtitle">
                  Continuous feedback-driven loss optimization ensures our models 
                  improve with every detection, reducing errors and increasing precision.
                </p>
                <div className="learning-features">
                  <div className="learning-item">
                    <div className="learning-icon">
                      <FiBarChart />
                    </div>
                    <div className="learning-text">
                      <h4>Loss Function</h4>
                      <p>Combines precision and recall penalties using weighted F-beta scoring for balanced optimization.</p>
                    </div>
                  </div>
                  <div className="learning-item">
                    <div className="learning-icon">
                      <FiRefreshCw />
                    </div>
                    <div className="learning-text">
                      <h4>Error Sampling</h4>
                      <p>Misclassified patterns are retrained in micro-batches for incremental model improvement.</p>
                    </div>
                  </div>
                  <div className="learning-item">
                    <div className="learning-icon">
                      <FiActivity />
                    </div>
                    <div className="learning-text">
                      <h4>Active Learning Loop</h4>
                      <p>Integrates validated samples for incremental updates, ensuring continuous model refinement.</p>
                    </div>
                  </div>
                  <div className="learning-item">
                    <div className="learning-icon">
                      <FiTarget />
                    </div>
                    <div className="learning-text">
                      <h4>Performance Tracking</h4>
                      <p>Regular loss reduction through mini-evaluation sets and real-time performance monitoring.</p>
                    </div>
                  </div>
                </div>
                <div className="performance-metrics">
                  <div className="perf-metric">
                    <div className="perf-icon">
                      <FiTrendingDown />
                    </div>
                    <div className="perf-value">
                      <span id="model-loss">0</span>%
                    </div>
                    <div className="perf-label">Model Loss Reduction</div>
                  </div>
                  <div className="perf-metric">
                    <div className="perf-icon">
                      <FiTrendingUp />
                    </div>
                    <div className="perf-value">
                      +<span id="precision">0</span>%
                    </div>
                    <div className="perf-label">Precision Increase</div>
                  </div>
                  <div className="perf-metric">
                    <div className="perf-icon">
                      <FiTrendingUp />
                    </div>
                    <div className="perf-value">
                      +<span id="recall">0</span>%
                    </div>
                    <div className="perf-label">Recall Increase</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Flow Diagram */}
      <section 
        id="flow-section"
        ref={el => sectionRefs.current.flow = el}
        className={`flow-section ${visibleSections.has('flow-section') ? 'visible' : ''}`}
      >
        <div className="howitworks-container">
          <div className="section-header">
            <span className="section-badge">
              <FiGlobe className="badge-icon" />
              <span>System Flow</span>
            </span>
            <h2 className="section-title">How Everything Connects</h2>
            <p className="section-subtitle">
              A seamless flow from input to secure output, 
              with each stage optimized for speed and accuracy.
            </p>
          </div>
          {!isTabletOrMobile && (
            <div className="flow-diagram">
              {flowNodes.map((node, index) => (
                <React.Fragment key={index}>
                  {renderFlowNode(node, index)}
                  {index < flowNodes.length - 1 && (
                    <div className="flow-connector">
                      <div className="connector-line" style={{ background: `linear-gradient(90deg, ${node.color}, ${flowNodes[index + 1].color})` }}></div>
                      <div className="connector-arrow">
                        <FiArrowRight />
                      </div>
                      <div className="connector-pulse"></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {isTabletOrMobile && (
            <div className="flow-grid">
              {[0, 2, 4].map((startIdx, row) => {
                const a = flowNodes[startIdx];
                const b = flowNodes[startIdx + 1];
                const ltr = row % 2 === 0;
                return (
                  <div key={`row-${row}`} className={`flow-row ${ltr ? 'ltr' : 'rtl'}`}>
                    {ltr ? (
                      <>
                        {renderFlowNode(a, startIdx)}
                        <div className="flow-arrow-h"><FiArrowRight /></div>
                        {renderFlowNode(b, startIdx + 1)}
                      </>
                    ) : (
                      <>
                        {renderFlowNode(b, startIdx + 1)}
                        <div className="flow-arrow-h rtl"><FiArrowLeft /></div>
                        {renderFlowNode(a, startIdx)}
                      </>
                    )}
                    {row < 2 && (
                      <div className="flow-arrow-down">
                        <FiArrowDown />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flow-cta">
            <p className="flow-cta-text">Want to explore this pipeline in action?</p>
            <div className="flow-cta-buttons">
              <button className="btn-flow-primary" onClick={handleTryDemo}>
                Try the Demo
                <FiPlay className="btn-icon" />
              </button>
              <button className="btn-flow-secondary" onClick={handleReadDocs}>
                Read the Docs
                <FiBook className="btn-icon" />
              </button>
            </div>
          </div>
        </div>
      </section>
      <ScrollButton />
      <Footer />
    </div>
  );
};

export default HowItWorks;

