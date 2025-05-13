import { RuleFolder } from '../types';
import { supabase } from '../lib/supabaseClient';

const FOLDERS_KEY = 'rule_folders';
const FOLDERS_TABLE = 'rule_folders';

// デバッグログユーティリティ
const logDebug = (message: string, data?: any) => {
  console.log(`[FolderService] ${message}`, data || '');
};

const logError = (message: string, error: any) => {
  console.error(`[FolderService] ${message}`, error);
  if (error) {
    if (error.code) console.error(`Error code: ${error.code}`);
    if (error.message) console.error(`Error message: ${error.message}`);
    if (error.details) console.error(`Error details: ${error.details}`);
    if (error.stack) console.error(`Error stack: ${error.stack}`);
  }
};

// クライアント側のモデルとサーバー側のモデルの変換
const toClientModel = (dbFolder: any): RuleFolder => {
  return {
    id: dbFolder.id,
    name: dbFolder.name,
    description: dbFolder.description || '', // DBのnull値を空文字に変換
    color: dbFolder.color || '#3b82f6',
    createdAt: dbFolder.created_at,
    updatedAt: dbFolder.updated_at
  };
};

const toDbModel = (folder: Omit<RuleFolder, 'id'>, id?: string) => {
  return {
    id: id || crypto.randomUUID(),
    name: folder.name,
    description: folder.description,
    color: folder.color,
    created_at: folder.createdAt,
    updated_at: folder.updatedAt
  };
};

// フォルダー一覧の取得 (Supabase + ローカルストレージフォールバック)
export const getFolders = async (): Promise<RuleFolder[]> => {
  logDebug('フォルダ一覧を取得します');
  try {
    // Supabaseからフォルダ一覧を取得
    const { data, error } = await supabase
      .from(FOLDERS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    logDebug(`${data?.length || 0}件のフォルダを取得しました`);
    
    // DBモデルからクライアントモデルに変換
    const folders = data.map(toClientModel);
    
    // データをローカルストレージにもキャッシュ
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    
    return folders;
  } catch (error) {
    logError('フォルダの取得に失敗しました', error);
    
    // エラー時はローカルストレージから取得
    logDebug('ローカルストレージからフォルダを取得します');
    const foldersJson = localStorage.getItem(FOLDERS_KEY);
    return foldersJson ? JSON.parse(foldersJson) : [];
  }
};

// フォルダの追加 (Supabase + ローカルストレージフォールバック)
export const addFolder = async (folder: Omit<RuleFolder, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleFolder> => {
  logDebug('フォルダを追加します', folder);
  
  const now = new Date().toISOString();
  const folderId = crypto.randomUUID();
  const newFolder: Omit<RuleFolder, 'id'> = {
    ...folder,
    createdAt: now,
    updatedAt: now,
  };
  
  try {
    // DBモデルに変換
    const dbFolder = toDbModel(newFolder, folderId);
    
    logDebug('Supabaseに送信するデータ:', dbFolder);
    
    // Supabaseにフォルダを追加
    const { data, error } = await supabase
      .from(FOLDERS_TABLE)
      .insert([dbFolder])
      .select()
      .single();

    if (error) throw error;
    
    logDebug('フォルダをSupabaseに保存しました', data);
    
    // DBモデルからクライアントモデルに変換
    const createdFolder = toClientModel(data);
    
    // ローカルストレージにも保存
    const localFolders = getLocalFolders();
    localFolders.push(createdFolder);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(localFolders));
    
    return createdFolder;
  } catch (error) {
    logError('Supabaseへのフォルダ保存に失敗しました', error);
    
    // ローカルストレージにのみ保存（一時的）
    const newLocalFolder: RuleFolder = {
      ...newFolder,
      id: folderId,
    };
    
    const localFolders = getLocalFolders();
    localFolders.push(newLocalFolder);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(localFolders));
    
    return newLocalFolder;
  }
};

// フォルダの更新 (Supabase + ローカルストレージフォールバック)
export const updateFolder = async (folder: RuleFolder): Promise<RuleFolder> => {
  logDebug('フォルダを更新します', folder);
  
  const updatedFolder = {
    ...folder,
    updatedAt: new Date().toISOString(),
  };
  
  try {
    // Supabaseのフォルダを更新
    const { data, error } = await supabase
      .from(FOLDERS_TABLE)
      .update({
        name: updatedFolder.name,
        description: updatedFolder.description,
        color: updatedFolder.color,
        updated_at: updatedFolder.updatedAt
      })
      .eq('id', folder.id)
      .select()
      .single();

    if (error) throw error;
    
    logDebug('フォルダをSupabaseで更新しました', data);
    
    // DBモデルからクライアントモデルに変換
    const result = toClientModel(data);
    
    // ローカルストレージも更新
    const localFolders = getLocalFolders();
    const index = localFolders.findIndex(f => f.id === folder.id);
    
    if (index !== -1) {
      localFolders[index] = result;
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(localFolders));
    }
    
    return result;
  } catch (error) {
    logError('Supabaseでのフォルダ更新に失敗しました', error);
    
    // ローカルストレージのみ更新
    const localFolders = getLocalFolders();
    const index = localFolders.findIndex(f => f.id === folder.id);
    
    if (index === -1) {
      throw new Error('Folder not found');
    }
    
    localFolders[index] = updatedFolder;
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(localFolders));
    
    return updatedFolder;
  }
};

// フォルダの削除 (Supabase + ローカルストレージフォールバック)
export const deleteFolder = async (folderId: string): Promise<boolean> => {
  logDebug(`フォルダを削除します: ID=${folderId}`);
  
  try {
    // Supabaseからフォルダを削除
    const { error } = await supabase
      .from(FOLDERS_TABLE)
      .delete()
      .eq('id', folderId);

    if (error) throw error;
    
    logDebug(`フォルダ(ID: ${folderId})をSupabaseから削除しました`);
    
    // ローカルストレージからも削除
    const localFolders = getLocalFolders();
    const updatedFolders = localFolders.filter(f => f.id !== folderId);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
    
    return true;
  } catch (error) {
    logError(`フォルダ(ID: ${folderId})の削除に失敗しました`, error);
    
    // ローカルストレージからのみ削除
    const localFolders = getLocalFolders();
    const updatedFolders = localFolders.filter(f => f.id !== folderId);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders));
    
    return false;
  }
};

// ローカルストレージからフォルダを取得（内部ヘルパー関数）
const getLocalFolders = (): RuleFolder[] => {
  const foldersJson = localStorage.getItem(FOLDERS_KEY);
  return foldersJson ? JSON.parse(foldersJson) : [];
}; 