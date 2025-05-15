import React, { useState, useEffect } from 'react';
import { Folder, FilePlus, Edit, Trash2, ChevronRight, ChevronDown, Check, X, RefreshCw, FileText } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { RuleFolder, ExcelRule } from '../../types';
import { getFolders, addFolder, updateFolder, deleteFolder } from '../../services/folderService';
import { toast } from 'react-hot-toast';

interface FolderListProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onMoveRuleToFolder?: (ruleId: string, folderId: string | null) => Promise<boolean>;
  onEditRule?: (rule: ExcelRule) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const FolderList: React.FC<FolderListProps> = ({ 
  selectedFolderId, 
  onSelectFolder,
  onMoveRuleToFolder,
  onEditRule,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const [folders, setFolders] = useState<RuleFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  
  // 未分類フォルダの展開状態
  const [isUncategorizedExpanded, setIsUncategorizedExpanded] = useState(false);
  
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
  
  // フォルダごとのルールを取得
  const folderRules = React.useMemo(() => {
    const rulesMap: Record<string, ExcelRule[]> = {
      uncategorized: []
    };
    
    folders.forEach(folder => {
      rulesMap[folder.id] = [];
    });
    
    // ルールをフォルダごとに分類
    rules.forEach(rule => {
      if (rule.folderId) {
        if (rulesMap[rule.folderId]) {
          rulesMap[rule.folderId].push(rule);
        }
      } else {
        rulesMap.uncategorized.push(rule);
      }
    });
    
    return rulesMap;
  }, [rules, folders]);
  
  // ドラッグ中のルールID
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  
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
  
  // 未分類フォルダの展開/折りたたみを切り替え
  const toggleUncategorized = () => {
    setIsUncategorizedExpanded(prev => !prev);
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
  
  // ドラッグ中のルールをフォルダに移動する処理
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // 常にドロップを受け入れるように変更
      const types = e.dataTransfer.types;
      console.log('ドラッグタイプ:', types);
      
      // application/ruleデータ型をチェック
      const hasRuleData = Array.from(types).some(type => 
        type === 'application/rule' || type === 'text/plain'
      );
      
      if (hasRuleData) {
        console.log(`フォルダ ${folderId || '未分類'} にドラッグオーバー`);
        setDragOverFolderId(folderId);
      }
    } catch (error) {
      console.error('ドラッグオーバー処理でエラー:', error);
    }
  };
  
  // ドロップ時の処理
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // ドラッグデータをすべてログ
      console.log('ドロップイベント:', e.dataTransfer);
      console.log('dataTransfer types:', Array.from(e.dataTransfer.types));
      
      // 複数の方法でルールIDの取得を試みる
      let ruleId: string | null = null;
      
      // すべてのタイプを試行
      for (const type of Array.from(e.dataTransfer.types)) {
        try {
          const data = e.dataTransfer.getData(type);
          console.log(`${type} データ:`, data);
          
          // UUIDパターンかどうかをチェック
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
            ruleId = data;
            console.log(`${type} からUUIDを取得:`, ruleId);
            break; // 有効なUUIDが見つかれば終了
          }
        } catch (error) {
          console.warn(`${type} データの取得に失敗:`, error);
        }
      }
      
      // 古い方法もバックアップとして残す
      if (!ruleId) {
        try {
          ruleId = e.dataTransfer.getData('application/rule');
          console.log('application/rule からのruleId:', ruleId);
        } catch (error) {
          console.warn('application/rule データの取得に失敗:', error);
        }
      }
      
      // text/plainでも試行
      if (!ruleId) {
        try {
          const textData = e.dataTransfer.getData('text/plain');
          console.log('text/plain データ:', textData);
          // UUIDパターンかどうかをチェック
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textData)) {
            ruleId = textData;
            console.log('text/plain からUUIDを取得:', ruleId);
          }
        } catch (error) {
          console.warn('text/plain データの取得に失敗:', error);
        }
      }
      
      console.log(`ドロップ処理: ruleId=${ruleId}, folderId=${folderId || 'null'}`);
      
      if (ruleId && onMoveRuleToFolder) {
        console.log(`ルールをフォルダに移動: ruleId=${ruleId}, folderId=${folderId || 'null'}`);
        
        const success = await onMoveRuleToFolder(ruleId, folderId);
        
        if (success) {
          // ドロップしたフォルダを自動的に選択
          onSelectFolder(folderId);
          console.log(`フォルダ選択を変更: ${folderId || '未分類'}`);
          
          if (folderId) {
            toast.success(`ルールを「${folders.find(f => f.id === folderId)?.name || 'フォルダ'}」に移動しました`);
          } else {
            toast.success('ルールを「未分類」に移動しました');
          }
        } else {
          toast.error('ルールの移動に失敗しました');
        }
      } else {
        console.warn('ルールIDが取得できないか、移動ハンドラがありません');
      }
    } catch (error) {
      console.error('ドロップ処理でエラーが発生:', error);
    } finally {
      // ドラッグ状態をリセット
      setDragOverFolderId(null);
    }
  };
  
  // ドラッグ開始時の処理
  const handleRuleDragStart = (e: React.DragEvent<HTMLDivElement>, rule: ExcelRule) => {
    e.stopPropagation();
    console.log("ドラッグ開始: ルールID=", rule.id);
    setDraggedRuleId(rule.id);
    e.dataTransfer.setData('application/rule', rule.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // ドラッグ中は全てのルールアイテムのカーソルをgrabに変更
    const ruleItems = document.querySelectorAll('.rule-item');
    ruleItems.forEach(item => {
      (item as HTMLElement).style.cursor = 'grabbing';
    });
  };
  
  // ドラッグ終了時の処理
  const handleRuleDragEnd = () => {
    setDraggedRuleId(null);
    
    // カーソルを元に戻す
    const ruleItems = document.querySelectorAll('.rule-item');
    ruleItems.forEach(item => {
      (item as HTMLElement).style.cursor = '';
    });
  };
  
  // ドラッグ離脱時の処理
  const handleDragLeave = () => {
    setDragOverFolderId(null);
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
      
      {/* フォルダ表示/非表示ボタン */}
      {onToggleSidebar && (
        <button 
          className="w-full flex items-center justify-center py-2 mb-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          onClick={onToggleSidebar}
        >
          <Folder size={16} className="mr-2" />
          <span className="text-sm">{isSidebarOpen ? 'フォルダを隠す' : 'フォルダを表示'}</span>
        </button>
      )}
      
      {/* ローディング表示 */}
      {isLoading && (
        <div className="text-center py-2 text-sm text-gray-500">
          読み込み中...
        </div>
      )}
      
      {/* 未分類フォルダ（常に表示） */}
      <div className="space-y-0.5">
        <div className="flex items-center">
          <button 
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0" 
            onClick={toggleUncategorized}
          >
            {isUncategorizedExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          
          <div 
            className={`flex-1 flex items-center py-1 px-2 rounded-md cursor-pointer ${
              selectedFolderId === null ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
            } ${dragOverFolderId === null && draggedRuleId !== null ? 'border-2 border-dashed border-blue-400 bg-blue-50' : ''}`}
            onClick={() => onSelectFolder(null)}
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            <Folder size={16} className="mr-2 flex-shrink-0 text-gray-400" />
            <span className="flex-1 mr-2 overflow-hidden" style={{ wordBreak: 'break-word' }}>未分類</span>
            <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
              {folderRuleCounts['uncategorized'] || 0}
            </span>
          </div>
        </div>
        
        {/* 未分類フォルダ内のルール */}
        {isUncategorizedExpanded && (
          <div className="ml-7 space-y-1 my-1">
            {folderRules.uncategorized.length > 0 ? (
              folderRules.uncategorized.map(rule => (
                <div 
                  key={rule.id}
                  className={`flex items-center py-1 px-2 text-sm text-gray-600 hover:bg-gray-100 rounded cursor-pointer rule-item ${
                    draggedRuleId === rule.id ? 'opacity-50 bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    onSelectFolder(null);
                    if (onEditRule) onEditRule(rule);
                  }}
                  draggable
                  onDragStart={(e) => handleRuleDragStart(e, rule)}
                  onDragEnd={handleRuleDragEnd}
                >
                  <FileText size={14} className="flex-shrink-0 mr-2 text-gray-400" />
                  <span className="flex-1 mr-1 overflow-hidden" style={{ wordBreak: 'break-word' }}>{rule.name}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 italic py-1 px-2">
                ルールがありません
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* フォルダ一覧 */}
      <div className="space-y-1">
        {folders.map(folder => (
          <div key={folder.id} className="space-y-0.5">
            <div className="flex items-center">
              <button 
                className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0" 
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
                    } ${dragOverFolderId === folder.id ? 'border-2 border-dashed border-blue-400 bg-blue-50' : ''}`}
                    onClick={() => onSelectFolder(folder.id)}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
                  >
                    <Folder size={16} className="mr-2 flex-shrink-0" style={{ color: folder.color }} />
                    <div className="flex-1 min-w-0 mr-2 overflow-hidden" style={{ wordBreak: 'break-word' }}>
                      <div className="font-medium">{folder.name}</div>
                      {folder.description && (
                        <div className="text-xs text-gray-500">{folder.description}</div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
                      {folderRuleCounts[folder.id] || 0}
                    </span>
                  </div>
                  
                  <div className="flex ml-1 flex-shrink-0">
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
            
            {/* フォルダ内のルール一覧 */}
            {expandedFolders[folder.id] && (
              <div className="ml-7 space-y-1 my-1">
                {folderRules[folder.id]?.length > 0 ? (
                  folderRules[folder.id].map(rule => (
                    <div 
                      key={rule.id}
                      className={`flex items-center py-1 px-2 text-sm text-gray-600 hover:bg-gray-100 rounded cursor-pointer rule-item ${
                        draggedRuleId === rule.id ? 'opacity-50 bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        onSelectFolder(folder.id);
                        if (onEditRule) onEditRule(rule);
                      }}
                      draggable
                      onDragStart={(e) => handleRuleDragStart(e, rule)}
                      onDragEnd={handleRuleDragEnd}
                    >
                      <FileText size={14} className="flex-shrink-0 mr-2 text-gray-400" />
                      <span className="flex-1 mr-1 overflow-hidden" style={{ wordBreak: 'break-word' }}>{rule.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 italic py-1 px-2">
                    ルールがありません
                  </div>
                )}
              </div>
            )}
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