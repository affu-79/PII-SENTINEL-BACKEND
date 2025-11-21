import React, { useState, useRef, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';
import { uploadFiles, getJobResult, maskFiles, downloadFile, consumeTokenAction } from '../api';
import FeatureUpgradeModal from './FeatureUpgradeModal';

function Chat({ batchId, onFilesUploaded, tokenAccount, refreshTokenAccount }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, current_file: null, eta_seconds: null });
  const [masking, setMasking] = useState(false);
  const [maskType, setMaskType] = useState('blur');
  const [password, setPassword] = useState('');
  const [downloadLinks, setDownloadLinks] = useState(null);
  const [selectedPiiCategories, setSelectedPiiCategories] = useState(new Set());
  const [zippingFiles, setZippingFiles] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

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
      console.warn('Unable to parse user info while uploading files', error);
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

  // Clear results and files when batch changes (to avoid showing stale data)
  useEffect(() => {
    // Only clear if we're not currently processing
    if (!uploading && jobStatus !== 'processing') {
      setFiles([]); // Clear selected files
      setResults(null);
      setJobStatus(null);
      setJobId(null);
      setDownloadLinks(null);
      setProgress({ completed: 0, total: 0, current_file: null, eta_seconds: null });
      setSelectedPiiCategories(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }))]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0
    }))]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!batchId) {
      alert('Please select or create a batch first');
      return;
    }

    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    const user = getStoredUser();
    if (!user?.email) {
      alert('Please sign in to upload files.');
      navigate('/signup');
      return;
    }

    let { snapshot, isUnlimited, balance } = computeTokenBudget();
    if (!snapshot && typeof refreshTokenAccount === 'function') {
      await refreshTokenAccount();
      ({ snapshot, isUnlimited, balance } = computeTokenBudget());
    }

    const fileObjects = files.map(f => f.file);
    const requiredTokens = fileObjects.length;

    if (!isUnlimited && balance < requiredTokens) {
      openUpgradePrompt(
        'upload',
        `Uploading ${requiredTokens} file${requiredTokens === 1 ? '' : 's'} requires ${requiredTokens} token${requiredTokens === 1 ? '' : 's'}. You currently have ${balance} token${balance === 1 ? '' : 's'} remaining.`
      );
      return;
    }

    setUploading(true);
    try {
      const response = await uploadFiles(batchId, fileObjects);

      // Show message about skipped files if any
      if (response?.skipped_count > 0) {
        const skippedMsg = `${response.skipped_count} file(s) already processed and skipped. Processing ${response.file_count} new file(s).`;
        console.log(skippedMsg);
      }

      setJobId(response.job_id);
      setJobStatus('processing');

      const skippedFileNames = response?.skipped_files || [];
      setFiles(prev => prev.map(f => {
        if (skippedFileNames.includes(f.name)) {
          return { ...f, status: 'skipped' };
        }
        return { ...f, status: 'processing' };
      }));

      if (!isUnlimited) {
        let deductionFailed = false;
        for (const file of fileObjects) {
          try {
            await consumeTokenAction({
              action: 'upload',
              userEmail: user.email,
              metadata: {
                filename: file.name,
                size: file.size,
                batch_id: batchId
              }
            });
          } catch (error) {
            console.error('Token deduction failed for upload', error);
            const message = error.response?.data?.error || error.message || 'Unable to deduct tokens for this upload.';
            openUpgradePrompt('upload', message.includes('INSUFFICIENT')
              ? 'Your token balance dropped below the required amount while uploading. Please top up tokens to continue uninterrupted.'
              : message
            );
            deductionFailed = true;
            break;
          }
        }
        if (typeof refreshTokenAccount === 'function') {
          await refreshTokenAccount();
        }
        if (deductionFailed) {
          showToastMessage('Token balance could not be updated fully. Please review your plan or top up tokens.');
        }
      }

      // Poll for job completion
      pollJobStatus(response.job_id);
    } catch (error) {
      console.error('Error uploading files:', error);
      const errorMsg = error.response?.data?.error || error.message;

      if (error.response?.data?.skipped_count > 0) {
        alert(`All files were already processed. ${errorMsg}`);
      } else {
        alert('Upload failed: ' + errorMsg);
      }

      setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
      setUploading(false);
      if (typeof refreshTokenAccount === 'function') {
        refreshTokenAccount();
      }
    }
  };

  const pollJobStatus = (jobId) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await getJobResult(jobId);
        setJobStatus(result.status);
        
        // Update progress
        if (result.progress) {
          setProgress(result.progress);
          
          // Update individual file statuses
          if (result.progress.completed > 0) {
            const completedCount = result.progress.completed;
            setFiles(prev => prev.map((f, idx) => {
              if (idx < completedCount) {
                return { ...f, status: 'completed', progress: 100 };
              } else if (idx === completedCount && result.progress.current_file) {
                return { ...f, status: 'processing', progress: 50 };
              }
              return f;
            }));
          }
        }

        if (result.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setResults(result.results);
          setFiles(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));
          setUploading(false);
          setProgress({ completed: result.file_count || 0, total: result.file_count || 0, eta_seconds: 0 });
          // Call callback once when processing is truly done
          if (onFilesUploaded) {
            onFilesUploaded();
          }
          // Stop polling after calling callback
          return;
        } else if (result.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
          setUploading(false);
          alert('Processing failed: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        clearInterval(pollIntervalRef.current);
        setUploading(false);
      }
    }, 1000); // Poll every 1 second for better progress updates
  };

  // Get all unique PII types from results
  const allPiiTypes = useMemo(() => {
    const types = new Set();
    if (results) {
      results.forEach(result => {
        const piis = result.piis || [];
        piis.forEach(pii => {
          if (pii.type) {
            types.add(pii.type);
          }
        });
      });
    }
    return Array.from(types).sort();
  }, [results]);

  // Initialize selected categories with all types selected by default
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

  const handleMask = async () => {
    if (!jobId) {
      alert('No job to mask');
      return;
    }

    if (maskType === 'hash' && !password) {
      alert('Password is required for hash masking');
      return;
    }

    if (selectedPiiCategories.size === 0) {
      alert('Please select at least one PII category to mask');
      return;
    }

    setMasking(true);
    try {
      const selectedTypes = Array.from(selectedPiiCategories);
      const response = await maskFiles(jobId, maskType, password || null, null, selectedTypes);
      setDownloadLinks(response);
      alert('Masking completed! Click download links to get masked files.');
    } catch (error) {
      console.error('Error masking files:', error);
      alert('Masking failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setMasking(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatETA = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setToastMessage('');
    }, 5000);
  };

  const handleDownloadAllZip = async () => {
    if (!downloadLinks || !downloadLinks.download_urls) return;
    
    setZippingFiles(true);
    setZipProgress('Preparing zip...');
    
    try {
      const zip = new JSZip();
      const totalFiles = downloadLinks.download_urls.length;
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
      
      setZippingFiles(false);
      setZipProgress('');
      
      // Show success toast
      showToastMessage(`✅ All ${totalFiles} masked files have been zipped and downloaded. You can extract them to view all masked results.`);
      
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('Failed to create zip file: ' + (error.response?.data?.error || error.message));
      setZippingFiles(false);
      setZipProgress('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Upload Documents</h2>
        {!batchId && (
          <p className="warning">Please select or create a batch from the sidebar</p>
        )}
      </div>

      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg"
        />
        <div className="upload-prompt">
          <p>Drag and drop files here, or</p>
          <button
            className="btn-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={!batchId || uploading}
          >
            Browse Files
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <h3>Selected Files ({files.length})</h3>
          {files.map((fileInfo, index) => (
            <div key={index} className="file-item">
              <div className="file-info">
                <span className="file-name">{fileInfo.name}</span>
                <span className="file-size">{formatFileSize(fileInfo.size)}</span>
              </div>
              <div className="file-status">
                <span className={`status-badge ${fileInfo.status}`}>
                  {fileInfo.status}
                </span>
                {fileInfo.status === 'pending' && (
                  <button
                    className="btn-remove"
                    onClick={() => removeFile(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={!batchId || uploading || files.length === 0}
          >
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      )}

      {jobStatus === 'processing' && (
        <div className="processing-status">
          <div className="progress-info">
            <p>
              Processing files: {progress.completed} / {progress.total}
              {progress.current_file && ` - Current: ${progress.current_file}`}
            </p>
            {progress.eta_seconds !== null && progress.eta_seconds !== undefined && (
              <p className="eta">
                {progress.eta_seconds > 0 
                  ? `Estimated time remaining: ${formatETA(progress.eta_seconds)}`
                  : 'Calculating ETA...'}
              </p>
            )}
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {results && jobId && jobStatus === 'completed' && (
        <div className="results-section">
          <h3>Processing Results</h3>
          <div className="results-summary">
            <p>Files processed: {results.length}</p>
            <p>Total PIIs detected: {results.reduce((sum, r) => sum + (r.pii_count || 0), 0)}</p>
          </div>

          <div className="masking-section">
            <h4>Apply Masking</h4>
            
            {/* PII Category Selection */}
            {allPiiTypes.length > 0 && (
              <div className="pii-category-selection">
                <h4>Select PII Categories to Mask:</h4>
                <div className="pii-category-pills">
                  {allPiiTypes.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`pii-category-pill ${selectedPiiCategories.has(category) ? 'selected' : ''}`}
                      onClick={() => togglePiiCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <p className="pii-selection-hint">
                  {selectedPiiCategories.size === 0 
                    ? 'Please select at least one category' 
                    : `${selectedPiiCategories.size} of ${allPiiTypes.length} categories selected`}
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
              <input
                type="password"
                placeholder="Enter password for encryption"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="password-input"
              />
            )}
            <button
              className="btn-primary"
              onClick={handleMask}
              disabled={masking || selectedPiiCategories.size === 0}
            >
              {masking ? 'Masking...' : 'Apply Masking'}
            </button>
          </div>

            {downloadLinks && (
            <div className="download-section">
              <h4>Download Masked Files</h4>
              {downloadLinks.format === 'zip' ? (
                <a
                  href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${downloadLinks.download_url}`}
                  className="btn-download"
                  download
                  title={`ZIP file containing ${downloadLinks.file_count} masked files (${downloadLinks.mask_type || 'blurred'})`}
                  onClick={(e) => {
                    // Download via API to include API key
                    e.preventDefault();
                    downloadFile(downloadLinks.download_url.replace('/api/download?path=', ''));
                  }}
                >
                  Download ZIP ({downloadLinks.file_count} files)
                </a>
              ) : (
                <>
                <div className="download-links">
                    {/* Show only first 20 files */}
                    {downloadLinks.download_urls?.slice(0, 20).map((url, idx) => {
                    // Get file info for tooltip and download name
                    const fileInfo = downloadLinks.file_info?.[idx];
                    const tooltipText = fileInfo?.descriptive_name || 
                      fileInfo?.original_filename || 
                      `masked-${downloadLinks.mask_type || 'blurred'}-file-${idx + 1}`;
                    const downloadName = fileInfo?.descriptive_name || 
                      fileInfo?.original_filename || 
                      `masked_file_${idx + 1}`;
                    
                    return (
                      <a
                        key={idx}
                        href="#"
                        className="btn-download"
                        title={tooltipText}
                        onClick={(e) => {
                          e.preventDefault();
                          const path = url.replace('/api/download?path=', '');
                          downloadFile(path).then(blob => {
                            const downloadUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = downloadName;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(downloadUrl);
                          });
                        }}
                      >
                        Download File {idx + 1}
                      </a>
                    );
                  })}
                  </div>
                  
                  {/* Show message if more than 20 files */}
                  {downloadLinks.download_urls && downloadLinks.download_urls.length > 20 && (
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
                        📦 Remaining masked files are available inside the zip folder.
                      </p>
                    </div>
                  )}
                  
                  {/* Download All Button */}
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                      className="btn-download btn-download-all"
                      onClick={handleDownloadAllZip}
                      disabled={zippingFiles}
                      title="Download all masked files as a zip archive"
                      style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        padding: '12px 24px',
                        fontSize: '16px',
                        fontWeight: '600',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: zippingFiles ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,123,255,0.3)',
                        opacity: zippingFiles ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!zippingFiles) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 8px rgba(0,123,255,0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0,123,255,0.3)';
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Chat;

