import React, { useState, useEffect } from 'react';
import RuleManager from '../components/rules/RuleManager';
import FolderDialog from '../components/rules/FolderDialog';
import { Rule, RuleFolder, ExcelRule } from '../types';
import { useAppContext } from '../context/AppContext';

const RuleManagementPage: React.FC = () => {
  const { 
    rules: excelRules, 
    folders, 
    addRule, 
    updateRule, 
    deleteRule,
    addFolder,
    updateFolder,
    deleteFolder,
    moveRuleToFolder,
    refreshRules
  } = useAppContext();
  
  console.log('RuleManagementPage - 元のexcelRules:', excelRules);
  console.log('RuleManagementPage - excelRules型:', typeof excelRules);
  console.log('RuleManagementPage - excelRules配列か?', Array.isArray(excelRules));
  console.log('RuleManagementPage - excelRules長さ:', excelRules?.length || 0);

  // 注意: ここで型変換ではなく、直接excelRulesを使用します
  const actualRules = excelRules;
  
  console.log('RuleManagementPage - 実際に渡すルール:', actualRules);
  console.log('RuleManagementPage - 実際に渡すルール長さ:', actualRules?.length || 0);
  console.log('RuleManagementPage - 実際に渡すルール配列か?', Array.isArray(actualRules));
  console.log('RuleManagementPage - 実際に渡すフォルダ:', folders);
  console.log('RuleManagementPage - 実際に渡すフォルダ長さ:', folders?.length || 0);
  console.log('RuleManagementPage - 実際に渡すフォルダ配列か?', Array.isArray(folders));

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<RuleFolder | undefined>(undefined);

  // デバッグログの追加
  useEffect(() => {
    console.log('RuleManagementPage - マウント時点でのexcelRules:', excelRules);
    console.log('RuleManagementPage - マウント時点でのexcelRules長さ:', excelRules?.length || 0);
    console.log('RuleManagementPage - マウント時点での実際に渡すルール:', actualRules);
    console.log('RuleManagementPage - マウント時点でのフォルダ:', folders);
  }, [excelRules, actualRules, folders]);

  // 初回マウント時にルールをリフレッシュ
  useEffect(() => {
    console.log('RuleManagementPage - マウント時にルールをリフレッシュします');
    
    const loadData = async () => {
      try {
        await refreshRules();
        console.log('ルールのリフレッシュが完了しました');
      } catch (error) {
        console.error('ルールのリフレッシュに失敗しました:', error);
      }
    };
    
    loadData();
  }, [refreshRules]);

  // サンプルルールを作成する関数
  const handleCreateSampleRule = () => {
    const sampleRule: Omit<ExcelRule, 'id' | 'createdAt' | 'updatedAt'> = {
      name: 'サンプルルール',
      description: 'これはサンプルルールです',
      sheetRules: [
        {
          id: crypto.randomUUID(),
          name: 'シート1',
          sheetIndex: 0,
          mappingRules: [
            {
              id: crypto.randomUUID(),
              name: 'フィールド1',
              targetField: 'field1',
              sourceType: 'cell',
              cell: { row: 1, column: 1 }
            },
            {
              id: crypto.randomUUID(),
              name: 'フィールド2',
              targetField: 'field2',
              sourceType: 'direct',
              direct_value: 'サンプル値'
            }
          ]
        }
      ]
    };
    
    console.log('サンプルルールを作成します:', sampleRule);
    addRule(sampleRule as ExcelRule);
  };

  const handleAddRule = () => {
    // 実装はRuleManagerコンポーネント内に任せる
  };

  const handleEditRule = (rule: Rule) => {
    // 実装はRuleManagerコンポーネント内に任せる
  };

  const handleDeleteRule = (rule: Rule) => {
    deleteRule(rule.id);
  };

  const handleAddFolder = () => {
    setEditingFolder(undefined);
    setFolderDialogOpen(true);
  };

  const handleEditFolder = (folder: RuleFolder) => {
    setEditingFolder(folder);
    setFolderDialogOpen(true);
  };

  const handleDeleteFolder = (folder: RuleFolder) => {
    deleteFolder(folder.id);
  };

  const handleSaveFolder = (folder: Omit<RuleFolder, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingFolder) {
      updateFolder({
        ...editingFolder,
        ...folder
      });
    } else {
      addFolder(folder);
    }
    setFolderDialogOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">ルール管理 ({actualRules?.length || 0}件)</h2>
          <p className="text-sm text-gray-500">
            {Array.isArray(excelRules) ? `元データ: ${excelRules.length}件` : '元データ: 読み込み中'}
          </p>
        </div>
        <button
          onClick={handleCreateSampleRule}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          サンプルルールを作成
        </button>
      </div>
      
      <RuleManager
        rules={actualRules || []}
        folders={folders || []}
        onAddRule={handleAddRule}
        onEditRule={handleEditRule}
        onDeleteRule={handleDeleteRule}
        onAddFolder={handleAddFolder}
        onEditFolder={handleEditFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveRule={moveRuleToFolder}
      />

      <FolderDialog
        folder={editingFolder}
        isOpen={folderDialogOpen}
        onClose={() => setFolderDialogOpen(false)}
        onSave={handleSaveFolder}
      />
    </div>
  );
};

export default RuleManagementPage; 