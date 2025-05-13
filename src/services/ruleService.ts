import { supabase } from '../lib/supabaseClient';
import { ExcelRule } from '../types';

// テーブル名
const EXCEL_RULES_TABLE = 'excel_rules';
const SHEET_RULES_TABLE = 'excel_sheet_rules';
const MAPPING_RULES_TABLE = 'excel_mapping_rules';

// デバッグログユーティリティ
const logDebug = (message: string, data?: any) => {
  console.log(`[RuleService] ${message}`, data || '');
};

const logError = (message: string, error: any) => {
  console.error(`[RuleService] ${message}`, error);
  // エラーの詳細情報を取得
  if (error) {
    if (error.code) console.error(`Error code: ${error.code}`);
    if (error.message) console.error(`Error message: ${error.message}`);
    if (error.details) console.error(`Error details: ${error.details}`);
    if (error.stack) console.error(`Error stack: ${error.stack}`);
  }
};

// ルール一覧の取得
export const fetchRules = async (): Promise<ExcelRule[]> => {
  logDebug('ルール一覧を取得します');
  try {
    // Supabaseクライアントが適切に初期化されているか確認
    if (!supabase || typeof supabase.from !== 'function') {
      logError('Supabaseクライアントが適切に初期化されていません', { 
        supabase: !!supabase, 
        from: typeof supabase?.from 
      });
      throw new Error('Supabase接続が初期化されていません');
    }

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
    
    // データマッピングのログ出力
    if (data && data.length > 0) {
      logDebug(`取得したルールデータのサンプル:`, {
        id: data[0].id,
        name: data[0].name,
        folder_id: data[0].folder_id,
        folderId: (data[0] as any).folderId // TypeScriptでの変換後の型
      });
    }
    
    // カスタムマッピング処理を追加
    const mappedRules = data?.map(rule => {
      // DBのスネークケースからキャメルケースへの明示的な変換
      const mappedRule: ExcelRule = {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
        sheetRules: rule.sheetRules || [],
        folderId: rule.folder_id // 明示的にfolder_idからfolderIdへマッピング
      };
      
      return mappedRule;
    }) || [];
    
    logDebug(`${mappedRules.length}件のルールを取得しました`);
    logDebug('マッピング後のルールデータ:', mappedRules.map(r => ({ name: r.name, folderId: r.folderId })));
    
    return mappedRules;
  } catch (error) {
    logError('ルールの取得に失敗しました', error);
    return [];
  }
};

// 単一ルールの取得
export const fetchRule = async (id: string): Promise<ExcelRule | null> => {
  logDebug(`ルールを取得します: ID=${id}`);
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
    
    // データマッピングの詳細ログ
    logDebug(`取得したルールデータ:`, {
      id: data.id,
      name: data.name,
      folder_id: data.folder_id,
      sheetRulesCount: data.sheetRules?.length || 0
    });
    
    // 明示的なマッピング処理
    const mappedRule: ExcelRule = {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      folderId: data.folder_id, // 明示的にfolder_idからfolderIdへマッピング
      sheetRules: data.sheetRules || []
    };
    
    logDebug(`マッピング後のルールデータ:`, {
      id: mappedRule.id,
      name: mappedRule.name,
      folderId: mappedRule.folderId,
      sheetRulesCount: mappedRule.sheetRules.length
    });
    
    return mappedRule;
  } catch (error) {
    logError(`ルール(ID: ${id})の取得に失敗しました`, error);
    return null;
  }
};

// ルールの作成（複数テーブルに関連レコードを作成するため、トランザクション的に処理）
export const createRule = async (rule: ExcelRule): Promise<ExcelRule | null> => {
  logDebug(`ルールを作成します: ${rule.name}`, {
    id: rule.id,
    sheetCount: rule.sheetRules.length
  });
  
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
    logDebug(`メインルールを作成しました: ID=${rule.id}`);

    // シートルールを作成
    for (const sheetRule of rule.sheetRules) {
      logDebug(`シートルールを作成します: ${sheetRule.name}`, {
        sheetId: sheetRule.id,
        mappingCount: sheetRule.mappingRules.length
      });
      
      const { error: sheetError } = await supabase
        .from(SHEET_RULES_TABLE)
        .insert({
          id: sheetRule.id,
          rule_id: rule.id,
          name: sheetRule.name,
          sheet_index: sheetRule.sheetIndex,
          sheet_name: sheetRule.sheetName
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
          ...(mappingRule.cell && { cell: typeof mappingRule.cell === 'string' ? mappingRule.cell : JSON.stringify(mappingRule.cell) }),
          ...(mappingRule.range && { range: typeof mappingRule.range === 'string' ? mappingRule.range : JSON.stringify(mappingRule.range) }),
          ...(mappingRule.formula && { formula: mappingRule.formula }),
          ...(mappingRule.direct_value !== undefined && { direct_value: mappingRule.direct_value }),
          ...(mappingRule.defaultValue !== undefined && { default_value: mappingRule.defaultValue }),
          ...(mappingRule.conditions && { conditions: typeof mappingRule.conditions === 'string' ? mappingRule.conditions : JSON.stringify(mappingRule.conditions) })
        };

        const { error: mappingError } = await supabase
          .from(MAPPING_RULES_TABLE)
          .insert(mappingData);

        if (mappingError) {
          logError(`マッピングルール(${mappingRule.name})の作成に失敗しました`, mappingError);
          throw mappingError;
        }
      }
      
      logDebug(`シートルール(${sheetRule.name})を作成しました: ${sheetRule.mappingRules.length}件のマッピング`);
    }

    logDebug(`ルール(${rule.name})の作成が完了しました`);
    return await fetchRule(rule.id);
  } catch (error) {
    logError(`ルール(${rule.name})の作成に失敗しました`, error);
    return null;
  }
};

// ルールの更新
export const updateRule = async (id: string, rule: ExcelRule): Promise<ExcelRule | null> => {
  logDebug(`ルールを更新します: ID=${id}, 名前=${rule.name}`, {
    sheetCount: rule.sheetRules.length,
    folderId: rule.folderId
  });
  
  try {
    // まず既存のシートルールとマッピングルールを削除
    // Supabaseではカスケード削除を設定していることを前提としています
    // （設定していない場合は、マッピングルールを先に削除する必要があります）
    const { error: deleteError } = await supabase
      .from(SHEET_RULES_TABLE)
      .delete()
      .eq('rule_id', id);

    if (deleteError) throw deleteError;
    logDebug(`シートルールを削除しました: rule_id=${id}`);

    // メインのルールを更新
    const { error: updateError } = await supabase
      .from(EXCEL_RULES_TABLE)
      .update({
        name: rule.name,
        description: rule.description,
        updated_at: rule.updatedAt,
        folder_id: rule.folderId // フォルダIDも更新
      })
      .eq('id', id);

    if (updateError) throw updateError;
    logDebug(`メインルールを更新しました: ID=${id}, フォルダID=${rule.folderId || 'なし'}`);

    // シートルールを再作成
    for (const sheetRule of rule.sheetRules) {
      logDebug(`シートルールを再作成します: ${sheetRule.name}`, {
        sheetId: sheetRule.id,
        mappingCount: sheetRule.mappingRules.length
      });
      
      const { error: sheetError } = await supabase
        .from(SHEET_RULES_TABLE)
        .insert({
          id: sheetRule.id,
          rule_id: id,
          name: sheetRule.name,
          sheet_index: sheetRule.sheetIndex,
          sheet_name: sheetRule.sheetName
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
          ...(mappingRule.cell && { cell: typeof mappingRule.cell === 'string' ? mappingRule.cell : JSON.stringify(mappingRule.cell) }),
          ...(mappingRule.range && { range: typeof mappingRule.range === 'string' ? mappingRule.range : JSON.stringify(mappingRule.range) }),
          ...(mappingRule.formula && { formula: mappingRule.formula }),
          ...(mappingRule.direct_value !== undefined && { direct_value: mappingRule.direct_value }),
          ...(mappingRule.defaultValue !== undefined && { default_value: mappingRule.defaultValue }),
          ...(mappingRule.conditions && { conditions: typeof mappingRule.conditions === 'string' ? mappingRule.conditions : JSON.stringify(mappingRule.conditions) })
        };

        const { error: mappingError } = await supabase
          .from(MAPPING_RULES_TABLE)
          .insert(mappingData);

        if (mappingError) {
          logError(`マッピングルール(${mappingRule.name})の作成に失敗しました`, mappingError);
          throw mappingError;
        }
      }
      
      logDebug(`シートルール(${sheetRule.name})を再作成しました: ${sheetRule.mappingRules.length}件のマッピング`);
    }

    logDebug(`ルール(ID: ${id})の更新が完了しました`);
    // 更新に成功したら、完全なデータを取得して返す
    return await fetchRule(id);
  } catch (error) {
    logError(`ルール(ID: ${id})の更新に失敗しました`, error);
    return null;
  }
};

// ルールの削除
export const deleteRule = async (id: string): Promise<boolean> => {
  logDebug(`ルールを削除します: ID=${id}`);
  try {
    // Supabaseではカスケード削除を設定していることを前提としています
    const { error } = await supabase
      .from(EXCEL_RULES_TABLE)
      .delete()
      .eq('id', id);

    if (error) throw error;
    logDebug(`ルール(ID: ${id})を削除しました`);
    return true;
  } catch (error) {
    logError(`ルール(ID: ${id})の削除に失敗しました`, error);
    return false;
  }
}; 