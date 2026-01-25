import React, { useState } from 'react';
import { ArticleList } from './components/ArticleList';
import { ArticleEditor } from './components/ArticleEditor';
import { TickerEditor } from './components/TickerEditor';
import { AboutEditor } from './components/AboutEditor';
import { SitesEditor } from './components/SitesEditor';
import { AdsManager } from './components/AdsManager';
import { Settings } from './components/Settings';
import { setGithubToken, getGithubToken } from './services/githubService';
import { Input } from './components/ui/Input';
import { Lock, Plus, Newspaper, LayoutDashboard, Settings as SettingsIcon, Info, Globe, Megaphone } from 'lucide-react';

const App: React.FC = () => {
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'settings' | 'about' | 'sites' | 'ads'>('list');
  const [editFile, setEditFile] = useState<string | undefined>();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.startsWith('gh')) {
      setGithubToken(token);
      setAuthenticated(true);
    } else {
      alert("صيغة الرمز غير صحيحة. يجب أن يبدأ بـ 'ghp_' أو 'github_pat_'");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface p-8 rounded-xl border border-slate-700 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary/20 rounded-full">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-white mb-2">دخول نظام إدارة المحتوى</h1>
          <p className="text-center text-gray-400 mb-6">أدخل رمز الوصول الشخصي (Token) الخاص بـ GitHub لإدارة مستودع TechTouch.</p>
          
          <form onSubmit={handleAuth}>
            <Input 
              label="رمز GitHub" 
              type="password" 
              value={token} 
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_..."
              autoFocus
            />
            <button className="w-full bg-primary hover:bg-blue-600 text-white py-3 rounded font-bold mt-4 transition-colors">
              اتصال بالمستودع
            </button>
          </form>
          <p className="mt-4 text-xs text-center text-gray-500">
            الرمز يتطلب صلاحية 'repo'. يتم استخدامه بشكل آمن في الذاكرة فقط.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-200 font-sans selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-slate-700 bg-surface/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-primary to-accent w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white">
              TT
            </div>
            <span className="font-bold text-xl tracking-tight text-white hidden sm:block">لوحة تحكم TechTouch</span>
          </div>
          
          <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
            <button 
              onClick={() => { setView('list'); setEditFile(undefined); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'list' ? 'bg-slate-700 text-white' : 'hover:text-white text-gray-400'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> المقالات
            </button>
             <button 
              onClick={() => { setView('create'); setEditFile(undefined); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'create' ? 'bg-slate-700 text-white' : 'hover:text-white text-gray-400'}`}
            >
              <Plus className="w-4 h-4" /> مقال جديد
            </button>
            <button 
              onClick={() => { setView('ads'); setEditFile(undefined); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'ads' ? 'bg-slate-700 text-white' : 'hover:text-white text-gray-400'}`}
            >
              <Megaphone className="w-4 h-4" /> الإعلانات
            </button>
            <button 
              onClick={() => { setView('sites'); setEditFile(undefined); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'sites' ? 'bg-slate-700 text-white' : 'hover:text-white text-gray-400'}`}
            >
              <Globe className="w-4 h-4" /> الدليل
            </button>
            <button 
              onClick={() => { setView('about'); setEditFile(undefined); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'about' ? 'bg-slate-700 text-white' : 'hover:text-white text-gray-400'}`}
            >
              <Info className="w-4 h-4" /> من نحن
            </button>
            <button 
              onClick={() => { setView('settings'); setEditFile(undefined); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${view === 'settings' ? 'bg-slate-700 text-white' : 'hover:text-white text-gray-400'}`}
            >
              <SettingsIcon className="w-4 h-4" /> الإعدادات
            </button>
          </nav>

          <div className="w-0 sm:w-8"></div> {/* Spacer for balance */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'list' && (
          <div className="space-y-8">
            <TickerEditor />
            <ArticleList onEdit={(file) => {
              setEditFile(file);
              setView('edit');
            }} />
          </div>
        )}

        {(view === 'create' || view === 'edit') && (
          <ArticleEditor 
            editFileName={editFile} 
            onClose={() => {
              setView('list');
              setEditFile(undefined);
            }} 
          />
        )}
        
        {view === 'about' && <AboutEditor />}
        
        {view === 'sites' && <SitesEditor />}
        
        {view === 'ads' && <AdsManager />}

        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
};

export default App;