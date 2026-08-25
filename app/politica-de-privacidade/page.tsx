import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Cloud,
  Database,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
} from 'lucide-react'

const privacyEmail = 'manutencao@viacaovaledoitaunas.com.br'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Vale do Itaúnas: Motoristas',
  description:
    'Política de Privacidade do aplicativo Vale do Itaúnas: Motoristas e do sistema de gestão de frota.',
  alternates: {
    canonical: 'https://www.valedoitaunas.com/politica-de-privacidade',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const summaryItems = [
  {
    icon: Database,
    title: 'Dados necessários',
    description: 'Usamos somente dados cadastrais e operacionais necessários à gestão da frota.',
  },
  {
    icon: Smartphone,
    title: 'Operação offline',
    description: 'Registros pendentes ficam no aparelho até que possam ser sincronizados.',
  },
  {
    icon: ShieldCheck,
    title: 'Sem publicidade',
    description: 'Não vendemos dados pessoais e não usamos os dados para anúncios.',
  },
]

function Section({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`secao-${number}`} className="scroll-mt-6 border-t border-border pt-8">
      <div className="flex gap-4">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
        >
          {number}
        </span>
        <div className="min-w-0 space-y-4">
          <h2 id={`secao-${number}`} className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
            {title}
          </h2>
          <div className="space-y-4 leading-7 text-muted-foreground">{children}</div>
        </div>
      </div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_36%),linear-gradient(to_bottom,var(--background),color-mix(in_srgb,var(--muted)_35%,var(--background)))]">
      <header className="border-b border-border/80 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/login" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Image
              src="/icon.png"
              alt="Vale do Itaúnas"
              width={44}
              height={44}
              className="rounded-xl"
              priority
            />
            <div>
              <p className="font-heading text-sm font-semibold text-foreground sm:text-base">Vale do Itaúnas</p>
              <p className="text-xs text-muted-foreground">Motoristas</p>
            </div>
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Acessar o sistema
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center sm:mb-14">
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <LockKeyhole aria-hidden="true" className="size-6" />
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Privacidade e proteção de dados</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Política de Privacidade
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Esta política explica, de forma simples, como os dados são tratados no aplicativo
              <strong className="font-semibold text-foreground"> Vale do Itaúnas: Motoristas</strong> e no sistema de gestão de frota.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Última atualização: 25 de agosto de 2026</p>
          </div>

          <div className="mb-12 grid gap-4 sm:grid-cols-3">
            {summaryItems.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <Icon aria-hidden="true" className="mb-4 size-6 text-primary" />
                <h2 className="font-heading font-semibold text-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>

          <article className="space-y-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
            <Section number="1" title="Quem é responsável pelos dados">
              <p>
                A <strong className="font-semibold text-foreground">Viação Vale do Itaúnas</strong> é responsável pelas decisões sobre o uso dos dados no contexto de suas operações. A <strong className="font-semibold text-foreground">ProdeXy Labs</strong> fornece e mantém a solução tecnológica, tratando dados somente para prestar suporte, manter o sistema e viabilizar seu funcionamento.
              </p>
              <p>
                Esta política se aplica ao aplicativo Android identificado pelo pacote <span className="break-all font-mono text-sm text-foreground">com.prodexylabs.valedoitaunas.motoristas</span> e às áreas correspondentes do sistema web.
              </p>
            </Section>

            <Section number="2" title="Quais dados são tratados">
              <p>De acordo com o perfil e com as funções utilizadas, podemos tratar:</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                <li><strong className="font-semibold text-foreground">Cadastro e acesso:</strong> nome, email, telefone, CPF, informações da CNH, situação profissional, função e dados de autenticação.</li>
                <li><strong className="font-semibold text-foreground">Operação da frota:</strong> veículo vinculado, rota, origem, destino, horários, quilometragem, observações e histórico de viagens.</li>
                <li><strong className="font-semibold text-foreground">Abastecimentos e despesas:</strong> combustível, litros, quilometragem, valores, categoria da despesa, observações e comprovante, quando informado.</li>
                <li><strong className="font-semibold text-foreground">Dados técnicos:</strong> sessão de acesso, estado de conexão, registros necessários à segurança e informações locais usadas para sincronização offline.</li>
              </ul>
              <p>
                O aplicativo Android não solicita acesso à localização precisa, câmera, microfone ou lista de contatos do dispositivo. Caso isso mude, esta política e as declarações nas lojas serão atualizadas antes da utilização desses recursos.
              </p>
            </Section>

            <Section number="3" title="Para que os dados são usados">
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                <li>autenticar usuários e controlar permissões de acesso;</li>
                <li>registrar e acompanhar viagens, quilometragem, abastecimentos e despesas;</li>
                <li>gerenciar veículos, motoristas, manutenção e segurança operacional;</li>
                <li>sincronizar operações realizadas temporariamente sem internet;</li>
                <li>prevenir erros, acessos indevidos e duplicidade de registros;</li>
                <li>cumprir obrigações legais, regulatórias, trabalhistas e de auditoria;</li>
                <li>prestar suporte e melhorar a estabilidade do sistema.</li>
              </ul>
              <p>
                O tratamento ocorre conforme necessário para a execução das atividades da empresa, o cumprimento de obrigações legais e o legítimo interesse de administrar a frota com segurança, observados os direitos previstos na Lei Geral de Proteção de Dados (LGPD).
              </p>
            </Section>

            <Section number="4" title="Funcionamento offline">
              <p>
                Para que o motorista consiga trabalhar em locais sem conexão, o aplicativo mantém no aparelho uma cópia dos dados operacionais recentes e uma fila das ações ainda não enviadas. Quando a internet retorna, essas ações são sincronizadas com o sistema.
              </p>
              <p>
                Esses dados permanecem no armazenamento do aplicativo pelo tempo necessário ao funcionamento e à sincronização. Eles podem ser removidos ao limpar os dados ou desinstalar o aplicativo, desde que não existam operações pendentes que ainda precisem ser enviadas.
              </p>
            </Section>

            <Section number="5" title="Compartilhamento e fornecedores">
              <p>Os dados podem ser acessados apenas quando necessário por:</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-primary">
                <li>profissionais autorizados da Viação Vale do Itaúnas;</li>
                <li>ProdeXy Labs, para desenvolvimento, manutenção e suporte técnico;</li>
                <li>Supabase, utilizado para autenticação, banco de dados e infraestrutura de nuvem;</li>
                <li>Vercel, utilizada para hospedagem do sistema web e desta página pública;</li>
                <li>autoridades públicas, quando houver obrigação legal ou ordem válida.</li>
              </ul>
              <p>
                <strong className="font-semibold text-foreground">Não vendemos dados pessoais</strong> e não compartilhamos informações para publicidade comportamental. Fornecedores de nuvem podem processar dados fora do Brasil, sujeitos a medidas contratuais e de segurança aplicáveis.
              </p>
            </Section>

            <Section number="6" title="Armazenamento e segurança">
              <p>
                Adotamos controles de autenticação, restrição de acesso por perfil, comunicação criptografada e regras de acesso no banco de dados. Mesmo assim, nenhum sistema é totalmente imune a riscos, por isso os controles são revisados e aprimorados continuamente.
              </p>
              <p>
                Os dados são mantidos enquanto o cadastro estiver ativo e pelo período necessário às operações, auditorias e obrigações legais. Depois disso, poderão ser eliminados ou anonimizados, salvo quando a conservação for exigida ou permitida por lei.
              </p>
            </Section>

            <Section number="7" title="Direitos dos titulares">
              <p>
                Nos termos da LGPD, o titular pode solicitar confirmação e acesso aos dados, correção, informação sobre compartilhamento, anonimização, bloqueio ou eliminação quando cabível, além de revisão de decisões automatizadas e demais direitos previstos em lei.
              </p>
              <p>
                Algumas informações operacionais ou de auditoria podem precisar ser mantidas para cumprir obrigações legais ou resguardar direitos. Toda solicitação será analisada e respondida de acordo com a legislação aplicável.
              </p>
            </Section>

            <Section number="8" title="Crianças e adolescentes">
              <p>
                O aplicativo é uma ferramenta profissional de acesso restrito e não é destinado a crianças ou ao público em geral. Somente usuários previamente cadastrados e autorizados pela empresa podem utilizá-lo.
              </p>
            </Section>

            <Section number="9" title="Atualizações desta política">
              <p>
                Esta política poderá ser atualizada para refletir mudanças no aplicativo, no sistema ou na legislação. A versão vigente e sua data de atualização permanecerão publicadas nesta página.
              </p>
            </Section>

            <Section number="10" title="Contato sobre privacidade">
              <p>
                Para dúvidas ou solicitações relacionadas a dados pessoais, entre em contato com a administração da Viação Vale do Itaúnas pelo email abaixo. Para proteger o titular, poderemos solicitar informações adicionais para confirmar sua identidade.
              </p>
              <a
                href={`mailto:${privacyEmail}`}
                className="inline-flex max-w-full items-center gap-2 break-all rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Mail aria-hidden="true" className="size-5 shrink-0" />
                {privacyEmail}
              </a>
            </Section>
          </article>

          <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6 text-muted-foreground">
            <FileCheck2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              Esta página é pública e pode ser consultada sem criar conta ou entrar no sistema. Para acessar o aplicativo, o usuário precisa ser previamente cadastrado pela empresa.
            </p>
          </aside>

          <footer className="mt-10 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <UserRoundCheck aria-hidden="true" className="size-5 text-primary" />
            <p>© 2026 Viação Vale do Itaúnas. Tecnologia ProdeXy Labs.</p>
            <div className="flex items-center gap-2">
              <Cloud aria-hidden="true" className="size-4" />
              <span>Página pública de privacidade</span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
