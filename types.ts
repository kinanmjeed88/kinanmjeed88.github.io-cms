
export interface ArticleMetadata {
  fileName: string;
  title: string;
  category: 'tech' | 'apps' | 'games' | 'sports';
  image: string;
  description: string;
  link: string;
  sha?: string;
}

export interface ArticleContent extends ArticleMetadata {
  content: string;
  mainText: string;
  videoUrl?: string;
  downloadLink?: string;
  downloadText?: string;
}

// New Metadata Structures
export interface ArticleEntry {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image: string; // assets/images/posts/...
  date: string;
  category: string;
  file: string; // .html
}

export interface MetadataRoot {
  name: string;
  description: string;
  articles: ArticleEntry[];
  [key: string]: any;
}

export interface GithubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content?: string;
  encoding?: string;
}

export enum RepoConfig {
  OWNER = 'kinanmjeed88',
  NAME = 'Kinan-touch-AD-google',
  TEMPLATE_FILE = 'article-asus-gx10.html',
  INDEX_FILE = 'index.html',
  ARTICLES_FILE = 'articles.html',
  METADATA_FILE = 'metadata.json',
  TOOLS_SITES_FILE = 'tools-sites.html',
}

export interface TickerData {
  text: string;
  link: string;
}

export interface DirectoryItem {
  id?: string; // used for identification in UI
  title: string;
  description: string;
  link: string;
  icon: string; // Lucide icon name
  colorClass: string; // tailwind bg color class for the icon box
}

export interface SocialLinks {
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  telegram: string;
}

export interface AIConfig {
  geminiKey: string;
  groqKey: string;
  huggingFaceKey: string;
  preferredProvider: 'gemini' | 'groq' | 'huggingface';
}

export interface AboutPageData {
  title: string;
  bio: string;
  image: string;
  headerImage: string;
  profileSize: 'small' | 'medium' | 'large';
  telegramLink: string;
  section1Title: string;
  section1Items: string[];
  section2Title: string;
  section2Items: string[];
  listItems?: string[];
}