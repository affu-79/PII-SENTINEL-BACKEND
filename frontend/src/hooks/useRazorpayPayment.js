/**
 * Razorpay Payment Hook
 * Handles payment flow for plan upgrades and token addons
 */

import { useState } from 'react';
import { createPaymentOrder, createTokenAddonOrder, verifyPayment } from '../api';

export const useRazorpayPayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Process plan upgrade payment
   */
  const upgradePlan = async ({ planId, planName, amount, userEmail, userId, userName, userPhone }) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create order on backend
      console.log(`🔄 Creating payment order for ${planName} plan...`);
      const orderData = await createPaymentOrder({
        planId,
        userEmail,
        userId
      });

      console.log('✓ Payment order created:', orderData.order_id);

      // Step 2: Open Razorpay Checkout
      const options = {
        key: orderData.key, // Razorpay key from backend
        amount: orderData.amount, // Amount in paise
        currency: orderData.currency,
        name: 'PII Sentinel',
        description: `${planName} Plan Subscription`,
        image: '/logo.png', // Your logo
        order_id: orderData.order_id,
        
        handler: async function (response) {
          try {
            console.log('🔄 Payment successful, verifying...');
            
            // Step 3: Verify payment signature on backend
            const verificationResult = await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              userEmail,
              planId
            });

            if (verificationResult.success) {
              console.log('✅ Payment verified successfully!');
              alert(`🎉 ${verificationResult.message}\n\nYour account has been upgraded to ${planName} plan!`);
              
              // Refresh page to show updated plan
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('❌ Payment verification error:', error);
            alert('Payment verification failed. Please contact support with your payment ID.');
          } finally {
            setLoading(false);
          }
        },
        
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: userPhone || ''
        },
        
        notes: {
          plan_id: planId,
          user_email: userEmail
        },
        
        theme: {
          color: '#5c6ded' // Your brand color
        },
        
        modal: {
          ondismiss: function() {
            console.log('Payment canceled by user');
            setLoading(false);
            setError('Payment canceled');
          }
        }
      };

      // Open Razorpay Checkout
      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        setError(response.error.description || 'Payment failed');
        setLoading(false);
        alert(`Payment failed: ${response.error.description || 'Unknown error'}`);
      });
      
      razorpay.open();

    } catch (error) {
      console.error('Error creating payment order:', error);
      setError(error.message || 'Failed to initiate payment');
      setLoading(false);
      alert('Failed to initiate payment. Please try again.');
    }
  };

  /**
   * Process token addon purchase
   */
  const buyTokens = async ({ tokenAmount, userEmail, userId, userName, userPhone }) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create order on backend
      console.log(`🔄 Creating token addon order for ${tokenAmount} tokens...`);
      const orderData = await createTokenAddonOrder({
        tokenAmount,
        userEmail,
        userId
      });

      console.log('✓ Token addon order created:', orderData.order_id);

      const totalAmount = orderData.amount / 100; // Convert from paise to rupees

      // Step 2: Open Razorpay Checkout
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'PII Sentinel',
        description: `${tokenAmount} Tokens Addon (₹${totalAmount})`,
        image: '/logo.png',
        order_id: orderData.order_id,
        
        handler: async function (response) {
          try {
            console.log('🔄 Payment successful, verifying...');
            
            // Step 3: Verify payment signature on backend
            const verificationResult = await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              userEmail,
              tokenAmount
            });

            if (verificationResult.success) {
              console.log('✅ Payment verified successfully!');
              alert(`🎉 ${verificationResult.message}\n\n${tokenAmount} tokens added to your account!`);
              
              // Refresh page to show updated token balance
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('❌ Payment verification error:', error);
            alert('Payment verification failed. Please contact support with your payment ID.');
          } finally {
            setLoading(false);
          }
        },
        
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: userPhone || ''
        },
        
        notes: {
          token_amount: tokenAmount,
          user_email: userEmail
        },
        
        theme: {
          color: '#5c6ded'
        },
        
        modal: {
          ondismiss: function() {
            console.log('Payment canceled by user');
            setLoading(false);
            setError('Payment canceled');
          }
        }
      };

      // Open Razorpay Checkout
      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        setError(response.error.description || 'Payment failed');
        setLoading(false);
        alert(`Payment failed: ${response.error.description || 'Unknown error'}`);
      });
      
      razorpay.open();

    } catch (error) {
      console.error('Error creating token addon order:', error);
      setError(error.message || 'Failed to initiate payment');
      setLoading(false);
      alert('Failed to initiate payment. Please try again.');
    }
  };

  return {
    upgradePlan,
    buyTokens,
    loading,
    error
  };
};

export default useRazorpayPayment;

