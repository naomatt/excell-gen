import React, { useState } from 'react';
import { Download, RefreshCw, CheckCircle, ExternalLink, ArrowLeft } from 'lucide-react';
import { ProcessingResult } from '../../types';
import * as XLSX from 'xlsx';

interface ResultsViewerProps {
  result: ProcessingResult;
  onReset: () => void;
  onBackToBatchResults?: () => void;
}

const ResultsViewer: React.FC<ResultsViewerProps> = ({ result, onReset, onBackToBatchResults }) => {
  const [currentView, setCurrentView] = useState<'table' | 'json'>('table');

  // Get all fields from records
  const fields = result.records.length > 0 
    ? Object.keys(result.records[0]) 
    : [];

  // Download results as JSON
  const handleDownloadJson = () => {
    const dataStr = JSON.stringify(result.records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.fileName.split('.')[0]}_processed.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download results as CSV
  const handleDownloadCsv = () => {
    if (result.records.length === 0) return;
    
    // Create CSV header
    let csvContent = fields.join(',') + '\n';
    
    // Add rows
    result.records.forEach(record => {
      const row = fields.map(field => {
        const value = record[field];
        // Handle values that need quoting (strings with commas, quotes, etc.)
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += row.join(',') + '\n';
    });
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.fileName.split('.')[0]}_processed.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download results as Excel
  const handleDownloadExcel = () => {
    if (result.records.length === 0) return;
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(result.records);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(wb, `${result.fileName.split('.')[0]}_processed.xlsx`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">処理結果</h2>
          <p className="text-sm text-gray-600 mt-1">
            {result.fileName} - {result.ruleName}
          </p>
        </div>
        <div className="flex items-center">
          <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <CheckCircle className="h-4 w-4 mr-1" />
            {result.records.length} レコード生成
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">ファイル名</p>
            <p className="font-medium">{result.fileName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">ルール名</p>
            <p className="font-medium">{result.ruleName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">処理日時</p>
            <p className="font-medium">{new Date(result.processedAt).toLocaleString('ja-JP')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">生成レコード数</p>
            <p className="font-medium">{result.records.length} 件</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">生成されたレコード</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {Object.keys(result.records[0] || {}).map((key) => (
                  <th
                    key={key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {result.records.map((record, index) => (
                <tr key={index}>
                  {Object.values(record).map((value, i) => (
                    <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {value === '' ? '（空欄）' : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex space-x-2">
        {onBackToBatchResults && (
          <button
            className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            onClick={onBackToBatchResults}
          >
            <ArrowLeft size={16} className="mr-1" />
            一括結果に戻る
          </button>
        )}
        <button
          className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          onClick={handleDownloadCsv}
        >
          <Download size={16} className="mr-1" />
          CSVダウンロード
        </button>
        <button
          className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          onClick={handleDownloadJson}
        >
          <Download size={16} className="mr-1" />
          JSONダウンロード
        </button>
        <button
          className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          onClick={handleDownloadExcel}
        >
          <Download size={16} className="mr-1" />
          Excelダウンロード
        </button>
        <button
          className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          onClick={onReset}
        >
          <RefreshCw size={16} className="mr-1" />
          新規処理
        </button>
      </div>
    </div>
  );
};

export default ResultsViewer;