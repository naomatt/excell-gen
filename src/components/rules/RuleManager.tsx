import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ExcelRule, MappingRule, CellPosition, CellRange, Condition, SheetRule } from '../../types';
import RuleEditor from './RuleEditor';
import FolderList from './FolderList';
import { Plus, Edit, Trash2, Copy, Calendar, Info, RefreshCw, GripVertical, Folder } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

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
  
  // contextからのrulesをローカルのrulesにコピー
  useEffect(() => {
    setRules([...contextRules]);
  }, [contextRules]);

  // デバッグ用
  useEffect(() => {
    console.log("RuleManager rendered, rules count:", rules.length);
    console.log("Current rules:", rules.map(r => r.name));
    console.log("Selected folder:", selectedFolderId);
  }, [rules, selectedFolderId]);

  // フォルダで絞り込まれたルール一覧
  const filteredRules = React.useMemo(() => {
    if (selectedFolderId === null) {
      // 未分類（folderIdがないか、nullのルール）
      return rules.filter(rule => !rule.folderId);
    } else {
      // 選択されたフォルダに属するルール
      return rules.filter(rule => rule.folderId === selectedFolderId);
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
  const handleChangeRuleFolder = async (ruleId: string, folderId: string | null) => {
    console.log(`ルールのフォルダを変更: ruleId=${ruleId}, folderId=${folderId}`);
    
    // 変更対象のルールを取得
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // folderIdを更新
    const updatedRule: ExcelRule = {
      ...rule,
      folderId: folderId || undefined
    };
    
    // ルールを更新
    const success = await appUpdateRule(ruleId, updatedRule);
    if (success) {
      toast.success('ルールのフォルダを変更しました');
    } else {
      toast.error('ルールのフォルダ変更に失敗しました');
    }
  };

  // ドラッグ開始時の処理
  const handleDragStart = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    console.log("ドラッグ開始:", index);
    setDraggedItem(index);
    
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
    console.log("コピー元のルール:", JSON.stringify(rule, null, 2));
    
    // 新しいルールを作成
    const newRule: ExcelRule = {
      id: crypto.randomUUID(),
      name: `${rule.name}のコピー`,
      description: rule.description,
      folderId: rule.folderId, // フォルダIDもコピー
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

    console.log("生成された新しいルール:", JSON.stringify(newRule, null, 2));
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
      <div className={`bg-white border-r border-gray-200 ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-4">
          <FolderList 
            selectedFolderId={selectedFolderId} 
            onSelectFolder={setSelectedFolderId} 
          />
        </div>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-1 p-6 bg-gray-50">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button 
              className="mr-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Folder size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedFolderId === null 
                ? '未分類のルール' 
                : 'フォルダ内のルール'}
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
                ? '未分類のルールがありません' 
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
        ) :
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
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              >
                <div className="p-5">
                  {/* ドラッグハンドルを追加 */}
                  <div className="flex items-center justify-between mb-3">
                    <div 
                      className="cursor-grab p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors duration-200"
                      title="ドラッグして順番を変更"
                    >
                      <GripVertical size={18} />
                    </div>
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
                  <div className="flex space-x-2">
                    <button 
                      className="flex-1 flex justify-center items-center px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                      onClick={() => handleEditRule(rule)}
                    >
                      <Edit size={14} className="mr-1" />
                      編集
                    </button>
                    <button 
                      className="flex-1 flex justify-center items-center px-3 py-2 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                      onClick={async () => {
                        console.log("コピー処理を開始: ルールID=", rule.id);
                        
                        // マッピングルールの詳細をログ出力
                        const origMappingDetails = rule.sheetRules.flatMap(sr => 
                          sr.mappingRules.map(mr => ({
                            name: mr.name,
                            sourceType: mr.sourceType,
                            hasCell: !!mr.cell,
                            cell: mr.cell,
                            hasRange: !!mr.range,
                            range: mr.range,
                            hasFormula: !!mr.formula,
                            formula: mr.formula,
                            direct_value: mr.direct_value
                          }))
                        );
                        console.log("コピー元マッピングルールの詳細:", origMappingDetails);
                        
                        // 完全にコピーしたルールを作成
                        const newRule = deepCopyRule(rule);
                        console.log("複製したルール:", newRule.name);
                        
                        // コピー後のマッピングルールの詳細をログ出力
                        const newMappingDetails = newRule.sheetRules.flatMap(sr => 
                          sr.mappingRules.map(mr => ({
                            name: mr.name,
                            sourceType: mr.sourceType,
                            hasCell: !!mr.cell,
                            cell: mr.cell,
                            hasRange: !!mr.range,
                            range: mr.range,
                            hasFormula: !!mr.formula,
                            formula: mr.formula,
                            direct_value: mr.direct_value
                          }))
                        );
                        console.log("コピー後マッピングルールの詳細:", newMappingDetails);

                        // 新しいルールを追加
                        await appAddRule(newRule);
                        console.log("新しいルールを追加しました:", newRule.id);
                        
                        // ファイル・シートマッピングもコピー
                        copyRuleWithFileMapping(rule.id, newRule.id);
                        console.log("ファイル・シートマッピングを複製しました", rule.id, "→", newRule.id);
                      }}
                    >
                      <Copy size={14} className="mr-1" />
                      複製
                    </button>
                    <button 
                      className="flex justify-center items-center px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                      onClick={() => setConfirmDelete(rule.id)}
                    >
                      <Trash2 size={14} className="mr-1" />
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }

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