import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Edit, Trash2, Plus } from 'lucide-react';
import { RuleFolder as RuleFolderType } from '../../types';

interface RuleFolderProps {
  folder: RuleFolderType;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (folder: RuleFolderType) => void;
  onDelete: (folder: RuleFolderType) => void;
  onAddRule: () => void;
  children: React.ReactNode;
}

const RuleFolder: React.FC<RuleFolderProps> = ({
  folder,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddRule,
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  
  // ドラッグ時の処理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  
  return (
    <div 
      className={`bg-white rounded-lg shadow mb-4 ${isDragOver ? 'ring-2 ring-blue-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={() => setIsDragOver(false)}
    >
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggle}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={20} className="text-gray-600" />
              ) : (
                <ChevronRight size={20} className="text-gray-600" />
              )}
            </button>
            <h3 className="text-lg font-semibold text-gray-900">{folder.name}</h3>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onAddRule()}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
              title="ルールを追加"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => onEdit(folder)}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
              title="フォルダを編集"
            >
              <Edit size={18} />
            </button>
            <button
              onClick={() => onDelete(folder)}
              className="p-2 text-gray-600 hover:text-red-600 transition-colors"
              title="フォルダを削除"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        {folder.description && (
          <p className="text-sm text-gray-600 mt-2 ml-8">{folder.description}</p>
        )}
      </div>
      {isExpanded && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default RuleFolder; 