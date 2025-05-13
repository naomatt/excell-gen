import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { ExcelRule, ProcessedFile, ProcessingResult } from '../types';
import { fetchRules, createRule, updateRule as updateSupabaseRule, deleteRule as deleteSupabaseRule } from '../services/ruleService';
import { toast } from 'react-hot-toast';

// デバッグログユーティリティ
const logDebug = (message: string, data?: any) => {
  console.log(`[AppContext] ${message}`, data || '');
};

const logError = (message: string, error: any) => {
  console.error(`[AppContext] ${message}`, error);
  if (error) {
    if (error.code) console.error(`Error code: ${error.code}`);
    if (error.message) console.error(`Error message: ${error.message}`);
    if (error.details) console.error(`Error details: ${error.details}`);
  }
};

// ファイル関連情報を格納するインターフェース
interface SavedFileInfo {
  name: string;
  lastModified: number;
  size: number;
  type: string;
  data?: ArrayBuffer; // 必要に応じてデータ本体も保存
}

// ルールとファイルの関連付けを格納するインターフェース
interface RuleFileMapping {
  ruleId: string;
  fileName: string;
  sheetName: string;
}

interface AppContextType {
  rules: ExcelRule[];
  addRule: (rule: ExcelRule) => Promise<boolean>;
  updateRule: (id: string, updatedRule: ExcelRule) => Promise<boolean>;
  deleteRule: (id: string) => Promise<boolean>;
  recentFiles: ProcessedFile[];
  addProcessedFile: (file: ProcessedFile) => void;
  processingResults: ProcessingResult[];
  addProcessingResult: (result: ProcessingResult) => void;
  getProcessingResult: (fileId: string) => ProcessingResult | undefined;
  currentFile: File | null;
  setCurrentFile: (file: File | null) => void;
  selectedRuleId: string | null;
  setSelectedRuleId: (id: string | null) => void;
  ruleEditorFile: File | null;
  setRuleEditorFile: (file: File | null) => void;
  clearRuleEditorFile: () => void;
  lastSelectedSheet: string | null;
  setLastSelectedSheet: (sheetName: string) => void;
  // 新しい関数: ルールとファイル・シートの関連付け
  setRuleFileMapping: (ruleId: string, fileName: string, sheetName: string) => void;
  copyRuleWithFileMapping: (sourceRuleId: string, targetRuleId: string) => void;
  isLoading: boolean;
  error: string | null;
  refreshRules: () => Promise<void>;
  syncToServer: () => Promise<void>; // データを手動でサーバーと同期する
  isOnline: boolean; // オンライン状態
}

// Base64変換ユーティリティ
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// ローカルストレージのユーティリティ関数
function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    logDebug(`データをローカルストレージに保存しました: ${key}`);
  } catch (error) {
    logError(`ローカルストレージへの保存に失敗しました: ${key}`, error);
  }
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const jsonData = localStorage.getItem(key);
    if (!jsonData) return defaultValue;
    return JSON.parse(jsonData) as T;
  } catch (error) {
    logError(`ローカルストレージからの読み込みに失敗しました: ${key}`, error);
    return defaultValue;
  }
}

// ファイル情報を保存
function saveFileInfo(file: File): void {
  if (!file) return;
  
  const fileReader = new FileReader();
  fileReader.onload = () => {
    const savedFileInfo: SavedFileInfo = {
      name: file.name,
      lastModified: file.lastModified,
      size: file.size,
      type: file.type,
      data: fileReader.result as ArrayBuffer
    };
    
    try {
      // ファイル名を保存
      localStorage.setItem('ruleEditorFileName', file.name);
      // ファイルデータをBase64で保存
      localStorage.setItem('ruleEditorFileData', arrayBufferToBase64(fileReader.result as ArrayBuffer));
      // ファイルメタデータを保存
      localStorage.setItem('ruleEditorFileInfo', JSON.stringify({
        name: file.name,
        lastModified: file.lastModified,
        size: file.size,
        type: file.type
      }));
      
      logDebug('ファイル情報を保存しました', file.name);
    } catch (error) {
      logError('ファイル情報の保存に失敗しました:', error);
    }
  };
  
  fileReader.onerror = () => {
    logError('ファイルの読み込みに失敗しました', fileReader.error);
  };
  
  fileReader.readAsArrayBuffer(file);
}

// ファイル情報を読み込み
function loadSavedFile(): File | null {
  try {
    const fileName = localStorage.getItem('ruleEditorFileName');
    const fileInfoStr = localStorage.getItem('ruleEditorFileInfo');
    const fileDataBase64 = localStorage.getItem('ruleEditorFileData');
    
    if (!fileName || !fileInfoStr || !fileDataBase64) {
      logDebug('保存されたファイル情報がありません');
      return null;
    }
    
    const fileInfo = JSON.parse(fileInfoStr) as SavedFileInfo;
    const fileData = base64ToArrayBuffer(fileDataBase64);
    
    // Fileオブジェクトを再構築
    const file = new File([fileData], fileInfo.name, {
      type: fileInfo.type,
      lastModified: fileInfo.lastModified
    });
    
    logDebug('保存されたファイルを読み込みました', file.name);
    return file;
  } catch (error) {
    logError('ファイルの読み込みに失敗しました', error);
    return null;
  }
}

// コンテキストの作成
const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  logDebug('AppContextProviderがマウントされました');
  
  const [rules, setRules] = useState<ExcelRule[]>([]);
  const [recentFiles, setRecentFiles] = useState<ProcessedFile[]>([]);
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleEditorFile, setRuleEditorFileState] = useState<File | null>(null);
  const [lastSelectedSheet, setLastSelectedSheet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  // 同期が必要なデータを追跡
  const [pendingRules, setPendingRules] = useState<{
    add: ExcelRule[],
    update: { id: string, rule: ExcelRule }[],
    delete: string[]
  }>({
    add: [],
    update: [],
    delete: []
  });
  
  // ルールとファイル・シートの関連付けを管理する状態
  const [ruleMappings, setRuleMappings] = useState<RuleFileMapping[]>([]);
  
  // オンライン状態を監視
  useEffect(() => {
    const handleOnline = () => {
      logDebug('ネットワーク接続が復旧しました');
      setIsOnline(true);
      // 接続復旧時に保留中のデータを同期
      syncToServer();
    };
    
    const handleOffline = () => {
      logDebug('ネットワーク接続が切断されました');
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // 初期化時にローカルストレージから状態を復元
  useEffect(() => {
    logDebug('ローカルストレージからデータを読み込みます');
    
    setRecentFiles(loadFromStorage<ProcessedFile[]>('recentFiles', []));
    setProcessingResults(loadFromStorage<ProcessingResult[]>('processingResults', []));
    setRuleMappings(loadFromStorage<RuleFileMapping[]>('ruleMappings', []));
    
    // 最後に選択したシートを復元
    const savedSheet = localStorage.getItem('lastSelectedSheet');
    if (savedSheet) {
      setLastSelectedSheet(savedSheet);
      logDebug('最後に選択したシートを復元しました', savedSheet);
    }
    
    // 保存されたファイルを復元
    const savedFile = loadSavedFile();
    if (savedFile) {
      setRuleEditorFileState(savedFile);
      logDebug('保存されたファイルを復元しました', savedFile.name);
    }
    
    // 保留中の操作を復元
    setPendingRules(loadFromStorage<{
      add: ExcelRule[],
      update: { id: string, rule: ExcelRule }[],
      delete: string[]
    }>('pendingRules', {
      add: [],
      update: [],
      delete: []
    }));
    
    // ルールをロード
    loadRules();
  }, []);
  
  // ルールとファイル・シートの関連付けを設定
  const setRuleFileMapping = (ruleId: string, fileName: string, sheetName: string) => {
    logDebug(`ルールマッピング設定: ruleId=${ruleId}, fileName=${fileName}, sheetName=${sheetName}`);
    const newMappings = [...ruleMappings.filter(m => m.ruleId !== ruleId)];
    newMappings.push({ ruleId, fileName, sheetName });
    setRuleMappings(newMappings);
    saveToStorage('ruleMappings', newMappings);
  };
  
  // ルールのコピー時にファイル・シート情報も複製する
  const copyRuleWithFileMapping = (sourceRuleId: string, targetRuleId: string) => {
    logDebug(`ルールマッピングをコピー: sourceRuleId=${sourceRuleId}, targetRuleId=${targetRuleId}`);
    const sourceMapping = ruleMappings.find(m => m.ruleId === sourceRuleId);
    if (sourceMapping) {
      logDebug(`マッピング情報を複製: fileName=${sourceMapping.fileName}, sheetName=${sourceMapping.sheetName}`);
      setRuleFileMapping(targetRuleId, sourceMapping.fileName, sourceMapping.sheetName);
    } else {
      logDebug(`マッピング情報が見つかりませんでした: sourceRuleId=${sourceRuleId}`);
    }
  };
  
  // RuleEditor用ファイルの設定と保存
  const setRuleEditorFile = (file: File | null) => {
    setRuleEditorFileState(file);
    if (file) {
      saveFileInfo(file);
      
      // 現在選択中のルールがあれば関連付けを更新
      if (selectedRuleId) {
        const currentSheet = lastSelectedSheet || '';
        setRuleFileMapping(selectedRuleId, file.name, currentSheet);
      }
    }
  };
  
  // 最後に選択したシート名を設定し保存
  const handleSetLastSelectedSheet = (sheetName: string) => {
    setLastSelectedSheet(sheetName);
    localStorage.setItem('lastSelectedSheet', sheetName);
    logDebug('最後に選択したシートを保存しました', sheetName);
    
    // 現在選択中のルールがあれば関連付けを更新
    if (selectedRuleId && ruleEditorFile) {
      setRuleFileMapping(selectedRuleId, ruleEditorFile.name, sheetName);
    }
  };
  
  // RuleEditor用ファイルをクリア
  const clearRuleEditorFile = () => {
    setRuleEditorFileState(null);
    localStorage.removeItem('ruleEditorFileName');
    localStorage.removeItem('ruleEditorFileData');
    localStorage.removeItem('ruleEditorFileInfo');
    logDebug('ファイル情報をクリアしました');
  };
  
  // Supabaseからルールを読み込む
  const loadRules = async () => {
    logDebug('Supabaseからルールを読み込みます');
    setIsLoading(true);
    setError(null);
    
    try {
      const rulesFromDB = await fetchRules();
      logDebug(`${rulesFromDB.length}件のルールを読み込みました`);
      
      if (rulesFromDB.length > 0) {
        setRules(rulesFromDB);
      } else {
        // データベースからデータが取得できない場合はローカルストレージから復元
        const localRules = loadFromStorage<ExcelRule[]>('excelRules', []);
        if (localRules.length > 0) {
          logDebug(`ローカルストレージから${localRules.length}件のルールを復元しました`);
          setRules(localRules);
          
          // オンライン状態なら、ローカルのルールをサーバーに同期
          if (navigator.onLine) {
            syncLocalRulesToServer(localRules);
          } else {
            logDebug('オフラインのため、ルールの同期は延期されます');
          }
        }
      }
    } catch (error) {
      logError('ルールの読み込みに失敗しました', error);
      setError('ルールの読み込みに失敗しました。ネットワーク接続を確認してください。');
      
      // エラー時もローカルストレージから復元
      const localRules = loadFromStorage<ExcelRule[]>('excelRules', []);
      if (localRules.length > 0) {
        logDebug(`ローカルストレージから${localRules.length}件のルールを復元しました`);
        setRules(localRules);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // ローカルルールをサーバーに同期する
  const syncLocalRulesToServer = async (localRules: ExcelRule[]) => {
    logDebug(`ローカルの${localRules.length}件のルールをサーバーに同期します`);
    for (const rule of localRules) {
      try {
        await createRule(rule);
        logDebug(`ルールをサーバーに同期しました: ${rule.name}`);
      } catch (error) {
        logError(`ルール(${rule.name})の同期に失敗しました`, error);
      }
    }
  };
  
  // 保留中のデータをサーバーと同期
  const syncToServer = async () => {
    if (!navigator.onLine) {
      toast.error('オフラインのため同期できません');
      return;
    }
    
    logDebug('保留中のデータをサーバーと同期します', pendingRules);
    let syncSuccess = false;
    setIsLoading(true);
    
    // 削除操作を同期
    for (const id of pendingRules.delete) {
      try {
        const success = await deleteSupabaseRule(id);
        if (success) {
          logDebug(`ルール(ID: ${id})の削除をサーバーに同期しました`);
          syncSuccess = true;
        }
      } catch (error) {
        logError(`ルール(ID: ${id})の削除の同期に失敗しました`, error);
      }
    }
    
    // 追加操作を同期
    for (const rule of pendingRules.add) {
      try {
        const newRule = await createRule(rule);
        if (newRule) {
          logDebug(`ルール(${rule.name})の追加をサーバーに同期しました`);
          syncSuccess = true;
        }
      } catch (error) {
        logError(`ルール(${rule.name})の追加の同期に失敗しました`, error);
      }
    }
    
    // 更新操作を同期
    for (const { id, rule } of pendingRules.update) {
      try {
        const updatedRule = await updateSupabaseRule(id, rule);
        if (updatedRule) {
          logDebug(`ルール(${rule.name})の更新をサーバーに同期しました`);
          syncSuccess = true;
        }
      } catch (error) {
        logError(`ルール(${rule.name})の更新の同期に失敗しました`, error);
      }
    }
    
    // 保留中の操作をクリア
    if (syncSuccess) {
      setPendingRules({ add: [], update: [], delete: [] });
      saveToStorage('pendingRules', { add: [], update: [], delete: [] });
      
      // 最新のデータを再読み込み
      await loadRules();
      toast.success('データを同期しました');
    } else {
      toast.error('同期に失敗しました');
    }
    
    setIsLoading(false);
  };
  
  // ローカルストレージ保存機能は残しておく（バックアップとして）
  useEffect(() => {
    logDebug(`ルールをローカルストレージにバックアップします: ${rules.length}件`);
    saveToStorage('excelRules', rules);
  }, [rules]);
  
  useEffect(() => {
    saveToStorage('recentFiles', recentFiles);
  }, [recentFiles]);
  
  useEffect(() => {
    saveToStorage('processingResults', processingResults);
  }, [processingResults]);
  
  useEffect(() => {
    saveToStorage('ruleMappings', ruleMappings);
  }, [ruleMappings]);
  
  useEffect(() => {
    saveToStorage('pendingRules', pendingRules);
  }, [pendingRules]);
  
  // ルールの追加（Supabase + ローカルステート）
  const addRule = async (rule: ExcelRule): Promise<boolean> => {
    logDebug('ルールを追加します:', rule.name);
    setIsLoading(true);
    setError(null);
    
    try {
      if (!navigator.onLine) {
        // オフライン時はローカルのみに保存し、同期待ちリストに追加
        setRules(prev => [...prev, rule]);
        setPendingRules(prev => ({
          ...prev,
          add: [...prev.add, rule]
        }));
        toast.success('ルールをオフラインで保存しました（オンライン時に同期されます）');
        setIsLoading(false);
        return true;
      }
      
      const createdRule = await createRule(rule);
      if (createdRule) {
        setRules(prev => [...prev, createdRule]);
        logDebug('ルールをSupabaseに保存しました:', createdRule.id);
        setIsLoading(false);
        return true;
      } else {
        throw new Error('ルールの作成に失敗しました');
      }
    } catch (error) {
      logError('Supabaseへのルール保存に失敗しました:', error);
      setError('ルールの保存に失敗しました');
      
      // ローカルステートには追加（バックアップとして）
      setRules(prev => [...prev, rule]);
      setPendingRules(prev => ({
        ...prev,
        add: [...prev.add, rule]
      }));
      toast.error('ローカルに保存しました（サーバーに保存できませんでした）');
      setIsLoading(false);
      return false;
    }
  };
  
  // ルールの更新（Supabase + ローカルステート）
  const updateRule = async (id: string, updatedRule: ExcelRule): Promise<boolean> => {
    logDebug('ルールを更新します:', id, updatedRule.name);
    setIsLoading(true);
    setError(null);
    
    try {
      if (!navigator.onLine) {
        // オフライン時はローカルのみに保存し、同期待ちリストに追加
        setRules(prev => prev.map(r => r.id === id ? updatedRule : r));
        setPendingRules(prev => ({
          ...prev,
          update: [...prev.update.filter(item => item.id !== id), { id, rule: updatedRule }]
        }));
        toast.success('ルールをオフラインで更新しました（オンライン時に同期されます）');
        setIsLoading(false);
        return true;
      }
      
      const result = await updateSupabaseRule(id, updatedRule);
      if (result) {
        setRules(prev => prev.map(r => r.id === id ? result : r));
        logDebug('ルールをSupabaseで更新しました:', id);
        setIsLoading(false);
        return true;
      } else {
        throw new Error('ルールの更新に失敗しました');
      }
    } catch (error) {
      logError('Supabaseでのルール更新に失敗しました:', error);
      setError('ルールの更新に失敗しました');
      
      // ローカルステートでは更新（バックアップとして）
      setRules(prev => prev.map(r => r.id === id ? updatedRule : r));
      setPendingRules(prev => ({
        ...prev,
        update: [...prev.update.filter(item => item.id !== id), { id, rule: updatedRule }]
      }));
      toast.error('ローカルで更新しました（サーバーに保存できませんでした）');
      setIsLoading(false);
      return false;
    }
  };
  
  // ルールの削除（Supabase + ローカルステート）
  const deleteRule = async (id: string): Promise<boolean> => {
    logDebug('ルールを削除します:', id);
    setIsLoading(true);
    setError(null);
    
    try {
      if (!navigator.onLine) {
        // オフライン時はローカルのみで削除し、同期待ちリストに追加
        setRules(prev => prev.filter(r => r.id !== id));
        setRuleMappings(prev => prev.filter(m => m.ruleId !== id));
        setPendingRules(prev => ({
          ...prev,
          delete: [...prev.delete, id],
          // 追加待ちや更新待ちからも削除
          add: prev.add.filter(r => r.id !== id),
          update: prev.update.filter(item => item.id !== id)
        }));
        toast.success('ルールをオフラインで削除しました（オンライン時に同期されます）');
        setIsLoading(false);
        return true;
      }
      
      const success = await deleteSupabaseRule(id);
      if (success) {
        setRules(prev => prev.filter(r => r.id !== id));
        // 関連付けマッピングも削除
        setRuleMappings(prev => prev.filter(m => m.ruleId !== id));
        logDebug('ルールをSupabaseから削除しました:', id);
        setIsLoading(false);
        return true;
      } else {
        throw new Error('ルールの削除に失敗しました');
      }
    } catch (error) {
      logError('Supabaseでのルール削除に失敗しました:', error);
      setError('ルールの削除に失敗しました');
      
      // ローカルステートでは削除（バックアップとして）
      setRules(prev => prev.filter(r => r.id !== id));
      // 関連付けマッピングも削除
      setRuleMappings(prev => prev.filter(m => m.ruleId !== id));
      setPendingRules(prev => ({
        ...prev,
        delete: [...prev.delete, id],
        // 追加待ちや更新待ちからも削除
        add: prev.add.filter(r => r.id !== id),
        update: prev.update.filter(item => item.id !== id)
      }));
      toast.error('ローカルで削除しました（サーバーで削除できませんでした）');
      setIsLoading(false);
      return false;
    }
  };
  
  // 既存のメソッド
  const addProcessedFile = (file: ProcessedFile) => {
    logDebug('処理済みファイルを追加:', file.name);
    setRecentFiles(prev => [file, ...prev.filter(f => f.id !== file.id)].slice(0, 10));
  };
  
  const addProcessingResult = (result: ProcessingResult) => {
    logDebug('処理結果を追加:', result.fileName, `(${result.records.length} レコード)`);
    
    // Fileオブジェクトを含まないようにする (シリアライズの問題を回避)
    const serializableResult = {
      ...result,
      // 必要に応じて、シリアライズできない項目を削除
    };
    
    setProcessingResults(prev => {
      const exists = prev.some(r => r.fileId === result.fileId);
      return exists ? prev.map(r => r.fileId === result.fileId ? serializableResult : r) : [...prev, serializableResult];
    });
  };
  
  const getProcessingResult = (fileId: string) => processingResults.find(r => r.fileId === fileId);
  
  const contextValue: AppContextType = {
    rules,
    addRule,
    updateRule,
    deleteRule,
    recentFiles,
    addProcessedFile,
    processingResults,
    addProcessingResult,
    getProcessingResult,
    currentFile,
    setCurrentFile,
    selectedRuleId,
    setSelectedRuleId,
    ruleEditorFile,
    setRuleEditorFile,
    clearRuleEditorFile,
    lastSelectedSheet,
    setLastSelectedSheet: handleSetLastSelectedSheet,
    setRuleFileMapping,
    copyRuleWithFileMapping,
    isLoading,
    error,
    refreshRules: loadRules,
    syncToServer,
    isOnline
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};