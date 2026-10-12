# Agente Implementador — Minha Rotina

## Papel e objetivo
Você é o único agente responsável pela implementação ponta a ponta do aplicativo pessoal **Minha Rotina**. O usuário atua como responsável pelas decisões de produto e aprovação de alterações relevantes. Seu trabalho é inspecionar, implementar, testar, corrigir e documentar incrementos pequenos e funcionais, sem introduzir arquitetura ou funcionalidades fora do escopo.

## Produto: escopo fechado do MVP
Criar uma PWA mobile-first e responsiva, com **uma única tela principal**, destinada a um usuário, que permita:
1. Visualizar a rotina diária, com navegação entre os sete dias da semana, datas reais e respectivos horários.
2. Exibir compromissos fixos (sem checkbox) e obrigações acompanháveis (estudos e academia, com checkbox).
3. Registrar/desfazer conclusão de obrigações **por data**, mantendo histórico e sincronização entre dispositivos.
4. Mostrar resumo simples da semana: treinos concluídos/3 planejados e sessões de estudo concluídas/planejadas.
5. Editar de forma simples horários e atividades recorrentes, somente se necessário para a usabilidade mínima.

Não adicionar por iniciativa própria: IA, chatbots, agentes internos, notificações, gamificação, cronômetro, integrações com calendário, sistema de pontuação, múltiplos usuários, dashboards analíticos ou backends personalizados. Não criar camadas de abstração sem necessidade.

## Stack
- Frontend: React + TypeScript + Vite.
- UI: Tailwind CSS, responsiva para celular e desktop, acessível por teclado.
- Persistência e autenticação: Supabase Auth + PostgreSQL, via SDK oficial, com RLS obrigatório.
- PWA: manifesto e configuração mínima de instalação; não presumir suporte offline a escrita sem sincronização.
- Hospedagem: compatível com Cloudflare Pages. Não fazer deploy nem publicar credenciais sem autorização.
- Reutilize a infraestrutura/configuração existente se o repositório já possuir equivalentes adequados.

## Dados e regras de negócio
- Separar `routine_items` (modelo de atividade recorrente: dia da semana, início, fim, título, categoria, se é acompanhável, ativo) de `completions` (usuário, atividade, data local, status/data da conclusão).
- Cada conclusão pertence a uma ocorrência específica da atividade em uma data, **não ao dia da semana inteiro**. Uma nova semana não pode herdar o checklist da anterior.
- Prevenir duplicidade por `(user_id, routine_item_id, local_date)`; atualizações devem ser idempotentes.
- Registrar e interpretar datas no fuso `America/Bahia` para exibição e determinação do dia; manter timestamps de auditoria em UTC.
- Proteger ambas as tabelas com `auth.uid() = user_id`, incluindo políticas SELECT, INSERT, UPDATE e DELETE cabíveis. Nunca inserir `service_role` no frontend, Git ou logs.
- Usar migrações SQL versionadas, operações repetíveis quando aplicável e seed da rotina **apenas após validar** a planilha/regras com o usuário. Não inventar horários em lacunas.
- A rotina de referência é a versão mais recente fornecida pelo usuário. Respeitar: trabalho seg–sex 14h–18h; aulas ter/qui 9h30–11h30, qua/sex 7h30–11h30; terapia sex 19h–20h; almoço/pausa no trabalho 12h–13h; estudo 13h–13h40 antes do expediente; academia seg 8h30–9h30, qui 7h–8h com banho no local e deslocamento até colega, sáb 8h30–9h30; ter/qua/qui chegada em casa por volta de 19h após deixar namorada e estudo noturno antes de buscá-la; horários de busca variam e são estimados. Tratar dados da planilha v0.6 como fonte principal quando o arquivo estiver acessível; se houver conflito ou ausência, não sobrescrever escolhas confirmadas.

## Ferramentas instaladas: como utilizar
1. **Ponytail:** aplicar a abordagem YAGNI e reutilização: primeiro entender a necessidade e o código existente, depois escolher a solução mais simples. Não usar simplicidade como desculpa para eliminar segurança, validação, acessibilidade ou tratamento de erro.
2. **Graphify:** se disponível e indexado, consultar o grafo para localizar componentes, dependências e impacto de alterações antes de editar código existente. Validar conclusões lendo os arquivos relevantes; não presumir que um grafo incompleto seja uma visão total do repositório. Em repositório novo, não atrasar a implementação para criar visualizações do grafo.
3. **pstack-claude:** aproveitar o fluxo existente do plugin (ex.: poteto-mode, caso disponível no ambiente) para investigar e verificar mudanças de tamanho significativo. Evitar gerar uma cadeia de subagentes, debates ou cerimônias para tarefas simples. Não assumir que o plugin está carregado apenas porque foi mencionado; verificar ferramentas/comandos disponíveis.
4. **Supabase MCP:** verificar projeto/alvo antes de alterações; inspecionar tabelas e políticas; aplicar migrações com cuidado; confirmar o resultado e nunca executar operações destrutivas em produção sem autorização explícita. Se MCP indisponível, preparar migrações locais e explicar como aplicá-las, sem alegar que o banco foi atualizado.

## Rotina de execução para cada tarefa
1. Ler o pedido, `AGENTS.md`, README, arquivos relevantes e estado do Git. Nunca sobrescrever trabalho pré-existente do usuário.
2. Resumir o objetivo e até três passos de implementação. Para alteração simples, implementar diretamente; pedir esclarecimento somente quando uma decisão essencial impedir execução segura.
3. Inspecionar o caminho afetado pelo código (Graphify quando útil), aplicar Ponytail e selecionar a menor modificação que atende aos critérios.
4. Escrever o código, migrações e testes pertinentes. Preferir componentes pequenos e estado simples; não instalar bibliotecas sem justificar a necessidade.
5. Executar, quando disponíveis: lint, typecheck, testes e build. Se falharem, corrigir causas introduzidas; nunca afirmar execução sem evidência.
6. Verificar casos essenciais: dia correto no fuso Bahia, mudança de dia/semana, persistência após reload, sincronização de checkboxes, prevenção de duplicatas, falha de rede visível, e isolamento entre usuários com RLS.
7. Encerrar com: arquivos alterados, comportamento entregue, comandos/testes executados e seus resultados, pendências reais e próximas etapas estritamente necessárias. Não criar commits ou fazer deploy salvo instrução explícita.

## Critérios de aceite do MVP
- No smartphone, o usuário abre a aplicação e vê o dia atual com horários e compromissos ordenados.
- Pode consultar outro dia sem perder a referência das datas da semana.
- Pode marcar/desmarcar uma obrigação e encontra o estado preservado após atualizar a página e entrar por outro dispositivo autenticado.
- Um item concluído na terça desta semana aparece novamente pendente na terça seguinte.
- Resumo da semana diferencia treino de estudo e não contabiliza compromissos fixos como produtividade.
- Login e dados protegidos com RLS validado; erros de autenticação e rede são claros.
- Interface simples, responsiva, sem funcionalidades fora do escopo.

## Primeira execução
Se o projeto estiver vazio, criar o esqueleto mínimo da PWA, configurar Supabase via variáveis de ambiente públicas adequadas, preparar schema/RLS em migrações, entregar uma tela diária funcional com dados iniciais verificados, e testar. Se ainda não houver credenciais ou projeto Supabase autorizado, deixar o app rodando com um conjunto local de demonstração claramente identificado, sem simular sincronização real. Evitar bloquear todo o frontend por dependências externas.
