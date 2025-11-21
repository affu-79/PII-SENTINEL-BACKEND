import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AnalysisHeader from './AnalysisHeader';
import AnalysisBoard from './AnalysisBoard';
import Chat from './Chat';
import ScrollButton from './ScrollButton';
import { listBatches } from '../api';
import useTokenAccount from '../hooks/useTokenAccount';
import '../styles.css';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true); // Show loader while loading batches

  const { tokenAccount, featuresEnabled, refresh: refreshTokenAccount } = useTokenAccount();

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const userInfo = localStorage.getItem('userInfo');
      let userId = 'default';
      if (userInfo) {
        const userData = JSON.parse(userInfo);
        userId = userData.email || userData.username || userData.mobile || 'default';
      }
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/batches?user_id=${userId}&limit=100`,
        {
          headers: {
            'X-API-KEY': process.env.REACT_APP_API_KEY,
          },
        }
      );
      if (!response.ok) throw new Error(`Failed to load batches: ${response.status}`);
      const data = await response.json();
      const batchCount = data.batches?.length || 0;
      console.log(`✓ Batches loaded: ${batchCount} | From cache: ${data.from_cache ? '🚀 YES' : '🔄 NO'}`);
      setBatches(data.batches || []);
    } catch (error) {
      console.error('❌ Error loading batches:', error);
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  const loadAnalysis = useCallback(async (batchId) => {
    setLoading(true);
    console.log("Dashboard - Loading analysis for batch:", batchId);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/batch/${batchId}/analysis`,
        {
          headers: {
            'X-API-KEY': process.env.REACT_APP_API_KEY,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to load analysis');
      const data = await response.json();
      console.log('📊 Analysis data loaded:', data);
      console.log('📊 Files count:', data.files?.length || 0);
      console.log('📊 Stats:', data.stats);
      console.log('📊 Total PIIs:', data.stats?.piis || 0);
      setAnalysis(data);
      setSelectedBatchName(data.name || '');
    } catch (error) {
      console.error('Error loading analysis:', error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const userData = JSON.parse(userInfo);
        setUsername(userData.username || userData.fullName || 'User');
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
  }, [loadBatches]);

  useEffect(() => {
    if (selectedBatch) {
      loadAnalysis(selectedBatch);
    } else {
      setAnalysis(null);
      setSelectedBatchName('');
    }
  }, [selectedBatch, loadAnalysis]);

  const handleBatchCreated = () => {
    loadBatches();
  };

  const handleBatchSelected = (batchId) => {
    console.log("Dashboard - Batch selected:", batchId);
    setSelectedBatch(batchId);
  };

  const handleFilesUploaded = () => {
    loadBatches();
    if (typeof refreshTokenAccount === 'function') {
      refreshTokenAccount();
    }
    if (selectedBatch) {
      setTimeout(() => {
        loadAnalysis(selectedBatch);
      }, 500);
    }
  };

  return (
    <div className="dashboard-app">
      {/* Mobile/Tablet Menu Toggle Button - Acts as both open and close toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        )}
      </button>

      {/* Overlay for tablet and mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        batches={batches}
        selectedBatch={selectedBatch}
        onBatchSelect={(batchId) => {
          handleBatchSelected(batchId);
          setSidebarOpen(false); // Close sidebar on tablet/mobile after selection
        }}
        onBatchCreated={handleBatchCreated}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        loadingBatches={loadingBatches}
      />
      <div className="main-content-modern">
        {/* Top Bar with Username & Batch Info */}
        {(username || selectedBatchName) && (
          <div className="dashboard-top-bar">
            <div className="top-bar-content">
              {username && (
                <div className="dashboard-greeting">
                  <span className="greeting-text-modern">Hi {username}!</span>
                </div>
              )}
              {selectedBatchName && (
                <div className="dashboard-batch-info">
                  <span className="batch-label-modern">Batch:</span>
                  <span className="batch-name-modern-display">{selectedBatchName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="main-content-wrapper">
          {selectedBatch ? (
            <>
              <AnalysisHeader analysis={analysis} />
              <AnalysisBoard
                analysis={analysis}
                batchId={selectedBatch}
                tokenAccount={tokenAccount}
                featuresEnabled={featuresEnabled}
                onTokensChange={refreshTokenAccount}
              />
              <Chat
                batchId={selectedBatch}
                onFilesUploaded={handleFilesUploaded}
                tokenAccount={tokenAccount}
                refreshTokenAccount={refreshTokenAccount}
              />
            </>
          ) : (
            <div className="no-batch-selected">
              <div className="no-batch-icon">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <h2>No Batch Selected</h2>
              <p>Please select an existing batch or create a new one from the sidebar to get started.</p>
            </div>
          )}
        </div>
      </div>
      <ScrollButton />
    </div>
  );
}

export default Dashboard;

