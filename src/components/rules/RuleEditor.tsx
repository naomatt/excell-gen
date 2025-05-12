import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Plus, Trash2, HelpCircle, Table, FileSpreadsheet, Check, ChevronDown, ChevronRight, Edit, GripVertical } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { ExcelRule, SheetRule, MappingRule, Condition } from '../../types';
import SheetPreview from '../processor/SheetPreview';
import { readExcelFile } from '../../utils/excelProcessor';
import { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-hot-toast';

// 数値からExcel列のアルファベット表記へ変換する関数
const numberToColumnLetter = (num: number): string => {
  let letter = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter || 'A'; // 1以下の場合はAを返す
};

// アルファベット列表記から数値へ変換する関数
const columnLetterToNumber = (letter: string): number => {
  let num = 0;
  const letters = letter.toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    num = num * 26 + (letters.charCodeAt(i) - 64);
  }
  return num;
};

interface RuleEditorProps {
  rule: ExcelRule | null;
  onClose: () => void;
}

const RuleEditor: React.FC<RuleEditorProps> = ({ rule, onClose }): JSX.Element => {
  const { 
    addRule, updateRule, 
    ruleEditorFile, setRuleEditorFile, 
    lastSelectedSheet, setLastSelectedSheet,
    setRuleFileMapping 
  } = useAppContext();
  const [currentStep, setCurrentStep] = useState(1);
  
  // 新しく追加されたフィールドのインデックス（ハイライト表示用）
  const [newFieldIndex, setNewFieldIndex] = useState<number | null>(null);
  // 確定済みフィールドの状態を管理
  const [confirmedFields, setConfirmedFields] = useState<boolean[]>([]);
  // 展開されているフィールドの状態を管理
  const [expandedFields, setExpandedFields] = useState<boolean[]>([]);
  
  // ドラッグ&ドロップの状態管理
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  
  // セル範囲選択用の状態管理を追加
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStartCell, setRangeStartCell] = useState<{ row: number; col: number } | null>(null);
  const [rangeEndCell, setRangeEndCell] = useState<{ row: number; col: number } | null>(null);
  const [currentHoverCell, setCurrentHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [rangeSelectionMode, setRangeSelectionMode] = useState<'start' | 'end' | null>(null);
  
  // フィールド要素への参照を保持するためのrefオブジェクトの配列
  const fieldRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // エラー状態
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    headers?: string;
    mappings?: string;
    [key: string]: string | undefined;
  }>({});
  
  const [editedRule, setEditedRule] = useState<ExcelRule>(() => {
    if (rule) return { ...rule };
    
    return {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sheetRules: [{
        id: crypto.randomUUID(),
        name: 'シート1',
        sheetIndex: 0,
        mappingRules: []
      }]
    };
  });

  // Excelファイルのプレビュー用の状態
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false); // 全体プレビュー用（後で削除）

  // ヘッダー設定
  const [headers, setHeaders] = useState<Array<{
    name: string;
    sourceType: 'cell' | 'range' | 'formula' | 'direct';
    cell?: { row: number; column: number };
    range?: { startRow: number; startColumn: number; endRow: number; endColumn: number };
    formula?: string;
    directValue?: string;
    showPreview?: boolean;
    hasCell?: boolean;
    hasRange?: boolean;
    hasFormula?: boolean;
    targetField?: string;
  }>>([{ name: '', sourceType: 'cell', showPreview: false }]);

  // セル選択用の状態管理
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [showCellSelector, setShowCellSelector] = useState(false);

  // 既存ルールからロードした時の初期処理
  useEffect(() => {
    if (rule) {
      console.log("既存のルールを初期化:", JSON.stringify(rule, null, 2));
      
      // シートルールの初期化
      if (rule.sheetRules.length > 0) {
        const sheetRule = rule.sheetRules[0];
        console.log("シート名:", sheetRule.sheetName);
        console.log("マッピングルール数:", sheetRule.mappingRules.length);
        
        // マッピングルールからヘッダーを初期化
        const initialHeaders = sheetRule.mappingRules.map((mappingRule, index) => {
          // マッピングルールの詳細をログ出力
          console.log(`マッピングルール ${index + 1} の詳細:`, {
            name: mappingRule.name,
            sourceType: mappingRule.sourceType,
            directValue: mappingRule.direct_value,
            cell: mappingRule.cell,
            range: mappingRule.range,
            formula: mappingRule.formula,
            raw: mappingRule
          });

          // デバッグ情報の出力
          console.log(`=== デバッグ情報: ${mappingRule.name} ===`);
          console.log('1. sourceTypeの状態:', {
            currentSourceType: mappingRule.sourceType,
            hasDirectValue: mappingRule.direct_value !== undefined,
            hasCell: !!mappingRule.cell,
            hasRange: !!mappingRule.range,
            hasFormula: !!mappingRule.formula
          });

          // セル情報の出力
          if (mappingRule.cell) {
            const cellData = typeof mappingRule.cell === 'string' 
              ? JSON.parse(mappingRule.cell) 
              : mappingRule.cell;
            console.log('2. セル情報:', {
              cellName: `${numberToColumnLetter(cellData.column)}${cellData.row}`,
              cellData: cellData
            });
          }

          // 範囲情報の出力
          if (mappingRule.range) {
            const rangeData = typeof mappingRule.range === 'string'
              ? JSON.parse(mappingRule.range)
              : mappingRule.range;
            console.log('3. 範囲情報:', {
              rangeName: `${numberToColumnLetter(rangeData.startColumn)}${rangeData.startRow}:${numberToColumnLetter(rangeData.endColumn)}${rangeData.endRow}`,
              rangeData: rangeData
            });
          }

          // 直接入力値の出力
          if (mappingRule.direct_value !== undefined) {
            console.log('4. 直接入力値:', {
              directValue: mappingRule.direct_value
            });
          }

          // ヘッダーオブジェクトを作成
          const header: {
            name: string;
            sourceType: 'cell' | 'range' | 'formula' | 'direct';
            showPreview: boolean;
            hasCell: boolean;
            hasRange: boolean;
            hasFormula: boolean;
            directValue: string | undefined;
            cell: { row: number; column: number } | undefined;
            range: { startRow: number; startColumn: number; endRow: number; endColumn: number } | undefined;
            formula: string | undefined;
            defaultValue: string | number | undefined;
            conditions: Condition[] | undefined;
            targetField: string | undefined;
          } = {
            name: mappingRule.name,
            sourceType: 'direct',  // デフォルトを'direct'に設定
            showPreview: false,
            hasCell: false,
            hasRange: false,
            hasFormula: false,
            directValue: mappingRule.direct_value,
            cell: undefined,
            range: undefined,
            formula: undefined,
            defaultValue: mappingRule.defaultValue,
            conditions: mappingRule.conditions ? [...mappingRule.conditions] : undefined,
            targetField: mappingRule.targetField || mappingRule.name
          };

          // sourceTypeの決定
          if (mappingRule.direct_value !== undefined) {
            header.sourceType = 'direct';
          } else if (mappingRule.range) {
            header.sourceType = 'range';
          } else if (mappingRule.cell) {
            header.sourceType = 'cell';
          } else if (mappingRule.formula) {
            header.sourceType = 'formula';
          }

          // 最終的なヘッダー状態の出力
          console.log('5. 最終的なヘッダー状態:', {
            name: header.name,
            sourceType: header.sourceType,
            directValue: header.directValue,
            cell: header.cell ? `${numberToColumnLetter(header.cell.column)}${header.cell.row}` : undefined,
            range: header.range ? `${numberToColumnLetter(header.range.startColumn)}${header.range.startRow}:${numberToColumnLetter(header.range.endColumn)}${header.range.endRow}` : undefined
          });

          console.log(`=== デバッグ情報終了: ${mappingRule.name} ===\n`);

          // セル情報をコピー（rangeがない場合のみ）
          if (mappingRule.cell && !mappingRule.range) {
            try {
              // 文字列の場合はJSONとしてパース
              const cellData = typeof mappingRule.cell === 'string' 
                ? JSON.parse(mappingRule.cell) 
                : mappingRule.cell;
              
              header.cell = { 
                row: cellData.row,
                column: cellData.column
              };
              header.hasCell = true;
              header.sourceType = 'cell';
              console.log(`セル情報をコピー: ${mappingRule.name} → ${numberToColumnLetter(header.cell.column)}${header.cell.row}`);
            } catch (error) {
              console.error(`セル情報のパースに失敗: ${mappingRule.name}`, error);
            }
          }

          // 範囲情報をコピー
          if (mappingRule.range) {
            try {
              // 文字列の場合はJSONとしてパース
              const rangeData = typeof mappingRule.range === 'string'
                ? JSON.parse(mappingRule.range)
                : mappingRule.range;
              
              header.range = { 
                startRow: rangeData.startRow,
                startColumn: rangeData.startColumn,
                endRow: rangeData.endRow,
                endColumn: rangeData.endColumn
              };
              header.hasRange = true;
              header.sourceType = 'range';
              console.log(`範囲情報をコピー: ${mappingRule.name} → ${numberToColumnLetter(header.range.startColumn)}${header.range.startRow}:${numberToColumnLetter(header.range.endColumn)}${header.range.endRow}`);
            } catch (error) {
              console.error(`範囲情報のパースに失敗: ${mappingRule.name}`, error);
            }
          }

          return header;
        });

        console.log("初期化するヘッダー:", JSON.stringify(initialHeaders, null, 2));
        setHeaders(initialHeaders);
        
        // 確認済みフィールドと展開状態を設定
        setConfirmedFields(initialHeaders.map(() => true));
        setExpandedFields(initialHeaders.map(() => false));

        // 既存のファイルとシート情報がある場合は自動的に設定
        if (ruleEditorFile) {
          setExcelFile(ruleEditorFile);
          readExcelFile(ruleEditorFile).then(({ workbook: wb }) => {
            setWorkbook(wb);
            // 最後に選択されたシートがある場合はそれを使用、なければ最初のシートを使用
            const sheetToUse = lastSelectedSheet || wb.SheetNames[0];
            setSelectedSheet(sheetToUse);
            setShowPreview(true);
          }).catch(err => {
            console.error('Excelファイルの読み込みに失敗しました:', err);
          });
        }
      }
    } else {
      // 新規作成の場合はデフォルト値を設定
      setHeaders([{
        name: '',
        sourceType: 'cell',
        showPreview: false,
        hasCell: false,
        hasRange: false,
        hasFormula: false,
        directValue: undefined,
        targetField: undefined
      }]);
      setConfirmedFields([false]);
      setExpandedFields([true]);

      // 既存のファイルとシート情報がある場合は自動的に設定
      if (ruleEditorFile) {
        setExcelFile(ruleEditorFile);
        readExcelFile(ruleEditorFile).then(({ workbook: wb }) => {
          setWorkbook(wb);
          // 最後に選択されたシートがある場合はそれを使用、なければ最初のシートを使用
          const sheetToUse = lastSelectedSheet || wb.SheetNames[0];
          setSelectedSheet(sheetToUse);
          setShowPreview(true);
        }).catch(err => {
          console.error('Excelファイルの読み込みに失敗しました:', err);
        });
      }
    }
  }, [rule, ruleEditorFile, lastSelectedSheet]);

  // 保存されたファイルを読み込み
  useEffect(() => {
    // ルールが初期化されているか確認
    if (!rule) return;
    
    // 既存のヘッダーを確認してログに出力
    console.log("headers state:", headers.map(h => ({
      name: h.name,
      sourceType: h.sourceType,
      hasCell: !!h.cell,
      hasRange: !!h.range,
      hasFormula: !!h.formula,
      directValue: h.directValue
    })));
  }, [rule, headers]);

  // 編集モードで入ったときに、保存されたデータを確認するために追加
  useEffect(() => {
    if (rule && rule.sheetRules && rule.sheetRules.length > 0) {
      const sheetRule = rule.sheetRules[0];
      console.log("ルールの詳細情報:");
      console.log(`- シート名: ${sheetRule.name}`);
      console.log(`- マッピングルール数: ${sheetRule.mappingRules.length}`);
      
      // マッピングルールの詳細をログ出力
      sheetRule.mappingRules.forEach((mr, index) => {
        console.log(`マッピングルール ${index + 1}: ${mr.name} (${mr.sourceType})`);
        if (mr.sourceType === 'cell' && mr.cell) {
          console.log(`  - セル: ${numberToColumnLetter(mr.cell.column)}${mr.cell.row}`);
        } else if (mr.sourceType === 'range' && mr.range) {
          const rangeText = `${numberToColumnLetter(mr.range.startColumn)}${mr.range.startRow}:${numberToColumnLetter(mr.range.endColumn)}${mr.range.endRow}`;
          console.log(`  - 範囲: ${rangeText}`);
        } else if (mr.sourceType === 'formula') {
          console.log(`  - 数式: ${mr.formula || ''}`);
        } else if (mr.sourceType === 'direct') {
          console.log(`  - 直接入力値: "${mr.direct_value || ''}"`);
        }
      });
    }
  }, [rule]);

  // 選択されたセルの内容を取得する関数
  const getCellContent = (header: typeof headers[0]): string => {
    if (!workbook || !selectedSheet) return '';
    
    try {
      const sheet = workbook.Sheets[selectedSheet];
      if (!sheet) return '';
        
      // シートデータをJSON形式に変換
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: true,
      }) as any[][];
      
      console.log('getCellContent呼び出し時のheader:', header); // デバッグ用

      // 直接入力値の処理（優先度を上げる）
      if (header.sourceType === 'direct') {
        console.log(`直接入力値の処理開始: ${header.name}`, {
          directValue: header.directValue,
          sourceType: header.sourceType
        });
        
        if (header.directValue !== undefined) {
          console.log(`直接入力値を返却: ${header.name} → "${header.directValue}"`);
          return header.directValue;
        } else {
          console.log(`直接入力値が未設定: ${header.name}`);
          return '';
        }
      }

      // 範囲選択の場合
      if (header.range) {
        const { startRow, startColumn, endRow, endColumn } = header.range;
        console.log(`範囲選択の処理開始: ${header.name}`, {
          startRow,
          startColumn,
          endRow,
          endColumn,
          dataLength: data.length,
          firstRowLength: data[0]?.length
        });
        
        if (startRow > 0 && startColumn > 0 && endRow > 0 && endColumn > 0) {
          const values: string[] = [];
          for (let row = startRow - 1; row < endRow; row++) {
            if (row < data.length) {
              for (let col = startColumn - 1; col < endColumn; col++) {
                if (col < data[row].length) {
                  const value = data[row][col];
                  console.log(`範囲内のセル[${row + 1},${col + 1}]の取得値:`, value);
                  // 空欄も含めて値を追加
                  values.push(value !== undefined && value !== null ? String(value) : '');
                }
              }
            }
          }
          console.log(`${header.name}の範囲から取得した全ての値:`, values);
          // 空の配列の場合は空文字列を返す
          return values.length > 0 ? values.join(',') : '';
        }
      }
      // セル選択の場合
      else if (header.sourceType === 'cell' && header.cell) {
        const row = header.cell.row - 1;
        const col = header.cell.column - 1;
        if (row >= 0 && row < data.length && col >= 0 && col < data[row].length) {
          const value = data[row][col];
          console.log(`${header.name}のセル[${row + 1},${col + 1}]の取得値:`, value);
          return value !== undefined && value !== null ? String(value) : '';
        }
      }
      
      return '';
    } catch (error) {
      console.error('セル内容の取得に失敗:', error);
      return '';
    }
  };

  // 範囲選択セルの内容を表示形式で取得する
  const getRangeDisplay = (header: typeof headers[0]): string => {
    if (!header.range) return '';
    const { startRow, startColumn, endRow, endColumn } = header.range;
    return `${numberToColumnLetter(startColumn)}${startRow}:${numberToColumnLetter(endColumn)}${endRow}`;
  };

  // 入力元タイプによって表示内容を切り替える
  const renderInputSourceContent = (header: typeof headers[0], index: number) => {
    // 入力元が未選択の場合は何も表示しない
    if (!header.sourceType) {
      return (
        <div className="mt-4 p-2 bg-gray-50 border border-gray-200 rounded">
          <p className="text-sm text-gray-500 text-center">入力元を選択してください</p>
        </div>
      );
    }
    
    // 直接入力モード
    if (header.sourceType === 'direct') {
      console.log('直接入力モードのヘッダー:', {
        index,
        name: header.name,
        directValue: header.directValue,
        confirmed: confirmedFields[index]
      });

      return (
        <div className="mt-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              直接入力値
            </label>
            <input
              type="text"
              className={`w-full p-2 border rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${confirmedFields[index] ? 'bg-gray-100' : ''}`}
              value={header.directValue || ''}
              onChange={(e) => {
                if (!isFieldEditable(index)) return;
                console.log('直接入力値の変更:', {
                  index,
                  oldValue: header.directValue,
                  newValue: e.target.value
                });
                handleUpdateHeader(index, { directValue: e.target.value })
              }}
              placeholder="値を直接入力"
              disabled={!isFieldEditable(index)}
            />
          </div>
          {/* 直接入力値の表示（確定済みの場合） */}
          {confirmedFields[index] && (
            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center">
                <span className="text-xs text-gray-500 mr-2">入力値:</span>
                <span className="text-sm font-medium text-gray-800">{header.directValue !== undefined ? header.directValue : '(未入力)'}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // セル選択モード
    return (
      <div className="mt-4 border-t pt-4">
        {/* Excelファイルアップロード */}
        {!workbook && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4 text-center">
            <FileSpreadsheet className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 mb-2 text-sm">
              セルを視覚的に選択するには、Excelファイルをアップロードしてください
            </p>
            <label className={`inline-block px-3 py-1 ${
              isFieldEditable(index) 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-400 text-white cursor-not-allowed'
              } rounded-md text-sm`}>
              Excelファイルを選択
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={!isFieldEditable(index)}
              />
            </label>
          </div>
        )}

        {/* シート選択 */}
        {workbook && (
          <>
            <div className="mb-4">
              <div className="flex-1 mr-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  シートを選択
                </label>
                <select
                  className={`w-full p-2 border border-gray-300 rounded-md ${confirmedFields[index] ? 'bg-gray-100' : ''}`}
                  value={selectedSheet || ''}
                  onChange={(e) => {
                    if (!isFieldEditable(index)) return;
                    const newSheetName = e.target.value;
                    handleSheetChange(newSheetName);
                  }}
                  disabled={!isFieldEditable(index)}
                >
                  {workbook.SheetNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* セル選択タイプ */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">セル選択タイプ</label>
              <div className="flex space-x-4">
                <label className={`flex items-center ${!isFieldEditable(index) ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name={`cellType-${index}`}
                    checked={header.sourceType === 'cell' && !header.range}
                    onChange={() => {
                      if (!isFieldEditable(index)) return;
                      handleUpdateHeader(index, {
                        cell: { row: 1, column: 1 },
                        range: undefined,
                        sourceType: 'cell'
                      });
                    }}
                    className="mr-2"
                    disabled={!isFieldEditable(index)}
                  />
                  <span>単一セル</span>
                </label>
                <label className={`flex items-center ${!isFieldEditable(index) ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name={`cellType-${index}`}
                    checked={header.sourceType === 'range'}
                    onChange={() => {
                      if (!isFieldEditable(index)) return;
                      handleUpdateHeader(index, {
                        cell: undefined,
                        range: { startRow: 1, startColumn: 1, endRow: 2, endColumn: 2 },
                        sourceType: 'range'
                      });
                    }}
                    className="mr-2"
                    disabled={!isFieldEditable(index)}
                  />
                  <span>セル範囲</span>
                </label>
              </div>
            </div>

            {/* セル選択の直接入力フィールド */}
            {header.sourceType === 'cell' || header.sourceType === 'range' ? (
              <div className="mt-4 space-y-4">
                {header.sourceType === 'cell' && !header.range ? (
                  // 単一セルの場合
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">列</label>
                      <input
                        type="text"
                        className="w-full p-2 border rounded-md"
                        value={header.cell ? numberToColumnLetter(header.cell.column) : ''}
                        onChange={(e) => {
                          if (!isFieldEditable(index)) return;
                          const col = columnLetterToNumber(e.target.value);
                          if (col > 0) {
                            handleUpdateHeader(index, {
                              cell: { ...header.cell!, column: col }
                            });
                          }
                        }}
                        placeholder="例: A, B, C..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">行</label>
                      <input
                        type="number"
                        className="w-full p-2 border rounded-md"
                        value={header.cell?.row || ''}
                        onChange={(e) => {
                          if (!isFieldEditable(index)) return;
                          const row = parseInt(e.target.value);
                          if (row > 0) {
                            handleUpdateHeader(index, {
                              cell: { ...header.cell!, row }
                            });
                          }
                        }}
                        placeholder="例: 1, 2, 3..."
                      />
                    </div>
                  </div>
                ) : (
                  // セル範囲の場合
                  <div className="space-y-4">
                    {/* 開始位置の設定 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">開始位置</label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">列</label>
                          <input
                            type="text"
                            className="w-full p-2 border rounded-md"
                            value={header.range ? numberToColumnLetter(header.range.startColumn) : ''}
                            onChange={(e) => {
                              if (!isFieldEditable(index)) return;
                              const col = columnLetterToNumber(e.target.value);
                              if (col > 0) {
                                handleUpdateHeader(index, {
                                  range: { ...header.range!, startColumn: col }
                                });
                              }
                            }}
                            placeholder="例: A, B, C..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">行</label>
                          <input
                            type="number"
                            className="w-full p-2 border rounded-md"
                            value={header.range?.startRow || ''}
                            onChange={(e) => {
                              if (!isFieldEditable(index)) return;
                              const row = parseInt(e.target.value);
                              if (row > 0) {
                                handleUpdateHeader(index, {
                                  range: { ...header.range!, startRow: row }
                                });
                              }
                            }}
                            placeholder="例: 1, 2, 3..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">プレビューから選択</label>
                          <button
                            type="button"
                            className={`w-full px-3 py-2 text-sm rounded-md ${
                              rangeSelectionMode === 'start'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            onClick={() => {
                              if (!isFieldEditable(index)) return;
                              setRangeSelectionMode(rangeSelectionMode === 'start' ? null : 'start');
                            }}
                          >
                            開始位置を選択
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 終了位置の設定 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">終了位置</label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">列</label>
                          <input
                            type="text"
                            className="w-full p-2 border rounded-md"
                            value={header.range ? numberToColumnLetter(header.range.endColumn) : ''}
                            onChange={(e) => {
                              if (!isFieldEditable(index)) return;
                              const col = columnLetterToNumber(e.target.value);
                              if (col > 0) {
                                handleUpdateHeader(index, {
                                  range: { ...header.range!, endColumn: col }
                                });
                              }
                            }}
                            placeholder="例: A, B, C..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">行</label>
                          <input
                            type="number"
                            className="w-full p-2 border rounded-md"
                            value={header.range?.endRow || ''}
                            onChange={(e) => {
                              if (!isFieldEditable(index)) return;
                              const row = parseInt(e.target.value);
                              if (row > 0) {
                                handleUpdateHeader(index, {
                                  range: { ...header.range!, endRow: row }
                                });
                              }
                            }}
                            placeholder="例: 1, 2, 3..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">プレビューから選択</label>
                          <button
                            type="button"
                            className={`w-full px-3 py-2 text-sm rounded-md ${
                              rangeSelectionMode === 'end'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            onClick={() => {
                              if (!isFieldEditable(index)) return;
                              setRangeSelectionMode(rangeSelectionMode === 'end' ? null : 'end');
                            }}
                          >
                            終了位置を選択
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* シートプレビュー */}
            {workbook && selectedSheet && (
              <div className="mt-4">
                {/* 現在の選択内容の表示 */}
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">現在の選択内容</h4>
                  <div className="text-sm text-gray-600">
                    {header.sourceType === 'cell' && !header.range && header.cell ? (
                      <div>
                        <p>セル: {numberToColumnLetter(header.cell.column)}{header.cell.row}</p>
                        <p className="mt-1 text-blue-600">取得値: {getCellContent(header)}</p>
                      </div>
                    ) : header.range ? (
                      <div>
                        <p>範囲: {getRangeDisplay(header)}</p>
                        <p className="mt-1 text-blue-600">取得値: {getCellContent(header)}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500">セルまたは範囲を選択してください</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">シートプレビュー</h3>
                  {header.range && (
                    <p className="text-xs text-gray-500">
                      {rangeSelectionMode === 'start' ? '開始位置をクリック' :
                       rangeSelectionMode === 'end' ? '終了位置をクリック' :
                       '開始/終了位置を選択ボタンから選択'}
                    </p>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <SheetPreview
                    workbook={workbook}
                    sheetName={selectedSheet}
                    onSelectCell={(row, col) => {
                      if (!isFieldEditable(index)) return;
                      
                      if (header.sourceType === 'cell' && !header.range) {
                        // 単一セルの場合
                        handleUpdateHeader(index, {
                          cell: { row: row + 1, column: col + 1 }
                        });
                      } else if (header.sourceType === 'range') {
                        // セル範囲の場合
                        if (rangeSelectionMode === 'start') {
                          // 開始位置を設定
                          const currentRange = header.range || {
                            startRow: row + 1,
                            startColumn: col + 1,
                            endRow: row + 1,
                            endColumn: col + 1
                          };
                          
                          handleUpdateHeader(index, {
                            range: {
                              ...currentRange,
                              startRow: row + 1,
                              startColumn: col + 1
                            }
                          });
                          console.log(`開始位置を設定: ${numberToColumnLetter(col + 1)}${row + 1}`);
                          setRangeSelectionMode(null);
                        } else if (rangeSelectionMode === 'end') {
                          // 終了位置を設定
                          const currentRange = header.range || {
                            startRow: 1,
                            startColumn: 1,
                            endRow: row + 1,
                            endColumn: col + 1
                          };
                          
                          handleUpdateHeader(index, {
                            range: {
                              ...currentRange,
                              endRow: row + 1,
                              endColumn: col + 1
                            }
                          });
                          console.log(`終了位置を設定: ${numberToColumnLetter(col + 1)}${row + 1}`);
                          setRangeSelectionMode(null);
                        }
                      }
                    }}
                    selectedCells={
                      header.sourceType === 'cell' && !header.range && header.cell ? 
                        [{ row: header.cell.row - 1, col: header.cell.column - 1 }] : 
                      header.sourceType === 'range' && header.range ? 
                        [
                          { row: header.range.startRow - 1, col: header.range.startColumn - 1 },
                          { row: header.range.endRow - 1, col: header.range.endColumn - 1 }
                        ] : []
                    }
                  />
                </div>

                {/* フィールド確定ボタン */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => toggleFieldConfirmation(index)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      confirmedFields[index]
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } transition-colors duration-200`}
                  >
                    {confirmedFields[index] ? '編集する' : 'フィールドを確定する'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const validateStep = (step: number): boolean => {
    const newErrors: any = {};
    
    if (step === 1) {
      if (!editedRule.name.trim()) {
        newErrors.name = 'ルール名を入力してください';
      }
      if (!editedRule.description.trim()) {
        newErrors.description = 'ルールの説明を入力してください';
      }
    } else if (step === 2) {
      const emptyHeaders = headers.some(h => !h.name.trim());
      if (emptyHeaders) {
        newErrors.headers = 'すべてのヘッダー名を入力してください';
      }
      
      // 入力元が選択されていない場合
      const invalidSourceType = headers.some(h => !h.sourceType);
      if (invalidSourceType) {
        newErrors.headers = (newErrors.headers || '') + '\n入力元を選択してください';
      }
      
      // すべてのフィールドを確定させる
      if (confirmedFields.some(confirmed => !confirmed)) {
        const newConfirmedFields = [...confirmedFields];
        newConfirmedFields.fill(true);
        setConfirmedFields(newConfirmedFields);
        
        // すべてのフィールドを折りたたむ
        const newExpandedFields = [...expandedFields];
        newExpandedFields.fill(false);
        setExpandedFields(newExpandedFields);
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  // ヘッダーの追加
  const handleAddHeader = () => {
    const newIndex = headers.length;
    setHeaders([...headers, { name: '', sourceType: 'cell', cell: undefined, showPreview: false }]);
    setNewFieldIndex(newIndex);
    
    // 新しいフィールドは未確定状態で追加
    setConfirmedFields(prevFields => [...prevFields, false]);
    // 新しいフィールドは展開状態で追加
    setExpandedFields(prevFields => [...prevFields, true]);
    
    // ユーザーに新しいフィールドが追加されたことがわかるようにする
    setTimeout(() => {
      if (fieldRefs.current[newIndex]) {
        fieldRefs.current[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // 2秒後にハイライトを解除
      setTimeout(() => {
        setNewFieldIndex(null);
      }, 2000);
    }, 100);
  };

  // ヘッダーの削除
  const handleRemoveHeader = (index: number) => {
    if (headers.length > 1) {
      setHeaders(headers.filter((_, i) => i !== index));
      // 参照の配列も更新
      fieldRefs.current = fieldRefs.current.filter((_, i) => i !== index);
      // 確定状態の配列も更新
      setConfirmedFields(prevFields => prevFields.filter((_, i) => i !== index));
      // 展開状態の配列も更新
      setExpandedFields(prevFields => prevFields.filter((_, i) => i !== index));
    }
  };

  // ヘッダーの更新
  const handleUpdateHeader = (index: number, updates: Partial<{
    name: string;
    sourceType: 'cell' | 'range' | 'formula' | 'direct';
    cell?: { row: number; column: number };
    range?: { startRow: number; startColumn: number; endRow: number; endColumn: number };
    formula?: string;
    directValue?: string;
    showPreview?: boolean;
    hasCell?: boolean;
    hasRange?: boolean;
    hasFormula?: boolean;
    targetField?: string;
  }>) => {
    setHeaders(prevHeaders => {
      const newHeaders = [...prevHeaders];
      const currentHeader = newHeaders[index];

      // nameが更新された場合、targetFieldも同じ値に設定
      if (updates.name && !updates.targetField) {
        updates.targetField = updates.name;
      }

      // sourceTypeが更新された場合、関連するプロパティをリセット
      if (updates.sourceType) {
        if (updates.sourceType === 'cell') {
          updates.cell = currentHeader.cell || { row: 1, column: 1 };
          updates.range = undefined;
          updates.hasCell = true;
          updates.hasRange = false;
        } else if (updates.sourceType === 'range') {
          updates.cell = undefined;
          updates.range = currentHeader.range || { startRow: 1, startColumn: 1, endRow: 2, endColumn: 2 };
          updates.hasCell = false;
          updates.hasRange = true;
        } else if (updates.sourceType === 'direct') {
          updates.cell = undefined;
          updates.range = undefined;
          updates.hasCell = false;
          updates.hasRange = false;
        }
      }

      // 更新を適用
      newHeaders[index] = {
        ...currentHeader,
        ...updates
      };

      return newHeaders;
    });
  };

  // フィールドの確定/編集状態の切り替え
  const toggleFieldConfirmation = (index: number) => {
    setConfirmedFields(prevFields => {
      const newConfirmedFields = [...prevFields];
      newConfirmedFields[index] = !newConfirmedFields[index];
      
      // 確定するときは折りたたむ、編集モードに戻すときは展開する
      setExpandedFields(prevExpanded => {
        const newExpandedFields = [...prevExpanded];
        newExpandedFields[index] = !newConfirmedFields[index];
        return newExpandedFields;
      });
      
      return newConfirmedFields;
    });
  };

  // フィールドの展開/折りたたみの切り替え
  const toggleFieldExpansion = (index: number) => {
    setExpandedFields(prevFields => {
      const newExpandedFields = [...prevFields];
      newExpandedFields[index] = !newExpandedFields[index];
      return newExpandedFields;
    });
  };

  // フィールドが編集可能かどうかをチェック
  const isFieldEditable = (index: number) => {
    return confirmedFields.length > index ? !confirmedFields[index] : true;
  };

  // フィールドが有効かどうかをチェック（保存時のバリデーション用）
  const isFieldValid = (header: typeof headers[0]): boolean => {
    if (!header.name.trim()) return false;
    
    // sourceTypeが空か、必要な値が設定されていない場合は無効
    if (!header.sourceType) return false;
    
    if (header.sourceType === 'cell' && !header.cell) return false;
    if (header.sourceType === 'range' && !header.range) return false;
    if (header.sourceType === 'formula' && (!header.formula || !header.formula.trim())) return false;
    // directValueは空でも有効とする
    
    return true;
  };

  useEffect(() => {
    // 空のエフェクト（不要なコンソールログを削除）
  }, [headers]);

  // ドラッグ開始時の処理
  const handleDragStart = (index: number) => {
    setDraggedItem(index);
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
      // ヘッダー配列の更新
      const newHeaders = [...headers];
      const draggedItemContent = newHeaders[draggedItem];
      
      // ドラッグしたアイテムを削除
      newHeaders.splice(draggedItem, 1);
      // ドロップした位置に挿入
      newHeaders.splice(dragOverItem, 0, draggedItemContent);
      
      // 関連する状態も同様に更新
      const newConfirmedFields = [...confirmedFields];
      const draggedConfirmedState = newConfirmedFields[draggedItem];
      newConfirmedFields.splice(draggedItem, 1);
      newConfirmedFields.splice(dragOverItem, 0, draggedConfirmedState);
      
      const newExpandedFields = [...expandedFields];
      const draggedExpandedState = newExpandedFields[draggedItem];
      newExpandedFields.splice(draggedItem, 1);
      newExpandedFields.splice(dragOverItem, 0, draggedExpandedState);
      
      // 状態を更新
      setHeaders(newHeaders);
      setConfirmedFields(newConfirmedFields);
      setExpandedFields(newExpandedFields);
      
      // フィールド要素の参照も更新
      const newFieldRefs = [...fieldRefs.current];
      const draggedFieldRef = newFieldRefs[draggedItem];
      newFieldRefs.splice(draggedItem, 1);
      newFieldRefs.splice(dragOverItem, 0, draggedFieldRef);
      fieldRefs.current = newFieldRefs;
    }
    
    // ドラッグ状態をリセット
    setDraggedItem(null);
    setDragOverItem(null);
  };
  
  // ドラッグ終了時の処理
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // シート選択が変更された時の処理を更新
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    setLastSelectedSheet(sheetName); // コンテキストにも保存
    setShowPreview(true);
  };

  // ファイル選択時の処理を更新
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setExcelFile(file);
      setRuleEditorFile(file); // コンテキストにも保存
      
      readExcelFile(file).then(({ workbook: wb }) => {
        setWorkbook(wb);
        // 最後に選択されたシートがある場合はそれを使用、なければ最初のシートを使用
        const sheetToUse = lastSelectedSheet || wb.SheetNames[0];
        setSelectedSheet(sheetToUse);
        setLastSelectedSheet(sheetToUse);
        setShowPreview(true);
      }).catch(err => {
        console.error('Excelファイルの読み込みに失敗しました:', err);
      });
    }
  };

  // 範囲選択の状態をリセットする関数
  const resetRangeSelection = () => {
    setIsSelectingRange(false);
    setRangeSelectionMode(null);
    setRangeStartCell(null);
    setRangeEndCell(null);
    setCurrentHoverCell(null);
  };

  // 範囲選択を更新する関数
  const updateRangeSelection = (index: number, startRow: number, startCol: number, endRow: number, endCol: number) => {
    handleUpdateHeader(index, {
      range: {
        startRow: startRow + 1,
        startColumn: startCol + 1,
        endRow: endRow + 1,
        endColumn: endCol + 1
      }
    });
    resetRangeSelection();
  };

  // セル選択時の処理を更新
  const handleCellSelect = (row: number, column: number) => {
    if (selectedFieldIndex === null) return;

    const header = headers[selectedFieldIndex];
    if (!header) return;

    // セル情報を更新（rowとcolumnを1から始まる値に変換）
    const newCell = { row: row + 1, column: column + 1 };
    
    // セル情報が有効かチェック
    if (newCell.row && newCell.column && !isNaN(newCell.row) && !isNaN(newCell.column)) {
      handleUpdateHeader(selectedFieldIndex, {
        cell: newCell,
        hasCell: true,
        hasRange: false,
        sourceType: 'cell'
      });

      // デバッグ用のログ出力
      console.log('セル選択完了:', {
        field: header.name,
        row: newCell.row,
        column: newCell.column,
        cell: newCell
      });
    } else {
      console.warn(`警告: 無効なセル情報です (row: ${row}, column: ${column})`);
    }

    // セル選択状態をリセット
    setSelectedFieldIndex(null);
    setShowCellSelector(false);
  };

  // セル選択を開始
  const startCellSelection = (index: number) => {
    setSelectedFieldIndex(index);
    setShowCellSelector(true);
  };

  // ルールを保存する関数
  const handleSaveRule = async () => {
    if (!validateStep(2)) return;

    try {
      // マッピングルールの作成
      const mappingRules = headers.map(header => {
        console.log("保存するヘッダーデータ:", JSON.stringify(header, null, 2));
        
        const mappingRule: MappingRule = {
          id: crypto.randomUUID(),
          name: header.name,
          targetField: header.targetField || header.name,
          sourceType: header.sourceType,
          direct_value: header.sourceType === 'direct' ? header.directValue : undefined,
          formula: header.sourceType === 'formula' ? header.formula : undefined
        };

        // セルまたは範囲の設定
        if (header.sourceType === 'cell' || header.sourceType === 'range') {
          if (header.range) {
            mappingRule.range = {
              startRow: header.range.startRow,
              startColumn: header.range.startColumn,
              endRow: header.range.endRow,
              endColumn: header.range.endColumn
            };
            console.log(`範囲情報を保存: ${header.name} → ${JSON.stringify(mappingRule.range)}`);
          } else if (header.cell) {
            mappingRule.cell = {
              row: header.cell.row,
              column: header.cell.column
            };
            console.log(`セル情報を保存: ${header.name} → ${JSON.stringify(mappingRule.cell)}`);
          }
        }

        // 既存のルールから追加情報をコピー
        if (rule) {
          const existingRule = rule.sheetRules[0]?.mappingRules.find(mr => mr.name === header.name);
          if (existingRule) {
            console.log(`既存のルールから情報をコピー: ${header.name}`, existingRule);
            if (existingRule.defaultValue !== undefined) {
              mappingRule.defaultValue = existingRule.defaultValue;
            }
            if (existingRule.conditions) {
              mappingRule.conditions = JSON.parse(JSON.stringify(existingRule.conditions));
            }
          }
        }

        console.log("生成されたマッピングルール:", JSON.stringify(mappingRule, null, 2));
        return mappingRule;
      });

      console.log("保存するマッピングルール:", JSON.stringify(mappingRules, null, 2));

      // シートルールの作成
      const sheetRule: SheetRule = {
        id: crypto.randomUUID(),
        name: selectedSheet || '',
        sheetIndex: 0,
        sheetName: selectedSheet || '',
        mappingRules
      };

      console.log("保存するシートルール:", JSON.stringify(sheetRule, null, 2));

      // ルールの更新または新規作成
      let ruleId = '';
      if (rule) {
        const updatedRule = {
          ...rule,
          sheetRules: [sheetRule] // 既存のシートルールを上書き
        };
        console.log("更新するルール:", JSON.stringify(updatedRule, null, 2));
        await updateRule(rule.id, updatedRule);
        ruleId = rule.id;
      } else {
        const newRule: ExcelRule = {
          id: crypto.randomUUID(),
          name: editedRule.name,
          description: editedRule.description,
          sheetRules: [sheetRule],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        console.log("新規作成するルール:", JSON.stringify(newRule, null, 2));
        await addRule(newRule);
        ruleId = newRule.id;
      }

      // ファイルマッピングの保存
      if (excelFile) {
        setRuleFileMapping(ruleId, excelFile.name, selectedSheet || '');
      }

      toast.success('ルールを保存しました');
      onClose();
    } catch (error) {
      console.error('ルールの保存に失敗しました:', error);
      toast.error('ルールの保存に失敗しました');
    }
  };

  // ステップごとの表示内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ルール名</label>
                <input
                  type="text"
                  value={editedRule.name}
                  onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.name ? 'border-red-500' : ''
                  }`}
                  placeholder="ルール名を入力"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">説明</label>
                <textarea
                  value={editedRule.description}
                  onChange={(e) => setEditedRule({ ...editedRule, description: e.target.value })}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.description ? 'border-red-500' : ''
                  }`}
                  rows={3}
                  placeholder="ルールの説明を入力"
                />
                {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Excelファイル</label>
                <div className="mt-1 flex items-center space-x-4">
                  {!workbook && (
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  )}
                  {excelFile && (
                    <span className="text-sm text-gray-500">{excelFile.name}</span>
                  )}
                </div>
              </div>

              {workbook && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">シート選択</label>
                  <select
                    value={selectedSheet || ''}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    {workbook.SheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showPreview && workbook && selectedSheet && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">シートプレビュー</h3>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      閉じる
                    </button>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <SheetPreview
                      workbook={workbook}
                      sheetName={selectedSheet}
                      onSelectCell={(row, col) => {
                        // セル選択時の処理（必要に応じて実装）
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 次へボタンを追加 */}
            <div className="flex justify-end mt-6">
              <button
                onClick={handleNextStep}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                次へ
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">フィールド設定</h3>
              <button
                className="flex items-center text-blue-600 hover:text-blue-800"
                onClick={handleAddHeader}
              >
                <Plus size={16} className="mr-1" />
                フィールドを追加
              </button>
            </div>

            {errors.headers && (
              <p className="text-red-500 text-sm">{errors.headers}</p>
            )}

            <div className="space-y-4">
              {headers.map((header, index) => (
                <div 
                  key={index} 
                  ref={el => fieldRefs.current[index] = el}
                  className={`bg-gray-50 p-4 rounded-lg transition-all duration-300 ${
                    newFieldIndex === index 
                      ? 'border-2 border-blue-500 shadow-lg' 
                      : confirmedFields[index]
                        ? 'border border-green-200 bg-green-50'
                        : 'border border-gray-200'
                  } ${dragOverItem === index ? 'border-2 border-dashed border-blue-500 bg-blue-50' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center flex-1 mr-4">
                      {/* ドラッグハンドル */}
                      <div 
                        className="cursor-move mr-2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors duration-200"
                        title="ドラッグして順番を変更"
                      >
                        <GripVertical size={16} />
                      </div>
                      
                      {/* 展開/折りたたみボタン (確定済みの場合のみ表示) */}
                      {confirmedFields[index] && (
                        <button
                          onClick={() => toggleFieldExpansion(index)}
                          className="mr-2 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                        >
                          {expandedFields[index] ? (
                            <ChevronDown size={20} className="transform transition-transform duration-300" />
                          ) : (
                            <ChevronRight size={20} className="transform transition-transform duration-300" />
                          )}
                        </button>
                      )}
                      
                      <span className="mr-2 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        {confirmedFields[index] ? (
                          // 確定済みの場合はフィールド名と取得内容を表示
                          <div>
                            <div className="font-medium text-gray-800">
                              {header.name || '(未入力)'}
                            </div>
                            {/* 取得内容のプレビュー */}
                            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded">
                              <div className="text-xs text-gray-500 mb-1">取得内容:</div>
                              <div className="text-sm text-gray-700">
                                {header.sourceType === 'cell' && !header.range && header.cell ? (
                                  <div>
                                    <p>セル: {numberToColumnLetter(header.cell.column)}{header.cell.row}</p>
                                    <p className="mt-1 text-blue-600">取得値: {getCellContent(header)}</p>
                                  </div>
                                ) : header.range ? (
                                  <div>
                                    <p>範囲: {getRangeDisplay(header)}</p>
                                    <p className="mt-1 text-blue-600">取得値: {getCellContent(header)}</p>
                                  </div>
                                ) : header.sourceType === 'direct' ? (
                                  <div>
                                    <p>直接入力値: {header.directValue !== undefined ? header.directValue : '(未入力)'}</p>
                                  </div>
                                ) : (
                                  <p className="text-gray-500">入力方法を選択してください</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          // 未確定の場合はフィールド名入力欄を表示
                          <>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              フィールド名
                            </label>
                            <input
                              type="text"
                              className="w-full p-2 border rounded-md"
                              value={header.name}
                              onChange={(e) => handleUpdateHeader(index, { 
                                name: e.target.value,
                                targetField: e.target.value 
                              })}
                              placeholder="例: customer_name, price など"
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {/* 確定/編集ボタン */}
                      <button
                        className={`mr-2 p-1 rounded-md transition-colors duration-200 ${
                          confirmedFields[index]
                            ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                            : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        }`}
                        onClick={() => toggleFieldConfirmation(index)}
                        title={confirmedFields[index] ? "編集する" : "確定する"}
                      >
                        {confirmedFields[index] ? (
                          <Edit size={16} className="transform transition-transform duration-200 hover:scale-110" />
                        ) : (
                          <Check size={16} className="transform transition-transform duration-200 hover:scale-110" />
                        )}
                      </button>
                      
                      {/* 削除ボタン */}
                      {headers.length > 1 && (
                        <button
                          className="text-red-500 hover:text-red-700 transition-colors duration-200"
                          onClick={() => handleRemoveHeader(index)}
                        >
                          <Trash2 size={16} className="transform transition-transform duration-200 hover:scale-110" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* フィールドの詳細部分 - 未確定または展開されている場合に表示 */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out 
                      ${(!confirmedFields[index] || expandedFields[index]) 
                        ? 'max-h-[2000px] opacity-100' 
                        : 'max-h-0 opacity-0 py-0'
                      }`}
                  >
                    {(!confirmedFields[index] || expandedFields[index]) && (
                      <div className={`mt-2 transition-all duration-300 
                        ${confirmedFields[index] && expandedFields[index] ? 'opacity-90' : 'opacity-100'}`}>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            フィールド名
                          </label>
                          <input
                            type="text"
                            className="w-full p-2 border rounded-md"
                            value={header.name}
                            onChange={(e) => handleUpdateHeader(index, { 
                              name: e.target.value,
                              targetField: e.target.value 
                            })}
                            placeholder="例: customer_name, price など"
                          />
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            入力方法の選択
                          </label>
                          <select
                            className={`w-full p-2 border rounded-md ${confirmedFields[index] ? 'bg-gray-100' : ''}`}
                            value={header.sourceType}
                            onChange={(e) => {
                              if (!isFieldEditable(index)) return;
                              const newSourceType = e.target.value as 'cell' | 'range' | 'direct';
                              handleUpdateHeader(index, {
                                sourceType: newSourceType,
                                cell: newSourceType === 'cell' ? { row: 1, column: 1 } : undefined,
                                range: newSourceType === 'range' ? { startRow: 1, startColumn: 1, endRow: 2, endColumn: 2 } : undefined,
                                directValue: newSourceType === 'direct' ? '' : undefined
                              });
                            }}
                            disabled={!isFieldEditable(index)}
                          >
                            <option value="direct">直接入力</option>
                            <option value="cell">参照シートから選択</option>
                            <option value="range">セル範囲を選択</option>
                          </select>
                        </div>

                        {/* 入力方法の内容を表示 */}
                        {header.sourceType && renderInputSourceContent(header, index)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ルール確定ボタン */}
            <div className="mt-6 flex justify-end space-x-4">
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ルールを確定する
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          ルール管理に戻る
        </button>
      </div>
      {renderStepContent()}
    </div>
  );
};

export default RuleEditor;