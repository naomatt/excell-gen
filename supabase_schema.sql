-- ルールテーブル
CREATE TABLE excel_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- シートルールテーブル
CREATE TABLE excel_sheet_rules (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES excel_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sheet_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- マッピングルールテーブル
CREATE TABLE excel_mapping_rules (
  id UUID PRIMARY KEY,
  sheet_rule_id UUID NOT NULL REFERENCES excel_sheet_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_field TEXT NOT NULL,
  source_type TEXT NOT NULL,
  cell JSONB,
  range JSONB,
  formula TEXT,
  direct_value TEXT,
  default_value TEXT,
  conditions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX excel_sheet_rules_rule_id_idx ON excel_sheet_rules(rule_id);
CREATE INDEX excel_mapping_rules_sheet_rule_id_idx ON excel_mapping_rules(sheet_rule_id);

-- RLSポリシーは現時点では不要ですが、将来的に認証が必要になったら追加します
-- この例では全員が読み書き可能なポリシーを設定しています
ALTER TABLE excel_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE excel_sheet_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE excel_mapping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rules" 
  ON excel_rules FOR SELECT USING (true);

CREATE POLICY "Anyone can insert rules" 
  ON excel_rules FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update rules" 
  ON excel_rules FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete rules" 
  ON excel_rules FOR DELETE USING (true);

-- 同様にシートルールとマッピングルールにもポリシーを設定
CREATE POLICY "Anyone can read sheet rules" 
  ON excel_sheet_rules FOR SELECT USING (true);

CREATE POLICY "Anyone can insert sheet rules" 
  ON excel_sheet_rules FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update sheet rules" 
  ON excel_sheet_rules FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete sheet rules" 
  ON excel_sheet_rules FOR DELETE USING (true);

CREATE POLICY "Anyone can read mapping rules" 
  ON excel_mapping_rules FOR SELECT USING (true);

CREATE POLICY "Anyone can insert mapping rules" 
  ON excel_mapping_rules FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update mapping rules" 
  ON excel_mapping_rules FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete mapping rules" 
  ON excel_mapping_rules FOR DELETE USING (true); 