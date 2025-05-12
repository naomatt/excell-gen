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
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-green-50 border-b border-green-100">
        <div className="flex items-start">
          <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Processing Complete</h2>
            <p className="text-gray-600 mt-1">
              Successfully generated {result.records.length} records from {result.fileName}
            </p>
            <div className="flex items-center mt-3 text-sm">
              <span className="text-gray-600 mr-4">Rule: {result.ruleName}</span>
              <span className="text-gray-600">Processed: {new Date(result.processedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-100 p-3 flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              currentView === 'table' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setCurrentView('table')}
          >
            Table View
          </button>
          <button
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              currentView === 'json' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setCurrentView('json')}
          >
            JSON View
          </button>
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
            CSV
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            onClick={handleDownloadJson}
          >
            <Download size={16} className="mr-1" />
            JSON
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            onClick={handleDownloadExcel}
          >
            <Download size={16} className="mr-1" />
            Excel
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            onClick={onReset}
          >
            <RefreshCw size={16} className="mr-1" />
            Process Another
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-0">
        {result.records.length === 0 ? (
          <div className="text-center p-8">
            <p className="text-gray-600">No records were generated.</p>
          </div>
        ) : currentView === 'table' ? (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">#</th>
                  {fields.map(field => (
                    <th 
                      key={field}
                      className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                    >
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {result.records.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    {fields.map(field => (
                      <td key={field} className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                        {typeof record[field] === 'object' 
                          ? JSON.stringify(record[field]) 
                          : String(record[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4">
            <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto max-h-[500px] overflow-y-auto text-sm">
              {JSON.stringify(result.records, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-100 p-4 text-right">
        <p className="text-sm text-gray-600">
          Total Records: <span className="font-medium">{result.records.length}</span>
        </p>
      </div>
    </div>
  );
};

export default ResultsViewer;