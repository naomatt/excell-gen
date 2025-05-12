import { supabase } from '../utils/supabase';
import { ExcelRule } from '../types';

// テーブル名
const EXCEL_RULES_TABLE = 'excel_rules';
const SHEET_RULES_TABLE = 'excel_sheet_rules';
const MAPPING_RULES_TABLE = 'excel_mapping_rules';

// ルール一覧の取得
export const fetchRules = async (): Promise<ExcelRule[]> => {
  try {
    const { data, error } = await supabase
      .from(EXCEL_RULES_TABLE)
      .select(`
        *,
        sheetRules:${SHEET_RULES_TABLE}(
          *,
          mappingRules:${MAPPING_RULES_TABLE}(*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('ルールの取得に失敗しました:', error);
    return [];
  }
};

// 単一ルールの取得
export const fetchRule = async (id: string): Promise<ExcelRule | null> => {
  try {
    const { data, error } = await supabase
      .from(EXCEL_RULES_TABLE)
      .select(`
        *,
        sheetRules:${SHEET_RULES_TABLE}(
          *,
          mappingRules:${MAPPING_RULES_TABLE}(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`ルール(ID: ${id})の取得に失敗しました:`, error);
    return null;
  }
};

// ルールの作成（複数テーブルに関連レコードを作成するため、トランザクション的に処理）
export const createRule = async (rule: ExcelRule): Promise<ExcelRule | null> => {
  try {
    // メインのルールを作成
    const { data: createdRule, error: mainError } = await supabase
      .from(EXCEL_RULES_TABLE)
      .insert({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        created_at: rule.createdAt,
        updated_at: rule.updatedAt
      })
      .select()
      .single();

    if (mainError) throw mainError;

    // シートルールを作成
    for (const sheetRule of rule.sheetRules) {
      const { error: sheetError } = await supabase
        .from(SHEET_RULES_TABLE)
        .insert({
          id: sheetRule.id,
          rule_id: rule.id,
          name: sheetRule.name,
          sheet_index: sheetRule.sheetIndex
        });

      if (sheetError) throw sheetError;

      // マッピングルールを作成
      for (const mappingRule of sheetRule.mappingRules) {
        const mappingData = {
          id: mappingRule.id,
          sheet_rule_id: sheetRule.id,
          name: mappingRule.name,
          target_field: mappingRule.targetField,
          source_type: mappingRule.sourceType,
          // 条件付きフィールド
          ...(mappingRule.cell && { cell: JSON.stringify(mappingRule.cell) }),
          ...(mappingRule.range && { range: JSON.stringify(mappingRule.range) }),
          ...(mappingRule.formula && { formula: mappingRule.formula }),
          ...(mappingRule.directValue && { direct_value: mappingRule.directValue }),
          ...(mappingRule.defaultValue && { default_value: mappingRule.defaultValue }),
          ...(mappingRule.conditions && { conditions: JSON.stringify(mappingRule.conditions) })
        };

        const { error: mappingError } = await supabase
          .from(MAPPING_RULES_TABLE)
          .insert(mappingData);

        if (mappingError) throw mappingError;
      }
    }

    // 作成に成功したら、完全なデータを取得して返す
    return await fetchRule(rule.id);
  } catch (error) {
    console.error('ルールの作成に失敗しました:', error);
    return null;
  }
};

// ルールの更新
export const updateRule = async (id: string, rule: ExcelRule): Promise<ExcelRule | null> => {
  try {
    // まず既存のシートルールとマッピングルールを削除
    // Supabaseではカスケード削除を設定していることを前提としています
    // （設定していない場合は、マッピングルールを先に削除する必要があります）
    const { error: deleteError } = await supabase
      .from(SHEET_RULES_TABLE)
      .delete()
      .eq('rule_id', id);

    if (deleteError) throw deleteError;

    // メインのルールを更新
    const { error: updateError } = await supabase
      .from(EXCEL_RULES_TABLE)
      .update({
        name: rule.name,
        description: rule.description,
        updated_at: rule.updatedAt
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // シートルールを再作成
    for (const sheetRule of rule.sheetRules) {
      const { error: sheetError } = await supabase
        .from(SHEET_RULES_TABLE)
        .insert({
          id: sheetRule.id,
          rule_id: id,
          name: sheetRule.name,
          sheet_index: sheetRule.sheetIndex
        });

      if (sheetError) throw sheetError;

      // マッピングルールを再作成
      for (const mappingRule of sheetRule.mappingRules) {
        const mappingData = {
          id: mappingRule.id,
          sheet_rule_id: sheetRule.id,
          name: mappingRule.name,
          target_field: mappingRule.targetField,
          source_type: mappingRule.sourceType,
          // 条件付きフィールド
          ...(mappingRule.cell && { cell: JSON.stringify(mappingRule.cell) }),
          ...(mappingRule.range && { range: JSON.stringify(mappingRule.range) }),
          ...(mappingRule.formula && { formula: mappingRule.formula }),
          ...(mappingRule.directValue && { direct_value: mappingRule.directValue }),
          ...(mappingRule.defaultValue && { default_value: mappingRule.defaultValue }),
          ...(mappingRule.conditions && { conditions: JSON.stringify(mappingRule.conditions) })
        };

        const { error: mappingError } = await supabase
          .from(MAPPING_RULES_TABLE)
          .insert(mappingData);

        if (mappingError) throw mappingError;
      }
    }

    // 更新に成功したら、完全なデータを取得して返す
    return await fetchRule(id);
  } catch (error) {
    console.error(`ルール(ID: ${id})の更新に失敗しました:`, error);
    return null;
  }
};

// ルールの削除
export const deleteRule = async (id: string): Promise<boolean> => {
  try {
    // Supabaseではカスケード削除を設定していることを前提としています
    const { error } = await supabase
      .from(EXCEL_RULES_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`ルール(ID: ${id})の削除に失敗しました:`, error);
    return false;
  }
}; 