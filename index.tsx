import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 1. Polyfill process for browser compatibility (Fixes 'process is not defined' crashes)
// @ts-ignore
if (typeof window !== 'undefined' && !window.process) {
  // @ts-ignore
  window.process = { env: {} };
}

// 2. Global Error Reporting (Displays errors on screen for mobile debugging)
const showError = (type: string, error: any) => {
  console.error(type, error);
  
  // Prevent creating multiple error containers
  if (document.getElementById('global-error-display')) return;

  const errorDiv = document.createElement('div');
  errorDiv.id = 'global-error-display';
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100%';
  errorDiv.style.height = '100%';
  errorDiv.style.padding = '20px';
  errorDiv.style.backgroundColor = '#7f1d1d'; // Dark Red
  errorDiv.style.color = '#fff';
  errorDiv.style.zIndex = '100000';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.whiteSpace = 'pre-wrap';
  errorDiv.style.overflow = 'auto';
  errorDiv.style.direction = 'ltr'; // Ensure error is readable
  errorDiv.style.textAlign = 'left';

  const msg = error?.message || error?.toString() || 'Unknown Error';
  const stack = error?.stack || 'No stack trace available';
  
  errorDiv.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 10px;">🛑 ${type}</h2>
    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
      <strong style="color: #fca5a5;">Message:</strong><br/>${msg}<br/><br/>
      <strong style="color: #fca5a5;">Stack:</strong><br/><small>${stack}</small>
    </div>
    <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: white; color: black; border: none; border-radius: 5px; font-weight: bold; cursor: pointer;">
      Reload App
    </button>
  `;
  document.body.appendChild(errorDiv);
};

// Trap Runtime Errors
window.onerror = (msg, url, line, col, error) => {
  showError('Runtime Error', error || msg);
  return false;
};

// Trap Async/Promise Errors
window.onunhandledrejection = (event) => {
  showError('Unhandled Promise Rejection', event.reason);
};

// 3. React Error Boundary Component
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Error Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center" dir="rtl">
            <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl max-w-lg w-full">
                <h1 className="text-2xl font-bold mb-4 text-red-400">حدث خطأ غير متوقع</h1>
                <p className="mb-4 text-gray-300">واجه التطبيق مشكلة أثناء العرض.</p>
                <div className="bg-black/50 p-4 rounded text-left font-mono text-xs overflow-auto max-h-60 mb-6 text-red-200" dir="ltr">
                    {this.state.error?.toString()}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
                >
                    إعادة تحميل الصفحة
                </button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

let rootElement = document.getElementById('root');

if (!rootElement) {
  // Fallback: If root is missing (e.g. if the static site HTML is loaded), 
  // create a container to mount the CMS interface on top.
  const container = document.createElement('div');
  container.id = 'root';
  // Ensure it covers the screen if injected into a static page
  container.className = 'h-full w-full overflow-auto fixed inset-0 bg-[#0f172a] z-[9999]'; 
  document.body.appendChild(container);
  rootElement = container;
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);