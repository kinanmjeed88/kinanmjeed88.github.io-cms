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
    
    <!-- 1. Google AdSense (Hidden fallback logic handled by CSS in real site usually, but here we place it) -->
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

// Template from Guide Section 2 (Article Card)
export const ARTICLE_CARD_TEMPLATE = (article: {filename: string, image: string, category: string, title: string, description: string}) => `
    <a href="${article.filename}" class="group h-full">
        <div class="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all h-full flex flex-col relative">
            <div class="h-52 overflow-hidden relative">
                <img src="${article.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="${article.title}" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                <div class="absolute top-4 right-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg z-10 flex items-center gap-1">${article.category}</div>
            </div>
            <div class="p-5 flex-1 flex flex-col">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">${article.title}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-2">${article.description}</p>
            </div>
        </div>
    </a>`;

// Template from Guide Section 5 (Directory Item)
export const DIRECTORY_ITEM_TEMPLATE = (item: {link: string, title: string, description: string, icon: string, colorClass: string}) => `
<a href="${item.link}" target="_blank" class="block bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all group overflow-hidden">
    <div class="flex items-center gap-3 h-full">
        <div class="w-10 h-10 ${item.colorClass} rounded-md flex items-center justify-center shrink-0 shadow-sm">
             <i data-lucide="${item.icon}" class="w-5 h-5 text-white"></i>
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <h3 class="font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">${item.title}</h3>
            <div class="marquee-text-wrap w-full">
                <p class="text-[11px] text-gray-500 dark:text-gray-400 marquee-text-content">${item.description}</p>
            </div>
        </div>
        <div class="text-gray-400 group-hover:text-blue-600 shrink-0">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
        </div>
    </div>
</a>`;

// Basic HTML Skeleton for new articles
export const BASE_ARTICLE_TEMPLATE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}} | TechTouch</title>
    <meta name="description" content="{{DESCRIPTION}}">
    <link rel="canonical" href="https://kinanmjeed88.github.io/Kinan-touch-AD-google/{{FILENAME}}">
    
    <!-- Meta Tags for Social Media -->
    <meta property="og:title" content="{{TITLE}}">
    <meta property="og:description" content="{{DESCRIPTION}}">
    <meta property="og:image" content="{{IMAGE}}">
    <meta property="og:url" content="https://kinanmjeed88.github.io/Kinan-touch-AD-google/{{FILENAME}}">
    <meta name="twitter:card" content="summary_large_image">

    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-['Cairo'] transition-colors duration-300">

    <!-- Header Placeholder -->
    <div id="header-placeholder"></div>

    <main class="container mx-auto px-4 py-8 max-w-4xl">
        <article class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <!-- Article Image -->
            <div class="relative w-full aspect-video">
                <img id="main-image" src="{{IMAGE}}" alt="{{TITLE}}" class="w-full h-full object-cover">
                <div class="absolute bottom-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-tl-lg font-bold">
                    {{CATEGORY_LABEL}}
                </div>
            </div>

            <div class="p-6 md:p-8">
                <!-- Title & Meta -->
                <h1 class="text-2xl md:text-4xl font-bold mb-4 leading-tight">{{TITLE}}</h1>
                <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <span class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        {{DATE}}
                    </span>
                    <span class="flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        Admin
                    </span>
                </div>

                <!-- Content -->
                <div class="prose prose-lg dark:prose-invert max-w-none leading-relaxed">
                    {{CONTENT_BODY}}
                </div>

                <!-- Bottom Ad Slot -->
                {{AD_SLOT_BOTTOM}}
            </div>
        </article>
    </main>

    <!-- Footer Placeholder -->
    <div id="footer-placeholder"></div>

    <!-- Scripts -->
    <script src="assets/js/main.js"></script>
</body>
</html>`;