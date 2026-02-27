import React, { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';

const InstallPwaPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Handle Android/Desktop "BeforeInstallPrompt"
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay to not annoy immediately
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. For iOS, we just show the prompt because there is no event
    if (isIosDevice) {
       // Check local storage to see if they dismissed it recently
       const dismissedAt = localStorage.getItem('pwa_prompt_dismissed');
       if (!dismissedAt) {
          setTimeout(() => setShowPrompt(true), 3000);
       }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal for 24 hours
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500 font-sans">
      <div className="bg-navy text-white p-4 rounded-xl shadow-2xl border border-white/10 relative">
        <button 
          onClick={handleDismiss} 
          className="absolute top-2 right-2 text-light hover:text-white p-1 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="bg-white/10 p-2 rounded-lg">
            <Download size={24} className="text-orange" />
          </div>
          <div>
            <h3 className="font-bold text-sm font-serif tracking-wide">Install ADDA</h3>
            <p className="text-xs text-light mt-1">
              Add to your home screen for the best experience.
            </p>
            
            {isIOS ? (
              <div className="mt-3 text-xs bg-white/5 p-2 rounded flex flex-col gap-1 border border-white/10">
                <div className="flex items-center gap-2">
                  1. Tap the <Share size={14} /> <strong>Share</strong> button below.
                </div>
                <div className="flex items-center gap-2">
                  2. Select <PlusSquare size={14} /> <strong>Add to Home Screen</strong>.
                </div>
              </div>
            ) : (
              <button 
                onClick={handleInstallClick}
                className="mt-3 bg-orange text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-mid transition-colors shadow-sm"
              >
                Install App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPwaPrompt;
