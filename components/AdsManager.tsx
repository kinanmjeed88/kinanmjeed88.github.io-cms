import React, { useState } from 'react';
import { updateGlobalAds } from '../services/githubService';
import { Input } from './ui/Input';
import { ImagePicker } from './ImagePicker';
import { Megaphone, Save, Loader2, Info } from 'lucide-react';
import { RepoConfig } from '../types';

export const AdsManager: React.FC = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [adSlotId, setAdSlotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Determine which mode we are in
  const isCustomMode = !!imageUrl;

  const handleUpdate = async () => {
    if (isCustomMode && !linkUrl) {
        alert("في حالة الإعلان الخاص، يجب وضع رابط للإعلان.");
        return;
    }

    if (!window.confirm(isCustomMode ? 
        "سيتم تحويل الإعلانات إلى 'إعلان خاص' وحذف إعلانات جوجل. هل أنت متأكد؟" : 
        "سيتم تحويل الإعلانات إلى 'نظام هجين' (جوجل + صورة احتياطية). هل أنت متأكد؟")) return;

    setLoading(true);
    setStatus("جاري البدء...");
    try {
        await updateGlobalAds(imageUrl, linkUrl, adSlotId || 'YOUR_AD_SLOT_ID', setStatus);
        setStatus("تم التحديث بنجاح!");
    } catch (e: any) {
        setStatus("خطأ: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  // Helper to resolve relative paths for preview
  const getPreviewUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${cleanPath}`;
  };

  return (
    <div className="bg-surface p-6 rounded-lg border border-slate-700 max-w-2xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-accent" /> إدارة الإعلانات
        </h2>

        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded text-sm text-blue-200">
            <h4 className="font-bold flex items-center gap-2 mb-2"><Info className="w-4 h-4"/> كيف يعمل؟</h4>
            <ul className="list-disc list-inside space-y-1">
                <li>إذا تركت <strong>حقل الصورة فارغاً</strong>: سيتم تفعيل نظام Google AdSense (الهجين).</li>
                <li>إذا اخترت <strong>صورة</strong>: سيتم حذف كود جوجل وتفعيل "الإعلان الخاص" فقط (حسب الدليل).</li>
            </ul>
        </div>

        <div className="space-y-6">
            <div className={`transition-opacity ${isCustomMode ? 'opacity-50 pointer-events-none' : ''}`}>
                <Input 
                    label="Google AdSense Slot ID" 
                    value={adSlotId} 
                    onChange={e => setAdSlotId(e.target.value)}
                    placeholder="مثال: 89324567..."
                />
            </div>
            
            <div className="border-t border-slate-700 pt-6">
                <h3 className="text-white font-medium mb-4">الإعلان الخاص (Custom Ad)</h3>
                
                <div className="mb-4">
                    <Input 
                        label="رابط الصورة" 
                        value={imageUrl} 
                        onChange={e => setImageUrl(e.target.value)}
                        placeholder="اختر صورة لتفعيل الوضع الخاص..."
                    />
                    <div className="flex justify-end -mt-2">
                        <ImagePicker onSelect={(url) => setImageUrl(url)} />
                    </div>
                </div>

                <Input 
                    label="رابط التوجيه (Link URL)" 
                    value={linkUrl} 
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://t.me/..."
                />

                {imageUrl && (
                    <div className="mt-4 p-4 bg-slate-900 rounded border border-slate-700 text-center">
                        <span className="text-xs text-green-400 block mb-2">سيتم تفعيل الإعلان الخاص فقط</span>
                        <img 
                            src={getPreviewUrl(imageUrl)} 
                            alt="Preview" 
                            className="max-w-full h-auto max-h-[200px] mx-auto rounded shadow-lg object-contain"
                        />
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-700">
                <span className="text-sm text-yellow-400 font-mono block mb-2 min-h-[20px]">{status}</span>
                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="w-full bg-accent hover:bg-accent/80 text-white py-3 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {isCustomMode ? 'تثبيت الإعلان الخاص' : 'تثبيت إعلانات جوجل'}
                </button>
            </div>
        </div>
    </div>
  );
};