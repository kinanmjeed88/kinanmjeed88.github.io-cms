import { ArticleContent, ArticleMetadata, GithubFile, RepoConfig, TickerData, MetadataRoot, ArticleEntry, DirectoryItem, SocialLinks, AboutPageData } from '../types';
import { HYBRID_AD_TEMPLATE, BASE_ARTICLE_TEMPLATE, CATEGORIES, ARTICLE_CARD_TEMPLATE, DIRECTORY_ITEM_TEMPLATE, DOWNLOAD_BUTTON_TEMPLATE } from '../constants';

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
    if (!response.ok) {
        let errMsg = `GitHub Error ${response.status}: ${response.statusText}`;
        try {
            const errBody = await response.json();
            if (errBody.message) errMsg += ` - ${errBody.message}`;
        } catch { }
        throw new Error(errMsg);
    }
    return response;
};

const API_BASE = `https://api.github.com/repos/${RepoConfig.OWNER}/${RepoConfig.NAME}`;

// Helper to extract YouTube ID from various URL formats
const getYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

export const getFile = async (path: string): Promise<{ content: string; sha: string }> => {
  const response = await fetchGitHub(`${API_BASE}/contents/${path}?t=${Date.now()}`, { headers: getHeaders() });
  const data: GithubFile = await response.json();
  if (!data.content) throw new Error("File content is empty");
  return { content: fromBase64(data.content), sha: data.sha };
};

export const updateFile = async (path: string, content: string, message: string, sha?: string, isBase64: boolean = false): Promise<void> => {
  // If isBase64 is true, we use content as is. Otherwise we encode it.
  const body: any = { message, content: isBase64 ? content : toBase64(content) };
  if (sha) body.sha = sha;
  await fetchGitHub(`${API_BASE}/contents/${path}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify(body) });
};

export const deleteFile = async (path: string, message: string, sha: string): Promise<void> => {
  await fetchGitHub(`${API_BASE}/contents/${path}`, { method: "DELETE", headers: getHeaders(), body: JSON.stringify({ message, sha }) });
};

// --- ARTICLE LOGIC ---

// Fallback: Fetch all HTML files and parse them if metadata is empty
export const syncArticlesFromFiles = async (onProgress: (msg: string) => void): Promise<ArticleMetadata[]> => {
    onProgress("جلب قائمة الملفات من GitHub...");
    const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
    const files = await response.json();
    
    // Filter for article files (heuristic: ends with .html, contains hyphen, not a system file)
    const systemFiles = ['index.html', 'articles.html', 'about.html', 'tools.html', 'tools-sites.html', 'tools-phones.html', 'tools-compare.html', 'tool-analysis.html', '404.html'];
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
            
            // Extract category from filename or badge
            let category: any = 'tech';
            const catLabel = doc.querySelector('.absolute.bottom-0.right-0')?.textContent?.trim();
            if (catLabel) {
                 const found = CATEGORIES.find(c => c.label === catLabel);
                 if (found) category = found.id;
            } else {
                 const firstPart = file.name.split('-')[0];
                 if (['tech', 'apps', 'games', 'sports'].includes(firstPart)) category = firstPart;
            }

            articles.push({
                fileName: file.name,
                title,
                description,
                image,
                category,
                link: file.name
            });
            count++;
        } catch (e) {
            console.warn(`Failed to parse ${file.name}`);
        }
    }

    // Update metadata.json with the results to speed up next load
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
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newFileName = `${data.category}-${slug}.html`;
    const today = new Date().toLocaleDateString('ar-EG');
    const adSlot = 'YOUR_AD_SLOT_ID'; // Default placeholder
    
    onProgress("1/5: إنشاء ملف المقال...");
    
    let bodyContent = '';
    
    // 1. Video (Embedded Iframe)
    if (data.videoUrl) {
        const videoId = getYouTubeId(data.videoUrl);
        if (videoId) {
            bodyContent += `
<div class="video-container my-8 relative w-full aspect-video rounded-xl overflow-hidden shadow-lg">
    <iframe 
        src="https://www.youtube.com/embed/${videoId}" 
        title="${data.title}" 
        class="absolute inset-0 w-full h-full"
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
    </iframe>
</div>\n`;
        }
    }

    // 2. Main Content
    const lines = data.mainText.split('\n').filter(p => p.trim());
    lines.forEach(line => {
        if (line.startsWith('###')) bodyContent += `<h3>${line.replace('###', '').trim()}</h3>`;
        else if (line.startsWith('##')) bodyContent += `<h2>${line.replace('##', '').trim()}</h2>`;
        else bodyContent += `<p>${line}</p>`;
    });

    // 3. Wrapped Link (Button)
    if (data.downloadLink) {
        // Enforce "اضغط هنا" if text is not provided or generic
        const btnText = data.downloadText && data.downloadText.trim() !== '' ? data.downloadText : 'اضغط هنا';
        bodyContent += DOWNLOAD_BUTTON_TEMPLATE(data.downloadLink, btnText);
    }

    const adHtml = HYBRID_AD_TEMPLATE('https://placehold.co/600x250', '#', adSlot);
    let fileHtml = BASE_ARTICLE_TEMPLATE
        .replace(/{{TITLE}}/g, data.title)
        .replace(/{{DESCRIPTION}}/g, data.description)
        .replace(/{{FILENAME}}/g, newFileName)
        .replace(/{{IMAGE}}/g, data.image)
        .replace(/{{DATE}}/g, today)
        .replace(/{{CATEGORY_LABEL}}/g, CATEGORIES.find(c => c.id === data.category)?.label || data.category)
        .replace('{{AD_SLOT_BOTTOM}}', adHtml)
        .replace('{{CONTENT_BODY}}', bodyContent);

    try {
        await updateFile(newFileName, fileHtml, `Create Article: ${data.title}`);
    } catch (e: any) {
        throw new Error(`Failed Step 1: ${e.message}`);
    }

    const cardHtml = ARTICLE_CARD_TEMPLATE({
        filename: newFileName,
        title: data.title,
        description: data.description,
        image: data.image,
        category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
    });

    onProgress("2/5: التحديث في الصفحة الرئيسية...");
    // Robust insertion into All and specific category
    await insertCardIntoFile(RepoConfig.INDEX_FILE, [
        { selector: '#tab-all', html: cardHtml },
        { selector: `#tab-${data.category}`, html: cardHtml }
    ], `Add ${newFileName} to index`);

    onProgress("3/5: التحديث في صفحة المقالات...");
    await insertCardIntoFile(RepoConfig.ARTICLES_FILE, [
        { selector: '.grid', html: cardHtml }
    ], `Add ${newFileName} to articles page`);

    onProgress("4/5: تحديث محرك البحث...");
    await updateSearchData(data, newFileName);

    // Update Metadata cache
    const { data: metaData, sha: metaSha } = await getMetadata();
    const newEntry: ArticleEntry = { id: newFileName.replace('.html',''), title: data.title, slug: newFileName.replace('.html', ''), excerpt: data.description, image: data.image, date: today, category: data.category, file: newFileName };
    metaData.articles.unshift(newEntry);
    await saveMetadata(metaData, metaSha);

    onProgress("تم النشر بنجاح!");
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

export const updateSearchData = async (data: ArticleContent, fileName: string) => {
    try {
        const filePath = 'assets/js/search-data.js';
        const { content, sha } = await getFile(filePath);
        // Match Guide's format for search index
        const newEntry = `    {
        title: "${data.title.replace(/"/g, '\\"')}",
        desc: "${data.description.replace(/"/g, '\\"')}",
        url: "${fileName}",
        category: "${CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'}",
        image: "${data.image}"
    },`;
        const updatedContent = content.replace(/const searchIndex\s*=\s*\[/, `const searchIndex = [\n${newEntry}`);
        await updateFile(filePath, updatedContent, `Update Search Index for ${fileName}`, sha);
    } catch (e) { console.warn("Search index update failed", e); }
};

export const updateArticle = async (oldFileName: string, data: ArticleContent, onProgress: (msg: string) => void) => {
    onProgress(`جاري تحديث ${oldFileName}...`);
    const { content, sha } = await getFile(oldFileName);
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    doc.title = `${data.title} | TechTouch`;
    const h1 = doc.querySelector('h1');
    if(h1) h1.textContent = data.title;
    
    doc.querySelector('meta[name="description"]')?.setAttribute('content', data.description);
    
    // Update main image in article
    const img = doc.querySelector('#main-image') || doc.querySelector('main img');
    if (img) img.setAttribute('src', data.image);

    let bodyContent = '';
    // Reconstruct body with video/link options if present
    if (data.videoUrl) {
        const videoId = getYouTubeId(data.videoUrl);
        if (videoId) {
            bodyContent += `
<div class="video-container my-8 relative w-full aspect-video rounded-xl overflow-hidden shadow-lg">
    <iframe 
        src="https://www.youtube.com/embed/${videoId}" 
        title="${data.title}" 
        class="absolute inset-0 w-full h-full"
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
    </iframe>
</div>\n`;
        }
    }

    const lines = data.mainText.split('\n').filter(p => p.trim());
    lines.forEach(line => {
        if (line.startsWith('###')) bodyContent += `<h3>${line.replace('###', '').trim()}</h3>`;
        else if (line.startsWith('##')) bodyContent += `<h2>${line.replace('##', '').trim()}</h2>`;
        else bodyContent += `<p>${line}</p>`;
    });

    if (data.downloadLink) {
         const btnText = data.downloadText && data.downloadText.trim() !== '' ? data.downloadText : 'اضغط هنا';
        bodyContent += DOWNLOAD_BUTTON_TEMPLATE(data.downloadLink, btnText);
    }

    const prose = doc.querySelector('.prose');
    if (prose) prose.innerHTML = bodyContent;

    await updateFile(oldFileName, serializeHtml(doc), `Update article: ${oldFileName}`, sha);
    
    onProgress("تحديث البطاقات في الصفحة الرئيسية...");
    
    // Advanced Index Update: Handle category changes correctly
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

        // 1. Update in 'All' Tab (Use href includes matching to be safe)
        // Try precise match first, then fallback to filename match
        let allTabCard = indexDoc.querySelector(`#tab-all a[href="${oldFileName}"]`);
        if (!allTabCard) allTabCard = indexDoc.querySelector(`#tab-all a[href*="${oldFileName}"]`);

        if (allTabCard) {
            const temp = indexDoc.createElement('div');
            temp.innerHTML = cardHtml;
            allTabCard.replaceWith(temp.firstElementChild!);
        } else {
            // If missing, insert at top of All Tab
            const allGrid = indexDoc.querySelector('#tab-all .grid') || indexDoc.querySelector('#tab-all');
            if (allGrid) {
                const temp = indexDoc.createElement('div');
                temp.innerHTML = cardHtml;
                if(allGrid.firstChild) allGrid.insertBefore(temp.firstElementChild!, allGrid.firstChild);
                else allGrid.appendChild(temp.firstElementChild!);
            }
        }

        // 2. Handle Categories (Move if category changed)
        CATEGORIES.forEach(cat => {
            const tabId = `#tab-${cat.id}`;
            let cardInTab = indexDoc.querySelector(`${tabId} a[href="${oldFileName}"]`);
            if (!cardInTab) cardInTab = indexDoc.querySelector(`${tabId} a[href*="${oldFileName}"]`);
            
            if (cat.id === data.category) {
                // Should be here
                if (cardInTab) {
                    // Replace in place
                    const temp = indexDoc.createElement('div');
                    temp.innerHTML = cardHtml;
                    cardInTab.replaceWith(temp.firstElementChild!);
                } else {
                    // Insert at top
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
                // Should NOT be here
                if (cardInTab) {
                    cardInTab.remove();
                }
            }
        });

        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(indexDoc), `Update index for ${oldFileName}`, indexSha);

    } catch (e) { console.warn("Index update failed", e); }

    // Update Articles Page (Simple replacement)
    await replaceCardInFile(RepoConfig.ARTICLES_FILE, oldFileName, ARTICLE_CARD_TEMPLATE({
        filename: oldFileName,
        title: data.title,
        description: data.description,
        image: data.image,
        category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
    }));

    onProgress("تم التحديث!");
};

const replaceCardInFile = async (filePath: string, href: string, newHtml: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        // Use inclusive matching for href
        const cards = Array.from(doc.querySelectorAll(`a[href*="${href}"]`));
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

// --- DIRECTORY LOGIC ---

export const getDirectoryItems = async (): Promise<DirectoryItem[]> => {
    try {
        const { content } = await getFile(RepoConfig.TOOLS_SITES_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        // Search for cards based on unique class
        const cards = Array.from(doc.querySelectorAll('.marquee-text-content')).map(el => el.closest('a')).filter(Boolean) as HTMLAnchorElement[];
        
        if (cards.length === 0) {
             const gridCards = Array.from(doc.querySelectorAll('.grid > a'));
             return gridCards.map(card => parseCard(card));
        }

        return cards.map(card => parseCard(card));
    } catch { return []; }
};

function parseCard(card: Element): DirectoryItem {
    const colorDiv = card.querySelector('div[class*="w-10"]'); 
    let colorClass = 'bg-blue-600';
    
    if (colorDiv) {
        const cls = Array.from(colorDiv.classList).find(c => c.startsWith('bg-') && !c.includes('white') && !c.includes('slate') && !c.includes('gray-5'));
        if (cls) colorClass = cls;
    }
    
    return {
        title: card.querySelector('h3')?.textContent?.trim() || 'No Title',
        description: card.querySelector('.marquee-text-content')?.textContent?.trim() || card.querySelector('p')?.textContent?.trim() || '',
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
                     // Try insert before Folder item (usually the last or big one)
                     const folderItem = grid.querySelector('a[href*="t.me/addlist"]');
                     if (folderItem) {
                         grid.insertBefore(newEl, folderItem);
                     } else {
                         grid.appendChild(newEl);
                     }
                 }
                 
                 await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Add Directory Item: ${item.title}`, sha);
                 onProgress("تم الحفظ!");
             }
         } else {
             throw new Error("لم يتم العثور على شبكة العرض (Grid) في الملف.");
         }
     } catch(e: any) {
         throw new Error("Failed: " + e.message);
     }
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
    } catch(e: any) {
        throw new Error(e.message);
    }
};

// --- ADS LOGIC ---

const CUSTOM_AD_TEMPLATE = (imageUrl: string, linkUrl: string) => `
<div class="hybrid-ad-container group relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 min-h-[280px] my-8 shadow-sm">
    <div class="ad-badge absolute top-0 left-0 bg-gray-200 dark:bg-gray-700 text-[10px] px-2 py-0.5 rounded-br text-gray-500 z-20">إعلان</div>
    <a href="${linkUrl || '#'}" target="_blank" class="ad-fallback absolute inset-0 z-0 flex items-center justify-center bg-slate-200 dark:bg-slate-900" style="z-index: 10;">
        <img src="${imageUrl}" alt="إعلان" style="width: 100%; height: 100%; object-fit: cover;" />
    </a>
</div>`;

export const updateGlobalAds = async (imageUrl: string, linkUrl: string, adSlotId: string, onProgress: (msg: string) => void) => {
    onProgress("جاري فحص جميع ملفات الموقع...");
    try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        
        let updatedCount = 0;
        const validCustomImage = imageUrl && imageUrl !== 'undefined' && imageUrl.trim() !== '';
        
        const newAdHtml = validCustomImage
            ? CUSTOM_AD_TEMPLATE(imageUrl, linkUrl) 
            : HYBRID_AD_TEMPLATE('https://placehold.co/600x250', '#', adSlotId);

        for (const file of htmlFiles) {
            try {
                onProgress(`تحديث ${file.name}...`);
                const { content, sha } = await getFile(file.path);
                const doc = new DOMParser().parseFromString(content, 'text/html');
                let isModified = false;

                const containers = Array.from(doc.querySelectorAll('.hybrid-ad-container'));
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
            } catch (e) { console.warn(`Skipping ${file.name}`, e); }
        }
        onProgress(`تم تحديث الإعلانات في ${updatedCount} صفحة!`);
    } catch (e: any) { onProgress("خطأ: " + e.message); }
};

// --- ABOUT PAGE LOGIC ---

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
            headerImage: '', 
            profileSize: 'medium', telegramLink: '',
            section1Title: sec1.title || 'القسم الأول', 
            section1Items: sec1.items,
            section2Title: sec2.title || 'القسم الثاني', 
            section2Items: sec2.items,
            listItems: []
        };
    } catch {
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
                uls[index].innerHTML = items.map(item => 
                    `<li class="flex items-start gap-2"><span class="text-${color}-500">•</span> ${item}</li>`
                ).join('');
            }
        };

        updateSection(0, data.section1Title, data.section1Items, 'blue');
        updateSection(1, data.section2Title, data.section2Items, 'purple');

        await updateFile('about.html', serializeHtml(doc), "Update About Page", sha);
        onProgress("تم الحفظ!");
    } catch(e: any) {
        throw new Error("Failed: " + e.message);
    }
};

// --- SOCIAL LINKS ---
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
                    const anchors = Array.from(doc.querySelectorAll('a'));
                    anchors.forEach(a => {
                        if (a.href.includes(domain)) {
                            a.href = newUrl;
                            modified = true;
                        }
                    });
                };

                updateHref('facebook.com', links.facebook);
                updateHref('instagram.com', links.instagram);
                updateHref('tiktok.com', links.tiktok);
                updateHref('youtube.com', links.youtube);
                updateHref('t.me', links.telegram);

                if (modified) {
                    await updateFile(file.path, serializeHtml(doc), "Update Social Links", sha);
                    count++;
                }
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
        return {
            facebook: extract('facebook.com'), instagram: extract('instagram.com'),
            tiktok: extract('tiktok.com'), youtube: extract('youtube.com'),
            telegram: extract('t.me')
        };
    } catch { return {facebook:'',instagram:'',tiktok:'',youtube:'',telegram:''}; }
};

// --- GENERIC ---
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
    return data.articles.map(a => ({
        fileName: a.file, title: a.title, category: a.category as any, image: a.image, description: a.excerpt, link: a.file
    }));
};

export const deleteArticle = async (fileName: string, onProgress: (msg: string) => void) => { 
    onProgress("حذف الملفات...");
    try { const { sha } = await getFile(fileName); await deleteFile(fileName, "Delete", sha); } catch(e) {}
    await deleteCardFromFile(RepoConfig.INDEX_FILE, fileName);
    await deleteCardFromFile(RepoConfig.ARTICLES_FILE, fileName);
    const { data, sha } = await getMetadata();
    data.articles = data.articles.filter(a => a.file !== fileName);
    await saveMetadata(data, sha);
    onProgress("تم الحذف!");
};

const deleteCardFromFile = async (filePath: string, href: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const card = doc.querySelector(`a[href="${href}"]`);
        if(card) {
            card.remove();
            await updateFile(filePath, serializeHtml(doc), `Remove card ${href}`, sha);
        }
    } catch {}
};

export const parseTicker = async (): Promise<TickerData> => {
    try {
        const { content } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        let container = doc.querySelector('marquee');
        if (!container) container = doc.querySelector('.animate-marquee');

        if (container) {
            const anchor = container.querySelector('a');
            if (anchor) {
                return { text: anchor.textContent?.trim() || '', link: anchor.getAttribute('href') || '#' };
            }
            return { text: container.textContent?.trim() || '', link: '#' };
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
            container.innerHTML = ''; 
            const a = doc.createElement('a');
            a.href = link;
            a.textContent = text;
            a.className = "text-white hover:text-blue-300 transition-colors mx-4 font-medium flex items-center"; 
            a.style.color = "inherit";
            a.style.textDecoration = "none";
            container.appendChild(a);
        }
        
        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(doc), "Update Ticker", sha);
        onProgress("تم التحديث!");
    } catch(e: any) { throw new Error(e.message); }
};

export const getSiteImages = async (): Promise<string[]> => { 
    try {
        const res = await fetchGitHub(`${API_BASE}/contents/assets/images/uploads`);
        const files = await res.json();
        return Array.isArray(files) ? files.map((f:any) => f.download_url) : [];
    } catch { return []; }
};

export const uploadImage = async (file: File, onProgress: (msg: string) => void, type: 'article' | 'profile' = 'article'): Promise<string> => {
    onProgress("جاري الرفع...");
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                // Get raw base64 string and ensure it's clean
                let content = (reader.result as string).split(',')[1];
                // Remove newlines or whitespace that might corrupt the binary logic on GitHub's side
                content = content.replace(/\s/g, '');
                
                // Unique Filename Generation: timestamp + random string
                const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const ext = file.name.split('.').pop() || 'jpg';
                const filename = type === 'profile' ? 'me.jpg' : `img_${uniqueSuffix}.${ext}`;
                
                const path = `assets/images/${type === 'profile' ? '' : 'uploads/'}${filename}`;
                
                let sha;
                try {
                    const existing = await fetchGitHub(`${API_BASE}/contents/${path}`);
                    if(existing.ok) sha = (await existing.json()).sha;
                } catch {}

                // Send true for isBase64 to skip double encoding and pass raw content
                await updateFile(path, content, "Upload Image", sha, true); 
                const url = `https://${RepoConfig.OWNER}.github.io/${RepoConfig.NAME}/${path}`;
                resolve(url);
            } catch (e) { reject(e); }
        };
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
                    const alt = img.getAttribute('alt') || '';
                    if (
                        src.includes('me.jpg') || 
                        src.includes('profile') || 
                        img.classList.contains('rounded-full') || 
                        (alt && alt.toLowerCase().includes('profile')) ||
                        (alt && alt.includes('كنان'))
                    ) {
                        img.setAttribute('src', newSrc);
                        modified = true;
                    }
                });
                if (modified) await updateFile(file.path, serializeHtml(doc), "Update avatar", sha);
            } catch {}
        }
        onProgress("تم!");
     } catch(e:any) { onProgress(e.message); }
};

export const getArticleDetails = async (fileName: string): Promise<ArticleContent> => {
    const { content } = await getFile(fileName);
    const doc = new DOMParser().parseFromString(content, 'text/html');
    
    // Extract main text from standard elements
    let mainText = '';
    doc.querySelectorAll('.prose p, .prose h2, .prose h3').forEach(el => {
        if(el.tagName === 'H2') mainText += `## ${el.textContent}\n`;
        else if(el.tagName === 'H3') mainText += `### ${el.textContent}\n`;
        else mainText += `${el.textContent}\n`;
    });

    // Extract Video URL from iframe
    const videoFrame = doc.querySelector('.video-container iframe');
    let videoUrl = '';
    if (videoFrame) {
        const src = videoFrame.getAttribute('src') || '';
        // Reconstruct common URL
        if (src.includes('/embed/')) {
            const id = src.split('/embed/')[1].split('?')[0];
            videoUrl = `https://www.youtube.com/watch?v=${id}`;
        }
    }

    // Extract Wrapped Link (Button)
    const btnLink = doc.querySelector('.btn-wrapped-link');
    let downloadLink = '';
    let downloadText = '';
    if (btnLink) {
        downloadLink = btnLink.getAttribute('href') || '';
        downloadText = btnLink.querySelector('span')?.textContent || '';
    }

    return {
        fileName,
        title: doc.querySelector('h1')?.textContent || '',
        description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        image: doc.querySelector('#main-image')?.getAttribute('src') || '',
        category: 'tech',
        mainText: mainText.trim(),
        videoUrl,
        downloadLink,
        downloadText,
        content,
        link: fileName
    };
};