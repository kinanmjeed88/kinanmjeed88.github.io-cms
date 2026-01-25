import { ArticleContent, ArticleMetadata, GithubFile, RepoConfig, TickerData, MetadataRoot, ArticleEntry, DirectoryItem, SocialLinks, AboutPageData } from '../types';
import { HYBRID_AD_TEMPLATE, BASE_ARTICLE_TEMPLATE, CATEGORIES, ARTICLE_CARD_TEMPLATE, DIRECTORY_ITEM_TEMPLATE } from '../constants';

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

// --- ARTICLE LOGIC (Strictly follows Guide Section 2) ---

export const createArticle = async (data: ArticleContent, onProgress: (msg: string) => void) => {
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newFileName = `${data.category}-${slug}.html`;
    const today = new Date().toLocaleDateString('ar-EG');
    const adSlot = 'YOUR_AD_SLOT_ID';
    
    // Step 1: Create Article File
    onProgress("1/5: إنشاء ملف المقال (HTML)...");
    
    // Process text content
    let bodyContent = '';
    if (data.videoUrl) {
        let videoId = data.videoUrl.split('v=')[1]?.split('&')[0] || data.videoUrl.split('/').pop() || '';
        if (videoId) bodyContent += `<div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:20px;border-radius:12px;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
    }
    const lines = data.mainText.split('\n').filter(p => p.trim());
    lines.forEach(line => {
        if (line.startsWith('###')) bodyContent += `<h3>${line.replace('###', '').trim()}</h3>`;
        else if (line.startsWith('##')) bodyContent += `<h2>${line.replace('##', '').trim()}</h2>`;
        else bodyContent += `<p>${line}</p>`;
    });

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

    // Prepare Card HTML
    const cardHtml = ARTICLE_CARD_TEMPLATE({
        filename: newFileName,
        title: data.title,
        description: data.description,
        image: data.image,
        category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
    });

    // Step 2: Update index.html (Tab All & Specific Tab)
    onProgress("2/5: التحديث في الصفحة الرئيسية...");
    await insertCardIntoFile(RepoConfig.INDEX_FILE, [
        { selector: '#tab-all', html: cardHtml },
        { selector: `#tab-${data.category}`, html: cardHtml }
    ], `Add ${newFileName} to index`);

    // Step 3: Update articles.html
    onProgress("3/5: التحديث في صفحة المقالات...");
    await insertCardIntoFile(RepoConfig.ARTICLES_FILE, [
        { selector: '.grid', html: cardHtml }
    ], `Add ${newFileName} to articles page`);

    // Step 4: Update Search Data
    onProgress("4/5: تحديث محرك البحث...");
    await updateSearchData(data, newFileName);

    // Metadata update (Internal use)
    const { data: metaData, sha: metaSha } = await getMetadata();
    const newEntry: ArticleEntry = { id: newFileName.replace('.html',''), title: data.title, slug: newFileName.replace('.html', ''), excerpt: data.description, image: data.image, date: today, category: data.category, file: newFileName };
    metaData.articles.unshift(newEntry);
    await saveMetadata(metaData, metaSha);

    onProgress("تم النشر بنجاح!");
};

// Helper for "Step 2 & 3" - Inserts HTML at the BEGINNING of a container
const insertCardIntoFile = async (filePath: string, insertions: {selector: string, html: string}[], commitMsg: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        let modified = false;

        insertions.forEach(ins => {
            const container = doc.querySelector(ins.selector);
            // If selector targets a Tab div directly, we might need to find the grid inside it or just append
            // Guide says: "find <div id="tab-all"> and add code at start"
            if (container) {
                // Check if container itself is the grid or contains a grid
                const target = container.classList.contains('grid') ? container : container.querySelector('.grid') || container;
                
                const temp = doc.createElement('div');
                temp.innerHTML = ins.html;
                const newNode = temp.firstElementChild;
                
                if (newNode) {
                    if (target.firstChild) {
                        target.insertBefore(newNode, target.firstChild);
                    } else {
                        target.appendChild(newNode);
                    }
                    modified = true;
                }
            }
        });

        if (modified) {
            await updateFile(filePath, serializeHtml(doc), commitMsg, sha);
        }
    } catch (e) {
        console.warn(`Failed to update ${filePath}`, e);
    }
};

export const updateSearchData = async (data: ArticleContent, fileName: string) => {
    try {
        const filePath = 'assets/js/search-data.js';
        const { content, sha } = await getFile(filePath);
        // Guide Step 4: Add to start of searchIndex array
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

    // Standard HTML Updates
    doc.title = `${data.title} | TechTouch`;
    doc.querySelector('h1')!.textContent = data.title;
    doc.querySelector('meta[name="description"]')?.setAttribute('content', data.description);
    
    // Handle Image
    const img = doc.querySelector('#main-image') || doc.querySelector('main img');
    if (img) img.setAttribute('src', data.image);

    // Handle Content
    let bodyContent = '';
    const lines = data.mainText.split('\n').filter(p => p.trim());
    lines.forEach(line => {
        if (line.startsWith('###')) bodyContent += `<h3>${line.replace('###', '').trim()}</h3>`;
        else if (line.startsWith('##')) bodyContent += `<h2>${line.replace('##', '').trim()}</h2>`;
        else bodyContent += `<p>${line}</p>`;
    });
    const prose = doc.querySelector('.prose');
    if (prose) prose.innerHTML = bodyContent;

    await updateFile(oldFileName, serializeHtml(doc), `Update article: ${oldFileName}`, sha);
    
    // We assume cards are updated via simple metadata refresh here for simplicity
    // A full card update in index.html would require finding by HREF and replacing outerHTML
    onProgress("تحديث البطاقات في الصفحات الرئيسية...");
    const cardHtml = ARTICLE_CARD_TEMPLATE({
        filename: oldFileName,
        title: data.title,
        description: data.description,
        image: data.image,
        category: CATEGORIES.find(c => c.id === data.category)?.label || 'Tech'
    });
    
    // Update cards in index and articles
    await replaceCardInFile(RepoConfig.INDEX_FILE, oldFileName, cardHtml);
    await replaceCardInFile(RepoConfig.ARTICLES_FILE, oldFileName, cardHtml);

    onProgress("تم التحديث!");
};

const replaceCardInFile = async (filePath: string, href: string, newHtml: string) => {
    try {
        const { content, sha } = await getFile(filePath);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const cards = Array.from(doc.querySelectorAll(`a[href="${href}"]`));
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

// --- DIRECTORY LOGIC (Guide Section 5) ---

export const getDirectoryItems = async (): Promise<DirectoryItem[]> => {
    try {
        const { content } = await getFile(RepoConfig.TOOLS_SITES_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        // Guide logic: <a href="..." class="block ...">...</a>
        const cards = Array.from(doc.querySelectorAll('.grid > a'));
        return cards.map(card => {
            const colorDiv = card.querySelector('.w-10.h-10');
            const colorClass = colorDiv ? Array.from(colorDiv.classList).find(c => c.startsWith('bg-') && !c.includes('white')) || 'bg-blue-600' : 'bg-blue-600';
            return {
                title: card.querySelector('h3')?.textContent?.trim() || 'No Title',
                description: card.querySelector('.marquee-text-content')?.textContent?.trim() || '',
                link: card.getAttribute('href') || '#',
                icon: card.querySelector('i')?.getAttribute('data-lucide') || 'globe',
                colorClass: colorClass
            };
        });
    } catch { return []; }
};

export const saveDirectoryItem = async (item: DirectoryItem, onProgress: (msg: string) => void) => {
     onProgress("جاري إضافة البطاقة...");
     try {
         const { content, sha } = await getFile(RepoConfig.TOOLS_SITES_FILE);
         const doc = new DOMParser().parseFromString(content, 'text/html');
         const grid = doc.querySelector('.grid');
         if(grid) {
             const temp = doc.createElement('div');
             // Use STRICT TEMPLATE from guide
             temp.innerHTML = DIRECTORY_ITEM_TEMPLATE(item);
             const newEl = temp.firstElementChild;
             
             if (newEl) {
                 // Check if updating existing
                 const existing = doc.querySelector(`a[href="${item.link}"]`);
                 if (existing) existing.replaceWith(newEl);
                 else grid.appendChild(newEl);
                 
                 await updateFile(RepoConfig.TOOLS_SITES_FILE, serializeHtml(doc), `Add Directory Item: ${item.title}`, sha);
                 onProgress("تم الحفظ!");
             }
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

// --- ADS LOGIC (Guide Section 3) ---

export const updateGlobalAds = async (imageUrl: string, linkUrl: string, adSlotId: string, onProgress: (msg: string) => void) => {
    onProgress("جاري فحص جميع ملفات الموقع...");
    try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));
        
        // Strict Template from Guide
        const newAdHtml = HYBRID_AD_TEMPLATE(imageUrl, linkUrl, adSlotId);
        let updatedCount = 0;

        for (const file of htmlFiles) {
            try {
                onProgress(`تحديث ${file.name}...`);
                const { content, sha } = await getFile(file.path);
                const doc = new DOMParser().parseFromString(content, 'text/html');
                let isModified = false;

                // Find existing hybrid containers or create replacement logic
                const containers = Array.from(doc.querySelectorAll('.hybrid-ad-container'));
                if (containers.length > 0) {
                    containers.forEach(el => {
                        const temp = doc.createElement('div');
                        temp.innerHTML = newAdHtml;
                        el.replaceWith(temp.firstElementChild!);
                        isModified = true;
                    });
                }

                if (isModified) {
                    await updateFile(file.path, serializeHtml(doc), "Update ads to Hybrid System", sha);
                    updatedCount++;
                }
            } catch (e) { console.warn(`Skipping ${file.name}`, e); }
        }
        onProgress(`تم تحديث الإعلانات بنظام Hybrid في ${updatedCount} صفحة!`);
    } catch (e: any) { onProgress("خطأ: " + e.message); }
};

// --- ABOUT PAGE LOGIC (Guide Section 4) ---

export const getAboutData = async (): Promise<AboutPageData> => {
    try {
        const { content } = await getFile('about.html');
        const doc = new DOMParser().parseFromString(content, 'text/html');
        
        // Basic extraction based on typical structure
        return {
            title: doc.querySelector('h1')?.textContent?.trim() || 'من نحن',
            bio: doc.querySelector('p')?.textContent?.trim() || '',
            image: doc.querySelector('img.rounded-full')?.getAttribute('src') || '',
            headerImage: '', // Hard to parse from inline style easily, kept simple
            profileSize: 'medium', telegramLink: '',
            section1Title: 'قسم 1', section1Items: [],
            section2Title: 'قسم 2', section2Items: [],
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

        // 1. Update Title & Bio
        if (doc.querySelector('h1')) doc.querySelector('h1')!.textContent = data.title;
        if (doc.querySelector('p')) doc.querySelector('p')!.textContent = data.bio;

        // 2. Update Header Background (Guide Section 4)
        // Find div with bg-gradient or style
        const headerDiv = doc.querySelector('.header-bg') || doc.querySelector('div[class*="bg-gradient-to-r"]');
        if (headerDiv && data.headerImage) {
            // Remove gradient classes
            headerDiv.classList.remove('bg-gradient-to-r', 'from-blue-700', 'to-blue-500');
            headerDiv.setAttribute('style', `background-image: url('${data.headerImage}'); background-size: cover; background-position: center;`);
        }

        // 3. Update Profile Image
        const profileImg = doc.querySelector('img.rounded-full');
        if (profileImg) profileImg.setAttribute('src', data.image);

        await updateFile('about.html', serializeHtml(doc), "Update About Page", sha);
        onProgress("تم الحفظ!");
    } catch(e: any) {
        throw new Error("Failed: " + e.message);
    }
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
    
    // Remove cards (Naive approach - relies on full reload usually, but we try)
    await deleteCardFromFile(RepoConfig.INDEX_FILE, fileName);
    await deleteCardFromFile(RepoConfig.ARTICLES_FILE, fileName);
    
    // Metadata
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

// --- MISC ---
export const parseTicker = async (): Promise<TickerData> => {
    try {
        const { content } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const marquee = doc.querySelector('marquee');
        return { text: marquee?.textContent?.trim() || '', link: '#' };
    } catch { return { text: '', link: '' }; }
};

export const saveTicker = async (text: string, link: string, onProgress: (msg: string) => void) => {
    onProgress("Updating Ticker...");
    try {
        const { content, sha } = await getFile(RepoConfig.INDEX_FILE);
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const marquee = doc.querySelector('marquee');
        if (marquee) marquee.textContent = text;
        await updateFile(RepoConfig.INDEX_FILE, serializeHtml(doc), "Update Ticker", sha);
        onProgress("تم التحديث!");
    } catch(e: any) { throw new Error(e.message); }
};

export const getSiteImages = async (): Promise<string[]> => { return []; }; // Simplified for now
export const uploadImage = async (file: File, onP: any, type: any) => { return 'placeholder.jpg'; }; // Simplified
export const getSocialLinks = async (): Promise<SocialLinks> => { return {facebook:'',instagram:'',tiktok:'',youtube:'',telegram:''}; };
export const updateSocialLinks = async (l: SocialLinks, o: any) => {};
export const updateSiteAvatar = async (url: string, onProgress: (msg: string) => void) => {
    onProgress("تحديث الصورة الشخصية...");
     try {
        const response = await fetchGitHub(`${API_BASE}/contents`, { headers: getHeaders() });
        const files = await response.json();
        const htmlFiles = files.filter((f: any) => f.name.endsWith('.html'));

        for (const file of htmlFiles) {
            try {
                const { content, sha } = await getFile(file.path);
                const doc = new DOMParser().parseFromString(content, 'text/html');
                // Guide says: Update image to 'me.jpg' usually, but here we update SRC
                const imgs = Array.from(doc.querySelectorAll('img'));
                let modified = false;
                imgs.forEach(img => {
                    if (img.src.includes('profile') || img.src.includes('me.jpg') || img.classList.contains('rounded-full')) {
                        img.src = url;
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
    
    // Parse back content to text
    let mainText = '';
    doc.querySelectorAll('p, h2, h3').forEach(el => {
        if(el.tagName === 'H2') mainText += `## ${el.textContent}\n`;
        else if(el.tagName === 'H3') mainText += `### ${el.textContent}\n`;
        else mainText += `${el.textContent}\n`;
    });

    return {
        fileName,
        title: doc.querySelector('h1')?.textContent || '',
        description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        image: doc.querySelector('img')?.getAttribute('src') || '',
        category: 'tech',
        mainText,
        content,
        link: fileName
    };
};
