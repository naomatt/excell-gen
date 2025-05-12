import React, { useState } from 'react';
import { FilePlus2, FileSpreadsheet, Settings } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Dashboard from './components/Dashboard';
import RuleManager from './components/rules/RuleManager';
import FileProcessor from './components/processor/FileProcessor';
import { AppContextProvider } from './context/AppContext';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'process'>('dashboard');

  return (
    <AppContextProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar activeTab={activeTab} onChangeTab={setActiveTab} />
        
        <main className="flex-grow px-4 py-6 md:px-6 md:py-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
          {activeTab === 'rules' && <RuleManager />}
          {activeTab === 'process' && <FileProcessor />}
        </main>
        
        <footer className="bg-white border-t border-gray-200 py-4 text-center text-gray-500 text-sm">
          <p>Rule-Based Excel Record Generator &copy; {new Date().getFullYear()}</p>
        </footer>

        <Toaster position="top-right" />
      </div>
    </AppContextProvider>
  );
}

export default App;