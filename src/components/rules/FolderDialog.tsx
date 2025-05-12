import React, { useState, useEffect } from 'react';
import { Folder, X } from 'lucide-react';
import { RuleFolder } from '../../types';

interface FolderDialogProps {
  folder?: RuleFolder;
  isOpen: boolean;
  onClose: () => void;
  onSave: (folder: Omit<RuleFolder, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const FolderDialog: React.FC<FolderDialogProps> = ({
  folder,
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setDescription(folder.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [folder, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      ...(folder?.parentId && { parentId: folder.parentId })
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {folder ? 'フォルダを編集' : '新しいフォルダ'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
              フォルダ名
            </label>
            <input
              id="folderName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="フォルダ名を入力"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="folderDescription" className="block text-sm font-medium text-gray-700 mb-1">
              説明（オプション）
            </label>
            <textarea
              id="folderDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="フォルダの説明を入力"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {folder ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FolderDialog; 