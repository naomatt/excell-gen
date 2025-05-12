import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getRules, addRule, updateRule, deleteRule } from '../../services/ruleService';
import { getRuleFileMapping, setRuleFileMapping } from '../../services/fileMappingService';
import { ExcelRule, MappingRule, CellPosition, CellRange, Condition, SheetRule } from '../../types';
import RuleEditor from './RuleEditor';
import { Plus, Edit, Trash2, Copy, Calendar, Info, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const RuleManager: React.FC = () => {
  const navigate = useNavigate();
  const { rules, deleteRule: appDeleteRule, addRule: appAddRule, isLoading, error, refreshRules, copyRuleWithFileMapping } = useAppContext();
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<ExcelRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // ルールをコピーする関数
  const deepCopyRule = (rule: ExcelRule): ExcelRule => {
    console.log("コピー元のルール:", JSON.stringify(rule, null, 2));
    
    // 新しいルールを作成
    const newRule: ExcelRule = {
      id: crypto.randomUUID(),
      name: `${rule.name}のコピー`,  // コピーしたことがわかるように名前を変更
      description: rule.description,
      sheetRules: rule.sheetRules.map(sheetRule => {
        console.log("コピーするシートルール:", JSON.stringify(sheetRule, null, 2));
        
        // マッピングルールをコピー
        const newMappingRules = sheetRule.mappingRules.map(mappingRule => {
          console.log("コピーするマッピングルール:", JSON.stringify(mappingRule, null, 2));
          
          // 新しいマッピングルールを作成
          const newMappingRule: MappingRule = {
            id: crypto.randomUUID(),
            name: mappingRule.name,
            targetField: mappingRule.targetField || mappingRule.name,
            sourceType: mappingRule.sourceType || 'direct',  // sourceTypeがundefinedの場合は'direct'を設定
            direct_value: mappingRule.direct_value,
            formula: mappingRule.formula,
            defaultValue: mappingRule.defaultValue,
            conditions: mappingRule.conditions ? JSON.parse(JSON.stringify(mappingRule.conditions)) : undefined
          };

          // セルまたは範囲の設定
          if (mappingRule.cell) {
            newMappingRule.cell = JSON.parse(JSON.stringify(mappingRule.cell));  // セル情報を正しくコピー
          }
          if (mappingRule.range) {
            newMappingRule.range = JSON.parse(JSON.stringify(mappingRule.range));  // レンジ情報を正しくコピー
          }

          console.log("生成された新しいマッピングルール:", JSON.stringify(newMappingRule, null, 2));
          return newMappingRule;
        });

        // 新しいシートルールを作成
        const newSheetRule: SheetRule = {
          id: crypto.randomUUID(),
          name: sheetRule.name,
          sheetIndex: sheetRule.sheetIndex,
          sheetName: sheetRule.sheetName,
          mappingRules: newMappingRules
        };

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
  );
};

export default RuleManager;