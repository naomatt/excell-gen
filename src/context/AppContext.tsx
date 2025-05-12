import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { ExcelRule, ProcessedFile, ProcessingResult } from '../types';
import { fetchRules, createRule, updateRule as updateSupabaseRule, deleteRule as deleteSupabaseRule } from '../services/ruleService';

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
  addRule: (rule: ExcelRule) => void;
  updateRule: (id: string, updatedRule: ExcelRule) => void;
  deleteRule: (id: string) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return defaultValue;
  }
  
  try {
    const stored = localStorage.getItem(key);
    console.log(`読み込み: ${key}`, stored ? '存在します' : 'データがありません');
    return stored ? JSON.parse(stored) as T : defaultValue;
  } catch (error) {
    console.error(`Error loading from localStorage (${key}):`, error);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    console.log(`保存: ${key}`, value);
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error);
  }
}

// ArrayBufferをBase64に変換する関数
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Base64をArrayBufferに変換する関数
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
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
      
      console.log('ファイル情報を保存しました:', file.name);
    } catch (error) {
      console.error('ファイル情報の保存に失敗しました:', error);
    }
  };
  
  fileReader.onerror = () => {
    console.error('ファイルの読み込みに失敗しました');
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
      console.log('保存されたファイル情報がありません');
      return null;
    }
    
    const fileInfo = JSON.parse(fileInfoStr) as SavedFileInfo;
    const fileData = base64ToArrayBuffer(fileDataBase64);
    
    // Fileオブジェクトを再構築
    const file = new File([fileData], fileInfo.name, {
      type: fileInfo.type,
      lastModified: fileInfo.lastModified
    });
    
    console.log('保存されたファイルを読み込みました:', file.name);
    return file;
  } catch (error) {
    console.error('ファイルの読み込みに失敗しました:', error);
    return null;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('AppContextProvider がマウントされました');
  
  const [rules, setRules] = useState<ExcelRule[]>([]);
  const [recentFiles, setRecentFiles] = useState<ProcessedFile[]>([]);
  const [processingResults, setProcessingResults] = useState<ProcessingResult[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleEditorFile, setRuleEditorFileState] = useState<File | null>(null);
  const [lastSelectedSheet, setLastSelectedSheet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ルールとファイル・シートの関連付けを管理する状態
  const [ruleMappings, setRuleMappings] = useState<RuleFileMapping[]>([]);
  
  // ルールとファイル・シートの関連付けを設定
  const setRuleFileMapping = (ruleId: string, fileName: string, sheetName: string) => {
    console.log(`ルールマッピング設定: ruleId=${ruleId}, fileName=${fileName}, sheetName=${sheetName}`);
    const newMappings = [...ruleMappings.filter(m => m.ruleId !== ruleId)];
    newMappings.push({ ruleId, fileName, sheetName });
    setRuleMappings(newMappings);
    saveToStorage('ruleMappings', newMappings);
  };
  
  // ルールのコピー時にファイル・シート情報も複製する
  const copyRuleWithFileMapping = (sourceRuleId: string, targetRuleId: string) => {
    console.log(`ルールマッピングをコピー: sourceRuleId=${sourceRuleId}, targetRuleId=${targetRuleId}`);
    const sourceMapping = ruleMappings.find(m => m.ruleId === sourceRuleId);
    if (sourceMapping) {
      console.log(`マッピング情報を複製: fileName=${sourceMapping.fileName}, sheetName=${sourceMapping.sheetName}`);
      setRuleFileMapping(targetRuleId, sourceMapping.fileName, sourceMapping.sheetName);
    } else {
      console.log(`マッピング情報が見つかりませんでした: sourceRuleId=${sourceRuleId}`);
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
    console.log('最後に選択したシートを保存しました:', sheetName);
    
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
  };
  
  // Supabaseからルール一覧を取得
  const loadRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rulesData = await fetchRules();
      console.log('Supabaseからルールを取得しました:', rulesData.length);
      setRules(rulesData);
    } catch (err) {
      console.error('ルールの取得に失敗しました:', err);
      setError('ルールの取得に失敗しました');
      
      // バックアップとしてローカルストレージから読み込み
      const savedRules = loadFromStorage<ExcelRule[]>('excelRules', []);
      console.log('バックアップとしてローカルストレージから読み込みました:', savedRules.length);
      setRules(savedRules);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 初期化時にデータをロード
  useEffect(() => {
    console.log('データをロードします...');
    
    // Supabaseからルールを取得
    loadRules();
    
    // その他のデータはローカルストレージから取得
    const savedFiles = loadFromStorage<ProcessedFile[]>('recentFiles', []);
    const savedResults = loadFromStorage<ProcessingResult[]>('processingResults', []);
    const savedMappings = loadFromStorage<RuleFileMapping[]>('ruleMappings', []);
    
    // 保存されたファイルを読み込み
    const savedFile = loadSavedFile();
    if (savedFile) {
      setRuleEditorFileState(savedFile);
    }
    
    // 保存されたシート名を読み込み
    const savedSheetName = localStorage.getItem('lastSelectedSheet');
    if (savedSheetName) {
      setLastSelectedSheet(savedSheetName);
      console.log('保存されたシート名を読み込みました:', savedSheetName);
    }
    
    setRecentFiles(savedFiles);
    setProcessingResults(savedResults);
    setRuleMappings(savedMappings);
  }, []);

  // ローカルストレージ保存機能は残しておく（バックアップとして）
  useEffect(() => {
    console.log('ルールをローカルストレージにバックアップします:', rules.length);
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

  // ルールの追加（Supabase + ローカルステート）
  const addRule = async (rule: ExcelRule) => {
    console.log('ルールを追加します:', rule);
    setIsLoading(true);
    setError(null);
    
    try {
      const createdRule = await createRule(rule);
      if (createdRule) {
        setRules(prev => [...prev, createdRule]);
        console.log('ルールをSupabaseに保存しました:', createdRule.id);
      } else {
        throw new Error('ルールの作成に失敗しました');
      }
    } catch (err) {
      console.error('Supabaseへのルール保存に失敗しました:', err);
      setError('ルールの保存に失敗しました');
      
      // ローカルステートには追加（バックアップとして）
      setRules(prev => [...prev, rule]);
    } finally {
      setIsLoading(false);
    }
  };

  // ルールの更新（Supabase + ローカルステート）
  const updateRule = async (id: string, updatedRule: ExcelRule) => {
    console.log('ルールを更新します:', id, updatedRule);
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await updateSupabaseRule(id, updatedRule);
      if (result) {
        setRules(prev => prev.map(r => r.id === id ? result : r));
        console.log('ルールをSupabaseで更新しました:', id);
      } else {
        throw new Error('ルールの更新に失敗しました');
      }
    } catch (err) {
      console.error('Supabaseでのルール更新に失敗しました:', err);
      setError('ルールの更新に失敗しました');
      
      // ローカルステートでは更新（バックアップとして）
      setRules(prev => prev.map(r => r.id === id ? updatedRule : r));
    } finally {
      setIsLoading(false);
    }
  };
  
  // ルールの削除（Supabase + ローカルステート）
  const deleteRule = async (id: string) => {
    console.log('ルールを削除します:', id);
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await deleteSupabaseRule(id);
      if (success) {
        setRules(prev => prev.filter(r => r.id !== id));
        // 関連付けマッピングも削除
        setRuleMappings(prev => prev.filter(m => m.ruleId !== id));
        console.log('ルールをSupabaseから削除しました:', id);
      } else {
        throw new Error('ルールの削除に失敗しました');
      }
    } catch (err) {
      console.error('Supabaseでのルール削除に失敗しました:', err);
      setError('ルールの削除に失敗しました');
      
      // ローカルステートでは削除（バックアップとして）
      setRules(prev => prev.filter(r => r.id !== id));
      // 関連付けマッピングも削除
      setRuleMappings(prev => prev.filter(m => m.ruleId !== id));
    } finally {
      setIsLoading(false);
    }
  };

  // 既存のメソッド
  const addProcessedFile = (file: ProcessedFile) => {
    console.log('処理済みファイルを追加:', file.name);
    setRecentFiles(prev => [file, ...prev.filter(f => f.id !== file.id)].slice(0, 10));
  };

  const addProcessingResult = (result: ProcessingResult) => {
    console.log('処理結果を追加:', result.fileName, `(${result.records.length} レコード)`);
    
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
    refreshRules: loadRules
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};