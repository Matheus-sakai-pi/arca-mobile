import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import jpeg from 'jpeg-js';
import { test, expect } from './fixtures.ts';
import { capture } from './actions.ts';

const dashboard = new URL('../../../arca-dashboard/',import.meta.url);
const requireDashboard = createRequire(new URL('package.json',dashboard));
let script:string,html:string,css:string;
test.beforeAll(async()=>{
  const {build}=requireDashboard('esbuild');
  const result=await build({entryPoints:[fileURLToPath(new URL('src/app.js',dashboard))],bundle:true,write:false,format:'esm',define:{__SUPABASE_URL__:JSON.stringify('https://arca-e2e.supabase.co'),__SUPABASE_PUBLIC_KEY__:JSON.stringify('e2e-public-placeholder-not-a-production-key')}});
  script=result.outputFiles[0].text;
  html=(await readFile(new URL('index.html',dashboard),'utf8')).replaceAll('/app.js','/__admin/app.js').replaceAll('/app.css','/__admin/app.css');
  css=await readFile(new URL('src/app.css',dashboard),'utf8');
});

test('VIP photo waits privately, dashboard can approve/reject/remove, and the app updates without an unreviewed image leak',async({page,context,backend},info)=>{
  await backend.db.query("insert into admin_vip_grants(request_key,user_id,expires_at,reason) values('e2e-photo',$1,now()+interval '30 days','test')",[backend.owner]);
  await backend.db.query('insert into arca_admins(user_id) values($1)',[backend.owner]);
  await backend.install(context);
  await context.addInitScript(()=>{const session=localStorage.getItem('sb-arca-e2e-auth-token');if(session)localStorage.setItem('arca.admin.session.v1',session);});
  await context.route('**/__admin/**',async route=>{
    const name=new URL(route.request().url()).pathname;
    if(name.endsWith('/app.js'))await route.fulfill({contentType:'text/javascript',body:script});
    else if(name.endsWith('/app.css'))await route.fulfill({contentType:'text/css',body:css});
    else await route.fulfill({contentType:'text/html',body:html});
  });
  await context.route('**/assets/**',async route=>{
    const name=new URL(route.request().url()).pathname.split('/').at(-1)!;
    if(!['arca.png','nunito.ttf','nunito-bold.ttf'].includes(name)){await route.fallback();return;}
    await route.fulfill({contentType:name.endsWith('.ttf')?'font/ttf':'image/png',body:await readFile(new URL(`public/assets/${name}`,dashboard))});
  });
  await page.goto('/profile');
  await page.getByRole('button',{name:'Foto de perfil',exact:true}).click();
  await expect(page.getByRole('button',{name:'Escolher foto',exact:true})).toBeVisible();
  const select=async()=>{
    const chooser=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:/^Escolher (outra )?foto$/}).click();
    await(await chooser).setFiles(fileURLToPath(new URL('../../assets/avatars/avatar-01.png',import.meta.url)));
    const consent=page.getByRole('checkbox',{name:'Tenho direito de usar esta foto e aceito as regras de envio.'});
    await expect(consent).toBeVisible();await consent.click();
    await page.getByRole('button',{name:'Enviar para aprovação',exact:true}).click();
    await expect(page.getByText('Foto aguardando aprovação',{exact:true})).toBeVisible();
  };
  await select();
  const pending=await backend.rpc<{latest:{id:string;state:string}}>('learning_profile_photo');
  expect(await backend.rpc('learning_profile_photo_view',{p_id:pending.latest.id},backend.friend)).toBeNull();
  await capture(page,info,'foto-pendente');
  const admin=await context.newPage();
  await admin.goto('/__admin/');
  await admin.getByRole('button',{name:'Fotos de perfil',exact:true}).click();
  const approve=admin.getByRole('button',{name:'Aprovar foto',exact:true});
  await expect(approve).toBeEnabled();
  await capture(admin,info,'painel-foto-pendente');
  await approve.click();
  await expect(admin.getByText('Foto aprovada.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Atualizar status da foto',exact:true}).click();
  await expect(page.getByText('Foto aprovada',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Fechar foto de perfil',exact:true}).click();
  await expect(page.getByRole('img',{name:'Seu avatar',exact:true})).toHaveAttribute('src',/storage\/v1\/object\/sign\/profile-photos/);
  await page.getByRole('button',{name:'Foto de perfil',exact:true}).click();await select();
  await admin.getByRole('button',{name:'Atualizar fotos',exact:true}).click();
  await expect(admin.getByRole('button',{name:'Rejeitar foto',exact:true})).toBeVisible();
  await admin.getByLabel('Motivo da rejeição ou remoção',{exact:true}).fill('Não segue as regras de envio.');
  await admin.getByRole('button',{name:'Rejeitar foto',exact:true}).click();
  await expect(admin.getByText('Foto rejeitada.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Atualizar status da foto',exact:true}).click();
  await expect(page.getByText('Foto não aprovada',{exact:true})).toBeVisible();
  const profile=(await backend.db.query<{avatar_key:string}>('select avatar_key from profiles where id=$1',[backend.owner])).rows[0]!;
  expect(profile.avatar_key).toBe(`photo:${pending.latest.id}`);
  await admin.getByRole('combobox',{name:'Filtrar fotos'}).selectOption('approved');
  await admin.getByLabel('Motivo da rejeição ou remoção',{exact:true}).fill('Foto removida após revisão.');
  await admin.getByRole('button',{name:'Remover foto',exact:true}).click();
  await expect(admin.getByText('Foto removida.',{exact:true})).toBeVisible();
  expect(await backend.rpc('learning_profile_photo_view',{p_id:pending.latest.id},backend.friend)).toBeNull();
  await admin.close();
});

test('free accounts cannot upload a photo and a failed status read remains retryable',async({page,context,backend})=>{
  await backend.install(context);await page.goto('/profile');
  backend.failNext('learning_profile_photo');
  await page.getByRole('button',{name:'Foto de perfil',exact:true}).click();
  await expect(page.getByText(/Não foi possível concluir/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Escolher foto',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Atualizar status da foto',exact:true}).click();
  await expect(page.getByRole('button',{name:'Conhecer Arca VIP',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enviar para aprovação',exact:true})).toHaveCount(0);
});

test('users can report an approved photo, block its owner and manage their own blocked list',async({page,context,backend},info)=>{
  const id=randomUUID(),hash='a'.repeat(64);
  await backend.db.query("insert into admin_vip_grants(request_key,user_id,expires_at,reason) values('e2e-friend-photo',$1,now()+interval '30 days','test')",[backend.friend]);
  await backend.db.query('insert into arca_admins(user_id) values($1)',[backend.owner]);
  await backend.db.query("select profile_photo_ingest($1,$2,$3,'reserve')",[backend.friend,id,hash]);
  backend.photos.set(`${backend.friend}/${id}.jpg`,new Uint8Array(jpeg.encode({width:32,height:32,data:new Uint8Array(32*32*4).fill(180)},80).data));
  await backend.db.query("select profile_photo_ingest($1,$2,$3,'finish')",[backend.friend,id,hash]);
  const stamp=(await backend.db.query<{updated:string}>('select updated_at::text updated from profile_photo_requests where id=$1',[id])).rows[0]!.updated;
  await backend.rpc('arca_admin_photo_review',{p_id:id,p_action:'approve',p_expected:stamp});
  await backend.befriend();await backend.install(context);await page.goto('/friends');
  await expect(page.getByText(`@${backend.username}`,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Opções da foto',exact:true}).click();
  await page.getByRole('radio',{name:'Violência gráfica',exact:true}).click();
  await page.getByRole('button',{name:'Enviar denúncia',exact:true}).click();
  await expect(page.getByText('Denúncia enviada para análise.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Bloquear usuário',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar bloqueio',exact:true}).click();
  await expect(page.getByText(/Usuário bloqueado\./)).toBeVisible();
  await capture(page,info,'foto-bloqueada');
  await page.getByRole('button',{name:'Fechar opções da foto',exact:true}).click();
  expect(await backend.rpc('learning_profile_photo_view',{p_id:id})).toBeNull();
  await page.goto('/profile');await page.getByRole('button',{name:'Foto de perfil',exact:true}).click();
  await expect(page.getByText('Usuários bloqueados',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
  await expect(page.getByText('Usuários bloqueados',{exact:true})).toHaveCount(0);
  expect(await backend.rpc('learning_profile_photo_view',{p_id:id})).toBe(`${backend.friend}/${id}.jpg`);
});
