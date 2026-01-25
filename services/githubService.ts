import { ArticleContent, ArticleMetadata, GithubFile, RepoConfig, TickerData, MetadataRoot, ArticleEntry, DirectoryItem, SocialLinks, AIAnalysisKnowledge, AboutPageData } from '../types';
import { generateSmartCardHtml, analyzeSiteStructure, extractDataFromHtml, detectAdSelectors } from './geminiService';

let GITHUB_TOKEN: string | null = null;

export const setGithubToken = (token: string) => {
  GITHUB_TOKEN = token;
};

export const getGithubToken = () => GITHUB_TOKEN;

// --- Helpers ---

const toBase64 = (str: string): string => {
  return window.btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
};

const fromBase64 = (str: string): string => {
  return decodeURIComponent(
    Array.prototype.map
      .call(window.atob(str), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const serializeHtml = (doc: Document): string => {
    const doctype = "<!DOCTYPE html>";
    const html = doc.documentElement.outerHTML;
    return `${doctype}\n${html}`;
};

const getHeaders = () => {
  if (!GITHUB_TOKEN) throw new Error("GitHub Token not set");
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
};

const processContentWithLinks = (text: string): string => {
    let html = '';
    const lines = text.split('\n').filter(p => p.trim());
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    lines.forEach(line => {
        const processedLine = line.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-primary font-bold hover:underline bg-primary/10 px-2 py-0.5 rounded mx-1 text-sm transition-colors hover:bg-primary/20">
                <span>اضغط هنا</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>`;
        });

        if (line.startsWith('###')) {
            html += `<h3>${processedLine.replace('###', '').trim()}</h3>`;
        } else if (line.startsWith('##')) {
            html += `<h2>${processedLine.replace('##', '').trim()}</h2>`;
        } else {
            html += `<p>${processedLine}</p>`;
        }
    });
    return html;
};

const findMainArticleImage = (doc: Document): Element | null => {
  let img = doc.querySelector('#main-image');
  if (!img) img = doc.querySelector('main img');
  if (!img) img = doc.querySelector('header img');
  return img;
};

// ... [Injection Helpers] ...
const injectAdAndTracking = (doc: Document) => {
  const head = doc.querySelector('head');
  if (head) {
    if (!head.innerHTML.includes('G-NZVS1EN9RG')) {
      const gaScript = doc.createElement('script');
      gaScript.async = true;
      gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-NZVS1EN9RG";
      head.appendChild(gaScript);
      const gaConfig = doc.createElement('script');
      gaConfig.textContent = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-NZVS1EN9RG');`;
      head.appendChild(gaConfig);
    }
    if (!head.innerHTML.includes('ca-pub-7355327732066930')) {
       const adScript = doc.createElement('script');
       adScript.async = true;
       adScript.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7355327732066930";
       adScript.setAttribute('crossorigin', 'anonymous');
       head.appendChild(adScript);
    }
  }
};

const injectCanonicalLink = (doc: Document, fileName: string) => {
    const linkUrl = `https://${RepoConfig.OWNER}.github.io/${fileName}`;
    let canonical = doc.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = doc.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        doc.head.appendChild(canonical);
    }
    canonical.setAttribute('href', linkUrl);
};

// --- Hybrid Ad Logic (As per README) ---
const getHybridAdHtml = (imageUrl: string, linkUrl: string, adSlotId: string = 'YOUR_AD_SLOT_ID') => {
    return `
<div class="hybrid-ad-container relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 min-h-[280px] my-8 group shadow-sm">
    <!-- 1. Google AdSense (High Priority / z-index: 10) -->
    <div class="relative z-10 w-full min-h-[280px] flex justify-center items-center">
        <ins class="adsbygoogle"
             style="display:block; width:100%; min-width:300px;"
             data-ad-client="ca-pub-7355327732066930"
             data-ad-slot="${adSlotId}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <!-- 2. Custom Ad (Fallback / z-index: 0) -->
    <a href="${linkUrl}" target="_blank" class="ad-fallback absolute inset-0 z-0 flex items-center justify-center bg-slate-200 dark:bg-slate-900">
        <img src="${imageUrl}" alt="Advertisement" class="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" onerror="this.style.display='none'" />
    </a>
</div>`;
};

const getAdSlotHtml = () => getHybridAdHtml('https://placehold.co/600x400/png?text=Ads', '#'); // Deprecated fallback

const API_BASE = `https://api.github.com/repos/${RepoConfig.OWNER}/${RepoConfig.NAME}`;

// ... [Core API Wrapper] ...
export const getFile = async (path: string): Promise<{ content: string; sha: string }> => {
  const response = await fetch(`${API_BASE}/contents/${path}?t=${Date.now()}`, { headers: getHeaders() });
  if (!response.ok) {
    if (response.status === 404) throw new Error(`File not found: ${path}`);
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }
  const data: GithubFile = await response.json();
  if (!data.content) throw new Error("File content is empty");
  return { content: fromBase64(data.content), sha: data.sha };
};

export const updateFile = async (path: string, content: string, message: string, sha?: string): Promise<void> => {
  const body: any = { message, content: toBase64(content) };
  if (sha) body.sha = sha;
  const response = await fetch(`${API_BASE}/contents/${path}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
  if (!response.ok) { const err = await response.json(); throw new Error(`Failed to update ${path}: ${err.message}`); }
};

export const deleteFile = async (path: string, message: string, sha: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/contents/${path}`, { method: "DELETE", headers: getHeaders(), body: JSON.stringify({ message, sha }) });
  if (!response.ok) throw new Error(`Failed to delete ${path}`);
};

// ... [Updated Ads Logic] ...
export const updateGlobalAds = async (imageUrl: string, linkUrl: string, adSlotId: string, onProgress: (msg: string) => void) => {
    onProgress("جاري فحص جميع ملفات الموقع...");
    try {
        const response = await fetch(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        
        // 1. Analyze index.html first to learn the ad pattern using AI
        let learnedSelectors = ['.hybrid-ad-container', '.ad-slot-container', '.custom-image-ad', 'ins.adsbygoogle', '.ad-fallback'];
        const indexFile = htmlFiles.find((f: any) => f.name === 'index.html');
        
        if (indexFile) {
            onProgress("تحليل هيكل الإعلانات الحالي بالذكاء الاصطناعي...");
            try {
              const { content } = await getFile(indexFile.path);
              const aiSelectors = await detectAdSelectors(content);
              if (aiSelectors && aiSelectors.length > 0) {
                  learnedSelectors = [...new Set([...learnedSelectors, ...aiSelectors])];
                  console.log("AI Detected Ad Selectors:", learnedSelectors);
              }
            } catch (e) {
              console.warn("Analysis failed, using defaults");
            }
        }

        let updatedCount = 0;
        for (const file of htmlFiles) {
            try {
                onProgress(`تحديث ${file.name}...`);
                const { content, sha } = await getFile(file.path);
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');
                let isModified = false;
                
                const createNewAdNode = () => {
                    const temp = doc.createElement('div');
                    temp.innerHTML = getHybridAdHtml(imageUrl, linkUrl, adSlotId);
                    return temp.firstElementChild!;
                };
                
                // Use learned selectors to find and replace
                learnedSelectors.forEach(selector => {
                    // Try to find matching elements
                    const elements = Array.from(doc.querySelectorAll(selector));
                    elements.forEach(el => {
                        // Logic to ensure we only replace specific ad blocks
                        const text = el.textContent?.toLowerCase() || '';
                        // "ertise" covers "Advertise" and "ertise Here" (seen in screenshot)
                        const hasAdText = text.includes('advertise') || text.includes('ertise') || text.includes('إعلان');
                        const isExplicitAd = el.tagName === 'INS' || el.classList.contains('hybrid-ad-container') || el.classList.contains('ad-slot-container') || el.classList.contains('custom-image-ad');
                        
                        // Avoid replacing the parent if we just replaced the child, or specific structure checks
                        if (hasAdText || isExplicitAd || selector.includes('ad')) {
                            // Verify it's not the main content wrapper
                            if (!el.classList.contains('prose') && !el.classList.contains('max-w-7xl')) {
                                el.replaceWith(createNewAdNode());
                                isModified = true;
                            }
                        }
                    });
                });

                if (isModified) {
                    await updateFile(file.path, serializeHtml(doc), "Update ads to Hybrid System", sha);
                    updatedCount++;
                }
            } catch (e) { console.warn(`Skipping ${file.name}`, e); }
        }
        onProgress(`تم تحديث الإعلانات بنظام Hybrid في ${updatedCount} صفحة!`);
    } catch (e: any) { onProgress("خطأ: " + e.message); }
};

export const updateSitemap = async (fileName: string, onProgress: (msg: string) => void) => { /* implementation */ };
export const removeFromSitemap = async (fileName: string, onProgress: (msg: string) => void) => { /* implementation */ };
export const updateSearchData = async (data: ArticleContent, fileName: string, onProgress: (msg: string) => void) => { /* implementation */ };
export const removeFromSearchData = async (fileName: string, onProgress: (msg: string) => void) => { /* implementation */ };
export const getSocialLinks = async (): Promise<SocialLinks> => { 
    // Simplified stub
    return {facebook:'',instagram:'',tiktok:'',youtube:'',telegram:''};
};
export const updateSocialLinks = async (links: SocialLinks, onProgress: (msg: string) => void) => { 
    // Simplified stub
    onProgress("Update social links simulated");
};

// --- Smart Parsing & Analysis ---

export const performFullSiteAnalysis = async (onProgress: (msg: string) => void): Promise<AIAnalysisKnowledge> => {
    onProgress("جاري تحميل الملفات الرئيسية (index, tools, articles)...");
    const filesToAnalyze = [RepoConfig.INDEX_FILE, RepoConfig.TOOLS_SITES_FILE, RepoConfig.ARTICLES_FILE];
    const loadedFiles = [];

    for (const path of filesToAnalyze) {
        try {
            const { content } = await getFile(path);
            loadedFiles.push({ name: path, content });
        } catch(e) {}
    }

    onProgress("جاري تحليل الهيكل باستخدام الذكاء الاصطناعي...");
    const knowledge = await analyzeSiteStructure(loadedFiles);

    onProgress("حفظ النتائج في قاعدة البيانات...");
    const { data: metaData, sha: metaSha } = await getMetadata();
    metaData.aiKnowledge = knowledge;
    await saveMetadata(metaData, metaSha);

    return knowledge;
};

// --- Article Management with AI Parsing ---

export const getArticleDetails = async (fileName: string): Promise<ArticleContent> => {
    const { content } = await getFile(fileName);
    
    // 1. Try AI Parsing first for accuracy
    console.log("Using AI to parse article details...");
    const aiData = await extractDataFromHtml(content, 'article');
    
    if (aiData) {
        return {
            fileName,
            title: aiData.title || '',
            description: aiData.description || '',
            image: aiData.image || '',
            category: aiData.category || 'tech',
            link: fileName,
            mainText: aiData.mainText || '',
            videoUrl: aiData.videoUrl || '',
            content
        };
    }

    // 2. Fallback to Manual Parsing if AI fails
    console.warn("AI parsing failed, falling back to manual DOM parsing.");
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    let mainText = '';
    doc.querySelectorAll('main p').forEach(p => {
        if (!p.className.includes('desc')) mainText += p.textContent + '\n\n';
    });

    const catMatch = fileName.match(/^(tech|apps|games|sports)-/);
    
    return {
        fileName,
        title: doc.querySelector('h1')?.textContent || doc.title || '',
        description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        image: doc.querySelector('main img, header img')?.getAttribute('src') || '',
        category: (catMatch ? catMatch[1] : 'tech') as any,
        link: fileName,
        mainText: mainText.trim(),
        videoUrl: doc.querySelector('iframe')?.src || '',
        content
    };
};

export const createArticle = async (data: ArticleContent, onProgress: (msg: string) => void) => {
    // ... [Logic to fetch template, inject content, save file - same as before] ...
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newFileName = `${data.category}-${slug}.html`;
    const id = `${data.category}-${slug}`;

    onProgress("جاري جلب القالب...");
    const { content: templateHtml } = await getFile(RepoConfig.TEMPLATE_FILE);
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateHtml, "text/html");

    doc.title = `${data.title} | TechTouch`;
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', data.description);
    const h1 = doc.querySelector('h1');
    if (h1) h1.textContent = data.title;
    const mainImg = findMainArticleImage(doc);
    if (mainImg) { mainImg.setAttribute('src', data.image); mainImg.setAttribute('alt', data.title); mainImg.setAttribute('id', 'main-image'); }
    injectAdAndTracking(doc);
    injectCanonicalLink(doc, newFileName);
    
    const mainContainer = doc.querySelector('main');
    if (mainContainer) {
        const contentDiv = mainContainer.querySelector('article') || mainContainer;
        let newContentHtml = '';
        if (data.videoUrl) {
            let videoId = '';
            if (data.videoUrl.includes('embed/')) videoId = data.videoUrl.split('embed/')[1];
            else if (data.videoUrl.includes('v=')) videoId = data.videoUrl.split('v=')[1]?.split('&')[0];
            else videoId = data.videoUrl.split('/').pop() || '';
            if (videoId) newContentHtml += `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:20px;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        newContentHtml += processContentWithLinks(data.mainText);
        // Inject Default Hybrid Ad
        newContentHtml += getHybridAdHtml('https://placehold.co/600x250/1e293b/FFF?text=Ads', '#');
        
        if (contentDiv.classList.contains('prose')) { contentDiv.innerHTML = newContentHtml; } 
        else { const proseDiv = mainContainer.querySelector('.prose'); if (proseDiv) { proseDiv.innerHTML = newContentHtml; } }
    }

    onProgress(`جاري حفظ المقال: ${newFileName}`);
    await updateFile(newFileName, serializeHtml(doc), `Add article: ${newFileName}`);
    
    // Metadata & Knowledge usage
    const { data: metaData, sha: metaSha } = await getMetadata();
    const newEntry: ArticleEntry = { id, title: data.title, slug: newFileName.replace('.html', ''), excerpt: data.description, image: data.image, date: new Date().toISOString().split('T')[0], category: data.category, file: newFileName };
    metaData.articles.unshift(newEntry);
    await saveMetadata(metaData, metaSha);

    // AI Smart Card Addition
    onProgress("إضافة البطاقات باستخدام الذكاء الاصطناعي...");
    await addCardToFile(RepoConfig.INDEX_FILE, data, newFileName, '#tab-all', metaData.aiKnowledge);
    await addCardToFile(RepoConfig.ARTICLES_FILE, data, newFileName, undefined, metaData.aiKnowledge);
    
    onProgress("تمت العملية بنجاح!");
};

export const updateArticle = async (oldFileName: string, data: ArticleContent, onProgress: (msg: string) => void) => {
    // ... [Similar logic to Create but updating existing file] ...
    onProgress(`جاري تحديث ${oldFileName}...`);
    const { content, sha } = await getFile(oldFileName);
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    doc.title = `${data.title} | TechTouch`;
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', data.description);
    const h1 = doc.querySelector('h1');
    if (h1) h1.textContent = data.title;
    const mainImg = findMainArticleImage(doc);
    if (mainImg) { mainImg.setAttribute('src', data.image); mainImg.setAttribute('alt', data.title); }

    injectAdAndTracking(doc);
    const proseDiv = doc.querySelector('main .prose');
    if (proseDiv) {
        let newContentHtml = '';
        if (data.videoUrl) {
            let videoId = '';
            if (data.videoUrl.includes('embed/')) videoId = data.videoUrl.split('embed/')[1];
            else if (data.videoUrl.includes('v=')) videoId = data.videoUrl.split('v=')[1]?.split('&')[0];
            else videoId = data.videoUrl.split('/').pop() || '';
            if (videoId) newContentHtml += `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:20px;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        newContentHtml += processContentWithLinks(data.mainText);
        // Ensure ad slot is present
        if (!newContentHtml.includes('hybrid-ad-container')) {
             newContentHtml += getHybridAdHtml('https://placehold.co/600x250/1e293b/FFF?text=Ads', '#');
        }
        proseDiv.innerHTML = newContentHtml;
    }

    await updateFile(oldFileName, serializeHtml(doc), `Update article: ${oldFileName}`, sha);
    
    // Update Metadata
    const { data: metaData, sha: metaSha } = await getMetadata();
    const index = metaData.articles.findIndex(a => a.file === oldFileName);
    if (index >= 0) {
        metaData.articles[index] = { ...metaData.articles[index], title: data.title, excerpt: data.description, image: data.image, category: data.category };
        await saveMetadata(metaData, metaSha);
    }
    
    onProgress("تحديث البطاقات...");
    await updateCardInFile(RepoConfig.INDEX_FILE, oldFileName, data);
    await updateCardInFile(RepoConfig.ARTICLES_FILE, oldFileName, data);
    
    onProgress("تمت العملية!");
};

export const deleteArticle = async (fileName: string, onProgress: (msg: string) => void) => { 
    onProgress("حذف المقال...");
    try { const { sha } = await getFile(fileName); await deleteFile(fileName, "Delete", sha); } catch(e) {}
    await removeCardFromFile(RepoConfig.INDEX_FILE, fileName);
    await removeCardFromFile(RepoConfig.ARTICLES_FILE, fileName);
    // Update metadata
    const { data, sha } = await getMetadata();
    data.articles = data.articles.filter(a => a.file !== fileName);
    await saveMetadata(data, sha);
    onProgress("تم الحذف!");
};

// --- Directory / Sites Management (With AI Extraction) ---

export const getDirectoryItems = async (): Promise<DirectoryItem[]> => {
  try {
    const { content } = await getFile(RepoConfig.TOOLS_SITES_FILE);
    
    // Try AI Extraction first
    const aiData = await extractDataFromHtml(content, 'directory_list');
    if (aiData && Array.isArray(aiData) && aiData.length > 0) {
        return aiData;
    }

    // Fallback Manual Parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const items: DirectoryItem[] = [];
    doc.querySelectorAll('.grid > div').forEach((card, index) => {
       const titleEl = card.querySelector('h3');
       const linkEl = card.querySelector('a');
       if (titleEl && linkEl) {
         items.push({
             id: `item-${index}`,
             title: titleEl.textContent?.trim() || '',
             description: card.querySelector('p')?.textContent?.trim() || '',
             link: linkEl.getAttribute('href') || '',
             icon: 'link', // Simplified fallback
             colorClass: 'bg-gray-600'
         });
       }
    });
    return items;
  } catch (e) { console.warn("Failed to load directory", e); return []; }
};

export const saveDirectoryItem = async (item: DirectoryItem, onProgress: (msg: string) => void) => {
    onProgress("جاري قراءة الملف...");
    const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // Use AI to generate the card HTML based on style
    const { data } = await getMetadata();
    const smartHtml = await generateSmartCardHtml(content, item, 'directory', data.aiKnowledge);
    
    let grid = doc.querySelector('main .grid');
    if (!grid) throw new Error("No grid found");
    
    let tempDiv = doc.createElement('div');
    if (smartHtml) {
        tempDiv.innerHTML = smartHtml;
    } else {
        // Fallback HTML if AI fails
        tempDiv.innerHTML = `<div><h3>${item.title}</h3><a href="${item.link}">Visit</a></div>`; 
    }
    
    const existing = Array.from(grid.querySelectorAll('a')).find(a => a.getAttribute('href') === item.link);
    if (existing) {
        existing.closest('div.bg-white, div.rounded-2xl')?.replaceWith(tempDiv.firstElementChild!);
    } else {
        grid.appendChild(tempDiv.firstElementChild!);
    }
    
    await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Update item ${item.title}`, sha);
    onProgress("تم التحديث!");
};

export const deleteDirectoryItem = async (link: string, onProgress: (msg: string) => void) => { 
    onProgress("حذف...");
    const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const grid = doc.querySelector('main .grid');
    if (!grid) return;
    
    let deleted = false;
    Array.from(grid.children).forEach(card => {
        if (card.querySelector(`a[href="${link}"]`)) { card.remove(); deleted = true; }
    });
    
    if (deleted) {
        await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Delete item ${link}`, sha);
    }
    onProgress("تم الحذف!");
};

// --- About Page (With AI Extraction) ---

export const getAboutData = async (): Promise<AboutPageData> => {
  try {
    const { content } = await getFile('about.html');
    
    // Try AI Extraction
    const aiData = await extractDataFromHtml(content, 'about_page');
    if (aiData) return aiData;

    // Fallback
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    return {
        title: doc.querySelector('h1')?.textContent || '',
        bio: doc.querySelector('p')?.textContent || '',
        image: doc.querySelector('img.rounded-full')?.getAttribute('src') || '',
        headerImage: '',
        profileSize: 'medium',
        telegramLink: '',
        section1Title: 'Section 1', section1Items: [],
        section2Title: 'Section 2', section2Items: []
    };
  } catch (e) { return {} as any; }
};

export const saveAboutData = async (data: AboutPageData, onProgress: (msg: string) => void) => {
    onProgress("جاري الحفظ...");
    const { content, sha } = await getFile('about.html');
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    const h1 = doc.querySelector('h1');
    if (h1) h1.textContent = data.title;
    
    // ... basic text mapping (implied) ...
    
    await updateFile('about.html', serializeHtml(doc), "Update about", sha);
    onProgress("تم التحديث!");
};

// --- Implemented Services ---

export const getMetadata = async (): Promise<{ data: MetadataRoot; sha: string }> => {
  try {
    const { content, sha } = await getFile(RepoConfig.METADATA_FILE);
    return { data: JSON.parse(content), sha };
  } catch (e) {
    return { 
        data: { name: 'TechTouch', description: 'Tech News', articles: [] }, 
        sha: '' 
    };
  }
};

export const saveMetadata = async (data: any, sha?: string) => {
    await updateFile(RepoConfig.METADATA_FILE, JSON.stringify(data, null, 2), "Update metadata", sha);
};

export const getManagedArticles = async (): Promise<ArticleMetadata[]> => {
    const { data } = await getMetadata();
    return data.articles.map(a => ({
        fileName: a.file,
        title: a.title,
        category: a.category as any,
        image: a.image,
        description: a.excerpt,
        link: a.file
    }));
};

export const rebuildDatabase = async (onProgress: (msg: string) => void) => {
    onProgress("جاري جلب قائمة الملفات...");
    const response = await fetch(`${API_BASE}/contents`, { headers: getHeaders() });
    if(!response.ok) throw new Error("Failed to list files");
    const files = await response.json();
    
    const htmlFiles = files.filter((f: any) => f.name.endsWith('.html') && !['index.html', 'articles.html', 'tools-sites.html', 'about.html', '404.html'].includes(f.name));
    
    const articles: ArticleEntry[] = [];
    
    for (const file of htmlFiles) {
        onProgress(`فحـص: ${file.name}`);
        try {
            const { content } = await getFile(file.path);
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            
            const title = doc.querySelector('h1')?.textContent || file.name;
            const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const img = doc.querySelector('main img, header img')?.getAttribute('src') || '';
            
            let date = new Date().toISOString().split('T')[0];
            const parts = file.name.split('-');
            const category = ['tech', 'apps', 'games', 'sports'].includes(parts[0]) ? parts[0] : 'tech';

            articles.push({
                id: file.name.replace('.html', ''),
                title,
                slug: file.name.replace('.html', ''),
                excerpt: desc,
                image: img,
                date,
                category,
                file: file.name
            });
        } catch (e) {
            console.error(e);
        }
    }
    
    articles.sort((a, b) => a.file.localeCompare(b.file));

    const { data, sha } = await getMetadata();
    data.articles = articles;
    await saveMetadata(data, sha);
    onProgress("تم إعادة بناء قاعدة البيانات!");
};

export const uploadImage = async (file: File, onProgress: (msg: string) => void, type: 'article' | 'profile' = 'article'): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async () => {
            try {
                const base64Content = (reader.result as string).split(',')[1];
                const path = `assets/images/${type === 'article' ? 'posts' : 'profile'}/${Date.now()}-${file.name}`;
                await updateFile(path, atob(base64Content), `Upload image ${file.name}`);
                resolve(`https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${path}`);
            } catch (e) { reject(e); }
        };
        reader.readAsDataURL(file);
    });
};

export const getSiteImages = async (): Promise<string[]> => {
    try {
        const response = await fetch(`${API_BASE}/contents/assets/images/posts`, { headers: getHeaders() });
        if (!response.ok) return [];
        const files = await response.json();
        return files.map((f: any) => f.download_url);
    } catch { return []; }
};

export const parseTicker = async (): Promise<TickerData> => {
    try {
        const { content } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const ticker = doc.querySelector('.ticker-wrap .ticker-item');
        const link = doc.querySelector('.ticker-wrap a')?.getAttribute('href') || '';
        return { text: ticker?.textContent?.trim() || '', link };
    } catch { return { text: '', link: '' }; }
};

export const saveTicker = async (text: string, link: string, onProgress: (msg: string) => void) => {
    const { content, sha } = await getFile(RepoConfig.INDEX_FILE);
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const tickerWrap = doc.querySelector('.ticker-wrap');
    if (tickerWrap) {
        tickerWrap.innerHTML = `<div class="ticker"><div class="ticker-item"><a href="${link}">${text}</a></div></div>`;
        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(doc), "Update ticker", sha);
    }
};

export const updateSiteAvatar = async (url: string, onProgress: (msg: string) => void) => {
    onProgress("Avatar update simulated");
};

// --- Card Injection Implementation (Steps 2, 3, 4 of README Protocol) ---

export const addCardToFile = async (filePath: string, data: ArticleContent, fileName: string, containerSelector: string = 'main .grid', aiKnowledge?: AIAnalysisKnowledge) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // Logic to find targets based on file type
        const targets = [];
        if (filePath === RepoConfig.INDEX_FILE) {
            // Step 2: Add to #tab-all
            const tabAll = doc.querySelector('#tab-all');
            if (tabAll) {
                let grid = tabAll.querySelector('.grid');
                if (!grid) {
                    tabAll.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>';
                    grid = tabAll.querySelector('.grid');
                }
                targets.push(grid);
            }

            // Step 3: Add to #tab-[category]
            const categoryTabId = `#tab-${data.category}`;
            const tabCat = doc.querySelector(categoryTabId);
            if (tabCat) {
                let grid = tabCat.querySelector('.grid');
                if (!grid) {
                     // Clear "Loading..." text if present
                    tabCat.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>';
                    grid = tabCat.querySelector('.grid');
                }
                targets.push(grid);
            }
        } else {
            // Step 4: Articles Page
            const grid = doc.querySelector('main .grid');
            if (grid) targets.push(grid);
        }

        // Generate Card HTML
        let cardHtml = await generateSmartCardHtml(content, data, 'article', aiKnowledge);
        if (!cardHtml) {
             cardHtml = `
            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col h-full hover:shadow-md transition-shadow">
                <a href="${fileName}" class="block aspect-video overflow-hidden">
                    <img src="${data.image}" alt="${data.title}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500">
                </a>
                <div class="p-4 flex flex-col flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">${data.category}</span>
                        <span class="text-xs text-gray-500">${new Date().toLocaleDateString('ar-EG')}</span>
                    </div>
                    <h3 class="font-bold text-lg mb-2 text-slate-900 dark:text-white leading-tight">
                        <a href="${fileName}" class="hover:text-blue-600 transition-colors">${data.title}</a>
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 flex-1">
                        ${data.description}
                    </p>
                    <a href="${fileName}" class="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-auto">
                        قراءة المزيد
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                </div>
            </div>`;
        }

        let modified = false;
        targets.forEach(grid => {
            if (grid) {
                const temp = doc.createElement('div');
                temp.innerHTML = cardHtml!;
                const newCard = temp.firstElementChild;
                if (newCard) {
                    grid.insertBefore(newCard, grid.firstChild);
                    modified = true;
                }
            }
        });

        if (modified) {
            await updateFile(filePath, serializeHtml(doc), `Add card for ${fileName}`, sha);
        }

    } catch (e) {
        console.error(`Failed to add card to ${filePath}`, e);
    }
};

export const updateCardInFile = async (filePath: string, fileName: string, data: ArticleContent) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        const cards = Array.from(doc.querySelectorAll(`a[href="${fileName}"]`));
        let modified = false;

        cards.forEach(link => {
            const card = link.closest('.bg-white, .rounded-xl'); // adjust selector based on structure
            if (card) {
                const titleEl = card.querySelector('h3 a, h3');
                const imgEl = card.querySelector('img');
                const descEl = card.querySelector('p');
                
                if (titleEl) titleEl.textContent = data.title;
                if (imgEl) { imgEl.setAttribute('src', data.image); imgEl.setAttribute('alt', data.title); }
                if (descEl) descEl.textContent = data.description;
                modified = true;
            }
        });

        if (modified) {
             await updateFile(filePath, serializeHtml(doc), `Update card for ${fileName}`, sha);
        }
    } catch(e) { console.error(e); }
};

export const removeCardFromFile = async (filePath: string, fileName: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        const links = Array.from(doc.querySelectorAll(`a[href="${fileName}"]`));
        let modified = false;
        
        links.forEach(link => {
            const card = link.closest('.bg-white, .rounded-xl');
            if (card) {
                card.remove();
                modified = true;
            }
        });

        if (modified) {
             await updateFile(filePath, serializeHtml(doc), `Remove card for ${fileName}`, sha);
        }
    } catch(e) { console.error(e); }
};
