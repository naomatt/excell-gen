import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/layout/Navbar';
import Dashboard from './components/Dashboard';
import RuleManager from './components/rules/RuleManager';
import FileProcessor from './components/processor/FileProcessor';
import { Toaster } from 'react-hot-toast';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'rules' | 'process'>('dashboard');

  const handleTabChange = (tab: 'dashboard' | 'rules' | 'process') => {
    setActiveTab(tab);
    switch (tab) {
      case 'dashboard':
        navigate('/');
        break;
      case 'rules':
        navigate('/rules');
        break;
      case 'process':
        navigate('/process');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar activeTab={activeTab} onChangeTab={handleTabChange} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/" element={<Dashboard onNavigate={handleTabChange} />} />
          <Route path="/rules" element={<RuleManager />} />
          <Route path="/process" element={<FileProcessor />} />
        </Routes>
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-gray-500 text-sm">
        <p>Rule-Based Excel Record Generator &copy; {new Date().getFullYear()}</p>
      </footer>
      <Toaster position="top-right" />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </Router>
  );
};

export default App;