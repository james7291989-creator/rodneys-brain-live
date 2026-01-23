import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectsApi, generateCode } from '../lib/api';
import Editor from '@monaco-editor/react';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Play,
  RefreshCw,
  FileCode,
  Eye,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

export const Generator = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [files, setFiles] = useState({});
  const [activeFile, setActiveFile] = useState('index.html');
  const [previewHtml, setPreviewHtml] = useState('');
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  
  const previewRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    loadProject();
  }, [projectId, isAuthenticated, navigate]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadProject = async () => {
    try {
      const data = await projectsApi.get(projectId);
      setProject(data);
      
      if (data.files && Object.keys(data.files).length > 0) {
        setFiles(data.files);
        setActiveFile(Object.keys(data.files)[0]);
      }
      
      if (data.preview_html) {
        setPreviewHtml(data.preview_html);
      }
      
      // Auto-start generation if project is new
      if (data.status === 'created') {
        startGeneration(data);
      }
    } catch (error) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const addLog = (type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, message, timestamp }]);
  };

  const startGeneration = async (proj = project) => {
    if (!proj) return;
    
    setGenerating(true);
    setLogs([]);
    setFiles({});
    
    addLog('info', 'Starting Famous AI code generation...');
    addLog('info', `Prompt: "${proj.prompt}"`);

    try {
      await generateCode(proj.id, proj.prompt, (event) => {
        switch (event.type) {
          case 'status':
            addLog('info', event.content);
            break;
          case 'file':
            addLog('success', `Generated: ${event.filename}`);
            setFiles(prev => ({ ...prev, [event.filename]: event.content }));
            if (!activeFile || activeFile === 'index.html') {
              setActiveFile(event.filename);
            }
            break;
          case 'preview':
            setPreviewHtml(event.content);
            addLog('success', 'Preview ready!');
            break;
          case 'complete':
            addLog('success', event.content);
            break;
          case 'error':
            addLog('error', event.content);
            break;
          default:
            break;
        }
      });

      // Reload project to get final state
      const updatedProject = await projectsApi.get(proj.id);
      setProject(updatedProject);
      
    } catch (error) {
      addLog('error', `Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (generating) return;
    startGeneration();
  };

  const handleCopyCode = async () => {
    const code = files[activeFile] || '';
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshPreview = () => {
    if (previewRef.current) {
      previewRef.current.src = previewRef.current.src;
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
    <div className="min-h-screen pt-20 pb-6 px-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="text-zinc-400 hover:text-white"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white truncate max-w-md" data-testid="project-name">
                {project?.name}
              </h1>
              <p className="text-sm text-zinc-500 truncate max-w-md">
                {project?.prompt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRegenerate}
              disabled={generating}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
              data-testid="regenerate-btn"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor Panel */}
          <div className="glass-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white">Code</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="text-zinc-400 hover:text-white h-8"
                data-testid="copy-code-btn"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* File tabs */}
            {Object.keys(files).length > 0 && (
              <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10 overflow-x-auto">
                {Object.keys(files).map((filename) => (
                  <button
                    key={filename}
                    onClick={() => setActiveFile(filename)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      activeFile === filename
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                    data-testid={`file-tab-${filename}`}
                  >
                    {filename}
                  </button>
                ))}
              </div>
            )}

            {/* Monaco Editor */}
            <div className="flex-1">
              {generating && Object.keys(files).length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
                    <p className="text-zinc-400">Generating code...</p>
                  </div>
                </div>
              ) : (
                <Editor
                  height="100%"
                  language={
                    activeFile?.endsWith('.html') ? 'html' :
                    activeFile?.endsWith('.css') ? 'css' :
                    activeFile?.endsWith('.js') ? 'javascript' : 'html'
                  }
                  value={files[activeFile] || '// No code generated yet'}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 16 },
                  }}
                />
              )}
            </div>
          </div>

          {/* Preview & Console Panel */}
          <div className="flex flex-col gap-6" style={{ height: 'calc(100vh - 200px)' }}>
            {/* Preview */}
            <div className="glass-card overflow-hidden flex-1 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">Preview</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshPreview}
                  className="text-zinc-400 hover:text-white h-8"
                  data-testid="refresh-preview-btn"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 bg-white">
                {previewHtml ? (
                  <iframe
                    ref={previewRef}
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    title="Preview"
                    sandbox="allow-scripts allow-same-origin"
                    data-testid="preview-iframe"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-zinc-100">
                    <p className="text-zinc-400">Preview will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Console */}
            <div className="glass-card overflow-hidden h-48 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-white">Console</span>
                {generating && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-amber-400">
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                    Generating...
                  </span>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 font-mono text-xs space-y-1">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 ${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-emerald-400' :
                        'text-zinc-400'
                      }`}
                    >
                      {log.type === 'error' ? (
                        <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      ) : log.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      ) : (
                        <span className="text-zinc-600">[{log.timestamp}]</span>
                      )}
                      <span>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generator;
