import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { decryptJson, consumeTokenAction } from '../api';
import ScrollButton from './ScrollButton';
import FeatureUpgradeModal from './FeatureUpgradeModal';
import useTokenAccount from '../hooks/useTokenAccount';
import { 
  FiMail, FiSmartphone, FiCreditCard, FiShield, FiFileText, 
  FiHome, FiDollarSign, FiMapPin, FiUser, FiLock, 
  FiKey, FiGlobe, FiHash, FiCalendar, FiTag, FiAtSign,
  FiTrendingUp, FiDatabase, FiAward, FiBriefcase,
  FiTruck, FiBook, FiNavigation, FiCode, FiLink, FiZap, 
  FiCheckCircle, FiAlertCircle
} from 'react-icons/fi';
import './Verification.css';

function Verification() {
  const navigate = useNavigate();
  const [jsonFile, setJsonFile] = useState(null);
  const [jsonPassword, setJsonPassword] = useState('');
  const [jsonShowPassword, setJsonShowPassword] = useState(false);
  const [decryptingJson, setDecryptingJson] = useState(false);
  const [decryptedJsonData, setDecryptedJsonData] = useState(null);
  const [selectedPiiType, setSelectedPiiType] = useState(null);
  const [error, setError] = useState(null);
  const { tokenAccount, featuresEnabled, refresh: refreshTokenAccount, loading: tokensLoading } = useTokenAccount();
  const [upgradePrompt, setUpgradePrompt] = useState(null);

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
    } catch (err) {
      console.warn('Unable to parse user info for verification flow', err);
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
    } catch (err) {
      console.warn('Unable to parse token snapshot for verification flow', err);
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

  const { snapshot: tokenSnapshotPreview, isUnlimited: previewUnlimited, balance: previewBalance } = computeTokenBudget();
  const tokenBalanceLabel = tokenSnapshotPreview
    ? previewUnlimited
      ? 'Unlimited'
      : previewBalance.toLocaleString('en-IN')
    : tokensLoading
      ? 'Refreshing…'
      : '—';

  const handlePiiTypeClick = (type) => {
    setSelectedPiiType(selectedPiiType === type ? null : type);
  };

  const handleDecryptJson = async () => {
    if (!jsonFile) {
      setError('Please select a JSON file');
      return;
    }
    if (!jsonPassword) {
      setError('Please enter the decryption password');
      return;
    }

    const user = getStoredUser();
    if (!user?.email) {
      setError('Please sign in to verify locked JSON files.');
      navigate('/signup');
      return;
    }

    if (!featuresEnabled.unlock_json) {
      setUpgradePrompt({
        feature: 'unlock_json',
        description: 'Unlocking encrypted JSON files is available on the Professional plan and above. Upgrade to continue.'
      });
      return;
    }

    let { snapshot, isUnlimited, balance } = computeTokenBudget();
    if (!snapshot && typeof refreshTokenAccount === 'function') {
      await refreshTokenAccount();
      ({ snapshot, isUnlimited, balance } = computeTokenBudget());
    }

    const tokenCost = 5;
    if (!isUnlimited && balance < tokenCost) {
      setUpgradePrompt({
        feature: 'unlock_json',
        description: `Unlocking a JSON file costs ${tokenCost} tokens. You currently have ${balance} token${balance === 1 ? '' : 's'} remaining.`
      });
      return;
    }

    setDecryptingJson(true);
    setError(null);

    let consumedTokens = false;

    try {
      if (!isUnlimited) {
        await consumeTokenAction({
          action: 'unlock_json',
          userEmail: user.email,
          metadata: {
            filename: jsonFile.name,
            size: jsonFile.size
          }
        });
        consumedTokens = true;
      }

      const response = await decryptJson(jsonFile, jsonPassword);

      if (response.success) {
        setDecryptedJsonData(response.data);
      } else {
        setError(response.error || 'Decryption failed');
      }

      if (consumedTokens && typeof refreshTokenAccount === 'function') {
        await refreshTokenAccount();
      }
    } catch (err) {
      if (consumedTokens && typeof refreshTokenAccount === 'function') {
        await refreshTokenAccount();
      }
      const serverMessage = err.response?.data?.error || err.message || '';
      if (!consumedTokens && typeof serverMessage === 'string' && serverMessage.toUpperCase().includes('INSUFFICIENT')) {
        setUpgradePrompt({
          feature: 'unlock_json',
          description: 'You need at least 5 tokens to unlock a JSON file. Please top up your balance or upgrade your plan.'
        });
      }
      setError(serverMessage || 'Decryption failed. Please check your password.');
    } finally {
      setDecryptingJson(false);
    }
  };

  const handleDownloadUnlockedJson = () => {
    if (!decryptedJsonData) return;

    const jsonString = JSON.stringify(decryptedJsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unlocked_pii_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Icon mapping for PII types
  const getPiiTypeIcon = (type) => {
    const iconMap = {
      'EMAIL': FiMail,
      'EMAIL_DOMAIN': FiAtSign,
      'PHONE': FiSmartphone,
      'AADHAAR': FiShield,
      'PAN': FiCreditCard,
      'PASSPORT': FiFileText,
      'BANK_ACCOUNT': FiHome,
      'IFSC': FiHome,
      'UPI': FiZap,
      'DRIVING_LICENSE': FiTruck,
      'VOTER_ID': FiCheckCircle,
      'CUSTOMER_ID': FiUser,
      'TRANSACTION_ID': FiTrendingUp,
      'MEDICAL_RECORD_ID': FiAlertCircle,
      'INSURANCE_POLICY_NO': FiShield,
      'TAX_RECORD': FiFileText,
      'MEMBERSHIP_ID': FiAward,
      'PROJECT_CODE': FiCode,
      'VEHICLE_REG_NO': FiTruck,
      'STUDENT_ROLL': FiBook,
      'SALARY': FiDollarSign,
      'GPS': FiMapPin,
      'DOB': FiCalendar,
      'CARD_NUMBER': FiCreditCard,
      'CARD_EXPIRY': FiCreditCard,
      'CVV': FiLock,
      'PINCODE': FiMapPin,
      'REFERRAL_CODE': FiTag,
      'SOCIAL_HANDLE': FiGlobe,
      'API_KEY': FiKey,
      'PASSWORD': FiLock,
      'USERNAME': FiUser,
      'IP_ADDRESS': FiGlobe,
      'MAC_ADDRESS': FiHash,
      'IMEI': FiSmartphone,
      'EPF': FiBriefcase,
      'RATION_CARD': FiHome,
      'LINK': FiLink,
    };
    
    const IconComponent = iconMap[type] || FiLock;
    return <IconComponent className="pii-icon" />;
  };

  return (
    <div className="verification-page">
      <button className="back-home-btn" onClick={() => navigate('/')}>
        <span className="back-arrow">←</span>
        <span className="back-text">Back to Homepage</span>
      </button>

      <div className="verification-container">
        <div className="verification-hero">
          <h1 className="verification-title">
            <span className="gradient-text">PII Verification</span>
            <br />
            <span className="title-subtitle">Decrypt & Verify Locked JSON Files</span>
          </h1>
          <p className="verification-subtitle">
            Upload your locked JSON file and decrypt it using your encryption password
          </p>
        </div>

        <div className="verification-plan-banner">
          <span className="verification-plan-balance">Token balance: {tokenBalanceLabel}</span>
          <button className="verification-plan-button" onClick={() => navigate('/pricing#addons')}>
            Top up tokens
          </button>
        </div>

        {!decryptedJsonData ? (
          <div className="verification-upload-section">
            <div className="upload-card">
              <h3>Upload Locked JSON File</h3>
              <div className="file-upload-area" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setJsonFile(file);
                    setError(null);
                  }
                };
                input.click();
              }}>
                <div className="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <p className="upload-text">
                  {jsonFile
                    ? jsonFile.name
                    : 'Click to select locked JSON file'}
                </p>
                <p className="upload-hint">Supports encrypted JSON files only</p>
              </div>

              {jsonFile && (
                <div className="password-input-wrapper">
                  <input
                    type={jsonShowPassword ? "text" : "password"}
                    placeholder="Enter decryption password"
                    value={jsonPassword}
                    onChange={(e) => setJsonPassword(e.target.value)}
                    className="password-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setJsonShowPassword(!jsonShowPassword)}
                    title={jsonShowPassword ? "Hide password" : "Show password"}
                  >
                    {jsonShowPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              )}

              {jsonFile && (
                <button
                  className="btn-decrypt"
                  onClick={handleDecryptJson}
                  disabled={decryptingJson || !jsonPassword}
                >
                  {decryptingJson ? 'Decrypting...' : 'Decrypt JSON File'}
                </button>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
          </div>
        ) : (
          <div className="verification-results">
            <div className="results-header">
              <h2>Unlocked JSON File</h2>
            </div>

            <div className="json-metadata">
              <h4>Metadata</h4>
              <p><strong>Batch ID:</strong> {decryptedJsonData.metadata?.batch_id || 'N/A'}</p>
              <p><strong>Batch Name:</strong> {decryptedJsonData.metadata?.batch_name || 'N/A'}</p>
              <p><strong>Exported At:</strong> {decryptedJsonData.metadata?.exported_at || 'N/A'}</p>
              <p><strong>Total PIIs:</strong> {decryptedJsonData.metadata?.total_piis || 0}</p>
              <div className="pii-types-metadata">
                <strong>PII Types:</strong>
                <div className="pii-types-pills">
                  {decryptedJsonData.metadata?.pii_types?.map((type, index) => (
                    <span 
                      key={index} 
                      className="pii-type-pill"
                      title={type}
                    >
                      {type}
                    </span>
                  )) || <span className="pii-type-pill">N/A</span>}
                </div>
              </div>
            </div>

            <h4>PIIs by Type</h4>
            <div className="pii-types-grid">
              {Object.entries(decryptedJsonData.piis || {}).map(([type, values]) => (
                <div
                  key={type}
                  className={`pii-type-card ${selectedPiiType === type ? 'active' : ''}`}
                  onClick={() => handlePiiTypeClick(type)}
                >
                  <div className="pii-type-icon">
                    {getPiiTypeIcon(type)}
                  </div>
                  <div className="pii-type-name">{type}</div>
                  <div className="pii-type-count">
                    {Array.isArray(values) ? values.length : 0} found
                  </div>
                </div>
              ))}
            </div>

            {selectedPiiType && decryptedJsonData.piis?.[selectedPiiType] && (
              <div className="pii-details-table">
                <h3>{selectedPiiType} Details</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decryptedJsonData.piis[selectedPiiType].map((value, index) => (
                      <tr key={index}>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="decrypted-downloads">
              <h3>Download Unlocked JSON File</h3>
              <button
                className="btn-download btn-download-all"
                onClick={handleDownloadUnlockedJson}
                title="Download unlocked JSON file"
              >
                Download Unlocked JSON File
              </button>
            </div>
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

      <ScrollButton />
    </div>
  );
}

export default Verification;
