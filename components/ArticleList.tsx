import React, { useEffect, useState } from 'react';
import { getManagedArticles, deleteArticle, syncArticlesFromFiles } from '../services/githubService';
import { ArticleMetadata, RepoConfig } from '../types';
import { Edit, Trash2, ExternalLink, Loader2, RefreshCw, Database } from 'lucide-react';

interface Props {
  onEdit: (fileName: string) => void;
}

export const ArticleList: React.FC<Props> = ({ onEdit }) => {
  const [articles, setArticles] = useState<ArticleMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState('');

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await getManagedArticles();
      setArticles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
      setLoading(true);
      setSyncStatus('جاري فحص الملفات...');
      try {
          const synced = await syncArticlesFromFiles((msg) => setSyncStatus(msg));
          setArticles(synced);
          setSyncStatus('');
      } catch (e: any) {
          setSyncStatus('خطأ: ' + e.message);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`هل أنت متأكد أنك تريد حذف ${fileName}؟`)) return;
    setDeleting(fileName);
    try {
      await deleteArticle(fileName, () => {});
      await loadArticles();
    } catch (e: any) {
      alert("فشل الحذف: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${cleanPath}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <h2 className="text-xl md:text-2xl font-bold text-white">المقالات المنشورة</h2>
        <div className="flex gap-2">
            <button 
            onClick={loadArticles} 
            className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white transition-colors"
            title="تحديث القائمة"
            >
            <RefreshCw className={`w-5 h-5 ${loading && !syncStatus ? 'animate-spin' : ''}`} />
            </button>
            <button 
                onClick={handleSync}
                className="px-3 py-2 bg-blue-700 rounded hover:bg-blue-600 text-white text-sm flex items-center gap-2"
            >
                <Database className="w-4 h-4"/> مزامنة
            </button>
        </div>
      </div>
      
      {syncStatus && <div className="text-yellow-400 text-sm font-mono bg-slate-900 p-2 rounded">{syncStatus}</div>}

      {!loading && articles.length === 0 && !syncStatus && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <p className="text-lg mb-2">لا توجد مقالات في قاعدة البيانات.</p>
          <button onClick={handleSync} className="text-blue-400 hover:underline">اضغط هنا لجلب المقالات من الملفات</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {articles.map((article) => (
          <div key={article.fileName} className="bg-surface border border-slate-700 rounded-lg overflow-hidden flex flex-col group shadow-sm">
            <div className="relative aspect-video bg-slate-900 overflow-hidden">
              <img 
                src={getImageUrl(article.image)} 
                alt={article.title} 
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/600x400/1e293b/cbd5e1?text=No+Image'; }}
              />
              <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded uppercase font-bold">
                {article.category}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="text-base font-bold text-white mb-2 line-clamp-2 leading-snug">{article.title}</h3>
              <p className="text-gray-400 text-xs mb-3 line-clamp-2 flex-1">{article.description}</p>
              
              <div className="flex items-center justify-between pt-3 border-t border-slate-700 mt-auto">
                <a 
                  href={`https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${article.fileName}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> معاينة
                </a>
                
                <div className="flex gap-2">
                  <button onClick={() => onEdit(article.fileName)} className="p-1.5 hover:bg-slate-700 rounded text-gray-300">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(article.fileName)} disabled={deleting === article.fileName} className="p-1.5 hover:bg-red-900/30 rounded text-red-400">
                     {deleting === article.fileName ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};