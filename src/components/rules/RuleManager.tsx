import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ExcelRule, MappingRule, CellPosition, CellRange, Condition, SheetRule, RuleFolder } from '../../types';
import RuleEditor from './RuleEditor';
import FolderList from './FolderList';
import { Plus, Edit, Trash2, Copy, Calendar, Info, RefreshCw, GripVertical, Folder } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getFolders } from '../../services/folderService';
import { supabase } from '../../lib/supabaseClient'; // Supabaseクライアントを直接インポート

// テーブル名の定数（直接Supabaseに接続する場合に使用）
const EXCEL_RULES_TABLE = 'excel_rules';
const SHEET_RULES_TABLE = 'excel_sheet_rules';
const MAPPING_RULES_TABLE = 'excel_mapping_rules';

const RuleManager: React.FC = () => {
  const navigate = useNavigate();
  const { rules: contextRules, deleteRule: appDeleteRule, addRule: appAddRule, updateRule: appUpdateRule, isLoading, error, refreshRules, copyRuleWithFileMapping } = useAppContext();
  
  const [rules, setRules] = useState<ExcelRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<ExcelRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // ドラッグ＆ドロップ関連の状態
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  
  // フォルダ関連の状態
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [folders, setFolders] = useState<RuleFolder[]>([]);
  
  // contextからのrulesをローカルのrulesにコピー
  useEffect(() => {
    setRules([...contextRules]);
  }, [contextRules]);

  // 選択フォルダIDをローカルストレージから復元
  useEffect(() => {
    const savedFolderId = localStorage.getItem('selectedFolderId');
    if (savedFolderId) {
      console.log(`ローカルストレージから選択フォルダIDを復元: ${savedFolderId}`);
      setSelectedFolderId(savedFolderId);
    }
  }, []);

  // 選択フォルダIDをローカルストレージに保存
  useEffect(() => {
    if (selectedFolderId !== null) {
      localStorage.setItem('selectedFolderId', selectedFolderId);
      console.log(`選択フォルダIDをローカルストレージに保存: ${selectedFolderId}`);
    } else {
      localStorage.removeItem('selectedFolderId');
      console.log('選択フォルダIDをローカルストレージから削除（未分類を選択）');
    }
    
    // フォルダを再読み込み（フォルダ選択時に最新情報を取得）
    loadFolders();
  }, [selectedFolderId]);

  // フォルダの読み込み
  const loadFolders = async () => {
    try {
      const folderList = await getFolders();
      console.log('フォルダ一覧を取得:', folderList);
      setFolders(folderList);
    } catch (error) {
      console.error('フォルダの読み込みに失敗しました:', error);
    }
  };

  // コンポーネントマウント時にフォルダを読み込む
  useEffect(() => {
    loadFolders();
  }, []);

  // デバッグ用
  useEffect(() => {
    console.log("RuleManager rendered, rules count:", rules.length);
    console.log("Current rules:", rules.map(r => r.name));
    console.log("Selected folder:", selectedFolderId);
    console.log("Available folders:", folders.map(f => ({ id: f.id, name: f.name })));
  }, [rules, selectedFolderId, folders]);

  // フォルダで絞り込まれたルール一覧
  const filteredRules = React.useMemo(() => {
    console.log("フィルタリングを実行: selectedFolderId=", selectedFolderId);
    console.log("フィルタリング対象のルール:", rules.map(r => ({ name: r.name, folderId: r.folderId })));
    
    if (selectedFolderId === null) {
      // 未分類（folderIdがないか、nullのルール）
      const filtered = rules.filter(rule => !rule.folderId);
      console.log("未分類フィルタリング結果:", filtered.map(r => r.name));
      return filtered;
    } else {
      // 選択されたフォルダに属するルール
      const filtered = rules.filter(rule => rule.folderId === selectedFolderId);
      console.log(`フォルダ(${selectedFolderId})フィルタリング結果:`, filtered.map(r => r.name));
      return filtered;
    }
  }, [rules, selectedFolderId]);

  const handleCreateRule = () => {
    console.log("Create rule button clicked");
    setEditingRule(null);
    setIsCreating(true);
  };

  const handleEditRule = (rule: ExcelRule) => {
    console.log("Edit rule button clicked", rule);
    setIsCreating(false);
    setEditingRule(rule);
  };

  const handleDeleteRule = async (id: string) => {
    console.log("Delete rule", id);
    await appDeleteRule(id);
    setConfirmDelete(null);
  };

  const handleCloseEditor = () => {
    console.log("Close editor");
    setIsCreating(false);
    setEditingRule(null);
    navigate('/rules');
  };

  const handleRefresh = () => {
    refreshRules();
  };

  // ルールのフォルダを変更
  const handleChangeRuleFolder = async (ruleId: string, folderId: string | null): Promise<boolean> => {
    console.log(`ルールのフォルダを変更: ruleId=${ruleId}, folderId=${folderId}`);
    
    // 変更対象のルールを取得
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) {
      console.error('ルールが見つかりません:', ruleId);
      return false;
    }
    
    // 現在のフォルダIDを確認
    console.log(`現在のフォルダID: ${rule.folderId || 'なし(未分類)'}`);
    
    // フォルダIDが同じなら何もしない
    if (rule.folderId === folderId) {
      console.log('フォルダIDが変更されていないため、処理をスキップします');
      return true;
    }
    
    // folderIdのみを更新し、他のフィールドはそのまま保持
    const updatedRule: ExcelRule = {
      ...rule,
      folderId: folderId
    };
    
    console.log('更新するルール:', {
      id: updatedRule.id,
      name: updatedRule.name,
      oldFolderId: rule.folderId,
      newFolderId: updatedRule.folderId
    });
    
    // ルールを更新（フォルダIDのみを変更）
    try {
      console.log('AppContextのupdateRuleを呼び出します');
      const success = await appUpdateRule(ruleId, updatedRule);
      
      // 更新後のルールを取得して確認
      const updatedRuleCheck = rules.find(r => r.id === ruleId);
      console.log('更新後のルール:', updatedRuleCheck ? {
        id: updatedRuleCheck.id,
        name: updatedRuleCheck.name,
        folderId: updatedRuleCheck.folderId
      } : '不明');
      
      if (success) {
        toast.success('ルールのフォルダを変更しました');
        
        // 明示的にルールの状態を更新（AppContextの処理を待たずに即時反映）
        const newRules = rules.map(r => {
          if (r.id === ruleId) {
            return { ...r, folderId };
          }
          return r;
        });
        setRules(newRules);
        
        // 移動先のフォルダを自動的に選択（移動先が未分類ならnull、それ以外ならフォルダID）
        setSelectedFolderId(folderId);
        console.log(`選択フォルダを変更: ${folderId || '未分類'}`);
        
        return true;
      } else {
        toast.error('ルールのフォルダ変更に失敗しました');
        return false;
      }
    } catch (error) {
      console.error('ルールのフォルダ変更中にエラーが発生しました:', error);
      toast.error('ルールのフォルダ変更に失敗しました');
      return false;
    }
  };

  // ドラッグ開始時の処理
  const handleDragStart = (index: number, rule: ExcelRule, e: React.DragEvent<HTMLDivElement>) => {
    console.log("ドラッグ開始:", index, rule.id);
    setDraggedItem(index);
    
    // ルールIDをドラッグデータに設定
    e.dataTransfer.setData('application/rule', rule.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // ドラッグ中のゴースト画像の透明度を調整
    if (e.dataTransfer.setDragImage) {
      const element = document.getElementById(`rule-card-${index}`);
      if (element) {
        // ドラッグイメージを設定
        const crt = element.cloneNode(true) as HTMLElement;
        crt.id = 'drag-ghost';
        crt.style.opacity = '0.9';
        crt.style.position = 'absolute';
        crt.style.top = '-1000px';
        crt.style.transform = 'scale(1.05)';
        crt.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
        crt.style.border = '2px solid #3b82f6';
        crt.style.background = 'white';
        crt.style.borderRadius = '0.5rem';
        document.body.appendChild(crt);
        e.dataTransfer.setDragImage(crt, 100, 35);
        setTimeout(() => {
          document.body.removeChild(crt);
        }, 0);
      }
    }
    
    // カーソルを変更
    const cards = document.querySelectorAll('[id^="rule-card-"]');
    cards.forEach(card => {
      (card as HTMLElement).style.cursor = 'grabbing';
    });
  };
  
  // ドラッグ中の処理
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };
  
  // ドロップ時の処理
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // ドラッグ元とドロップ先が有効な場合のみ処理を実行
    if (draggedItem !== null && dragOverItem !== null && draggedItem !== dragOverItem) {
      console.log(`ルールの並び替え: ${draggedItem} → ${dragOverItem}`);
      
      // ルール配列のコピーを作成
      const newRules = [...rules];
      const draggedItemContent = newRules[draggedItem];
      
      // ドラッグしたアイテムを削除
      newRules.splice(draggedItem, 1);
      // ドロップした位置に挿入
      newRules.splice(dragOverItem, 0, draggedItemContent);
      
      // 状態を更新
      setRules(newRules);
      
      // 順序変更を通知
      toast.success('ルールの順序を変更しました');
    }
    
    // ドラッグ状態をリセット
    setDraggedItem(null);
    setDragOverItem(null);
  };
  
  // ドラッグ終了時の処理
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    
    // カーソルを元に戻す
    const cards = document.querySelectorAll('[id^="rule-card-"]');
    cards.forEach(card => {
      (card as HTMLElement).style.cursor = '';
    });
  };

  // ルールをコピーする関数
  const deepCopyRule = (rule: ExcelRule): ExcelRule => {
    console.log("コピー元のルール詳細:", {
      id: rule.id,
      name: rule.name,
      folderId: rule.folderId,
      folder_id: (rule as any).folder_id,
      sheetRulesCount: rule.sheetRules.length
    });
    
    // 新しいルールを作成
    const newRule: ExcelRule = {
      id: crypto.randomUUID(),
      name: `${rule.name}のコピー`,
      description: rule.description,
      folderId: rule.folderId, // フォルダIDを明示的にコピー元から継承
      sheetRules: rule.sheetRules.map((sheetRule, index) => {
        console.log("コピーするシートルール:", JSON.stringify(sheetRule, null, 2));
        
        // マッピングルールをコピー
        const newMappingRules = sheetRule.mappingRules.map(mappingRule => {
          console.log("コピーするマッピングルール:", JSON.stringify(mappingRule, null, 2));
          
          // sourceTypeの決定
          let sourceType = mappingRule.sourceType;
          if (!sourceType) {
            if (mappingRule.direct_value !== undefined) {
              sourceType = 'direct';
            } else if (mappingRule.range) {
              sourceType = 'range';
            } else if (mappingRule.cell) {
              sourceType = 'cell';
            } else if (mappingRule.formula) {
              sourceType = 'formula';
            } else {
              sourceType = 'direct';
            }
          }

          // 新しいマッピングルールを作成
          const newMappingRule: MappingRule = {
            id: crypto.randomUUID(),
            name: mappingRule.name,
            targetField: mappingRule.targetField || mappingRule.name,
            sourceType: sourceType,
            direct_value: mappingRule.direct_value,
            formula: mappingRule.formula,
            defaultValue: mappingRule.defaultValue,
            conditions: mappingRule.conditions ? JSON.parse(JSON.stringify(mappingRule.conditions)) : undefined
          };

          // セルまたは範囲の設定
          if (mappingRule.cell) {
            try {
              const cellData = typeof mappingRule.cell === 'string' 
                ? JSON.parse(mappingRule.cell) 
                : mappingRule.cell;
              
              // 数値型に変換して保存
              newMappingRule.cell = {
                row: Number(cellData.row),
                column: Number(cellData.column)
              };
            } catch (error) {
              console.error('セルデータのパースに失敗:', error);
              newMappingRule.cell = undefined;
            }
          }
          
          if (mappingRule.range) {
            try {
              const rangeData = typeof mappingRule.range === 'string'
                ? JSON.parse(mappingRule.range)
                : mappingRule.range;
              
              // 数値型に変換して保存
              newMappingRule.range = {
                startRow: Number(rangeData.startRow),
                startColumn: Number(rangeData.startColumn),
                endRow: Number(rangeData.endRow),
                endColumn: Number(rangeData.endColumn)
              };
            } catch (error) {
              console.error('範囲データのパースに失敗:', error);
              newMappingRule.range = undefined;
            }
          }

          // 不要なプロパティを削除
          delete (newMappingRule as any).hasCell;
          delete (newMappingRule as any).hasRange;
          delete (newMappingRule as any).hasFormula;
          delete (newMappingRule as any).showPreview;

          console.log("生成された新しいマッピングルール:", JSON.stringify(newMappingRule, null, 2));
          return newMappingRule;
        });

        // 新しいシートルールを作成
        const newSheetRule: SheetRule = {
          id: crypto.randomUUID(),
          name: sheetRule.name,
          sheetIndex: index,  // インデックスを明示的に設定
          mappingRules: newMappingRules
        };

        // sheet_nameプロパティを削除（データベースのスキーマに合わせる）
        delete (newSheetRule as any).sheetName;

        console.log("生成された新しいシートルール:", JSON.stringify(newSheetRule, null, 2));
        return newSheetRule;
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // DB向けに明示的にfolder_idも設定（データベーススキーマでの列名）
    if (rule.folderId) {
      (newRule as any).folder_id = rule.folderId;
      console.log(`フォルダIDをDBスキーマ用に設定: ${(newRule as any).folder_id}`);
    }

    console.log("生成された新しいルール:", {
      id: newRule.id,
      name: newRule.name,
      folderId: newRule.folderId,
      folder_id: (newRule as any).folder_id,
      sheetRulesCount: newRule.sheetRules.length
    });
    return newRule;
  };

  // isCreatingまたはeditingRuleが設定されていればRuleEditorを表示
  if (isCreating || editingRule) {
    console.log("Rendering RuleEditor component");
    return <RuleEditor rule={editingRule} onClose={handleCloseEditor} />;
  }

  // それ以外はルール一覧を表示
  console.log("Rendering rule list, rules.length:", rules.length);
  return (
    <div className="flex h-full">
      {/* サイドバー（フォルダリスト） */}
      <div className={`bg-white border-r border-gray-200 ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-4">
          <FolderList 
            selectedFolderId={selectedFolderId} 
            onSelectFolder={setSelectedFolderId}
            onMoveRuleToFolder={handleChangeRuleFolder}
            onEditRule={handleEditRule}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-1 p-6 bg-gray-50">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button 
              className="mr-3 p-2 flex items-center text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Folder size={18} className="mr-2" />
              {isSidebarOpen ? 'フォルダを隠す' : 'フォルダを表示'}
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedFolderId === null 
                ? '未分類' 
                : `${folders.find(f => f.id === selectedFolderId)?.name || 'フォルダ'}`}
            </h1>
          </div>
          <div className="flex space-x-2">
            <button 
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw size={18} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button 
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              onClick={handleCreateRule}
            >
              <Plus size={18} className="mr-1" />
              ルールを作成
            </button>
          </div>
        </div>

        {/* ローディング状態 */}
        {isLoading && (
          <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-3 rounded-md">
            <p className="flex items-center">
              <RefreshCw size={18} className="animate-spin mr-2" />
              ルールを読み込んでいます...
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-md">
            <p>{error}</p>
            <button 
              className="text-sm text-red-700 underline mt-1"
              onClick={handleRefresh}
            >
              再試行
            </button>
          </div>
        )}

        {filteredRules.length === 0 && !isLoading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Info className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedFolderId === null 
                ? '未分類にルールがありません' 
                : 'このフォルダにはルールがありません'}
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedFolderId === null 
                ? 'ルールを作成して、Excelファイルの自動処理を始めましょう。' 
                : 'ルールを作成するか、既存のルールをこのフォルダに移動してください。'}
            </p>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              onClick={handleCreateRule}
            >
              新しいルールを作成
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRules.map((rule, index) => (
              <div 
                key={rule.id}
                id={`rule-card-${index}`} 
                className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden transition-all ${
                  draggedItem === index ? 'opacity-70 cursor-grabbing scale-105 shadow-xl z-50' :
                  dragOverItem === index ? 'border-2 border-dashed border-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}
                draggable
                onDragStart={(e) => handleDragStart(index, rule, e)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              >
                <div className="p-5">
                  {/* ドラッグハンドルを追加 */}
                  <div className="flex items-center justify-between mb-3">
                    <div 
                      className="cursor-grab p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors duration-200"
                      title="ドラッグして順番を変更やフォルダに移動"
                    >
                      <GripVertical size={18} />
                    </div>
                    {rule.folderId && (
                      <div className="flex items-center">
                        <Folder size={14} className="mr-1" style={{ color: folders.find(f => f.id === rule.folderId)?.color || '#3b82f6' }} />
                        <span className="text-xs text-gray-500">
                          {folders.find(f => f.id === rule.folderId)?.name || 'フォルダ'}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{rule.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{rule.description}</p>
                  <div className="flex items-center text-xs text-gray-500 mb-4">
                    <Calendar size={14} className="mr-1" />
                    <span>作成日: {new Date(rule.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-4">
                    <span className="block">シート数: {rule.sheetRules.length}</span>
                    <span className="block">
                      フィールド数: {rule.sheetRules.reduce((sum, sheet) => sum + sheet.mappingRules.length, 0)}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    <button 
                      className="flex-1 flex justify-center items-center px-2 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-xs"
                      onClick={() => handleEditRule(rule)}
                    >
                      <Edit size={12} className="mr-0.5" />
                      編集
                    </button>
                    <button 
                      className="flex-1 flex justify-center items-center px-2 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors text-xs"
                      onClick={async () => {
                        try {
                          console.log("--------- コピー処理開始 ---------");
                          console.log("コピー処理を開始: ルールID=", rule.id);
                          
                          // コピー元のフォルダIDを保存（明示的に取得）
                          const origFolderId = rule.folderId;
                          console.log(`コピー元のフォルダID: ${origFolderId || 'null (未分類)'}`);
                          
                          // 完全にコピーしたルールを作成
                          const newRule = deepCopyRule(rule);
                          
                          // フォルダIDが正しくコピーされていることを確認
                          console.log(`複製したルール: ${newRule.name}, 元のフォルダID: ${origFolderId || 'null'}, コピー後のフォルダID: ${newRule.folderId || 'null'}`);
                          
                          // DBエンティティ用にフォルダIDを明示的に設定
                          if (origFolderId) {
                            console.log("フォルダIDを明示的に設定します:", origFolderId);
                            newRule.folderId = origFolderId;
                            // DB向けに明示的に設定（データベーススキーマではfolder_idなので）
                            (newRule as any).folder_id = origFolderId;
                          } else {
                            // 未分類の場合は明示的にnullをセット
                            console.log("未分類なので、フォルダIDをnullに設定します");
                            newRule.folderId = null;
                            (newRule as any).folder_id = null;
                          }
                          
                          console.log("追加前の最終確認:", {
                            ruleName: newRule.name,
                            ruleId: newRule.id,
                            folderId: newRule.folderId,
                            folder_id: (newRule as any).folder_id
                          });
                          
                          // 新しいルールを追加（フォルダIDの問題を解決するため直接Supabaseに接続）
                          try {
                            console.log("直接Supabaseを使用してルールを追加します...");
                            // 1. メインルールを追加
                            const { data: mainRule, error: mainError } = await supabase
                              .from(EXCEL_RULES_TABLE)
                              .insert({
                                id: newRule.id,
                                name: newRule.name,
                                description: newRule.description,
                                folder_id: origFolderId, // 明示的にfolder_idを設定
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                              })
                              .select()
                              .single();
                              
                            if (mainError) {
                              console.error("メインルール作成エラー:", mainError);
                              throw mainError;
                            }
                            console.log("メインルールを作成しました:", mainRule);
                            
                            // 2. シートルールを追加
                            for (const sheetRule of newRule.sheetRules) {
                              const { error: sheetError } = await supabase
                                .from(SHEET_RULES_TABLE)
                                .insert({
                                  id: sheetRule.id,
                                  rule_id: newRule.id,
                                  name: sheetRule.name,
                                  sheet_index: sheetRule.sheetIndex
                                });
                                
                              if (sheetError) {
                                console.error("シートルール作成エラー:", sheetError);
                                throw sheetError;
                              }
                              
                              // 3. マッピングルールを追加
                              for (const mappingRule of sheetRule.mappingRules) {
                                const mappingData = {
                                  id: mappingRule.id,
                                  sheet_rule_id: sheetRule.id,
                                  name: mappingRule.name,
                                  target_field: mappingRule.targetField,
                                  source_type: mappingRule.sourceType,
                                  // 条件付きフィールド
                                  ...(mappingRule.cell && { 
                                    cell: typeof mappingRule.cell === 'string' 
                                      ? mappingRule.cell 
                                      : JSON.stringify(mappingRule.cell) 
                                  }),
                                  ...(mappingRule.range && { 
                                    range: typeof mappingRule.range === 'string' 
                                      ? mappingRule.range 
                                      : JSON.stringify(mappingRule.range) 
                                  }),
                                  ...(mappingRule.formula && { formula: mappingRule.formula }),
                                  ...(mappingRule.direct_value !== undefined && { direct_value: mappingRule.direct_value }),
                                  ...(mappingRule.defaultValue !== undefined && { default_value: mappingRule.defaultValue }),
                                  ...(mappingRule.conditions && { 
                                    conditions: typeof mappingRule.conditions === 'string' 
                                      ? mappingRule.conditions 
                                      : JSON.stringify(mappingRule.conditions) 
                                  })
                                };
                                
                                const { error: mappingError } = await supabase
                                  .from(MAPPING_RULES_TABLE)
                                  .insert(mappingData);
                                  
                                if (mappingError) {
                                  console.error("マッピングルール作成エラー:", mappingError);
                                  throw mappingError;
                                }
                              }
                            }
                            
                            console.log("ルールとすべての関連データを作成しました");
                            
                            // ファイル・シートマッピングもコピー
                            await copyRuleWithFileMapping(rule.id, newRule.id);
                            console.log("ファイル・シートマッピングを複製しました", rule.id, "→", newRule.id);
                            
                          } catch (dbError) {
                            console.error("データベース操作でエラーが発生しました:", dbError);
                            throw new Error("ルールの追加に失敗しました: " + (dbError as Error).message);
                          }
                          
                          // 全てのルールを再読み込み
                          console.log("ルールを再読み込みします...");
                          await refreshRules();
                          
                          // 元のルールと同じフォルダを選択して表示を更新
                          if (origFolderId) {
                            console.log("コピー元と同じフォルダを選択:", origFolderId);
                            setSelectedFolderId(origFolderId);
                          } else {
                            console.log("コピー元が未分類のため、未分類を選択");
                            setSelectedFolderId(null);
                          }
                          
                          // 成功メッセージを表示
                          toast.success('ルールを複製しました');
                          console.log("--------- コピー処理完了 ---------");
                        } catch (error) {
                          console.error("ルールのコピー中にエラーが発生しました:", error);
                          toast.error('ルールの複製に失敗しました');
                        }
                      }}
                    >
                      <Copy size={12} className="mr-0.5" />
                      複製
                    </button>
                    <button 
                      className="flex-1 flex justify-center items-center px-2 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors text-xs"
                      onClick={() => setConfirmDelete(rule.id)}
                    >
                      <Trash2 size={12} className="mr-0.5" />
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">削除の確認</h3>
              <p className="text-gray-600 mb-4">
                このルールを削除してもよろしいですか？この操作は取り消せません。
              </p>
              <div className="flex space-x-3 justify-end">
                <button 
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                  onClick={() => setConfirmDelete(null)}
                >
                  キャンセル
                </button>
                <button 
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  onClick={() => handleDeleteRule(confirmDelete)}
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleManager;