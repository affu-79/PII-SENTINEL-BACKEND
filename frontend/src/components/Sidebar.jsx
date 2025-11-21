import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBatch, deleteBatch } from '../api';
import { FiPlus, FiTrash2, FiX, FiCheck } from 'react-icons/fi';
import AuthPromptModal from './AuthPromptModal';
import BatchLoader from './BatchLoader';
import './Sidebar.css';

function Sidebar({ batches, selectedBatch, onBatchSelect, onBatchCreated, isOpen = false, onClose, loadingBatches = false }) {
  console.log("Sidebar - Batches received:", batches);
  console.log("Sidebar - loadingBatches received:", loadingBatches);
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [username, setUsername] = useState('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showBatchLoader, setShowBatchLoader] = useState(false); // Shows when batch is being created
  
  // Lazy loading - only render visible batches (virtualization)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const containerRef = useRef(null);

  useEffect(() => {
    // Get username from localStorage
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const userData = JSON.parse(userInfo);
        setUsername(userData.username || userData.fullName || 'User');
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Get selected batch name
    if (selectedBatch) {
      const batch = batches.find(b => b.batch_id === selectedBatch);
      setSelectedBatchName(batch?.name || '');
    } else {
      setSelectedBatchName('');
    }
  }, [selectedBatch, batches]);

  // Handle scroll for lazy loading (virtualization)
  const handleScroll = (e) => {
    if (!containerRef.current) return;
    
    const scrollTop = e.target.scrollTop;
    const itemHeight = 90; // Height of each batch item + margin
    const visibleItems = 10; // Show 10 items at a time
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = start + visibleItems + 2; // Buffer for smooth scrolling
    
    if (start !== visibleRange.start || end !== visibleRange.end) {
      setVisibleRange({ start, end });
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!batchName.trim()) return;

    // Check if user is signed in
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) {
      alert('You must sign in to create a batch');
      navigate('/');
      return;
    }

    let userId = null;
    try {
      const userData = JSON.parse(userInfo);
      userId = userData.email || userData.username || userData.mobile;
      
      // Make sure user is not 'default'
      if (!userId || userId === 'default') {
        alert('You must sign in to create a batch');
        navigate('/');
        return;
      }
    } catch (e) {
      console.error('Error parsing user info:', e);
      alert('You must sign in to create a batch');
      navigate('/');
      return;
    }

    setCreating(true);
        try {
          const userData = JSON.parse(userInfo);
      const username = userData.username || userData.fullName || null;

      console.log('Creating batch with name:', batchName, 'for user:', userId);
      const result = await createBatch(batchName, username, userId);
      console.log('Batch created successfully:', result);
      
      setBatchName('');
      setShowCreateModal(false);
      
      // Show sidebar loader while batch is being added to the list
      setShowBatchLoader(true);
      onBatchCreated();
      
      // Super fast - show loader for only 0.8 seconds (less is better!)
      await new Promise(resolve => setTimeout(resolve, 800));
      setShowBatchLoader(false);
    } catch (error) {
      console.error('Error creating batch:', error);
      
      // Check if error is authentication related
      if (error.response?.status === 401) {
        alert('Your session has expired. Please sign in again.');
        navigate('/');
        return;
      }
      
      const errorMsg = error.response?.data?.error || error.message;
      alert('Failed to create batch: ' + errorMsg);
      // If duplicate name error, keep modal open
      if (errorMsg.includes('already exists')) {
        setShowCreateModal(true);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!showDeleteConfirm || showDeleteConfirm !== batchId) {
      setShowDeleteConfirm(batchId);
      return;
    }

    setDeletingBatchId(batchId);
    console.log(`🗑️ Deleting batch: ${batchId}`);
    
    try {
      const response = await deleteBatch(batchId);
      console.log('✓ Batch deleted response:', response);
      
      setShowDeleteConfirm(null);
      
      // Deselect if deleted batch was selected FIRST
      if (selectedBatch === batchId) {
        console.log('📌 Deselecting deleted batch');
        onBatchSelect(null);
      }
      
      // Refresh the batch list from server (clears cache)
      console.log('🔄 Refreshing batch list');
      onBatchCreated();
      
      // Show success (no alert - just log)
      console.log('✅ Batch deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting batch:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      console.error('Error details:', errorMsg);
      alert('Failed to delete batch: ' + errorMsg);
      
      // Don't clear the delete confirm on error so user can try again
      setShowDeleteConfirm(batchId);
    } finally {
      setDeletingBatchId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`sidebar-modern ${isOpen ? 'open' : ''}`}>
      {/* Mobile/Tablet Header with Back Button */}
      <div className="sidebar-mobile-header">
        <div className="sidebar-mobile-header-buttons">
          <button
            className="sidebar-back-btn-mobile"
            onClick={() => {
              navigate('/');
              if (onClose) onClose();
            }}
            title="Back to Home"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="sidebar-logo-mobile">
          <h2>PII SENTINEL</h2>
        </div>
      </div>

      {/* Desktop Back to Home Button */}
      <button
        className="sidebar-back-btn"
        onClick={() => {
          navigate('/');
          if (onClose) onClose();
        }}
        title="Back to Home"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Header Section */}
      <div className="sidebar-header-modern">
        <div className="sidebar-logo">
          <h2>PII Sentinel</h2>
        </div>
        <button
          className="btn-create-batch-modern"
          onClick={() => {
            if (!username) {
              setShowAuthPrompt(true);
            } else {
              setShowCreateModal(true);
            }
          }}
          title={!username ? "Sign in to create a batch" : "Create a new batch"}
        >
          <FiPlus className="btn-icon" />
          <span>Create Batch</span>
        </button>
      </div>

      {/* Batch Stats */}
      <div className="sidebar-user-info">
        <div className="batch-stats-display">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <span className="stats-label">Total Batches:</span>
          <span className="stats-value">{batches.length}</span>
        </div>
        {selectedBatchName && (
          <div className="batch-info-display">
            <span className="batch-label">Current Batch:</span>
            <span className="batch-name-display">{selectedBatchName}</span>
          </div>
        )}
      </div>

      {/* Batches List */}
      <div className="batches-list-modern">
        <h3 className="batches-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          Batches
        </h3>
        
        {/* Show inline loader when:
            1. Initial page load/refresh (loadingBatches)
            2. After creating a new batch (showBatchLoader) */}
        {(loadingBatches || showBatchLoader) && (
          <BatchLoader 
            isVisible={true} 
            message={showBatchLoader ? "Loading batch..." : "Loading batches..."} 
            inline={true} 
          />
        )}
        
        {batches.length === 0 && !loadingBatches && !showBatchLoader ? (
          <div className="empty-state-modern">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p>No batches yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="batches-container" ref={containerRef} onScroll={handleScroll}>
            {/* Lazy load only visible batches for performance */}
            {batches.slice(visibleRange.start, visibleRange.end).map((batch, idx) => (
              <div
                key={batch.batch_id}
                className={`batch-item-modern ${selectedBatch === batch.batch_id ? 'selected' : ''}`}
              >
                <div
                  className="batch-content-modern"
                  onClick={() => onBatchSelect(batch.batch_id)}
                >
                  <div className="batch-name-modern">{batch.name}</div>
                  <div className="batch-meta-modern">
                    <span className="batch-date">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {formatDate(batch.created_at)}
                    </span>
                    <span className="batch-stats">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {batch.stats?.files || 0} files
                    </span>
                    <span className="batch-stats">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      {batch.stats?.piis || 0} PIIs
                    </span>
                  </div>
                </div>
                <div className="delete-batch-wrapper">
                  {showDeleteConfirm === batch.batch_id ? (
                    <>
                      <button
                        className="btn-delete-batch-modern confirm-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBatch(batch.batch_id);
                        }}
                        disabled={deletingBatchId === batch.batch_id}
                        title="Confirm deletion"
                      >
                        <FiCheck className="delete-icon confirm" />
                      </button>
                      <button
                        className="btn-delete-batch-modern cancel-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(null);
                        }}
                        disabled={deletingBatchId === batch.batch_id}
                        title="Cancel"
                      >
                        <FiX className="delete-icon cancel" />
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-delete-batch-modern"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBatch(batch.batch_id);
                      }}
                      disabled={deletingBatchId === batch.batch_id}
                      title="Delete batch"
                    >
                      {deletingBatchId === batch.batch_id ? (
                        <span className="delete-loading">...</span>
                      ) : (
                        <FiTrash2 className="delete-icon" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <div className="modal-overlay-modern" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content-modern" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-modern">
              <h3>Create New Batch</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="modal-form-modern">
              <div className="form-group-modern">
                <label>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  Batch Name
                </label>
                <input
                  type="text"
                  placeholder="Enter batch name"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  autoFocus
                  disabled={creating}
                  className="form-input-modern"
                />
              </div>
              <div className="modal-actions-modern">
                <button
                  type="button"
                  className="btn-cancel-modern"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit-modern"
                  disabled={creating || !batchName.trim()}
                >
                  {creating ? (
                    <>
                      <span className="spinner"></span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <FiPlus />
                      Create
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Prompt Modal */}
      <AuthPromptModal isOpen={showAuthPrompt} onClose={() => setShowAuthPrompt(false)} />
    </div>
  );
}

export default Sidebar;
