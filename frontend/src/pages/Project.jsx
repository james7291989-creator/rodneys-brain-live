import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../lib/api';
import Editor from '@monaco-editor/react';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../components/ui/resizable';
import {
  FileCode,
  FolderTree,
  Eye,
  ArrowLeft,
  RefreshCw,
  Download,
  Loader2,
  File,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export const Project = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const previewRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    loadProject();
  }, [projectId, isAuthenticated, navigate]);

  const loadProject = async () => {
    try {
      const data = await projectsApi.get(projectId);
      setProject(data);
      
      if (data.files && Object.keys(data.files).length > 0) {
        setActiveFile(Object.keys(data.files)[0]);
      }
    } catch (error) {
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!activeFile || !project?.files[activeFile]) return;
    await navigator.clipboard.writeText(project.files[activeFile]);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!project?.files) return;
    
    // Create a simple zip-like download of all files
    Object.entries(project.files).forEach(([filename, content]) => {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
    toast.success('Files downloaded');
  };

  const refreshPreview = () => {
    if (previewRef.current) {
      previewRef.current.src = previewRef.current.src;
    }
  };

  const getFileIcon = (filename) => {
    if (filename.endsWith('.html')) return <File className="w-4 h-4 text-orange-400" />;
    if (filename.endsWith('.css')) return <File className="w-4 h-4 text-blue-400" />;
    if (filename.endsWith('.js')) return <File className="w-4 h-4 text-yellow-400" />;
    return <File className="w-4 h-4 text-zinc-400" />;
  };

  const getLanguage = (filename) => {
    if (filename?.endsWith('.html')) return 'html';
    if (filename?.endsWith('.css')) return 'css';
    if (filename?.endsWith('.js')) return 'javascript';
    return 'plaintext';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen pt-20 pb-6 px-6">
      <div className="max-w-[1800px] mx-auto h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
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
              <h1 className="text-xl font-bold text-white truncate max-w-md flex items-center gap-2" data-testid="project-title">
                <Sparkles className="w-5 h-5 text-blue-500" />
                {project.name}
              </h1>
              <p className="text-sm text-zinc-500 truncate max-w-md">
                {project.prompt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate(`/generate/${projectId}`)}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
              data-testid="edit-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            <Button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-500 text-white"
              data-testid="download-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="glass-card overflow-hidden h-full">
          <ResizablePanelGroup direction="horizontal">
            {/* File Tree */}
            <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
              <div className="h-full flex flex-col border-r border-white/10">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <FolderTree className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-white">Files</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {Object.keys(project.files || {}).map((filename) => (
                      <button
                        key={filename}
                        onClick={() => setActiveFile(filename)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeFile === filename
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                        }`}
                        data-testid={`file-${filename}`}
                      >
                        {getFileIcon(filename)}
                        <span className="truncate">{filename}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle className="w-1 bg-white/5 hover:bg-blue-500/50 transition-colors" />

            {/* Code Editor */}
            <ResizablePanel defaultSize={45} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">
                      {activeFile || 'No file selected'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyCode}
                    className="text-zinc-400 hover:text-white h-8"
                    data-testid="copy-btn"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language={getLanguage(activeFile)}
                    value={activeFile ? project.files[activeFile] : '// Select a file'}
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
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="w-1 bg-white/5 hover:bg-blue-500/50 transition-colors" />

            {/* Preview */}
            <ResizablePanel defaultSize={40} minSize={25}>
              <div className="h-full flex flex-col">
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
                    data-testid="refresh-btn"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 bg-white">
                  {project.preview_html ? (
                    <iframe
                      ref={previewRef}
                      srcDoc={project.preview_html}
                      className="w-full h-full border-0"
                      title="Preview"
                      sandbox="allow-scripts allow-same-origin"
                      data-testid="preview-iframe"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-zinc-100">
                      <p className="text-zinc-400">No preview available</p>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
};

export default Project;
