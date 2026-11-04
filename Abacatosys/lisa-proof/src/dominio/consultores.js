// A MESA DOS CONSULTORES da Bolsa do Reino (pedido de 26/10/2026): "uma função de ver projeções,
// tipo com consultores financeiros, e eles tendo margens de erro diferentes; o usuário não sabe
// qual é e varia de dia pra dia; deixe os consultores com design, ou seja, personagens, inclusive
// com background e personalidade".
//
// Aqui mora SÓ o que todo mundo pode ver: quem é cada consultor, a história, o jeito, o método e a
// faixa de erro que ele DIZ ter. O jeito de errar de verdade (o tamanho do erro de cada dia, o
// otimismo, o exagero) é segredo e mora em src/dominio/projecoes.js, que só o servidor importa —
// este arquivo vai para o navegador, aquele não. Os retratos estão em
// src/componentes/bolsa/consultoresDePapel.js.
//
// A COR de cada um é a mesma no cartão, no rosto e na linha da previsão no gráfico (26/10/2026):
// uma paleta validada no fundo escuro do terminal, longe do verde e do vermelho da cotação. Como as
// seis linhas se cruzam, a cor nunca está sozinha: o rosto e o apelido vão junto.

export const CONSULTORES = [
  {
    id: "ametista",
    nome: "Madame Ametista",
    titulo: "A Vidente do Pregão",
    idade: "diz ter 300 anos",
    origem: "Ilhas Nebulosas",
    historia: "Lia a sorte dos piratas no cais até a noite de lua cheia em que previu, com três dias de antecedência, a quebra da Companhia das Velas. Desde então jura que a bola de cristal enxerga o pregão. Tem dias em que acerta tudo; em outros, a bola só mostra neblina — mas isso ela nunca admite.",
    personalidade: ["Dramática", "Misteriosa", "Confiante até demais"],
    metodo: "Bola de cristal, cartas de tarô e o voo das gaivotas sobre o porto.",
    bordao: "As cartas não mentem… às vezes elas só exageram.",
    faixaDeclarada: 1,
    sobreAFaixa: "“A bola de cristal não erra.”",
    cor: "#9085e9",
    apelido: "Ametista",
  },
  {
    id: "barao",
    nome: "Barão Baltazar Cifrão",
    titulo: "O Banqueiro da Velha Guarda",
    idade: "78 anos",
    origem: "Cofre-Mor do Reino",
    historia: "Herdou do avô o cofre mais antigo do reino. Viu três crises, duas febres do ouro e uma invasão de dragões, e desde então desconfia de tudo o que sobe depressa. Quase sempre acerta para que lado o mercado vai; quase nunca acerta o tamanho do passo, porque acha que o mercado sempre exagera.",
    personalidade: ["Prudente", "Formal", "Saudosista"],
    metodo: "Um livro-caixa de couro de 1820, uma régua e café sem açúcar.",
    bordao: "Devagar se vai ao cofre.",
    faixaDeclarada: 6,
    sobreAFaixa: "“Margem de segurança nunca é demais, meu jovem.”",
    cor: "#c98500",
    apelido: "Barão",
  },
  {
    id: "luna",
    nome: "Luna “Foguete” Estrela",
    titulo: "A Analista do Hype",
    idade: "22 anos",
    origem: "Planetoides",
    historia: "Aprendeu a investir com vídeos de um minuto e ficou rica uma vez (perdeu tudo na semana seguinte, mas essa parte ela pula). Hoje faz análise ao vivo de cima da nave, para milhares de seguidores. Para ela, tudo vai para a lua — principalmente tecnologia e viagem espacial.",
    personalidade: ["Elétrica", "Otimista incurável", "Fala em gírias"],
    metodo: "A “vibe” do chat ao vivo e gráficos cheios de setas.",
    bordao: "Segura a mão que é foguete! 🚀",
    faixaDeclarada: 2,
    sobreAFaixa: "“Confia no pai… digo, na mãe!”",
    cor: "#d55181",
    apelido: "Luna",
  },
  {
    id: "corvo",
    nome: "Professor Corvo",
    titulo: "O Estatístico",
    idade: "um corvo de meia-idade",
    origem: "Torre da Academia",
    historia: "Catedrático de Probabilidade da Academia das Torres, largou as aulas no dia em que um aluno perguntou “pra que serve isso?”. Fala em médias, desvios e intervalos de confiança. É o mais constante da mesa — até o dia em que vem uma notícia que ninguém esperava e o modelo dele quebra.",
    personalidade: ["Metódico", "Seco", "Pedante"],
    metodo: "Planilhas, regressões e uma pena de escrever muito bem apontada.",
    bordao: "Correlação não é causalidade — mas paga as contas.",
    faixaDeclarada: 3,
    sobreAFaixa: "“Intervalo de confiança de 90%, naturalmente.”",
    cor: "#3987e5",
    apelido: "Corvo",
  },
  {
    id: "zuleica",
    nome: "Dona Zuleica",
    titulo: "A Feirante",
    idade: "61 anos",
    origem: "Feira do Porto",
    historia: "Tem banca de frutas na Feira do Porto há quarenta anos. Nunca leu um gráfico, mas sabe pelo preço do tomate quando o reino vai bem — e quando o povo começa a comprar fiado, ela vende as ações. Tem dias de uma sabedoria assustadora e dias em que erra feio; depende muito de como foi a feira. De comida, ela entende.",
    personalidade: ["Acolhedora", "Cheia de ditados", "Arredonda tudo"],
    metodo: "O movimento da feira, o preço do tomate e o joelho que dói antes da chuva.",
    bordao: "Quem compra na baixa, dorme na alta, meu filho.",
    faixaDeclarada: 3,
    sobreAFaixa: "“Mais ou menos, meu bem. Mais pra mais do que pra menos.”",
    cor: "#d95926",
    apelido: "Zuleica",
  },
  {
    id: "gorgo",
    nome: "Gorgo, o Urso",
    titulo: "O Pessimista",
    idade: "velho o bastante para lembrar da Grande Queda das Pepitas",
    origem: "Cavernas dos Picos Gelados",
    historia: "Era o maior otimista do reino até a Grande Queda das Pepitas, quando perdeu a caverna inteira. Hibernou um inverno e acordou rabugento. Vê crise em tudo: quando o mercado cai, ele brilha; quando sobe, resmunga que é bolha. No fundo tem um coração mole — mas não conte para ninguém.",
    personalidade: ["Rabugento", "Sarcástico", "Coração mole (escondido)"],
    metodo: "O cheiro do medo no ar e a cor do céu de manhã.",
    bordao: "Tudo que sobe… cai. Só não sei quando.",
    faixaDeclarada: 4,
    sobreAFaixa: "“Pode ser pior. Geralmente é.”",
    cor: "#199e70",
    apelido: "Gorgo",
  },
];

export const IDS_DOS_CONSULTORES = CONSULTORES.map((c) => c.id);
const POR_ID = new Map(CONSULTORES.map((c) => [c.id, c]));
export const consultorPorId = (id) => POR_ID.get(id) || null;
