import React, { useMemo } from 'react';
import {
  FiFile,
  FiDatabase,
  FiLayers,
  FiFileText,
  FiClock,
  FiTrendingUp,
  FiAlertTriangle,
  FiShield,
  FiCheckCircle,
  FiBarChart2,
  FiLock,
  FiActivity,
  FiCalendar
} from 'react-icons/fi';
import './AnalysisHeader.css';

/**
 * Enterprise-grade Analysis Header
 * Displays batch metrics in a clean, minimal Bootstrap-style layout
 */
const AnalysisHeader = ({ analysis }) => {
  // Extract and format metrics
  const metrics = useMemo(() => {
    if (!analysis) return null;

    const files = analysis.files || [];
    const fileCount = files.length;
    const breakdown = analysis.stats?.breakdown || {};
    const totalPIIs = analysis.stats?.piis || 0;
    const piiTypesCount = Object.keys(breakdown).length;
    const totalPages = files.reduce((sum, f) => sum + (f.page_count || 0), 0);
    const scanDuration = analysis.stats?.scan_duration || 0;
    const avgPIIPerFile = fileCount > 0 ? (totalPIIs / fileCount).toFixed(1) : 0;

    // Find highest risk type
    const sortedTypes = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const highestRiskType = sortedTypes.length > 0 ? sortedTypes[0][0] : 'N/A';
    const mostFrequentType = sortedTypes.length > 0 ? sortedTypes[0][0] : 'N/A';

    // Calculate risk level
    const sensitiveTypes = ['AADHAAR', 'PAN', 'PASSPORT', 'BANK_ACCOUNT', 'IFSC', 'UPI', 'VOTER_ID', 'DRIVING_LICENSE'];
    const sensitivePIICount = Object.entries(breakdown)
      .filter(([type]) => sensitiveTypes.some(st => type.toUpperCase().includes(st)))
      .reduce((sum, [, count]) => sum + count, 0);

    let riskLevel = 'Low';
    let complianceScore = 100;

    if (sensitivePIICount > 50 || totalPIIs > 200) {
      riskLevel = 'High';
      complianceScore = 25;
    } else if (sensitivePIICount > 20 || totalPIIs > 100) {
      riskLevel = 'Medium';
      complianceScore = 60;
    } else {
      riskLevel = 'Low';
      complianceScore = 90;
    }

    // Format date
    const processedDate = analysis.processed_at || analysis.updated_at || analysis.created_at;
    const formattedDate = processedDate
      ? new Date(processedDate).toLocaleString()
      : 'Not processed';

    return {
      fileCount,
      totalPIIs,
      piiTypesCount,
      totalPages,
      scanDuration,
      avgPIIPerFile,
      highestRiskType,
      riskLevel,
      complianceScore,
      mostFrequentType,
      sensitivePIICount,
      batchStatus: analysis.status || 'Completed',
      processedDate: formattedDate
    };
  }, [analysis]);

  if (!analysis || !metrics) {
    return (
      <div className="analysis-header-enterprise">
        <div className="header-loading">Loading batch analysis...</div>
      </div>
    );
  }

  // Define info fields with icons
  const infoFields = [
    {
      icon: <FiFile />,
      label: 'Files Scanned',
      value: metrics.fileCount,
      color: '#667eea'
    },
    {
      icon: <FiDatabase />,
      label: 'Total PIIs Detected',
      value: metrics.totalPIIs,
      color: '#764ba2'
    },
    {
      icon: <FiLayers />,
      label: 'Unique PII Types',
      value: metrics.piiTypesCount,
      color: '#f093fb'
    },
    {
      icon: <FiFileText />,
      label: 'Pages Processed',
      value: metrics.totalPages,
      color: '#4facfe'
    },
    {
      icon: <FiClock />,
      label: 'Scan Duration',
      value: `${metrics.scanDuration}s`,
      color: '#fa709a'
    },
    {
      icon: <FiTrendingUp />,
      label: 'Avg PII Per File',
      value: metrics.avgPIIPerFile,
      color: '#30b0c0'
    },
    {
      icon: <FiAlertTriangle />,
      label: 'Highest Risk Type',
      value: metrics.highestRiskType,
      color: '#ff6b6b'
    },
    {
      icon: <FiShield />,
      label: 'Risk Level',
      value: metrics.riskLevel,
      color: metrics.riskLevel === 'High' ? '#ff6b6b' : metrics.riskLevel === 'Medium' ? '#ffa500' : '#2ed573',
      isRiskBadge: true
    },
    {
      icon: <FiCheckCircle />,
      label: 'Compliance Score',
      value: `${metrics.complianceScore}%`,
      color: '#667eea'
    },
    {
      icon: <FiBarChart2 />,
      label: 'Most Frequent Type',
      value: metrics.mostFrequentType,
      color: '#8884d8'
    },
    {
      icon: <FiLock />,
      label: 'Sensitive PII Count',
      value: metrics.sensitivePIICount,
      color: '#764ba2'
    },
    {
      icon: <FiActivity />,
      label: 'Batch Status',
      value: metrics.batchStatus,
      color: '#667eea'
    },
    {
      icon: <FiCalendar />,
      label: 'Processed Date',
      value: metrics.processedDate,
      color: '#4facfe',
      isDate: true
    }
  ];

  return (
    <div className="analysis-header-enterprise">
      <div className="header-section-title">
        <h2>Analysis Summary</h2>
        <p><span className="batch-name-label">Batch Name : </span>{analysis.batch_name || analysis.name || 'Batch Analysis'}</p>
      </div>

      <div className="header-form-container">
        <div className="info-grid">
          {infoFields.map((field, index) => (
            <div key={index} className="info-field">
              <div className="field-icon" style={{ color: field.color }}>
                {field.icon}
              </div>
              <div className="field-content">
                <label className="field-label">{field.label}</label>
                <div className={`field-value ${field.isRiskBadge ? 'risk-badge' : ''} ${field.isDate ? 'date-value' : ''}`}
                  style={field.isRiskBadge ? { backgroundColor: `${field.color}15`, color: field.color, borderColor: field.color } : {}}>
                  {field.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisHeader;

