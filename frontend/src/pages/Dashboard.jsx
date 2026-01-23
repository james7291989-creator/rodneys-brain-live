import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  Plus, 
  Folder, 
  Clock, 
  Trash2, 
  ExternalLink,
  Search,
  Loader2,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES = {
  created: 'status-badge status-created',
  generating: 'status-badge status-generating',
  completed: 'status-badge status-completed',
  error: 'status-badge status-error',
};

const STATUS_LABELS = {
  created: 'Created',
  generating: 'Generating',
  completed: 'Completed',
  error: 'Error',
};

export const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectPrompt, setNewProjectPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    loadProjects();
  }, [isAuthenticated, navigate]);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectPrompt.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setCreating(true);
    try {
      const project = await projectsApi.create({
        name: newProjectPrompt.slice(0, 50),
        prompt: newProjectPrompt,
      });
      setCreateDialogOpen(false);
      setNewProjectPrompt('');
      navigate(`/generate/${project.id}`);
    } catch (error) {
      toast.error('Failed to create project');
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await projectsApi.delete(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success('Project deleted');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleProjectClick = (project) => {
    if (project.status === 'completed') {
      navigate(`/project/${project.id}`);
    } else {
      navigate(`/generate/${project.id}`);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Welcome back, {user?.name}
            </h1>
            <p className="text-zinc-400">
              {projects.length} project{projects.length !== 1 ? 's' : ''} created
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="generate-btn" data-testid="create-project-btn">
                <Plus className="w-5 h-5 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  Create New Project
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="form-label">What do you want to build?</label>
                  <textarea
                    value={newProjectPrompt}
                    onChange={(e) => setNewProjectPrompt(e.target.value)}
                    placeholder="Describe your app idea..."
                    className="form-input resize-none h-32"
                    maxLength={500}
                    data-testid="new-project-prompt"
                  />
                </div>
                <Button
                  onClick={handleCreateProject}
                  disabled={creating || !newProjectPrompt.trim()}
                  className="w-full generate-btn"
                  data-testid="create-project-submit"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate App
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="form-input pl-12"
            data-testid="search-input"
          />
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="glass-card p-12 text-center">
            {projects.length === 0 ? (
              <>
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Folder className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
                <p className="text-zinc-400 mb-6">Create your first app with Famous AI</p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="generate-btn"
                  data-testid="empty-create-btn"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Project
                </Button>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No projects match your search</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project)}
                className="project-card cursor-pointer group"
                data-testid={`project-card-${project.id}`}
              >
                {/* Preview thumbnail or placeholder */}
                <div className="aspect-video bg-zinc-800 rounded-lg mb-4 overflow-hidden relative">
                  {project.preview_html ? (
                    <iframe
                      srcDoc={project.preview_html}
                      className="w-full h-full pointer-events-none"
                      title={project.name}
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-3">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Project info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-zinc-500 truncate">
                      {project.prompt}
                    </p>
                  </div>
                  <span className={STATUS_STYLES[project.status] || STATUS_STYLES.created}>
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(project.created_at)}
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                    data-testid={`delete-project-${project.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
