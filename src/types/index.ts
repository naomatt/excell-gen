// Excel Rule Types
export interface CellPosition {
  row: number;
  column: number;
}

export interface CellRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

export interface Condition {
  type: 'equals' | 'contains' | 'notEquals' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value: string | number | null;
}

export interface MappingRule {
  id: string;
  name: string;
  targetField: string;
  sourceType: 'cell' | 'range' | 'formula' | 'direct';
  cell?: CellPosition;
  range?: CellRange;
  formula?: string;
  direct_value?: string;
  conditions?: Condition[];
  defaultValue?: string | number;
}

export interface SheetRule {
  id: string;
  name: string;
  sheetIndex: number;
  sheetName?: string;
  mappingRules: MappingRule[];
}

// フォルダ情報
export interface RuleFolder {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExcelRule {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sheetRules: SheetRule[];
  folderId?: string | null; // ルールが属するフォルダのID（未分類の場合はnull）
}

// File Types
export interface ProcessedFile {
  id: string;
  name: string;
  processedAt: string;
  ruleId: string;
  ruleName: string;
  recordsGenerated: number;
}

// Result Types
export interface GeneratedRecord {
  [key: string]: any;
}

export interface ProcessingResult {
  fileId: string;
  fileName: string;
  ruleId: string;
  ruleName: string;
  processedAt: string;
  records: GeneratedRecord[];
  success: boolean;
  errorMessage?: string;
}