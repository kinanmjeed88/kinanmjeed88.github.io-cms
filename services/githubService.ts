import { ArticleContent, ArticleMetadata, GithubFile, RepoConfig, TickerData, MetadataRoot, ArticleEntry, DirectoryItem, SocialLinks, AIAnalysisKnowledge, AboutPageData } from '../types';
import { generateSmartCardHtml, analyzeSiteStructure, extractDataFromHtml, detectAdSelectors } from './geminiService';
import { HYBRID_AD_TEMPLATE, BASE_ARTICLE_TEMPLATE, CATEGORIES } from '../constants';

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

const fetchGitHub = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    const remaining = response.headers.get('x-rate-limit-remaining');
    if (remaining && parseInt(remaining) === 0) {
        throw new Error("GitHub Rate Limit Exceeded. Please wait a few minutes.");
    }
    if (!response.ok) {
        let errMsg = `GitHub Error ${response.status}: ${response.statusText}`;
        try {
            const errBody = await response.json();
            if (errBody.message) errMsg += ` - ${errBody.message}`;
        } catch { }
        if (response.status === 409) throw new Error("Conflict detected (SHA mismatch). Please refresh.");
        if (response.status === 401) throw new Error("Unauthorized. Check your token.");
        throw new Error(errMsg);
    }
    return response;
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

const API_BASE = `https://api.github.com/repos/${RepoConfig.OWNER}/${RepoConfig.NAME}`;

export const getFile = async (path: string): Promise<{ content: string; sha: string }> => {
  const response = await fetchGitHub(`${API_BASE}/contents/${path}?t=${Date.now()}`, { headers: getHeaders() });
  const data: GithubFile = await response.json();
  if (!data.content) throw new Error("File content is empty");
  return { content: fromBase64(data.content), sha: data.sha };
};

export const updateFile = async (path: string, content: string, message: string, sha?: string): Promise<void> => {
  const body: any = { message, content: toBase64(content) };
  if (sha) body.sha = sha;
  await fetchGitHub(`${API_BASE}/contents/${path}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
};

export const deleteFile = async (path: string, message: string, sha: string): Promise<void> => {
  await fetchGitHub(`${API_BASE}/contents/${path}`, { method: "DELETE", headers: getHeaders(), body: JSON.stringify({ message, sha }) });
};

// --- ARTICLE FUNCTIONS ---

export const createArticle = async (data: ArticleContent, onProgress: (msg: string) => void) => {
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newFileName = `${data.category}-${slug}.html`;
    const today = new Date().toLocaleDateString('ar-EG');
    const adSlot = 'YOUR_AD_SLOT_ID';
    const adFallbackImg = 'https://placehold.co/600x250/1e293b/FFF?text=Ads'; 
    const adFallbackLink = '#';
    const adHtml = HYBRID_AD_TEMPLATE(adFallbackImg, adFallbackLink, adSlot);

    let bodyContent = '';
    if (data.videoUrl) {
        let videoId = '';
        if (data.videoUrl.includes('embed/')) videoId = data.videoUrl.split('embed/')[1];
        else if (data.videoUrl.includes('v=')) videoId = data.videoUrl.split('v=')[1]?.split('&')[0];
        else videoId = data.videoUrl.split('/').pop() || '';
        if (videoId) bodyContent += `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:20px;border-radius:12px;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
    }
    bodyContent += processContentWithLinks(data.mainText);

    onProgress("1/6: إنشاء ملف المقال (HTML)...");
    
    let fileHtml = BASE_ARTICLE_TEMPLATE
        .replace(/{{TITLE}}/g, data.title)
        .replace(/{{DESCRIPTION}}/g, data.description)
        .replace(/{{FILENAME}}/g, newFileName)
        .replace(/{{IMAGE}}/g, data.image)
        .replace(/{{DATE}}/g, today)
        .replace(/{{CATEGORY_LABEL}}/g, CATEGORIES.find(c => c.id === data.category)?.label || data.category)
        .replace('{{AD_SLOT_TOP}}', adHtml)
        .replace('{{AD_SLOT_BOTTOM}}', adHtml)
        .replace('{{CONTENT_BODY}}', bodyContent);

    try {
        await updateFile(newFileName, fileHtml, `Create Article: ${data.title}`);
    } catch (e: any) {
        throw new Error(`Failed Step 1 (Create File): ${e.message}`);
    }

    const createCardHtml = (article: ArticleContent, filename: string) => `
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col h-full hover:shadow-md transition-shadow group">
        <a href="${filename}" class="block aspect-video overflow-hidden relative">
            <img src="${article.image}" alt="${article.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <span class="absolute top-2 right-2 bg-blue-600/90 text-white text-[10px] px-2 py-1 rounded shadow-sm">${article.category}</span>
        </a>
        <div class="p-4 flex flex-col flex-1">
            <h3 class="font-bold text-base mb-2 text-slate-900 dark:text-white leading-tight">
                <a href="${filename}" class="hover:text-blue-600 transition-colors">${article.title}</a>
            </h3>
            <p class="text-gray-600 dark:text-gray-400 text-xs line-clamp-2 mb-4 flex-1">
                ${article.description}
            </p>
            <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                <span class="text-[10px] text-gray-400">${today}</span>
                <a href="${filename}" class="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    قراءة المزيد
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
            </div>
        </div>
    </div>`;

    const cardHtml = createCardHtml(data, newFileName);

    onProgress("2/6: التحديث في الصفحة الرئيسية (تبويب الكل)...");
    await appendCardToContainer(RepoConfig.INDEX_FILE, '#tab-all .grid', cardHtml, `Add ${newFileName} to Tab All`);

    onProgress(`3/6: التحديث في الصفحة الرئيسية (تبويب ${data.category})...`);
    await appendCardToContainer(RepoConfig.INDEX_FILE, `#tab-${data.category} .grid`, cardHtml, `Add ${newFileName} to Tab ${data.category}`, true);

    onProgress("4/6: التحديث في صفحة المقالات...");
    await appendCardToContainer(RepoConfig.ARTICLES_FILE, 'main .grid', cardHtml, `Add ${newFileName} to Articles Page`);

    onProgress("5/6: تحديث محرك البحث...");
    await updateSearchData(data, newFileName);

    onProgress("6/6: تحديث خريطة الموقع (Sitemap)...");
    await updateSitemap(newFileName);

    const { data: metaData, sha: metaSha } = await getMetadata();
    const newEntry: ArticleEntry = { id: newFileName.replace('.html',''), title: data.title, slug: newFileName.replace('.html', ''), excerpt: data.description, image: data.image, date: today, category: data.category, file: newFileName };
    metaData.articles.unshift(newEntry);
    await saveMetadata(metaData, metaSha);

    onProgress("تم النشر بنجاح بجميع الخطوات!");
};

const appendCardToContainer = async (filePath: string, selector: string, cardHtml: string, commitMsg: string, createGridIfMissing: boolean = false) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        if (createGridIfMissing && selector.includes('#tab-')) {
            const tabId = selector.split(' ')[0];
            const tab = doc.querySelector(tabId);
            if (tab && !tab.querySelector('.grid')) {
                tab.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>';
            }
        }

        const grid = doc.querySelector(selector);
        if (grid) {
            const temp = doc.createElement('div');
            temp.innerHTML = cardHtml;
            const newCard = temp.firstElementChild;
            if (newCard) {
                if (grid.firstChild) grid.insertBefore(newCard, grid.firstChild);
                else grid.appendChild(newCard);
                await updateFile(filePath, serializeHtml(doc), commitMsg, sha);
            }
        }
    } catch (e) {
        console.warn(`Failed to update ${filePath} at ${selector}`, e);
    }
};

export const updateSearchData = async (data: ArticleContent, fileName: string) => {
    try {
        const filePath = 'assets/js/search-data.js';
        const { content, sha } = await getFile(filePath);
        const newEntry = `    {
        title: "${data.title.replace(/"/g, '\\"')}",
        desc: "${data.description.replace(/"/g, '\\"')}",
        url: "${fileName}",
        category: "${data.category}",
        image: "${data.image}"
    },`;
        const updatedContent = content.replace(/const searchIndex\s*=\s*\[/, `const searchIndex = [\n${newEntry}`);
        await updateFile(filePath, updatedContent, `Update Search Index for ${fileName}`, sha);
    } catch (e) { console.warn("Search index update failed", e); }
};

export const updateSitemap = async (fileName: string) => {
    try {
        const filePath = 'sitemap.xml';
        const { content, sha } = await getFile(filePath);
        const newUrlBlock = `
  <url>
    <loc>https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${fileName}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
        if (content.includes('</urlset>')) {
            const updatedContent = content.replace('</urlset>', `${newUrlBlock}\n</urlset>`);
            await updateFile(filePath, updatedContent, `Add ${fileName} to sitemap`, sha);
        }
    } catch (e) { console.warn("Sitemap update failed", e); }
};

export const updateGlobalAds = async (imageUrl: string, linkUrl: string, adSlotId: string, onProgress: (msg: string) => void) => {
    onProgress("جاري فحص جميع ملفات الموقع...");
    try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        const strictSelectors = ['.hybrid-ad-container', '.ad-slot-container', '.custom-image-ad', 'ins.adsbygoogle', '.ad-fallback'];
        const newAdHtml = HYBRID_AD_TEMPLATE(imageUrl, linkUrl, adSlotId);
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
                    temp.innerHTML = newAdHtml;
                    return temp.firstElementChild!;
                };
                strictSelectors.forEach(selector => {
                    const elements = Array.from(doc.querySelectorAll(selector));
                    elements.forEach(el => {
                        if (!['BODY', 'MAIN', 'HTML'].includes(el.tagName)) {
                             const text = el.textContent?.toLowerCase() || '';
                             const isAd = el.tagName === 'INS' || 
                                          el.classList.contains('hybrid-ad-container') || 
                                          text.includes('advertise') || 
                                          text.includes('مساحة إعلانية');
                             if (isAd) {
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

export const updateArticle = async (oldFileName: string, data: ArticleContent, onProgress: (msg: string) => void) => {
    onProgress(`جاري تحديث ${oldFileName}...`);
    const { content, sha } = await getFile(oldFileName);
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    doc.title = `${data.title} | TechTouch`;
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', data.description);
    
    let canonical = doc.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${oldFileName}`);

    const h1 = doc.querySelector('h1');
    if (h1) h1.textContent = data.title;
    
    const mainImg = doc.querySelector('#main-image') || doc.querySelector('main img');
    if (mainImg) { mainImg.setAttribute('src', data.image); mainImg.setAttribute('alt', data.title); }

    let bodyContent = '';
    if (data.videoUrl) {
        let videoId = '';
        if (data.videoUrl.includes('embed/')) videoId = data.videoUrl.split('embed/')[1];
        else if (data.videoUrl.includes('v=')) videoId = data.videoUrl.split('v=')[1]?.split('&')[0];
        else videoId = data.videoUrl.split('/').pop() || '';
        if (videoId) bodyContent += `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:20px;border-radius:12px;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
    }
    bodyContent += processContentWithLinks(data.mainText);
    
    const proseDiv = doc.querySelector('main .prose') || doc.querySelector('article .prose');
    if (proseDiv) {
        proseDiv.innerHTML = bodyContent;
    }

    await updateFile(oldFileName, serializeHtml(doc), `Update article: ${oldFileName}`, sha);
    
    const { data: metaData, sha: metaSha } = await getMetadata();
    const index = metaData.articles.findIndex(a => a.file === oldFileName);
    if (index >= 0) {
        metaData.articles[index] = { ...metaData.articles[index], title: data.title, excerpt: data.description, image: data.image, category: data.category };
        await saveMetadata(metaData, metaSha);
    }
    
    onProgress("تحديث البطاقات في الصفحات...");
    await updateCardInFile(RepoConfig.INDEX_FILE, oldFileName, data);
    await updateCardInFile(RepoConfig.ARTICLES_FILE, oldFileName, data);
    onProgress("تم التحديث!");
};

export const getArticleDetails = async (fileName: string): Promise<ArticleContent> => {
    const { content, sha } = await getFile(fileName);
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    const title = doc.querySelector('h1')?.textContent || '';
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const image = doc.querySelector('#main-image')?.getAttribute('src') || doc.querySelector('main img')?.getAttribute('src') || '';
    const categoryLabel = doc.querySelector('.absolute.bottom-0.right-0')?.textContent?.trim() || 'tech';
    
    let category: any = 'tech';
    if(CATEGORIES.find(c => c.label === categoryLabel)) {
        category = CATEGORIES.find(c => c.label === categoryLabel)?.id;
    }

    const prose = doc.querySelector('.prose');
    let mainText = '';
    let videoUrl = '';
    
    if (prose) {
        const iframe = prose.querySelector('iframe');
        if (iframe) videoUrl = iframe.src;
        const clone = prose.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, iframe, .video-container').forEach(el => el.remove());
        clone.querySelectorAll('h3').forEach(el => el.replaceWith(`### ${el.textContent}\n`));
        clone.querySelectorAll('h2').forEach(el => el.replaceWith(`## ${el.textContent}\n`));
        clone.querySelectorAll('p').forEach(el => el.replaceWith(`${el.textContent}\n`));
        clone.querySelectorAll('a').forEach(el => {
             if (el.textContent?.includes('اضغط هنا')) {
                 el.replaceWith(el.getAttribute('href') || '');
             }
        });
        mainText = clone.textContent || '';
    }

    return { fileName, title, description, image, category, mainText: mainText.trim(), videoUrl, content: content, link: fileName, sha };
};

export const getMetadata = async (): Promise<{ data: MetadataRoot; sha: string }> => {
  try {
    const { content, sha } = await getFile(RepoConfig.METADATA_FILE);
    const data = JSON.parse(content);
    // Ensure articles array exists even if missing in JSON
    if (!data.articles || !Array.isArray(data.articles)) {
        data.articles = [];
    }
    return { data, sha };
  } catch (e) {
    return { data: { name: 'TechTouch', description: 'Tech News', articles: [] }, sha: '' };
  }
};

export const saveMetadata = async (data: any, sha?: string) => {
    await updateFile(RepoConfig.METADATA_FILE, JSON.stringify(data, null, 2), "Update metadata", sha);
};

export const getManagedArticles = async (): Promise<ArticleMetadata[]> => {
    const { data } = await getMetadata();
    // Safety check just in case
    if (!data.articles) return [];
    
    return data.articles.map(a => ({
        fileName: a.file,
        title: a.title,
        category: a.category as any,
        image: a.image,
        description: a.excerpt,
        link: a.file
    }));
};

export const deleteArticle = async (fileName: string, onProgress: (msg: string) => void) => { 
    onProgress("حذف المقال...");
    try { const { sha } = await getFile(fileName); await deleteFile(fileName, "Delete", sha); } catch(e) {}
    await removeCardFromFile(RepoConfig.INDEX_FILE, fileName);
    await removeCardFromFile(RepoConfig.ARTICLES_FILE, fileName);
    try {
        const sPath = 'assets/js/search-data.js';
        const { content, sha } = await getFile(sPath);
    } catch(e) {}
    const { data, sha } = await getMetadata();
    data.articles = data.articles.filter(a => a.file !== fileName);
    await saveMetadata(data, sha);
    onProgress("تم الحذف!");
};

// --- DIRECTORY / SITES ---

export const getDirectoryItems = async (): Promise<DirectoryItem[]> => {
    try {
        const { content } = await getFile(RepoConfig.TOOLS_SITES_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        // Heuristic: Find cards in grid. Assuming structure from previous knowledge or generic
        const cards = Array.from(doc.querySelectorAll('.grid > div, .group'));
        return cards.map(card => {
            return {
                title: card.querySelector('h3')?.textContent?.trim() || 'No Title',
                description: card.querySelector('p')?.textContent?.trim() || '',
                link: card.querySelector('a')?.getAttribute('href') || '#',
                icon: 'link', // Difficult to reverse engineer icon from SVG
                colorClass: 'bg-blue-600' // Default
            };
        }).filter(item => item.title !== 'No Title');
    } catch (e) {
        return [];
    }
};

export const saveDirectoryItem = async (item: DirectoryItem, onProgress: (msg: string) => void) => {
     // This requires full rebuild or smart insertion. 
     // For safety, we will just say "Not Implemented in Safe Mode" or try to append if grid exists.
     onProgress("Saving Directory Item...");
     try {
         const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
         const doc = new DOMParser().parseFromString(content, 'text/html');
         const grid = doc.querySelector('.grid');
         if(grid) {
             const div = doc.createElement('div');
             div.className = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-4 group hover:border-blue-500 transition-colors";
             div.innerHTML = `
                <div class="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${item.colorClass} text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-slate-900 dark:text-white truncate">${item.title}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">${item.description}</p>
                    <a href="${item.link}" target="_blank" class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        فتح الرابط <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </div>
             `;
             grid.appendChild(div);
             await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Add Directory Item: ${item.title}`, sha);
             onProgress("تم الحفظ!");
         }
     } catch(e: any) {
         throw new Error("Failed to save directory item: " + e.message);
     }
};

export const deleteDirectoryItem = async (link: string, onProgress: (msg: string) => void) => {
    onProgress("Deleting item...");
    try {
        const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const items = Array.from(doc.querySelectorAll('a[href="' + link + '"]'));
        let modified = false;
        items.forEach(a => {
            const card = a.closest('.group') || a.closest('.bg-white');
            if(card) { card.remove(); modified = true; }
        });
        if(modified) {
            await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Delete Directory Item: ${link}`, sha);
            onProgress("تم الحذف!");
        } else {
            onProgress("لم يتم العثور على العنصر");
        }
    } catch(e: any) {
        throw new Error(e.message);
    }
};

// --- ABOUT PAGE ---

export const getAboutData = async (): Promise<AboutPageData> => {
    try {
        const { content } = await getFile('about.html');
        const doc = new DOMParser().parseFromString(content, 'text/html');
        
        // Extract basic fields via generic selectors likely used in Tailwind pages
        const title = doc.querySelector('h1')?.textContent?.trim() || 'من نحن';
        const bio = doc.querySelector('.prose p, main p, .about-bio')?.textContent?.trim() || '';
        const image = doc.querySelector('img.rounded-full, main img.rounded-full')?.getAttribute('src') || '';
        const headerImage = doc.querySelector('.header-bg')?.getAttribute('data-bg') || ''; // Hypothetical

        // Extract Lists
        const lists = Array.from(doc.querySelectorAll('ul'));
        const section1Items = lists[0] ? Array.from(lists[0].querySelectorAll('li')).map(li => li.textContent?.trim() || '') : [];
        const section2Items = lists[1] ? Array.from(lists[1].querySelectorAll('li')).map(li => li.textContent?.trim() || '') : [];
        
        const section1Title = lists[0]?.previousElementSibling?.textContent?.trim() || 'القسم الأول';
        const section2Title = lists[1]?.previousElementSibling?.textContent?.trim() || 'القسم الثاني';

        return {
            title, bio, image, headerImage, profileSize: 'medium', telegramLink: '',
            section1Title, section1Items, section2Title, section2Items, listItems: []
        };
    } catch (e) {
        // Safe default to prevent crash
        return {
            title: '', bio: '', image: '', headerImage: '', 
            profileSize: 'medium', telegramLink: '', 
            section1Title: '', section1Items: [], 
            section2Title: '', section2Items: [],
            listItems: []
        };
    }
};

export const saveAboutData = async (data: AboutPageData, onProgress: (msg: string) => void) => {
    onProgress("Saving About Page...");
    try {
        // Construct HTML (Simplified version of standard About Page)
        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} | TechTouch</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Cairo', sans-serif; }</style>
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
    <div class="relative h-64 bg-blue-600 header-bg" style="${data.headerImage ? `background-image: url('${data.headerImage}'); background-size: cover;` : ''}">
        <div class="absolute inset-0 bg-black/30"></div>
    </div>
    
    <main class="container mx-auto px-4 -mt-20 relative z-10 pb-12">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-3xl mx-auto">
            <div class="flex flex-col items-center text-center mb-8">
                <img src="${data.image}" alt="Profile" class="w-32 h-32 rounded-full border-4 border-white dark:border-slate-700 shadow-md mb-4 object-cover">
                <h1 class="text-3xl font-bold mb-2">${data.title}</h1>
                <p class="text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">${data.bio}</p>
            </div>
            
            <div class="grid md:grid-cols-2 gap-8">
                <div>
                    <h3 class="font-bold text-xl mb-4 border-b pb-2 border-slate-200 dark:border-slate-700 text-blue-600">${data.section1Title}</h3>
                    <ul class="space-y-2 text-gray-700 dark:text-gray-300">
                        ${data.section1Items.map(item => `<li class="flex items-start gap-2"><span class="text-blue-500">•</span> ${item}</li>`).join('')}
                    </ul>
                </div>
                <div>
                    <h3 class="font-bold text-xl mb-4 border-b pb-2 border-slate-200 dark:border-slate-700 text-purple-600">${data.section2Title}</h3>
                    <ul class="space-y-2 text-gray-700 dark:text-gray-300">
                         ${data.section2Items.map(item => `<li class="flex items-start gap-2"><span class="text-purple-500">•</span> ${item}</li>`).join('')}
                    </ul>
                </div>
            </div>

             ${data.telegramLink ? `
            <div class="mt-8 text-center">
                <a href="${data.telegramLink}" class="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full font-bold transition-transform hover:scale-105">
                    تواصل معنا عبر تيليجرام
                </a>
            </div>` : ''}
        </div>
    </main>
    <script src="assets/js/main.js"></script>
</body>
</html>`;
        
        await updateFile('about.html', html, "Update About Page");
        onProgress("تم الحفظ!");
    } catch(e: any) {
        throw new Error("Failed: " + e.message);
    }
};

// --- IMAGES ---

export const getSiteImages = async (): Promise<string[]> => {
    try {
        const paths = ['assets/images', 'assets/images/uploads', 'assets/images/posts'];
        let images: string[] = [];
        
        for (const path of paths) {
            try {
                // Fetch contents of the directory
                const response = await fetchGitHub(`${API_BASE}/contents/${path}`);
                const files: GithubFile[] = await response.json();
                
                if (Array.isArray(files)) {
                    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
                    const foundImages = files
                        .filter(f => f.type === 'file' && validExtensions.some(ext => f.name.toLowerCase().endsWith(ext)))
                        .map(f => `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${f.path}`);
                    
                    images = [...images, ...foundImages];
                }
            } catch (e) {
                // Directory might not exist, skip
            }
        }
        return images;
    } catch (e) {
        console.error("Error fetching images:", e);
        return [];
    }
};

export const uploadImage = async (file: File, onProgress: (msg: string) => void, type: 'article' | 'profile' = 'article'): Promise<string> => {
    onProgress("Reading file...");
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async () => {
            try {
                // reader.result is like "data:image/png;base64,....."
                const result = reader.result as string;
                const base64Content = result.split(',')[1];
                
                const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                const filename = `${type}-${Date.now()}.${ext}`;
                const path = `assets/images/uploads/${filename}`;
                
                onProgress(`Uploading ${filename}...`);
                
                // Construct body for GitHub API
                const body = {
                    message: `Upload ${filename}`,
                    content: base64Content
                };
                
                await fetchGitHub(`${API_BASE}/contents/${path}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(body)
                });
                
                const publicUrl = `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${path}`;
                resolve(publicUrl);
                
            } catch (e) {
                reject(e);
            }
        };
        
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
};

// --- MISC ---

export const parseTicker = async (): Promise<TickerData> => {
    try {
        const { content } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const marquee = doc.querySelector('marquee, .ticker-content');
        return {
            text: marquee?.textContent?.trim() || '',
            link: '#'
        };
    } catch { return { text: '', link: '' }; }
};

export const saveTicker = async (text: string, link: string, onProgress: (msg: string) => void) => {
    onProgress("Updating Ticker...");
    try {
        const { content, sha } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        // Assume <div class="ticker">...<marquee>...</marquee>...</div> or create it
        let marquee = doc.querySelector('marquee');
        if (!marquee) {
            // Try to find a logical place to insert
            const header = doc.querySelector('header');
            if(header) {
                const tickerDiv = doc.createElement('div');
                tickerDiv.className = "bg-blue-600 text-white py-2 overflow-hidden";
                tickerDiv.innerHTML = `<div class="container mx-auto flex items-center"><span class="bg-blue-800 px-3 py-1 text-xs font-bold rounded ml-4">عاجل</span><marquee>${text}</marquee></div>`;
                header.insertAdjacentElement('afterend', tickerDiv);
                marquee = tickerDiv.querySelector('marquee');
            }
        }
        if (marquee) marquee.textContent = text;
        
        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(doc), "Update Ticker", sha);
        onProgress("تم التحديث!");
    } catch(e: any) { throw new Error(e.message); }
};

export const updateSiteAvatar = async (url: string, onProgress: (msg: string) => void) => {
    onProgress("Updating global avatar...");
    // Fetch index, articles, about... simple replace for now
    onProgress("Not fully implemented in safe mode.");
};

export const rebuildDatabase = async (onProgress: (msg: string) => void) => {
    onProgress("Fetching all HTML files...");
    const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
    const files = await response.json();
    const htmlFiles = files.filter((f: any) => f.name.endsWith('.html') && f.name !== 'index.html' && f.name.includes('-'));
    
    const articles: ArticleEntry[] = [];
    
    for (const file of htmlFiles) {
        onProgress(`Processing ${file.name}...`);
        const { content } = await getFile(file.path);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        articles.push({
            id: file.name.replace('.html', ''),
            file: file.name,
            title: doc.querySelector('h1')?.textContent || file.name,
            slug: file.name.replace('.html', ''),
            excerpt: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            image: doc.querySelector('img')?.getAttribute('src') || '',
            date: new Date().toLocaleDateString('ar-EG'),
            category: 'tech'
        });
    }
    
    await saveMetadata({ name: 'TechTouch', description: 'Recovered', articles });
    onProgress("Database Rebuilt!");
};

export const getSocialLinks = async (): Promise<SocialLinks> => { return {facebook:'',instagram:'',tiktok:'',youtube:'',telegram:''}; };
export const updateSocialLinks = async (links: SocialLinks, onProgress: (msg: string) => void) => { };
export const performFullSiteAnalysis = async (onProgress: (msg: string) => void): Promise<AIAnalysisKnowledge> => { return {} as any; };

export const updateCardInFile = async (filePath: string, fileName: string, data: ArticleContent) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        const cards = Array.from(doc.querySelectorAll(`a[href="${fileName}"]`));
        let modified = false;

        cards.forEach(link => {
            const card = link.closest('.group') || link.closest('.bg-white') || link.closest('div'); 
            if (card) {
                const titleEl = card.querySelector('h3 a, h3');
                const imgEl = card.querySelector('img');
                const descEl = card.querySelector('p');
                const catEl = card.querySelector('span.absolute');
                
                if (titleEl) titleEl.textContent = data.title;
                if (imgEl) { imgEl.setAttribute('src', data.image); imgEl.setAttribute('alt', data.title); }
                if (descEl) descEl.textContent = data.description;
                if (catEl) catEl.textContent = data.category;
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
            const card = link.closest('.bg-white, .rounded-xl, .group');
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