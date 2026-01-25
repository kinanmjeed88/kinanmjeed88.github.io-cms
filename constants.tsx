import { Layout, Gamepad2, Smartphone, Trophy } from 'lucide-react';
import React from 'react';

export const CATEGORIES = [
  { id: 'tech', label: 'تقنية', icon: <Layout className="w-4 h-4" /> },
  { id: 'apps', label: 'تطبيقات', icon: <Smartphone className="w-4 h-4" /> },
  { id: 'games', label: 'ألعاب', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'sports', label: 'رياضة', icon: <Trophy className="w-4 h-4" /> },
];

export const HYBRID_AD_TEMPLATE = (imageUrl: string, linkUrl: string, slotId: string) => `
<div class="hybrid-ad-container group relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 min-h-[280px] my-8 shadow-sm">
    <!-- شارة تعريف الإعلان -->
    <div class="ad-badge absolute top-0 left-0 bg-gray-200 dark:bg-gray-700 text-[10px] px-2 py-0.5 rounded-br text-gray-500 z-20">مساحة إعلانية</div>

    <!-- 1. Google AdSense (يغطي الصورة عند التحميل) -->
    <div class="relative z-10 w-full min-h-[280px] flex justify-center items-center">
        <ins class="adsbygoogle"
             style="display:block; width:100%; min-width:300px;"
             data-ad-client="ca-pub-7355327732066930"
             data-ad-slot="${slotId}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <!-- 2. صورة بديلة (تظهر إذا لم يحمل جوجل) -->
    <a href="${linkUrl}" target="_blank" class="ad-fallback absolute inset-0 z-0 flex items-center justify-center bg-slate-200 dark:bg-slate-900">
        <img src="${imageUrl}" alt="Advertisement" class="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" onerror="this.style.display='none'" />
    </a>
</div>`;

// Based on article-capcut.html structure logic
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
    
    <!-- Google Analytics & AdSense (Placeholder - injected by JS) -->
</head>
<body class="bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-['Cairo'] transition-colors duration-300">

    <!-- Header will be loaded via JS or assumes static include -->
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

                <!-- Top Ad Slot -->
                {{AD_SLOT_TOP}}

                <!-- Content -->
                <div class="prose prose-lg dark:prose-invert max-w-none leading-relaxed">
                    {{CONTENT_BODY}}
                </div>

                <!-- Bottom Ad Slot -->
                {{AD_SLOT_BOTTOM}}
            </div>
        </article>
    </main>

    <!-- Footer -->
    <div id="footer-placeholder"></div>

    <!-- Scripts -->
    <script src="assets/js/main.js"></script>
</body>
</html>
`;