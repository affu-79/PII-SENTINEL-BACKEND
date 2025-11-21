import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './welcome';
import Dashboard from './components/Dashboard';
import Verification from './components/Verification';
import Pricing from './Pricing';
import Signup from './Signup';
import CreateAccount from './CreateAccount';
import Profile from './Profile';
import Features from './Features';
import UseCases from './UseCases';
import HowItWorks from './HowItWorks';
import AccountDeleted from './AccountDeleted';
import About from './pages/About';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/verification" element={<Verification />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/features" element={<Features />} />
        <Route path="/usecases" element={<UseCases />} />
        <Route path="/howitworks" element={<HowItWorks />} />
        <Route path="/account-deleted" element={<AccountDeleted />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
