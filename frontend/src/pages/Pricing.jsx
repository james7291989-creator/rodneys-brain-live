import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Check, 
  Sparkles, 
  Zap, 
  Crown, 
  Rocket,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Plan icons mapping
const PLAN_ICONS = {
  beginner: Zap,
  pro: Rocket,
  lifetime: Crown,
  bronze: Sparkles,
};

// Stripe Payment Links (provided by user)
const STRIPE_LINKS = {
  beginner: "https://buy.stripe.com/7sY8wOdww72X4XmeqQ0Ny01",
  pro: "https://buy.stripe.com/dRm6oGboo4UPfC05Uk0Ny02",
  lifetime: "https://buy.stripe.com/bJe5kC8cc4UP75uciI0Ny03",
  bronze: "https://buy.stripe.com/5kQfZgboocnh75u5Uk0Ny04",
};

export const Pricing = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [email, setEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(null);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check if redirected from cancelled payment
    if (searchParams.get('cancelled') === 'true') {
      toast.error('Payment was cancelled. Please try again.');
    }
    loadPlans();
  }, [searchParams]);

  useEffect(() => {
    // Pre-fill email if user is logged in
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const loadPlans = async () => {
    try {
      const response = await axios.get(`${API}/pricing/plans`);
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Failed to load plans:', error);
      // Fallback to hardcoded plans if API fails
      setPlans([
        { id: 'beginner', name: 'Beginner', amount: 29, type: 'one_time', features: ['10 AI generations', 'Basic templates', 'Email support'] },
        { id: 'pro', name: 'Pro', amount: 47, type: 'subscription', features: ['Unlimited generations', 'All templates', 'Priority support', 'Custom domains'] },
        { id: 'lifetime', name: 'Lifetime', amount: 297, type: 'one_time', features: ['Lifetime access', 'All features forever', 'VIP support', 'Early access'] },
        { id: 'bronze', name: 'Bronze', amount: 97, type: 'subscription', features: ['Team access (5 seats)', 'API access', 'White-label', 'Dedicated support'] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId) => {
    const planEmail = isAuthenticated ? user.email : email;
    
    if (!planEmail) {
      setShowEmailInput(planId);
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(planEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setProcessingPlan(planId);
    
    try {
      const response = await axios.post(`${API}/checkout/session`, {
        plan_id: planId,
        email: planEmail,
        origin_url: window.location.origin
      });

      if (response.data.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setProcessingPlan(null);
    }
  };

  const handleDirectLink = (planId) => {
    // Use direct Stripe Payment Links as fallback
    const link = STRIPE_LINKS[planId];
    if (link) {
      window.open(link, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-zinc-300">Choose your plan</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Start building with AI today. No hidden fees. Cancel anytime.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.id] || Sparkles;
            const isPopular = plan.id === 'pro';
            const isLifetime = plan.id === 'lifetime';
            
            return (
              <div
                key={plan.id}
                className={`relative glass-card p-6 flex flex-col ${
                  isPopular ? 'ring-2 ring-blue-500 scale-105' : ''
                } ${isLifetime ? 'ring-2 ring-amber-500' : ''}`}
                data-testid={`pricing-card-${plan.id}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                {isLifetime && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-500 text-black text-xs font-semibold px-3 py-1 rounded-full">
                      Best Value
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    isPopular ? 'bg-blue-600/20' : isLifetime ? 'bg-amber-500/20' : 'bg-zinc-800'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      isPopular ? 'text-blue-400' : isLifetime ? 'text-amber-400' : 'text-zinc-400'
                    }`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">${plan.amount}</span>
                    {plan.type === 'subscription' && (
                      <span className="text-zinc-500">/mo</span>
                    )}
                    {plan.type === 'one_time' && plan.id !== 'lifetime' && (
                      <span className="text-zinc-500">one-time</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isPopular ? 'text-blue-400' : isLifetime ? 'text-amber-400' : 'text-emerald-400'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Email input (shown when clicking without being logged in) */}
                {showEmailInput === plan.id && !isAuthenticated && (
                  <div className="mb-4">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      data-testid={`email-input-${plan.id}`}
                    />
                  </div>
                )}

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={processingPlan === plan.id}
                  className={`w-full ${
                    isPopular 
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_-5px_rgba(59,130,246,0.4)]' 
                      : isLifetime
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                  data-testid={`buy-btn-${plan.id}`}
                >
                  {processingPlan === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Get ${plan.name}`
                  )}
                </Button>

                {/* Direct link fallback */}
                <button
                  onClick={() => handleDirectLink(plan.id)}
                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-400 underline"
                  data-testid={`direct-link-${plan.id}`}
                >
                  Or pay directly via Stripe
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ / Trust */}
        <div className="mt-20 text-center">
          <div className="glass-card p-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-4">100% Secure Payments</h3>
            <p className="text-zinc-400 mb-6">
              All payments are processed securely through Stripe. We never store your card details.
              After payment, you'll receive login credentials via email.
            </p>
            <div className="flex items-center justify-center gap-8 text-zinc-500 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                SSL Encrypted
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Instant Access
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Cancel Anytime
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
