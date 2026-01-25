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
      section1Title: '', section1Items: [],
      section2Title: '', section2Items: [],
      listItems: []
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
      setStatus('خطأ: ' + e.message);
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
      }, setStatus);
    } catch (e: any) {
        setStatus('فشل الحفظ: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface p-4 md:p-6 rounded-lg border border-slate-700 max-w-2xl mx-auto pb-20">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Info className="w-6 h-6" /> محرر صفحة "من نحن"
      </h2>

      <div className="space-y-6">
        <div className="space-y-4">
            <h3 className="text-white font-medium border-b border-slate-700 pb-2">الغلاف والمظهر</h3>
            
            <div>
                 <Input 
                    label="رابط صورة الغلاف" 
                    value={data.headerImage} 
                    onChange={e => setData({...data, headerImage: e.target.value})}
                    placeholder="رابط مباشر..."
                />
                <div className="flex justify-end -mt-2">
                    <ImagePicker onSelect={(url) => setData({...data, headerImage: url})} />
                </div>
            </div>

            <div className="bg-slate-900 p-4 rounded border border-slate-700 flex flex-col md:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white bg-slate-800 shrink-0">
                    {data.image && <img src={data.image} alt="Preview" className="w-full h-full object-cover" />}
                </div>
                <div className="w-full">
                    <Input 
                        label="رابط الصورة الشخصية" 
                        value={data.image} 
                        onChange={e => setData({...data, image: e.target.value})}
                    />
                    <div className="flex justify-end -mt-2">
                        <ImagePicker onSelect={(url) => setData({...data, image: url})} type="profile" />
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4 pt-4">
            <h3 className="text-white font-medium border-b border-slate-700 pb-2">المحتوى الأساسي</h3>
            <Input 
                label="العنوان الرئيسي (h1)" 
                value={data.title} 
                onChange={e => setData({...data, title: e.target.value})}
            />
            <TextArea 
                label="النبذة التعريفية" 
                value={data.bio} 
                onChange={e => setData({...data, bio: e.target.value})}
                rows={4}
            />
        </div>

        <div className="space-y-4 pt-4">
            <h3 className="text-white font-medium border-b border-slate-700 pb-2">القوائم والأقسام</h3>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                <Input 
                    label="عنوان القسم الأول (الأزرق)" 
                    value={data.section1Title} 
                    onChange={e => setData({...data, section1Title: e.target.value})}
                />
                <TextArea 
                    label="عناصر القائمة (عنصر في كل سطر)" 
                    value={section1Text} 
                    onChange={e => setSection1Text(e.target.value)}
                    rows={4}
                />
            </div>

             <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                <Input 
                    label="عنوان القسم الثاني (اللون البنفسجي)" 
                    value={data.section2Title} 
                    onChange={e => setData({...data, section2Title: e.target.value})}
                />
                <TextArea 
                    label="عناصر القائمة (عنصر في كل سطر)" 
                    value={section2Text} 
                    onChange={e => setSection2Text(e.target.value)}
                    rows={4}
                />
            </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-700 flex justify-between items-center z-50">
           <span className="text-xs text-yellow-400 font-mono truncate max-w-[200px]">{status}</span>
           <button
             onClick={handleSave}
             disabled={loading}
             className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 disabled:opacity-50"
           >
             {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
             حفظ
           </button>
      </div>
    </div>
  );
};