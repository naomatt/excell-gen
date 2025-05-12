import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Calendar, Info, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import RuleEditor from './RuleEditor';
import { ExcelRule, MappingRule, CellPosition, CellRange, Condition } from '../../types';

const RuleManager: React.FC = () => {
  const { rules, deleteRule, addRule, isLoading, error, refreshRules, copyRuleWithFileMapping } = useAppContext();
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<ExcelRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // デバッグ用
  useEffect(() => {
    console.log("RuleManager rendered, rules count:", rules.length);
    console.log("Current rules:", rules.map(r => r.name));
  }, [rules]);

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
    await deleteRule(id);
    setConfirmDelete(null);
  };

  const handleCloseEditor = () => {
    console.log("Close editor");
    setIsCreating(false);
    setEditingRule(null);
  };

  const handleRefresh = () => {
    refreshRules();
  };

  // ルールを完全にコピーする関数
  const deepCopyRule = (rule: ExcelRule): ExcelRule => {
    console.log("ルールをコピーします:", rule.id, rule.name);
    
    // コピー元の情報をログ出力
    const mappingInfo = rule.sheetRules.map(sheetRule => 
      sheetRule.mappingRules.map(mr => ({
        name: mr.name,
        sourceType: mr.sourceType,
        hasCell: !!mr.cell,
        hasRange: !!mr.range,
        hasFormula: !!mr.formula,
        directValue: mr.directValue,
        cell: mr.cell,
        range: mr.range
      }))
    );
    console.log("コピー元ルールの詳細情報:", mappingInfo);
    
    const newRule = {
      ...rule,
      id: crypto.randomUUID(),
      name: `${rule.name}のコピー`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sheetRules: rule.sheetRules.map(sheetRule => ({
        ...sheetRule,
        id: crypto.randomUUID(),
        mappingRules: sheetRule.mappingRules.map(mappingRule => {
          console.log("コピー元マッピングルール:", mappingRule);
          
          // sourceTypeを決定（directValueを優先）
          let sourceType: 'cell' | 'range' | 'formula' | 'direct' = mappingRule.sourceType || 'cell';
          if (mappingRule.directValue !== undefined) {
            sourceType = 'direct';
          } else if (mappingRule.range) {
            sourceType = 'range';
          } else if (mappingRule.cell) {
            sourceType = 'cell';
          } else if (mappingRule.formula) {
            sourceType = 'formula';
          }
          
          // 基本プロパティを持つ新しいオブジェクトを作成
          const newMappingRule: MappingRule = {
            id: crypto.randomUUID(),
            name: mappingRule.name,
            targetField: mappingRule.targetField,
            sourceType,
            directValue: mappingRule.directValue
          };

          console.log(`マッピングルールの初期化: ${mappingRule.name}`, {
            sourceType: newMappingRule.sourceType,
            directValue: newMappingRule.directValue
          });

          // sourceType別に必要なプロパティをコピー
          if (sourceType === 'cell') {
            if (mappingRule.cell) {
              try {
                // 文字列の場合はJSONとしてパース
                const cellData = typeof mappingRule.cell === 'string'
                  ? JSON.parse(mappingRule.cell)
                  : mappingRule.cell;
                
                newMappingRule.cell = {
                  row: cellData.row,
                  column: cellData.column
                };
                console.log(`セル情報をコピー: ${mappingRule.name} → ${JSON.stringify(newMappingRule.cell)}`);
              } catch (error) {
                console.error(`セル情報のパースに失敗: ${mappingRule.name}`, error);
              }
            }
          } else if (sourceType === 'range') {
            if (mappingRule.range) {
              try {
                // 文字列の場合はJSONとしてパース
                const rangeData = typeof mappingRule.range === 'string'
                  ? JSON.parse(mappingRule.range)
                  : mappingRule.range;
                
                newMappingRule.range = {
                  startRow: rangeData.startRow,
                  startColumn: rangeData.startColumn,
                  endRow: rangeData.endRow,
                  endColumn: rangeData.endColumn
                };
                console.log(`範囲情報をコピー: ${mappingRule.name} → ${JSON.stringify(newMappingRule.range)}`);
              } catch (error) {
                console.error(`範囲情報のパースに失敗: ${mappingRule.name}`, error);
              }
            }
          } else if (sourceType === 'formula' && mappingRule.formula) {
            newMappingRule.formula = mappingRule.formula;
            console.log(`数式をコピー: ${mappingRule.name} → ${mappingRule.formula}`);
          } else if (sourceType === 'direct' && mappingRule.directValue !== undefined) {
            newMappingRule.directValue = mappingRule.directValue;
            console.log(`直接入力値をコピー: ${mappingRule.name} → "${mappingRule.directValue}"`);
          }
          
          // 追加プロパティもコピー
          if (mappingRule.defaultValue !== undefined) {
            newMappingRule.defaultValue = mappingRule.defaultValue;
          }
          
          if (mappingRule.conditions) {
            newMappingRule.conditions = JSON.parse(JSON.stringify(mappingRule.conditions)) as Condition[];
          }
          
          console.log(`マッピングルールのコピー完了: ${mappingRule.name}`, newMappingRule);
          return newMappingRule;
        })
      }))
    };

    console.log("コピー後のルール:", newRule);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">ルール管理</h1>
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

      {rules.length === 0 && !isLoading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Info className="h-12 w-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">ルールが作成されていません</h3>
          <p className="text-gray-600 mb-6">
            最初のルールを作成して、Excelファイルの自動処理を始めましょう。
          </p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={handleCreateRule}
          >
            最初のルールを作成
          </button>
        </div>
      ) :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
              <div className="p-5">
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
                          directValue: mr.directValue
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
                          directValue: mr.directValue
                        }))
                      );
                      console.log("コピー後マッピングルールの詳細:", newMappingDetails);

                      // 新しいルールを追加
                      await addRule(newRule);
                      console.log("新しいルールを追加しました:", newRule.id);
                      
                      // ファイル・シートマッピングもコピー
                      copyRuleWithFileMapping(rule.id, newRule.id);
                      console.log("ファイル・シートマッピングを複製しました", rule.id, "→", newRule.id);
                      
                      // 編集モードで開く
                      handleEditRule(newRule);
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
  );
};

export default RuleManager;