import React, { useEffect, useState } from 'react';
import { getDirectoryItems, saveDirectoryItem, deleteDirectoryItem } from '../services/githubService';
import { DirectoryItem } from '../types';
import { Input, TextArea } from './ui/Input';
import { Loader2, Save, Trash2, Plus, Globe, Scissors, Bot, Smartphone, MessageCircle, Gamepad2, Monitor, Apple, Sparkles, Tv, FolderPlus } from 'lucide-react';

const COLORS = [
    { label: 'Blue', value: 'bg-blue-600' },
    { label: 'Green', value: 'bg-green-600' },
    { label: 'Red', value: 'bg-red-600' },
    { label: 'Purple', value: 'bg-purple-600' },
    { label: 'Teal', value: 'bg-teal-600' },
    { label: 'Gray', value: 'bg-gray-600' },
    { label: 'Black', value: 'bg-black' },
    { label: 'Indigo', value: 'bg-indigo-600' },
];

const ICONS = [
    { name: 'link', icon: <Globe className="w-5 h-5"/> },
    { name: 'scissors', icon: <Scissors className="w-5 h-5"/> },
    { name: 'bot', icon: <Bot className="w-5 h-5"/> },
    { name: 'smartphone', icon: <Smartphone className="w-5 h-5"/> },
    { name: 'message-circle', icon: <MessageCircle className="w-5 h-5"/> },
    { name: 'gamepad-2', icon: <Gamepad2 className="w-5 h-5"/> },
    { name: 'monitor', icon: <Monitor className="w-5 h-5"/> },
    { name: 'apple', icon: <Apple className="w-5 h-5"/> },
    { name: 'sparkles', icon: <Sparkles className="w-5 h-5"/> },
    { name: 'tv', icon: <Tv className="w-5 h-5"/> },
    { name: 'folder-plus', icon: <FolderPlus className="w-5 h-5"/> },
];

export const SitesEditor: React.FC = () => {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<DirectoryItem>({
      title: '', description: '', link: '', icon: 'link', colorClass: 'bg-blue-600'
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
        const data = await getDirectoryItems();
        setItems(data);
    } catch (e: any) {
        setStatus("خطأ في التحميل: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const handleEdit = (item: DirectoryItem) => {
      setFormData(item);
      setIsEditing(true);
      window.scrollTo(0, 0);
  };

  const handleAddNew = () => {
      setFormData({
          title: '', description: '', link: '', icon: 'link', colorClass: 'bg-blue-600'
      });
      setIsEditing(true);
  };

  const handleDelete = async (link: string) => {
      if(!window.confirm("هل أنت متأكد من حذف هذه البطاقة؟")) return;
      setLoading(true);
      try {
          await deleteDirectoryItem(link, setStatus);
          await loadItems();
      } catch (e: any) {
          setStatus("فشل الحذف: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || !formData.link) return alert("العنوان والرابط مطلوبان");

      setLoading(true);
      setStatus("جاري الحفظ...");
      try {
          await saveDirectoryItem(formData, setStatus);
          setIsEditing(false);
          await loadItems();
          setFormData({ title: '', description: '', link: '', icon: 'link', colorClass: 'bg-blue-600' });
      } catch (e: any) {
          setStatus("خطأ: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-8">
        
        {/* Editor Form */}
        <div className="bg-surface p-6 rounded-lg border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center justify-between">
                <span>{isEditing ? 'تعديل / إضافة بطاقة' : 'إدارة الدليل'}</span>
                {!isEditing && (
                    <button onClick={handleAddNew} className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2">
                        <Plus className="w-4 h-4" /> إضافة جديد
                    </button>
                )}
            </h2>

            {isEditing && (
                <form onSubmit={handleSave} className="space-y-4 animate-in fade-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="عنوان البطاقة (مثل: كاب كات)" 
                            value={formData.title} 
                            onChange={e => setFormData({...formData, title: e.target.value})}
                        />
                        <Input 
                            label="الرابط (قناة / موقع)" 
                            value={formData.link} 
                            onChange={e => setFormData({...formData, link: e.target.value})}
                            placeholder="https://..."
                        />
                    </div>
                    <TextArea 
                        label="الوصف (سطر واحد)" 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">اللون الخلفي للأيقونة</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setFormData({...formData, colorClass: c.value})}
                                        className={`w-8 h-8 rounded-full border-2 ${formData.colorClass === c.value ? 'border-white' : 'border-transparent'}`}
                                        style={{ backgroundColor: c.value.replace('bg-', '').replace('600', '') }} 
                                        // Note: Mapping bg classes to style directly is messy, using class in template but visual here approximation
                                    >
                                        <div className={`w-full h-full rounded-full ${c.value}`}></div>
                                    </button>
                                ))}
                            </div>
                            <span className="text-xs text-gray-500 mt-1 block">اختر لوناً: {COLORS.find(c => c.value === formData.colorClass)?.label}</span>
                        </div>

                        <div>
                             <label className="block text-sm font-medium text-gray-400 mb-2">الأيقونة</label>
                             <div className="flex flex-wrap gap-2 bg-slate-900 p-2 rounded border border-slate-700">
                                 {ICONS.map(i => (
                                     <button
                                        key={i.name}
                                        type="button"
                                        onClick={() => setFormData({...formData, icon: i.name})}
                                        title={i.name}
                                        className={`p-2 rounded hover:bg-slate-700 transition-colors ${formData.icon === i.name ? 'bg-primary text-white' : 'text-gray-400'}`}
                                     >
                                         {i.icon}
                                     </button>
                                 ))}
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
                        <button 
                            type="button" 
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 rounded text-gray-400 hover:bg-slate-800"
                        >
                            إلغاء
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-accent hover:bg-accent/80 text-white px-6 py-2 rounded flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Save className="w-4 h-4"/>}
                            حفظ البطاقة
                        </button>
                    </div>
                </form>
            )}
        </div>

        {/* List Items */}
        {loading && !isEditing ? (
            <div className="text-center py-10 text-gray-400">جاري تحميل القائمة...</div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item, idx) => (
                    <div key={idx} className="bg-surface border border-slate-700 rounded-xl p-4 flex items-start gap-4 group hover:border-primary/50 transition-colors relative">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${item.colorClass.replace('bg-white', 'bg-slate-200 text-black')}`}>
                             {/* Attempt to render correct icon, fallback to Globe */}
                             {ICONS.find(i => i.name === item.icon)?.icon || <Globe className="w-6 h-6 text-white"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white truncate">{item.title}</h3>
                            <p className="text-sm text-gray-400 truncate mb-2">{item.description}</p>
                            <a href={item.link} target="_blank" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                {item.link}
                            </a>
                        </div>
                        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/90 rounded p-1">
                             <button onClick={() => handleEdit(item)} className="p-1.5 hover:bg-slate-700 rounded text-blue-400"><Save className="w-4 h-4"/></button>
                             <button onClick={() => handleDelete(item.link)} className="p-1.5 hover:bg-slate-700 rounded text-red-400"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {status && <div className="fixed bottom-4 left-4 bg-slate-900 text-white px-4 py-2 rounded border border-slate-700 shadow-lg text-sm">{status}</div>}
    </div>
  );
};