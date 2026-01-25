import React, { useState } from 'react';
import { updateGlobalAds } from '../services/githubService';
import { Input } from './ui/Input';
import { ImagePicker } from './ImagePicker';
import { Megaphone, Save, Loader2, Layers } from 'lucide-react';

export const AdsManager: React.FC = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [adSlotId, setAdSlotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleUpdate = async () => {
    if (!imageUrl || !linkUrl) {
        alert("يرجى إدخال رابط الصورة ورابط الإعلان");
        return;
    }

    if (!window.confirm("هل أنت متأكد؟ سيتم استبدال جميع مساحات الإعلانات بنظام Hybrid (Google + صورة).")) return;

    setLoading(true);
    setStatus("جاري البدء...");
    try {
        await updateGlobalAds(imageUrl, linkUrl, adSlotId || 'YOUR_AD_SLOT_ID', setStatus);
        setStatus("تم تحديث جميع الإعلانات بنجاح!");
    } catch (e: any) {
        setStatus("خطأ: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg border border-slate-700 max-w-2xl mx-auto space-y-8">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-accent" /> إدارة الإعلانات (النظام الهجين)
        </h2>

        <div className="space-y-4">
            <div className="bg-blue-900/20 border border-blue-800 p-4 rounded text-sm text-blue-200">
                <h4 className="font-bold flex items-center gap-2 mb-2"><Layers className="w-4 h-4"/> كيف يعمل النظام؟</h4>
                <p>
                    يعتمد هذا النظام على عرض <strong>إعلان جوجل</strong> كأولوية قصوى. في حال فشل جوجل في تحميل الإعلان (لأي سبب)، ستظهر <strong>الصورة المخصصة</strong> تلقائياً أسفل الإعلان الفارغ لتملأ المكان.
                </p>
            </div>

            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <Input 
                    label="معرف وحدة إعلانات جوجل (AdSense Slot ID)" 
                    value={adSlotId} 
                    onChange={e => setAdSlotId(e.target.value)}
                    placeholder="مثال: 89324567..."
                />
                
                <div className="border-t border-slate-700 pt-4 mt-4">
                    <h3 className="text-white font-medium mb-4">الإعلان البديل (الاحتياطي)</h3>
                    <div>
                        <Input 
                            label="رابط الصورة البديلة" 
                            value={imageUrl} 
                            onChange={e => setImageUrl(e.target.value)}
                            placeholder="https://..."
                        />
                        <div className="flex justify-end -mt-2">
                            <ImagePicker onSelect={(url) => setImageUrl(url)} />
                        </div>
                    </div>

                    <Input 
                        label="رابط التوجيه (عند الضغط على الصورة)" 
                        value={linkUrl} 
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder="https://example.com/promo"
                    />
                </div>

                {/* Preview */}
                {imageUrl && (
                    <div className="mt-6 border border-slate-700 rounded p-4 bg-slate-900">
                        <span className="text-xs text-gray-500 mb-2 block">معاينة الصورة البديلة:</span>
                        <div className="w-full relative">
                            <a href="#" onClick={e => e.preventDefault()} className="block cursor-default">
                                <img 
                                    src={imageUrl} 
                                    alt="Preview" 
                                    className="w-full h-auto rounded-xl shadow-md"
                                />
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-700">
                <span className="text-sm text-yellow-400 font-mono min-h-[20px]">{status}</span>
                
                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="w-full bg-accent hover:bg-accent/80 text-white py-3 rounded font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    تحديث نظام الإعلانات في كل الموقع
                </button>
            </div>
        </div>
    </div>
  );
};