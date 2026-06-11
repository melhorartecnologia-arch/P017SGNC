"""Gera o PDF do backlog do SGNC em português.

Estrutura:
- Página 1: Casos de Uso entregues até o momento.
- Demais páginas: PBIs em ordem cronológica, com título e descrição
  em português escritos manualmente (NÃO traduzidos automaticamente
  do git log, para garantir consistência terminológica).

Paleta:
- DOURADO #B38335 (RGB 179, 131, 53)  — accent
- PRETO   #272525 (RGB 39, 37, 37)    — texto principal
"""
import re
import subprocess
import pathlib
from collections import OrderedDict
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
    PageBreak,
)

# ----------------------------------------------------------------------
# Paleta de identidade
# ----------------------------------------------------------------------
DOURADO = HexColor("#B38335")
PRETO = HexColor("#272525")
DOURADO_CLARO = HexColor("#F5EBDA")
DOURADO_ESCURO = HexColor("#8C6429")
CINZA_TEXTO = HexColor("#5A5454")
CINZA_LINHA = HexColor("#D8D2C9")
BRANCO = HexColor("#FFFFFF")

PT_MONTH = {
    "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
    "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
    "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
}

TYPE_STYLE = {
    "feat":     ("Funcionalidade", DOURADO, BRANCO),
    "fix":      ("Correção",       PRETO,   BRANCO),
    "refactor": ("Refatoração",    None,    DOURADO),
    "docs":     ("Documentação",   None,    PRETO),
    "chore":    ("Ajuste técnico", None,    CINZA_TEXTO),
}
OUTROS_STYLE = ("Outros", None, CINZA_TEXTO)


# ----------------------------------------------------------------------
# Casos de Uso entregues — agrupados por área
# ----------------------------------------------------------------------
CASOS_DE_USO = [
    {
        "id": "UC-01",
        "area": "Acesso ao sistema",
        "nome": "Autenticação por e-mail e senha",
        "descricao": (
            "Usuários acessam o sistema com e-mail e senha. As "
            "credenciais são validadas no servidor (bcrypt) e a "
            "sessão é mantida via token JWT armazenado no "
            "navegador. Endpoints da API protegidos pelo middleware "
            "de autenticação."
        ),
    },
    {
        "id": "UC-02",
        "area": "Acesso ao sistema",
        "nome": "Gestão de usuários (apenas administradores)",
        "descricao": (
            "Administradores cadastram, editam, ativam/desativam e "
            "excluem usuários do sistema, atribuindo o perfil "
            "(Administrador ou Usuário). O próprio usuário logado "
            "não pode desativar nem excluir a sua própria conta."
        ),
    },
    {
        "id": "UC-03",
        "area": "Cadastros básicos",
        "nome": "Cadastro de filiais",
        "descricao": (
            "Permite registrar as unidades produtoras da cervejaria "
            "(código, razão social, CNPJ, endereço, cidade, UF e "
            "CEP). Filiais inativas continuam visíveis mas não são "
            "selecionáveis em outros cadastros."
        ),
    },
    {
        "id": "UC-04",
        "area": "Cadastros básicos",
        "nome": "Cadastro de fornecedores com contatos",
        "descricao": (
            "Cadastro de fornecedores (código, razão social, nome "
            "fantasia, CNPJ) com lista aninhada de contatos do tipo "
            "telefone, WhatsApp ou e-mail. Um contato pode ser "
            "marcado como principal."
        ),
    },
    {
        "id": "UC-05",
        "area": "Cadastros básicos",
        "nome": "Cadastro de áreas",
        "descricao": (
            "Cadastro global das áreas organizacionais (Produção, "
            "Qualidade, Manutenção, etc.). As áreas são usadas pelos "
            "aprovadores e por outros fluxos do sistema."
        ),
    },
    {
        "id": "UC-06",
        "area": "Cadastros básicos",
        "nome": "Cadastro de aprovadores por filial × área × nível",
        "descricao": (
            "Define quem aprova em cada combinação de filial e área, "
            "respeitando um nível de escalonamento único por trio "
            "(filial, área, nível). Aprovadores podem opcionalmente "
            "ser vinculados a um turno de trabalho da mesma filial."
        ),
    },
    {
        "id": "UC-07",
        "area": "Cadastros básicos",
        "nome": "Cadastro de produtos",
        "descricao": (
            "Catálogo de produtos (matéria-prima, insumo, produto "
            "acabado) com código, descrição e unidade de medida. "
            "Usado posteriormente em vínculos com tipos de não "
            "conformidade e na criação de RNCs."
        ),
    },
    {
        "id": "UC-08",
        "area": "Cadastros básicos",
        "nome": "Cadastro de turnos de trabalho por filial",
        "descricao": (
            "Define os turnos de cada filial (manhã, tarde, noite, "
            "comercial, etc.) com hora de início e fim em formato "
            "HH:MM. O código do turno é único dentro da filial, "
            "permitindo que cada unidade tenha o seu próprio MANHA."
        ),
    },
    {
        "id": "UC-09",
        "area": "Cadastros de não conformidade",
        "nome": "Cadastro de severidades",
        "descricao": (
            "Classifica a gravidade de uma não conformidade. Cada "
            "severidade tem nível (inteiro único), código, nome "
            "e cor opcional para representar visualmente nas "
            "telas do sistema."
        ),
    },
    {
        "id": "UC-10",
        "area": "Cadastros de não conformidade",
        "nome": "Cadastro de origens da não conformidade",
        "descricao": (
            "Lista das fontes que podem originar um registro de "
            "não conformidade (auditoria, cliente, inspeção, "
            "processo, laboratório, fornecedor)."
        ),
    },
    {
        "id": "UC-11",
        "area": "Cadastros de não conformidade",
        "nome": "Cadastro de disposições do material",
        "descricao": (
            "Define os destinos possíveis para o material objeto "
            "da não conformidade (retrabalho, sucata, devolver ao "
            "fornecedor, aceitar sob concessão, etc.)."
        ),
    },
    {
        "id": "UC-12",
        "area": "Cadastros de não conformidade",
        "nome": "Cadastro de tipos de relatório",
        "descricao": (
            "Categoriza os relatórios emitidos pelo sistema (RNC, "
            "RAQ, RHE, RVT). Severidades, origens e disposições "
            "podem ser associadas aos tipos de relatório em que "
            "aparecem (M:N)."
        ),
    },
    {
        "id": "UC-13",
        "area": "Cadastros de não conformidade",
        "nome": "Cadastro de tipos de não conformidade",
        "descricao": (
            "Categoriza os defeitos identificados (dimensional, "
            "contaminação, etiqueta, etc.) com vínculo opcional a "
            "uma severidade típica e aos produtos que costumam "
            "apresentar este tipo de defeito."
        ),
    },
    {
        "id": "UC-14",
        "area": "Cadastros de não conformidade",
        "nome": "Cadastro de políticas de resposta",
        "descricao": (
            "Para cada tipo de relatório, define em quantas horas "
            "contínuas a assinatura/resposta precisa ser realizada "
            "(unicidade garantida: uma política por tipo de "
            "relatório)."
        ),
    },
    {
        "id": "UC-15",
        "area": "Listagem e produtividade",
        "nome": "Paginação, busca e filtros nas listagens",
        "descricao": (
            "Todas as telas de cadastro buscam dados da API com "
            "paginação de 20 registros por página, busca textual e, "
            "quando aplicável, filtros por status, filial e área. "
            "A navegação preserva os filtros ativos."
        ),
    },
    {
        "id": "UC-16",
        "area": "Listagem e produtividade",
        "nome": "Exportação para Excel (página atual ou todo o cadastro)",
        "descricao": (
            "Cada listagem permite exportar para XLSX. Antes de baixar, "
            "o usuário escolhe entre exportar apenas a página atual ou "
            "todo o cadastro (com paginação automática respeitando os "
            "filtros aplicados)."
        ),
    },
    {
        "id": "UC-17",
        "area": "Listagem e produtividade",
        "nome": "Importação em massa via planilha Excel",
        "descricao": (
            "Cada cadastro aceita importação de registros via XLSX, "
            "incluindo modelo para download, pré-visualização da "
            "quantidade de linhas, execução com indicador de progresso "
            "e relatório final com erros linha a linha."
        ),
    },
    {
        "id": "UC-18",
        "area": "Listagem e produtividade",
        "nome": "Exclusão em massa com confirmação dupla",
        "descricao": (
            "Após selecionar registros via caixas de seleção, o usuário "
            "pode excluir vários de uma só vez. Antes da exclusão, é "
            "exigida uma confirmação em duas etapas (revisão da lista "
            "e digitação da palavra EXCLUIR)."
        ),
    },
    {
        "id": "UC-19",
        "area": "Relatório de Não Conformidade (RNC)",
        "nome": "Criação de RNC em assistente de 5 etapas",
        "descricao": (
            "O usuário cria um RNC em um modal com 5 etapas: "
            "Identificação (filial, data, tipo, turno) → Fornecedor → "
            "Material e transporte (produto, lote, quantidades, NF, "
            "datas, placas, motorista) → Disposição, origem, severidade "
            "e descrição do defeito → Fotos. O rascunho é gravado "
            "automaticamente ao avançar para a etapa de fotos."
        ),
    },
    {
        "id": "UC-20",
        "area": "Relatório de Não Conformidade (RNC)",
        "nome": "Histórico de RNCs similares ao selecionar fornecedor",
        "descricao": (
            "Ao escolher o fornecedor na etapa 2 do assistente, o "
            "sistema busca e exibe as 3 últimas RNCs registradas para o "
            "mesmo fornecedor e o mesmo tipo de não conformidade, "
            "ajudando a identificar reincidências."
        ),
    },
    {
        "id": "UC-21",
        "area": "Relatório de Não Conformidade (RNC)",
        "nome": "Anexar fotos ao RNC",
        "descricao": (
            "O RNC permite anexar imagens (JPG, PNG, WebP, GIF) por "
            "arrastar-e-soltar ou clique. As fotos são armazenadas no "
            "servidor, exibidas em grade de miniaturas com lightbox em "
            "tela cheia e navegação entre as imagens via setas do "
            "teclado."
        ),
    },
    {
        "id": "UC-22",
        "area": "Relatório de Não Conformidade (RNC)",
        "nome": "Listagem de RNCs com filtros de status",
        "descricao": (
            "Item de menu 'RNCs' abre a lista de todos os relatórios "
            "registrados com número, data, filial, fornecedor, tipo "
            "(com severidade típica), turno, status e autor do "
            "registro. Filtro por status (Rascunho, Aberta, Em "
            "andamento, Encerrada, Cancelada) e busca textual."
        ),
    },
    {
        "id": "UC-23",
        "area": "Relatório de Não Conformidade (RNC)",
        "nome": "Edição e visualização detalhada do RNC",
        "descricao": (
            "Cada linha da lista de RNCs oferece ações de visualizar "
            "(painel lateral à direita, ocupando 75% da tela, com "
            "todos os dados em lâmina única) e editar (reabre o mesmo "
            "assistente em modo edição, preservando o status atual). "
            "O painel lateral também permite anexar/excluir fotos."
        ),
    },
]


# ----------------------------------------------------------------------
# PBIs em PT — curados manualmente a partir do contexto de cada commit
# ----------------------------------------------------------------------
PBI_PT = {
    "f5bf47bd": (
        "Aplicação React inicial com painel SGNC (clone Acme Inc.)",
        (
            "Cria a base do projeto com Vite, TypeScript, Tailwind CSS e "
            "componentes no estilo shadcn. Inclui a barra lateral, quatro "
            "cartões de KPI (Receita, Clientes, Contas, Crescimento), "
            "gráfico de área empilhada com Recharts e tabela de documentos "
            "com abas e seleção de linhas — todos com dados simulados no "
            "cliente."
        ),
    ),
    "0b5e94d1": (
        "Renomeação da identidade para SGNC",
        (
            "Substitui o texto Acme Inc. da barra lateral pela identidade "
            "do projeto: SGNC — Sistema de Gestão de Não Conformidade. "
            "Atualiza também o título da página principal."
        ),
    ),
    "b446560f": (
        "Seção Cadastros no menu com placeholders",
        (
            "Adiciona o grupo Cadastros à barra lateral com cinco itens "
            "(Filial, Fornecedor, Disposição de Material, Origem da Não "
            "Conformidade e Severidade). Cada item troca o conteúdo "
            "central por uma tela 'Em construção' e atualiza o título."
        ),
    ),
    "cfbe2b8b": (
        "Botão Criar Registro vira menu suspenso",
        (
            "Substitui o botão de criação rápida por um dropdown com as "
            "quatro opções de relatório (RNC, RAQ, RHE, RVT), cada uma "
            "com ícone, sigla e descrição completa."
        ),
    ),
    "68c288f3": (
        "Ajuste nas descrições das opções de Criar Registro",
        (
            "Corrige os textos das opções do dropdown Criar Registro "
            "para refletirem a nomenclatura correta de cada tipo de "
            "relatório (RNC, RAQ, RHE, RVT)."
        ),
    ),
    "8f995f54": (
        "Backend Express + PostgreSQL e CRUD de Filial",
        (
            "Adiciona um servidor Express integrado ao PostgreSQL via "
            "Prisma. Implementa o CRUD completo de Filial (modelo, "
            "migration, schemas Zod, rotas REST e tela no cliente)."
        ),
    ),
    "58530174": (
        "Startup unificado: Postgres, migrate, seed e cliente",
        (
            "Centraliza o passo a passo de inicialização em um único "
            "comando: sobe o PostgreSQL local, aplica as migrations, "
            "executa o seed e inicia simultaneamente o backend e o "
            "cliente em modo de desenvolvimento."
        ),
    ),
    "360f17f4": (
        "Remoção do Docker no startup de desenvolvimento",
        (
            "Simplifica a inicialização do ambiente de desenvolvimento, "
            "passando a depender de uma instância PostgreSQL local em "
            "vez de containers Docker."
        ),
    ),
    "109d9335": (
        "Migração de pnpm para npm",
        (
            "Substitui o gerenciador de pacotes pnpm por npm em todos "
            "os scripts e instruções, evitando dependência adicional "
            "no ambiente local."
        ),
    ),
    "a0cd00a1": (
        "Atalho 'npm start' para o comando de desenvolvimento",
        (
            "Cria o alias 'npm start' executando o mesmo comando que "
            "'npm run dev', simplificando o uso do projeto."
        ),
    ),
    "7873c54a": (
        "Erros da API agora aparecem no console do desenvolvimento",
        (
            "Ajusta o npm run dev para que falhas do backend apareçam "
            "junto com a saída do cliente, facilitando a depuração."
        ),
    ),
    "6d7d424e": (
        "Limpeza de campos opcionais da Filial",
        (
            "Remove Inscrição Estadual, Responsável, Telefone e E-mail "
            "do cadastro de filiais por não serem essenciais para o "
            "modelo de negócios atual."
        ),
    ),
    "772a8280": (
        "Cadastro de Fornecedor com contatos aninhados",
        (
            "Cria o CRUD completo de Fornecedor (código, razão social, "
            "nome fantasia, CNPJ) com lista de contatos do tipo "
            "telefone fixo, WhatsApp ou e-mail, e marcação de contato "
            "principal."
        ),
    ),
    "9a369a52": (
        "Modal de Fornecedor mais amplo e enxuto",
        (
            "Aumenta a largura do modal de cadastro do Fornecedor para "
            "acomodar bem os contatos e remove os campos de endereço, "
            "que não são utilizados no fluxo atual."
        ),
    ),
    "911076e8": (
        "Animações suaves, skeletons e toasts de confirmação",
        (
            "Refina a experiência das telas de cadastro: animações "
            "suaves nos modais e dropdowns, skeletons de carregamento "
            "nas tabelas e notificações de confirmação após cada ação."
        ),
    ),
    "3ce85a11": (
        "Cadastros de Área e Aprovador",
        (
            "Adiciona o CRUD global de Área (Produção, Qualidade, "
            "Manutenção, Logística, Comercial) e o CRUD de Aprovador, "
            "com vínculo a uma filial e a uma área."
        ),
    ),
    "dabeb8a4": (
        "Aprovador ganha nível com unicidade por (filial, área)",
        (
            "Acrescenta o campo Nível ao aprovador. Garante via restrição "
            "do banco que só haja um aprovador por nível em cada "
            "combinação de filial e área."
        ),
    ),
    "606aa42b": (
        "Cadastro de Severidade",
        (
            "Cria o CRUD de Severidade, com código, nome, nível único "
            "(inteiro), cor opcional e descrição. Aplicável a tipos "
            "de relatório e tipos de defeito."
        ),
    ),
    "1c78c897": (
        "Cadastro de Origem da Não Conformidade",
        (
            "Adiciona o CRUD da Origem da NC: fonte que motivou o "
            "registro (auditoria, cliente, fornecedor, inspeção, "
            "processo, laboratório)."
        ),
    ),
    "b0cd9390": (
        "Seed da Severidade tolerante a dados pré-existentes",
        (
            "Corrige o seed para reaproveitar a linha existente quando "
            "já há uma severidade com o mesmo nível porém código "
            "diferente, evitando violação de unicidade."
        ),
    ),
    "7aca6ee6": (
        "Cadastro de Disposição do Material",
        (
            "Cria o CRUD de Disposição do Material: destino dado ao "
            "material com defeito (retrabalho, sucata, devolução, "
            "aceitar sob concessão, etc.)."
        ),
    ),
    "33cb3b6a": (
        "Autenticação por e-mail/senha com JWT",
        (
            "Adiciona autenticação ao sistema: tela de login, hash de "
            "senha com bcrypt, emissão de JWT, middleware que protege "
            "todas as rotas e contexto de sessão no cliente. Seed cria "
            "o usuário administrador padrão."
        ),
    ),
    "e588c3ff": (
        "Gestão de Usuários (somente administradores)",
        (
            "Cria o CRUD de Usuários acessível apenas pelo perfil "
            "Administrador. O próprio usuário logado não pode rebaixar "
            "seu perfil, desativar nem excluir a si mesmo. Senha "
            "obrigatória na criação e opcional na edição."
        ),
    ),
    "2e51e264": (
        "Itens do menu mudam de 'Registro' para 'Relatório'",
        (
            "Corrige a nomenclatura no menu de criação: RNC, RAQ, RHE "
            "e RVT são Relatórios, não Registros. Atualiza rótulos e "
            "cabeçalho do dropdown."
        ),
    ),
    "e5920625": (
        "Remoção do ícone de envelope ao lado de Criar Relatório",
        (
            "Limpa visualmente a barra lateral retirando o botão de "
            "envelope que não tinha ação associada."
        ),
    ),
    "c43ff412": (
        "Renomeação dos itens do menu principal",
        (
            "Dashboard vira Painel Principal, Lifecycle vira "
            "Acompanhamento e Analytics vira Pendências de "
            "Assinaturas. Itens Projects e Team são removidos."
        ),
    ),
    "24a7eb7b": (
        "Cadastro de Tipos de Relatórios",
        (
            "Adiciona o CRUD de Tipos de Relatórios (RNC, RAQ, RHE, "
            "RVT, etc.) para categorizar os documentos emitidos pelo "
            "sistema."
        ),
    ),
    "47c6600b": (
        "Vínculo M:N de Tipo de Relatório com Severidade, Origem e Disposição",
        (
            "Severidades, origens e disposições podem ser marcadas como "
            "aplicáveis a um ou mais tipos de relatório. Cada CRUD ganha "
            "um seletor múltiplo de tipos e uma coluna com badges na "
            "listagem."
        ),
    ),
    "8237ebb3": (
        "Limpeza visual da interface (GitHub, Documents, Footer)",
        (
            "Remove o botão GitHub do cabeçalho, a seção Documents da "
            "barra lateral e os itens Settings, Get Help e Search do "
            "rodapé do menu."
        ),
    ),
    "796374ee": (
        "Cadastro de Produto",
        (
            "Cria o CRUD de Produto com código, descrição e unidade "
            "de medida (UN, KG, L, M, M², etc., com sugestões via "
            "datalist)."
        ),
    ),
    "30b76452": (
        "Destaque mais sutil no item ativo do menu",
        (
            "Substitui o destaque preto sólido do item selecionado na "
            "barra lateral por um cinza claro, mais alinhado à paleta "
            "discreta do menu."
        ),
    ),
    "ae9b26ba": (
        "Botão 'Criar Relatório' deixa de ter destaque permanente",
        (
            "O gatilho do dropdown Criar Relatório passa a ter o mesmo "
            "comportamento dos demais itens do menu (sem fundo escuro "
            "fixo)."
        ),
    ),
    "61ab639e": (
        "Cadastro de Tipo de Não Conformidade com vínculo a produtos",
        (
            "Adiciona o CRUD de Tipo de Não Conformidade. Cada tipo "
            "pode ser opcionalmente relacionado a múltiplos produtos "
            "(M:N) por meio de seletor com busca."
        ),
    ),
    "e1be3e87": (
        "Seletor de produtos com busca sob demanda (não carrega tudo)",
        (
            "Reformula o vínculo Tipo NC × Produto: em vez de exibir a "
            "lista completa no modal, o usuário pesquisa o produto pelo "
            "código ou descrição e os resultados são selecionáveis um a "
            "um."
        ),
    ),
    "f6ba078b": (
        "Ação 'Adicionar todos' no seletor de produtos filtrados",
        (
            "Inclui um botão para vincular de uma só vez todos os "
            "produtos retornados pela busca atual ao tipo de não "
            "conformidade em edição."
        ),
    ),
    "79c5fa16": (
        "Visualização Tipo de NC × Produto",
        (
            "Listagem de Tipos de Não Conformidade ganha uma alternância "
            "entre dois modos: agrupado (uma linha por tipo, com "
            "produtos como pílulas) e expandido (uma linha por relação "
            "tipo × produto)."
        ),
    ),
    "8016037b": (
        "Exportação para Excel em todas as listas de cadastro",
        (
            "Cada tela de cadastro ganha um botão 'Exportar' que gera "
            "um arquivo .xlsx com colunas adequadas à entidade. "
            "Inicialmente exporta a página atualmente carregada."
        ),
    ),
    "90cf6b2a": (
        "Importação por planilha Excel em todas as listas de cadastro",
        (
            "Adiciona botão 'Importar' em cada cadastro, com download "
            "de modelo, leitura da planilha, pré-visualização, execução "
            "linha a linha e relatório final detalhando sucessos e "
            "erros."
        ),
    ),
    "c0e4b94e": (
        "Paginação real via API nas listagens de cadastro",
        (
            "Substitui o carregamento de até 100 registros por uma "
            "paginação API-side com 20 por página. Acrescenta controle "
            "de navegação no rodapé da tabela e preserva busca e "
            "filtros."
        ),
    ),
    "97294e43": (
        "Escolha do escopo na exportação (página atual ou todo o cadastro)",
        (
            "O botão Exportar abre um diálogo perguntando se o usuário "
            "deseja exportar apenas a página atual ou todo o cadastro "
            "(respeitando os filtros aplicados)."
        ),
    ),
    "f1080aed": (
        "Ação 'Limpar tudo' no vínculo de produtos",
        (
            "Acima da lista de produtos vinculados a um tipo de não "
            "conformidade, surge um botão que remove todos os "
            "vínculos de uma só vez."
        ),
    ),
    "b0d51ae8": (
        "Painel principal desvinculado dos itens do menu",
        (
            "Os itens Painel Principal, Acompanhamento e Pendências de "
            "Assinaturas passam todos a apresentar a tela 'Em "
            "construção'. O dashboard de demonstração será associado "
            "a um item específico futuramente."
        ),
    ),
    "08d4bf8d": (
        "Seed da Filial tolerante a CNPJ pré-existente",
        (
            "Corrige a inicialização do banco para reaproveitar a "
            "linha de Filial existente quando há CNPJ duplicado, "
            "evitando violação de unicidade."
        ),
    ),
    "478ad5e6": (
        "Exclusão em massa em todas as listagens com confirmação dupla",
        (
            "Adiciona coluna de seleção e barra de ações em massa. "
            "Antes de excluir, o usuário passa por duas confirmações: "
            "revisão da lista e digitação da palavra EXCLUIR."
        ),
    ),
    "0ff1208f": (
        "Cadastro de Turnos de Trabalho",
        (
            "Cria o CRUD de Turnos com código, nome, hora de início e "
            "hora de fim em formato HH:MM (24h). Suporta turnos que "
            "atravessam a meia-noite (ex.: 22:00 → 06:00)."
        ),
    ),
    "80aaf875": (
        "Turnos passam a ser por filial",
        (
            "Os turnos deixam de ser globais e passam a pertencer a uma "
            "filial específica. Cada unidade pode ter o seu próprio "
            "MANHA, TARDE, NOITE, etc."
        ),
    ),
    "ddf84334": (
        "Aprovador ganha turno opcional",
        (
            "Cada aprovador pode opcionalmente referenciar um turno de "
            "trabalho. O turno selecionado deve pertencer à mesma "
            "filial do aprovador (validação no servidor e no cliente)."
        ),
    ),
    "21c947b4": (
        "Cadastro de Política de Resposta",
        (
            "Define, para cada tipo de relatório, quantas horas "
            "contínuas o sistema concede para a assinatura/resposta. "
            "Cada tipo de relatório admite no máximo uma política."
        ),
    ),
    "85ffdc54": (
        "Tipo de Não Conformidade ganha severidade típica opcional",
        (
            "Permite associar cada tipo de defeito a uma severidade "
            "típica. A severidade aparece na listagem com pílula "
            "colorida e é sugerida durante o registro de RNCs."
        ),
    ),
    "463da3ec": (
        "Diagrama Entidade-Relacionamento gerado a partir do schema",
        (
            "Documento PDF com o diagrama ER do banco, gerado "
            "automaticamente a partir do prisma/schema.prisma via "
            "Graphviz."
        ),
    ),
    "da184b49": (
        "Assistente de criação de RNC com 2 etapas iniciais",
        (
            "Ao clicar em Criar Relatório → RNC abre um modal com duas "
            "etapas: Identificação (filial, data, tipo, turno) e "
            "Fornecedor com histórico das três últimas RNCs do mesmo "
            "fornecedor para o mesmo tipo de defeito. Rascunho gravado "
            "no banco."
        ),
    ),
    "7187b666": (
        "Página de listagem de RNCs e item no menu principal",
        (
            "Cria a tela RNCs (item no menu, logo abaixo de Painel "
            "Principal) com a lista paginada de relatórios, filtro por "
            "status, busca textual e botão para iniciar uma nova RNC."
        ),
    ),
    "f36f5815": (
        "Edição de RNCs diretamente na listagem",
        (
            "Cada linha da tabela de RNCs ganha o botão Editar, que "
            "reabre o assistente em modo edição com todos os campos "
            "preenchidos e preserva o status atual do RNC."
        ),
    ),
    "184950ba": (
        "Painel lateral de visualização do RNC",
        (
            "Botão de olho em cada linha da lista de RNCs abre um "
            "painel lateral (75% da tela) com todos os dados em lâmina "
            "única, organizados por seções."
        ),
    ),
    "d326b51e": (
        "Etapa 3 do RNC: disposição, origem, severidade e descrição do defeito",
        (
            "O assistente ganha uma terceira etapa com seções para "
            "registrar a disposição do material, a origem da não "
            "conformidade, a severidade aplicada e o texto livre "
            "descrevendo o defeito."
        ),
    ),
    "d4a461f0": (
        "Painel de visualização do RNC com visual editorial",
        (
            "Refatora o painel lateral do RNC para um visual mais "
            "minimalista e sofisticado: tipografia hierárquica, "
            "separadores sutis entre seções e número em fonte serifada "
            "elegante."
        ),
    ),
    "471a0c08": (
        "Anexar fotos ao RNC pelo painel de detalhes",
        (
            "Adiciona seção de Fotos no painel lateral do RNC, com "
            "drag-and-drop, miniaturas em grade, lightbox em tela cheia "
            "e exclusão por foto. Backend usa multer e armazena os "
            "arquivos em disco."
        ),
    ),
    "04c25a99": (
        "Fotos viram a etapa 4 do assistente de criação do RNC",
        (
            "Integra o anexo de fotos no fluxo de criação. O rascunho "
            "é gravado automaticamente ao avançar da etapa 3 para a "
            "etapa 4, e a página de fotos passa a operar sobre o RNC "
            "recém-criado."
        ),
    ),
    "8640c184": (
        "Linhas mais compactas no painel de visualização do RNC",
        (
            "Reduz o espaçamento vertical entre rótulo e valor no "
            "painel lateral, deixando o conteúdo mais denso e "
            "sofisticado."
        ),
    ),
    "f042af25": (
        "Navegação entre fotos no lightbox",
        (
            "O lightbox passa a permitir navegar entre as fotos do "
            "RNC com setas laterais e com as teclas de seta. A "
            "navegação tem efeito carrossel (volta à primeira após a "
            "última)."
        ),
    ),
    "e658aa5b": (
        "Etapa 3 do RNC: material, lote, NF e transporte",
        (
            "Insere uma etapa anterior à de disposição para capturar "
            "produto, lote, quantidade do lote, quantidade com defeito, "
            "tempo de parada, dados da NF, datas de fabricação/"
            "validade/recebimento, transportador, placas de cavalo e "
            "carreta e identificação do motorista."
        ),
    ),
    "e1834d99": (
        "Modal do RNC com 85% da largura da tela",
        (
            "Aumenta a área útil do assistente do RNC para acomodar "
            "confortavelmente os 14 campos da nova etapa 3."
        ),
    ),
    "949ff9e6": (
        "PDF de Backlog de Produto a partir do histórico de commits",
        (
            "Documento PDF do backlog (PBIs) gerado automaticamente "
            "do git log, com etiqueta colorida por tipo e agrupamento "
            "mensal."
        ),
    ),
    "d2f76b1d": (
        "Backlog repaginado nas cores SGNC (dourado e preto)",
        (
            "Aplica a paleta da marca (dourado #B38335 e preto #272525) "
            "ao PDF do backlog, com capa redesenhada e legenda dos "
            "tipos."
        ),
    ),
}


# ----------------------------------------------------------------------
# Coleta dos commits para extrair data e hash curto.
# ----------------------------------------------------------------------
def collect_records():
    raw = subprocess.check_output(
        ["git", "log", "--reverse",
         "--pretty=format:%H|||%ai|||%s"],
        cwd="/home/user/P016SGNC", text=True,
    )
    records = []
    for line in raw.strip().split("\n"):
        sha, dt, subject = line.split("|||", 2)
        records.append({
            "sha_full": sha.strip(),
            "sha": sha.strip()[:8],
            "date": dt.split()[0],
            "subject": subject.strip(),
        })
    return records


def classify(subject):
    m = re.match(r"^(feat|fix|refactor|docs|chore)(?:\(([^)]+)\))?:\s*(.+)$",
                 subject)
    if m:
        prefix, scope, _title = m.group(1), m.group(2), m.group(3)
        rotulo, bg, fg = TYPE_STYLE[prefix]
        return rotulo, bg, fg, scope or ""
    rotulo, bg, fg = OUTROS_STYLE
    return rotulo, bg, fg, ""


def esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def tag_table(rotulo, bg, fg):
    style = ParagraphStyle(
        "tag", fontName="Helvetica-Bold", fontSize=8, leading=10,
        textColor=fg, alignment=TA_CENTER,
    )
    t = Table([[Paragraph(rotulo, style)]],
              colWidths=[28 * mm], rowHeights=[5.2 * mm])
    table_style = [
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
    ]
    if bg is not None:
        table_style.append(("BACKGROUND", (0, 0), (-1, -1), bg))
    else:
        table_style.append(("BOX", (0, 0), (-1, -1), 0.6, fg))
    t.setStyle(TableStyle(table_style))
    return t


def main():
    records = collect_records()

    out_path = "/home/user/P016SGNC/docs/sgnc_pbi_backlog.pdf"
    pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
        title="SGNC — Backlog de Produto",
        author="SGNC",
    )

    styles = getSampleStyleSheet()
    eyebrow = ParagraphStyle(
        "eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=8.5, leading=10, textColor=DOURADO, spaceAfter=4,
    )
    heading = ParagraphStyle(
        "h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
        fontSize=28, leading=32, spaceAfter=4, textColor=PRETO,
    )
    subtitle = ParagraphStyle(
        "subtitle", parent=styles["Normal"], fontName="Helvetica",
        fontSize=10, leading=14, textColor=CINZA_TEXTO, spaceAfter=10,
    )
    section = ParagraphStyle(
        "section", parent=styles["Heading2"], fontName="Helvetica-Bold",
        fontSize=14, leading=18, spaceBefore=14, spaceAfter=6, textColor=PRETO,
    )
    uc_area = ParagraphStyle(
        "uc_area", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=10, leading=12, textColor=DOURADO_ESCURO,
        spaceBefore=10, spaceAfter=4,
    )
    uc_id = ParagraphStyle(
        "uc_id", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=10, leading=12, textColor=DOURADO,
    )
    uc_nome = ParagraphStyle(
        "uc_nome", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=11, leading=14, textColor=PRETO, spaceAfter=2,
    )
    uc_descricao = ParagraphStyle(
        "uc_descricao", parent=styles["Normal"], fontName="Helvetica",
        fontSize=9.5, leading=13, textColor=PRETO, spaceAfter=2,
    )
    pbi_id_style = ParagraphStyle(
        "pbi_id", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=10, leading=12, textColor=DOURADO,
    )
    pbi_title = ParagraphStyle(
        "pbi_title", parent=styles["Normal"], fontName="Helvetica-Bold",
        fontSize=12, leading=15, spaceAfter=2, textColor=PRETO,
    )
    pbi_meta = ParagraphStyle(
        "pbi_meta", parent=styles["Normal"], fontName="Helvetica",
        fontSize=9, leading=11, textColor=CINZA_TEXTO, spaceAfter=4,
    )
    pbi_body = ParagraphStyle(
        "pbi_body", parent=styles["Normal"], fontName="Helvetica",
        fontSize=9.5, leading=13, textColor=PRETO, spaceAfter=2,
    )

    story = []

    # ====================================================================
    # PÁGINA 1 — Casos de Uso entregues
    # ====================================================================
    story.append(Paragraph("CASOS DE USO ENTREGUES", eyebrow))
    story.append(Paragraph("SGNC", heading))
    story.append(Paragraph(
        "Sistema de Gestão de Não Conformidade — funcionalidades já "
        "disponíveis na aplicação, organizadas por área. As descrições "
        "estão integralmente em português.",
        subtitle,
    ))
    story.append(Table([[""]], colWidths=[170 * mm], rowHeights=[1.5],
                       style=TableStyle([
                           ("BACKGROUND", (0, 0), (-1, -1), DOURADO),
                       ])))
    story.append(Spacer(1, 12))

    last_area = None
    for uc in CASOS_DE_USO:
        if uc["area"] != last_area:
            story.append(Paragraph(uc["area"].upper(), uc_area))
            last_area = uc["area"]
        # bloco do caso de uso (id à esquerda, nome+descrição à direita)
        bloco = Table(
            [[
                Paragraph(uc["id"], uc_id),
                [
                    Paragraph(esc(uc["nome"]), uc_nome),
                    Paragraph(esc(uc["descricao"]), uc_descricao),
                ],
            ]],
            colWidths=[20 * mm, 150 * mm],
        )
        bloco.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, CINZA_LINHA),
        ]))
        story.append(bloco)

    story.append(PageBreak())

    # ====================================================================
    # Demais páginas — PBIs em ordem cronológica
    # ====================================================================
    story.append(Paragraph("BACKLOG DE PRODUTO", eyebrow))
    story.append(Paragraph("Linha do tempo de PBIs", heading))
    story.append(Paragraph(
        "Itens de backlog (Product Backlog Items) listados em ordem "
        "cronológica, agrupados por mês, com etiqueta colorida por "
        "natureza da entrega. Cada PBI corresponde a um commit do "
        "repositório; títulos e descrições foram redigidos em "
        "português.",
        subtitle,
    ))
    story.append(Table([[""]], colWidths=[170 * mm], rowHeights=[1.5],
                       style=TableStyle([
                           ("BACKGROUND", (0, 0), (-1, -1), DOURADO),
                       ])))
    story.append(Spacer(1, 14))

    # Resumo numérico
    totais = {}
    for rec in records:
        rotulo, _, _, _ = classify(rec["subject"])
        totais[rotulo] = totais.get(rotulo, 0) + 1
    resumo_rows = [["Total de PBIs", str(len(records))]]
    for k in ["Funcionalidade", "Correção", "Refatoração", "Documentação",
              "Ajuste técnico", "Outros"]:
        if k in totais:
            resumo_rows.append([k, str(totais[k])])
    resumo_rows.append(["Primeiro registro",
                        records[0]["date"] if records else ""])
    resumo_rows.append(["Último registro",
                        records[-1]["date"] if records else ""])
    resumo = Table(resumo_rows, colWidths=[65 * mm, 35 * mm])
    resumo.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), CINZA_TEXTO),
        ("TEXTCOLOR", (1, 0), (1, -1), PRETO),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, CINZA_LINHA),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    story.append(resumo)
    story.append(Spacer(1, 12))

    # Legenda
    story.append(Paragraph("LEGENDA", eyebrow))
    legenda_items = []
    for key in ["feat", "fix", "refactor", "docs"]:
        rotulo, bg, fg = TYPE_STYLE[key]
        legenda_items.append(tag_table(rotulo, bg, fg))
    legenda = Table([legenda_items], colWidths=[32 * mm] * len(legenda_items))
    legenda.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(legenda)
    story.append(Spacer(1, 14))

    # Agrupamento mensal
    groups = OrderedDict()
    for i, rec in enumerate(records, start=1):
        month_key = rec["date"][:7]
        groups.setdefault(month_key, []).append((i, rec))

    for month_key, items in groups.items():
        y, m = month_key.split("-")
        month_label = f"{PT_MONTH[m]} de {y}"
        cab = Table(
            [[Paragraph(
                f'<font color="#272525"><b>{esc(month_label)}</b></font>'
                f'<font color="#5A5454"> · {len(items)} item(ns)</font>',
                ParagraphStyle("month_inner", fontName="Helvetica",
                               fontSize=11, leading=14, textColor=PRETO),
            )]],
            colWidths=[170 * mm],
        )
        cab.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), DOURADO_CLARO),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LINEBEFORE", (0, 0), (0, -1), 2, DOURADO),
        ]))
        story.append(Spacer(1, 6))
        story.append(cab)
        story.append(Spacer(1, 4))

        for idx, rec in items:
            rotulo, bg, fg, scope = classify(rec["subject"])
            pt = PBI_PT.get(rec["sha"])
            if pt:
                title_pt, body_pt = pt
            else:
                # fallback: usa o subject (já frequentemente em PT)
                title_pt = re.sub(
                    r"^(feat|fix|refactor|docs|chore)(?:\([^)]+\))?:\s*", "",
                    rec["subject"],
                )
                body_pt = ""

            scope_html = (
                f' <font color="#5A5454">· <i>{esc(scope)}</i></font>'
                if scope else ""
            )
            header_row = Table(
                [[
                    Paragraph(f"PBI-{idx:03d}", pbi_id_style),
                    tag_table(rotulo, bg, fg),
                    Paragraph(
                        f'<font color="#5A5454">{rec["date"]} · '
                        f'<font face="Courier">{rec["sha"]}</font></font>',
                        pbi_meta,
                    ),
                ]],
                colWidths=[22 * mm, 32 * mm, 116 * mm],
            )
            header_row.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
            ]))
            block = [
                header_row,
                Spacer(1, 2),
                Paragraph(f"{esc(title_pt)}{scope_html}", pbi_title),
            ]
            if body_pt:
                block.append(Paragraph(esc(body_pt), pbi_body))
            else:
                block.append(Paragraph(
                    "<i>Sem descrição estendida.</i>", pbi_body,
                ))
            block.append(Spacer(1, 4))
            block.append(Table(
                [[""]], colWidths=[170 * mm], rowHeights=[0.4],
                style=TableStyle([
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, CINZA_LINHA),
                ]),
            ))
            block.append(Spacer(1, 6))
            story.append(KeepTogether(block))

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "<i>Documento gerado automaticamente a partir do histórico do "
        "repositório, com os títulos e descrições dos PBIs redigidos em "
        "português.</i>",
        subtitle,
    ))

    doc.build(story)
    print(f"PDF: {out_path}")
    print(f"PBIs: {len(records)}")
    print(f"Casos de uso: {len(CASOS_DE_USO)}")


if __name__ == "__main__":
    main()
