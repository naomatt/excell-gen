-- excel_rulesテーブルにfolder_idカラムが存在するか確認
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'excel_rules' AND column_name = 'folder_id'
    ) THEN
        -- folder_idカラムを追加
        ALTER TABLE excel_rules ADD COLUMN folder_id UUID;
    END IF;
END $$;

-- データ確認用クエリ
-- SELECT id, name, folder_id FROM excel_rules; 