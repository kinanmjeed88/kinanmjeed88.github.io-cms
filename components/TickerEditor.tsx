import React, { useEffect, useState } from 'react';
import { parseTicker, saveTicker } from '../services/githubService';
import { Input } from './ui/Input';
import { Loader2, Save } from 'lucide-react';

const DEFAULT_TEXT = "أهلاً بكم في موقعنا المختص بنشر الأخبار التقنية والتطبيقات والمزيد .. | TechTouch بوابتك لعالم التقنية";

export const TickerEditor: React.FC = () => {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadTicker();
  }, []);

  const loadTicker = async () => {
    try {
      setLoading(true);
      const data = await parseTicker();
      setText(data.text || DEFAULT_TEXT);
      setLink(data.link);
    } catch (e: any) {
      console.error(e);
      setStatus("خطأ في تحميل الشريط: " + e.message);
      setText(DEFAULT_TEXT);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!text || !link) return;
    try {
      setLoading(true);
      setStatus("جاري الحفظ...");
      await saveTicker(text, link, setStatus);
      setStatus("تم تحديث الشريط بنجاح!");
    } catch (e: any) {
      setStatus("خطأ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        محرر شريط الأخبار
      </h2>
      <Input 
        label="نص الخبر" 
        value={text} 
        onChange={e => setText(e.target.value)} 
        placeholder={DEFAULT_TEXT}
      />
      <Input 
        label="رابط الخبر" 
        value={link} 
        onChange={e => setLink(e.target.value)} 
        placeholder="https://..."
      />
      
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-yellow-400">{status}</span>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
          تحديث الشريط
        </button>
      </div>
    </div>
  );
};