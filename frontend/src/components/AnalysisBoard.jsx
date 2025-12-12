import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { FiBarChart2, FiTrendingUp, FiArrowRight, FiDownload } from 'react-icons/fi';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import { maskFiles, downloadFile, exportPiiJson, getFilePiis, consumeTokenAction } from '../api';
import AnalysisHeader from './AnalysisHeader';
import AdvancedPIIAnalysis from './AdvancedPIIAnalysis';
import FeatureUpgradeModal from './FeatureUpgradeModal';
import './AnalysisBoard.css';

// Hook to detect mobile screen size
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

function AnalysisBoard({ analysis, batchId, tokenAccount, featuresEnabled = {}, onTokensChange }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedPiiType, setSelectedPiiType] = useState(null);
  const [masking, setMasking] = useState(false);
  const [maskType, setMaskType] = useState('blur');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState(null);
  const [selectedPiiCategories, setSelectedPiiCategories] = useState(new Set());
  const [exportJsonLocked, setExportJsonLocked] = useState(false);
  const [exportJsonPassword, setExportJsonPassword] = useState('');
  const [exportJsonShowPassword, setExportJsonShowPassword] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportOnlySelected, setExportOnlySelected] = useState(false);
  const [zippingFiles, setZippingFiles] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const piiPerPage = 20;  // Optimized pagination size
  const [loadedPiis, setLoadedPiis] = useState({}); // Cache for loaded PIIs
  const [loadingPiis, setLoadingPiis] = useState(false); // Flag for loading state

  const features = featuresEnabled || {};
  const canLockJson = !!features.lock_json;
  const canAdvanced = !!features.advanced_analysis;
  const canExportJson = !!features.export_json;

  const getStoredUser = () => {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem('userInfo');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Unable to parse user info for Analysis Board actions', error);
      return null;
    }
  };

  const getTokenSnapshot = () => {
    if (tokenAccount) {
      return tokenAccount;
    }
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem('tokenAccountSnapshot');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Unable to parse token snapshot from storage', error);
      return null;
    }
  };

  const computeTokenBudget = () => {
    const snapshot = getTokenSnapshot();
    const balanceRaw = snapshot?.tokens_balance;
    const isUnlimited = balanceRaw === 'unlimited' || balanceRaw === null || snapshot?.tokens_total === null;
    const balance = isUnlimited ? Infinity : Number(balanceRaw || 0);
    return { snapshot, isUnlimited, balance };
  };

  const openUpgradePrompt = (feature, description) => {
    setUpgradePrompt({ feature, description });
  };

  const refreshTokens = async () => {
    if (typeof onTokensChange === 'function') {
      await onTokensChange();
    }
  };

  useEffect(() => {
    if (!canLockJson) {
      setExportJsonLocked(false);
    }
  }, [canLockJson]);

  // Responsive pie chart dimensions
  const pieChartHeight = isMobile ? 250 : 300;
  const pieChartOuterRadius = isMobile ? 50 : 100;

  // Clear download links when batch changes or analysis is empty
  useEffect(() => {
    // Always clear download links when batch changes
    setDownloadLinks(null);
    // Also clear if analysis is empty
    if (!analysis || !analysis.files || analysis.files.length === 0) {
      setDownloadLinks(null);
    }
  }, [batchId, analysis]);

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [selectedPiiType, selectedPiiCategories]);

  const breakdown = analysis?.stats?.breakdown || {};

  const pieData = useMemo(() => {
    return Object.entries(breakdown).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [breakdown]);

  // Split pie data into two charts if more than 12 types
  const pieData1 = useMemo(() => {
    return pieData.slice(0, 12);
  }, [pieData]);

  const pieData2 = useMemo(() => {
    return pieData.slice(12);
  }, [pieData]);

  // Get all unique PII types for category selection
  const allPiiTypes = useMemo(() => {
    const types = new Set();
    if (analysis?.files) {
      analysis.files.forEach(file => {
        const filePiis = Array.isArray(file.piis) ? file.piis : [];
        filePiis.forEach(pii => {
          if (pii.type) {
            types.add(pii.type);
          }
        });
      });
    }
    // Convert Set to sorted array for easier use
    return Array.from(types).sort();
  }, [analysis]);

  const getPiiCategory = (piiType) => {
    const govRelatedTypes = [
      'AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE',
      'VEHICLE_REG_NO', 'BANK_ACCOUNT_NUMBER', 'CREDIT_CARD_NUMBER',
      'DEBIT_CARD_NUMBER', 'US_SSN', 'ITIN'
    ];
    const customTypes = [
      'APIKEY', 'AUTH_TOKEN', 'JWT', 'PASSWORD', 'SECRET_KEY',
      'PRIVATE_KEY', 'CRYPTO_ADDRESS'
    ];

    if (govRelatedTypes.includes(piiType)) return 'Government ID';
    if (customTypes.includes(piiType)) return 'Secrets & Credentials';
    return 'General PII';
  };

  const filteredPiiDetails = useMemo(() => {
    let details = [];

    // Debug: Log the analysis structure
    if (analysis?.files) {
      console.log('📊 Analysis files:', analysis.files.length);
    } else {
      console.log('⚠️ No analysis.files found');
      console.log('   analysis structure:', analysis);
    }

    if (analysis?.files && Array.isArray(analysis.files)) {
      analysis.files.forEach(file => {
        // Handle both 'piis' and alternative field names
        const filePiis = Array.isArray(file.piis) ? file.piis :
          Array.isArray(file.piiDetails) ? file.piiDetails :
            Array.isArray(file.detected_piis) ? file.detected_piis : [];

        if (filePiis.length > 0) {
          console.log(`  📄 File: ${file.filename || 'unknown'}, PIIs: ${filePiis.length}`);
        }

        filePiis.forEach(pii => {
          if (pii && pii.type && pii.value !== undefined) {
            details.push({
              type: pii.type || 'UNKNOWN',
              value: pii.value || pii.match || pii.normalized || 'N/A',
              filename: file.filename || 'unknown',
              page: pii.page !== undefined ? pii.page : 0,
              confidence: pii.confidence || 0.9
            });
          }
        });
      });
    }

    console.log(`📊 Filtered PIIs before type/category filtering: ${details.length}`);

    if (selectedPiiType) {
      details = details.filter(pii => pii.type === selectedPiiType);
      console.log(`  Filtered by type ${selectedPiiType}: ${details.length}`);
    }

    // Filter by selected PII types (not categories)
    if (selectedPiiCategories.size > 0) {
      details = details.filter(pii => selectedPiiCategories.has(pii.type));
      console.log(`  Filtered by selected types: ${details.length}`);
      console.log(`  Selected types:`, Array.from(selectedPiiCategories));
    }

    console.log(`✅ Final filtered PIIs: ${details.length}`);
    return details;
  }, [analysis, selectedPiiType, selectedPiiCategories]);

  // barData for chart
  const barData = useMemo(() => {
    return Object.entries(breakdown).map(([name, value]) => ({
      name: name.length > 20 ? name.substring(0, 20) + '...' : name,
      fullName: name,
      count: value
    })).sort((a, b) => b.count - a.count);
  }, [breakdown]);

  // Risk Analysis
  const riskAnalysis = useMemo(() => {
    const riskWeights = {
      'AADHAAR': 10, 'PAN': 10, 'PASSPORT': 10, 'VOTER_ID': 9, 'DRIVING_LICENSE': 9,
      'BANK_ACCOUNT': 8, 'CARD_NUMBER': 8, 'IFSC': 7, 'UPI': 7, 'CVV': 9, 'CARD_EXPIRY': 6,
      'PHONE': 6, 'EMAIL': 5, 'DOB': 6, 'ADDRESS': 4,
      'EMPLOYEE_ID': 5, 'CUSTOMER_ID': 5, 'MEDICAL_RECORD_ID': 8, 'INSURANCE_POLICY_NO': 7,
      'TAX_RECORD': 6, 'TRANSACTION_ID': 4, 'ORDER_ID': 3,
      'STUDENT_ROLL': 3, 'MEMBERSHIP_ID': 3, 'PROJECT_CODE': 2, 'REFERRAL_CODE': 2,
      'VEHICLE_REG_NO': 4, 'LICENSE_KEY': 5, 'DEVICE_ID': 3, 'SESSION_TOKEN': 4,
      'SALARY': 5, 'GPS': 3,
      'IPV4': 2, 'IPV6': 2, 'MAC': 2, 'IMEI': 4, 'API_KEY': 7, 'USERNAME': 3, 'PASSWORD': 8
    };

    let totalRiskScore = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    const riskByType = {};

    Object.entries(breakdown).forEach(([type, count]) => {
      const typeUpper = type.toUpperCase();
      const weight = riskWeights[typeUpper] || 3;
      const typeRisk = weight * count;
      totalRiskScore += typeRisk;
      riskByType[type] = { count, weight, risk: typeRisk };

      if (weight >= 8) criticalCount += count;
      else if (weight >= 6) highCount += count;
      else if (weight >= 4) mediumCount += count;
      else lowCount += count;
    });

    const maxPossibleRisk = Object.values(breakdown).reduce((sum, count) => sum + count, 0) * 10;
    const riskPercentage = maxPossibleRisk > 0 ? (totalRiskScore / maxPossibleRisk) * 100 : 0;

    let riskLevel = 'LOW';
    let riskColor = '#00C49F';
    if (riskPercentage >= 70) {
      riskLevel = 'CRITICAL';
      riskColor = '#FF0042';
    } else if (riskPercentage >= 50) {
      riskLevel = 'HIGH';
      riskColor = '#FF8042';
    } else if (riskPercentage >= 30) {
      riskLevel = 'MEDIUM';
      riskColor = '#FFBB28';
    }

    const recommendations = [];
    if (criticalCount > 0) {
      recommendations.push(`Immediate action required: ${criticalCount} critical PIIs detected`);
    }
    if (highCount > 10) {
      recommendations.push(`High volume of sensitive data: Consider encryption at rest`);
    }
    if (riskPercentage >= 50) {
      recommendations.push(`High risk score: Review data retention policies`);
    }
    if (Object.keys(breakdown).length > 15) {
      recommendations.push(`Multiple PII types: Implement comprehensive data governance`);
    }

    return {
      totalRiskScore: Math.round(totalRiskScore),
      riskPercentage: Math.round(riskPercentage * 10) / 10,
      riskLevel,
      riskColor,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      riskByType: Object.entries(riskByType)
        .sort((a, b) => b[1].risk - a[1].risk)
        .slice(0, 10),
      recommendations
    };
  }, [breakdown]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredPiiDetails.length / piiPerPage);
  const paginatedPiiDetails = useMemo(() => {
    const startIndex = (currentPage - 1) * piiPerPage;
    const endIndex = startIndex + piiPerPage;
    return filteredPiiDetails.slice(startIndex, endIndex);
  }, [filteredPiiDetails, currentPage, piiPerPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  // --- END PAGINATION LOGIC ---

  const handlePiiTypeClick = (piiType) => {
    setSelectedPiiType(prev => (prev === piiType ? null : piiType));
  };

  // Initialize selected categories with all PII types by default
  useEffect(() => {
    if (allPiiTypes.length > 0 && selectedPiiCategories.size === 0) {
      setSelectedPiiCategories(new Set(allPiiTypes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPiiTypes]);

  const togglePiiCategory = (category) => {
    setSelectedPiiCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const selectAllPiiCategories = () => {
    if (!allPiiTypes || allPiiTypes.length === 0) {
      return;
    }
    setSelectedPiiCategories(new Set(allPiiTypes));
  };

  const handleMask = async () => {
    if (maskType === 'hash' && !password) {
      alert('Password is required for hash masking');
      return;
    }

    if (selectedPiiCategories.size === 0) {
      alert('Please select at least one PII category to mask');
      return;
    }

    // Clear any existing download links before masking
    setDownloadLinks(null);

    setMasking(true);
    try {
      const selectedTypes = Array.from(selectedPiiCategories);
      const response = await maskFiles(null, maskType, password || null, batchId, selectedTypes);
      setDownloadLinks(response);
      alert('Masking completed! Click download links to get masked files.');
    } catch (error) {
      console.error('Error masking files:', error);
      alert('Masking failed: ' + (error.response?.data?.error || error.message));
      setDownloadLinks(null); // Clear on error
    } finally {
      setMasking(false);
    }
  };

  const handleDownload = async (url) => {
    const user = getStoredUser();
    if (!user?.email) {
      alert('Please sign in to download masked files.');
      navigate('/signup');
      return;
    }

    // Check tokens before downloading
    let { snapshot, isUnlimited, balance } = computeTokenBudget();
    if (!snapshot) {
      await refreshTokens();
      ({ snapshot, isUnlimited, balance } = computeTokenBudget());
    }

    const requiredTokens = 5;
    if (!isUnlimited && balance < requiredTokens) {
      openUpgradePrompt(
        'download_masked',
        `Downloading a masked file costs ${requiredTokens} tokens. You currently have ${balance} token${balance === 1 ? '' : 's'} remaining.`
      );
      return;
    }

    try {
      // FIRST: Try to download the file
      const path = url.replace('/api/download?path=', '');
      const blob = await downloadFile(path);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = path.split('/').pop() || 'masked_file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      // SUCCESS: Download worked, now track token usage (even for unlimited)
      try {
        await consumeTokenAction({
          action: 'download_masked_file',
          userEmail: user.email,
          metadata: {
            batch_id: batchId,
            file_url: url
          }
        });
        await refreshTokens();
      } catch (error) {
        console.error('Token tracking failed after successful download', error);
        // Don't fail the operation - user already got the file
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Download failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setToastMessage('');
    }, 5000);
  };

  const handleDownloadAll = async () => {
    if (!downloadLinks || !downloadLinks.download_urls) return;

    const user = getStoredUser();
    if (!user?.email) {
      alert('Please sign in to download masked files.');
      navigate('/signup');
      return;
    }

    const totalFiles = downloadLinks.download_urls.length;
    const tokensPerFile = 5;
    const totalTokensRequired = totalFiles * tokensPerFile;

    // Check tokens before downloading
    let { snapshot, isUnlimited, balance } = computeTokenBudget();
    if (!snapshot) {
      await refreshTokens();
      ({ snapshot, isUnlimited, balance } = computeTokenBudget());
    }

    if (!isUnlimited && balance < totalTokensRequired) {
      openUpgradePrompt(
        'download_masked',
        `Downloading all ${totalFiles} masked files costs ${totalTokensRequired} tokens (${tokensPerFile} tokens per file). You currently have ${balance} token${balance === 1 ? '' : 's'} remaining.`
      );
      return;
    }

    setZippingFiles(true);
    setZipProgress('Preparing zip...');

    try {
      // FIRST: Try to download all files and create zip
      const zip = new JSZip();
      let completed = 0;

      // Download all files and add to zip
      for (let idx = 0; idx < downloadLinks.download_urls.length; idx++) {
        const url = downloadLinks.download_urls[idx];
        const fileInfo = downloadLinks.file_info?.[idx];
        const fileName = fileInfo?.descriptive_name ||
          fileInfo?.original_filename ||
          `masked_file_${idx + 1}`;

        setZipProgress(`Downloading file ${idx + 1} of ${totalFiles}...`);

        try {
          const path = url.replace('/api/download?path=', '');
          const blob = await downloadFile(path);
          zip.file(fileName, blob);
          completed++;
        } catch (error) {
          console.error(`Error downloading file ${idx + 1}:`, error);
          // Continue with other files even if one fails
        }
      }

      setZipProgress('Creating zip archive...');

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        if (metadata.percent) {
          setZipProgress(`Creating zip... ${Math.round(metadata.percent)}%`);
        }
      });

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const zipFileName = `masked_files_${timestamp}.zip`;

      // Download the zip file
      saveAs(zipBlob, zipFileName);

      // SUCCESS: Zip created and downloaded, now track token usage (even for unlimited)
      try {
        // Track tokens for all files
        for (let i = 0; i < totalFiles; i++) {
          await consumeTokenAction({
            action: 'download_masked_file',
            userEmail: user.email,
            metadata: {
              batch_id: batchId,
              file_index: i + 1,
              total_files: totalFiles
            }
          });
        }
        await refreshTokens();
      } catch (error) {
        console.error('Token tracking failed after successful download all', error);
        // Don't fail the operation - user already got the files
      }

      setZippingFiles(false);
      setZipProgress('');

      // Show success toast
      showToastMessage(`✅ All ${totalFiles} masked files have been zipped and downloaded. You can extract them to view all masked results.`);
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Failed to create zip: ' + (error.message || 'Unknown error'));
      setZippingFiles(false);
      setZipProgress('');
    }
  };

  const handleExportJson = async () => {
    if (exportJsonLocked && !exportJsonPassword) {
      alert('Password is required when locking JSON file');
      return;
    }

    if (exportOnlySelected && selectedPiiCategories.size === 0) {
      alert('Please select at least one PII category when "Export only selected" is enabled');
      return;
    }

    const selectedTypes = exportOnlySelected ? Array.from(selectedPiiCategories) : [];

    setExportingJson(true);
    try {
      // Check if locked export is requested
      if (exportJsonLocked) {
        if (!canLockJson) {
          setExportingJson(false);
          openUpgradePrompt('lock_json', 'Locking JSON exports is available on the Professional plan and above. Upgrade to secure exported PIIs with encrypted files.');
          return;
        }

        let { snapshot, isUnlimited, balance } = computeTokenBudget();
        if (!snapshot) {
          await refreshTokens();
          ({ snapshot, isUnlimited, balance } = computeTokenBudget());
        }

        const requiredTokens = 50;
        if (!isUnlimited && balance < requiredTokens) {
          setExportingJson(false);
          openUpgradePrompt(
            'lock_json',
            `Locking a JSON file costs ${requiredTokens} tokens. You currently have ${balance} token${balance === 1 ? '' : 's'} remaining.`
          );
          return;
        }

        const user = getStoredUser();
        if (!user?.email) {
          setExportingJson(false);
          alert('Please sign in to export locked JSON files.');
          navigate('/signup');
          return;
        }

        // Don't deduct tokens yet - wait until export succeeds
      }

      // FIRST: Try to export the JSON
      const response = await exportPiiJson(
        batchId,
        selectedTypes,
        exportJsonLocked ? exportJsonPassword : null,
        exportJsonLocked
      );

      // SUCCESS: Export worked, now download it
      // For encrypted files, save only the 'data' field; for unencrypted, save the 'data' field as well
      const dataToSave = response.encrypted ? response.data : response.data;
      const jsonString = JSON.stringify(dataToSave || {}, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = exportJsonLocked ? `locked_pii_${timestamp}.json` : `pii_export_${timestamp}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // SUCCESS: Now deduct tokens for locked export (track usage even for unlimited)
      if (exportJsonLocked) {
        const user = getStoredUser();
        console.log('🔍 Attempting to track lock_json token usage for user:', user?.email);

        if (user?.email) {
          try {
            console.log('📊 Calling consumeTokenAction for lock_json (50 tokens)');
            const tokenResult = await consumeTokenAction({
              action: 'lock_json',
              userEmail: user.email,
              metadata: {
                batch_id: batchId,
                pii_types: selectedTypes,
                export_only_selected: exportOnlySelected
              }
            });
            console.log('✅ Token tracking successful:', tokenResult);
            await refreshTokens();
            console.log('✅ Token balance refreshed');
          } catch (error) {
            console.error('❌ Token tracking failed after successful lock_json export:', error);
            console.error('   Error details:', error.response?.data || error.message);
            // Don't fail the operation - user already got the file
          }
        } else {
          console.warn('⚠️ User email not found, skipping token tracking');
        }
      }

      showToastMessage('✅ JSON export is ready. Download the file from the section below.');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON: ' + (error.response?.data?.error || error.message));
      setDownloadLinks(null);
    } finally {
      setExportingJson(false);
    }
  };

  return (
    <div className="analysis-board">
      {/* Analysis Board Title Section */}
      <div className="analysis-board-title-section">
        <div className="analysis-board-title-content">
          <div className="analysis-board-icon">
            <FiBarChart2 />
          </div>
          <div className="analysis-board-text">
            <h2 className="analysis-board-title">Analysis Board</h2>
            <p className="analysis-board-subtitle">Comprehensive PII detection and visualization</p>
          </div>
        </div>
      </div>

      {/* Advanced Analysis Section */}
      {canAdvanced ? (
        <AdvancedPIIAnalysis analysis={analysis} batchId={batchId} />
      ) : (
        <div className="analysis-upgrade-callout">
          <div className="analysis-upgrade-callout__glow" aria-hidden="true" />
          <div className="analysis-upgrade-callout__content">
            <div className="analysis-upgrade-callout__icon">
              <FiTrendingUp />
            </div>
            <div className="analysis-upgrade-callout__copy">
              <h3>Unlock Advanced Analysis</h3>
              <p>
                Upgrade to the <strong>Professional</strong> plan to access predictive dashboards, deeper risk scoring, and JSON automation.
              </p>
            </div>
          </div>
          <button
            className="analysis-upgrade-callout__button"
            onClick={() => navigate('/pricing')}
          >
            <span>Explore plans</span>
            <FiArrowRight />
          </button>
        </div>
      )}

      <div className="charts-container">
        {/* Pie Charts - Split into two if more than 12 types */}
        <div className="chart-section pie-chart-section">
          <h3>PII Type Distribution {pieData.length > 12 && `(Top 12)`}</h3>

          {/* Legend above pie chart - Only on mobile */}
          {isMobile && (
            <div className="pie-chart-legend">
              {pieData1.map((entry, index) => {
                const percentage = ((entry.value / pieData1.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1);
                return (
                  <div
                    key={`legend-${index}`}
                    className={`legend-item ${selectedPiiType && selectedPiiType !== entry.name ? 'dimmed' : ''}`}
                    onClick={() => handlePiiTypeClick(entry.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div
                      className="legend-color"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="legend-name">{entry.name}</span>
                    <span className="legend-value">{entry.value} ({percentage}%)</span>
                  </div>
                );
              })}
            </div>
          )}

          <ResponsiveContainer width="100%" height={pieChartHeight}>
            <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Pie
                data={pieData1}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={!isMobile ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
                outerRadius={pieChartOuterRadius}
                fill="#8884d8"
                dataKey="value"
                onClick={(data, index) => {
                  if (data && data.name) {
                    handlePiiTypeClick(data.name);
                  }
                }}
              >
                {pieData1.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    style={{
                      cursor: 'pointer',
                      opacity: selectedPiiType && selectedPiiType !== entry.name ? 0.3 : 1
                    }}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Second Pie Chart for remaining types */}
        {pieData2.length > 0 && (
          <div className="chart-section pie-chart-section">
            <h3>PII Type Distribution (Remaining {pieData2.length} Types)</h3>

            {/* Legend above pie chart - Only on mobile */}
            {isMobile && (
              <div className="pie-chart-legend">
                {pieData2.map((entry, index) => {
                  const totalValue = pieData2.reduce((sum, item) => sum + item.value, 0);
                  const percentage = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : 0;
                  return (
                    <div
                      key={`legend2-${index}`}
                      className={`legend-item ${selectedPiiType && selectedPiiType !== entry.name ? 'dimmed' : ''}`}
                      onClick={() => handlePiiTypeClick(entry.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="legend-color"
                        style={{ backgroundColor: COLORS[(index + 12) % COLORS.length] }}
                      />
                      <span className="legend-name">{entry.name}</span>
                      <span className="legend-value">{entry.value} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            )}

            <ResponsiveContainer width="100%" height={pieChartHeight}>
              <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Pie
                  data={pieData2}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={!isMobile ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
                  outerRadius={pieChartOuterRadius}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(data, index) => {
                    if (data && data.name) {
                      handlePiiTypeClick(data.name);
                    }
                  }}
                >
                  {pieData2.map((entry, index) => (
                    <Cell
                      key={`cell2-${index}`}
                      fill={COLORS[(index + 12) % COLORS.length]}
                      style={{
                        cursor: 'pointer',
                        opacity: selectedPiiType && selectedPiiType !== entry.name ? 0.3 : 1
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar Chart - Horizontally scrollable when more than 10 types */}
        <div className={`chart-section bar-chart-section ${pieData2.length > 0 ? 'bar-chart-full-width' : ''}`}>
          <h3>Top PII Types (Count)</h3>
          <div className={`bar-chart-scrollable ${barData.length > 10 ? 'has-scroll' : ''}`}>
            <ResponsiveContainer width="100%" height={300} minWidth={barData.length > 10 ? Math.max(600, barData.length * 60) : '100%'}>
              <BarChart data={barData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [value, 'Count']}
                  labelFormatter={(label) => {
                    const fullName = barData.find(b => b.name === label)?.fullName || label;
                    return fullName;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="count"
                  fill="#8884d8"
                  onClick={(data, index) => {
                    if (data && data.fullName) {
                      handlePiiTypeClick(data.fullName);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* PII Risk Score & Compliance Analysis */}
      <div className="risk-analysis-section">
        <h3>PII Risk Score & Compliance Analysis</h3>
        <div className="risk-analysis-grid">
          <div className="risk-score-card">
            <div className="risk-score-header">
              <h4>Overall Risk Score</h4>
              <div
                className="risk-level-badge"
                style={{ backgroundColor: riskAnalysis.riskColor }}
              >
                {riskAnalysis.riskLevel}
              </div>
            </div>
            <div className="risk-score-value" style={{ color: riskAnalysis.riskColor }}>
              {riskAnalysis.riskPercentage}%
            </div>
            <div className="risk-score-details">
              <div className="risk-detail-item">
                <span className="risk-label">Total Risk Points:</span>
                <span className="risk-value">{riskAnalysis.totalRiskScore}</span>
              </div>
            </div>
          </div>

          <div className="risk-breakdown-card">
            <h4>Risk Breakdown by Category</h4>
            <div className="risk-breakdown-list">
              <div className="risk-category-item">
                <span className="risk-category-label">Critical PIIs:</span>
                <span className="risk-category-count critical">{riskAnalysis.criticalCount}</span>
              </div>
              <div className="risk-category-item">
                <span className="risk-category-label">High Risk PIIs:</span>
                <span className="risk-category-count high">{riskAnalysis.highCount}</span>
              </div>
              <div className="risk-category-item">
                <span className="risk-category-label">Medium Risk PIIs:</span>
                <span className="risk-category-count medium">{riskAnalysis.mediumCount}</span>
              </div>
              <div className="risk-category-item">
                <span className="risk-category-label">Low Risk PIIs:</span>
                <span className="risk-category-count low">{riskAnalysis.lowCount}</span>
              </div>
            </div>
          </div>

          <div className="risk-recommendations-card">
            <h4>Compliance Recommendations</h4>
            {riskAnalysis.recommendations.length > 0 ? (
              <ul className="recommendations-list">
                {riskAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            ) : (
              <p className="no-recommendations">No immediate action required. Risk level is manageable.</p>
            )}
          </div>

          <div className="top-risk-types-card">
            <h4>Top 10 Highest Risk PII Types</h4>
            <div className="risk-types-list">
              {riskAnalysis.riskByType.map(([type, data], idx) => (
                <div key={idx} className="risk-type-item">
                  <span className="risk-type-name">{type}</span>
                  <div className="risk-type-details">
                    <span className="risk-type-count">{data.count} instances</span>
                    <span className="risk-type-points">({data.risk} pts)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="masking-section">
        <h3>Apply Masking to Batch</h3>

        {/* PII Category Selection */}
        {allPiiTypes && allPiiTypes.length > 0 && (
          <div className="pii-category-selection">
            <div className="pii-category-header">
              <div className="pii-category-title">
                <span className="pii-category-icon">🏷️</span>
                <h4>Select PII Categories to Mask:</h4>
              </div>
              <button
                type="button"
                className="pii-select-all"
                onClick={selectAllPiiCategories}
              >
                <span className="pii-select-all__wave" aria-hidden="true" />
                <span className="pii-select-all__label">Select all PII types</span>
              </button>
            </div>
            <div className="pii-category-pills">
              {allPiiTypes.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`pii-category-pill ${selectedPiiCategories.has(category) ? 'selected' : ''}`}
                  onClick={() => togglePiiCategory(category)}
                  title={`${selectedPiiCategories.has(category) ? 'Deselect' : 'Select'} ${category}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="pii-selection-hint">
              {selectedPiiCategories.size === 0
                ? 'ℹ️ Please select at least one category'
                : `ℹ️ ${selectedPiiCategories.size} of ${allPiiTypes.length} categories selected`}
            </p>
          </div>
        )}

        <div className="mask-options">
          <label>
            <input
              type="radio"
              value="blur"
              checked={maskType === 'blur'}
              onChange={(e) => setMaskType(e.target.value)}
            />
            Blur
          </label>
          <label>
            <input
              type="radio"
              value="hash"
              checked={maskType === 'hash'}
              onChange={(e) => setMaskType(e.target.value)}
            />
            Hash (Encrypted)
          </label>
        </div>
        {maskType === 'hash' && (
          <div className="password-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password for encryption"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="password-input"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
        )}
        <button
          className="btn-primary"
          onClick={handleMask}
          disabled={masking || selectedPiiCategories.size === 0}
        >
          {masking ? 'Masking...' : 'Apply Masking'}
        </button>

        {/* Export PII to JSON Section */}
        {canExportJson ? (
          <div className="export-json-section">
            <h4>📥 Export PIIs to JSON File</h4>
            <p className="export-json-description">
              Download PIIs in a JSON file with key-value pairs, optionally filtered by type
            </p>

            <div className="export-json-options">
              {/* New Toggle: Export Only Selected PII Types */}
              <div className="export-filter-toggle-wrapper">
                <label className="export-filter-label">
                  <span className="filter-icon">🎯</span>
                  <span>Export Only Selected PII Types</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={exportOnlySelected}
                      onChange={(e) => setExportOnlySelected(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <p className="filter-hint">
                  {exportOnlySelected
                    ? `${selectedPiiCategories.size} type(s) selected for export`
                    : 'All PII types will be exported'}
                </p>
              </div>

              <div className={`lock-toggle-wrapper ${!canLockJson ? 'feature-disabled' : ''}`}>
                <label className="lock-toggle-label">
                  <span>Lock JSON file with password</span>
                  {!canLockJson && (
                    <span className="feature-badge">Pro/Enterprise</span>
                  )}
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={exportJsonLocked}
                      disabled={!canLockJson}
                      onChange={(e) => {
                        if (!canLockJson) {
                          openUpgradePrompt('lock_json', 'Locking JSON exports is available on the Professional plan and above. Upgrade to secure exported PIIs.');
                          return;
                        }
                        setExportJsonLocked(e.target.checked);
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>

              {exportJsonLocked && (
                <div className="password-input-wrapper">
                  <input
                    type={exportJsonShowPassword ? "text" : "password"}
                    placeholder="Enter password to lock JSON file"
                    value={exportJsonPassword}
                    onChange={(e) => setExportJsonPassword(e.target.value)}
                    className="password-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setExportJsonShowPassword(!exportJsonShowPassword)}
                    title={exportJsonShowPassword ? "Hide password" : "Show password"}
                  >
                    {exportJsonShowPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              )}

              <button
                className="btn-primary btn-export-json"
                onClick={handleExportJson}
                disabled={exportingJson || (exportOnlySelected && selectedPiiCategories.size === 0)}
              >
                {exportingJson ? 'Exporting...' : 'Download JSON File'}
              </button>
            </div>
          </div>
        ) : (
          <div className="analysis-upgrade-callout">
            <div className="analysis-upgrade-callout__glow" aria-hidden="true" />
            <div className="analysis-upgrade-callout__content">
              <div className="analysis-upgrade-callout__icon">
                <FiDownload />
              </div>
              <div className="analysis-upgrade-callout__copy">
                <h3>Unlock JSON Export</h3>
                <p>Export detected PIIs to JSON files with advanced filtering and encryption options. Available on Professional and Enterprise plans.</p>
              </div>
              <button
                className="analysis-upgrade-callout__button"
                onClick={() => openUpgradePrompt('export_json', 'JSON export with filtering and encryption is available on the Professional plan and above. Upgrade to download PIIs in structured JSON format.')}
              >
                <span>Upgrade to Pro</span>
                <FiArrowRight />
              </button>
            </div>
          </div>
        )}

        {downloadLinks && analysis && analysis.files && analysis.files.length > 0 && (
          <div className="download-section">
            <h4>Download Masked Files</h4>
            {downloadLinks.format === 'zip' ? (
              <button
                className="btn-download"
                onClick={() => handleDownload(downloadLinks.download_url)}
                title={`ZIP file containing ${downloadLinks.file_count} masked files (${downloadLinks.mask_type || 'blurred'})`}
              >
                Download ZIP ({downloadLinks.file_count} files)
              </button>
            ) : (
              <>
                <div className="download-links" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Show only first 5 files */}
                  {downloadLinks.download_urls?.slice(0, 5).map((url, idx) => {
                    // Get file info for tooltip
                    const fileInfo = downloadLinks.file_info?.[idx];
                    const tooltipText = fileInfo?.descriptive_name ||
                      fileInfo?.original_filename ||
                      `masked-${downloadLinks.mask_type || 'blurred'}-file-${idx + 1}`;

                    return (
                      <button
                        key={idx}
                        className="btn-download"
                        onClick={() => handleDownload(url)}
                        title={tooltipText}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: '#e8e8e8',
                          color: '#333',
                          border: '1px solid #ccc',
                          borderRadius: '25px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          width: 'auto'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#d8d8d8';
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#e8e8e8';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        Download File {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {/* Show message if more than 5 files */}
                {downloadLinks.download_urls && downloadLinks.download_urls.length > 5 && (
                  <div className="remaining-files-message" style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '2px dashed #6c757d',
                    textAlign: 'center',
                    animation: 'fadeIn 0.5s ease-in'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>
                      <span style={{
                        display: 'inline-block',
                        animation: 'pulse 2s infinite'
                      }}>📦</span>
                    </div>
                    <p style={{ margin: 0, color: '#495057', fontWeight: '500' }}>
                      {downloadLinks.download_urls.length - 5} more file{downloadLinks.download_urls.length - 5 > 1 ? 's' : ''} available.
                      Use "Download All Masked Files" button below to get all files in a single zip archive.
                    </p>
                  </div>
                )}

                {/* Download All Button */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                  <button
                    className="btn-download btn-download-all"
                    onClick={handleDownloadAll}
                    disabled={zippingFiles}
                    title="Download all masked files as a zip archive"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      padding: '14px 32px',
                      fontSize: '15px',
                      fontWeight: '600',
                      borderRadius: '25px',
                      border: 'none',
                      cursor: zippingFiles ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      opacity: zippingFiles ? 0.7 : 1,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: 'auto'
                    }}
                    onMouseEnter={(e) => {
                      if (!zippingFiles) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                    }}
                  >
                    {zippingFiles ? (
                      <span>
                        <span style={{ display: 'inline-block', marginRight: '8px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            border: '2px solid white',
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></span>
                        </span>
                        {zipProgress || 'Preparing zip...'}
                      </span>
                    ) : (
                      `📥 Download All Masked Files (${downloadLinks.file_count})`
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Toast Notification */}
            {showToast && (
              <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                backgroundColor: '#28a745',
                color: 'white',
                padding: '15px 20px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10000,
                animation: 'slideInRight 0.3s ease-out',
                maxWidth: '400px'
              }}>
                {toastMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {upgradePrompt && (
        <FeatureUpgradeModal
          feature={upgradePrompt.feature}
          description={upgradePrompt.description}
          onClose={() => setUpgradePrompt(null)}
          onUpgrade={() => {
            setUpgradePrompt(null);
            navigate('/pricing');
          }}
        />
      )}

      <div className="pii-table-section">
        <h3>Detected PIIs {selectedPiiType && `(${selectedPiiType})`}</h3>
        <div className="table-controls">
          <button
            className="btn-filter"
            onClick={() => setSelectedPiiType(null)}
            disabled={!selectedPiiType}
          >
            Clear Filter
          </button>
        </div>
        <div className="pii-table">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>File</th>
                <th>Page</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPiiDetails.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">No PIIs detected for the selected filters.</td>
                </tr>
              ) : (
                paginatedPiiDetails.map((pii, index) => (
                  <tr
                    key={index}
                    className={selectedPiiType === pii.type ? 'highlighted' : ''}
                    onClick={() => handlePiiTypeClick(pii.type)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{pii.type}</td>
                    <td className="pii-value">{pii.value}</td>
                    <td>{pii.filename}</td>
                    <td>{pii.page !== undefined ? pii.page + 1 : 'N/A'}</td>
                    <td>{(pii.confidence * 100).toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="custom-pagination-container">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="custom-page-btn"
              >
                &larr; Previous
              </button>

              <div className="custom-page-info">
                Page {currentPage} of {totalPages}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="custom-page-btn"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders with large datasets
export default React.memo(AnalysisBoard);

