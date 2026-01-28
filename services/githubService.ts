import { ArticleContent, ArticleMetadata, GithubFile, RepoConfig, TickerData, MetadataRoot, ArticleEntry, DirectoryItem, SocialLinks, AboutPageData } from '../types';
import { HYBRID_AD_TEMPLATE, BASE_ARTICLE_TEMPLATE, CATEGORIES, ARTICLE_CARD_TEMPLATE, DIRECTORY_ITEM_TEMPLATE, DOWNLOAD_BUTTON_TEMPLATE } from '../constants';

let GITHUB_TOKEN: string | null = null;

export const setGithubToken = (token: string) => {
  GITHUB_TOKEN = token;
};

export const getGithubToken = () => GITHUB_TOKEN;

// --- Helpers ---

const sanitizeUrl = (url: string): string => {
    if (!url) return '';
    const safePattern = /^(https?:\/\/|\/|\.\/|mailto:|#)/i;
    if (safePattern.test(url.trim())) {
        return url.trim();
    }
    return '#';
};

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

const escapeHtml = (unsafe: string): string => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const encodePath = (path: string): string => {
    return path.split('/').map(encodeURIComponent).join('/');
};

// --- TEMPLATES ---

const CUSTOM_AD_TEMPLATE = (imageUrl: string, linkUrl: string) => `
<div class="hybrid-ad-container group relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 min-h-[280px] my-8 shadow-sm">
    <div class="ad-badge absolute top-0 left-0 bg-gray-200 dark:bg-gray-700 text-[10px] px-2 py-0.5 rounded-br text-gray-500 z-20">إعلان</div>
    <a href="${sanitizeUrl(linkUrl) || '#'}" target="_blank" class="ad-fallback absolute inset-0 z-0 flex items-center justify-center bg-slate-200 dark:bg-slate-900" style="z-index: 10;">
        <img src="${sanitizeUrl(imageUrl)}" alt="إعلان" style="width: 100%; height: 100%; object-fit: cover;" />
    </a>
</div>`;

const getHeaders = () => {
  if (!GITHUB_TOKEN) throw new Error("GitHub Token not set");
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchGitHub = async (url: string, options: RequestInit = {}, retries = 3, backoff = 1000) => {
    try {
        const response = await fetch(url, options);
        if (response.status === 403 || response.status === 429) {
            const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
            const isRateLimit = rateLimitRemaining && parseInt(rateLimitRemaining) === 0;
            if (response.status === 429 || isRateLimit) {
                if (retries > 0) {
                    const retryAfter = response.headers.get('retry-after');
                    let waitTime = backoff;
                    if (retryAfter) {
                        const seconds = parseInt(retryAfter, 10);
                        if (!isNaN(seconds)) waitTime = (seconds * 1000) + 500;
                    }
                    console.warn(`Rate limited. Retrying in ${waitTime}ms...`);
                    await wait(waitTime);
                    return fetchGitHub(url, options, retries - 1, backoff * 2);
                }
            } else if (response.status === 403) {
                 const body = await response.json().catch(() => ({}));
                 throw new Error(`Permission Denied (403). Check Token Scopes. ${body.message || ''}`);
            }
        }
        if (!response.ok) {
            let errMsg = `GitHub Error ${response.status}: ${response.statusText}`;
            try {
                const errBody = await response.json();
                if (errBody.message) errMsg += ` - ${errBody.message}`;
            } catch { }
            throw new Error(errMsg);
        }
        return response;
    } catch (e: any) {
        throw e;
    }
};

const API_BASE = `https://api.github.com/repos/${RepoConfig.OWNER}/${RepoConfig.NAME}`;

const getYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// --- CORE FUNCTIONS ---

export const getFile = async (path: string): Promise<{ content: string; sha: string }> => {
  const encodedPath = encodePath(path);
  const response = await fetchGitHub(`${API_BASE}/contents/${encodedPath}?t=${Date.now()}`, { headers: getHeaders() });
  const data: GithubFile = await response.json();
  if (!data.content) throw new Error("File content is empty");
  return { content: fromBase64(data.content), sha: data.sha };
};

export const updateFile = async (path: string, content: string, message: string, sha?: string, isBase64: boolean = false): Promise<void> => {
  const encodedPath = encodePath(path);
  const body: any = { message, content: isBase64 ? content : toBase64(content) };
  if (sha) body.sha = sha;
  await fetchGitHub(`${API_BASE}/contents/${encodedPath}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
};

export const deleteFile = async (path: string, message: string, sha: string): Promise<void> => {
  const encodedPath = encodePath(path);
  await fetchGitHub(`${API_BASE}/contents/${encodedPath}`, { method: "DELETE", headers: getHeaders(), body: JSON.stringify({ message, sha }) });
};

// --- BUSINESS LOGIC HELPERS ---

const generateSlug = (title: string): string => {
    let slug = title.trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0600-\u06FF\-]+/g, '') 
        .toLowerCase();
    slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug || slug.length < 2) slug = `post-${Date.now()}`;
    return slug;
};

const buildArticleHtml = (data: ArticleContent, fileName: string, today: string, adSlot: string): string => {
    let bodyContent = '';
    
    // 1. Video
    if (data.videoUrl) {
        const videoId = getYouTubeId(data.videoUrl);
        if (videoId) {
            bodyContent += `
<div class="video-container my-10 shadow-2xl rounded-2xl overflow-hidden border border-gray-800 relative w-full aspect-video">
    <iframe src="https://www.youtube.com/embed/${videoId}" title="${escapeHtml(data.title)}" class="absolute inset-0 w-full h-full" allowfullscreen></iframe>
</div>\n`;
        }
    }

    // 2. Main Content
    const lines = data.mainText.split('\n').filter(p => p.trim());
    lines.forEach(line => {
        if (line.startsWith('###')) {
            bodyContent += `<h3>${escapeHtml(line.replace('###', '').trim())}</h3>`;
        } else if (line.startsWith('##')) {
            bodyContent += `<h2>${escapeHtml(line.replace('##', '').trim())}</h2>`;
        } else {
            bodyContent += `<p>${escapeHtml(line)}</p>`;
        }
    });

    // 3. Download Button
    if (data.downloadLink) {
        const btnText = data.downloadText && data.downloadText.trim() !== '' ? data.downloadText : 'اضغط هنا';
        bodyContent += DOWNLOAD_BUTTON_TEMPLATE(sanitizeUrl(data.downloadLink), escapeHtml(btnText));
    }

    const adHtml = HYBRID_AD_TEMPLATE('https://placehold.co/600x250', '#', adSlot);
    
    return BASE_ARTICLE_TEMPLATE
        .replace(/{{TITLE}}/g, escapeHtml(data.title))
        .replace(/{{DESCRIPTION}}/g, escapeHtml(data.description))
        .replace(/{{FILENAME}}/g, fileName)
        .replace(/{{IMAGE}}/g, sanitizeUrl(data.image))
        .replace(/{{DATE}}/g, today)
        .replace('{{AD_SLOT_BOTTOM}}', adHtml)
        .replace('{{CONTENT_BODY}}', bodyContent);
};

// --- ARTICLE OPERATIONS ---

export const syncArticlesFromFiles = async (onProgress: (msg: string) => void): Promise<ArticleMetadata[]> => {
    onProgress("جلب قائمة الملفات من GitHub...");
    let files;
    try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        files = await response.json();
    } catch (e: any) {
        if (e.message.includes('404')) {
            throw new Error(`لم يتم العثور على المستودع "${RepoConfig.OWNER}/${RepoConfig.NAME}". تأكد من صحة الاسم والتوكن.`);
        }
        throw e;
    }
    
    // Updated system files based on screenshot (added site-map.html and privacy.html)
    const systemFiles = ['index.html', 'articles.html', 'about.html', 'tools.html', 'tools-sites.html', 'tools-phones.html', 'tools-compare.html', 'tool-analysis.html', '404.html', 'privacy.html', 'site-map.html'];
    const articleFiles = files.filter((f: any) => 
        f.name.endsWith('.html') && 
        f.name.includes('-') && 
        !systemFiles.includes(f.name)
    );

    const articles: ArticleMetadata[] = [];
    let count = 0;

    for (const file of articleFiles) {
        onProgress(`تحليل ${file.name} (${count + 1}/${articleFiles.length})...`);
        try {
            const { content } = await getFile(file.path);
            const doc = new DOMParser().parseFromString(content, 'text/html');
            
            const title = doc.querySelector('h1')?.textContent || file.name.replace('.html', '').replace(/-/g, ' ');
            const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const image = doc.querySelector('#main-image')?.getAttribute('src') || doc.querySelector('main img')?.getAttribute('src') || '';
            
            let category: any = 'tech';
            const filenameParts = file.name.split('-');
            if (['tech', 'apps', 'games', 'sports'].includes(filenameParts[0])) {
                category = filenameParts[0];
            } else {
                 const catLabel = doc.querySelector('.absolute.bottom-0.right-0')?.textContent?.trim();
                 if (catLabel) {
                      const found = CATEGORIES.find(c => c.label === catLabel);
                      if (found) category = found.id;
                 }
            }

            articles.push({ fileName: file.name, title, description, image, category, link: file.name });
            count++;
        } catch (e) { console.warn(`Failed to parse ${file.name}`); }
    }

    onProgress("تحديث قاعدة البيانات...");
    const { sha: metaSha } = await getMetadata();
    const newMetadata: MetadataRoot = {
        name: 'TechTouch',
        description: 'Synced',
        articles: articles.map(a => ({
            id: a.fileName.replace('.html', ''),
            title: a.title,
            slug: a.fileName.replace('.html', ''),
            excerpt: a.description,
            image: a.image,
            date: new Date().toLocaleDateString('ar-EG'),
            category: a.category,
            file: a.fileName
        }))
    };
    await saveMetadata(newMetadata, metaSha);
    
    onProgress(`تمت المزامنة! تم العثور على ${count} مقال.`);
    return articles;
};

export const createArticle = async (data: ArticleContent, onProgress: (msg: string) => void) => {
    const slug = generateSlug(data.title);
    const newFileName = `${data.category}-${slug}.html`;
    const today = new Date().toLocaleDateString('ar-EG');
    const adSlot = 'YOUR_AD_SLOT_ID';
    
    onProgress("1/5: إنشاء ملف المقال...");
    const fileHtml = buildArticleHtml(data, newFileName, today, adSlot);

    try {
        await updateFile(newFileName, fileHtml, `Create Article: ${data.title}`);
    } catch (e: any) { throw new Error(`Failed Step 1: ${e.message}`); }

    const cardHtml = ARTICLE_CARD_TEMPLATE({
        filename: newFileName,
        title: data.title,
        description: data.description,
        image: data.image,
        category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
    });

    onProgress("2/5: التحديث في الصفحة الرئيسية...");
    await insertCardIntoFile(RepoConfig.INDEX_FILE, [
        { selector: '#tab-articles', html: cardHtml },
        { selector: '#tab-home', html: cardHtml },
        { selector: `#tab-${data.category}`, html: cardHtml }
    ], `Add ${newFileName} to index`);

    onProgress("3/5: التحديث في صفحة المقالات...");
    await insertCardIntoFile(RepoConfig.ARTICLES_FILE, [
        { selector: '.grid', html: cardHtml }
    ], `Add ${newFileName} to articles page`);

    onProgress("4/5: تحديث محرك البحث...");
    await updateSearchData(data, newFileName);

    const { data: metaData, sha: metaSha } = await getMetadata();
    const newEntry: ArticleEntry = { id: newFileName.replace('.html',''), title: data.title, slug: newFileName.replace('.html', ''), excerpt: data.description, image: data.image, date: today, category: data.category, file: newFileName };
    metaData.articles.unshift(newEntry);
    await saveMetadata(metaData, metaSha);

    onProgress("تم النشر بنجاح!");
};

export const updateArticle = async (oldFileName: string, data: ArticleContent, onProgress: (msg: string) => void) => {
    onProgress(`جاري تحديث ${oldFileName}...`);
    const { sha } = await getFile(oldFileName);
    const today = new Date().toLocaleDateString('ar-EG');
    const adSlot = 'YOUR_AD_SLOT_ID';

    const fileHtml = buildArticleHtml(data, oldFileName, today, adSlot);
    await updateFile(oldFileName, fileHtml, `Update article: ${oldFileName}`, sha);
    
    onProgress("تحديث البطاقات في الصفحة الرئيسية...");
    try {
        const { content: indexContent, sha: indexSha } = await getFile(RepoConfig.INDEX_FILE);
        const indexDoc = new DOMParser().parseFromString(indexContent, 'text/html');
        
        const cardHtml = ARTICLE_CARD_TEMPLATE({
            filename: oldFileName,
            title: data.title,
            description: data.description,
            image: data.image,
            category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
        });

        const updateInContainer = (selector: string) => {
            let card = indexDoc.querySelector(`${selector} a[href="${oldFileName}"]`) || 
                       indexDoc.querySelector(`${selector} a[href*="${oldFileName}"]`);

            if (card) {
                const temp = indexDoc.createElement('div');
                temp.innerHTML = cardHtml;
                card.replaceWith(temp.firstElementChild!);
            } else {
                const container = indexDoc.querySelector(selector);
                if (container) {
                    const grid = container.classList.contains('grid') ? container : container.querySelector('.grid') || container;
                    const temp = indexDoc.createElement('div');
                    temp.innerHTML = cardHtml;
                    if(grid.firstChild) grid.insertBefore(temp.firstElementChild!, grid.firstChild);
                    else grid.appendChild(temp.firstElementChild!);
                }
            }
        };

        updateInContainer('#tab-articles');
        updateInContainer('#tab-home');

        CATEGORIES.forEach(cat => {
            const tabId = `#tab-${cat.id}`;
            let cardInTab = indexDoc.querySelector(`${tabId} a[href="${oldFileName}"]`) || 
                            indexDoc.querySelector(`${tabId} a[href*="${oldFileName}"]`);
            
            if (cat.id === data.category) {
                if (cardInTab) {
                    const temp = indexDoc.createElement('div');
                    temp.innerHTML = cardHtml;
                    cardInTab.replaceWith(temp.firstElementChild!);
                } else {
                    const container = indexDoc.querySelector(tabId);
                    if (container) {
                        const grid = container.querySelector('.grid') || container;
                        const temp = indexDoc.createElement('div');
                        temp.innerHTML = cardHtml;
                        if(grid.firstChild) grid.insertBefore(temp.firstElementChild!, grid.firstChild);
                        else grid.appendChild(temp.firstElementChild!);
                    }
                }
            } else {
                if (cardInTab) cardInTab.remove();
            }
        });

        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(indexDoc), `Update index for ${oldFileName}`, indexSha);
    } catch (e) { console.warn("Index update failed", e); }

    await replaceCardInFile(RepoConfig.ARTICLES_FILE, oldFileName, ARTICLE_CARD_TEMPLATE({
        filename: oldFileName,
        title: data.title,
        description: data.description,
        image: data.image,
        category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
    }));

    onProgress("تحديث محرك البحث...");
    await updateSearchData(data, oldFileName);

    onProgress("تم التحديث!");
};

const insertCardIntoFile = async (filePath: string, insertions: {selector: string, html: string}[], commitMsg: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        let modified = false;
        insertions.forEach(ins => {
            const container = doc.querySelector(ins.selector);
            if (container) {
                const target = container.classList.contains('grid') ? container : container.querySelector('.grid') || container;
                const temp = doc.createElement('div');
                temp.innerHTML = ins.html;
                const newNode = temp.firstElementChild;
                if (newNode) {
                    if (target.firstChild) target.insertBefore(newNode, target.firstChild);
                    else target.appendChild(newNode);
                    modified = true;
                }
            }
        });
        if (modified) await updateFile(filePath, serializeHtml(doc), commitMsg, sha);
    } catch (e) { console.warn(`Failed to update ${filePath}`, e); }
};

const replaceCardInFile = async (filePath: string, href: string, newHtml: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const cards = Array.from(doc.querySelectorAll(`a[href="${href}"], a[href*="${href}"]`));
        if (cards.length > 0) {
            const temp = doc.createElement('div');
            temp.innerHTML = newHtml;
            const newNode = temp.firstElementChild;
            if(newNode) {
                cards.forEach(card => card.replaceWith(newNode.cloneNode(true)));
                await updateFile(filePath, serializeHtml(doc), `Update card ${href}`, sha);
            }
        }
    } catch (e) {}
};

export const updateSearchData = async (data: ArticleContent, fileName: string) => {
    try {
        const filePath = 'assets/js/search-data.js';
        const { content, sha } = await getFile(filePath);
        
        const newEntry = `    {
        title: "${data.title.replace(/"/g, '\\"')}",
        desc: "${data.description.replace(/"/g, '\\"')}",
        url: "${fileName}",
        category: "${CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'}",
        image: "${data.image}"
    },`;

        const dedupeRegex = new RegExp(`\\{[\\s\\S]*?url:\\s*["']${fileName}["'][\\s\\S]*?\\},?\\s*`, 'g');
        let updatedContent = content.replace(dedupeRegex, '');
        const startRegex = /(const|var|let)\s+searchIndex\s*=\s*\[/;
        
        if (startRegex.test(updatedContent)) {
            updatedContent = updatedContent.replace(startRegex, `$&\n${newEntry}`);
            await updateFile(filePath, updatedContent, `Update Search Index for ${fileName}`, sha);
        }
    } catch (e) { console.warn("Search index update failed", e); }
};

export const removeSearchData = async (fileName: string) => {
    try {
        const filePath = 'assets/js/search-data.js';
        const { content, sha } = await getFile(filePath);
        const dedupeRegex = new RegExp(`\\{[\\s\\S]*?url:\\s*["']${fileName}["'][\\s\\S]*?\\},?\\s*`, 'g');
        const updatedContent = content.replace(dedupeRegex, '');
        if (updatedContent !== content) {
            await updateFile(filePath, updatedContent, `Remove ${fileName} from Search Index`, sha);
        }
    } catch (e) { console.warn("Failed to remove from search index", e); }
};

export const deleteArticle = async (fileName: string, onProgress: (msg: string) => void) => { 
    onProgress("حذف الملفات...");
    try { const { sha } = await getFile(fileName); await deleteFile(fileName, "Delete", sha); } catch(e) {}
    await deleteCardFromFile(RepoConfig.INDEX_FILE, fileName);
    await deleteCardFromFile(RepoConfig.ARTICLES_FILE, fileName);
    await removeSearchData(fileName); // Added based on manual instructions
    const { data, sha } = await getMetadata();
    data.articles = data.articles.filter(a => a.file !== fileName);
    await saveMetadata(data, sha);
    onProgress("تم الحذف!");
};

const deleteCardFromFile = async (filePath: string, href: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const cards = Array.from(doc.querySelectorAll(`a[href="${href}"], a[href*="${href}"]`));
        if(cards.length > 0) {
            cards.forEach(c => c.remove());
            await updateFile(filePath, serializeHtml(doc), `Remove card ${href}`, sha);
        }
    } catch {}
};

// --- DIRECTORY LOGIC ---

export const getDirectoryItems = async (): Promise<DirectoryItem[]> => {
    try {
        const { content } = await getFile(RepoConfig.TOOLS_SITES_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        // Prioritize grid logic as per manual
        const gridCards = Array.from(doc.querySelectorAll('.grid > a'));
        if (gridCards.length > 0) {
             return gridCards.map(card => parseCard(card));
        }
        // Fallback to legacy marquee logic if needed
        const marqueeCards = Array.from(doc.querySelectorAll('.marquee-text-content')).map(el => el.closest('a')).filter(Boolean) as HTMLAnchorElement[];
        return marqueeCards.map(card => parseCard(card));
    } catch { return []; }
};

function parseCard(card: Element): DirectoryItem {
    const colorDiv = card.querySelector('div[class*="w-12"]'); 
    let colorClass = 'bg-blue-600';
    if (colorDiv) {
        const cls = Array.from(colorDiv.classList).find(c => c.startsWith('bg-') && !c.includes('white') && !c.includes('slate') && !c.includes('gray-5'));
        if (cls) colorClass = cls;
    }
    return {
        title: card.querySelector('h3')?.textContent?.trim() || 'No Title',
        description: card.querySelector('p')?.textContent?.trim() || '',
        link: card.getAttribute('href') || '#',
        icon: card.querySelector('i')?.getAttribute('data-lucide') || 'globe',
        colorClass: colorClass
    };
}

export const saveDirectoryItem = async (item: DirectoryItem, onProgress: (msg: string) => void) => {
     onProgress("جاري إضافة البطاقة...");
     try {
         const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
         const doc = new DOMParser().parseFromString(content, 'text/html');
         
         let grid = doc.querySelector('.grid');
         if(!grid) {
             const existingItem = doc.querySelector('.marquee-text-content')?.closest('a')?.parentElement;
             if (existingItem) grid = existingItem;
         }

         if(grid) {
             const temp = doc.createElement('div');
             temp.innerHTML = DIRECTORY_ITEM_TEMPLATE(item);
             const newEl = temp.firstElementChild;
             if (newEl) {
                 const existing = doc.querySelector(`a[href="${item.link}"]`);
                 if (existing) {
                     existing.replaceWith(newEl);
                 } else {
                     const folderItem = grid.querySelector('a[href*="t.me/addlist"]');
                     if (folderItem) grid.insertBefore(newEl, folderItem);
                     else grid.appendChild(newEl);
                 }
                 await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Add Directory Item: ${item.title}`, sha);
                 onProgress("تم الحفظ!");
             }
         } else {
             throw new Error("لم يتم العثور على شبكة العرض (Grid) في الملف.");
         }
     } catch(e: any) { throw new Error("Failed: " + e.message); }
};

export const deleteDirectoryItem = async (link: string, onProgress: (msg: string) => void) => {
    onProgress("جاري الحذف...");
    try {
        const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const item = doc.querySelector(`a[href="${link}"]`);
        if(item) {
            item.remove();
            await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Delete Directory Item: ${link}`, sha);
            onProgress("تم الحذف!");
        } else {
            onProgress("لم يتم العثور على العنصر");
        }
    } catch(e: any) { throw new Error(e.message); }
};

// --- OTHER FEATURES ---

export const parseTicker = async (): Promise<TickerData> => {
    try {
        const { content } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        let container = doc.querySelector('marquee');
        if (!container) container = doc.querySelector('.animate-marquee');

        if (container) {
            const anchor = container.querySelector('a');
            const span = container.querySelector('span');
            // Prefer existing element text
            const text = anchor?.textContent?.trim() || span?.textContent?.trim() || container.textContent?.trim() || '';
            const link = anchor?.getAttribute('href') || '#';
            return { text, link };
        }
        return { text: '', link: '' };
    } catch { return { text: '', link: '' }; }
};

export const saveTicker = async (text: string, link: string, onProgress: (msg: string) => void) => {
    onProgress("Updating Ticker...");
    try {
        const { content, sha } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        let container = doc.querySelector('marquee');
        if (!container) container = doc.querySelector('.animate-marquee');
        
        if (container) {
            // Check for existing element to preserve type (span vs a) and classes
            const existingEl = container.querySelector('a') || container.querySelector('span');
            const cssClasses = existingEl ? existingEl.className : "text-white hover:text-blue-300 transition-colors mx-4 font-medium flex items-center";
            const tagName = existingEl ? existingEl.tagName.toLowerCase() : 'a'; // Default to 'a' if nothing found, or use what's there

            container.innerHTML = ''; 
            const newEl = doc.createElement(tagName);
            
            if (tagName === 'a') {
                (newEl as HTMLAnchorElement).href = link || '#';
            }
            
            newEl.textContent = text;
            newEl.className = cssClasses;
            
            // Basic styling for anchors if class missing
            if (tagName === 'a' && !newEl.className.includes('text-')) {
                 newEl.style.color = "inherit";
                 newEl.style.textDecoration = "none";
            }
            container.appendChild(newEl);
        }
        
        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(doc), "Update Ticker", sha);
        onProgress("تم التحديث!");
    } catch(e: any) { throw new Error(e.message); }
};

export const getSiteImages = async (): Promise<string[]> => { 
    try {
        // Changed from assets/images/uploads to assets/images based on repo screenshots
        const res = await fetchGitHub(`${API_BASE}/contents/assets/images`);
        const files = await res.json();
        return Array.isArray(files) ? files.map((f:any) => f.download_url) : [];
    } catch { return []; }
};

export const uploadImage = async (file: File, onProgress: (msg: string) => void, type: 'article' | 'profile' = 'article'): Promise<string> => {
    onProgress("التحقق من الملف...");
    if (!file.type.startsWith('image/')) throw new Error("نوع الملف غير مدعوم.");
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) throw new Error("حجم الملف كبير جداً.");

    onProgress("جاري الرفع...");
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const result = reader.result as string;
                const parts = result.split(',');
                if (parts.length < 2) throw new Error("فشل في قراءة ملف الصورة");
                const base64Content = parts[1];
                
                const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const ext = file.name.split('.').pop() || 'jpg';
                const filename = type === 'profile' ? 'me.jpg' : `img_${uniqueSuffix}.${ext}`;
                // Simplified path: everything goes to assets/images/
                const path = `assets/images/${filename}`;

                let sha;
                try {
                    const existing = await fetchGitHub(`${API_BASE}/contents/${path}`);
                    const json = await existing.json();
                    sha = json.sha;
                } catch {}

                await updateFile(path, base64Content, "Upload Image", sha, true);
                const isRoot = RepoConfig.NAME === `${RepoConfig.OWNER}.github.io`;
                const baseUrl = `https://${RepoConfig.OWNER}.github.io${isRoot ? '' : '/' + RepoConfig.NAME}`;
                resolve(`${baseUrl}/${path}`);
            } catch (e: any) { reject(e); }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
};

export const updateSiteAvatar = async (url: string, onProgress: (msg: string) => void) => {
    onProgress("تحديث الروابط في HTML...");
     try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        const cleanUrl = url.split('?')[0]; 
        const newSrc = `${cleanUrl}?v=${Date.now()}`;

        for (const file of htmlFiles) {
            try {
                const { content, sha } = await getFile(file.path);
                const doc = new DOMParser().parseFromString(content, 'text/html');
                const imgs = Array.from(doc.querySelectorAll('img'));
                let modified = false;
                imgs.forEach(img => {
                    const src = img.getAttribute('src') || '';
                    const isProfileImage = img.classList.contains('site-avatar') || img.id === 'profile-image' || src.endsWith('/me.jpg') || src === 'me.jpg';
                    if (isProfileImage) {
                        img.setAttribute('src', newSrc);
                        if (!img.classList.contains('site-avatar')) img.classList.add('site-avatar');
                        modified = true;
                    }
                });
                if (modified) await updateFile(file.path, serializeHtml(doc), "Update avatar", sha);
            } catch {}
        }
        onProgress("تم!");
     } catch(e:any) { onProgress(e.message); }
};

export const updateGlobalAds = async (imageUrl: string, linkUrl: string, adSlotId: string, onProgress: (msg: string) => void) => {
    onProgress("جاري فحص ملفات الموقع...");
    try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        let updatedCount = 0;
        const validCustomImage = imageUrl && imageUrl !== 'undefined' && imageUrl.trim() !== '';
        const newAdHtml = validCustomImage ? CUSTOM_AD_TEMPLATE(imageUrl, linkUrl) : HYBRID_AD_TEMPLATE('https://placehold.co/600x250', '#', adSlotId);

        for (const file of htmlFiles) {
            try {
                await wait(50);
                onProgress(`تحديث ${file.name}...`);
                const { content, sha } = await getFile(file.path);
                const doc = new DOMParser().parseFromString(content, 'text/html');
                let isModified = false;
                const containers = Array.from(doc.querySelectorAll('.hybrid-ad-container'));
                if (containers.length > 0) {
                    containers.forEach(el => {
                        const temp = doc.createElement('div');
                        temp.innerHTML = newAdHtml;
                        if (el.parentNode) {
                            el.replaceWith(temp.firstElementChild!);
                            isModified = true;
                        }
                    });
                    if (isModified) {
                        await updateFile(file.path, serializeHtml(doc), "Update Ads", sha);
                        updatedCount++;
                    }
                }
            } catch (e) { console.warn(`Skipping ${file.name}`, e); }
        }
        onProgress(`تم تحديث الإعلانات في ${updatedCount} صفحة!`);
    } catch (e: any) { onProgress("خطأ: " + e.message); }
};

// ... (About, Social, and GetArticleDetails functions) ...

export const getAboutData = async (): Promise<AboutPageData> => {
    try {
        const { content } = await getFile('about.html');
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const findSection = (index: number) => {
            const uls = doc.querySelectorAll('ul');
            if (uls[index]) {
                const titleEl = uls[index].previousElementSibling;
                const title = titleEl?.tagName.match(/H[1-6]/) ? titleEl.textContent?.trim() || '' : '';
                const items = Array.from(uls[index].querySelectorAll('li')).map(li => li.textContent?.replace(/[•-]/g, '').trim() || '');
                return { title, items };
            }
            return { title: '', items: [] };
        };
        const sec1 = findSection(0);
        const sec2 = findSection(1);
        return {
            title: doc.querySelector('h1')?.textContent?.trim() || 'من نحن',
            bio: doc.querySelector('p')?.textContent?.trim() || '',
            image: doc.querySelector('img.rounded-full')?.getAttribute('src') || '',
            headerImage: '', profileSize: 'medium', telegramLink: '',
            section1Title: sec1.title || 'القسم الأول', section1Items: sec1.items,
            section2Title: sec2.title || 'القسم الثاني', section2Items: sec2.items,
            listItems: []
        };
    } catch { return { title: '', bio: '', image: '', headerImage: '', profileSize: 'medium', telegramLink: '', section1Title: '', section1Items: [], section2Title: '', section2Items: [], listItems: [] }; }
};

export const saveAboutData = async (data: AboutPageData, onProgress: (msg: string) => void) => {
    onProgress("تحديث صفحة من نحن...");
    try {
        const { content, sha } = await getFile('about.html');
        const doc = new DOMParser().parseFromString(content, 'text/html');
        if (doc.querySelector('h1')) doc.querySelector('h1')!.textContent = data.title;
        const bioP = doc.querySelector('.bg-white p') || doc.querySelector('main p');
        if (bioP) bioP.textContent = data.bio;
        const headerDiv = doc.querySelector('.header-bg') || doc.querySelector('div[class*="bg-gradient-to-r"]');
        if (headerDiv && data.headerImage) {
            headerDiv.classList.remove('bg-gradient-to-r', 'from-blue-700', 'to-blue-500');
            headerDiv.setAttribute('style', `background-image: url('${data.headerImage}'); background-size: cover; background-position: center;`);
        }
        const profileImg = doc.querySelector('img.rounded-full');
        if (profileImg) profileImg.setAttribute('src', data.image);
        const updateSection = (index: number, title: string, items: string[], color: string) => {
            const uls = doc.querySelectorAll('ul');
            if (uls[index]) {
                const titleEl = uls[index].previousElementSibling;
                if (titleEl) titleEl.textContent = title;
                uls[index].innerHTML = items.map(item => `<li class="flex items-start gap-2"><span class="text-${color}-500">•</span> ${escapeHtml(item)}</li>`).join('');
            }
        };
        updateSection(0, data.section1Title, data.section1Items, 'blue');
        updateSection(1, data.section2Title, data.section2Items, 'purple');
        await updateFile('about.html', serializeHtml(doc), "Update About Page", sha);
        onProgress("تم الحفظ!");
    } catch(e: any) { throw new Error("Failed: " + e.message); }
};

export const updateSocialLinks = async (links: SocialLinks, onProgress: (msg: string) => void) => {
    onProgress("جاري تحديث الروابط...");
    try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        let count = 0;
        for (const file of htmlFiles) {
            try {
                const { content, sha } = await getFile(file.path);
                const doc = new DOMParser().parseFromString(content, 'text/html');
                let modified = false;
                const updateHref = (domain: string, newUrl: string) => {
                    if (!newUrl) return;
                    Array.from(doc.querySelectorAll('a')).forEach(a => {
                        if (a.href.includes(domain)) { a.href = newUrl; modified = true; }
                    });
                };
                updateHref('facebook.com', links.facebook);
                updateHref('instagram.com', links.instagram);
                updateHref('tiktok.com', links.tiktok);
                updateHref('youtube.com', links.youtube);
                updateHref('t.me', links.telegram);
                if (modified) { await updateFile(file.path, serializeHtml(doc), "Update Social Links", sha); count++; }
            } catch(e) {}
        }
        onProgress(`تم تحديث الروابط في ${count} صفحة.`);
    } catch (e: any) { throw new Error(e.message); }
};

export const getSocialLinks = async (): Promise<SocialLinks> => { 
    try {
        const { content } = await getFile(RepoConfig.INDEX_FILE);
        const extract = (d: string) => {
            const regex = new RegExp(`href=["'](https?:\\/\\/(?:www\\.)?${d}\\/[^"']+)["']`);
            return content.match(regex)?.[1] || '';
        };
        return { facebook: extract('facebook.com'), instagram: extract('instagram.com'), tiktok: extract('tiktok.com'), youtube: extract('youtube.com'), telegram: extract('t.me') };
    } catch { return {facebook:'',instagram:'',tiktok:'',youtube:'',telegram:''}; }
};

export const getMetadata = async (): Promise<{ data: MetadataRoot; sha: string }> => {
  try {
    const { content, sha } = await getFile(RepoConfig.METADATA_FILE);
    const data = JSON.parse(content);
    if (!data.articles) data.articles = [];
    return { data, sha };
  } catch (e) {
    return { data: { name: 'TechTouch', description: 'CMS', articles: [] }, sha: '' };
  }
};

export const saveMetadata = async (data: any, sha?: string) => {
    await updateFile(RepoConfig.METADATA_FILE, JSON.stringify(data, null, 2), "Update metadata", sha);
};

export const getManagedArticles = async (): Promise<ArticleMetadata[]> => {
    const { data } = await getMetadata();
    return data.articles.map(a => ({ fileName: a.file, title: a.title, category: a.category as any, image: a.image, description: a.excerpt, link: a.file }));
};

export const getArticleDetails = async (fileName: string): Promise<ArticleContent> => {
    const { content } = await getFile(fileName);
    const doc = new DOMParser().parseFromString(content, 'text/html');
    let mainText = '';
    doc.querySelectorAll('.prose p, .prose h2, .prose h3').forEach(el => {
        if(el.tagName === 'H2') mainText += `## ${el.textContent}\n`;
        else if(el.tagName === 'H3') mainText += `### ${el.textContent}\n`;
        else mainText += `${el.textContent}\n`;
    });
    const videoFrame = doc.querySelector('.video-container iframe');
    let videoUrl = '';
    if (videoFrame) {
        const src = videoFrame.getAttribute('src') || '';
        if (src.includes('/embed/')) {
            const id = src.split('/embed/')[1].split('?')[0];
            videoUrl = `https://www.youtube.com/watch?v=${id}`;
        }
    }
    const btnLink = doc.querySelector('.btn-wrapped-link');
    let downloadLink = '';
    let downloadText = '';
    if (btnLink) {
        downloadLink = btnLink.getAttribute('href') || '';
        downloadText = btnLink.querySelector('span')?.textContent || '';
    }

    let category: any = 'tech';
    const parts = fileName.split('-');
    if (['tech', 'apps', 'games', 'sports'].includes(parts[0])) {
        category = parts[0];
    } else {
        const catLabel = doc.querySelector('.absolute.bottom-0.right-0')?.textContent?.trim();
        if (catLabel) {
            const found = CATEGORIES.find(c => c.label === catLabel);
            if (found) category = found.id;
        }
    }

    return {
        fileName,
        title: doc.querySelector('h1')?.textContent || '',
        description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        image: doc.querySelector('#main-image')?.getAttribute('src') || '',
        category: category,
        mainText: mainText.trim(),
        videoUrl,
        downloadLink,
        downloadText,
        content,
        link: fileName
    };
};