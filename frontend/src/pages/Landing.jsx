import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { projectsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { 
  Sparkles, 
  Zap, 
  Code2, 
  Layers, 
  ArrowRight,
  Play,
  Github,
  Terminal
} from 'lucide-react';
import { toast } from 'sonner';

const EXAMPLE_PROMPTS = [
  "A todo app with dark mode and local storage",
  "Landing page for a SaaS product with pricing",
  "Portfolio website with project gallery",
  "Weather dashboard with city search",
  "Recipe finder with ingredient filters",
];

export const Landing = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!isAuthenticated) {
      setShowAuth(true);
      return;
    }

    setLoading(true);
    try {
      const project = await projectsApi.create({
        name: prompt.slice(0, 50),
        prompt: prompt,
      });
      navigate(`/generate/${project.id}`);
    } catch (error) {
      toast.error('Failed to create project');
      setLoading(false);
    }
  };

  const handleExampleClick = (example) => {
    setPrompt(example);
  };

  return (
    <div className="min-h-screen noise-bg">
      {/* Hero Section */}
      <section className="hero-section hero-glow pt-24">
        <div className="hero-content stagger-children">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 rounded-full px-4 py-2 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-sm text-zinc-300 font-medium">Famous AI • Self-hosted App Builder</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <span className="text-gradient">Generate beautiful</span>
            <br />
            <span className="text-white">web apps with AI</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Describe your app in plain English. Watch as Famous AI generates production-ready 
            code in real-time. No coding required.
          </p>

          {/* Prompt Input */}
          <div className="prompt-container" data-testid="prompt-container">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the web app you want to build..."
                className="prompt-input resize-none h-32"
                maxLength={500}
                data-testid="prompt-input"
              />
              <div className="absolute bottom-4 right-4 text-xs text-zinc-500">
                {prompt.length}/500
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="generate-btn flex-1 flex items-center justify-center gap-2 text-lg"
                data-testid="generate-btn"
              >
                {loading ? (
                  <>
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate My App
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Example prompts */}
          <div className="mt-8">
            <p className="text-sm text-zinc-500 mb-3">Try an example:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_PROMPTS.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="text-sm bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white px-4 py-2 rounded-full transition-all duration-200"
                  data-testid={`example-prompt-${i}`}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/4 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              How it works
            </h2>
            <p className="text-zinc-400 text-lg">
              From idea to live app in seconds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Terminal,
                title: 'Describe',
                description: 'Tell Famous AI what you want to build in plain English. Be as detailed as you like.',
              },
              {
                icon: Code2,
                title: 'Generate',
                description: 'Watch as AI writes HTML, CSS, and JavaScript in real-time with live syntax highlighting.',
              },
              {
                icon: Play,
                title: 'Preview',
                description: 'See your app come to life instantly with hot-reload preview. Edit and iterate.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="glass-card p-8 hover:-translate-y-2 transition-transform duration-300"
                data-testid={`feature-card-${i}`}
              >
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-24 px-6 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-12 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Layers className="w-6 h-6 text-blue-400" />
              <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Self-hosted & Open Source</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Your infrastructure, your data
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto mb-8">
              RodneysBrain runs entirely on your own servers. No vendor lock-in, 
              no data leaving your control. Deploy with a single command.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-zinc-800/50 px-4 py-2 rounded-lg text-sm text-zinc-300">
                <Zap className="w-4 h-4 inline mr-2 text-amber-400" />
                FastAPI Backend
              </div>
              <div className="bg-zinc-800/50 px-4 py-2 rounded-lg text-sm text-zinc-300">
                <Code2 className="w-4 h-4 inline mr-2 text-blue-400" />
                React Frontend
              </div>
              <div className="bg-zinc-800/50 px-4 py-2 rounded-lg text-sm text-zinc-300">
                <Github className="w-4 h-4 inline mr-2 text-white" />
                MIT Licensed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Ready to build something?
          </h2>
          <p className="text-zinc-400 text-lg mb-8">
            Start generating apps now. No credit card required.
          </p>
          <Button
            onClick={() => {
              if (!isAuthenticated) {
                setShowAuth(true);
              } else {
                navigate('/dashboard');
              }
            }}
            className="generate-btn text-lg px-12 py-6"
            data-testid="cta-btn"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <span className="text-zinc-400 text-sm">
              RodneysBrain • Famous AI App Builder
            </span>
          </div>
          <p className="text-zinc-500 text-sm">
            Self-hosted. Open source. MIT License.
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        initialMode="register"
      />
    </div>
  );
};

export default Landing;
