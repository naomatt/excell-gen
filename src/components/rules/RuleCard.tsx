import React from 'react';
import { Edit, Trash2, Copy, Calendar, Info } from 'lucide-react';
import { Rule } from '../../types';

interface RuleCardProps {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, onEdit, onDelete }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
          {rule.description && (
            <p className="text-gray-600 mt-1">{rule.description}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(rule)}
            className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
            title="編集"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete(rule)}
            className="p-2 text-gray-600 hover:text-red-600 transition-colors"
            title="削除"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm text-gray-500">
        <Calendar size={14} className="mr-1" />
        <span>作成日: {new Date(rule.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

export default RuleCard; 