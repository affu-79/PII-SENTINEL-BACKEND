import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiCreditCard, FiCalendar, FiDollarSign, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import { getPaymentHistory, downloadInvoice } from '../api';
import './InvoiceHistoryPage.css';

const InvoiceHistoryPage = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [groupedPayments, setGroupedPayments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(null);
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        // Get user info from localStorage (same as Profile page)
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const userData = JSON.parse(userInfo);
                const email = userData.email || userData.username;
                if (email) {
                    setUserEmail(email);
                    loadPaymentHistory(email);
                } else {
                    console.error('No email found in user data');
                    navigate('/profile');
                }
            } catch (error) {
                console.error('Error parsing user info:', error);
                navigate('/profile');
            }
        } else {
            console.log('No user info found, redirecting to profile');
            navigate('/profile');
        }
    }, [navigate]);

    const loadPaymentHistory = async (email) => {
        try {
            setLoading(true);
            setError(null);
            const response = await getPaymentHistory(email);
            const paymentList = response.payments || [];
            setPayments(paymentList);
            
            // Group payments by month-year
            const grouped = groupPaymentsByMonth(paymentList);
            setGroupedPayments(grouped);
        } catch (err) {
            console.error('Error loading payment history:', err);
            setError('Failed to load payment history');
        } finally {
            setLoading(false);
        }
    };

    const groupPaymentsByMonth = (payments) => {
        const grouped = {};
        
        payments.forEach(payment => {
            const date = new Date(payment.created_at);
            const monthYear = `${date.toLocaleString('en-IN', { month: 'long' })} ${date.getFullYear()}`;
            
            if (!grouped[monthYear]) {
                grouped[monthYear] = [];
            }
            grouped[monthYear].push(payment);
        });
        
        return grouped;
    };

    const handleDownloadInvoice = async (paymentId) => {
        try {
            setDownloadingInvoice(paymentId);
            await downloadInvoice(paymentId, userEmail);
        } catch (err) {
            console.error('Error downloading invoice:', err);
            alert('Failed to download invoice. Please try again.');
        } finally {
            setDownloadingInvoice(null);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatAmount = (amountInPaise) => {
        if (!amountInPaise) return '₹0.00';
        return `₹${(amountInPaise / 100).toFixed(2)}`;
    };

    const getPaymentTypeLabel = (payment) => {
        if (payment.type === 'plan_upgrade') {
            return `Plan Upgrade - ${payment.plan_name || 'N/A'}`;
        } else if (payment.type === 'token_addon') {
            return `Token Addon - ${payment.token_amount || 0} tokens`;
        }
        return 'Payment';
    };

    if (loading) {
        return (
            <div className="invoice-history-page">
                <div className="invoice-history-container">
                    <div className="invoice-history-header">
                        <button className="btn-back" onClick={() => navigate('/profile')}>
                            <FiArrowLeft />
                            <span>Back to Profile</span>
                        </button>
                        <div className="invoice-history-title">
                            <FiCreditCard className="title-icon" />
                            <div>
                                <h1>Invoice History</h1>
                                <p>All your payment transactions and invoices</p>
                            </div>
                        </div>
                    </div>
                    <div className="invoice-loading">Loading invoice history...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="invoice-history-page">
                <div className="invoice-history-container">
                    <div className="invoice-history-header">
                        <button className="btn-back" onClick={() => navigate('/profile')}>
                            <FiArrowLeft />
                            <span>Back to Profile</span>
                        </button>
                        <div className="invoice-history-title">
                            <FiCreditCard className="title-icon" />
                            <div>
                                <h1>Invoice History</h1>
                                <p>All your payment transactions and invoices</p>
                            </div>
                        </div>
                    </div>
                    <div className="invoice-error">{error}</div>
                </div>
            </div>
        );
    }

    if (payments.length === 0) {
        return (
            <div className="invoice-history-page">
                <div className="invoice-history-container">
                    <div className="invoice-history-header">
                        <button className="btn-back" onClick={() => navigate('/profile')}>
                            <FiArrowLeft />
                            <span>Back to Profile</span>
                        </button>
                        <div className="invoice-history-title">
                            <FiCreditCard className="title-icon" />
                            <div>
                                <h1>Invoice History</h1>
                                <p>All your payment transactions and invoices</p>
                            </div>
                        </div>
                    </div>
                    <div className="invoice-empty">
                        <p>No payment history found</p>
                        <small>Your payment transactions will appear here</small>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="invoice-history-page">
            <div className="invoice-history-container">
                <div className="invoice-history-header">
                    <button className="btn-back" onClick={() => navigate('/profile')}>
                        <FiArrowLeft />
                        <span>Back to Profile</span>
                    </button>
                    <div className="invoice-history-title">
                        <FiCreditCard className="title-icon" />
                        <div>
                            <h1>Invoice History</h1>
                            <p>All your payment transactions and invoices</p>
                        </div>
                    </div>
                </div>

                <div className="invoice-content">
                    {Object.keys(groupedPayments).map((monthYear) => (
                        <div key={monthYear} className="invoice-month-section">
                            <h2 className="month-title">{monthYear}</h2>
                            <div className="invoice-grid">
                                {groupedPayments[monthYear].map((payment) => (
                                    <div key={payment._id || payment.payment_id} className="invoice-card">
                                        <div className="invoice-card-header">
                                            <div className="invoice-card-title">
                                                <FiCheckCircle className="status-icon" />
                                                <span>{getPaymentTypeLabel(payment)}</span>
                                            </div>
                                            <span className="status-badge">
                                                {(payment.status || 'Completed').toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="invoice-card-body">
                                            <div className="invoice-detail">
                                                <FiCalendar className="detail-icon" />
                                                <div className="detail-content">
                                                    <span className="detail-label">Date</span>
                                                    <span className="detail-value">{formatDate(payment.created_at)}</span>
                                                </div>
                                            </div>

                                            <div className="invoice-detail">
                                                <FiDollarSign className="detail-icon" />
                                                <div className="detail-content">
                                                    <span className="detail-label">Amount</span>
                                                    <span className="detail-value amount">
                                                        {formatAmount(payment.amount)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="invoice-detail">
                                                <FiCreditCard className="detail-icon" />
                                                <div className="detail-content">
                                                    <span className="detail-label">Payment ID</span>
                                                    <span className="detail-value payment-id">
                                                        {payment.payment_id}
                                                    </span>
                                                </div>
                                            </div>

                                            {payment.type === 'plan_upgrade' && payment.billing_period && (
                                                <div className="invoice-detail">
                                                    <FiCheckCircle className="detail-icon" />
                                                    <div className="detail-content">
                                                        <span className="detail-label">Billing Period</span>
                                                        <span className="detail-value">
                                                            {payment.billing_period.charAt(0).toUpperCase() + payment.billing_period.slice(1)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="invoice-card-footer">
                                            <button
                                                className="btn-download"
                                                onClick={() => handleDownloadInvoice(payment.payment_id)}
                                                disabled={downloadingInvoice === payment.payment_id}
                                            >
                                                <FiDownload />
                                                {downloadingInvoice === payment.payment_id ? 'Downloading...' : 'Download Invoice'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InvoiceHistoryPage;

