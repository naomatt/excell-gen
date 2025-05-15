import React, { useState, useEffect } from 'react';
import { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import { getCellAddress } from '../../utils/excelProcessor';

interface SheetPreviewProps {
  workbook: WorkBook;
  sheetName: string;
  onSelectCell?: (row: number, col: number) => void;
  onCellMouseEnter?: (row: number, col: number) => void;
  onCellMouseUp?: () => void;
  selectedCells?: { row: number; col: number }[];
}

// スクロールバーを強制的に表示させるためのスタイル
const scrollbarStyles = `
  .force-scrollbar {
    overflow-x: auto !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: rgba(156, 163, 175, 0.7) rgba(229, 231, 235, 0.5);
  }
  .force-scrollbar::-webkit-scrollbar {
    width: 12px;
    height: 12px;
    display: block;
  }
  .force-scrollbar::-webkit-scrollbar-track {
    background: rgba(229, 231, 235, 0.5);
    border-radius: 6px;
  }
  .force-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.7);
    border-radius: 6px;
    border: 2px solid rgba(229, 231, 235, 0.5);
  }
  .force-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(107, 114, 128, 0.8);
  }
  .force-scrollbar::-webkit-scrollbar-corner {
    background: rgba(229, 231, 235, 0.5);
  }
`;

const SheetPreview: React.FC<SheetPreviewProps> = ({
  workbook,
  sheetName,
  onSelectCell,
  onCellMouseEnter,
  onCellMouseUp,
  selectedCells = []
}) => {
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: true,
        raw: false // 日付を自動的に変換
      }) as any[][];
      setPreviewData(data);
    }
  }, [workbook, sheetName]);

  // セルの値を適切な形式で表示する
  const formatCellValue = (value: any): string => {
    if (!value) return '';
    
    // 数値が日付の場合（Excelの日付は1900年1月1日からの経過日数）
    if (typeof value === 'number' && value > 25569) { // 1970年以降の日付
      try {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        }
      } catch (e) {
        // 日付変換に失敗した場合は元の値を返す
        return value.toString();
      }
    }
    
    return value.toString();
  };

  const isCellSelected = (row: number, col: number) => {
    if (selectedCells.length === 0) return false;
    if (selectedCells.length === 1) {
      return selectedCells[0].row === row && selectedCells[0].col === col;
    }
    // 範囲選択の場合
    const [start, end] = selectedCells;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  return (
    <>
      <style>{scrollbarStyles}</style>
      <div 
        className="force-scrollbar"
        style={{ 
          overflowX: 'scroll', 
          overflowY: 'scroll', 
          maxWidth: '100%', 
          minWidth: '100%',
          display: 'block',
          height: '400px',
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: '4px'
        }}
      >
        <table 
          className="border-collapse w-full" 
          style={{ 
            minWidth: previewData[0]?.length > 5 ? Math.max(800, previewData[0]?.length * 120) + 'px' : '100%'
          }}
        >
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="w-12 bg-gray-50 border border-gray-300 p-1 text-xs font-medium text-gray-700 sticky left-0 z-10"></th>
              {previewData[0]?.map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="w-24 min-w-[6rem] bg-gray-50 border border-gray-300 p-1 text-xs font-medium text-gray-700"
                >
                  {getCellAddress(0, colIndex).replace(/[0-9]/g, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="bg-gray-50 border border-gray-300 p-1 text-xs font-medium text-gray-700 text-center sticky left-0 z-10">
                  {rowIndex + 1}
                </td>
                {row.map((cell, colIndex) => (
                  <td
                    key={colIndex}
                    className={`border border-gray-300 p-1 text-sm ${
                      isCellSelected(rowIndex, colIndex)
                        ? 'bg-blue-100'
                        : hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                        ? 'bg-gray-100'
                        : 'bg-white'
                    }`}
                    onClick={() => onSelectCell?.(rowIndex, colIndex)}
                    onMouseEnter={() => {
                      setHoveredCell({ row: rowIndex, col: colIndex });
                      onCellMouseEnter?.(rowIndex, colIndex);
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                    onMouseUp={onCellMouseUp}
                  >
                    {formatCellValue(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default SheetPreview;