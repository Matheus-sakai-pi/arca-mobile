# VIP administrativo de teste

Concessao gratuita de 30 dias para `matheussakai23032001@gmail.com`, solicitada pelo titular. O prazo comeca na primeira execucao do arquivo de concessao, usando o horario do servidor.

## Ativacao

No SQL Editor do Supabase, com a conta administradora do projeto:

1. Execute `artifacts/membership/ativar-vip-teste-30-dias.sql`. Esse arquivo instala o suporte e concede o presente; o resultado mostra a conta e a data de vencimento. As migrations VIP anteriores precisam estar aplicadas.
2. Reabra o app ou use **Conferir beneficios** na tela VIP. O app tambem atualiza os beneficios periodicamente.

O arquivo pode ser executado novamente. A mesma concessao nunca renova nem acumula dias ao repetir o arquivo. Se o e-mail nao corresponder a exatamente uma conta com perfil, a concessao falha sem liberar VIP. Uma conta recriada nao herda a concessao da conta excluida.

As partes separadas tambem estao disponiveis para controle de migrations: `supabase/migrations/202610180007_admin_vip.sql` instala o suporte sem conceder VIP a ninguem; `artifacts/membership/conceder-vip-teste-30-dias.sql` apenas concede o presente apos a instalacao.

## Conta do testador

Para `matsakteste@gmail.com`, execute `artifacts/membership/ativar-vip-testador-30-dias.sql`. O arquivo instala o mesmo suporte, se necessario, e concede outros 30 dias gratuitos apenas a essa conta. O usuario precisa ter criado sua conta no Arca antes. A concessao do titular nao e alterada. Repetir o arquivo nao renova o prazo nem reativa uma concessao revogada.

A parte de concessao isolada esta em `artifacts/membership/conceder-vip-testador-30-dias.sql`. Para revogar apenas esse presente, o administrador pode definir `revoked_at=now()` em `admin_vip_grants` para a chave `tester-matsakteste-2026-10-18-30-days`.

Essa liberacao permite testar beneficios VIP; nao substitui a configuracao de testadores de licenca nem comprova que a cobranca Google Play esteja funcionando.

## Beneficios e limites

- Bateria infinita, XP extra em novas licoes e personalizacao VIP usam a mesma verificacao de permissao no servidor.
- Expira automaticamente em 30 dias. Nao existe renovacao, cobranca ou compra ficticia.
- Nenhum token ou recibo Google Play e criado, alterado ou simulado. A verificacao e o prazo de seguranca das assinaturas reais permanecem intactos.
- Convites continuam concedendo apenas bateria infinita, nao VIP.
- A tabela privada `admin_vip_grants` registra motivo, operador, datas e revogacao. Os usuarios do app nao conseguem ler ou escrever concessoes nem chamar o helper interno.
- A exclusao da conta remove a ligacao com o usuario, mantendo o registro administrativo sem e-mail. A concessao nao pode ser reutilizada por outra conta.
- Para encerrar antecipadamente, execute `artifacts/membership/revogar-vip-teste.sql`. Uma assinatura Google Play valida permanece ativa independentemente da revogacao do presente.

Esta implementacao nao acrescenta um botao de concessao no painel e nao habilita a venda de assinaturas. A ativacao em producao depende da execucao dos arquivos pelo administrador; testes locais nao a realizam.
