import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload, FiCreditCard, FiCalendar, FiDollarSign, FiCheckCircle, FiPackage, FiArrowRight } from 'react-icons/fi';
import { getPaymentHistory, downloadInvoice } from '../api';
import './PaymentHistory.css';

const PaymentHistory = ({ userEmail, limit = 4 }) => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(null);

    useEffect(() => {
        if (userEmail) {
            loadPaymentHistory();
        }
    }, [userEmail]);

    const loadPaymentHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getPaymentHistory(userEmail);
            setPayments(response.payments || []);
        } catch (err) {
            console.error('Error loading payment history:', err);
            setError('Failed to load payment history');
        } finally {
            setLoading(false);
        }
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
            <div className="payment-history-card">
                <div className="payment-history-header">
                    <FiCreditCard className="payment-history-icon" />
                    <div className="payment-history-title-section">
                        <h2>Payment History & Invoices</h2>
                        <p className="payment-history-subtitle">
                            View and download invoices for all your transactions
                        </p>
                    </div>
                </div>
                <div className="payment-history-loading">Loading payment history...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="payment-history-card">
                <div className="payment-history-header">
                    <FiCreditCard className="payment-history-icon" />
                    <div className="payment-history-title-section">
                        <h2>Payment History & Invoices</h2>
                        <p className="payment-history-subtitle">
                            View and download invoices for all your transactions
                        </p>
                    </div>
                </div>
                <div className="payment-history-error">{error}</div>
            </div>
        );
    }

    if (payments.length === 0) {
        return (
            <div className="payment-history-card">
                <div className="payment-history-header">
                    <FiCreditCard className="payment-history-icon" />
                    <div className="payment-history-title-section">
                        <h2>Payment History & Invoices</h2>
                        <p className="payment-history-subtitle">
                            View and download invoices for all your transactions
                        </p>
                    </div>
                </div>
                <div className="payment-history-empty">
                    <FiPackage className="empty-icon" />
                    <p>No payment history found</p>
                    <small>Your payment transactions will appear here</small>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-history-card">
            <div className="payment-history-header">
                <FiCreditCard className="payment-history-icon" />
                <div className="payment-history-title-section">
                    <h2>Payment History & Invoices</h2>
                    <p className="payment-history-subtitle">
                        View and download invoices for all your transactions
                    </p>
                </div>
            </div>

            <div className="payment-history-list">
                {payments.slice(0, limit).map((payment) => (
                    <div key={payment._id || payment.payment_id} className="payment-item">
                        <div className="payment-item-header">
                            <div className="payment-item-title">
                                <FiCheckCircle className="payment-status-icon" />
                                <span>{getPaymentTypeLabel(payment)}</span>
                            </div>
                            <span className="payment-status-badge">
                                {(payment.status || 'Completed').toUpperCase()}
                            </span>
                        </div>

                        <div className="payment-item-body">
                            <div className="payment-detail">
                                <FiCalendar className="detail-icon" />
                                <div className="detail-content">
                                    <span className="detail-label">Date</span>
                                    <span className="detail-value">{formatDate(payment.created_at)}</span>
                                </div>
                            </div>

                            <div className="payment-detail">
                                <FiDollarSign className="detail-icon" />
                                <div className="detail-content">
                                    <span className="detail-label">Amount</span>
                                    <span className="detail-value amount">
                                        {formatAmount(payment.amount)}
                                    </span>
                                </div>
                            </div>

                            <div className="payment-detail">
                                <FiCreditCard className="detail-icon" />
                                <div className="detail-content">
                                    <span className="detail-label">Payment ID</span>
                                    <span className="detail-value payment-id">
                                        {payment.payment_id}
                                    </span>
                                </div>
                            </div>

                            {payment.type === 'plan_upgrade' && payment.billing_period && (
                                <div className="payment-detail">
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

                        <div className="payment-item-footer">
                            <button
                                className="btn-download-invoice"
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

            {payments.length > limit && (
                <div className="payment-history-footer">
                    <button
                        className="btn-show-all-invoices"
                        onClick={() => {
                            console.log('Navigating to /invoice-history');
                            navigate('/invoice-history');
                        }}
                    >
                        <span>Show All Invoices</span>
                        <FiArrowRight />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PaymentHistory;

