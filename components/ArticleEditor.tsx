import React, { useEffect, useState } from 'react';
import { createArticle, updateArticle, getArticleDetails } from '../services/githubService';
import { ArticleContent } from '../types';
import { Input } from './ui/Input';
import { CATEGORIES } from '../constants';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { ImagePicker } from './ImagePicker';

interface Props {
  editFileName?: string;
  onClose: () => void;
}

export const ArticleEditor: React.FC<Props> = ({ editFileName, onClose }) => {
  const [formData, setFormData] = useState<ArticleContent>({
    fileName: '',
    title: '',
    category: 'tech',
    image: '',
    description: '',
    link: '',
    mainText: '',
    videoUrl: '',
    content: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (editFileName) {
      loadArticle(editFileName);
    }
  }, [editFileName]);

  const loadArticle = async (fileName: string) => {
    setStatus(`جاري تحميل ${fileName}...`);
    try {
      const articleData = await getArticleDetails(fileName);
      setFormData(articleData);
      setStatus('');
    } catch (e: any) {
      setStatus('خطأ في تحميل الملف: ' + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.image || !formData.mainText) {
      alert("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }

    setLoading(true);
    setStatus("جاري البدء...");

    try {
      if (editFileName) {
        await updateArticle(editFileName, formData, setStatus);
      } else {
        await createArticle(formData, setStatus);
      }
      setTimeout(onClose, 1000);
    } catch (err: any) {
      setStatus("خطأ: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-white">
          <ArrowLeft className="w-6 h-6 rotate-180" />
        </button>
        <h2 className="text-2xl font-bold text-white">
          {editFileName ? 'تعديل المقال' : 'مقال جديد'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface p-6 rounded-lg border border-slate-700 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input 
            label="عنوان المقال" 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})}
            placeholder="مثال: إطلاق آيفون جديد"
            required
          />
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-1">التصنيف</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({...formData, category: cat.id as any})}
                  className={`p-2 rounded text-sm font-medium flex items-center justify-center gap-2 border transition-colors ${
                    formData.category === cat.id 
                    ? 'bg-primary border-primary text-white' 
                    : 'bg-slate-900 border-slate-700 text-gray-400 hover:bg-slate-800'
                  }`}
                >
                  {cat.icon}
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Input 
          label="وصف قصير (Meta)" 
          value={formData.description} 
          onChange={e => setFormData({...formData, description: e.target.value})}
          placeholder="ملخص قصير للبطاقة ومحركات البحث..."
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Input 
              label="رابط الصورة (نسبة 16:9)" 
              value={formData.image} 
              onChange={e => setFormData({...formData, image: e.target.value})}
              placeholder="https://..."
              required
            />
            <div className="flex justify-end -mt-2">
              <ImagePicker onSelect={(url) => setFormData({...formData, image: url})} />
            </div>
          </div>

          <Input 
            label="رابط فيديو يوتيوب (اختياري)" 
            value={formData.videoUrl} 
            onChange={e => setFormData({...formData, videoUrl: e.target.value})}
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>

        <div className="relative">
          <div className="flex justify-between items-center mb-1">
             <label className="block text-sm font-medium text-gray-400">المحتوى الرئيسي (Markdown Supported: # للعنوان)</label>
          </div>
          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded p-4 text-white focus:ring-2 focus:ring-primary focus:outline-none min-h-[300px] leading-relaxed"
            value={formData.mainText}
            onChange={e => setFormData({...formData, mainText: e.target.value})}
            placeholder="اكتب محتوى المقال هنا... استخدم ### للعناوين الفرعية"
            required
          />
        </div>

        {status && (
          <div className="p-3 bg-slate-900 rounded border border-slate-700 text-sm text-blue-400 font-mono" dir="ltr">
            &gt; {status}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save />}
            {editFileName ? 'تحديث المقال' : 'نشر المقال'}
          </button>
        </div>
      </form>
    </div>
  );
};