import React from 'react';
import { FileSpreadsheet, Settings, FilePlus2, ClipboardList } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface DashboardProps {
  onNavigate: (tab: 'dashboard' | 'rules' | 'process') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { rules, recentFiles } = useAppContext();

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-900">Excel ルールジェネレーター</h1>
        <p className="mt-2 text-lg text-gray-600">
          ルールを一度定義すれば、Excelファイルを自動的に処理できます
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardCard 
          icon={<Settings className="h-8 w-8 text-blue-600" />}
          title="ルール管理"
          description="Excelファイル処理のルールを作成・管理します"
          buttonText="ルール一覧へ"
          onClick={() => onNavigate('rules')}
          stats={`${rules.length} 件のルール`}
        />
        
        <DashboardCard 
          icon={<FilePlus2 className="h-8 w-8 text-green-600" />}
          title="ファイル処理"
          description="ルールを使ってExcelファイルを処理します"
          buttonText="処理を開始"
          onClick={() => onNavigate('process')}
          stats={`${recentFiles.length} 件の処理履歴`}
        />
      </div>

      {recentFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">最近の処理履歴</h2>
          <div className="space-y-2">
            {recentFiles.slice(0, 5).map((file, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-md">
                <FileSpreadsheet className="h-5 w-5 text-gray-500 mr-2" />
                <div className="flex-grow">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">処理日時: {new Date(file.processedAt).toLocaleString('ja-JP')}</p>
                </div>
                <button 
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  onClick={() => onNavigate('process')}
                >
                  再処理
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  stats?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  icon, title, description, buttonText, onClick, stats 
}) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden transition-all hover:shadow-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          {icon}
          {stats && <span className="text-sm font-medium text-gray-500">{stats}</span>}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        <button
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={onClick}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;