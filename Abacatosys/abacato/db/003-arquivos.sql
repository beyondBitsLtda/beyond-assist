-- Abacato System — onde os arquivos moram.
--
-- Rodar:  docker exec -i supabase-db psql -U postgres -d postgres < db/003-arquivos.sql
-- É idempotente.
--
-- O Storage do Supabase já está de pé neste iMac (containers `supabase-storage` e
-- `supabase-imgproxy`), e é ele quem guarda os arquivos — em disco, na máquina de casa, que é
-- onde foi pedido que ficassem. Não há serviço de fora envolvido.

-- ============================================================ papéis de parede

-- PÚBLICO, e é uma escolha, não um descuido.
--
-- Um papel de parede é carregado por uma tag <img> e por CSS, em toda abertura de quadro.
-- Fechá-lo exigiria assinar uma URL a cada carregamento, e URL assinada vence — o fundo do
-- quadro passaria a sumir sozinho depois de um tempo, o que é pior que o risco.
--
-- O que protege é o caminho: cada arquivo recebe um nome sorteado. Quem não tem o endereço
-- exato não chega nele, e o endereço só aparece dentro do quadro de quem pode abrir o quadro.
-- É a proteção certa para a sensibilidade do dado: uma imagem de fundo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'abacato-paredes', 'abacato-paredes', true,
  10485760,   -- 10 MB. Papel de parede maior que isso deixa o quadro lento para quem abre no 4G
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================ documentos

-- PRIVADO, pelo motivo inverso.
--
-- Aqui vão contrato, proposta, planilha de obra — coisas que não podem estar a um endereço de
-- distância de qualquer pessoa. Cada abertura passa pelo servidor, que confere quem está
-- pedindo antes de deixar o arquivo sair.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'abacato-documentos', 'abacato-documentos', false,
  52428800,   -- 50 MB
  null        -- sem lista fechada: o repositório precisa aceitar pdf, excel, word, imagem, zip…
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================ quem pode o quê

-- Nenhuma política de RLS é criada aqui, e isso é deliberado.
--
-- Todo acesso passa pela chave de serviço, a partir do servidor — nenhum navegador fala com o
-- Storage direto. Sem política, os buckets ficam fechados por padrão para qualquer outra
-- credencial, que é exatamente o que se quer. Quem decide o que cada pessoa pode ver continua
-- sendo o domínio, num lugar só.
