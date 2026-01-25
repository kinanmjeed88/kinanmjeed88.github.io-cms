import React, { useEffect, useState } from 'react';
import { getSiteImages, uploadImage } from '../services/githubService';
import { Image as ImageIcon, Loader2, X, Upload } from 'lucide-react';

interface Props {
  onSelect: (url: string) => void;
  type?: 'article' | 'profile';
}

export const ImagePicker: React.FC<Props> = ({ onSelect, type = 'article' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen && images.length === 0) {
      loadImages();
    }
  }, [isOpen]);

  const loadImages = async () => {
    setLoading(true);
    const imgs = await getSiteImages();
    setImages(imgs);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("حجم الملف كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.");
      return;
    }

    setUploading(true);
    try {
        // Pass the 'type' to uploadImage to determine the folder
        const url = await uploadImage(file, (msg) => console.log(msg), type as 'article' | 'profile');
        setImages(prev => [url, ...prev]); 
        onSelect(url);
        setIsOpen(false);
        alert("تم رفع الصورة واختيارها بنجاح!");
    } catch (err: any) {
        alert("فشل رفع الصورة: " + err.message);
    } finally {
        setUploading(false);
    }
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    setIsOpen(false);
  };

  return (
    <div>
      <div className="flex gap-2 mt-1 justify-end">
        <label className={`cursor-pointer text-xs bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
           {uploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3" />}
           رفع من الجهاز
           <input 
             type="file" 
             accept="image/*" 
             className="hidden" 
             onChange={handleFileUpload}
             disabled={uploading} 
           />
        </label>
        
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-600 px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
        >
          <ImageIcon className="w-3 h-3" />
          معرض الموقع
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-slate-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> معرض صور الموقع
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-700 flex justify-center bg-slate-900/50">
                <label className={`cursor-pointer bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                رفع صورة جديدة من الهاتف
                <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={uploading} 
                />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p>جاري فحص الموقع بحثاً عن صور...</p>
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelect(img)}
                      className="group relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <img 
                        src={img} 
                        alt={`Gallery item ${idx}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-xs text-white bg-primary px-2 py-1 rounded">اختيار</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-10">
                  لم يتم العثور على صور في الموقع.
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-slate-700 bg-slate-900/50 text-xs text-gray-500 text-center">
              يتم عرض الصور المستخدمة حالياً في صفحات الموقع.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};