import { supabase } from '../utils/supabase';

const FILE_MAPPING_TABLE = 'rule_file_mappings';

export interface RuleFileMapping {
  id: string;
  ruleId: string;
  fileName: string;
  sheetName: string;
  createdAt: string;
  updatedAt: string;
}

export const getRuleFileMapping = async (ruleId: string): Promise<RuleFileMapping[]> => {
  try {
    const { data, error } = await supabase
      .from(FILE_MAPPING_TABLE)
      .select('*')
      .eq('rule_id', ruleId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('ファイルマッピングの取得に失敗しました:', error);
    return [];
  }
};

export const setRuleFileMapping = async (mapping: Omit<RuleFileMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleFileMapping | null> => {
  try {
    const { data, error } = await supabase
      .from(FILE_MAPPING_TABLE)
      .insert({
        rule_id: mapping.ruleId,
        file_name: mapping.fileName,
        sheet_name: mapping.sheetName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('ファイルマッピングの設定に失敗しました:', error);
    return null;
  }
};

export const deleteRuleFileMapping = async (ruleId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(FILE_MAPPING_TABLE)
      .delete()
      .eq('rule_id', ruleId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('ファイルマッピングの削除に失敗しました:', error);
    return false;
  }
}; 