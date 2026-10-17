# Dez perguntas por licao e cadastro direto

## Cadastro sem confirmacao de e-mail

O app ja utiliza a sessao real retornada pelo Supabase no cadastro. Nao e preciso SQL para desativar a confirmacao.

No painel do seu projeto Supabase, abra Authentication > Sign In / Providers > Email (em algumas versoes, Providers > Email). Mantenha Email habilitado, desligue Confirm email e salve. A partir disso, novos cadastros recebem uma sessao e entram no app sem abrir um link de confirmacao.

Em 14/10/2026, uma consulta somente de leitura ao endpoint publico de configuracao do seu Supabase confirmou que o cadastro esta habilitado e a confirmacao de e-mail ja esta desativada (`mailer_autoconfirm=true`). Nao foi necessario alterar essa configuracao. Se ela for reativada no futuro, o app preserva a tela correspondente em vez de simular uma sessao.

O e-mail continua necessario para entrar e recuperar a senha. Sem confirmacao, nao se comprova que a pessoa e dona do endereco informado; um erro de digitacao pode impedir a recuperacao. Recuperacao de senha continua precisando de SMTP de producao e de `arca://auth/callback` autorizado em Authentication > URL Configuration. Contas antigas nao confirmadas devem ser verificadas individualmente no painel; desligar a opcao nao garante corrigir todas retroativamente.

Referencia oficial: https://supabase.com/docs/guides/auth/passwords

## Banco existente

Antes de distribuir a nova versao, abra o SQL Editor do mesmo projeto e execute o arquivo inteiro `supabase/migrations/202610140001_ten_exercises.sql`. Ele pressupoe as migrations anteriores, inclusive `202610080001_expanded_curriculum.sql`, ja aplicadas. Esse arquivo inclui o conteudo novo; nao precisa executar o seed separadamente.

Nao apague tabelas nem refaca as migrations anteriores. A atualizacao preserva contas, avatares, progresso, XP, streaks e resultados antigos. Tentativas offline antigas de cinco perguntas continuam aceitas. O seed atualizado e para ambientes que ja tenham todas as migrations.

Conferencia no SQL Editor:

```sql
select l.id, count(*) as exercicios
from public.lessons l
join public.units u on u.id=l.unit_id
join public.questions q on q.lesson_id=l.id
where u.course_id='biblia-basica' and q.order_index<1000
  and q.type<>'content_card'
group by l.id
having count(*)<>10;
```

O resultado esperado e nenhuma linha: sao 100 licoes, dez por unidade, com dez exercicios cada. As duas leituras sao adicionais e nao contam como perguntas nem concedem XP.

## Comportamento

- Uma resposta errada mostra feedback normal e devolve a pergunta ao fim da fila ao continuar.
- Se errar de novo, ela retorna novamente. A licao termina quando todas forem corrigidas.
- As repeticoes reiniciam a selecao e mantem som, vibracao e explicacao.
- A barra conta perguntas ja acertadas; nao chega a 100% com erros pendentes.
- Precisao e XP consideram apenas a primeira resposta: +2 por acerto inicial, +10 pela conclusao e +5 se acertar todas de primeira. Dez acertos iniciais rendem 35 XP; oito rendem 26 XP.
- Repetir uma licao concluida continua sem conceder XP adicional.
- As cinco perguntas existentes e seus IDs foram preservados. As cinco complementares praticam os fatos do tema com associacao reversa, lacuna, selecao multipla, sequencia e verdadeiro/falso; nao representam cinco fatos novos em cada licao.

## Teste manual

1. Aplique a migration e desligue Confirm email no painel.
2. Na versao atualizada, cadastre um novo e-mail valido. Deve entrar sem confirmacao. Saia e entre novamente com a senha.
3. Abra uma licao: o contador deve informar dez exercicios. Erre o primeiro e o ultimo; acerte os outros oito.
4. Apos o decimo, as duas perguntas erradas devem reaparecer na ordem. Erre a primeira de novo e confira que ela passa para depois da outra.
5. Acerte ambas. O resultado deve mostrar 8/10, 80% e 26 XP se a licao ainda nao estava concluida.
6. Feche e reabra. Confira XP, avatar, conclusao e desbloqueio. Revise a mesma licao: deve receber zero XP.
7. Em modo aviao, conclua outra licao e reabra o app. Ao reconectar, sincronize e confira que XP nao duplica.
8. Confira os formatos de pares, ordenacao e pistas quando repetidos; a selecao deve comecar vazia. Teste som certo/errado e o botao de sair.

Esta rodada nao configura EAS Update nem publica um novo AAB. A versao ja instalada pela Play Store precisa de um novo build/atualizacao para receber a fila de revisao. O conteudo remoto pode chegar antes, apos aplicar o SQL; a versao antiga aceita os formatos usados nas perguntas extras.
