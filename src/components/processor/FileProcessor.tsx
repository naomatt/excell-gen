import React, { useState } from 'react';
import { FileUp, Settings, FilePlus2, Check, AlertTriangle, Download, ExternalLink, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { ProcessingResult, RuleFolder, ExcelRule } from '../../types';
import ResultsViewer from './ResultsViewer';
import { processExcelFile, readExcelFile } from '../../utils/excelProcessor';
import SheetPreview from './SheetPreview';
import { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import { getFolders } from '../../services/folderService';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface ExcelFileData {
  workbook: WorkBook;
  sheets: { name: string; data: any[][] }[];
}

const FileProcessor: React.FC = () => {
  const navigate = useNavigate();
  
  const { 
    rules, 
    currentFile, setCurrentFile,
    selectedRuleId, setSelectedRuleId,
    addProcessedFile, addProcessingResult 
  } = useAppContext();
  
  // 追加: 複数ルール選択用の状態
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<ProcessingResult[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  // フォルダ関連の状態を追加
  const [folders, setFolders] = useState<RuleFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isUncategorizedExpanded, setIsUncategorizedExpanded] = useState(false);
  const [isFoldersLoading, setIsFoldersLoading] = useState(false);
  
  const [processingStep, setProcessingStep] = useState<'upload' | 'selectRule' | 'process' | 'results' | 'batchResults'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<ExcelFileData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  // ルール選択ハンドラーを修正（単一選択と複数選択の両方に対応）
  const handleSelectRule = (ruleId: string, isMultiSelect = false) => {
    // フォルダ選択をクリア
    setSelectedFolderId(null);
    
    if (isMultiSelect) {
      // 複数選択モード
      setSelectedRuleIds(prev => {
        if (prev.includes(ruleId)) {
          return prev.filter(id => id !== ruleId);
        } else {
          return [...prev, ruleId];
        }
      });
    } else {
      // 単一選択モード
      setSelectedRuleId(ruleId);
      // 単一選択時は複数選択リストも更新
      setSelectedRuleIds([ruleId]);
    }
  };
  
  // フォルダ選択ハンドラーを追加
  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    
    // フォルダが選択された場合、そのフォルダ内のルールをすべて選択
    if (folderId === null) {
      // 未分類フォルダの場合
      const uncategorizedRuleIds = rules
        .filter(rule => !rule.folderId)
        .map(rule => rule.id);
      setSelectedRuleIds(uncategorizedRuleIds);
    } else {
      // 通常のフォルダの場合
      const folderRuleIds = rules
        .filter(rule => rule.folderId === folderId)
        .map(rule => rule.id);
      setSelectedRuleIds(folderRuleIds);
    }
    
    // 複数選択モードに切り替える
    setIsBatchProcessing(true);
    
    // 単一選択をクリア
    setSelectedRuleId(null);
  };
  
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

  // フォルダ内の特定ルールを選択/解除するハンドラーを追加
  const toggleFolderRuleSelection = (ruleId: string) => {
    setSelectedRuleIds(prev => {
      if (prev.includes(ruleId)) {
        return prev.filter(id => id !== ruleId);
      } else {
        return [...prev, ruleId];
      }
    });
  };
  
  // フォルダ一覧を取得
  const loadFolders = async () => {
    setIsFoldersLoading(true);
    try {
      const folderList = await getFolders();
      setFolders(folderList);
      
      // 初期状態ですべてのフォルダを展開
      const expanded: Record<string, boolean> = {};
      folderList.forEach(folder => {
        expanded[folder.id] = true;
      });
      setExpandedFolders(expanded);
      setIsUncategorizedExpanded(true);
    } catch (error) {
      console.error('フォルダの取得に失敗しました:', error);
      toast.error('フォルダの読み込みに失敗しました');
    } finally {
      setIsFoldersLoading(false);
    }
  };

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

  // ファイルアップロード処理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setCurrentFile(file);
      setError(null);

      try {
        const { sheets, workbook } = await readExcelFile(file);
        setExcelData({ workbook, sheets });
        
        // シートが1つの場合は自動選択
        if (sheets && sheets.length === 1) {
          setSelectedSheet(sheets[0].name);
        } else if (sheets && sheets.length > 0) {
          // シートがある場合は最初のシートを選択
          setSelectedSheet(sheets[0].name);
        }
        
        // フォルダ一覧を読み込む
        await loadFolders();
        
        setProcessingStep('selectRule');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
        setCurrentFile(null);
      }
    }
  };

  // 一括処理関数
  const handleBatchProcess = async () => {
    if (!currentFile || selectedRuleIds.length === 0 || !excelData) {
      setError('ファイルとルールを選択してください');
      return;
    }

    setIsBatchProcessing(true);
    setIsProcessing(true);
    setError(null);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: selectedRuleIds.length });

    try {
      const results: ProcessingResult[] = [];
      
      // シートが選択されていない場合、最初のシートを使用
      const sheetToUse = selectedSheet || (excelData.workbook.SheetNames.length > 0 ? excelData.workbook.SheetNames[0] : '');
      
      // 選択されたルールを順番に処理
      for (let i = 0; i < selectedRuleIds.length; i++) {
        const ruleId = selectedRuleIds[i];
        const selectedRule = rules.find(rule => rule.id === ruleId);
        
        if (!selectedRule) {
          console.warn(`ルールID ${ruleId} が見つかりません`);
          continue;
        }
        
        setBatchProgress({ current: i + 1, total: selectedRuleIds.length });
        console.log(`ルール処理中 (${i + 1}/${selectedRuleIds.length}): ${selectedRule.name}`);
        
        try {
          const processedResult = await processExcelFile(
            currentFile, 
            excelData.workbook, 
            selectedRule,
            sheetToUse
          );
          
          if (processedResult.success) {
            // 各ルールの結果を記録
            addProcessedFile({
              id: processedResult.fileId,
              name: currentFile.name,
              processedAt: new Date().toISOString(),
              ruleId: ruleId,
              ruleName: selectedRule.name,
              recordsGenerated: processedResult.records.length
            });
            
            addProcessingResult(processedResult);
            results.push(processedResult);
          } else {
            console.error(`ルール "${selectedRule.name}" の処理中にエラー:`, processedResult.errorMessage);
            results.push(processedResult);
          }
        } catch (err) {
          console.error(`ルール "${selectedRule.name}" の処理中に例外:`, err);
        }
      }
      
      setBatchResults(results);
      setProcessingStep('batchResults');
    } catch (err) {
      setError(err instanceof Error ? err.message : '一括処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      setIsBatchProcessing(false);
    }
  };

  // ファイル処理
  const handleProcessFile = async () => {
    if (!currentFile || !selectedRuleId || !excelData) {
      setError('ファイルとルールを選択してください');
      return;
    }

    const selectedRule = rules.find(rule => rule.id === selectedRuleId);
    if (!selectedRule) {
      setError('選択されたルールが見つかりません');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('選択されたシート名:', selectedSheet);
      console.log('ルールのシート設定:', selectedRule.sheetRules.map(r => ({ name: r.name, index: r.sheetIndex })));
      console.log('ワークブックのシート名一覧:', excelData.workbook.SheetNames);
      
      // シートが選択されていない場合、最初のシートを使用
      const sheetToUse = selectedSheet || (excelData.workbook.SheetNames.length > 0 ? excelData.workbook.SheetNames[0] : '');
      console.log('使用するシート:', sheetToUse);
      
      const processedResult = await processExcelFile(
        currentFile, 
        excelData.workbook, 
        selectedRule,
        sheetToUse // 必ず値が存在するシート名を渡す
      );
      
      if (processedResult.success) {
        addProcessedFile({
          id: processedResult.fileId,
          name: currentFile.name,
          processedAt: new Date().toISOString(),
          ruleId: selectedRuleId,
          ruleName: selectedRule.name,
          recordsGenerated: processedResult.records.length
        });
        
        addProcessingResult(processedResult);
        setResult(processedResult);
        setProcessingStep('results');
      } else {
        setError(processedResult.errorMessage || '処理中にエラーが発生しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  // リセット
  const handleReset = () => {
    setCurrentFile(null);
    setSelectedRuleId(null);
    setResult(null);
    setError(null);
    setExcelData(null);
    setSelectedSheet(null);
    setProcessingStep('upload');
  };

  // ルール管理画面への遷移（フォルダ指定なし）
  const navigateToRules = () => {
    navigate('/rules');
  };
  
  // ルール管理画面への遷移（フォルダ指定あり）
  const navigateToRulesWithFolder = (folderId: string) => {
    navigate(`/rules?folder=${folderId}`);
  };

  // 一括処理結果の表示
  const renderBatchResults = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">一括処理結果</h2>
          <span className="text-sm text-gray-600">
            処理済みファイル: {currentFile?.name}
          </span>
        </div>
      
        <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700">
              {batchResults.length}個のルールによる処理が完了しました。合計{batchResults.reduce((sum, r) => sum + r.records.length, 0)}レコードが生成されました。
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {batchResults.map((result, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-medium text-gray-900">ルール: {result.ruleName}</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">
                  生成レコード数: <span className="font-semibold">{result.records.length}</span>
                </p>
                <button
                  className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 text-sm"
                  onClick={() => {
                    setResult(result);
                    setProcessingStep('results');
                  }}
                >
                  <ExternalLink size={16} className="mr-1" />
                  詳細を表示
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between">
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            onClick={handleReset}
          >
            新しいファイルを処理
          </button>
          <div className="flex space-x-2">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
              onClick={() => {
                // すべての結果を1つのJSONとしてダウンロード
                const allRecords = batchResults.flatMap(result => result.records);
                const dataStr = JSON.stringify(allRecords, null, 2);
                const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
                
                const downloadLink = document.createElement('a');
                downloadLink.setAttribute('href', dataUri);
                downloadLink.setAttribute('download', `batch_results_${new Date().toISOString().slice(0, 10)}.json`);
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              JSONでダウンロード
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
              onClick={() => {
                // すべての結果を1つのCSVとしてダウンロード
                const allRecords = batchResults.flatMap(result => result.records);
                
                if (allRecords.length === 0) return;
                
                // 全レコードのフィールドを収集
                const allFields = new Set<string>();
                allRecords.forEach(record => {
                  Object.keys(record).forEach(key => allFields.add(key));
                });
                const fields = Array.from(allFields);
                
                // Create CSV header
                let csvContent = fields.join(',') + '\n';
                
                // Add rows
                allRecords.forEach(record => {
                  const row = fields.map(field => {
                    const value = record[field];
                    // Handle values that need quoting (strings with commas, quotes, etc.)
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                      return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value || '';
                  });
                  csvContent += row.join(',') + '\n';
                });
                
                const dataBlob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(dataBlob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `batch_results_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              CSVでダウンロード
            </button>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
              onClick={() => {
                // すべての結果を1つのExcelとしてダウンロード
                const allRecords = batchResults.flatMap(result => result.records);
                
                if (allRecords.length === 0) return;
                
                // Create workbook and worksheet
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(allRecords);
                
                // Add worksheet to workbook
                XLSX.utils.book_append_sheet(wb, ws, 'Data');
                
                // Generate Excel file and trigger download
                XLSX.writeFile(wb, `batch_results_${new Date().toISOString().slice(0, 10)}.xlsx`);
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Excelでダウンロード
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ステップごとの表示内容を修正して一括処理を追加
  const renderStepContent = () => {
    switch (processingStep) {
      case 'upload':
        return (
          <div className="text-center p-8 bg-white rounded-lg shadow">
            <FileUp className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Excelファイルをアップロード</h2>
            <p className="text-gray-600 mb-6">
              処理したいExcelファイル（.xlsx）を選択してください
            </p>
            <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
              ファイルを選択
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx,.xls" 
                onChange={handleFileUpload}
              />
            </label>
          </div>
        );
        
      case 'selectRule':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">処理するルールの選択</h2>
            
            {excelData && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  シートの選択
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={selectedSheet || ''}
                  onChange={e => setSelectedSheet(e.target.value)}
                >
                  {excelData?.workbook.SheetNames.map(sheetName => (
                    <option key={sheetName} value={sheetName}>
                      {sheetName}
                    </option>
                  ))}
                </select>
                
                {/* シートプレビューを追加 */}
                {selectedSheet && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">シートプレビュー: <span className="text-gray-500">{selectedSheet}</span></h3>
                    <div className="border rounded overflow-auto" style={{ maxHeight: '300px' }}>
                      <SheetPreview
                        workbook={excelData.workbook}
                        sheetName={selectedSheet}
                        onSelectCell={(row, col) => {
                          console.log(`セル選択: ${row}, ${col}`);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {rules.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md">
                <Settings className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-4">ルールが作成されていません</p>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={() => {
                    // ルール管理画面への遷移処理
                  }}
                >
                  ルールを作成
                </button>
              </div>
            ) : (
              <div>
                {/* バッチ処理モード切り替え */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">ルール一覧</h3>
                  <div className="flex items-center">
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={isBatchProcessing}
                        onChange={(e) => {
                          setIsBatchProcessing(e.target.checked);
                          // バッチモードをオフにしたらフォルダ選択解除
                          if (!e.target.checked) {
                            setSelectedFolderId(null);
                          }
                        }}
                      />
                      複数ルールを選択
                    </label>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* フォルダリスト（左側） */}
                  <div className="md:col-span-2 border rounded-md p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-gray-600">フォルダ</h3>
                      </div>
                      
                      {/* ローディング表示 */}
                      {isFoldersLoading && (
                        <div className="text-center py-2 text-sm text-gray-500">
                          読み込み中...
                        </div>
                      )}
                      
                      {/* 未分類フォルダ（常に表示） */}
                      <div className="space-y-0.5">
                        <div 
                          className={`flex items-center py-1 px-2 rounded-md cursor-pointer ${
                            selectedFolderId === null && selectedRuleIds.length > 0 ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleSelectFolder(null)}
                        >
                          <Folder size={16} className="mr-2 text-gray-400" />
                          <span className="flex-1">未分類</span>
                          <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 mr-2">
                            {folderRuleCounts['uncategorized'] || 0}
                          </span>
                          <button 
                            className="p-1 text-gray-400 hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              // ルール管理画面へ遷移（未分類を表示）
                              navigateToRules();
                            }}
                            title="ルール管理"
                          >
                            <Settings size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* フォルダ一覧 */}
                      <div className="space-y-1">
                        {folders.map(folder => (
                          <div key={folder.id} className="space-y-0.5">
                            <div 
                              className={`flex items-center py-1 px-2 rounded-md cursor-pointer ${
                                selectedFolderId === folder.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
                              }`}
                              onClick={() => handleSelectFolder(folder.id)}
                            >
                              <Folder size={16} className="mr-2" style={{ color: folder.color }} />
                              <div className="flex-1">
                                <div className="font-medium">{folder.name}</div>
                                {folder.description && (
                                  <div className="text-xs text-gray-500 truncate">{folder.description}</div>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 mr-2">
                                {folderRuleCounts[folder.id] || 0}
                              </span>
                              <button 
                                className="p-1 text-gray-400 hover:text-blue-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // ルール管理画面へ遷移（該当フォルダを表示）
                                  navigateToRulesWithFolder(folder.id);
                                }}
                                title="ルール管理"
                              >
                                <Settings size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* ルール一覧（右側） */}
                  <div className="md:col-span-3 space-y-4">
                    {selectedFolderId !== null ? (
                      // フォルダが選択されている場合、そのフォルダ内のルールを表示
                      <>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-2">
                          <p className="text-sm text-blue-700">
                            <Folder size={16} className="inline mr-1" style={{ color: folders.find(f => f.id === selectedFolderId)?.color }} />
                            <span className="font-medium">{folders.find(f => f.id === selectedFolderId)?.name || '未分類'}</span> フォルダの
                            <span className="font-medium">{selectedRuleIds.length}個</span>のルールを適用します
                            {folderRules[selectedFolderId || 'uncategorized']?.length > selectedRuleIds.length && (
                              <span className="text-xs ml-1">（{folderRules[selectedFolderId || 'uncategorized']?.length - selectedRuleIds.length}個除外）</span>
                            )}
                          </p>
                        </div>
                        {(selectedFolderId === null ? folderRules.uncategorized : folderRules[selectedFolderId])?.map(rule => (
                          <div 
                            key={rule.id}
                            className={`p-4 border rounded-md ${
                              selectedRuleIds.includes(rule.id)
                                ? 'border-blue-300 bg-blue-50' 
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900">{rule.name}</h3>
                                <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                              </div>
                              <div className="flex items-center justify-center ml-4">
                                <input
                                  type="checkbox"
                                  checked={selectedRuleIds.includes(rule.id)}
                                  onChange={() => toggleFolderRuleSelection(rule.id)}
                                  className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className="flex items-center mt-3 text-xs text-gray-500">
                              <span className="mr-3">シート数: {rule.sheetRules.length}</span>
                              <span>フィールド数: {rule.sheetRules.reduce((sum, sheet) => sum + sheet.mappingRules.length, 0)}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      // 通常のルール一覧表示
                      rules.map(rule => (
                        <div 
                          key={rule.id}
                          className={`p-4 border rounded-md cursor-pointer ${
                            isBatchProcessing
                              ? selectedRuleIds.includes(rule.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                              : selectedRuleId === rule.id 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-blue-300'
                          }`}
                          onClick={() => handleSelectRule(rule.id, isBatchProcessing)}
                        >
                          <div className="flex justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900">{rule.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                            </div>
                            {isBatchProcessing ? (
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRuleIds.includes(rule.id)}
                                  onChange={() => handleSelectRule(rule.id, true)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-5 w-5 text-blue-600 focus:ring-blue-500"
                                />
                              </div>
                            ) : (
                              selectedRuleId === rule.id && (
                                <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )
                            )}
                          </div>
                          <div className="flex items-center mt-3 text-xs text-gray-500">
                            <span className="mr-3">シート数: {rule.sheetRules.length}</span>
                            <span>フィールド数: {rule.sheetRules.reduce((sum, sheet) => sum + sheet.mappingRules.length, 0)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between mt-6">
              <button
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                onClick={handleReset}
              >
                戻る
              </button>
              {isBatchProcessing ? (
                // 一括実行ボタン
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
                  onClick={() => setProcessingStep('process')}
                  disabled={selectedRuleIds.length === 0 || !selectedSheet}
                >
                  {selectedRuleIds.length}件のルールを一括実行
                </button>
              ) : (
                // 単一実行ボタン
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                  onClick={() => setProcessingStep('process')}
                  disabled={!selectedRuleId || !selectedSheet}
                >
                  次へ
                </button>
              )}
            </div>
          </div>
        );
        
      case 'process':
        if (isBatchProcessing) {
          // 一括処理用の処理確認画面
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">一括処理の実行</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <h3 className="font-medium text-blue-800 mb-2">処理内容の確認</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <p className="text-sm text-gray-600">ファイル:</p>
                    <p className="font-medium">{currentFile?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">サイズ:</p>
                    <p className="font-medium">{currentFile ? `${(currentFile.size / 1024).toFixed(2)} KB` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">選択ルール数:</p>
                    <p className="font-medium">{selectedRuleIds.length} ルール</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">シート:</p>
                    <p className="font-medium">{selectedSheet}</p>
                  </div>
                </div>
              </div>
              
              {isProcessing && (
                <div className="mb-6">
                  <div className="h-2 bg-gray-200 rounded-full mb-2">
                    <div 
                      className="h-2 bg-blue-600 rounded-full" 
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-center text-gray-600">
                    処理中: {batchProgress.current} / {batchProgress.total} ルール
                  </p>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-6">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                    <div>
                      <p className="font-medium">エラー</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  onClick={() => setProcessingStep('selectRule')}
                  disabled={isProcessing}
                >
                  戻る
                </button>
                <button
                  className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 flex items-center ${
                    isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={handleBatchProcess}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      一括処理中...
                    </>
                  ) : (
                    <>
                      <FilePlus2 className="h-4 w-4 mr-1" />
                      一括処理開始
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        } else {
          // 単一ルール処理（既存の処理）
          const selectedRule = rules.find(rule => rule.id === selectedRuleId);
          
          return (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">ファイル処理</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <h3 className="font-medium text-blue-800 mb-2">処理内容の確認</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <p className="text-sm text-gray-600">ファイル:</p>
                    <p className="font-medium">{currentFile?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">サイズ:</p>
                    <p className="font-medium">{currentFile ? `${(currentFile.size / 1024).toFixed(2)} KB` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">選択ルール:</p>
                    <p className="font-medium">{selectedRule?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">ルール数:</p>
                    <p className="font-medium">
                      {selectedRule ? selectedRule.sheetRules.reduce((sum, sheet) => sum + sheet.mappingRules.length, 0) : 0} マッピングルール
                    </p>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-6">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                    <div>
                      <p className="font-medium">エラー</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between">
                <button
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  onClick={() => setProcessingStep('selectRule')}
                  disabled={isProcessing}
                >
                  戻る
                </button>
                <button
                  className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 flex items-center ${
                    isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  onClick={handleProcessFile}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      処理中...
                    </>
                  ) : (
                    <>
                      <FilePlus2 className="h-4 w-4 mr-1" />
                      処理開始
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        }
      
      case 'batchResults':
        return renderBatchResults();
        
      case 'results':
        return result && (
          <ResultsViewer 
            result={result} 
            onReset={handleReset} 
            onBackToBatchResults={
              // batchResultsが空でない場合のみ、一括処理結果に戻るボタンを表示
              batchResults.length > 0 
                ? () => setProcessingStep('batchResults') 
                : undefined
            }
          />
        );
        
      default:
        return null;
    }
  };

  const steps = [
    { name: 'アップロード', status: processingStep === 'upload' ? 'current' : 'complete' },
    { name: 'ルール選択', status: processingStep === 'selectRule' ? 'current' : processingStep === 'upload' ? 'upcoming' : 'complete' },
    { name: '処理', status: processingStep === 'process' ? 'current' : processingStep === 'results' ? 'complete' : 'upcoming' },
    { name: '結果', status: processingStep === 'results' ? 'current' : 'upcoming' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Excelファイル処理</h1>
      </div>
      
      {/* 進行状況 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.name}>
              {index > 0 && (
                <div 
                  className={`h-1 flex-1 ${
                    step.status === 'upcoming' ? 'bg-gray-200' : 'bg-blue-500'
                  }`} 
                />
              )}
              <div 
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step.status === 'upcoming' ? 'bg-gray-200 text-gray-600' : 
                  step.status === 'current' ? 'bg-blue-500 text-white' : 
                  'bg-blue-500 text-white'
                }`}
              >
                {step.status === 'complete' ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`h-1 flex-1 ${
                    steps[index + 1].status === 'upcoming' ? 'bg-gray-200' : 'bg-blue-500'
                  }`} 
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <div key={step.name} className="text-xs text-gray-600 text-center" style={{ width: '25%' }}>
              {step.name}
            </div>
          ))}
        </div>
      </div>
      
      {/* ステップ内容 */}
      {renderStepContent()}
    </div>
  );
};

export default FileProcessor;