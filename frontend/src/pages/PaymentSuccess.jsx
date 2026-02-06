import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle,
  Copy,
  Check,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [status, setStatus] = useState('loading');
  const [paymentData, setPaymentData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 10;

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    if (attempts >= maxAttempts) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${API}/checkout/status/${sessionId}`);
      const data = response.data;

      if (data.payment_status === 'paid') {
        setPaymentData(data);
        setStatus('success');
        return;
      } else if (data.status === 'expired') {
        setStatus('expired');
        return;
      }

      // Continue polling
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, 2000);
    } catch (error) {
      console.error('Status check error:', error);
      setAttempts(prev => prev + 1);
      setTimeout(pollPaymentStatus, 2000);
    }
  };

  const handleCopyPassword = async () => {
    if (paymentData?.temp_password) {
      await navigator.clipboard.writeText(paymentData.temp_password);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAutoLogin = async () => {
    if (paymentData?.email && paymentData?.temp_password) {
      try {
        await login(paymentData.email, paymentData.temp_password);
        toast.success('Logged in successfully!');
        navigate('/dashboard');
      } catch (error) {
        toast.error('Auto-login failed. Please use your credentials to log in.');
        navigate('/');
      }
    } else if (paymentData?.existing_user) {
      toast.info('Please log in with your existing credentials');
      navigate('/');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">Processing your payment...</h2>
            <p className="text-zinc-400">Please wait while we confirm your purchase.</p>
            <div className="mt-4 text-sm text-zinc-500">
              Attempt {attempts + 1} of {maxAttempts}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-zinc-400 mb-8">
              Welcome to RodneysBrain {paymentData?.plan_name} plan!
            </p>

            {/* Payment Details */}
            <div className="glass-card p-6 mb-8 text-left max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Your Account Details
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Email:</span>
                  <span className="text-white font-medium">{paymentData?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Plan:</span>
                  <span className="text-white font-medium">{paymentData?.plan_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Amount:</span>
                  <span className="text-white font-medium">${paymentData?.amount}</span>
                </div>
                
                {paymentData?.temp_password && !paymentData?.existing_user && (
                  <div className="pt-4 border-t border-zinc-800">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Temporary Password:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-zinc-800 px-2 py-1 rounded text-sm text-emerald-400">
                          {paymentData.temp_password}
                        </code>
                        <button
                          onClick={handleCopyPassword}
                          className="text-zinc-400 hover:text-white transition-colors"
                          data-testid="copy-password-btn"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-amber-400 mt-2">
                      ⚠️ Save this password! You can change it after logging in.
                    </p>
                  </div>
                )}

                {paymentData?.existing_user && (
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-sm text-blue-400">
                      ✓ Your existing account has been upgraded to {paymentData?.plan_name}!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {paymentData?.temp_password && !paymentData?.existing_user ? (
                <Button
                  onClick={handleAutoLogin}
                  className="generate-btn"
                  data-testid="auto-login-btn"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/')}
                  className="generate-btn"
                  data-testid="go-login-btn"
                >
                  Sign In to Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Session Expired</h2>
            <p className="text-zinc-400 mb-8">
              Your payment session has expired. Please try again.
            </p>
            <Button
              onClick={() => navigate('/pricing')}
              className="generate-btn"
              data-testid="retry-btn"
            >
              Return to Pricing
            </Button>
          </div>
        );

      case 'timeout':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Still Processing...</h2>
            <p className="text-zinc-400 mb-8">
              Your payment is taking longer than expected. Please check your email for confirmation,
              or contact support if you don't receive it within a few minutes.
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  setAttempts(0);
                  setStatus('loading');
                  pollPaymentStatus();
                }}
                variant="outline"
                className="border-zinc-700"
                data-testid="check-again-btn"
              >
                Check Again
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                className="generate-btn"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h2>
            <p className="text-zinc-400 mb-8">
              We couldn't verify your payment. If you were charged, please contact support.
            </p>
            <Button
              onClick={() => navigate('/pricing')}
              className="generate-btn"
              data-testid="back-pricing-btn"
            >
              Return to Pricing
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
      <div className="max-w-xl w-full">
        <div className="glass-card p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
