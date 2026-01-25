import React, { useState, useEffect } from 'react';
import { updateSiteAvatar, rebuildDatabase, updateSocialLinks, getSocialLinks, performFullSiteAnalysis, getMetadata } from '../services/githubService';
import { Input, TextArea } from './ui/Input';
import { Loader2, Save, UserCircle, Database, RefreshCw, CheckCircle, AlertTriangle, Share2, Bot, BrainCircuit, Activity } from 'lucide-react';
import { ImagePicker } from './ImagePicker';
import { AIConfig, AIAnalysisKnowledge } from '../types';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'social'>('general');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // General State
  const [avatarUrl, setAvatarUrl] = useState('');
  const [rebuildStatus, setRebuildStatus] = useState('');
  const [rebuilding, setRebuilding] = useState(false);

  // AI State
  const [aiConfig, setAiConfig] = useState<AIConfig>({
      geminiKey: '', groqKey: '', huggingFaceKey: '', preferredProvider: 'gemini'
  });
  const [aiKnowledge, setAiKnowledge] = useState<AIAnalysisKnowledge | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Social State
  const [socialLinks, setSocialLinks] = useState({
      facebook: '', instagram: '', tiktok: '', youtube: '', telegram: ''
  });

  useEffect(() => {
      loadSettings();
  }, []);

  const loadSettings = async () => {
      // Load AI Config from LocalStorage
      const storedAi = localStorage.getItem('techTouch_ai_config');
      if (storedAi) setAiConfig(JSON.parse(storedAi));

      // Load Socials & Metadata
      const links = await getSocialLinks();
      setSocialLinks(links);

      try {
          const { data } = await getMetadata();
          if (data.aiKnowledge) setAiKnowledge(data.aiKnowledge);
      } catch (e) { console.log("No metadata yet"); }
  };

  const handleAiConfigSave = () => {
      localStorage.setItem('techTouch_ai_config', JSON.stringify(aiConfig));
      setStatus("تم حفظ إعدادات الذكاء الاصطناعي في المتصفح بنجاح.");
      setTimeout(() => setStatus(''), 3000);
  };

  const handleAnalyzeSite = async () => {
      setAnalyzing(true);
      setStatus("جاري قراءة ملفات الموقع وتحليلها...");
      try {
          const knowledge = await performFullSiteAnalysis((msg) => setStatus(msg));
          setAiKnowledge(knowledge);
          setStatus("تم التحليل وتحديث قاعدة المعرفة بنجاح!");
      } catch (e: any) {
          setStatus("فشل التحليل: " + e.message);
      } finally {
          setAnalyzing(false);
      }
  };

  const handleAvatarUpdate = async () => {
    if (!avatarUrl) return;
    setLoading(true);
    setStatus('جاري تحديث الصورة...');
    try {
      await updateSiteAvatar(avatarUrl, setStatus);
      setStatus('تم تحديث الصورة الشخصية في جميع الصفحات بنجاح!');
    } catch (e: any) {
      setStatus('خطأ: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    if (!window.confirm("هل أنت متأكد؟ سيقوم هذا الإجراء بإعادة بناء metadata.json.")) return;
    setRebuilding(true);
    setRebuildStatus('جاري فحص الملفات...');
    try {
        await rebuildDatabase((msg) => setRebuildStatus(msg));
        setRebuildStatus('تمت العملية بنجاح!');
    } catch (e: any) {
        setRebuildStatus('فشلت العملية: ' + e.message);
    } finally {
        setRebuilding(false);
    }
  };

  const handleSocialUpdate = async () => {
      setLoading(true);
      try {
          await updateSocialLinks(socialLinks, (msg) => setStatus(msg));
          setStatus("تم تحديث الروابط!");
      } catch (e: any) {
          setStatus("فشل التحديث: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded font-medium flex items-center gap-2 transition-colors ${activeTab === 'general' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
          >
              <UserCircle className="w-4 h-4" /> عام
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded font-medium flex items-center gap-2 transition-colors ${activeTab === 'ai' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
          >
              <BrainCircuit className="w-4 h-4" /> الذكاء الاصطناعي
          </button>
          <button 
            onClick={() => setActiveTab('social')}
            className={`px-4 py-2 rounded font-medium flex items-center gap-2 transition-colors ${activeTab === 'social' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
          >
              <Share2 className="w-4 h-4" /> التواصل الاجتماعي
          </button>
      </div>

      <div className="bg-surface p-6 rounded-lg border border-slate-700 min-h-[400px]">
        
        {/* Status Bar */}
        {status && <div className="mb-4 p-3 bg-blue-900/30 border border-blue-800 text-blue-200 rounded text-sm">{status}</div>}

        {/* --- GENERAL TAB --- */}
        {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in">
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">الملف الشخصي</h3>
                    <Input 
                        label="رابط الصورة الشخصية الجديدة" 
                        value={avatarUrl} 
                        onChange={e => setAvatarUrl(e.target.value)} 
                        placeholder="https://..." 
                    />
                    <div className="flex justify-end -mt-2 mb-4">
                        <ImagePicker onSelect={(url) => setAvatarUrl(url)} type="profile" />
                    </div>
                    <button onClick={handleAvatarUpdate} disabled={loading} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm">
                        {loading ? <Loader2 className="animate-spin inline w-4 h-4"/> : 'تحديث الصورة'}
                    </button>
                </div>

                <div className="border-t border-slate-700 pt-6">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                        <Database className="w-5 h-5 text-orange-400" /> صيانة قاعدة البيانات
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">إصلاح ملف metadata.json في حال عدم تطابقه مع الملفات.</p>
                    <div className="flex items-center gap-4">
                        <button onClick={handleRebuild} disabled={rebuilding} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm">
                            {rebuilding ? 'جاري الفحص...' : 'إصلاح البيانات'}
                        </button>
                        <span className="text-xs text-gray-500">{rebuildStatus}</span>
                    </div>
                </div>
            </div>
        )}

        {/* --- AI CONFIG TAB --- */}
        {activeTab === 'ai' && (
            <div className="space-y-8 animate-in fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Keys Configuration */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Bot className="w-5 h-5 text-accent" /> مزودو الخدمة
                        </h3>
                        <p className="text-xs text-gray-400">سيتم استخدام المزود المفضل أولاً، وفي حال الفشل سينتقل للنظام التالي.</p>
                        
                        <div className="space-y-3">
                            <div className="p-3 bg-slate-900 rounded border border-slate-600">
                                <label className="flex items-center justify-between text-sm font-bold text-blue-400 mb-2">
                                    <span>Google Gemini (الأسرع)</span>
                                    <input type="radio" name="pref" checked={aiConfig.preferredProvider === 'gemini'} onChange={() => setAiConfig({...aiConfig, preferredProvider: 'gemini'})} />
                                </label>
                                <input 
                                    type="password" 
                                    value={aiConfig.geminiKey}
                                    onChange={e => setAiConfig({...aiConfig, geminiKey: e.target.value})}
                                    placeholder="API Key..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                />
                            </div>

                            <div className="p-3 bg-slate-900 rounded border border-slate-600">
                                <label className="flex items-center justify-between text-sm font-bold text-orange-400 mb-2">
                                    <span>Groq (Llama 3 - دقيق)</span>
                                    <input type="radio" name="pref" checked={aiConfig.preferredProvider === 'groq'} onChange={() => setAiConfig({...aiConfig, preferredProvider: 'groq'})} />
                                </label>
                                <input 
                                    type="password" 
                                    value={aiConfig.groqKey}
                                    onChange={e => setAiConfig({...aiConfig, groqKey: e.target.value})}
                                    placeholder="gsk_..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                />
                            </div>

                            <div className="p-3 bg-slate-900 rounded border border-slate-600">
                                <label className="flex items-center justify-between text-sm font-bold text-yellow-400 mb-2">
                                    <span>Hugging Face (احتياطي)</span>
                                    <input type="radio" name="pref" checked={aiConfig.preferredProvider === 'huggingface'} onChange={() => setAiConfig({...aiConfig, preferredProvider: 'huggingface'})} />
                                </label>
                                <input 
                                    type="password" 
                                    value={aiConfig.huggingFaceKey}
                                    onChange={e => setAiConfig({...aiConfig, huggingFaceKey: e.target.value})}
                                    placeholder="hf_..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>
                        
                        <button onClick={handleAiConfigSave} className="w-full bg-primary hover:bg-blue-600 text-white py-2 rounded font-bold transition-colors">
                            حفظ المفاتيح
                        </button>
                    </div>

                    {/* AI Knowledge Display */}
                    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-green-400" /> تحليل الموقع
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    ماذا يعرف الذكاء الاصطناعي عن هيكل موقعك؟
                                </p>
                            </div>
                            <button 
                                onClick={handleAnalyzeSite} 
                                disabled={analyzing}
                                className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded text-white flex items-center gap-1"
                            >
                                {analyzing ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                                تحليل الآن
                            </button>
                        </div>

                        <div className="flex-1 bg-black/50 rounded p-3 overflow-y-auto text-xs font-mono text-gray-300 border border-slate-800">
                            {aiKnowledge ? (
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-blue-400 block mb-1">// آخر تحديث: {new Date(aiKnowledge.lastAnalyzed).toLocaleString('ar')}</span>
                                    </div>
                                    <div>
                                        <span className="text-accent block mb-1"># نمط البطاقات (Articles):</span>
                                        <p className="whitespace-pre-wrap">{aiKnowledge.cardStructure}</p>
                                    </div>
                                    <div>
                                        <span className="text-accent block mb-1"># نمط الدليل (Directory):</span>
                                        <p className="whitespace-pre-wrap">{aiKnowledge.directoryStructure}</p>
                                    </div>
                                    <div>
                                        <span className="text-accent block mb-1"># الألوان المكتشفة:</span>
                                        <p>[{aiKnowledge.colorsDetected?.join(', ') || 'N/A'}]</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-600">
                                    لم يتم إجراء تحليل للموقع بعد. اضغط على "تحليل الآن".
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- SOCIAL TAB --- */}
        {activeTab === 'social' && (
            <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-bold text-white">روابط التواصل (Footer)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Facebook" value={socialLinks.facebook} onChange={e => setSocialLinks({...socialLinks, facebook: e.target.value})} />
                    <Input label="Instagram" value={socialLinks.instagram} onChange={e => setSocialLinks({...socialLinks, instagram: e.target.value})} />
                    <Input label="TikTok" value={socialLinks.tiktok} onChange={e => setSocialLinks({...socialLinks, tiktok: e.target.value})} />
                    <Input label="YouTube" value={socialLinks.youtube} onChange={e => setSocialLinks({...socialLinks, youtube: e.target.value})} />
                    <Input label="Telegram" value={socialLinks.telegram} onChange={e => setSocialLinks({...socialLinks, telegram: e.target.value})} />
                </div>
                <div className="flex justify-end">
                    <button onClick={handleSocialUpdate} disabled={loading} className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded font-bold">
                        {loading ? <Loader2 className="animate-spin" /> : 'حفظ الروابط'}
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};