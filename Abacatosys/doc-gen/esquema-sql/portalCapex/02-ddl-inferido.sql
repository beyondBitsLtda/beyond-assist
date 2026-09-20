/* =============================================================================
   portalCapex - DDL INFERIDO (RASCUNHO, NAO AUTORITATIVO)
   Gerado por delp-docgen em 2026-09-05 11:40:57
   -----------------------------------------------------------------------------
   ATENCAO: este arquivo foi DEDUZIDO do codigo-fonte (constantes de tabela,
   grupos de colunas e SQL embutido). Os TIPOS sao chute educado, nao verdade.

   NAO EXECUTE em producao. Use como:
     - ponto de partida para criar a tabela num ambiente novo, ou
     - checklist para conferir contra o esquema real (01-extrair-esquema.sql).

   O DDL esta separado POR BASE DE DADOS. Rodar o bloco inteiro numa base so
   criaria, no lugar errado, tabelas que pertencem a outra.
============================================================================= */

/* =============================================================================
   BASE: FLUIG   (11 tabela(s))
   Conecte nesta base antes de executar o bloco abaixo.
   USE [FLUIG];
============================================================================= */

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_APROVACAO   (28 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_APROVACAO
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_APROVACAO] (
    [ANO_CAPEX] VARCHAR(255) NULL,
    [CODFILIAL] VARCHAR(255) NULL,
    [NOME_FILIAL] VARCHAR(255) NULL,
    [ITEM_ORIGEM] VARCHAR(255) NULL,
    [CC_ORIGEM] VARCHAR(255) NULL,
    [DESCRICAO_ORIGEM] VARCHAR(255) NULL,
    [TIPO_LINHA_ORIGEM] VARCHAR(255) NULL,
    [REF_ORIGEM] VARCHAR(255) NULL,
    [TIPO] VARCHAR(255) NULL,
    [VALOR_MOVIMENTADO] DECIMAL(18,2) NULL,
    [GERENTE_NOME] VARCHAR(255) NULL,
    [APROVADOR_MATRICULA] VARCHAR(255) NULL,
    [APROVADOR_RESOLVIDO] VARCHAR(255) NULL,
    [SOLICITANTE_MATRICULA] VARCHAR(255) NULL,
    [STATUS] VARCHAR(255) NULL,
    [JUSTIFICATIVA_SOLIC] VARCHAR(255) NULL,
    [PAYLOAD_JSON] VARCHAR(255) NULL,
    [NIVEL_ATUAL] VARCHAR(255) NULL,
    [NIVEL_MAX] VARCHAR(255) NULL,
    [CADEIA_JSON] VARCHAR(255) NULL,
    [JUSTIFICATIVA_DECISAO] VARCHAR(255) NULL,
    [DT_DECISAO] DATETIME NULL,
    [RECMODIFIEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDON] VARCHAR(255) NULL,
    [ID] INT IDENTITY(1,1) NOT NULL,
    [DT_SOLICITACAO] DATETIME NULL,
    [Aguardando o responsavel do CC] VARCHAR(255) NULL,
    [Aguardando o
       diretor] VARCHAR(255) NULL,
    CONSTRAINT [PK_Z_DELP_CAPEX_APROVACAO] PRIMARY KEY ([ID])
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_APROVACAO_PLANO   (25 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_APROVACAO_PLANO
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_APROVACAO_PLANO] (
    [ANO_CAPEX] VARCHAR(255) NULL,
    [VERSAO_PLANO] VARCHAR(255) NULL,
    [SOLICITANTE_LOGIN] VARCHAR(255) NULL,
    [SOLICITANTE_NOME] VARCHAR(255) NULL,
    [STATUS] VARCHAR(255) NULL,
    [NIVEL_ATUAL] VARCHAR(255) NULL,
    [APROVADOR_LOGIN] VARCHAR(255) NULL,
    [APROVADOR_NOME] VARCHAR(255) NULL,
    [JUSTIFICATIVA_SOLIC] VARCHAR(255) NULL,
    [TOKEN] VARCHAR(255) NULL,
    [TOKEN_EXPIRA] VARCHAR(255) NULL,
    [ANEXO_XLSX_B64] VARCHAR(255) NULL,
    [ANEXO_NOME] VARCHAR(255) NULL,
    [DT_SOLICITACAO] DATETIME NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECCREATEDON] VARCHAR(255) NULL,
    [_LOGIN] VARCHAR(255) NULL,
    [_NOME] VARCHAR(255) NULL,
    [_EMAIL] VARCHAR(255) NULL,
    [_DT] DATETIME NULL,
    [JUSTIFICATIVA_DECISAO] VARCHAR(255) NULL,
    [RECMODIFIEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDON] VARCHAR(255) NULL,
    [DT_DECISAO] DATETIME NULL,
    [ID] INT IDENTITY(1,1) NOT NULL,
    CONSTRAINT [PK_Z_DELP_CAPEX_APROVACAO_PLANO] PRIMARY KEY ([ID])
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_APROVADOR   (15 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_APROVADOR
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_APROVADOR] (
    [NOME] VARCHAR(255) NULL,
    [LOGIN] VARCHAR(255) NULL,
    [EMAIL] VARCHAR(255) NULL,
    [PAPEL] VARCHAR(255) NULL,
    [NIVEL] VARCHAR(255) NULL,
    [ESCOPO] VARCHAR(255) NULL,
    [SUBSTITUTO_LOGIN] VARCHAR(255) NULL,
    [ATIVO] BIT NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECCREATEDON] VARCHAR(255) NULL,
    [RECMODIFIEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDON] VARCHAR(255) NULL,
    [ID] INT IDENTITY(1,1) NOT NULL,
    [CCS] VARCHAR(255) NULL,
    [CCS_DESC] VARCHAR(255) NULL,
    CONSTRAINT [PK_Z_DELP_CAPEX_APROVADOR] PRIMARY KEY ([ID])
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_APROVADOR_CC   (4 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_APROVADOR_CC
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_APROVADOR_CC] (
    [APROVADOR_ID] INT NULL,
    [CC] VARCHAR(255) NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECCREATEDON] VARCHAR(255) NULL
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_CONTINGENCIA   (16 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_CONTINGENCIA
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_CONTINGENCIA] (
    [VALOR_ORCADO] DECIMAL(18,2) NULL,
    [RECMODIFIEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDON] VARCHAR(255) NULL,
    [ANO_CAPEX] VARCHAR(255) NULL,
    [VERSAO] VARCHAR(255) NULL,
    [EFETIVADO] VARCHAR(255) NULL,
    [CODFILIAL] VARCHAR(255) NULL,
    [NOME_FILIAL] VARCHAR(255) NULL,
    [DIRETORIA] VARCHAR(255) NULL,
    [DESCRICAO] VARCHAR(255) NULL,
    [JUSTIFICATIVA] VARCHAR(255) NULL,
    [NATUREZA] VARCHAR(255) NULL,
    [INATIVADO] VARCHAR(255) NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECCREATEDON] VARCHAR(255) NULL,
    [ID] INT IDENTITY(1,1) NOT NULL,
    CONSTRAINT [PK_Z_DELP_CAPEX_CONTINGENCIA] PRIMARY KEY ([ID])
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_GERENTE_USUARIO   (0 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_GERENTE_USUARIO
   --------------------------------------------------------------------------- */
-- Nenhuma coluna pode ser deduzida para esta tabela.
-- CREATE TABLE [Z_DELP_CAPEX_GERENTE_USUARIO] ( ... );

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_INTEGRACAO_LOG   (13 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_INTEGRACAO_LOG
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_INTEGRACAO_LOG] (
    [ID_SOLICITACAO] INT NULL,
    [NUMPROCESSO_FLUIG] VARCHAR(255) NULL,
    [TENTATIVA] VARCHAR(255) NULL,
    [DT_INICIO] DATETIME NULL,
    [DT_FIM] DATETIME NULL,
    [DURACAO_MS] VARCHAR(255) NULL,
    [STATUS] VARCHAR(255) NULL,
    [CLASSE_ERRO] VARCHAR(255) NULL,
    [MENSAGEM] VARCHAR(255) NULL,
    [XML_ENVIADO] VARCHAR(255) NULL,
    [XML_RETORNO] VARCHAR(255) NULL,
    [IDMOV_GERADO] VARCHAR(255) NULL,
    [USUARIO] VARCHAR(255) NULL
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_LOG   (9 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_LOG
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_LOG] (
    [ANO_CAPEX] VARCHAR(255) NULL,
    [CODFILIAL] VARCHAR(255) NULL,
    [EVENTO] VARCHAR(255) NULL,
    [TIPO_MOV] VARCHAR(255) NULL,
    [ITEM_ORIGEM] VARCHAR(255) NULL,
    [VALOR] DECIMAL(18,2) NULL,
    [APROVACAO_ID] INT NULL,
    [USUARIO] VARCHAR(255) NULL,
    [DETALHE] VARCHAR(255) NULL
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_PLANO   (60 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_PLANO
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_PLANO] (
    [ANO_CAPEX] VARCHAR(255) NULL,
    [VERSAO] VARCHAR(255) NULL,
    [EFETIVADO] VARCHAR(255) NULL,
    [CODFILIAL] VARCHAR(255) NULL,
    [NOME_FILIAL] VARCHAR(255) NULL,
    [ITEM] VARCHAR(255) NULL,
    [CC] VARCHAR(255) NULL,
    [DESC_CC] VARCHAR(255) NULL,
    [DESCRICAO] VARCHAR(255) NULL,
    [JUSTIFICATIVA] VARCHAR(255) NULL,
    [CATEGORIA] VARCHAR(255) NULL,
    [VALOR_ORCADO] DECIMAL(18,2) NULL,
    [NATUREZA] VARCHAR(255) NULL,
    [DIRETORIA] VARCHAR(255) NULL,
    [GERENTE] VARCHAR(255) NULL,
    [PLANEJ_ESTRATEGICO] VARCHAR(255) NULL,
    [PAYBACK] VARCHAR(255) NULL,
    [PRIORIDADE] VARCHAR(255) NULL,
    [JUSTIFICATIVA_VERSAO] VARCHAR(255) NULL,
    [OS_DOADORA] VARCHAR(255) NULL,
    [ID_ORCAMENTO_RM] INT NULL,
    [RECCREATEDON] VARCHAR(255) NULL,
    [INTEGRADO_RM] VARCHAR(255) NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDON] VARCHAR(255) NULL,
    [GRUPO_CAPEX] VARCHAR(255) NULL,
    [VALOR_ORCADO_BASE] DECIMAL(18,2) NULL,
    [IDORCAMENTO] VARCHAR(255) NULL,
    [ORIGEM_ANCORA] VARCHAR(255) NULL,
    [LINHAS_NO_ORCAMENTO] VARCHAR(255) NULL,
    [RM_TETO] VARCHAR(255) NULL,
    [RM_CONSUMO] VARCHAR(255) NULL,
    [RM_SALDO] VARCHAR(255) NULL,
    [SC_ABERTA] VARCHAR(255) NULL,
    [OC_ABERTA] VARCHAR(255) NULL,
    [REALIZADO] VARCHAR(255) NULL,
    [RATEADO] VARCHAR(255) NULL,
    [CONSUMO_LINHA] VARCHAR(255) NULL,
    [SALDO_LINHA] VARCHAR(255) NULL,
    [PCT_AVANCO] VARCHAR(255) NULL,
    [ORIGEM_CONSUMO] VARCHAR(255) NULL,
    [PCT_RATEADO] VARCHAR(255) NULL,
    [QTD_SCS] DECIMAL(18,2) NULL,
    [REALIZADO_CONTABIL] VARCHAR(255) NULL,
    [ORIGEM_CONTABIL] VARCHAR(255) NULL,
    [INATIVADO] VARCHAR(255) NULL,
    [ID] INT IDENTITY(1,1) NOT NULL,
    [COMPROMETIDO_SC] VARCHAR(255) NULL,
    [SALDO] VARCHAR(255) NULL,
    [Total geral orcado] VARCHAR(255) NULL,
    [VALOR_ORCADO_FLUIG] DECIMAL(18,2) NULL,
    [divergencia] VARCHAR(255) NULL,
    [REALIZADO_RM] VARCHAR(255) NULL,
    [RECEBIDO_RM] VARCHAR(255) NULL,
    [CEDIDO_RM] VARCHAR(255) NULL,
    [R$ 13.739.700 de divergencia] VARCHAR(255) NULL,
    [RM_QTD_LINHAS] VARCHAR(255) NULL,
    [VALOR_FLUIG_GRUPO] DECIMAL(18,2) NULL,
    [VALOR_RM_GRUPO] DECIMAL(18,2) NULL,
    CONSTRAINT [PK_Z_DELP_CAPEX_PLANO] PRIMARY KEY ([ID])
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_SOLICITACAO   (55 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_SOLICITACAO
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_SOLICITACAO] (
    [ANO_CAPEX] VARCHAR(255) NULL,
    [CODFILIAL] VARCHAR(255) NULL,
    [NOME_FILIAL] VARCHAR(255) NULL,
    [TIPO_LINHA] VARCHAR(255) NULL,
    [REF_LINHA] VARCHAR(255) NULL,
    [CODCCUSTO] VARCHAR(255) NULL,
    [NATUREZA] VARCHAR(255) NULL,
    [CLASSIFICACAO_FINANC] VARCHAR(255) NULL,
    [TIPO_MOV] VARCHAR(255) NULL,
    [DESCRICAO_RESUMO] VARCHAR(255) NULL,
    [JUSTIFICATIVA] VARCHAR(255) NULL,
    [FORNECEDOR_PRETENDIDO] VARCHAR(255) NULL,
    [DT_ENTREGA_PRETENDIDA] DATETIME NULL,
    [PRIORIDADE] VARCHAR(255) NULL,
    [VALOR_TOTAL] DECIMAL(18,2) NULL,
    [STATUS] VARCHAR(255) NULL,
    [SOLICITANTE] VARCHAR(255) NULL,
    [TOKEN_IDEMPOTENCIA] VARCHAR(255) NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECCREATEDON] VARCHAR(255) NULL,
    [DOACAO_ITEM_DEST] VARCHAR(255) NULL,
    [DOACAO_CONT_ID] INT NULL,
    [DOACAO_VALOR] DECIMAL(18,2) NULL,
    [DOACAO_EM] VARCHAR(255) NULL,
    [DOACAO_MENSAGEM] VARCHAR(255) NULL,
    [NUMPROCESSO_FLUIG] VARCHAR(255) NULL,
    [RECMODIFIEDBY] VARCHAR(255) NULL,
    [RECMODIFIEDON] VARCHAR(255) NULL,
    [IDMOV_RM] VARCHAR(255) NULL,
    [NUMEROMOV_RM] VARCHAR(255) NULL,
    [SERIE_RM] VARCHAR(255) NULL,
    [DT_INTEGRACAO] DATETIME NULL,
    [VERIFICAR_MANUAL] VARCHAR(255) NULL,
    [CLASSE_ERRO] VARCHAR(255) NULL,
    [MENSAGEM_ERRO] VARCHAR(255) NULL,
    [TENTATIVAS] VARCHAR(255) NULL,
    [MENSAGEM_TECNICA] VARCHAR(255) NULL,
    [AGUARDANDO_TRANSF_ID] INT NULL,
    [AGUARDANDO_TRANSF_IDS] VARCHAR(255) NULL,
    [DT_TRANSF_SOLICITADA] DATETIME NULL,
    [APROVADOR_MATRICULA] VARCHAR(255) NULL,
    [APROVADOR_NOME] VARCHAR(255) NULL,
    [APROVADOR_EMAIL] VARCHAR(255) NULL,
    [APROVACAO_PENDENTE] VARCHAR(255) NULL,
    [TOKEN_APROVACAO] VARCHAR(255) NULL,
    [TOKEN_APROVACAO_EXPIRA] VARCHAR(255) NULL,
    [DT_EMAIL_APROVACAO] DATETIME NULL,
    [DECISAO_APROVACAO] VARCHAR(255) NULL,
    [JUSTIFICATIVA_APROVACAO] VARCHAR(255) NULL,
    [DT_DECISAO_APROVACAO] DATETIME NULL,
    [DECIDIDO_POR] VARCHAR(255) NULL,
    [DOACAO_DEVOLVIDA_EM] VARCHAR(255) NULL,
    [ID] INT IDENTITY(1,1) NOT NULL,
    [REENVIOS] VARCHAR(255) NULL,
    [HISTORICO_DECISOES] VARCHAR(255) NULL,
    CONSTRAINT [PK_Z_DELP_CAPEX_SOLICITACAO] PRIMARY KEY ([ID])
);

/* ---------------------------------------------------------------------------
   Z_DELP_CAPEX_SOLICITACAO_ITEM   (10 colunas deduzidas)
   Nome completo no codigo: FLUIG.dbo.Z_DELP_CAPEX_SOLICITACAO_ITEM
   --------------------------------------------------------------------------- */
CREATE TABLE [Z_DELP_CAPEX_SOLICITACAO_ITEM] (
    [ID_SOLICITACAO] INT NULL,
    [SEQ] VARCHAR(255) NULL,
    [CODIGOPRD] VARCHAR(255) NULL,
    [DESCRICAO] VARCHAR(255) NULL,
    [CODUND] VARCHAR(255) NULL,
    [QUANTIDADE] VARCHAR(255) NULL,
    [PRECOUNITARIO] VARCHAR(255) NULL,
    [EH_SERVICO] VARCHAR(255) NULL,
    [RECCREATEDBY] VARCHAR(255) NULL,
    [RECCREATEDON] VARCHAR(255) NULL
);

/* ---------------------------------------------------------------------------
   Relacionamentos deduzidos (coluna XXX_ID apontando para a tabela XXX).
   Descomente somente depois de confirmar contra o banco real.
   --------------------------------------------------------------------------- */
-- ALTER TABLE [Z_DELP_CAPEX_LOG] ADD CONSTRAINT [FK_Z_DELP_CAPEX_LOG_Z_DELP_CAPEX_APROVACAO]
--     FOREIGN KEY ([APROVACAO_ID]) REFERENCES [Z_DELP_CAPEX_APROVACAO] ([ID]);
-- ALTER TABLE [Z_DELP_CAPEX_APROVADOR_CC] ADD CONSTRAINT [FK_Z_DELP_CAPEX_APROVADOR_CC_Z_DELP_CAPEX_APROVADOR]
--     FOREIGN KEY ([APROVADOR_ID]) REFERENCES [Z_DELP_CAPEX_APROVADOR] ([ID]);
