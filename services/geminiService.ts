import { GoogleGenAI } from "@google/genai";
import { AIConfig, ArticleContent, DirectoryItem, AIAnalysisKnowledge } from "../types";

// Helper for timeouts
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// 1. Gemini
const callGemini = async (prompt: string, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("Gemini API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  
  // Note: SDK doesn't support signal directly, but we can wrap it.
  // For simplicity, we assume SDK handles its own timeouts, but we wrap custom fetches below.
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: prompt,
    config: {
        responseMimeType: "application/json"
    }
  });
  return response.text || "";
};

// 2. Groq (OpenAI Compatible)
const callGroq = async (prompt: string, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("Groq API Key missing");
  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt + "\nRETURN ONLY JSON." }],
      model: "llama3-70b-8192", 
      temperature: 0.2
    })
  });
  
  if (!response.ok) throw new Error(`Groq Error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
};

// 3. Hugging Face (Inference API)
const callHuggingFace = async (prompt: string, apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("Hugging Face API Key missing");
  const response = await fetchWithTimeout("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: `<s>[INST] ${prompt} \n Return valid JSON only. [/INST]`,
      parameters: { max_new_tokens: 2000, return_full_text: false }
    })
  });

  if (!response.ok) throw new Error(`HF Error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  return Array.isArray(data) ? data[0]?.generated_text : data?.generated_text || "";
};

// --- Orchestrator ---

const getEnvApiKey = () => {
    try {
        // Safe access to process.env for browser environments
        // @ts-ignore
        return (typeof process !== 'undefined' && process.env && process.env.API_KEY) || '';
    } catch {
        return '';
    }
};

const getAIConfig = (): AIConfig => {
  const stored = localStorage.getItem('techTouch_ai_config');
  if (stored) return JSON.parse(stored);
  return {
    geminiKey: getEnvApiKey(), 
    groqKey: '',
    huggingFaceKey: '',
    preferredProvider: 'gemini'
  };
};

const cleanAIResponse = (text: string) => {
  return text.replace(/```html/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
};

const askAI = async (prompt: string): Promise<{ text: string, provider: string }> => {
  const config = getAIConfig();
  const errors: string[] = [];

  const providers = [
    { name: 'gemini', fn: callGemini, key: config.geminiKey },
    { name: 'groq', fn: callGroq, key: config.groqKey },
    { name: 'huggingface', fn: callHuggingFace, key: config.huggingFaceKey }
  ];

  const preferredIndex = providers.findIndex(p => p.name === config.preferredProvider);
  if (preferredIndex > 0) {
    const [item] = providers.splice(preferredIndex, 1);
    providers.unshift(item);
  }

  for (const provider of providers) {
    if (!provider.key) {
      errors.push(`${provider.name}: No Key`);
      continue;
    }
    
    try {
      console.log(`Trying AI Provider: ${provider.name}...`);
      const result = await provider.fn(prompt, provider.key);
      if (result && result.length > 5) {
        return { text: result, provider: provider.name };
      }
    } catch (e: any) {
      console.warn(`${provider.name} failed:`, e);
      errors.push(`${provider.name}: ${e.message}`);
    }
  }

  throw new Error("All AI providers failed. Errors: " + errors.join(", "));
};

// --- Public Methods ---

export const detectAdSelectors = async (htmlContent: string): Promise<string[]> => {
    const prompt = `
    Analyze this HTML snippet.
    Identify the CSS Selectors for elements that look like "Advertisement Placeholders".
    
    Look for:
    1. Divs with text containing "Advertise Here", "ertise Here", "إعلان", "Space".
    2. Elements with classes like 'ad-slot', 'banner', 'sponsor', 'box-gray', 'bg-slate-200', 'bg-blue-600', 'bg-slate-100'.
    3. Existing <ins class="adsbygoogle"> tags.
    4. Any blue or grey rectangle containing "???" or placeholder text.
    5. The class 'hybrid-ad-container' if it exists.
    
    Return a JSON Array of strings (valid CSS selectors). Example: [".ad-slot-container", "#main-banner", "div.text-center.bg-blue-600"]
    
    HTML:
    ${htmlContent.substring(0, 15000)}
    `;

    try {
        const { text } = await askAI(prompt);
        const selectors = JSON.parse(cleanAIResponse(text));
        return Array.isArray(selectors) ? selectors : ['.ad-slot-container'];
    } catch (e) {
        console.warn("AI Ad detection failed", e);
        return ['.ad-slot-container', '.custom-image-ad', '.hybrid-ad-container']; // Fallback
    }
};

export const extractDataFromHtml = async (htmlContent: string, type: 'article' | 'directory_list' | 'about_page'): Promise<any> => {
    let schemaDescription = "";
    
    if (type === 'article') {
        schemaDescription = `
        {
            "title": "Article H1 title",
            "description": "Meta description content",
            "image": "Main featured image src",
            "mainText": "The full body text of the article (paragraphs joined by newlines)",
            "videoUrl": "YouTube iframe src if exists, else empty",
            "category": "One of: tech, apps, games, sports (infer from content if not explicit)"
        }`;
    } else if (type === 'directory_list') {
        schemaDescription = `
        [
            {
                "title": "Card title",
                "description": "Card description",
                "link": "The href URL",
                "icon": "Lucide icon name if found in data-lucide attribute, else 'link'",
                "colorClass": "The background color class of the icon box (e.g. bg-blue-600)"
            }
        ]
        (Return an array of objects)`;
    } else if (type === 'about_page') {
        schemaDescription = `
        {
            "title": "Page Title",
            "bio": "Intro paragraph text",
            "image": "Profile image src",
            "headerImage": "Background header image src (if style has url(...))",
            "profileSize": "small, medium, or large (infer from width classes w-24, w-32, w-40)",
            "telegramLink": "Link to telegram",
            "section1Title": "Title of the first list section",
            "section1Items": ["Array of strings for list items in section 1"],
            "section2Title": "Title of the second list section",
            "section2Items": ["Array of strings for list items in section 2"]
        }`;
    }

    const prompt = `
    You are an intelligent HTML Parser. 
    Analyze the HTML content below and extract the data strictly according to this JSON schema:
    ${schemaDescription}

    HTML Content (Truncated for context):
    ${htmlContent.substring(0, 15000)}

    IMPORTANT: Return ONLY Valid JSON. Do not add markdown blocks.
    `;

    try {
        const { text } = await askAI(prompt);
        const json = JSON.parse(cleanAIResponse(text));
        return json;
    } catch (e) {
        console.error("AI Extraction Failed", e);
        return null; // Fallback to manual parsing handled by caller
    }
};

export const generateArticleContent = async (title: string, category: string): Promise<string> => {
  const prompt = `Write a technical news article for 'TechTouch' website in Arabic.
  Title: ${title}
  Category: ${category}
  Requirements: Language: Arabic. Format: Plain text paragraphs. Length: ~300 words.`;

  try {
    const { text } = await askAI(prompt);
    return cleanAIResponse(text); 
  } catch (error: any) {
    return "فشل إنشاء المحتوى. يرجى التأكد من إعدادات مفاتيح الذكاء الاصطناعي.";
  }
};

export const generateSmartCardHtml = async (
  pageContent: string, 
  data: ArticleContent | DirectoryItem, 
  type: 'article' | 'directory',
  knowledge?: AIAnalysisKnowledge
): Promise<string | null> => {
  
  let context = "";
  if (knowledge) {
      context = `
      Knowledge Base:
      - Card Structure: ${knowledge.cardStructure}
      - Detected Colors: ${knowledge.colorsDetected.join(', ')}
      `;
  }

  const jsonStr = JSON.stringify(data);
  const taskPrompt = type === 'directory' 
    ? `Generate HTML for a NEW Directory Item <div>. Data: ${jsonStr}`
    : `Generate HTML for a NEW Article Card <div> based on the existing structure in context. Data: ${jsonStr}`;

  const prompt = `
    You are an expert Frontend Engineer.
    ${context}
    Analyze the context to match the existing design exactly.
    HTML Context:
    ${pageContent.substring(0, 5000)}...

    Task: ${taskPrompt}
    Rules: Output ONLY the HTML <div>. Use Tailwind classes found in context. Do not wrap in markdown.
  `;

  try {
    const { text } = await askAI(prompt);
    const result = cleanAIResponse(text);
    if (result.length < 10) return null;
    return result;
  } catch (error) {
    return null;
  }
};

export const analyzeSiteStructure = async (htmlFiles: {name: string, content: string}[]): Promise<AIAnalysisKnowledge> => {
    const combinedSample = htmlFiles.map(f => `--- FILE: ${f.name} ---\n${f.content.substring(0, 3000)}`).join('\n\n');

    const prompt = `
    Analyze these HTML files. Extract structural patterns.
    Return JSON:
    {
        "cardStructure": "Description of article card HTML hierarchy and classes",
        "directoryStructure": "Description of directory item HTML hierarchy",
        "gridClasses": "Tailwind grid classes used",
        "colorsDetected": ["List of main color classes"]
    }
    
    Content:
    ${combinedSample}
    `;

    try {
        const { text } = await askAI(prompt);
        return JSON.parse(cleanAIResponse(text));
    } catch (e) {
        throw new Error("Failed to analyze structure: " + e);
    }
};