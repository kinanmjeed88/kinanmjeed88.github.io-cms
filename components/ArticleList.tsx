import React, { useEffect, useState } from 'react';
import { getManagedArticles, deleteArticle } from '../services/githubService';
import { ArticleMetadata, RepoConfig } from '../types';
import { Edit, Trash2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  onEdit: (fileName: string) => void;
}

export const ArticleList: React.FC<Props> = ({ onEdit }) => {
  const [articles, setArticles] = useState<ArticleMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await getManagedArticles();
      setArticles(data);
    } catch (e) {
      console.error(e);
      alert("فشل تحميل المقالات من قاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`هل أنت متأكد أنك تريد حذف ${fileName}؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    
    setDeleting(fileName);
    try {
      await deleteArticle(fileName, (msg) => console.log(msg));
      await loadArticles();
    } catch (e: any) {
      alert("فشل الحذف: " + e.message);
    } finally {
      setDeleting(null);
    }
  };

  // Helper to resolve relative paths for the CMS preview
  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('https') || path.startsWith('data:')) return path;
    
    // Clean path (remove leading slash)
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Construct absolute URL based on RepoConfig
    return `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${cleanPath}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">المقالات المنشورة</h2>
        <button 
          onClick={loadArticles} 
          className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white transition-colors"
          title="تحديث القائمة"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && articles.length === 0 && (
        <div className="text-center py-12 text-gray-400">جاري تحميل المقالات من metadata.json...</div>
      )}

      {!loading && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <p className="text-lg mb-2">لا توجد مقالات منشورة حالياً.</p>
          <p className="text-sm">تأكد من وجود ملفات HTML للمقالات في المستودع، أو أضف مقالاً جديداً.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <div key={article.fileName} className="bg-surface border border-slate-700 rounded-lg overflow-hidden flex flex-col group">
            <div className="relative aspect-video bg-slate-900 overflow-hidden">
              <img 
                src={getImageUrl(article.image)} 
                alt={article.title} 
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={(e) => {
                   // Fallback to a placeholder if the image is truly missing
                   e.currentTarget.src = 'https://placehold.co/600x400/1e293b/cbd5e1?text=No+Image';
                }}
              />
              <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded uppercase font-bold">
                {article.category}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{article.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2 flex-1">{article.description}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <a 
                  href={`https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${article.fileName}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center text-xs"
                >
                  عرض الموقع <ExternalLink className="w-3 h-3 mr-1" />
                </a>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEdit(article.fileName)}
                    className="p-2 hover:bg-slate-700 rounded text-gray-300 hover:text-white"
                    title="تعديل"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(article.fileName)}
                    disabled={deleting === article.fileName}
                    className="p-2 hover:bg-red-900/30 rounded text-red-400 hover:text-red-300"
                    title="حذف"
                  >
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