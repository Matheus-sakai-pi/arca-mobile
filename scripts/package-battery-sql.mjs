import { mkdir, readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../artifacts/battery/', import.meta.url);
await mkdir(directory, { recursive: true });
const files = ['202610170001_exercise_energy.sql', '202610170002_battery_push.sql', '202610170003_unit_chest_energy.sql', '202610180001_battery_capacity_30.sql'];
let output = '-- Arca battery v2. Apply once, with the compatible app release.\n-- Requires all migrations through 202610160005_push_notifications.sql.\n-- Old app versions cannot submit new paid starts after this upgrade.\n\n';
for (const file of files) output += `-- ${file}\n` + await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8') + '\n';
await writeFile(new URL('ativar-bateria.sql', directory), output);
await writeFile(new URL('ativar-baus.sql', directory), await readFile(new URL('../supabase/migrations/202610170003_unit_chest_energy.sql', import.meta.url), 'utf8'));
console.log('Prepared artifacts/battery/ativar-bateria.sql. Nothing was applied to a remote database.');
