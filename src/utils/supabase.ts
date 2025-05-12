import { createClient } from '@supabase/supabase-js';

// Supabaseの設定（環境変数から読み込むのが理想的ですが、デモのために直接記述）
// 実際の運用では.envファイルを使用してください
const supabaseUrl = 'https://qyzmhfsisovygjxdmvqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5em1oZnNpc292eWdqeGRtdnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MDcxMTcsImV4cCI6MjA2MjE4MzExN30.WyUuSgfg5tEPUCZHgNe4_aBNAGYS1fcwWoeItVVxblc';

// Supabaseクライアントの作成
export const supabase = createClient(supabaseUrl, supabaseKey);

// 以下のURLはご自身のSupabaseプロジェクトのものに置き換えてください
// supabaseUrl: https://xxx.supabase.co
// supabaseKey: eyJxxxx... (匿名キー) 