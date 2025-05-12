import { RuleFolder } from '../types';

const FOLDERS_KEY = 'rule_folders';

export const getFolders = (): RuleFolder[] => {
  const foldersJson = localStorage.getItem(FOLDERS_KEY);
  return foldersJson ? JSON.parse(foldersJson) : [];
};

export const addFolder = (folder: Omit<RuleFolder, 'id' | 'createdAt' | 'updatedAt'>): RuleFolder => {
  const folders = getFolders();
  const newFolder: RuleFolder = {
    ...folder,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  folders.push(newFolder);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  return newFolder;
};

export const updateFolder = (folder: RuleFolder): RuleFolder => {
  const folders = getFolders();
  const index = folders.findIndex(f => f.id === folder.id);
  
  if (index === -1) {
    throw new Error('Folder not found');
  }
  
  const updatedFolder = {
    ...folder,
    updatedAt: new Date().toISOString(),
  };
  
  folders[index] = updatedFolder;
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  return updatedFolder;
};

export const deleteFolder = (folderId: string): void => {
  const folders = getFolders();
  const updatedFolders = folders.filter(f => f.id !== folderId);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
}; 