import React, { useEffect, useState } from 'react';
import { getDirectoryItems, saveDirectoryItem, deleteDirectoryItem } from '../services/githubService';
import { DirectoryItem } from '../types';
import { Input, TextArea } from './ui/Input';
import { Loader2, Save, Trash2, Plus, Globe, Smartphone, Monitor } from 'lucide-react';

const COLORS = [
    { label: 'Blue', value: 'bg-blue-600' },
    { label: 'Green', value: 'bg-green-600' },
    { label: 'Red', value: 'bg-red-600' },
    { label: 'Purple', value: 'bg-purple-600' },
    { label: 'Gray', value: 'bg-gray-600' },
    { label: 'Black', value: 'bg-black' },
];

const ICONS = ['globe', 'smartphone', 'monitor', 'gamepad-2', 'message-circle', 'tv', 'shopping-cart'];

export const SitesEditor: React.FC = () => {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<DirectoryItem>({
      title: '', description: '', link: '', icon: 'globe', colorClass: 'bg-blue-600'
  });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
        setItems(await getDirectoryItems());
    } catch (e: any) {
        setStatus("خطأ: " + e.message);
    } finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || !formData.link) return;
      setLoading(true);
      try {
          await saveDirectoryItem(formData, setStatus);
          setIsEditing(false);
          setFormData({ title: '', description: '', link: '', icon: 'globe', colorClass: 'bg-blue-600' });
          await loadItems();
      } catch (e: any) { setStatus("خطأ: " + e.message); } finally { setLoading(false); }
  };

  const handleDelete = async (link: string) => {
      if(!window.confirm("حذف البطاقة نهائياً؟")) return;
      setLoading(true);
      try {
          await deleteDirectoryItem(link, setStatus);
          await loadItems();
      } catch (e:any) { setStatus("فشل: " + e.message); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 pb-12">
        <div className="bg-surface p-4 md:p-6 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">إدارة الدليل</h2>
                {!isEditing && (
                    <button onClick={() => { setIsEditing(true); setFormData({ title: '', description: '', link: '', icon: 'globe', colorClass: 'bg-blue-600' }); }} 
                    className="bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
                        <Plus className="w-4 h-4" /> جديد
                    </button>
                )}
            </div>

            {isEditing && (
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="العنوان" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <Input label="الرابط" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} />
                    <TextArea label="الوصف" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">اللون</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map(c => (
                                    <button key={c.value} type="button" onClick={() => setFormData({...formData, colorClass: c.value})}
                                    className={`w-6 h-6 rounded-full border ${formData.colorClass === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                                    style={{backgroundColor: c.value.replace('bg-', '').replace('600', '')}} />
                                ))}
                            </div>
                        </div>
                        <div>
                             <label className="text-xs text-gray-400 mb-1 block">الأيقونة</label>
                             <div className="flex flex-wrap gap-2">
                                 {ICONS.map(i => (
                                     <button key={i} type="button" onClick={() => setFormData({...formData, icon: i})}
                                     className={`p-1.5 rounded ${formData.icon === i ? 'bg-primary text-white' : 'bg-slate-800 text-gray-400'}`}>
                                         {i === 'globe' ? <Globe className="w-4 h-4"/> : <Smartphone className="w-4 h-4"/>}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1 text-sm text-gray-400">إلغاء</button>
                        <button type="submit" disabled={loading} className="bg-accent px-4 py-1.5 rounded text-sm text-white flex gap-2">
                            {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4"/>} حفظ
                        </button>
                    </div>
                </form>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, idx) => (
                <div key={idx} className="bg-surface border border-slate-700 rounded-lg p-3 flex gap-3 items-start relative group">
                    <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${item.colorClass.replace('bg-white', 'bg-slate-200')}`}>
                        <Globe className="w-5 h-5 text-white"/>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-sm truncate">{item.title}</h3>
                        <p className="text-xs text-gray-400 truncate">{item.description}</p>
                        <a href={item.link} className="text-[10px] text-blue-400 truncate block mt-1">{item.link}</a>
                    </div>
                    <div className="absolute top-2 left-2 flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setFormData(item); setIsEditing(true); window.scrollTo(0,0); }} className="p-1.5 bg-slate-800 rounded text-blue-400"><Save className="w-3 h-3"/></button>
                         <button onClick={() => handleDelete(item.link)} className="p-1.5 bg-slate-800 rounded text-red-400"><Trash2 className="w-3 h-3"/></button>
                    </div>
                </div>
            ))}
        </div>
        {status && <div className="fixed bottom-4 left-4 bg-slate-900 text-white p-2 rounded text-xs">{status}</div>}
    </div>
  );
};