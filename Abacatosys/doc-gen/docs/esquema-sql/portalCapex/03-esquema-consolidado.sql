/* =============================================================================
   portalCapex - ESQUEMA CONSOLIDADO (somente o DECLARADO)
   Gerado por delp-docgen em 2026-09-05 12:21:22
   -----------------------------------------------------------------------------
   Reune tudo que tem fonte: DDL da pasta /sql da aplicacao + esquema extraido
   do banco e salvo nesta pasta. Nada aqui foi deduzido.

   Separado POR BASE DE DADOS: esta aplicacao le de mais de uma.
============================================================================= */

/* =============================================================================
   BASE: CORPORE   (19 objeto(s))
   USE [CORPORE];
============================================================================= */

/* CCONTA  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CCONTA] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODCONTA] dcodconta NOT NULL,
    [REDUZIDO] varchar(20) NULL,
    [DESCRICAO] varchar(100) NULL,
    [ANALITICA] smallint NULL,
    [RATEIO] smallint NULL,
    [NATUREZA] smallint NULL,
    [TIPOCORRECAO] smallint NULL,
    [TIPOCONTA] smallint NULL,
    [CONTA8200] dcodconta NULL,
    [BITMAP] smallint NULL,
    [HISTLCTATIVO] varchar(40) NULL,
    [OPCIONAL] smallint NULL,
    [CODHISTP] varchar(10) NULL,
    [CODCOLHISTP] dcodcoligadanull NULL,
    [MOEDAVENDA] varchar(10) NULL,
    [MOEDACOMPRA] varchar(10) NULL,
    [INATIVA] smallint NULL,
    [DATAINATIVA] datetime NULL,
    [USUARIOINCLU] varchar(20) NULL,
    [DATAINCLU] datetime NULL,
    [USUARIOALTER] varchar(20) NULL,
    [DATAALTER] datetime NULL,
    [CODCOLCONTAESTORNO] dcodcoligadanull NULL,
    [CONTAESTORNO] dcodconta NULL,
    [NATSPED] varchar(3) NULL,
    [ID] int IDENTITY(1,1) NOT NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [METODOCONTROLSUBCONTA] varchar(2) NULL,
    [TIPOCONVERSAOMULTIMOEDA] smallint NULL,
    [ELIMINACAO] smallint NULL,
    [CODCOLFRMVLRFINCONCIL] dcodcoligadanull NULL,
    [APLICACAOFRMVLRFINCONCIL] varchar(1) NULL,
    [CODFRMVLRFINCONCIL] varchar(8) NULL,
    [CONTACONCILIAVEL] smallint NULL,
    [DATAULTCONCILIACAO] datetime NULL
);

/* CGERENCIA  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CGERENCIA] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODCONTA] dcodconta NOT NULL,
    [REDUZIDO] varchar(20) NULL,
    [DESCRICAO] varchar(40) NULL,
    [ANALITICA] smallint NULL,
    [NATUREZA] smallint NULL,
    [BITMAP] smallint NULL,
    [INATIVA] smallint NULL,
    [DATAINATIVA] datetime NULL,
    [ENVIASPED] boolean NOT NULL,
    [ID] int IDENTITY(1,1) NOT NULL,
    [DATAINCLUSAO] ddatetime NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL
);

/* CLANCAMENTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CLANCAMENTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODLOTE] int NOT NULL,
    [IDLANCAMENTO] int NOT NULL,
    [DESCRICAO] varchar(100) NULL,
    [CODUSUARIO] varchar(20) NULL,
    [TIPOBLOQ] varchar(1) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [CODUSUARIOAPROVACAO] varchar(20) NULL,
    [DATAAPROVACAO] datetime NULL
);

/* CLOTE  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CLOTE] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODLOTE] int NOT NULL,
    [DESCRICAO] varchar(100) NULL,
    [VALOR] rmdvalor2 NULL,
    [DATAINICIAL] datetime NULL,
    [DATAFINAL] datetime NULL,
    [STATUS] smallint NULL,
    [TOTALDEBITOS] rmdvalor2 NULL,
    [TOTALCREDITOS] rmdvalor2 NULL,
    [VALORSOMA] rmdvalor2 NULL,
    [INTEGRAAPLICACAO] varchar(4) NULL,
    [USUARIOATUAL] varchar(20) NULL,
    [DIGITARCAPA] smallint NULL,
    [DATABLOQ] datetime NULL,
    [TIPOBLOQ] varchar(1) NULL,
    [MOTIVOBLOQ] varchar(100) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [USUARIOSOLICITANTE] varchar(20) NULL,
    [STATUSAPROVACAO] smallint NOT NULL
);

/* CPARTIDA  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CPARTIDA] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDPARTIDA] int NOT NULL,
    [CODLOTE] int NOT NULL,
    [IDLANCAMENTO] int NOT NULL,
    [LCTREF] int NOT NULL,
    [CODLOTEORIGEM] int NULL,
    [CODFILIAL] smallint NOT NULL,
    [CODDEPARTAMENTO] varchar(25) NULL,
    [CODCCUSTO] varchar(25) NULL,
    [DOCUMENTO] varchar(20) NULL,
    [DATA] datetime NOT NULL,
    [CODCOLDEBITO] dcodcoligada NOT NULL,
    [DEBITO] dcodconta NULL,
    [CODCOLCREDITO] dcodcoligada NOT NULL,
    [CREDITO] dcodconta NULL,
    [CODCOLPARTIDA] dcodcoligada NOT NULL,
    [PARTIDA] dcodconta NULL,
    [VALOR] rmdvalor2 NOT NULL,
    [VALOR2] rmdvalor4 NOT NULL,
    [DATA2] datetime NULL,
    [CODHISTP] varchar(10) NULL,
    [COMPLEMENTO] varchar(250) NULL,
    [IDPARTICIPANTE] int NULL,
    [USUARIO] varchar(20) NULL,
    [DATAINCLU] datetime NULL,
    [USUARIOALTER] varchar(20) NULL,
    [DATAALTER] datetime NULL,
    [USUARIOINTEGRACAO] varchar(20) NULL,
    [DATAINTEGRACAO] datetime NULL,
    [DATALIBERACAO] datetime NULL,
    [CODDIARIO] varchar(5) NULL,
    [SEQDIARIO] varchar(9) NULL,
    [INTEGRAAPLICACAO] varchar(3) NULL,
    [INTEGRACHAVE] varchar(25) NULL,
    [TIPOAGRUP] smallint NULL,
    [RATEIO] varchar(1) NULL,
    [ORIGINADONOVOMOD] smallint NULL,
    [TIPOGERACAO] char(1) NULL,
    [LCTREFORIGEM] int NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [TIPOCLASS_RAS] smallint NULL,
    [IDITEM_RAS] int NULL,
    [QTDITEM_RAS] int NULL,
    [IDCLASSEVALORPROTHEUS] int NULL,
    [IDITEMCONTABILPROTHEUS] int NULL,
    [DATAEXTEMPORANEA] datetime2(7) NULL,
    [CODCOLELIMINACAO] dcodcoligadanull NULL,
    [CODCOLCONTAELIMINACAO] dcodcoligadanull NULL,
    [CODCONTAELIMINACAO] dcodconta NULL,
    [CONCILIACAODEBITO] int NULL,
    [CONCILIACAOCREDITO] int NULL
);

/* CRATEIOLC  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CRATEIOLC] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [LCTREF] int NOT NULL,
    [DATA] datetime NULL,
    [CODCONTA] dcodconta NOT NULL,
    [CODGERENCIAL] dcodconta NOT NULL,
    [VLRDEBITO] rmdvalor2 NULL,
    [VLRCREDITO] rmdvalor2 NULL,
    [CODCOLCONTA] dcodcoligada NOT NULL,
    [CODCOLGERENCIAL] dcodcoligada NOT NULL,
    [CODLOTE] int NOT NULL,
    [IDRATEIO] int NOT NULL,
    [IDPARTIDA] int NOT NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL
);

/* CRATEIOLCCC  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[CRATEIOLCCC] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODLOTE] int NOT NULL,
    [LCTREF] int NOT NULL,
    [DATA] datetime NULL,
    [CODCOLCONTA] dcodcoligada NOT NULL,
    [CODCONTA] dcodconta NOT NULL,
    [CODCCUSTO] varchar(25) NOT NULL,
    [VLRDEBITO] rmdvalor2 NULL,
    [VLRCREDITO] rmdvalor2 NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL
);

/* FCFO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[FCFO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODCFO] varchar(25) NOT NULL,
    [NOMEFANTASIA] varchar(100) NULL,
    [NOME] varchar(100) NULL,
    [CGCCFO] varchar(20) NULL,
    [INSCRESTADUAL] varchar(20) NULL,
    [PAGREC] smallint NOT NULL,
    [RUA] varchar(100) NULL,
    [NUMERO] varchar(8) NULL,
    [COMPLEMENTO] dcomplemento NULL,
    [BAIRRO] dbairro NULL,
    [CIDADE] dcidade NULL,
    [CODETD] varchar(2) NULL,
    [CEP] dcep NULL,
    [TELEFONE] varchar(15) NULL,
    [RUAPGTO] varchar(100) NULL,
    [NUMEROPGTO] varchar(8) NULL,
    [COMPLEMENTOPGTO] dcomplemento NULL,
    [BAIRROPGTO] dbairro NULL,
    [CIDADEPGTO] dcidade NULL,
    [CODETDPGTO] varchar(2) NULL,
    [CEPPGTO] dcep NULL,
    [TELEFONEPGTO] varchar(15) NULL,
    [RUAENTREGA] varchar(100) NULL,
    [NUMEROENTREGA] varchar(8) NULL,
    [COMPLEMENTREGA] dcomplemento NULL,
    [BAIRROENTREGA] dbairro NULL,
    [CIDADEENTREGA] dcidade NULL,
    [CODETDENTREGA] varchar(2) NULL,
    [CEPENTREGA] dcep NULL,
    [TELEFONEENTREGA] varchar(15) NULL,
    [FAX] varchar(15) NULL,
    [TELEX] varchar(15) NULL,
    [EMAIL] varchar(250) NULL,
    [CONTATO] varchar(40) NULL,
    [CODTCF] varchar(25) NULL,
    [ATIVO] smallint NOT NULL,
    [LIMITECREDITO] rmdvalor2 NULL,
    [VALORULTIMOLAN] rmdvalor2 NULL,
    [TIPOINSCRCNAB] smallint NULL,
    [SIMBMOEDAINDEX] varchar(10) NULL,
    [DATAULTALTERACAO] datetime NULL,
    [DATACRIACAO] datetime NULL,
    [DATAULTMOVIMENTO] datetime NULL,
    [CONTEVENTOCONTAB] smallint NULL,
    [CAMPOLIVRE] varchar(40) NULL,
    [CAMPOALFAOP1] varchar(40) NULL,
    [CAMPOALFAOP2] varchar(40) NULL,
    [CAMPOALFAOP3] varchar(40) NULL,
    [VALOROP1] rmdvalor2 NULL,
    [VALOROP2] rmdvalor2 NULL,
    [VALOROP3] rmdvalor2 NULL,
    [DATAOP1] datetime NULL,
    [DATAOP2] datetime NULL,
    [DATAOP3] datetime NULL,
    [CODTRA] varchar(5) NULL,
    [CHAPA] varchar(16) NULL,
    [STATUSCOTACAO] varchar(1) NULL,
    [DTINICATIVIDADES] datetime NULL,
    [PATRIMONIO] rmdvalor2 NULL,
    [NUMFUNCIONARIOS] int NULL,
    [CODCOLCHAVESESTRANG] smallint NULL,
    [CODCOLTCF] smallint NULL,
    [FAXDEDICADO] smallint NULL,
    [CODMUNICIPIO] varchar(20) NULL,
    [CODCOLCONTAGER] smallint NULL,
    [CODCONTAGER] dcodconta NULL,
    [FORMAPAGAMENTO] smallint NULL,
    [IDENTPORCNPJ] dlogiconull NULL,
    [INSCRMUNICIPAL] varchar(20) NULL,
    [PESSOAFISOUJUR] varchar(1) NOT NULL,
    [CONTATOPGTO] varchar(40) NULL,
    [CONTATOENTREGA] varchar(40) NULL,
    [PAIS] varchar(20) NULL,
    [PAISPAGTO] varchar(20) NULL,
    [PAISENTREGA] varchar(20) NULL,
    [ULTIMODOCUMENTO] varchar(40) NULL,
    [CONTRIBUINTE] smallint NULL,
    [CFOIMOB] smallint NULL,
    [TIPODOC] varchar(1) NULL,
    [CODFINALIDADE] smallint NULL,
    [AGRUPCOB] char(1) NULL,
    [CODCARGO] varchar(3) NULL,
    [CODVINCULO] char(1) NULL,
    [ENDCOBC] char(1) NULL,
    [CIDENTIDADE] varchar(20) NULL,
    [CI_ORGAO] varchar(15) NULL,
    [CI_UF] varchar(2) NULL,
    [CODPROF] int NULL,
    [CODPAGTOGPS] varchar(5) NULL,
    [FAXENTREGA] varchar(15) NULL,
    [EMAILENTREGA] varchar(250) NULL,
    [FAXPGTO] varchar(15) NULL,
    [EMAILPGTO] varchar(250) NULL,
    [SATISFACAO] int NULL,
    [VALFRETE] rmdvalor4 NULL,
    [TPTOMADOR] smallint NULL,
    [CONTRIBUINTEISS] smallint NULL,
    [NUMDEPENDENTES] int NULL,
    [EMPRESA] varchar(60) NULL,
    [ESTADOCIVIL] varchar(1) NULL,
    [CODCOLCXA] dcodcoligadanull NULL,
    [CODCXA] varchar(10) NULL,
    [PRODUTORRURAL] boolean NULL,
    [USUARIOALTERACAO] varchar(20) NULL,
    [SUFRAMA] varchar(14) NULL,
    [CODMUNICIPIOPGTO] varchar(20) NULL,
    [CODMUNICIPIOENTREGA] varchar(20) NULL,
    [ORGAOPUBLICO] smallint NULL,
    [TELEFONECOMERCIAL] varchar(15) NULL,
    [CAIXAPOSTAL] varchar(10) NULL,
    [CAIXAPOSTALENTREGA] varchar(10) NULL,
    [CAIXAPOSTALPAGAMENTO] varchar(10) NULL,
    [CATEGORIAAUTONOMO] smallint NULL,
    [CBOAUTONOMO] varchar(10) NULL,
    [CIAUTONOMO] varchar(11) NULL,
    [IDCFO] int NOT NULL,
    [CODIGOINSS] varchar(10) NULL,
    [VROUTRASDEDUCOESIRRF] rmdvalor4 NULL,
    [CODRECEITA] varchar(10) NULL,
    [CEI] varchar(20) NULL,
    [OPTANTEPELOSIMPLES] smallint NULL,
    [TIPORUA] smallint NULL,
    [TIPOBAIRRO] smallint NULL,
    [REGIMEISS] varchar(1) NULL,
    [RETENCAOISS] smallint NULL,
    [DTNASCIMENTO] datetime NULL,
    [USUARIOCRIACAO] varchar(20) NULL,
    [TIPOOPCOMBUSTIVEL] smallint NULL,
    [INSCRESTADUALST] varchar(20) NULL,
    [LOCALIDADE] varchar(40) NULL,
    [LOCALIDADEPGTO] varchar(40) NULL,
    [LOCALIDADEENTREGA] varchar(40) NULL,
    [TIPORUAPGTO] smallint NULL,
    [TIPORUAENTREGA] smallint NULL,
    [TIPOBAIRROPGTO] smallint NULL,
    [TIPOBAIRROENTREGA] smallint NULL,
    [PORTE] smallint NULL,
    [RAMOATIV] int NOT NULL,
    [NIT] varchar(15) NULL,
    [CEPCAIXAPOSTAL] dcep NULL,
    [NUMDIASATRASO] int NULL,
    [IDPAIS] smallint NULL,
    [IDPAISPGTO] smallint NULL,
    [IDPAISENTREGA] smallint NULL,
    [TIPOCONTRIBUINTEINSS] smallint NOT NULL,
    [NACIONALIDADE] smallint NOT NULL,
    [CODCOLCFOFISCAL] dcodcoligadanull NULL,
    [IDCFOFISCAL] int NULL,
    [EMAILFISCAL] varchar(250) NULL,
    [CALCULAAVP] smallint NOT NULL,
    [CODUSUARIOACESSO] varchar(20) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [IDINTEGRACAO] varchar(100) NULL,
    [USARCUMULATRETENCAOPAGAR] smallint NULL,
    [NIF] varchar(50) NULL,
    [SITUACAONIF] smallint NULL,
    [TIPORENDIMENTO] varchar(3) NULL,
    [FORMATRIBUTACAO] varchar(2) NULL,
    [INDNATRET] varchar(5) NULL,
    [TPLOTACAO_OLD] varchar(2) NULL,
    [DOCUMENTOESTRANGEIRO] varchar(30) NULL,
    [INOVAR_AUTO] int NULL,
    [FILIALFINANCEIRA] int NULL,
    [TOMADORFOLHA] smallint NULL,
    [CNAEPREP] varchar(7) NULL,
    [PERCENTACIDTRAB] rmdvalor2 NULL,
    [CODCOLFORMULA] dcodcoligadanull NULL,
    [FORMULAVALDEDUCAOVARIAVEL] varchar(8) NULL,
    [APLICFORMULA] varchar(1) NULL,
    [CODCFOCOLINTEGRACAO] dcodcoligadanull NULL,
    [CODCFOINTEGRACAO] varchar(25) NULL,
    [DIGVERIFICDEBAUTOMATICO] varchar(1) NULL,
    [CODLOJA] varchar(8) NULL,
    [CODFILIALINTEGRACAO] smallint NULL,
    [CODEXTERNO] varchar(25) NULL,
    [TIPOCLIENTE] varchar(2) NULL,
    [CONSIDERAFILIALOBRA] smallint NULL,
    [CODFILIALOBRA] smallint NULL,
    [TIPOCONTROLEPONTO] smallint NULL,
    [FAP] rmdvalor4 NULL,
    [CODCOLIGADAFILIALOBRA] dcodcoligadanull NULL,
    [OBRAPROPRIA] smallint NULL,
    [ENTIDADEEXECUTORAPAA] smallint NOT NULL,
    [CODCATEGORIAESOCIAL] int NULL,
    [APOSENTADOOUPENSIONISTA] int NOT NULL,
    [CNPJRURAL] varchar(20) NULL,
    [CODIGOCAEPF] varchar(18) NULL,
    [ISENTOTRIBUTOS] dlogiconull NULL,
    [SOCIOCOOPERADO] smallint NOT NULL,
    [IDNATRENDIMENTO] int NULL,
    [CONTRIBUINTE_IBS_CBS] smallint NOT NULL
);

/* GCCUSTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[GCCUSTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODCCUSTO] varchar(25) NOT NULL,
    [NOME] varchar(60) NULL,
    [CODCOLCONTAGER] dcodcoligadanull NULL,
    [CODCONTAGER] dcodconta NULL,
    [CODCOLCONTA] dcodcoligadanull NULL,
    [CODCONTA] dcodconta NULL,
    [CODREDUZIDO] varchar(25) NOT NULL,
    [CAMPOLIVRE] varchar(100) NULL,
    [ATIVO] boolean NULL,
    [PERMITELANC] boolean NULL,
    [CODCLASSIFICA] varchar(10) NULL,
    [ENVIASPED] boolean NOT NULL,
    [ID] int IDENTITY(1,1) NOT NULL,
    [DATAINCLUSAO] ddatetime NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [RESPONSAVEL] int NULL
);

/* GUSUARIO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[GUSUARIO] (
    [CODUSUARIO] varchar(20) NOT NULL,
    [NOME] varchar(45) NULL,
    [STATUS] smallint NULL,
    [DATAINICIO] datetime NULL,
    [DATAEXPIRACAO] datetime NULL,
    [CONFIRMABTNOK] smallint NULL,
    [SENHA] varchar(1000) NOT NULL,
    [CONTROLE] smallint NULL,
    [ULTIMACOLIGADA] int NULL,
    [CODACESSO] varchar(16) NULL,
    [DTAEXPSENHA] datetime NULL,
    [DIASEXPSENHA] int NULL,
    [OBRIGAALTERARSENHA] boolean NULL,
    [NUMLOGININVALIDO] int NULL,
    [DATALOGININVALIDO] datetime NULL,
    [EMAIL] varchar(60) NULL,
    [ACESSONET] boolean NULL,
    [INTERNO1] varchar(1000) NULL,
    [DATAULTIMOACESSO] datetime NULL,
    [CODUSUARIOREDE] varchar(255) NULL,
    [DOMINIOREDE] varchar(255) NULL,
    [DATAULTIMOACESSOVALIDO] ddate NULL,
    [USUARIOTWITTER] varchar(50) NULL,
    [SENHATWITTER] varchar(100) NULL,
    [USUARIOFACEBOOK] varchar(50) NULL,
    [SENHAFACEBOOK] varchar(100) NULL,
    [USUARIOLINKEDIN] varchar(50) NULL,
    [SENHALINKEDIN] varchar(100) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [USERID] varchar(50) NOT NULL,
    [USERIDFLUIGIDENTITY] varchar(100) NULL,
    [USERFLUIGJSON] varchar(MAX) NULL,
    [IGNORARAUTENTICACAOLDAP] varchar(1) NOT NULL,
    [NOMESOCIAL] varchar(45) NULL,
    [ULTIMASSENHAS] varchar(MAX) NULL,
    [CODEXTERNO] varchar(255) NULL,
    [IPULTIMOACESSO] varchar(100) NULL,
    [OIDC_ENABLED] dlogico NOT NULL
);

/* PPESSOA  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[PPESSOA] (
    [CODIGO] int NOT NULL,
    [NOME] varchar(120) NULL,
    [APELIDO] varchar(40) NULL,
    [DTNASCIMENTO] datetime NULL,
    [ESTADOCIVIL] varchar(1) NULL,
    [SEXO] varchar(1) NULL,
    [NACIONALIDADE] varchar(3) NULL,
    [GRAUINSTRUCAO] varchar(3) NULL,
    [RUA] varchar(140) NULL,
    [NUMERO] varchar(8) NULL,
    [COMPLEMENTO] dcomplemento NULL,
    [BAIRRO] dbairro NULL,
    [ESTADO] varchar(2) NULL,
    [CIDADE] dcidade NULL,
    [CEP] dcep NULL,
    [PAIS] varchar(60) NULL,
    [REGPROFISSIONAL] varchar(15) NULL,
    [CPF] varchar(11) NULL,
    [IDIMAGEM] int NULL,
    [TELEFONE1] varchar(15) NULL,
    [TELEFONE2] varchar(15) NULL,
    [CARTIDENTIDADE] varchar(15) NULL,
    [UFCARTIDENT] varchar(2) NULL,
    [ORGEMISSORIDENT] varchar(15) NULL,
    [DTEMISSAOIDENT] datetime NULL,
    [TITULOELEITOR] varchar(14) NULL,
    [ZONATITELEITOR] varchar(6) NULL,
    [SECAOTITELEITOR] varchar(6) NULL,
    [CARTEIRATRAB] varchar(10) NULL,
    [SERIECARTTRAB] varchar(5) NULL,
    [UFCARTTRAB] varchar(2) NULL,
    [DTCARTTRAB] datetime NULL,
    [NIT] smallint NULL,
    [CARTMOTORISTA] varchar(15) NULL,
    [TIPOCARTHABILIT] varchar(5) NULL,
    [DTVENCHABILIT] datetime NULL,
    [CERTIFRESERV] varchar(40) NULL,
    [CATEGMILITAR] varchar(10) NULL,
    [NATURALIDADE] varchar(32) NULL,
    [ESTADONATAL] varchar(2) NULL,
    [DATACHEGADA] datetime NULL,
    [CARTMODELO19] varchar(15) NULL,
    [CONJUGEBRASIL] smallint NULL,
    [NATURALIZADO] smallint NULL,
    [FILHOSBRASIL] smallint NULL,
    [NROFILHOSBRASIL] smallint NULL,
    [NROREGGERAL] varchar(15) NULL,
    [NRODECRETO] varchar(15) NULL,
    [DTVENCIDENT] datetime NULL,
    [DTVENCCARTTRAB] datetime NULL,
    [TIPOVISTO] varchar(10) NULL,
    [EMAIL] varchar(60) NULL,
    [INVESTTREINANT] rmdvalor2 NULL,
    [CORRACA] smallint NULL,
    [DEFICIENTEFISICO] smallint NULL,
    [CODUSUARIO] varchar(20) NULL,
    [TELEFONE3] varchar(15) NULL,
    [FAX] varchar(15) NULL,
    [EMPRESA] varchar(60) NULL,
    [CODPROFISSAO] int NULL,
    [CODOCUPACAO] varchar(3) NULL,
    [CODMEMOOBS] int NULL,
    [BRPDH] smallint NULL,
    [NPASSAPORTE] varchar(15) NULL,
    [FUMANTE] dlogiconull NULL,
    [PAISORIGEM] varchar(20) NULL,
    [DTEMISSPASSAPORTE] datetime NULL,
    [DTVALPASSAPORTE] datetime NULL,
    [OBSPESSOA] memo NULL,
    [IDIMAGEMDOC] int NULL,
    [IDIMAGEMDOCV] int NULL,
    [AJUSTATAMANHOFOTO] dlogiconull NULL,
    [DEFICIENTEAUDITIVO] smallint NULL,
    [DEFICIENTEFALA] smallint NULL,
    [DEFICIENTEVISUAL] smallint NULL,
    [DEFICIENTEMENTAL] smallint NULL,
    [RECURSOREALIZACAOTRAB] varchar(120) NULL,
    [RECURSOACESSIBILIDADE] varchar(120) NULL,
    [DATAAPROVACAOCURR] datetime NULL,
    [CODMUNICIPIO] varchar(20) NULL,
    [LOCALIDADE] varchar(40) NULL,
    [CSM] varchar(10) NULL,
    [DTEXPCML] datetime NULL,
    [EXPED] varchar(10) NULL,
    [RM] varchar(10) NULL,
    [SITMILITAR] varchar(10) NULL,
    [DTTITELEITOR] datetime NULL,
    [ESTELEIT] varchar(2) NULL,
    [TIPOSANG] varchar(10) NULL,
    [IDBIOMETRIA] int NULL,
    [ALUNO] dlogico NOT NULL,
    [PROFESSOR] dlogico NOT NULL,
    [USUARIOBIBLIOS] dlogico NOT NULL,
    [FUNCIONARIO] dlogico NOT NULL,
    [EXFUNCIONARIO] dlogico NOT NULL,
    [CANDIDATO] dlogico NOT NULL,
    [TAGSCRIPT] memo NULL,
    [FIADOR_SGI] dlogiconull NULL,
    [CONJUGE_SGI] dlogiconull NULL,
    [DEFICIENTEMOBREDUZIDA] smallint NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [DTVENCIDENTPT] ddatetime NULL,
    [CODTIPORUA] smallint NULL,
    [CODTIPOBAIRRO] smallint NULL,
    [IDPAIS] smallint NULL,
    [CODNATURALIDADE] varchar(20) NULL,
    [NUMERORIC] varchar(20) NULL,
    [ORGEMISSORRIC] varchar(20) NULL,
    [DTEMISSAORIC] ddatetime NULL,
    [DTEMISSAOCNH] ddatetime NULL,
    [ORGEMISSORCNH] varchar(20) NULL,
    [DATANATURALIZACAO] ddatetime NULL,
    [ORGEMISSORRNE] varchar(20) NULL,
    [DTEMISSAORNE] ddatetime NULL,
    [NOMESOCIAL] varchar(120) NULL,
    [DEFICIENTEINTELECTUAL] smallint NULL,
    [DEFICIENTEOBSERVACAO] varchar(255) NULL,
    [DATAOBITO] ddatetime NULL,
    [MATRICULAOBITO] varchar(50) NULL,
    [FALECIDO] int NULL,
    [PORTARIANATURALIZACAO] varchar(50) NULL,
    [CODCLASSIFTRABESTRANG] varchar(20) NULL,
    [UFCNH] varchar(2) NULL,
    [DATAPRIMEIRACNH] ddatetime NULL,
    [ANO1EMPREGO] int NULL,
    [EMAILPESSOAL] varchar(60) NULL,
    [TIPOPRAZORESIDENCIA] smallint NULL,
    [MUDOUCPF] smallint NULL,
    [DEFICIENTEOUTROS] int NULL
);

/* TITMMOV  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TITMMOV] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDMOV] int NOT NULL,
    [NSEQITMMOV] int NOT NULL,
    [NUMEROSEQUENCIAL] smallint NOT NULL,
    [IDPRD] int NULL,
    [CODTIP] varchar(10) NULL,
    [QUANTIDADE] rmdvalor4 NULL,
    [PRECOUNITARIO] decimal(21,10) NULL,
    [PRECOTABELA] rmdvalor4 NULL,
    [PERCENTUALDESC] rmdvalor4 NULL,
    [VALORDESC] rmdvalor4 NULL,
    [PERCENTUALDESP] rmdvalor4 NULL,
    [VALORDESP] rmdvalor4 NULL,
    [DATAEMISSAO] datetime NULL,
    [CODMEN] varchar(5) NULL,
    [NUMEROTRIBUTOS] smallint NULL,
    [CODTB1FAT] varchar(10) NULL,
    [CODTB2FAT] varchar(10) NULL,
    [CODTB3FAT] varchar(10) NULL,
    [CODTB4FAT] varchar(10) NULL,
    [CODTB5FAT] varchar(10) NULL,
    [CODTB1FLX] varchar(25) NULL,
    [CODTB2FLX] varchar(25) NULL,
    [CODTB3FLX] varchar(25) NULL,
    [CODTB4FLX] varchar(25) NULL,
    [CODTB5FLX] varchar(25) NULL,
    [CAMPOLIVRE] varchar(15) NULL,
    [CODUND] varchar(5) NULL,
    [QUANTIDADEARECEBER] rmdvalor4 NULL,
    [CODNAT] varchar(10) NULL,
    [CODCPG] varchar(5) NULL,
    [DATAENTREGA] datetime NULL,
    [PRATELEIRA] varchar(15) NULL,
    [IDCNT] int NULL,
    [NSEQITMCNT] smallint NULL,
    [DATAINIFAT] datetime NULL,
    [DATAFIMFAT] datetime NULL,
    [FLAGEFEITOSALDO] smallint NULL,
    [VALORUNITARIO] rmdvalor4 NULL,
    [VALORFINANCEIRO] rmdvalor4 NULL,
    [IMPRIMEMOV] smallint NULL,
    [CODCCUSTO] varchar(25) NULL,
    [FLAGREPASSE] smallint NULL,
    [ALIQORDENACAO] rmdvalor4 NULL,
    [QUANTIDADEORIGINAL] rmdvalor4 NULL,
    [IDNAT] int NULL,
    [FLAG] smallint NULL,
    [CHAPA] dchapanull NULL,
    [INICIO] datetime NULL,
    [TERMINO] datetime NULL,
    [PREVINICIO] datetime NULL,
    [STATUS] char(1) NULL,
    [BLOCK] smallint NULL,
    [FLAGREFATURAMENTO] smallint NULL,
    [IDCNTDESTINO] int NULL,
    [NSEQITMCNTDEST] smallint NULL,
    [FATORCONVUND] rmdvalor4 NULL,
    [IDPRJ] int NULL,
    [IDTRF] int NULL,
    [VALORTOTALITEM] decimal(21,10) NULL,
    [VALORCODIGOPRD] varchar(200) NULL,
    [TIPOCODIGOPRD] smallint NULL,
    [QTDUNDPEDIDO] rmdvalor4 NULL,
    [TRIBUTACAOECF] varchar(10) NULL,
    [CODFILIAL] smallint NULL,
    [CODDEPARTAMENTO] varchar(25) NULL,
    [IDPRDCOMPOSTO] int NULL,
    [QUANTIDADESEPARADA] rmdvalor4 NULL,
    [PERCENTCOMISSAO] rmdvalor4 NULL,
    [INDICENCM] char(1) NULL,
    [NCM] varchar(14) NULL,
    [CODRPR] varchar(15) NULL,
    [COMISSAOREPRES] rmdvalor4 NULL,
    [NSEQITMCNTMEDICAO] smallint NULL,
    [VALORESCRITURACAO] rmdvalor4 NULL,
    [VALORFINPEDIDO] rmdvalor4 NULL,
    [VALORFRETECTRC] rmdvalor4 NULL,
    [VALOROPFRM1] rmdvalor4 NULL,
    [VALOROPFRM2] rmdvalor4 NULL,
    [IDOBJOFICINA] varchar(20) NULL,
    [PRECOEDITADO] dlogiconull NULL,
    [QTDEVOLUMEUNITARIO] smallint NULL,
    [IDGRD] int NULL,
    [CODVEN1] varchar(16) NULL,
    [CODLOCALBN] varchar(40) NULL,
    [REGISTROEXPORTACAO] varchar(12) NULL,
    [DATARE] datetime NULL,
    [PRECOTOTALEDITADO] dlogiconull NULL,
    [CST] varchar(3) NULL,
    [VALORDESCCONDICONALITM] rmdvalor4 NULL,
    [VALORDESPCONDICIONALITM] rmdvalor4 NULL,
    [DATAORCAMENTO] datetime NULL,
    [CODTBORCAMENTO] varchar(40) NULL,
    [RATEIOFRETE] rmdvalor4 NULL,
    [RATEIOSEGURO] rmdvalor4 NULL,
    [RATEIODESC] rmdvalor4 NULL,
    [RATEIODESP] rmdvalor4 NULL,
    [RATEIOEXTRA1] rmdvalor4 NULL,
    [RATEIOEXTRA2] rmdvalor4 NULL,
    [RATEIOFRETECTRC] rmdvalor4 NULL,
    [RATEIODEDMAT] rmdvalor4 NULL,
    [RATEIODEDSUB] rmdvalor4 NULL,
    [RATEIODEDOUT] rmdvalor4 NULL,
    [IDCLASSIFENERGIACOMUNIC] int NULL,
    [VALORUNTORCAMENTO] rmdvalor4 NULL,
    [VALSERVICONFE] rmdvalor4 NULL,
    [CODLOC] varchar(15) NULL,
    [VALORBEM] rmdvalor4 NULL,
    [VALORLIQUIDO] rmdvalor4 NULL,
    [CODIGOCODIF] varchar(21) NULL,
    [CODMUNSERVICO] varchar(20) NULL,
    [CODETDMUNSERV] varchar(2) NULL,
    [RATEIOCCUSTODEPTO] rmdvalor4 NULL,
    [CUSTOREPOSICAO] rmdvalor4 NULL,
    [CUSTOREPOSICAOB] rmdvalor4 NULL,
    [VALORFINTERCEIROS] rmdvalor4 NULL,
    [VALORFINANCGERENCIAL] rmdvalor4 NULL,
    [CODIGOSERVICO] varchar(40) NULL,
    [VALORUNITGERENCIAL] rmdvalor4 NULL,
    [IDINTEGRACAO] varchar(100) NULL,
    [IDTABPRECO] int NULL,
    [VALORBRUTOITEM] decimal(21,10) NULL,
    [VALORBRUTOITEMORIG] decimal(21,10) NULL,
    [CODCOLTBORCAMENTO] dcodcoligadanull NULL,
    [CODPUBLIC] int NULL,
    [QUANTIDADETOTAL] rmdvalor4 NULL,
    [PRODUTOSUBSTITUTO] dlogico NOT NULL,
    [CODTBGRUPOORC] varchar(40) NULL,
    [PRECOUNITARIOSELEC] int NULL,
    [VALORRATEIOLAN] rmdvalor4 NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [IDCNTOP] int NULL,
    [QUANTIDADECONCLUIDA] rmdvalor4 NULL,
    [DATAFATCONTRATO] ddatetime NULL,
    [VALORRECEBIDOFATPARC] rmdvalor4 NULL,
    [VALORCONCLUIDO] rmdvalor4 NULL,
    [CONSIGNADO] smallint NULL,
    [INTEGRAAPLICACAO] varchar(1) NOT NULL,
    [IDPRDORIGEM] int NULL,
    [VALORRETENCAO] rmdvalor4 NULL,
    [PERCENTUALRETENCAO] decimal(21,10) NULL,
    [CODCOLMARCA] dcodcoligada NULL,
    [IDMARCA] dinteger NULL,
    [VALORDEDUCAO] rmdvalor4 NULL,
    [PERCENTUALDEDUCAO] rmdvalor4 NULL,
    [QUANTIDADETRIBUTAVEL] rmdvalor4 NULL,
    [CODBEMSIGAMNT] varchar(30) NULL,
    [TAXAJUROS] rmdvalor4 NULL,
    [IDMOVSOLICITACAOMNT] int NULL,
    [VALORBASEDEPRECIACAOBEM] rmdvalor4 NULL,
    [DESCRICAOPRDCFO] varchar(120) NULL,
    [IDITMCNT2PARCELA] int NULL,
    [NSEQPARCELA] smallint NULL,
    [IDREGRATRIBUTARIA] int NULL,
    [DATARETORNOREMESSA] datetime NULL
);

/* TITMORCAMENTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TITMORCAMENTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDORCAMENTO] int NOT NULL,
    [IDPERIODO] int NOT NULL,
    [IDITMPERIODO] int NOT NULL,
    [VALORORCADO] rmdvalor4 NULL,
    [VALORREAL] rmdvalor4 NULL,
    [VALOROPCIONAL1] rmdvalor4 NULL,
    [VALOROPCIONAL2] rmdvalor4 NULL,
    [VALORRECEBIDO] rmdvalor4 NULL,
    [VALORCEDIDO] rmdvalor4 NULL,
    [VALOREXCEDENTE] rmdvalor4 NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL
);

/* TMOV  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TMOV] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDMOV] int NOT NULL,
    [CODFILIAL] smallint NULL,
    [CODLOC] varchar(15) NULL,
    [CODLOCENTREGA] varchar(15) NULL,
    [CODLOCDESTINO] varchar(15) NULL,
    [CODCFO] varchar(25) NULL,
    [CODCFONATUREZA] varchar(25) NULL,
    [NUMEROMOV] varchar(35) NULL,
    [SERIE] varchar(8) NULL,
    [CODTMV] varchar(10) NULL,
    [TIPO] varchar(1) NULL,
    [STATUS] varchar(1) NULL,
    [MOVIMPRESSO] smallint NULL,
    [DOCIMPRESSO] smallint NULL,
    [FATIMPRESSA] smallint NULL,
    [DATAEMISSAO] datetime NULL,
    [DATASAIDA] datetime NULL,
    [DATAEXTRA1] datetime NULL,
    [DATAEXTRA2] datetime NULL,
    [CODRPR] varchar(15) NULL,
    [COMISSAOREPRES] rmdvalor4 NULL,
    [NORDEM] varchar(20) NULL,
    [CODCPG] varchar(5) NULL,
    [NUMEROTRIBUTOS] smallint NULL,
    [VALORBRUTO] rmdvalor4 NULL,
    [VALORLIQUIDO] rmdvalor4 NULL,
    [VALOROUTROS] rmdvalor4 NULL,
    [OBSERVACAO] varchar(60) NULL,
    [PERCENTUALFRETE] rmdvalor4 NULL,
    [VALORFRETE] rmdvalor4 NULL,
    [PERCENTUALSEGURO] rmdvalor4 NULL,
    [VALORSEGURO] rmdvalor4 NULL,
    [PERCENTUALDESC] rmdvalor4 NULL,
    [VALORDESC] rmdvalor4 NULL,
    [PERCENTUALDESP] rmdvalor4 NULL,
    [VALORDESP] rmdvalor4 NULL,
    [PERCENTUALEXTRA1] rmdvalor4 NULL,
    [VALOREXTRA1] rmdvalor4 NULL,
    [PERCENTUALEXTRA2] rmdvalor4 NULL,
    [VALOREXTRA2] rmdvalor4 NULL,
    [PERCCOMISSAO] rmdvalor4 NULL,
    [CODMEN] varchar(5) NULL,
    [CODMEN2] varchar(5) NULL,
    [VIADETRANSPORTE] varchar(15) NULL,
    [PLACA] varchar(10) NULL,
    [CODETDPLACA] varchar(2) NULL,
    [PESOLIQUIDO] rmdvalor4 NULL,
    [PESOBRUTO] rmdvalor4 NULL,
    [MARCA] varchar(60) NULL,
    [NUMERO] varchar(60) NULL,
    [QUANTIDADE] rmdvalor4 NULL,
    [ESPECIE] varchar(20) NULL,
    [CODTB1FAT] varchar(10) NULL,
    [CODTB2FAT] varchar(10) NULL,
    [CODTB3FAT] varchar(10) NULL,
    [CODTB4FAT] varchar(10) NULL,
    [CODTB5FAT] varchar(10) NULL,
    [CODTB1FLX] varchar(25) NULL,
    [CODTB2FLX] varchar(25) NULL,
    [CODTB3FLX] varchar(25) NULL,
    [CODTB4FLX] varchar(25) NULL,
    [CODTB5FLX] varchar(25) NULL,
    [IDMOVRELAC] int NULL,
    [IDMOVLCTFLUXUS] int NULL,
    [IDMOVPEDDESDOBRADO] int NULL,
    [CODMOEVALORLIQUIDO] varchar(10) NULL,
    [DATABASEMOV] datetime NULL,
    [DATAMOVIMENTO] datetime NULL,
    [NUMEROLCTGERADO] smallint NULL,
    [GEROUFATURA] smallint NULL,
    [NUMEROLCTABERTO] smallint NULL,
    [FLAGEXPORTACAO] smallint NULL,
    [EMITEBOLETA] varchar(1) NULL,
    [CODMENDESCONTO] varchar(5) NULL,
    [CODMENDESPESA] varchar(5) NULL,
    [CODMENFRETE] varchar(5) NULL,
    [FRETECIFOUFOB] smallint NULL,
    [USADESPFINANC] smallint NULL,
    [FLAGEXPORFISC] smallint NULL,
    [FLAGEXPORFAZENDA] smallint NULL,
    [VALORADIANTAMENTO] rmdvalor4 NULL,
    [CODTRA] varchar(5) NULL,
    [CODTRA2] varchar(5) NULL,
    [STATUSLIBERACAO] smallint NULL,
    [CODCFOAUX] varchar(25) NULL,
    [IDLOT] int NULL,
    [ITENSAGRUPADOS] smallint NULL,
    [FLAGIMPRESSAOFAT] varchar(1) NULL,
    [DATACANCELAMENTOMOV] datetime NULL,
    [VALORRECEBIDO] rmdvalor4 NULL,
    [SEGUNDONUMERO] varchar(20) NULL,
    [CODCCUSTO] varchar(25) NULL,
    [CODCXA] varchar(10) NULL,
    [CODVEN1] varchar(16) NULL,
    [CODVEN2] varchar(16) NULL,
    [CODVEN3] varchar(16) NULL,
    [CODVEN4] varchar(16) NULL,
    [PERCCOMISSAOVEN2] rmdvalor4 NULL,
    [CODCOLCFO] smallint NULL,
    [CODCOLCFONATUREZA] smallint NULL,
    [CODUSUARIO] varchar(20) NULL,
    [CODFILIALENTREGA] smallint NULL,
    [CODFILIALDESTINO] smallint NULL,
    [FLAGAGRUPADOFLUXUS] smallint NULL,
    [CODCOLCXA] dcodcoligadanull NULL,
    [GERADOPORLOTE] smallint NULL,
    [CODDEPARTAMENTO] varchar(25) NULL,
    [CODCCUSTODESTINO] varchar(25) NULL,
    [CODEVENTO] smallint NULL,
    [STATUSEXPORTCONT] smallint NULL,
    [CODLOTE] int NULL,
    [STATUSCHEQUE] smallint NULL,
    [DATAENTREGA] datetime NULL,
    [DATAPROGRAMACAO] datetime NULL,
    [IDNAT] int NULL,
    [IDNAT2] int NULL,
    [CAMPOLIVRE1] varchar(100) NULL,
    [CAMPOLIVRE2] varchar(100) NULL,
    [CAMPOLIVRE3] varchar(100) NULL,
    [GEROUCONTATRABALHO] dlogiconull NULL,
    [GERADOPORCONTATRABALHO] dlogiconull NULL,
    [HORULTIMAALTERACAO] datetime NULL,
    [CODLAF] varchar(15) NULL,
    [DATAFECHAMENTO] datetime NULL,
    [NSEQDATAFECHAMENTO] smallint NULL,
    [NUMERORECIBO] varchar(12) NULL,
    [IDLOTEPROCESSO] int NULL,
    [IDOBJOF] varchar(20) NULL,
    [CODAGENDAMENTO] int NULL,
    [CHAPARESP] dchapanull NULL,
    [IDLOTEPROCESSOREFAT] int NULL,
    [INDUSOOBJ] rmdvalor2 NULL,
    [SUBSERIE] varchar(8) NULL,
    [STSCOMPRAS] dtstatus NULL,
    [CODLOCEXP] dtcodigo NULL,
    [IDCLASSMOV] dtidentificador NULL,
    [CODENTREGA] dtcodigo NULL,
    [CODFAIXAENTREGA] dtcodigo NULL,
    [DTHENTREGA] ddatetime NULL,
    [CONTABILIZADOPORTOTAL] dlogiconull NULL,
    [CODLAFE] varchar(15) NULL,
    [IDPRJ] int NULL,
    [NUMEROCUPOM] int NULL,
    [NUMEROCAIXA] int NULL,
    [FLAGEFEITOSALDO] smallint NULL,
    [INTEGRADOBONUM] dlogiconull NULL,
    [CODMOELANCAMENTO] varchar(10) NULL,
    [NAONUMERADO] varchar(1) NULL,
    [FLAGPROCESSADO] dlogiconull NULL,
    [ABATIMENTOICMS] rmdvalor4 NULL,
    [TIPOCONSUMO] smallint NULL,
    [HORARIOEMISSAO] datetime NULL,
    [DATARETORNO] datetime NULL,
    [USUARIOCRIACAO] varchar(20) NULL,
    [DATACRIACAO] datetime NULL,
    [IDCONTATOENTREGA] int NULL,
    [IDCONTATOCOBRANCA] int NULL,
    [STATUSSEPARACAO] varchar(1) NULL,
    [STSEMAIL] dlogiconull NULL,
    [VALORFRETECTRC] rmdvalor4 NULL,
    [PONTOVENDA] varchar(10) NULL,
    [PRAZOENTREGA] int NULL,
    [VALORBRUTOINTERNO] rmdvalor4 NULL,
    [IDAIDF] smallint NULL,
    [IDSALDOESTOQUE] int NULL,
    [VINCULADOESTOQUEFL] dlogiconull NULL,
    [IDREDUCAOZ] int NULL,
    [HORASAIDA] datetime NULL,
    [CODMUNSERVICO] varchar(20) NULL,
    [CODETDMUNSERV] varchar(2) NULL,
    [APROPRIADO] smallint NULL,
    [CODIGOSERVICO] varchar(40) NULL,
    [DATADEDUCAO] datetime NULL,
    [CODDIARIO] varchar(5) NULL,
    [SEQDIARIO] varchar(9) NULL,
    [SEQDIARIOESTORNO] varchar(9) NULL,
    [INSSEMOUTRAEMPRESA] rmdvalor4 NULL,
    [IDMOVCTRC] int NULL,
    [DATAPROGRAMACAOANT] datetime NULL,
    [CODTDO] varchar(10) NULL,
    [VALORDESCCONDICIONAL] rmdvalor4 NULL,
    [VALORDESPCONDICIONAL] rmdvalor4 NULL,
    [CODIGOIRRF] varchar(10) NULL,
    [DEDUCAOIRRF] rmdvalor4 NULL,
    [PERCENTBASEINSS] rmdvalor4 NULL,
    [PERCBASEINSSEMPREGADO] rmdvalor4 NULL,
    [CONTORCAMENTOANTIGO] dlogiconull NULL,
    [CODDEPTODESTINO] varchar(25) NULL,
    [DATACONTABILIZACAO] datetime NULL,
    [CODVIATRANSPORTE] varchar(1) NULL,
    [VALORSERVICO] rmdvalor4 NULL,
    [SEQUENCIALESTOQUE] int NULL,
    [DISTANCIA] int NULL,
    [UNCALCULO] varchar(5) NULL,
    [FORMACALCULO] varchar(1) NULL,
    [INTEGRADOAUTOMACAO] smallint NULL,
    [INTEGRAAPLICACAO] char(1) NOT NULL,
    [CLASSECONSUMO] varchar(1) NULL,
    [TIPOASSINANTE] varchar(2) NULL,
    [FASE] varchar(1) NULL,
    [TIPOUTILIZACAO] varchar(1) NULL,
    [GRUPOTENSAO] varchar(1) NULL,
    [DATALANCAMENTO] datetime NULL,
    [EXTENPORANEO] dlogiconull NULL,
    [RECIBONFESTATUS] varchar(1) NULL,
    [RECIBONFETIPO] smallint NULL,
    [RECIBONFENUMERO] varchar(12) NULL,
    [RECIBONFESITUACAO] smallint NULL,
    [IDMOVCFO] int NULL,
    [OCAUTONOMO] smallint NULL,
    [VALORMERCADORIAS] rmdvalor4 NULL,
    [NATUREZAVOLUMES] varchar(30) NULL,
    [VOLUMES] varchar(30) NULL,
    [CRO] smallint NULL,
    [USARATEIOVALORFIN] dlogiconull NULL,
    [RECIBONFESERIE] varchar(5) NULL,
    [CODCOLCFOORIGEM] dcodcoligadanull NULL,
    [CODCFOORIGEM] varchar(25) NULL,
    [VALORCTRCARATEAR] rmdvalor4 NULL,
    [CODCOLCFOAUX] smallint NULL,
    [VRBASEINSSOUTRAEMPRESA] rmdvalor4 NULL,
    [IDCEICFO] int NULL,
    [CHAVEACESSONFE] varchar(50) NULL,
    [VLRSECCAT] rmdvalor4 NULL,
    [VLRDESPACHO] rmdvalor4 NULL,
    [VLRPEDAGIO] rmdvalor4 NULL,
    [VLRFRETEOUTROS] rmdvalor4 NULL,
    [ABATIMENTONAOTRIB] rmdvalor4 NULL,
    [RATEIOCCUSTODEPTO] rmdvalor4 NULL,
    [VALORRATEIOLAN] rmdvalor4 NULL,
    [CODCOLCFOTRANSFAT] dcodcoligadanull NULL,
    [CODCFOTRANSFAT] varchar(25) NULL,
    [CODUSUARIOAPROVADESC] varchar(20) NULL,
    [IDINTEGRACAO] varchar(100) NULL,
    [STATUSANTERIOR] varchar(1) NULL,
    [VALORBRUTOORIG] rmdvalor4 NULL,
    [VALORLIQUIDOORIG] rmdvalor4 NULL,
    [VALOROUTROSORIG] rmdvalor4 NULL,
    [VALORRATEIOLANORIG] rmdvalor4 NULL,
    [IDOPERACAO] int NULL,
    [DATAPROCESSAMENTO] ddatetime NULL,
    [IDNATFRETE] int NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [VALORRECEBIDOFATPARC] rmdvalor4 NULL,
    [VALORCONCLUIDO] rmdvalor4 NULL,
    [IDTSS] varchar(15) NULL,
    [FLAGCONCLUSAO] smallint NULL,
    [STATUSPARADIGMA] varchar(1) NULL,
    [PRODPREDOMINANTE] varchar(60) NULL,
    [STATUSMOVINCLUSAOCOLAB] int NULL,
    [CNPJCPFADQUIRENTE] varchar(20) NULL,
    [NOMEADQUIRENTE] varchar(60) NULL,
    [DOCESTRANGEIROADQUIRENTE] varchar(20) NULL,
    [CODFILIALSCP] smallint NULL,
    [STSCONTRATO] dtstatus NULL,
    [STSCONCLUIDO] char(1) NULL,
    [IDMOVOSMNT] int NULL,
    [CODCOLINTERMEDIADOR] dcodcoligadanull NULL,
    [IDINTERMEDIADOR] int NULL,
    [DESCONSIDERARSNMOV] smallint NULL,
    [PROTOCOLOAUTNFE] char(156) NULL,
    [IDNATRENDIMENTO] int NULL,
    [PERCCOMISSAOVEN3] rmdvalor4 NULL,
    [PERCCOMISSAOVEN4] rmdvalor4 NULL,
    [MOTIVOSUBSTITUICAO] varchar(2) NULL,
    [JUSTIFICATIVASUBSTITUICAO] varchar(255) NULL,
    [CODMUNOPER] varchar(20) NULL,
    [CODUFOPER] varchar(2) NULL,
    [TIPOGUIATRANSITO] smallint NULL,
    [CODUFEMISSAOGUIATRANSITO] varchar(2) NULL,
    [SERIEGUIATRANSITO] varchar(9) NULL,
    [NUMGUIATRANSITO] int NULL
);

/* TMOVORCAMENTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TMOVORCAMENTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDMOVORCAMENTO] int NOT NULL,
    [IDORCAMENTO] int NOT NULL,
    [IDPERIODO] int NOT NULL,
    [IDITMPERIODO] int NOT NULL,
    [IDMOV] int NULL,
    [TIPO] varchar(2) NOT NULL,
    [TIPOOPERACAO] varchar(2) NOT NULL,
    [VALORORCADO] rmdvalor4 NULL,
    [VALORREAL] rmdvalor4 NULL,
    [VALOROPCIONAL1] rmdvalor4 NULL,
    [VALOROPCIONAL2] rmdvalor4 NULL,
    [VALORRECEBIDO] rmdvalor4 NULL,
    [VALORCEDIDO] rmdvalor4 NULL,
    [VALOREXCEDENTE] rmdvalor4 NULL,
    [DATACRIACAO] datetime NULL,
    [USUARIOCRIACAO] varchar(20) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [INTEGRAAPLICACAO] varchar(2) NULL
);

/* TMOVRELAC  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TMOVRELAC] (
    [IDMOVORIGEM] dtidentificador NOT NULL,
    [CODCOLORIGEM] dcodcoligada NOT NULL,
    [IDMOVDESTINO] dtidentificador NOT NULL,
    [CODCOLDESTINO] dcodcoligada NOT NULL,
    [TIPORELAC] varchar(1) NOT NULL,
    [IDPROCESSO] int NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [VALORRECEBIDO] rmdvalor4 NULL
);

/* TORCAMENTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TORCAMENTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDORCAMENTO] int NOT NULL,
    [IDPERIODO] int NOT NULL,
    [CODCCUSTO] varchar(25) NOT NULL,
    [CODTBORCAMENTO] varchar(40) NOT NULL,
    [CODCOLTBORCAMENTO] dcodcoligadanull NULL,
    [CODTBGRUPOORC] varchar(40) NULL,
    [CODSISTEMA] varchar(1) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [TIPO] varchar(1) NULL
);

/* TPERIODOORCAMENTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TPERIODOORCAMENTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [IDPERIODO] int NOT NULL,
    [STATUS] smallint NOT NULL,
    [DESCRICAO] varchar(100) NULL,
    [DATAINICIO] datetime NOT NULL,
    [DATAFIM] datetime NOT NULL,
    [PERIODICIDADE] varchar(20) NULL,
    [CODCLASSIFPERIODO] varchar(10) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL,
    [INTEGRAAPLICACAO] varchar(2) NULL
);

/* TTBORCAMENTO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[TTBORCAMENTO] (
    [CODCOLIGADA] dcodcoligada NOT NULL,
    [CODTBORCAMENTO] varchar(40) NOT NULL,
    [DESCRICAO] varchar(100) NULL,
    [CAMPOLIVRE] varchar(20) NULL,
    [INATIVO] smallint NULL,
    [NAOPERMITETRANSF] smallint NULL,
    [NATUREZA] smallint NOT NULL,
    [SINTETICOANALITICO] smallint NOT NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime NULL
);

/* Chaves estrangeiras declaradas em CORPORE */
ALTER TABLE [CCONTA] ADD CONSTRAINT [FKCCONTAESTORNO_CCONTA]
    FOREIGN KEY ([CODCOLCONTAESTORNO]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CCONTA] ADD CONSTRAINT [FKCCONTAESTORNO_CCONTA]
    FOREIGN KEY ([CONTAESTORNO]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [CLANCAMENTO] ADD CONSTRAINT [FKCLANCAMENTO_CLOTE]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [CLOTE] ([CODCOLIGADA]);
ALTER TABLE [CLANCAMENTO] ADD CONSTRAINT [FKUSUARIOAPROVADOR]
    FOREIGN KEY ([CODUSUARIOAPROVACAO]) REFERENCES [GUSUARIO] ([CODUSUARIO]);
ALTER TABLE [CLANCAMENTO] ADD CONSTRAINT [FKCLANCAMENTO_CLOTE]
    FOREIGN KEY ([CODLOTE]) REFERENCES [CLOTE] ([CODLOTE]);
ALTER TABLE [CLOTE] ADD CONSTRAINT [FKCLOTE_GUSUARIO]
    FOREIGN KEY ([USUARIOATUAL]) REFERENCES [GUSUARIO] ([CODUSUARIO]);
ALTER TABLE [CLOTE] ADD CONSTRAINT [FKCLOTE_GUSUARIOSOLICITANTE]
    FOREIGN KEY ([USUARIOSOLICITANTE]) REFERENCES [GUSUARIO] ([CODUSUARIO]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTAELIMINACAO]
    FOREIGN KEY ([CODCOLCONTAELIMINACAO]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTACREDITO]
    FOREIGN KEY ([CODCOLCREDITO]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTADEBITO]
    FOREIGN KEY ([CODCOLDEBITO]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CLANCAMENTO]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [CLANCAMENTO] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_GCCUSTO]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [GCCUSTO] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CLOTE]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [CLOTE] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTAPARTIDA]
    FOREIGN KEY ([CODCOLPARTIDA]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_GCCUSTO]
    FOREIGN KEY ([CODCCUSTO]) REFERENCES [GCCUSTO] ([CODCCUSTO]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTAELIMINACAO]
    FOREIGN KEY ([CODCONTAELIMINACAO]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CLOTE]
    FOREIGN KEY ([CODLOTE]) REFERENCES [CLOTE] ([CODLOTE]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTACREDITO]
    FOREIGN KEY ([CREDITO]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTADEBITO]
    FOREIGN KEY ([DEBITO]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CLANCAMENTO]
    FOREIGN KEY ([IDLANCAMENTO]) REFERENCES [CLANCAMENTO] ([IDLANCAMENTO]);
ALTER TABLE [CPARTIDA] ADD CONSTRAINT [FKCPARTIDA_CCONTAPARTIDA]
    FOREIGN KEY ([PARTIDA]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [CRATEIOLC] ADD CONSTRAINT [FKRATEIOLCCONTA]
    FOREIGN KEY ([CODCOLCONTA]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CRATEIOLC] ADD CONSTRAINT [FKRATEIOLCGERENCIAL]
    FOREIGN KEY ([CODCOLGERENCIAL]) REFERENCES [CGERENCIA] ([CODCOLIGADA]);
ALTER TABLE [CRATEIOLC] ADD CONSTRAINT [FKCRATEIOLC_CPARTIDA]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [CPARTIDA] ([CODCOLIGADA]);
ALTER TABLE [CRATEIOLC] ADD CONSTRAINT [FKRATEIOLCCONTA]
    FOREIGN KEY ([CODCONTA]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [CRATEIOLC] ADD CONSTRAINT [FKRATEIOLCGERENCIAL]
    FOREIGN KEY ([CODGERENCIAL]) REFERENCES [CGERENCIA] ([CODCONTA]);
ALTER TABLE [CRATEIOLC] ADD CONSTRAINT [FKCRATEIOLC_CPARTIDA]
    FOREIGN KEY ([IDPARTIDA]) REFERENCES [CPARTIDA] ([IDPARTIDA]);
ALTER TABLE [CRATEIOLCCC] ADD CONSTRAINT [FKCRATEIOLCCCCTA]
    FOREIGN KEY ([CODCOLCONTA]) REFERENCES [CCONTA] ([CODCOLIGADA]);
ALTER TABLE [CRATEIOLCCC] ADD CONSTRAINT [FKCRATEIOLCCCCC]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [GCCUSTO] ([CODCOLIGADA]);
ALTER TABLE [CRATEIOLCCC] ADD CONSTRAINT [FKCRATEIOLCCCCC]
    FOREIGN KEY ([CODCCUSTO]) REFERENCES [GCCUSTO] ([CODCCUSTO]);
ALTER TABLE [CRATEIOLCCC] ADD CONSTRAINT [FKCRATEIOLCCCCTA]
    FOREIGN KEY ([CODCONTA]) REFERENCES [CCONTA] ([CODCONTA]);
ALTER TABLE [FCFO] ADD CONSTRAINT [FKFCFO_FCFOINTEGRACAO]
    FOREIGN KEY ([CODCFOCOLINTEGRACAO]) REFERENCES [FCFO] ([CODCOLIGADA]);
ALTER TABLE [FCFO] ADD CONSTRAINT [FKFCFO_CGERENCIA]
    FOREIGN KEY ([CODCOLCONTAGER]) REFERENCES [CGERENCIA] ([CODCOLIGADA]);
ALTER TABLE [FCFO] ADD CONSTRAINT [FKFCFO_GUSUARIO]
    FOREIGN KEY ([CODUSUARIOACESSO]) REFERENCES [GUSUARIO] ([CODUSUARIO]);
ALTER TABLE [FCFO] ADD CONSTRAINT [FKFCFO_FCFOINTEGRACAO]
    FOREIGN KEY ([CODCFOINTEGRACAO]) REFERENCES [FCFO] ([CODCFO]);
ALTER TABLE [FCFO] ADD CONSTRAINT [FKFCFO_CGERENCIA]
    FOREIGN KEY ([CODCONTAGER]) REFERENCES [CGERENCIA] ([CODCONTA]);
ALTER TABLE [GCCUSTO] ADD CONSTRAINT [GCCUSTO_CGERENCIA]
    FOREIGN KEY ([CODCOLCONTA]) REFERENCES [CGERENCIA] ([CODCOLIGADA]);
ALTER TABLE [GCCUSTO] ADD CONSTRAINT [FKGCCUSTO_CGERENCIA]
    FOREIGN KEY ([CODCOLCONTAGER]) REFERENCES [CGERENCIA] ([CODCOLIGADA]);
ALTER TABLE [GCCUSTO] ADD CONSTRAINT [FK_GCCUSTO_PPESSOA]
    FOREIGN KEY ([RESPONSAVEL]) REFERENCES [PPESSOA] ([CODIGO]);
ALTER TABLE [GCCUSTO] ADD CONSTRAINT [GCCUSTO_CGERENCIA]
    FOREIGN KEY ([CODCONTA]) REFERENCES [CGERENCIA] ([CODCONTA]);
ALTER TABLE [GCCUSTO] ADD CONSTRAINT [FKGCCUSTO_CGERENCIA]
    FOREIGN KEY ([CODCONTAGER]) REFERENCES [CGERENCIA] ([CODCONTA]);
ALTER TABLE [PPESSOA] ADD CONSTRAINT [FKPPESSOA_GUSUARIO]
    FOREIGN KEY ([CODUSUARIO]) REFERENCES [GUSUARIO] ([CODUSUARIO]);
ALTER TABLE [TITMMOV] ADD CONSTRAINT [FKTITMMOV_GCCU]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [GCCUSTO] ([CODCOLIGADA]);
ALTER TABLE [TITMMOV] ADD CONSTRAINT [FKTITMMOV_TMOV]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [TMOV] ([CODCOLIGADA]);
ALTER TABLE [TITMMOV] ADD CONSTRAINT [FKTITMMOV_TTBORCAMENTO]
    FOREIGN KEY ([CODCOLTBORCAMENTO]) REFERENCES [TTBORCAMENTO] ([CODCOLIGADA]);
ALTER TABLE [TITMMOV] ADD CONSTRAINT [FKTITMMOV_GCCU]
    FOREIGN KEY ([CODCCUSTO]) REFERENCES [GCCUSTO] ([CODCCUSTO]);
ALTER TABLE [TITMMOV] ADD CONSTRAINT [FKTITMMOV_TTBORCAMENTO]
    FOREIGN KEY ([CODTBORCAMENTO]) REFERENCES [TTBORCAMENTO] ([CODTBORCAMENTO]);
ALTER TABLE [TITMMOV] ADD CONSTRAINT [FKTITMMOV_TMOV]
    FOREIGN KEY ([IDMOV]) REFERENCES [TMOV] ([IDMOV]);
ALTER TABLE [TITMORCAMENTO] ADD CONSTRAINT [FKTITMORCAMENTO_TORCAMENTO]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [TORCAMENTO] ([CODCOLIGADA]);
ALTER TABLE [TITMORCAMENTO] ADD CONSTRAINT [FKTITMORCAMENTO_TORCAMENTO]
    FOREIGN KEY ([IDORCAMENTO]) REFERENCES [TORCAMENTO] ([IDORCAMENTO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFO]
    FOREIGN KEY ([CODCOLCFO]) REFERENCES [FCFO] ([CODCOLIGADA]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFONATUREZA]
    FOREIGN KEY ([CODCOLCFONATUREZA]) REFERENCES [FCFO] ([CODCOLIGADA]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFOORIGEM]
    FOREIGN KEY ([CODCOLCFOORIGEM]) REFERENCES [FCFO] ([CODCOLIGADA]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFOTRANSF]
    FOREIGN KEY ([CODCOLCFOTRANSFAT]) REFERENCES [FCFO] ([CODCOLIGADA]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_TMOVRELAC]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [TMOV] ([CODCOLIGADA]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_GCCUDEST]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [GCCUSTO] ([CODCOLIGADA]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_GCCU]
    FOREIGN KEY ([CODCCUSTO]) REFERENCES [GCCUSTO] ([CODCCUSTO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_GCCUDEST]
    FOREIGN KEY ([CODCCUSTODESTINO]) REFERENCES [GCCUSTO] ([CODCCUSTO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFO]
    FOREIGN KEY ([CODCFO]) REFERENCES [FCFO] ([CODCFO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFONATUREZA]
    FOREIGN KEY ([CODCFONATUREZA]) REFERENCES [FCFO] ([CODCFO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFOORIGEM]
    FOREIGN KEY ([CODCFOORIGEM]) REFERENCES [FCFO] ([CODCFO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_FCFOTRANSF]
    FOREIGN KEY ([CODCFOTRANSFAT]) REFERENCES [FCFO] ([CODCFO]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_TMOVFLUXUS]
    FOREIGN KEY ([IDMOVLCTFLUXUS]) REFERENCES [TMOV] ([IDMOV]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_TMOVPEDDESDOBRADO]
    FOREIGN KEY ([IDMOVPEDDESDOBRADO]) REFERENCES [TMOV] ([IDMOV]);
ALTER TABLE [TMOV] ADD CONSTRAINT [FKTMOV_TMOVRELAC]
    FOREIGN KEY ([IDMOVRELAC]) REFERENCES [TMOV] ([IDMOV]);
ALTER TABLE [TMOVORCAMENTO] ADD CONSTRAINT [FKTMOVORCAMENTO_TITMORCAMENTO]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [TITMORCAMENTO] ([CODCOLIGADA]);
ALTER TABLE [TMOVORCAMENTO] ADD CONSTRAINT [FKTMOVORCAMENTO_TITMORCAMENTO]
    FOREIGN KEY ([IDORCAMENTO]) REFERENCES [TITMORCAMENTO] ([IDORCAMENTO]);
ALTER TABLE [TMOVORCAMENTO] ADD CONSTRAINT [FKTMOVORCAMENTO_TITMORCAMENTO]
    FOREIGN KEY ([IDITMPERIODO]) REFERENCES [TITMORCAMENTO] ([IDITMPERIODO]);
ALTER TABLE [TMOVRELAC] ADD CONSTRAINT [FKTMOVRELAC_TMOVDESTINO]
    FOREIGN KEY ([CODCOLDESTINO]) REFERENCES [TMOV] ([CODCOLIGADA]);
ALTER TABLE [TMOVRELAC] ADD CONSTRAINT [FKTMOVRELAC_TMOVORIGEM]
    FOREIGN KEY ([CODCOLORIGEM]) REFERENCES [TMOV] ([CODCOLIGADA]);
ALTER TABLE [TMOVRELAC] ADD CONSTRAINT [FKTMOVRELAC_TMOVDESTINO]
    FOREIGN KEY ([IDMOVDESTINO]) REFERENCES [TMOV] ([IDMOV]);
ALTER TABLE [TMOVRELAC] ADD CONSTRAINT [FKTMOVRELAC_TMOVORIGEM]
    FOREIGN KEY ([IDMOVORIGEM]) REFERENCES [TMOV] ([IDMOV]);
ALTER TABLE [TORCAMENTO] ADD CONSTRAINT [FKTORCAMENTO_GCCUSTO]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [GCCUSTO] ([CODCOLIGADA]);
ALTER TABLE [TORCAMENTO] ADD CONSTRAINT [FKTORCAMENTO_TPERIODOORCAMENTO]
    FOREIGN KEY ([CODCOLIGADA]) REFERENCES [TPERIODOORCAMENTO] ([CODCOLIGADA]);
ALTER TABLE [TORCAMENTO] ADD CONSTRAINT [FKTORCAMENTO_TTBORCAMENTO]
    FOREIGN KEY ([CODCOLTBORCAMENTO]) REFERENCES [TTBORCAMENTO] ([CODCOLIGADA]);
ALTER TABLE [TORCAMENTO] ADD CONSTRAINT [FKTORCAMENTO_GCCUSTO]
    FOREIGN KEY ([CODCCUSTO]) REFERENCES [GCCUSTO] ([CODCCUSTO]);
ALTER TABLE [TORCAMENTO] ADD CONSTRAINT [FKTORCAMENTO_TTBORCAMENTO]
    FOREIGN KEY ([CODTBORCAMENTO]) REFERENCES [TTBORCAMENTO] ([CODTBORCAMENTO]);
ALTER TABLE [TORCAMENTO] ADD CONSTRAINT [FKTORCAMENTO_TPERIODOORCAMENTO]
    FOREIGN KEY ([IDPERIODO]) REFERENCES [TPERIODOORCAMENTO] ([IDPERIODO]);

/* =============================================================================
   BASE: FLUIG   (13 objeto(s))
   USE [FLUIG];
============================================================================= */

/* Z_DELP_CAPEX_APROVACAO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_APROVACAO] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NOT NULL,
    [CODFILIAL] int NOT NULL,
    [NOME_FILIAL] varchar(60) NULL,
    [ITEM_ORIGEM] int NULL,
    [CC_ORIGEM] varchar(30) NULL,
    [DESCRICAO_ORIGEM] varchar(500) NULL,
    [TIPO] varchar(30) NOT NULL,
    [VALOR_MOVIMENTADO] decimal(18,2) NOT NULL,
    [GERENTE_NOME] varchar(150) NULL,
    [APROVADOR_MATRICULA] varchar(50) NULL,
    [APROVADOR_RESOLVIDO] bit NOT NULL,
    [SOLICITANTE_MATRICULA] varchar(50) NOT NULL,
    [STATUS] varchar(20) NOT NULL,
    [JUSTIFICATIVA_SOLIC] varchar(1000) NULL,
    [JUSTIFICATIVA_DECISAO] varchar(1000) NULL,
    [PAYLOAD_JSON] varchar(MAX) NULL,
    [DT_SOLICITACAO] datetime2 NOT NULL,
    [DT_DECISAO] datetime2 NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime2 NOT NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime2 NULL,
    [TIPO_LINHA_ORIGEM] varchar(15) NOT NULL,
    [REF_ORIGEM] bigint NULL,
    [NIVEL_ATUAL] int NOT NULL,
    [NIVEL_MAX] int NOT NULL,
    [CADEIA_JSON] nvarchar(MAX) NULL,
    [TRILHA_JSON] nvarchar(MAX) NULL,
    [SC_ID] bigint NULL,
    [TOKEN_APROVACAO] varchar(64) NULL
);

/* Z_DELP_CAPEX_APROVACAO_PLANO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_APROVACAO_PLANO] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NOT NULL,
    [VERSAO_PLANO] int NULL,
    [SOLICITANTE_LOGIN] varchar(100) NOT NULL,
    [SOLICITANTE_NOME] varchar(200) NULL,
    [STATUS] varchar(30) NOT NULL,
    [NIVEL_ATUAL] int NOT NULL,
    [APROVADOR_LOGIN] varchar(100) NULL,
    [APROVADOR_NOME] varchar(200) NULL,
    [JUSTIFICATIVA_SOLIC] varchar(2000) NULL,
    [JUSTIFICATIVA_DECISAO] varchar(2000) NULL,
    [TOKEN] varchar(80) NULL,
    [TOKEN_EXPIRA] datetime2(7) NULL,
    [DT_SOLICITACAO] datetime2(7) NOT NULL,
    [DT_DECISAO] datetime2(7) NULL,
    [RECCREATEDBY] varchar(100) NULL,
    [RECCREATEDON] datetime2(7) NOT NULL,
    [RECMODIFIEDBY] varchar(100) NULL,
    [RECMODIFIEDON] datetime2(7) NULL,
    [ANEXO_XLSX_B64] nvarchar(MAX) NULL,
    [ANEXO_NOME] nvarchar(200) NULL,
    [DECISOR_N1_LOGIN] nvarchar(100) NULL,
    [DECISOR_N1_NOME] nvarchar(200) NULL,
    [DECISOR_N1_EMAIL] nvarchar(200) NULL,
    [DECISOR_N1_DT] datetime2(7) NULL,
    [DECISOR_N2_LOGIN] nvarchar(100) NULL,
    [DECISOR_N2_NOME] nvarchar(200) NULL,
    [DECISOR_N2_EMAIL] nvarchar(200) NULL,
    [DECISOR_N2_DT] datetime2(7) NULL
);

/* Z_DELP_CAPEX_APROVADOR  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_APROVADOR] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [NOME] varchar(150) NOT NULL,
    [LOGIN] varchar(100) NOT NULL,
    [EMAIL] varchar(150) NOT NULL,
    [PAPEL] varchar(30) NOT NULL,
    [NIVEL] int NOT NULL,
    [ESCOPO] varchar(30) NOT NULL,
    [REF_ESCOPO] varchar(30) NULL,
    [SUBSTITUTO_LOGIN] varchar(100) NULL,
    [ATIVO] bit NOT NULL,
    [RECCREATEDBY] varchar(100) NOT NULL,
    [RECCREATEDON] datetime NOT NULL,
    [RECMODIFIEDBY] varchar(100) NULL,
    [RECMODIFIEDON] datetime NULL
);

/* Z_DELP_CAPEX_APROVADOR_CC  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_APROVADOR_CC] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [APROVADOR_ID] int NOT NULL,
    [CC] varchar(30) NOT NULL,
    [RECCREATEDBY] varchar(100) NOT NULL,
    [RECCREATEDON] datetime NOT NULL
);

/* Z_DELP_CAPEX_CONTINGENCIA  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_CONTINGENCIA] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NOT NULL,
    [VERSAO] int NOT NULL,
    [EFETIVADO] bit NOT NULL,
    [CODFILIAL] int NOT NULL,
    [NOME_FILIAL] varchar(20) NULL,
    [DIRETORIA] varchar(100) NOT NULL,
    [DESCRICAO] varchar(200) NOT NULL,
    [JUSTIFICATIVA] varchar(1000) NULL,
    [VALOR_ORCADO] decimal(18,2) NOT NULL,
    [NATUREZA] varchar(10) NULL,
    [INATIVADO] bit NOT NULL,
    [INTEGRADO_RM] bit NOT NULL,
    [DT_INTEGRACAO_RM] datetime2(7) NULL,
    [ID_ORCAMENTO_RM] int NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime2(7) NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime2(7) NULL
);

/* Z_DELP_CAPEX_GERENTE_USUARIO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_GERENTE_USUARIO] (
    [ID] int IDENTITY(1,1) NOT NULL,
    [GERENTE_NOME] varchar(150) NOT NULL,
    [CODUSUARIO] varchar(50) NOT NULL,
    [ATIVO] bit NOT NULL,
    [RECCREATEDON] datetime2 NOT NULL
);

/* Z_DELP_CAPEX_INTEGRACAO_LOG  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_INTEGRACAO_LOG] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ID_SOLICITACAO] bigint NOT NULL,
    [NUMPROCESSO_FLUIG] int NULL,
    [TENTATIVA] int NOT NULL,
    [DT_INICIO] datetime2 NOT NULL,
    [DT_FIM] datetime2 NULL,
    [DURACAO_MS] int NULL,
    [STATUS] varchar(20) NOT NULL,
    [CLASSE_ERRO] varchar(20) NULL,
    [MENSAGEM] varchar(MAX) NULL,
    [XML_ENVIADO] varchar(MAX) NULL,
    [XML_RETORNO] varchar(MAX) NULL,
    [IDMOV_GERADO] int NULL,
    [USUARIO] varchar(50) NULL
);

/* Z_DELP_CAPEX_LOG  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_LOG] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NULL,
    [CODFILIAL] int NULL,
    [EVENTO] varchar(40) NOT NULL,
    [TIPO_MOV] varchar(20) NULL,
    [ITEM_ORIGEM] int NULL,
    [VALOR] decimal(18,2) NULL,
    [APROVACAO_ID] bigint NULL,
    [USUARIO] varchar(50) NULL,
    [DETALHE] varchar(1000) NULL,
    [PAYLOAD_JSON] varchar(MAX) NULL,
    [RECCREATEDON] datetime2 NOT NULL,
    [CID] varchar(60) NULL
);

/* Z_DELP_CAPEX_PLANO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_PLANO] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NOT NULL,
    [VERSAO] int NOT NULL,
    [EFETIVADO] bit NOT NULL,
    [CODFILIAL] int NOT NULL,
    [NOME_FILIAL] varchar(20) NOT NULL,
    [ITEM] int NOT NULL,
    [CC] varchar(30) NOT NULL,
    [DESC_CC] varchar(200) NULL,
    [DESCRICAO] varchar(500) NOT NULL,
    [JUSTIFICATIVA] varchar(1000) NULL,
    [CATEGORIA] varchar(50) NOT NULL,
    [VALOR_ORCADO] decimal(15,2) NOT NULL,
    [NATUREZA] varchar(10) NOT NULL,
    [DIRETORIA] varchar(100) NOT NULL,
    [GERENTE] varchar(100) NOT NULL,
    [PLANEJ_ESTRATEGICO] varchar(3) NULL,
    [PAYBACK] decimal(10,2) NULL,
    [PRIORIDADE] varchar(20) NULL,
    [RECCREATEDBY] varchar(50) NOT NULL,
    [RECCREATEDON] datetime2(7) NOT NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime2(7) NULL,
    [INTEGRADO_RM] bit NOT NULL,
    [DT_INTEGRACAO_RM] datetime2(7) NULL,
    [ID_ORCAMENTO_RM] int NULL,
    [JUSTIFICATIVA_VERSAO] varchar(500) NULL,
    [INATIVADO] bit NOT NULL,
    [OS_DOADORA] varchar(30) NULL,
    [GRUPO_CAPEX] varchar(20) NULL
);

/* Z_DELP_CAPEX_SOLICITACAO  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_SOLICITACAO] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NOT NULL,
    [CODFILIAL] int NOT NULL,
    [NOME_FILIAL] varchar(60) NULL,
    [TIPO_LINHA] varchar(20) NOT NULL,
    [REF_LINHA] int NULL,
    [CODCCUSTO] varchar(30) NULL,
    [NATUREZA] varchar(10) NULL,
    [CLASSIFICACAO_FINANC] varchar(20) NULL,
    [TIPO_MOV] varchar(5) NOT NULL,
    [DESCRICAO_RESUMO] varchar(500) NULL,
    [JUSTIFICATIVA] varchar(1000) NULL,
    [FORNECEDOR_PRETENDIDO] varchar(200) NULL,
    [DT_ENTREGA_PRETENDIDA] date NULL,
    [PRIORIDADE] varchar(20) NULL,
    [VALOR_TOTAL] decimal(18,2) NOT NULL,
    [STATUS] varchar(30) NOT NULL,
    [SOLICITANTE] varchar(50) NOT NULL,
    [TOKEN_IDEMPOTENCIA] varchar(40) NOT NULL,
    [NUMPROCESSO_FLUIG] int NULL,
    [IDMOV_RM] int NULL,
    [NUMEROMOV_RM] varchar(20) NULL,
    [SERIE_RM] varchar(10) NULL,
    [DT_INTEGRACAO] datetime2 NULL,
    [TENTATIVAS] int NOT NULL,
    [VERIFICAR_MANUAL] bit NOT NULL,
    [CLASSE_ERRO] varchar(20) NULL,
    [MENSAGEM_ERRO] varchar(500) NULL,
    [MENSAGEM_TECNICA] varchar(MAX) NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime2 NOT NULL,
    [RECMODIFIEDBY] varchar(50) NULL,
    [RECMODIFIEDON] datetime2 NULL,
    [CODLOC] varchar(20) NULL,
    [CODTMV] varchar(20) NULL,
    [AGUARDANDO_TRANSF_ID] bigint NULL,
    [AGUARDANDO_TRANSF_IDS] varchar(400) NULL,
    [DT_TRANSF_SOLICITADA] datetime2 NULL,
    [APROVADOR_MATRICULA] varchar(50) NULL,
    [APROVADOR_NOME] varchar(200) NULL,
    [APROVADOR_EMAIL] varchar(200) NULL,
    [TOKEN_APROVACAO] varchar(40) NULL,
    [TOKEN_APROVACAO_EXPIRA] datetime2 NULL,
    [DECISAO_APROVACAO] varchar(20) NULL,
    [JUSTIFICATIVA_APROVACAO] varchar(1000) NULL,
    [DT_DECISAO_APROVACAO] datetime2 NULL,
    [DECIDIDO_POR] varchar(50) NULL,
    [DT_EMAIL_APROVACAO] datetime2 NULL,
    [APROVACAO_PENDENTE] bit NOT NULL,
    [DECISAO_DIRETOR] varchar(10) NULL,
    [JUSTIFICATIVA_DIRETOR] varchar(500) NULL,
    [DT_DECISAO_DIRETOR] datetime2(7) NULL,
    [DECIDIDO_POR_DIRETOR] varchar(100) NULL,
    [TOKEN_DIRETOR] varchar(64) NULL,
    [TOKEN_DIRETOR_EXPIRA] datetime2(7) NULL,
    [DECISAO_CEO] varchar(10) NULL,
    [JUSTIFICATIVA_CEO] varchar(500) NULL,
    [DT_DECISAO_CEO] datetime2(7) NULL,
    [DECIDIDO_POR_CEO] varchar(100) NULL,
    [TOKEN_CEO] varchar(64) NULL,
    [TOKEN_CEO_EXPIRA] datetime2(7) NULL,
    [DIRETOR_APORTE_LOGIN] varchar(100) NULL,
    [DIRETOR_APORTE_NOME] varchar(200) NULL,
    [PRECISA_APORTE] char(1) NULL,
    [DOACAO_CONT_ID] int NULL,
    [DOACAO_ITEM_DEST] int NULL,
    [DOACAO_VALOR] decimal(18,2) NULL,
    [DOACAO_EM] datetime2 NULL,
    [DOACAO_DEVOLVIDA_EM] datetime2 NULL,
    [DOACAO_MENSAGEM] varchar(400) NULL
);

/* Z_DELP_CAPEX_SOLICITACAO_ITEM  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[Z_DELP_CAPEX_SOLICITACAO_ITEM] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ID_SOLICITACAO] bigint NOT NULL,
    [SEQ] int NOT NULL,
    [CODIGOPRD] varchar(30) NULL,
    [DESCRICAO] varchar(500) NOT NULL,
    [CODUND] varchar(10) NULL,
    [QUANTIDADE] decimal(18,4) NOT NULL,
    [PRECOUNITARIO] decimal(18,4) NOT NULL,
    [VALOR_TOTAL_ITEM] decimal(18,2) NULL,
    [EH_SERVICO] bit NOT NULL,
    [RECCREATEDBY] varchar(50) NULL,
    [RECCREATEDON] datetime2 NOT NULL
);

/* FDN_USERTENANT  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[FDN_USERTENANT] (
    [USER_TENANT_ID] bigint IDENTITY(1,1) NOT NULL,
    [EMAIL] varchar(120) NOT NULL,
    [FIRST_ACCESS] bit NOT NULL,
    [IDP_ID] varchar(255) NULL,
    [LAST_UPDATE_DATE] datetime2(7) NOT NULL,
    [LOCATION_ID] bigint NULL,
    [LOGIN] varchar(150) NOT NULL,
    [PASSWORD] varchar(512) NULL,
    [TENANT_ID] bigint NOT NULL,
    [USER_CODE] varchar(150) NULL,
    [USER_UUID] varchar(36) NULL,
    [USER_ID] bigint NOT NULL,
    [USER_STATE] int NOT NULL,
    [ANONYMIZATION_DATE] datetime2(7) NULL,
    [ANONYMIZATION_USER_ID] bigint NULL,
    [LAST_SECURITY_UPDATE_DATE] datetime NULL
);

/* ZMD_CAPEX_INICIAL  --  fonte: esquema-sql/FLUIG - Portal Capex.csv  (catalogo do SQL Server) */
CREATE TABLE [dbo].[ZMD_CAPEX_INICIAL] (
    [ID] bigint IDENTITY(1,1) NOT NULL,
    [ANO_CAPEX] int NOT NULL,
    [CODFILIAL] int NOT NULL,
    [NOME_FILIAL] varchar(20) NOT NULL,
    [ITEM] int NOT NULL,
    [CC] varchar(30) NOT NULL,
    [DESC_CC] varchar(200) NULL,
    [DESCRICAO] varchar(500) NOT NULL,
    [JUSTIFICATIVA] varchar(1000) NULL,
    [CATEGORIA] varchar(50) NOT NULL,
    [VALOR_ORCADO] decimal(15,2) NOT NULL,
    [NATUREZA] varchar(10) NOT NULL,
    [DIRETORIA] varchar(100) NOT NULL,
    [GERENTE] varchar(100) NOT NULL,
    [PLANEJ_ESTRATEGICO] varchar(3) NULL,
    [PAYBACK] decimal(10,2) NULL,
    [PRIORIDADE] varchar(20) NULL,
    [ID_PLANO_ORIGEM] bigint NOT NULL,
    [ID_ORCAMENTO_RM] int NOT NULL,
    [CODCOLIGADA_RM] int NOT NULL,
    [IDPERIODO_RM] int NOT NULL,
    [CODTBORCAMENTO_RM] varchar(10) NOT NULL,
    [DT_SNAPSHOT] datetime2(7) NOT NULL,
    [USUARIO_SNAPSHOT] varchar(50) NOT NULL,
    [MOTIVO_SNAPSHOT] varchar(30) NOT NULL
);

/* Chaves estrangeiras declaradas em FLUIG */
ALTER TABLE [FDN_USERTENANT] ADD CONSTRAINT [FK_FDNUSERTENANTUSERTENANT001]
    FOREIGN KEY ([ANONYMIZATION_USER_ID]) REFERENCES [FDN_USERTENANT] ([USER_TENANT_ID]);
ALTER TABLE [Z_DELP_CAPEX_APROVADOR_CC] ADD CONSTRAINT [FK_ZCAPEX_APROVCC_APROV]
    FOREIGN KEY ([APROVADOR_ID]) REFERENCES [Z_DELP_CAPEX_APROVADOR] ([ID]);
ALTER TABLE [Z_DELP_CAPEX_SOLICITACAO_ITEM] ADD CONSTRAINT [FK_ZDELP_CAPEX_SOLIC_ITEM]
    FOREIGN KEY ([ID_SOLICITACAO]) REFERENCES [Z_DELP_CAPEX_SOLICITACAO] ([ID]);
ALTER TABLE [Z_DELP_CAPEX_LOG] ADD CONSTRAINT [FK_Z_DELP_CAPEX_LOG_Z_DELP_CAPEX_APROVACAO]
    FOREIGN KEY ([APROVACAO_ID]) REFERENCES [Z_DELP_CAPEX_APROVACAO] ([ID]);
