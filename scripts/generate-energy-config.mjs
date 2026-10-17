import { readFile, writeFile } from 'node:fs/promises';
import { CHEST_ENERGY_CONFIG, ENERGY_CONFIG } from '../src/config/energy.ts';
const path = new URL('../supabase/migrations/202610170001_exercise_energy.sql', import.meta.url);
const source = await readFile(path, 'utf8');
const start = '-- ENERGY_CONFIG_START', end = '-- ENERGY_CONFIG_END';
const statement = `insert into public.battery_rules(singleton,rules) values(true,'${JSON.stringify(ENERGY_CONFIG)}'::jsonb);`;
const updated = source.slice(0, source.indexOf(start) + start.length) + '\n-- Generated from src/config/energy.ts. Do not edit these values here.\n' + statement + '\n' + source.slice(source.indexOf(end));
if (process.argv.includes('--check')) { if (updated !== source) throw new Error('Energy SQL configuration is out of date.'); }
else { await writeFile(path, updated); }
console.log('Energy configuration matches the server migration.');
const chestPath = new URL('../supabase/migrations/202610170003_unit_chest_energy.sql', import.meta.url);
const chestSource = await readFile(chestPath, 'utf8');
const chestStart = '-- CHEST_CONFIG_START', chestEnd = '-- CHEST_CONFIG_END';
const chestStatement = `update public.battery_rules set rules=jsonb_set(rules,'{chest}','${JSON.stringify(CHEST_ENERGY_CONFIG)}'::jsonb) where singleton;`;
const chestUpdated = chestSource.slice(0, chestSource.indexOf(chestStart) + chestStart.length) + '\n-- Generated from src/config/energy.ts. Do not edit these values here.\n' + chestStatement + '\n' + chestSource.slice(chestSource.indexOf(chestEnd));
if (process.argv.includes('--check')) { if (chestUpdated !== chestSource) throw new Error('Chest SQL configuration is out of date.'); }
else await writeFile(chestPath, chestUpdated);
console.log('Chest configuration matches the server migration.');
