-- Schema backup script - Run in Supabase SQL Editor
-- This will show you the CREATE statements for all your tables

-- Get all table definitions
SELECT 
  'CREATE TABLE ' || table_name || ' (' || 
  string_agg(
    column_name || ' ' || data_type || 
    CASE 
      WHEN character_maximum_length IS NOT NULL 
      THEN '(' || character_maximum_length || ')'
      ELSE ''
    END ||
    CASE 
      WHEN is_nullable = 'NO' THEN ' NOT NULL'
      ELSE ''
    END,
    ', '
  ) || ');' as create_statement
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name NOT LIKE 'pg_%'
GROUP BY table_name
ORDER BY table_name;

-- Get all indexes
SELECT 
  'CREATE INDEX ' || indexname || ' ON ' || tablename || 
  ' USING ' || indexdef as index_statements
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname NOT LIKE 'pg_%';

-- Get all foreign keys
SELECT 
  'ALTER TABLE ' || tc.table_name || 
  ' ADD CONSTRAINT ' || tc.constraint_name || 
  ' FOREIGN KEY (' || kcu.column_name || ')' ||
  ' REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public';