import React from 'react';
import { FilePlus2, FileSpreadsheet, Home, Settings } from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'rules' | 'process';
  onChangeTab: (tab: 'dashboard' | 'rules' | 'process') => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900">ExcelRuleGen</span>
          </div>
          
          <nav className="flex space-x-1 md:space-x-4">
            <NavButton 
              icon={<Home size={20} />}
              label="ホーム"
              isActive={activeTab === 'dashboard'}
              onClick={() => onChangeTab('dashboard')}
            />
            <NavButton 
              icon={<Settings size={20} />}
              label="ルール"
              isActive={activeTab === 'rules'}
              onClick={() => onChangeTab('rules')}
            />
            <NavButton 
              icon={<FilePlus2 size={20} />}
              label="処理"
              isActive={activeTab === 'process'}
              onClick={() => onChangeTab('process')}
            />
          </nav>
        </div>
      </div>
    </header>
  );
};

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      className={`flex flex-col items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
      onClick={onClick}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );
};

export default Navbar;