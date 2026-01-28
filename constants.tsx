import { Layout, Gamepad2, Smartphone, Trophy } from 'lucide-react';
import React from 'react';

export const CATEGORIES = [
  { id: 'tech', label: 'Tech', icon: <Layout className="w-4 h-4" /> },
  { id: 'apps', label: 'Apps', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'games', label: 'Games', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'sports', label: 'Sports', icon: <Trophy className="w-4 h-4" /> },
];

// Template from Guide Section 3 (Hybrid Ads)
export const HYBRID_AD_TEMPLATE = (imageUrl: string, linkUrl: string, slotId: string) => `
<div class="hybrid-ad-container group relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 min-h-[280px] my-8 shadow-sm">
    <div class="ad-badge absolute top-0 left-0 bg-gray-200 dark:bg-gray-700 text-[10px] px-2 py-0.5 rounded-br text-gray-500 z-20">إعلان</div>
    
    <!-- 1. Google AdSense -->
    <div class="relative z-10 w-full min-h-[280px] flex justify-center items-center">
        <ins class="adsbygoogle"
             style="display:block; width:100%; min-width:300px;"
             data-ad-client="ca-pub-7355327732066930"
             data-ad-slot="${slotId}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <!-- 2. Custom Image Fallback -->
    <a href="${linkUrl}" target="_blank" class="ad-fallback absolute inset-0 z-0 flex items-center justify-center bg-slate-200 dark:bg-slate-900" style="z-index: 10;">
        <img src="${imageUrl}" alt="إعلان" style="width: 100%; height: 100%; object-fit: cover; opacity: 1;" onerror="this.style.display='none'" />
    </a>
</div>`;

// Template from Guide Section 3.2 (Download Button)
export const DOWNLOAD_BUTTON_TEMPLATE = (url: string, text: string) => `
<div class="my-12 flex justify-center">
    <a href="${url}" target="_blank" class="btn-wrapped-link w-full md:w-auto min-w-[250px] text-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/40 flex items-center justify-center gap-2">
        <i data-lucide="download" class="w-5 h-5"></i>
        <span>${text}</span>
    </a>
</div>`;

// Template from Guide Section 2 (Article Card)
export const ARTICLE_CARD_TEMPLATE = (article: {filename: string, image: string, category: string, title: string, description: string}) => `
<a href="${article.filename}" class="group block w-full transform transition-all duration-300 hover:-translate-y-1">
    <div class="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col h-full">
        <div class="relative w-full aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img src="${article.image}" class="w-full h-full object-cover" alt="${article.title}" loading="lazy" />
            <div class="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 flex items-center gap-1">
                <i data-lucide="file-text" class="w-3 h-3"></i> <span>${article.category}</span>
            </div>
        </div>
        <div class="p-4 flex flex-col flex-1">
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2 leading-snug group-hover:text-blue-600 transition-colors">${article.title}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">${article.description}</p>
        </div>
    </div>
</a>`;

// Template from Guide Section 2 (Directory/Tools Item)
export const DIRECTORY_ITEM_TEMPLATE = (item: {link: string, title: string, description: string, icon: string, colorClass: string}) => `
<a href="${item.link}" target="_blank" class="block bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all group">
    <div class="flex items-center gap-4 h-full">
        <div class="w-12 h-12 ${item.colorClass} rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <i data-lucide="${item.icon}" class="w-6 h-6 text-white"></i>
        </div>
        <div class="flex-1 min-w-0">
            <h3 class="font-bold text-gray-900 dark:text-white text-sm mb-1">${item.title}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${item.description}</p>
        </div>
        <div class="text-gray-300 group-hover:text-blue-600 shrink-0 transition-colors">
            <i data-lucide="chevron-left" class="w-5 h-5"></i>
        </div>
    </div>
</a>`;

// Template from Guide Section 1 (Base Article)
export const BASE_ARTICLE_TEMPLATE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{TITLE}} | TechTouch</title>
    <meta name="description" content="{{DESCRIPTION}}">
    <link rel="canonical" href="https://kinanmjeed88.github.io/{{FILENAME}}">
    
    <!-- Meta Tags -->
    <meta property="og:title" content="{{TITLE}}">
    <meta property="og:description" content="{{DESCRIPTION}}">
    <meta property="og:image" content="{{IMAGE}}">
    <meta property="og:url" content="https://kinanmjeed88.github.io/{{FILENAME}}">
    <meta name="twitter:card" content="summary_large_image">

    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = { darkMode: 'class', theme: { extend: { fontFamily: { sans: ['Segoe UI', 'sans-serif'] } } } }
    </script>
    <link rel="stylesheet" href="assets/css/style.css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body class="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200 flex flex-col min-h-screen">
    
    <!-- الهيدر -->
    <header class="w-full bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 h-16 flex items-center justify-between px-4">
        <div class="flex items-center gap-3">
             <a href="index.html" class="text-xl font-black text-blue-600 dark:text-blue-400">TechTouch</a>
        </div>
        <a href="index.html" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><i data-lucide="arrow-right"></i></a>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
        <!-- العنوان والتاريخ -->
        <header class="mb-8">
            <h1 class="text-3xl font-extrabold mb-4">{{TITLE}}</h1>
            <div class="text-sm text-gray-500"><i data-lucide="calendar" class="inline w-4 h-4"></i> {{DATE}}</div>
        </header>

        <!-- الصورة الرئيسية -->
        <div class="mb-8 rounded-2xl overflow-hidden shadow-lg">
            <img id="main-image" src="{{IMAGE}}" alt="{{TITLE}}" class="w-full object-cover max-h-[500px]" />
        </div>

        <!-- محتوى المقال -->
        <article class="prose prose-lg dark:prose-invert max-w-none">
            {{CONTENT_BODY}}
            
            {{AD_SLOT_BOTTOM}}
        </article>
    </main>

    <script src="assets/js/app.js"></script>
    <script>
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    </script>
</body>
</html>`;