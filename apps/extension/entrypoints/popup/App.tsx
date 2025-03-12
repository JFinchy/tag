import React from 'react';
import { browser } from 'wxt/browser';

const App: React.FC = () => {
  const openDialog = async () => {
    await browser.runtime.sendMessage({ action: 'openDialog' });
    window.close();
  };

  React.useEffect(() => {
    openDialog();
  }, []);

  return null;
};

export default App; 