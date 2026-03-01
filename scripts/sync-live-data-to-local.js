#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync, execSync } = require('child_process')

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const { label, inherit = false, env = process.env } = options
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    env,
  })

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim()
    const stdout = (result.stdout || '').trim()
    const prefix = label || `${command} ${args.join(' ')}`
    fail([prefix, stderr, stdout].filter(Boolean).join('\n'))
  }

  return (result.stdout || '').trim()
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function ensureLocalSupabaseRunning() {
  run('supabase', ['status', '-o', 'env'], {
    label: 'Local Supabase is not running. Start it with `supabase start`.',
  })
}

function getLocalDbContainerName() {
  const names = run('docker', ['ps', '--format', '{{.Names}}'], {
    label: 'Could not list running Docker containers',
  })
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)

  const dbContainer = names.find((name) => name.startsWith('supabase_db_'))

  if (!dbContainer) {
    fail('Could not find a running local Supabase DB container. Start it first with `supabase start`.')
  }

  return dbContainer
}

function getLocalPublicTables(containerName) {
  const sql = "select tablename from pg_tables where schemaname = 'public' order by tablename"
  const output = run(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', sql],
    { label: 'Could not read local public tables' }
  )

  return output
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
}

function getLocalPublicSequences(containerName) {
  const sql = "select sequencename from pg_sequences where schemaname = 'public' order by sequencename"
  const output = run(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', sql],
    { label: 'Could not read local public sequences' }
  )

  return output
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
}

function getLocalColumnsByTable(containerName) {
  const sql =
    "select table_name || '|' || column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position"
  const output = run(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', sql],
    { label: 'Could not read local table columns' }
  )

  const columnsByTable = new Map()

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const [table, column] = trimmed.split('|')
    if (!table || !column) continue

    if (!columnsByTable.has(table)) {
      columnsByTable.set(table, new Set())
    }

    columnsByTable.get(table).add(column)
  }

  return columnsByTable
}

function parseCopyDefinitions(dumpContent) {
  const definitions = []
  const regex = /^COPY\s+"public"\."([^"]+)"\s+\(([^)]+)\)\s+FROM stdin;/gm
  let match = regex.exec(dumpContent)

  while (match) {
    const table = match[1]
    const columns = match[2]
      .split(',')
      .map((column) => column.trim())
      .map((column) => column.replace(/^"|"$/g, ''))

    definitions.push({ table, columns })
    match = regex.exec(dumpContent)
  }

  return definitions
}

function filterDumpFile({ sourcePath, destinationPath, excludedTables, localSequenceSet }) {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const lines = source.split(/\r?\n/)

  const output = []
  let skipCopyData = false

  for (const line of lines) {
    if (skipCopyData) {
      if (line === '\\.') {
        skipCopyData = false
      }
      continue
    }

    const copyMatch = line.match(/^COPY\s+"public"\."([^"]+)"\s+\(/)
    if (copyMatch) {
      const table = copyMatch[1]

      if (excludedTables.has(table)) {
        skipCopyData = true
        continue
      }

      output.push(line)
      continue
    }

    const setvalMatch = line.match(/^SELECT\s+pg_catalog\.setval\('\"public\"\.\"([^\"]+)\"'/)
    if (setvalMatch) {
      const sequenceName = setvalMatch[1]

      if (!localSequenceSet.has(sequenceName)) {
        continue
      }
    }

    output.push(line)
  }

  fs.writeFileSync(destinationPath, `${output.join('\n').replace(/\n*$/, '')}\n`)
}

function dumpLivePublicData(outputPath, dbPassword) {
  const args = ['db', 'dump', '--linked', '--schema', 'public', '--data-only', '--use-copy', '-f', outputPath]

  if (dbPassword) {
    args.push('-p', dbPassword)
  }

  run('supabase', args, {
    inherit: true,
    label:
      'Live data dump failed. If prompted for a password in non-interactive mode, set SUPABASE_DB_PASSWORD and retry.',
  })
}

function clearTablesForImport(containerName, tables) {
  if (tables.length === 0) {
    return
  }

  const sqlLines = ['BEGIN;', 'SET LOCAL session_replication_role = replica;']

  // Use DELETE with replication_role=replica to avoid unintended CASCADE truncation
  // of excluded tables while still clearing imported tables quickly.
  for (const table of tables) {
    const qualified = `${quoteIdentifier('public')}.${quoteIdentifier(table)}`
    sqlLines.push(`DELETE FROM ${qualified};`)
  }

  sqlLines.push('COMMIT;')
  const sql = sqlLines.join('\n')

  run(
    'docker',
    ['exec', '-i', containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { inherit: true, label: 'Could not truncate local tables before import' }
  )
}

function importDump(containerName, dumpPath) {
  const command = `docker exec -i ${containerName} psql -v ON_ERROR_STOP=1 -U postgres -d postgres < ${shellEscape(dumpPath)}`

  try {
    execSync(command, { stdio: 'inherit', shell: '/bin/zsh' })
  } catch (_error) {
    fail('Import into local database failed')
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  let outputArg = 'supabase/live_public_data.sync.sql'
  let fromFileArg = null
  let outputSet = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]

    if (arg === '--from-file') {
      const value = args[i + 1]
      if (!value) {
        fail('Missing value for --from-file')
      }

      fromFileArg = value
      i += 1
      continue
    }

    if (arg.startsWith('--')) {
      fail(`Unknown option: ${arg}`)
    }

    if (!outputSet) {
      outputArg = arg
      outputSet = true
      continue
    }

    fail(`Unexpected argument: ${arg}`)
  }

  return { outputArg, fromFileArg }
}

function main() {
  const { outputArg, fromFileArg } = parseArgs()
  const rootDir = process.cwd()
  const outputPath = path.resolve(rootDir, outputArg)
  const tempDir = path.resolve(rootDir, '.temp')
  const rawDumpPath = path.resolve(tempDir, 'live_public_data.raw.sql')
  const sourceDumpPath = fromFileArg ? path.resolve(rootDir, fromFileArg) : rawDumpPath
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASS || ''

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.mkdirSync(tempDir, { recursive: true })

  console.log('Checking local Supabase status...')
  ensureLocalSupabaseRunning()

  const dbContainer = getLocalDbContainerName()
  const localTables = getLocalPublicTables(dbContainer)
  const localTableSet = new Set(localTables)
  const localColumnsByTable = getLocalColumnsByTable(dbContainer)
  const localSequenceSet = new Set(getLocalPublicSequences(dbContainer))

  if (!fromFileArg) {
    console.log('Dumping live public data...')
    dumpLivePublicData(rawDumpPath, dbPassword)
  } else {
    if (!fs.existsSync(sourceDumpPath)) {
      fail(`Source dump not found: ${sourceDumpPath}`)
    }

    console.log(`Using existing dump file: ${path.relative(rootDir, sourceDumpPath)}`)
  }

  const sourceDumpContent = fs.readFileSync(sourceDumpPath, 'utf8')
  const copyDefinitions = parseCopyDefinitions(sourceDumpContent)

  const missingTables = []
  const schemaDriftTables = []
  const excludedTables = new Set()

  for (const definition of copyDefinitions) {
    const { table, columns } = definition

    if (!localTableSet.has(table)) {
      missingTables.push(table)
      excludedTables.add(table)
      continue
    }

    const localColumns = localColumnsByTable.get(table) || new Set()
    const missingColumns = columns.filter((column) => !localColumns.has(column))

    if (missingColumns.length > 0) {
      schemaDriftTables.push(`${table} (missing: ${missingColumns.join(', ')})`)
      excludedTables.add(table)
    }
  }

  if (missingTables.length > 0) {
    console.log(`Excluding ${missingTables.length} remote-only table(s): ${missingTables.join(', ')}`)
  }

  if (schemaDriftTables.length > 0) {
    console.log('Excluding tables with column drift from local schema:')
    for (const row of schemaDriftTables) {
      console.log(`- ${row}`)
    }
  }

  filterDumpFile({
    sourcePath: sourceDumpPath,
    destinationPath: outputPath,
    excludedTables,
    localSequenceSet,
  })

  const filteredDumpContent = fs.readFileSync(outputPath, 'utf8')
  const tablesToImport = parseCopyDefinitions(filteredDumpContent)
    .map((definition) => definition.table)
    .filter((table, index, arr) => arr.indexOf(table) === index)
    .filter((table) => !excludedTables.has(table))

  if (tablesToImport.length === 0) {
    fail('No compatible public tables found to import. Aborting.')
  }

  console.log(`Clearing ${tablesToImport.length} local table(s) for import...`)
  clearTablesForImport(dbContainer, tablesToImport)

  console.log('Importing dump into local database...')
  importDump(dbContainer, outputPath)

  console.log('Done.')
  console.log(`Imported ${tablesToImport.length} public table(s) from live to local.`)
  console.log(`Filtered dump file: ${path.relative(rootDir, outputPath)}`)

  if (schemaDriftTables.length > 0) {
    console.log('Note: some tables were skipped due to schema drift. Sync local schema to live for full parity.')
  }
}

main()
