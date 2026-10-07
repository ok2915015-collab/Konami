import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ErrorBoundary} from 'react-error-boundary';
import App from './App.tsx';
import './index.css';

// Global protection against Firestore quota exceeded errors
window.addEventListener('error', (event) => {
  const msg = event.error?.message || event.message || '';
  if (msg.includes('Quota limit exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
    event.preventDefault();
    console.warn('[Firestore Quota Interceptor] Quota limit reached on Free Tier. Operating in cached mode.');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || String(event.reason || '');
  if (reason.includes('Quota limit exceeded') || reason.includes('RESOURCE_EXHAUSTED')) {
    event.preventDefault();
    console.warn('[Firestore Quota Interceptor] Promise rejection with quota limit handled gracefully.');
  }
});

function ErrorFallback({error, resetErrorBoundary}: {error: Error; resetErrorBoundary?: () => void}) {
  const isQuota = error.message.includes('Quota limit exceeded') || error.message.includes('RESOURCE_EXHAUSTED');

  if (isQuota) {
    return (
      <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-amber-950/30 border border-amber-500/50 p-6 rounded-2xl max-w-lg w-full backdrop-blur-md shadow-2xl">
          <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
            ⚡
          </div>
          <h2 className="text-xl font-bold text-amber-400 mb-2">Quota Quotidien Firestore Atteint</h2>
          <p className="text-xs text-amber-200/80 mb-4 leading-relaxed">
            Le quota gratuit de lecture Firestore (50 000 lectures/jour) a été temporairement dépassé sur ce projet. L'application bascule automatiquement sur les données locales mises en cache.
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => {
                if (resetErrorBoundary) resetErrorBoundary();
                else window.location.reload();
              }}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-xl transition-all shadow-lg active:scale-95"
            >
              Continuer avec les données locales
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all"
            >
              Actualiser
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-900/20 border border-red-500 p-6 rounded-2xl max-w-lg w-full">
        <h2 className="text-xl font-bold text-red-500 mb-4">Une erreur est survenue</h2>
        <pre className="text-xs text-left bg-black/50 p-4 rounded text-red-200 overflow-x-auto whitespace-pre-wrap break-words">
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold"
        >
          Recharger l'application
        </button>
      </div>
    </div>
  );
}

// Register Konamix PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('Konamix PWA Service Worker ready with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('Konamix PWA Service Worker registration error:', err);
      });
  });
}


createRoot(document.getElementById('root')!).render(

  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
