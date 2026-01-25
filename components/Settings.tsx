import React, { useState, useEffect } from 'react';
import { updateSiteAvatar, updateSocialLinks, getSocialLinks } from '../services/githubService';
import { Input } from './ui/Input';
import { Loader2, UserCircle, Share2 } from 'lucide-react';
import { ImagePicker } from './ImagePicker';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'social'>('general');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // General State
  const [avatarUrl, setAvatarUrl] = useState('');

  // Social State
  const [socialLinks, setSocialLinks] = useState({
      facebook: '', instagram: '', tiktok: '', youtube: '', telegram: ''
  });

  useEffect(() => {
      loadSettings();
  }, []);

  const loadSettings = async () => {
      const links = await getSocialLinks();
      setSocialLinks(links);
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
                    <h3 className="text-lg font-bold text-white mb-4">الملف الشخصي (Profile Picture)</h3>
                    <p className="text-gray-400 text-xs mb-2">سيتم تحديث الصورة الشخصية في جميع ملفات HTML.</p>
                    <Input 
                        label="رابط الصورة الشخصية الجديدة" 
                        value={avatarUrl} 
                        onChange={e => setAvatarUrl(e.target.value)} 
                        placeholder="https://... (يفضل me.jpg)" 
                    />
                    <div className="flex justify-end -mt-2 mb-4">
                        <ImagePicker onSelect={(url) => setAvatarUrl(url)} type="profile" />
                    </div>
                    <button onClick={handleAvatarUpdate} disabled={loading} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm">
                        {loading ? <Loader2 className="animate-spin inline w-4 h-4"/> : 'تحديث الصورة'}
                    </button>
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