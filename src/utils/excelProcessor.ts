import { read, utils, WorkBook, WorkSheet } from 'xlsx';
import { ExcelRule, ProcessingResult, GeneratedRecord, MappingRule, CellRange } from '../types';

interface SheetData {
  name: string;
  data: any[][];
}

export const readExcelFile = async (file: File): Promise<{
  sheets: SheetData[];
  workbook: WorkBook;
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        
        const sheets: SheetData[] = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const data = utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            blankrows: true,
          }) as any[][];
          
          return { name, data };
        });

        resolve({ sheets, workbook });
      } catch (error) {
        reject(new Error('Excelファイルの読み込みに失敗しました'));
      }
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込み中にエラーが発生しました'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const getCellAddress = (row: number, col: number): string => {
  const colStr = utils.encode_col(col);
  return `${colStr}${row + 1}`;
};

export const processExcelFile = async (
  file: File,
  workbook: WorkBook,
  rule: ExcelRule,
  selectedSheetName?: string
): Promise<ProcessingResult> => {
  const fileId = crypto.randomUUID();
  const records: GeneratedRecord[] = [];

  try {
    console.log('=== 処理開始 ===');
    console.log('ルール情報:', {
      ruleId: rule.id,
      ruleName: rule.name,
      sheetRulesCount: rule.sheetRules.length
    });

    for (const sheetRule of rule.sheetRules) {
      const sheetName = selectedSheetName || sheetRule.name;
      const sheetIndex = workbook.SheetNames.indexOf(sheetName);
      const sheet = workbook.Sheets[sheetName];
      
      console.log('\n=== シート処理開始 ===');
      console.log(`処理対象シート: ${sheetName}`);
      console.log(`シートインデックス: ${sheetIndex}`);
      console.log(`ルールのシート設定: ${sheetRule.name}`);
      console.log('マッピングルール数:', sheetRule.mappingRules.length);
      
      if (!sheet) {
        throw new Error(`シート "${sheetName}" が見つかりません`);
      }

      const sheetData = utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: true,
      }) as any[][];

      console.log('シートデータの行数:', sheetData.length);
      console.log('シートデータの最初の行:', sheetData[0]);

      // マッピングルールを範囲と定数に分類
      const cellRangeRules: MappingRule[] = [];
      const fixedValueRules: MappingRule[] = [];

      for (const rule of sheetRule.mappingRules) {
        // rangeが文字列の場合はパース
        let parsedRange: CellRange | undefined = undefined;
        if (typeof rule.range === 'string') {
          try {
            const parsed = JSON.parse(rule.range);
            if (parsed && typeof parsed === 'object') {
              parsedRange = {
                startRow: parsed.startRow,
                startColumn: parsed.startColumn,
                endRow: parsed.endRow,
                endColumn: parsed.endColumn
              };
            }
          } catch (e) {
            console.error('範囲データのパースに失敗:', e);
          }
        } else if (rule.range) {
          parsedRange = rule.range;
        }

        // sourceTypeが未設定の場合は、rangeまたはcellの存在から推測
        const sourceType = rule.sourceType || (parsedRange ? 'range' : (rule.cell ? 'cell' : 'direct'));

        console.log('\nルール詳細:', {
          name: rule.name,
          sourceType,
          hasRange: !!parsedRange,
          hasCell: !!rule.cell,
          range: parsedRange,
          cell: rule.cell,
          targetField: rule.targetField
        });

        if (parsedRange) {
          cellRangeRules.push({ ...rule, range: parsedRange, sourceType });
          console.log(`範囲ルール検出: ${rule.name}, 範囲: ${parsedRange.startRow}-${parsedRange.endRow}, ${parsedRange.startColumn}-${parsedRange.endColumn}`);
        } else {
          fixedValueRules.push({ ...rule, sourceType });
          console.log(`固定値ルール検出: ${rule.name}, タイプ: ${sourceType}`);
        }
      }

      console.log(`\n範囲ルール数: ${cellRangeRules.length}, 固定値ルール数: ${fixedValueRules.length}`);

      // 範囲ルールがない場合は単一レコードを生成
      if (cellRangeRules.length === 0) {
        console.log('\n=== 単一レコード生成開始 ===');
        const record: GeneratedRecord = {};
        
        for (const mappingRule of fixedValueRules) {
          let value: any = null;
          const targetField = mappingRule.targetField || mappingRule.name;

          if (mappingRule.sourceType === 'cell' && mappingRule.cell) {
            const { row, column } = mappingRule.cell;
            value = sheetData[row - 1]?.[column - 1] ?? mappingRule.defaultValue;
            console.log(`セル値取得: ${mappingRule.name} -> 行:${row}, 列:${column}, 値:${value}`);
          }
          else if (mappingRule.sourceType === 'direct') {
            value = mappingRule.directValue ?? mappingRule.defaultValue;
            console.log(`直接入力値取得: ${mappingRule.name} -> ${value}`);
          }
          else if (mappingRule.sourceType === 'formula' && mappingRule.formula) {
            value = mappingRule.formula;
            console.log(`数式取得: ${mappingRule.name} -> ${value}`);
          }
          
          if (value !== undefined && value !== null && value !== '') {
            record[targetField] = value;
          }
        }
        
        if (Object.keys(record).length > 0) {
          console.log('生成されたレコード:', record);
          records.push(record);
        }
      } 
      // 範囲ルールがある場合は複数レコードを生成
      else {
        console.log('\n=== 複数レコード生成開始 ===');
        // 各範囲ルールごとに行データを取得
        const rangeData: { [key: string]: any[] } = {};
        
        // すべての範囲ルールからデータを収集
        for (const rule of cellRangeRules) {
          const targetField = rule.targetField || rule.name;
          console.log('\nルール処理開始:', {
            name: rule.name,
            targetField,
            range: rule.range
          });

          if (rule.range) {
            const { startRow, startColumn, endRow, endColumn } = rule.range;
            const fieldData: any[] = [];
            
            console.log(`\n範囲データ収集開始: ${rule.name} (targetField: ${targetField})`);
            console.log(`範囲: ${startRow}:${endRow}, ${startColumn}:${endColumn}`);
            
            // 単一列の範囲
            if (startColumn === endColumn) {
              const colIndex = startColumn - 1;
              for (let row = startRow - 1; row < endRow; row++) {
                if (row < sheetData.length) {
                  const value = sheetData[row][colIndex] ?? null;
                  if (value !== undefined && value !== null && value !== '') {
                    fieldData.push(value);
                    console.log(`単一列データ取得: 行${row + 1}, 列${colIndex + 1} -> ${value}`);
                  }
                }
              }
            } 
            // 単一行の範囲
            else if (startRow === endRow) {
              const rowIndex = startRow - 1;
              if (rowIndex < sheetData.length) {
                for (let col = startColumn - 1; col < endColumn; col++) {
                  const value = sheetData[rowIndex][col];
                  // 空欄も含めて値を追加（undefined, null, 空文字列も保持）
                  fieldData.push(value);
                  console.log(`単一行データ取得: 行${rowIndex + 1}, 列${col + 1} -> ${value}`);
                }
              }
            }
            // 複数行×複数列の範囲
            else {
              for (let row = startRow - 1; row < endRow; row++) {
                if (row < sheetData.length) {
                  const rowValues = [];
                  for (let col = startColumn - 1; col < endColumn; col++) {
                    const value = sheetData[row][col];
                    // 空欄も含めて値を追加（undefined, null, 空文字列も保持）
                    rowValues.push(value);
                    console.log(`複数範囲データ取得: 行${row + 1}, 列${col + 1} -> ${value}`);
                  }
                  if (rowValues.length > 0) {
                    fieldData.push(rowValues);
                  }
                }
              }
            }
            
            if (fieldData.length > 0) {
              rangeData[targetField] = fieldData;
              console.log(`フィールド ${rule.name} の収集データ:`, fieldData);
              console.log(`rangeData の現在の状態:`, rangeData);
            } else {
              console.log(`警告: フィールド ${rule.name} のデータが空です`);
            }
          }
        }

        // 固定値ルールのデータも収集
        for (const rule of fixedValueRules) {
          const targetField = rule.targetField || rule.name;
          let value: any = null;

          if (rule.sourceType === 'cell' && rule.cell) {
            // セル情報が文字列の場合はJSONとしてパース
            let cellData = rule.cell;
            if (typeof cellData === 'string') {
              try {
                cellData = JSON.parse(cellData);
                console.log(`セル情報をパース: ${rule.name} ->`, cellData);
              } catch (e) {
                console.error(`セル情報のパースに失敗: ${rule.name}`, e);
              }
            }

            const { row, column } = cellData;
            if (row && column && !isNaN(row) && !isNaN(column)) {
              value = sheetData[row - 1]?.[column - 1] ?? rule.defaultValue;
              console.log(`固定値セル取得: ${rule.name} -> 行:${row}, 列:${column}, 値:${value}`);
            } else {
              console.warn(`警告: ${rule.name}のセル情報が不完全です (row: ${row}, column: ${column})`);
              // デフォルト値がある場合はそれを使用
              if (rule.defaultValue !== undefined) {
                value = rule.defaultValue;
                console.log(`デフォルト値を使用: ${rule.name} -> ${value}`);
              }
            }
          }
          else if (rule.sourceType === 'direct') {
            value = rule.directValue ?? rule.defaultValue;
            console.log(`直接入力値取得: ${rule.name} -> ${value}`);
          }
          else if (rule.sourceType === 'formula' && rule.formula) {
            value = rule.formula;
            console.log(`数式取得: ${rule.name} -> ${value}`);
          }

          if (value !== undefined && value !== null && value !== '') {
            // 範囲ルールの最大長を取得
            const maxRangeLength = Math.max(...Object.values(rangeData).map(arr => arr.length));
            if (maxRangeLength > 0) {
              // 固定値を範囲の長さ分だけ繰り返して配列を作成
              rangeData[targetField] = Array(maxRangeLength).fill(value);
              console.log(`固定値を範囲の長さ(${maxRangeLength})分だけ繰り返して追加: ${targetField} -> ${value}`);
            } else {
              rangeData[targetField] = [value];
              console.log(`固定値を追加: ${targetField} -> ${value}`);
            }
          }
        }

        // データが収集されたか確認
        if (Object.keys(rangeData).length === 0) {
          console.warn('警告: 有効なデータが収集されませんでした');
          continue;
        }

        // 各フィールドのデータ長を確認
        const dataLengths = Object.values(rangeData).map(arr => arr.length);
        console.log('各フィールドのデータ長:', dataLengths);
        console.log('rangeData の最終状態:', rangeData);

        // 最大のデータ長を取得
        const maxLength = Math.max(...dataLengths);
        if (maxLength === 0) {
          console.warn('警告: 有効なデータがありません');
          continue;
        }

        // レコードを生成
        for (let i = 0; i < maxLength; i++) {
          const record: GeneratedRecord = {};
          let hasValidData = false;

          // 各フィールドの値を取得
          for (const [field, values] of Object.entries(rangeData)) {
            const value = values[i];
            if (value !== undefined && value !== null && value !== '') {
              record[field] = value;
              hasValidData = true;
            }
          }

          // 有効なデータがある場合のみレコードを追加
          if (hasValidData) {
            console.log(`\nレコード ${i + 1} を追加:`, record);
            records.push(record);
          }
        }
      }
    }

    console.log('\n=== 処理完了 ===');
    console.log('生成されたレコード数:', records.length);
    return {
      fileId,
      fileName: file.name,
      ruleId: rule.id,
      ruleName: rule.name,
      processedAt: new Date().toISOString(),
      records,
      success: true
    };
  } catch (error) {
    console.error('処理中にエラーが発生:', error);
    return {
      fileId,
      fileName: file.name,
      ruleId: rule.id,
      ruleName: rule.name,
      processedAt: new Date().toISOString(),
      records: [],
      success: false,
      errorMessage: error instanceof Error ? error.message : '処理中にエラーが発生しました'
    };
  }
};