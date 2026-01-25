
import React, { useEffect, useState } from 'react';
import { getAboutData, saveAboutData } from '../services/githubService';
import { AboutPageData } from '../types';
import { Input, TextArea } from './ui/Input';
import { Loader2, Save, Info } from 'lucide-react';
import { ImagePicker } from './ImagePicker';

export const AboutEditor: React.FC = () => {
  const [data, setData] = useState<AboutPageData>({
      title: '', bio: '', image: '', headerImage: '', 
      profileSize: 'medium', telegramLink: '', 
      section1Title: 'بوت الطلبات', section1Items: [],
      section2Title: 'طرق البحث', section2Items: [],
      listItems: [] // Legacy, unused
  });
  
  const [section1Text, setSection1Text] = useState('');
  const [section2Text, setSection2Text] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const pageData = await getAboutData();
      setData(pageData);
      setSection1Text(pageData.section1Items.join('\n'));
      setSection2Text(pageData.section2Items.join('\n'));
    } catch (e: any) {
      setStatus('خطأ في تحميل البيانات: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus('جاري الحفظ...');
    try {
      await saveAboutData({
        ...data,
        section1Items: section1Text.split('\n').filter(i => i.trim()),
        section2Items: section2Text.split('\n').filter(i => i.trim()),
        listItems: [] // Unused now
      }, setStatus);
    } catch (e: any) {
        setStatus('فشل الحفظ: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg border border-slate-700 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Info className="w-6 h-6" /> تعديل صفحة من نحن
      </h2>

      <div className="space-y-6">
        {/* Banner Section */}
        <div className="space-y-2">
            <h3 className="text-white font-medium border-b border-slate-700 pb-2 mb-4">الغلاف والمظهر</h3>
            
            <Input 
                label="صورة الغلاف (بدلاً من اللون الأزرق)" 
                value={data.headerImage} 
                onChange={e => setData({...data, headerImage: e.target.value})}
                placeholder="اتركها فارغة لاستخدام اللون الأزرق الافتراضي..."
            />
            <div className="flex justify-end -mt-2 mb-4">
                 <ImagePicker onSelect={(url) => setData({...data, headerImage: url})} />
            </div>

            <div className="bg-slate-900 p-4 rounded border border-slate-700 flex items-center gap-4">
                <div className={`rounded-full overflow-hidden border-2 border-white bg-slate-800 relative ${
                    data.profileSize === 'small' ? 'w-10 h-10' : data.profileSize === 'large' ? 'w-16 h-16' : 'w-12 h-12'
                }`}>
                    {data.image ? <img src={data.image} alt="Preview" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-400 mb-2">حجم الصورة الشخصية</label>
                    <select 
                        value={data.profileSize}
                        onChange={(e) => setData({...data, profileSize: e.target.value as any})}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                    >
                        <option value="small">صغير (Small)</option>
                        <option value="medium">متوسط (Medium)</option>
                        <option value="large">كبير (Large)</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Content Section */}
        <div className="space-y-2 pt-4">
            <h3 className="text-white font-medium border-b border-slate-700 pb-2 mb-4">المحتوى الأساسي</h3>

            <Input 
            label="عنوان الصفحة" 
            value={data.title} 
            onChange={e => setData({...data, title: e.target.value})}
            placeholder="من نحن"
            />

            <div>
            <Input 
                label="رابط الصورة الشخصية" 
                value={data.image} 
                onChange={e => setData({...data, image: e.target.value})}
                placeholder="https://..."
            />
            <div className="flex justify-end -mt-2">
                <ImagePicker onSelect={(url) => setData({...data, image: url})} type="profile" />
            </div>
            </div>

            <TextArea 
            label="النبذة التعريفية (المقدمة)" 
            value={data.bio} 
            onChange={e => setData({...data, bio: e.target.value})}
            rows={5}
            placeholder="اكتب النبذة هنا..."
            />
        </div>

        {/* Sections */}
        <div className="space-y-2 pt-4">
            <h3 className="text-white font-medium border-b border-slate-700 pb-2 mb-4">الأقسام والقوائم</h3>

            {/* Section 1 */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-600 mb-4">
                <Input 
                    label="عنوان القسم الأول (مثل: بوت الطلبات)" 
                    value={data.section1Title} 
                    onChange={e => setData({...data, section1Title: e.target.value})}
                    placeholder="بوت الطلبات..."
                />
                <TextArea 
                    label="محتوى القسم الأول (كل نقطة في سطر)" 
                    value={section1Text} 
                    onChange={e => setSection1Text(e.target.value)}
                    placeholder="ارسل اسم التطبيق..."
                    rows={4}
                />
                <Input 
                    label="رابط زر القسم الأول (اختياري)" 
                    value={data.telegramLink} 
                    onChange={e => setData({...data, telegramLink: e.target.value})}
                    placeholder="https://t.me/..."
                />
            </div>

             {/* Section 2 */}
             <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                <Input 
                    label="عنوان القسم الثاني (مثل: طرق البحث / سياسة الخصوصية)" 
                    value={data.section2Title} 
                    onChange={e => setData({...data, section2Title: e.target.value})}
                    placeholder="طرق البحث..."
                />
                <TextArea 
                    label="محتوى القسم الثاني (كل نقطة في سطر)" 
                    value={section2Text} 
                    onChange={e => setSection2Text(e.target.value)}
                    placeholder="ابحث بالقناة..."
                    rows={4}
                />
            </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-700 mt-4">
           <span className="text-sm text-yellow-400 font-mono">{status}</span>
           <button
             onClick={handleSave}
             disabled={loading}
             className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
           >
             {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
             حفظ التغييرات
           </button>
        </div>
      </div>
    </div>
  );
};
