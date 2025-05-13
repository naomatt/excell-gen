import React, { useState, useEffect } from 'react';
import { Folder, FilePlus, Edit, Trash2, ChevronRight, ChevronDown, Check, X, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { RuleFolder } from '../../types';
import { getFolders, addFolder, updateFolder, deleteFolder } from '../../services/folderService';
import { toast } from 'react-hot-toast';

interface FolderListProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

const FolderList: React.FC<FolderListProps> = ({ selectedFolderId, onSelectFolder }) => {
  const [folders, setFolders] = useState<RuleFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { rules, isOnline } = useAppContext();
  
  // フォルダごとのルール数をカウント
  const folderRuleCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    
    // folderId別にルールをカウント
    rules.forEach(rule => {
      const folderId = rule.folderId || 'uncategorized';
      counts[folderId] = (counts[folderId] || 0) + 1;
    });
    
    return counts;
  }, [rules]);
  
  // フォルダ一覧を取得
  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const folderList = await getFolders();
      console.log('フォルダ一覧を取得しました:', folderList);
      setFolders(folderList);
      
      // 初期状態ですべてのフォルダを展開
      const expanded: Record<string, boolean> = {};
      folderList.forEach(folder => {
        expanded[folder.id] = true;
      });
      setExpandedFolders(expanded);
    } catch (error) {
      console.error('フォルダの取得に失敗しました:', error);
      toast.error('フォルダの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadFolders();
  }, []);
  
  // フォルダの展開/折りたたみを切り替え
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };
  
  // 新規フォルダの作成
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('フォルダ名を入力してください');
      return;
    }
    
    setIsLoading(true);
    try {
      const newFolder = await addFolder({
        name: newFolderName.trim(),
        color: newFolderColor,
        description: newFolderDescription.trim()
      });
      
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderColor('#3b82f6');
      setIsCreating(false);
      toast.success(isOnline ? 'フォルダを作成しました' : 'フォルダをオフラインで作成しました（オンライン時に同期されます）');
    } catch (error) {
      console.error('フォルダの作成に失敗しました:', error);
      toast.error('フォルダの作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  // フォルダの更新
  const handleUpdateFolder = async (folderId: string) => {
    if (!newFolderName.trim()) {
      toast.error('フォルダ名を入力してください');
      return;
    }
    
    setIsLoading(true);
    try {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;
      
      const updatedFolder = await updateFolder({
        ...folder,
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        color: newFolderColor
      });
      
      setFolders(prev => prev.map(f => f.id === folderId ? updatedFolder : f));
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderColor('#3b82f6');
      setIsEditing(null);
      toast.success(isOnline ? 'フォルダを更新しました' : 'フォルダをオフラインで更新しました（オンライン時に同期されます）');
    } catch (error) {
      console.error('フォルダの更新に失敗しました:', error);
      toast.error('フォルダの更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  // フォルダの削除
  const handleDeleteFolder = async (folderId: string) => {
    setIsLoading(true);
    try {
      const success = await deleteFolder(folderId);
      
      if (success || !isOnline) {
        setFolders(prev => prev.filter(f => f.id !== folderId));
        setConfirmDelete(null);
        
        // 削除したフォルダが選択されていた場合は選択を解除
        if (selectedFolderId === folderId) {
          onSelectFolder(null);
        }
        
        toast.success(isOnline ? 'フォルダを削除しました' : 'フォルダをオフラインで削除しました（オンライン時に同期されます）');
      } else {
        toast.error('フォルダの削除に失敗しました');
      }
    } catch (error) {
      console.error('フォルダの削除に失敗しました:', error);
      toast.error('フォルダの削除に失敗しました');
    } finally {
      setIsLoading(false);
      setConfirmDelete(null);
    }
  };
  
  // フォルダリストを手動で更新
  const handleRefresh = () => {
    loadFolders();
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-600">フォルダ</h3>
        <div className="flex">
          <button 
            className="text-gray-500 hover:text-gray-700 mr-1"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            className="text-blue-600 hover:text-blue-800"
            onClick={() => {
              setIsCreating(true);
              setNewFolderName('');
              setNewFolderDescription('');
              setNewFolderColor('#3b82f6');
            }}
            disabled={isLoading}
          >
            <FilePlus size={16} />
          </button>
        </div>
      </div>
      
      {/* ローディング表示 */}
      {isLoading && (
        <div className="text-center py-2 text-sm text-gray-500">
          読み込み中...
        </div>
      )}
      
      {/* 未分類フォルダ（常に表示） */}
      <div 
        className={`flex items-center py-1.5 px-2 rounded-md cursor-pointer ${
          selectedFolderId === null ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
        }`}
        onClick={() => onSelectFolder(null)}
      >
        <Folder size={16} className="mr-2 text-gray-400" />
        <span className="flex-1">未分類</span>
        <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {folderRuleCounts['uncategorized'] || 0}
        </span>
      </div>
      
      {/* フォルダ一覧 */}
      <div className="space-y-1">
        {folders.map(folder => (
          <div key={folder.id} className="space-y-1">
            <div className="flex items-center">
              <button 
                className="p-1 text-gray-400 hover:text-gray-600" 
                onClick={() => toggleFolder(folder.id)}
              >
                {expandedFolders[folder.id] ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
              
              {isEditing === folder.id ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center mb-1">
                    <input 
                      type="text"
                      className="flex-1 p-1 text-sm border border-gray-300 rounded-md"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      placeholder="フォルダ名"
                      autoFocus
                    />
                    <div className="ml-2 flex items-center">
                      <input 
                        type="color" 
                        className="w-6 h-6 border border-gray-300 rounded"
                        value={newFolderColor}
                        onChange={e => setNewFolderColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex mb-1">
                    <textarea 
                      className="flex-1 p-1 text-sm border border-gray-300 rounded-md"
                      value={newFolderDescription}
                      onChange={e => setNewFolderDescription(e.target.value)}
                      placeholder="説明（任意）"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      className="ml-2 p-1 text-green-600 hover:text-green-800"
                      onClick={() => handleUpdateFolder(folder.id)}
                      disabled={isLoading}
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      className="ml-1 p-1 text-gray-400 hover:text-gray-600"
                      onClick={() => setIsEditing(null)}
                      disabled={isLoading}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div 
                    className={`flex-1 flex items-center py-1 px-2 rounded-md cursor-pointer ${
                      selectedFolderId === folder.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <Folder size={16} className="mr-2" style={{ color: folder.color }} />
                    <div className="flex-1">
                      <div className="font-medium">{folder.name}</div>
                      {folder.description && (
                        <div className="text-xs text-gray-500 truncate">{folder.description}</div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                      {folderRuleCounts[folder.id] || 0}
                    </span>
                  </div>
                  
                  <div className="flex ml-1">
                    <button 
                      className="p-1 text-gray-400 hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(folder.id);
                        setNewFolderName(folder.name);
                        setNewFolderDescription(folder.description);
                        setNewFolderColor(folder.color);
                      }}
                      disabled={isLoading}
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      className="p-1 text-gray-400 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(folder.id);
                      }}
                      disabled={isLoading}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* 新規フォルダ作成フォーム */}
      {isCreating && (
        <div className="flex flex-col mt-2 p-2 border border-gray-200 rounded-md bg-gray-50">
          <div className="flex items-center mb-1">
            <Folder size={16} className="mr-2 text-gray-400" />
            <input 
              type="text"
              className="flex-1 p-1 text-sm border border-gray-300 rounded-md"
              placeholder="新しいフォルダ名"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="ml-2">
              <input 
                type="color" 
                className="w-6 h-6 border border-gray-300 rounded"
                value={newFolderColor}
                onChange={e => setNewFolderColor(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-2">
            <textarea 
              className="w-full p-1 text-sm border border-gray-300 rounded-md"
              placeholder="説明（任意）"
              value={newFolderDescription}
              onChange={e => setNewFolderDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end">
            <button 
              className="p-1 text-green-600 hover:text-green-800"
              onClick={handleCreateFolder}
              disabled={isLoading}
            >
              <Check size={14} />
            </button>
            <button 
              className="ml-1 p-1 text-gray-400 hover:text-gray-600"
              onClick={() => setIsCreating(false)}
              disabled={isLoading}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      
      {/* 削除確認ダイアログ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">フォルダの削除</h3>
            <p className="text-gray-600 mb-4">
              このフォルダを削除しますか？フォルダ内のルールは「未分類」に移動されます。
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                onClick={() => setConfirmDelete(null)}
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button 
                className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"
                onClick={() => handleDeleteFolder(confirmDelete)}
                disabled={isLoading}
              >
                {isLoading ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderList; 