import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

// Mixed historical regression files stay intact; database/store scenarios run in the integration suite.
const integration = new Set([
  'accountDeletionDatabase.test.ts', 'accountLearning.test.ts', 'backupRestore.test.ts',
  'curriculumExpansion.test.ts', 'database.test.ts', 'engagement.test.ts', 'journey.test.ts',
  'leaderboard.test.ts', 'lessonRetry.test.ts', 'reports.test.ts', 'social.test.ts',
  'tenExerciseMigration.test.ts', 'username.test.ts',
]);
const suite = process.argv[2] ?? 'all';
if (!['all', 'unit', 'integration'].includes(suite)) throw new Error(`Unknown test suite: ${suite}`);
const legacy = (await readdir(new URL('../tests/', import.meta.url))).filter(file => file.endsWith('.test.ts'));
const files = legacy.filter(file => suite === 'all' || integration.has(file) === (suite === 'integration')).map(file => `tests/${file}`);
for (const group of ['unit', 'integration']) {
  if (suite !== 'all' && suite !== group) continue;
  for (const file of await readdir(new URL(`../tests/${group}/`, import.meta.url))) {
    if (file.endsWith('.test.ts')) files.push(`tests/${group}/${file}`);
  }
}
const child = spawn(process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=2', ...files.sort()], { stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
