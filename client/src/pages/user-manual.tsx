import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Separator } from '@/shared/ui/separator';
import {
  BookOpen,
  FileText,
  Users,
  ShoppingCart,
  Settings,
  BarChart3,
  Building,
  MapPin,
  HelpCircle,
  Download,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Shield,
  Target,
  Zap,
  Award,
  DollarSign,
  UserCheck,
  Lock,
  Globe,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Smartphone,
  Bell,
  Eye,
  Phone,
  User,
  Key,
  Mail,
  Wifi,
  Camera,
  ClipboardCheck,
  Package
} from "lucide-react";

interface ManualSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
  content: React.ReactNode;
  badge?: string;
}

const manualSections: ManualSection[] = [
  {
    id: "bem-vindo",
    title: "Bem-vindo",
    icon: BookOpen,
    description: "Introdução ao sistema",
    badge: "Essencial",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🎯 Bem-vindo ao Sistema de Gestão de Compras</h2>
          <p className="text-muted-foreground mb-6 text-lg">
            Este manual irá guiá-lo através de todas as funcionalidades do sistema, desde o primeiro acesso até a conclusão completa de um processo de compra. O sistema foi atualizado para incluir 9 fases de controle, garantindo maior rigor fiscal e integração com ERP.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>O que há de novo nesta versão:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span><strong>Fase de Conferência Fiscal</strong>: Validação fiscal e financeira</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span><strong>Integração com ERP</strong>: Logs de envio e status</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span><strong>Validação Estrita de Recebimento</strong>: Controle de quantidade</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span><strong>Novos Relatórios</strong>: Análise de Itens e Invoices</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span><strong>Conferência de Material</strong>: Página dedicada para almoxarifado</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Acesso ao Sistema</h3>
              <p className="text-blue-800 dark:text-blue-200 mb-3">
                Acesse o sistema utilizando suas credenciais corporativas. Recomendamos alterar sua senha no primeiro acesso em Perfil → Alterar Senha.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "primeiros-passos",
    title: "Primeiros Passos e Navegação",
    icon: Globe,
    description: "Acesso e menus do sistema",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🚀 Primeiros Passos</h2>
          <p className="text-muted-foreground mb-6">
            Guia rápido para começar a utilizar o sistema de gestão de compras.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acessando o Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal ml-4 space-y-2 text-sm">
              <li><strong>Login:</strong> Utilize seu e-mail corporativo e senha.</li>
              <li><strong>Primeiro Acesso:</strong> É altamente recomendado alterar sua senha em <em>Perfil → Alterar Senha</em>.</li>
              <li><strong>Recuperação:</strong> Caso esqueça a senha, solicite o reset ao administrador.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Navegação Principal</CardTitle>
            <CardDescription>Entenda o menu do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Menu Principal
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc ml-4">
                  <li><strong>Kanban de Compras:</strong> Visão geral das solicitações.</li>
                  <li><strong>Minhas Solicitações:</strong> Lista detalhada das suas demandas.</li>
                  <li><strong>Conferência de Material:</strong> Acesso rápido para almoxarifado.</li>
                  <li><strong>Relatórios:</strong> Dados analíticos e fiscais.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Administração
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc ml-4">
                  <li><strong>Cadastros:</strong> Fornecedores, Empresas, Locais.</li>
                  <li><strong>Usuários:</strong> Gestão de acessos e departamentos.</li>
                  <li><strong>Configurações:</strong> Parâmetros globais do sistema.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "workflow",
    title: "Fluxo de Compras",
    icon: ShoppingCart,
    description: "Entenda as 9 fases do processo",
    badge: "Atualizado",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔄 Workflow de Compras - Guia Completo</h2>
          <p className="text-muted-foreground mb-6">
            O sistema utiliza um workflow Kanban com 9 fases sequenciais. Cada fase tem responsáveis específicos e ações permitidas.
          </p>
        </div>

        <div className="space-y-6">
          {/* Fase 1: Solicitação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                1. Solicitação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Formalizar a necessidade de compra de produtos ou serviços para a empresa.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Solicitante:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Preencher formulário com descrição detalhada dos itens.</li>
                    <li>Indicar quantidade, unidade de medida e urgência.</li>
                    <li>Selecionar o Centro de Custo apropriado.</li>
                    <li>Justificar a necessidade da compra.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Validação de campos obrigatórios.</li>
                    <li>Associação automática da solicitação ao usuário logado.</li>
                    <li>Notificação aos aprovadores do centro de custo selecionado.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Solicitação criada e aguardando aprovação técnica (Status: Pendente A1).</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 2: Aprovação A1 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                2. Aprovação A1 (Técnica)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Validar tecnicamente a necessidade e a adequação ao orçamento do centro de custo.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Gestor:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Revisar itens, quantidades e justificativa.</li>
                    <li><strong>Aprovar:</strong> Autoriza o início da cotação.</li>
                    <li><strong>Reprovar:</strong> Devolve ao solicitante com motivo obrigatório.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Verificação de permissões por Centro de Custo.</li>
                    <li>Registro de log de aprovação (quem e quando).</li>
                    <li>Bloqueio de edição dos itens após aprovação.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Solicitação aprovada e encaminhada para o setor de compras.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 3: Cotação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                3. Cotação (RFQ)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Obter os melhores preços e condições comerciais com fornecedores homologados.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Comprador:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Selecionar fornecedores para envio de RFQ.</li>
                    <li>Registrar propostas recebidas (Preço, Prazo, Pagamento).</li>
                    <li>Fazer upload dos orçamentos (PDF/Imagem).</li>
                    <li>Selecionar o fornecedor vencedor.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Cálculo automático do valor total por fornecedor.</li>
                    <li>Destaque visual para a melhor oferta (menor preço).</li>
                    <li>Validação de anexos obrigatórios antes de avançar.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Fornecedor definido e valores registrados para validação financeira.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 4: Aprovação A2 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                4. Aprovação A2 (Financeira)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Validação final da diretoria/financeiro sobre os valores negociados e impacto no fluxo de caixa.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Aprovador:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Analisar quadro comparativo de preços.</li>
                    <li>Verificar condições de pagamento.</li>
                    <li><strong>Aprovar:</strong> Autoriza compra.</li>
                    <li><strong>Nova Cotação:</strong> Exige renegociação.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Verificação de alçadas de valor (Aprovação Simples vs Dupla).</li>
                    <li>Encaminhamento para CEO se valor exceder limite configurado.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Compra autorizada financeiramente.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 5: Pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                5. Pedido de Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Oficializar o compromisso de compra junto ao fornecedor através de documento formal.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Comprador:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Revisar dados finais de faturamento e entrega.</li>
                    <li>Gerar documento PDF do pedido.</li>
                    <li>Enviar pedido ao fornecedor (E-mail/WhatsApp).</li>
                    <li>Confirmar envio no sistema.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Geração de número sequencial de PO (Purchase Order).</li>
                    <li>Criação de PDF com assinatura eletrônica interna.</li>
                    <li>Disparo de e-mail automático (se configurado).</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Pedido enviado ao fornecedor e aguardando entrega.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 6: Recebimento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                6. Recebimento Físico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Garantir que os produtos recebidos fisicamente correspondem exatamente ao que foi pedido.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Recebedor:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Conferir mercadoria física vs Nota Fiscal.</li>
                    <li>Informar quantidade recebida para cada item.</li>
                    <li>Anexar foto do canhoto ou mercadoria.</li>
                    <li>Reportar avarias ou divergências.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li><strong>Validação Estrita:</strong> Bloqueia entrada se Qtd &gt; Pedido.</li>
                    <li>Controle de saldo parcial (permite múltiplas entregas).</li>
                    <li>Atualização automática de status de estoque.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Entrada física confirmada e registrada.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 7: Conferência Fiscal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                7. Conferência Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Validação tributária, lançamento da Nota Fiscal e integração com o sistema ERP.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Fiscal:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Importar XML da NF-e ou digitar chave de acesso.</li>
                    <li>Conferir impostos e valores totais.</li>
                    <li>Preencher dados financeiros (Vencimento, Parcelas).</li>
                    <li>Confirmar integração.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Leitura automática de dados do XML.</li>
                    <li>Envio de dados via API para o ERP.</li>
                    <li>Validação de consistência (Soma dos itens = Total NF).</li>
                    <li>Exibição de logs de erro/sucesso da integração.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Nota fiscal lançada no ERP e contas a pagar gerado.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 8: Conclusão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                8. Conclusão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Revisão final e consolidação de todos os documentos do processo para auditoria.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Usuário:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Visualizar resumo executivo do processo.</li>
                    <li>Baixar "Kit de Auditoria" (Zip com todos os docs).</li>
                    <li>Clicar em "Arquivar Processo".</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Compilação da timeline completa.</li>
                    <li>Verificação de pendências finais.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Processo pronto para arquivamento definitivo.</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Fase 9: Arquivado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                9. Arquivado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">Objetivo:</h4>
                <p className="text-sm text-muted-foreground">Manter um registro histórico seguro e imutável para fins de auditoria e consulta futura.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Usuário:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Consulta em modo somente leitura.</li>
                    <li>Recuperação de histórico.</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Ações do Sistema:</h4>
                  <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                    <li>Garantia de integridade dos dados (bloqueio total de edição).</li>
                    <li>Indexação para busca rápida em relatórios.</li>
                  </ul>
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Resultado Esperado: <span className="font-normal text-muted-foreground">Registro histórico preservado.</span></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: "cadastros",
    title: "Gestão de Cadastros",
    icon: Building,
    description: "Fornecedores, Empresas e Locais",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🗂️ Gestão de Cadastros</h2>
          <p className="text-muted-foreground mb-6">
            Manutenção das informações base do sistema.
          </p>
        </div>

        <Tabs defaultValue="fornecedores" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
            <TabsTrigger value="empresas">Empresas</TabsTrigger>
            <TabsTrigger value="locais">Locais</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fornecedores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Fornecedores</CardTitle>
                <CardDescription>Menu → Cadastros → Fornecedores</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">Cadastro centralizado de parceiros comerciais.</p>
                <ul className="text-sm list-disc ml-4 text-muted-foreground">
                  <li><strong>CNPJ/CPF:</strong> Chave principal de identificação.</li>
                  <li><strong>Integração:</strong> Dados sincronizados com o ERP.</li>
                  <li><strong>Contatos:</strong> E-mail e telefone para envio de pedidos.</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="empresas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Empresas do Grupo</CardTitle>
                <CardDescription>Entidades compradoras</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">Empresas que podem realizar compras no sistema.</p>
                <ul className="text-sm list-disc ml-4 text-muted-foreground">
                  <li>Definição de razão social e CNPJ de faturamento.</li>
                  <li>Vinculação com centros de custo.</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locais" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Locais de Entrega</CardTitle>
                <CardDescription>Endereços físicos para recebimento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">Endereços disponíveis para entrega dos pedidos.</p>
                <ul className="text-sm list-disc ml-4 text-muted-foreground">
                  <li>Endereço completo, CEP e responsável no local.</li>
                  <li>Obrigatório selecionar um local ao criar solicitação.</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  },
  {
    id: "relatorios",
    title: "Relatórios Avançados",
    icon: BarChart3,
    description: "Análise gerencial e fiscal",
    badge: "Novo",
    content: (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold mb-4">📊 Relatórios Avançados</h2>
                <p className="text-muted-foreground mb-6">
                    O sistema agora conta com uma suíte de relatórios para análise gerencial detalhada.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Análise de Itens Comprados</CardTitle>
                        <CardDescription>Menu → Relatórios → Análise de Itens</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p>Analise o histórico de preços, volatilidade e volume de compras por item.</p>
                        <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
                            <li>Preço médio, mínimo e máximo</li>
                            <li>Total gasto por item</li>
                            <li>Fornecedores que vendem o item</li>
                            <li>Filtros por código ERP ou descrição</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Consulta de Notas Fiscais</CardTitle>
                        <CardDescription>Menu → Relatórios → Invoices</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p>Liste todas as notas fiscais registradas e seus status de integração.</p>
                        <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
                            <li>Visualização de itens da nota e XML</li>
                            <li>Status: Pendente, Integrado, Erro</li>
                            <li>Exportação para CSV</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
  },
  {
    id: "conferencia-material",
    title: "Conferência de Material",
    icon: Package,
    description: "Área dedicada para almoxarifado",
    badge: "Novo",
    content: (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold mb-4">📦 Conferência de Material</h2>
                <p className="text-muted-foreground mb-6">
                    Uma página dedicada para operadores de logística e almoxarifado, focada exclusivamente no recebimento físico.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Interface Simplificada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm">Acesse pelo menu <strong>Conferência de Material</strong>.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-card">
                            <h4 className="font-semibold mb-2">Funcionalidades:</h4>
                            <ul className="text-sm space-y-1 list-disc ml-4 text-muted-foreground">
                                <li>Busca rápida por número do pedido ou nota</li>
                                <li>Visualização clara dos itens pendentes</li>
                                <li>Registro de entrada física com validação</li>
                                <li>Sem a complexidade do Kanban</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
  },
  {
    id: "troubleshooting",
    title: "Solução de Problemas",
    icon: Settings,
    description: "Problemas comuns e soluções",
    content: (
      <div className="space-y-6">
        <div className="space-y-4">
          {[
            {
              problem: "Não consigo digitar a quantidade no recebimento",
              solutions: [
                "Verifique a coluna 'Recebido Anteriormente'",
                "O sistema bloqueia entradas que excedam a quantidade pedida",
                "Se houver erro no pedido original, reporte uma divergência"
              ]
            },
            {
              problem: "Erro na integração com ERP (Conferência Fiscal)",
              solutions: [
                "Verifique o log de erro exibido na tela (box vermelho)",
                "Confirme se o CNPJ do fornecedor está cadastrado no ERP",
                "Verifique dados financeiros (vencimento, parcelas)",
                "Clique em 'Reenviar ao ERP' após corrigir"
              ]
            },
            {
              problem: "Botão de confirmar fiscal desabilitado",
              solutions: [
                "Acesse a aba 'Financeiro'",
                "Preencha Forma de Pagamento, Data de Vencimento e Parcelas (obrigatórios)"
              ]
            },
            {
              problem: "Não consigo criar uma solicitação",
              solutions: [
                "Verifique se você está logado no sistema",
                "Confirme se tem permissão para o centro de custo selecionado",
                "Tente atualizar a página (F5)"
              ]
            }
          ].map((item, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <span>{item.problem}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium text-sm">Soluções:</p>
                  <ul className="space-y-1">
                    {item.solutions.map((solution, i) => (
                      <li key={i} className="flex items-start space-x-2 text-sm text-muted-foreground">
                        <ChevronRight className="h-3 w-3 mt-1" />
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <HelpCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-300">Ainda precisa de ajuda?</h4>
          </div>
          <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-3">
            Se o problema persistir, entre em contato com o suporte técnico.
          </p>
        </div>
      </div>
    )
  },
  {
    id: "configuracoes-pessoais",
    title: "Configurações Pessoais",
    icon: User,
    description: "Perfil e senha",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔧 Configurações Pessoais</h2>
          <p className="text-muted-foreground mb-6">
            Gerencie seus dados de acesso e preferências.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Perfil e Segurança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc ml-4">
              <li><strong>Perfil:</strong> Atualize nome, e-mail e telefone.</li>
              <li><strong>Alterar Senha:</strong> Recomendado periodicamente.</li>
              <li><strong>Recuperação:</strong> Via e-mail na tela de login.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "aprovacao-valor",
    title: "Aprovação por Valor",
    icon: DollarSign,
    description: "Regras de alçada (Admin)",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">⚙️ Configuração de Aprovação por Valor</h2>
          <p className="text-muted-foreground mb-6">
            Recurso exclusivo para Administradores definirem a política de alçadas.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Regras de Limite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc ml-4">
              <li><strong>Limite de Valor:</strong> Define o teto para Aprovação Simples (apenas A2).</li>
              <li><strong>Regra:</strong> Solicitações acima deste valor exigem fluxo de Dupla Aprovação (Diretor + CEO).</li>
              <li><strong>Justificativa:</strong> Obrigatória para qualquer alteração no limite, garantindo auditoria.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "mobile",
    title: "Dispositivos Móveis",
    icon: Smartphone,
    description: "Uso em celulares e tablets",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">📱 Uso em Dispositivos Móveis</h2>
          <p className="text-muted-foreground mb-6">
            O sistema é totalmente responsivo e adaptado para uso em qualquer lugar.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Funcionalidades Mobile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc ml-4">
              <li><strong>Kanban Mobile:</strong> Visualização adaptada em lista ou colunas deslizáveis.</li>
              <li><strong>Aprovações:</strong> Gestores podem aprovar/reprovar facilmente pelo celular.</li>
              <li><strong>Upload:</strong> Tire fotos de notas ou produtos direto da câmera.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "notificacoes",
    title: "Notificações",
    icon: Bell,
    description: "Alertas automáticos",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔔 Sistema de Notificações</h2>
          <p className="text-muted-foreground mb-6">
            Mantenha-se informado sobre o andamento das solicitações.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Tipos de Alerta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc ml-4">
              <li><strong>Nova Solicitação:</strong> Para Aprovadores A1.</li>
              <li><strong>Aprovação Realizada:</strong> Para Compradores (iniciar cotação/pedido).</li>
              <li><strong>Pedido Enviado:</strong> Para Recebedores.</li>
              <li><strong>Reprovação:</strong> Para o Solicitante.</li>
              <li><strong>Integração ERP:</strong> Alertas de falha ou sucesso.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "visualizacao-publica",
    title: "Visualização Pública",
    icon: Eye,
    description: "Transparência e acesso externo",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔓 Visualização Pública</h2>
          <p className="text-muted-foreground mb-6">
            Compartilhe o status das solicitações com facilidade.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recursos de Transparência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground list-disc ml-4">
              <li><strong>Acesso:</strong> Via QR Code ou Link gerado na solicitação.</li>
              <li><strong>Conteúdo:</strong> Status atual, itens e timeline básica.</li>
              <li><strong>Privacidade:</strong> Valores sensíveis podem ser ocultados.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "auditoria",
    title: "Auditoria e Compliance",
    icon: Lock,
    description: "Controles e rastreabilidade",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔍 Auditoria e Controles Internos</h2>
          <p className="text-muted-foreground mb-6">
            Garantia de segurança, rastreabilidade e conformidade.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Rastreabilidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="space-y-1 text-sm text-muted-foreground list-disc ml-4">
                  <li><strong>Log de Ações:</strong> Registro imutável de quem fez o quê.</li>
                  <li><strong>Versionamento:</strong> Histórico de cotações e pedidos.</li>
                  <li><strong>Trilha:</strong> Registro claro de todos os aprovadores.</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Compliance (SoD)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="space-y-1 text-sm text-muted-foreground list-disc ml-4">
                  <li>Solicitantes não aprovam próprias requisições.</li>
                  <li>Aprovadores restritos aos seus centros de custo.</li>
                  <li>Separação entre Compras e Financeiro.</li>
                </ul>
              </CardContent>
            </Card>
        </div>
      </div>
    )
  },
  {
    id: "dicas",
    title: "Dicas e Boas Práticas",
    icon: Zap,
    description: "Melhore seu uso do sistema",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">💡 Dicas e Boas Práticas</h2>
          <p className="text-muted-foreground mb-6">
            Recomendações para tornar o processo mais ágil e eficiente.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <div className="border-l-4 border-blue-500 pl-4 py-1">
                    <h4 className="font-semibold text-sm">Solicitantes</h4>
                    <p className="text-sm text-muted-foreground">Detalhem bem as especificações técnicas para evitar dúvidas e devoluções.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4 py-1">
                    <h4 className="font-semibold text-sm">Aprovadores</h4>
                    <p className="text-sm text-muted-foreground">Verifiquem o saldo orçamentário antes de aprovar. Usem observações para correções.</p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4 py-1">
                    <h4 className="font-semibold text-sm">Compradores</h4>
                    <p className="text-sm text-muted-foreground">Anexem todas as propostas recebidas, não apenas a vencedora.</p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4 py-1">
                    <h4 className="font-semibold text-sm">Recebedores</h4>
                    <p className="text-sm text-muted-foreground">Tirem fotos de avarias ou embalagens danificadas no ato do recebimento.</p>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "metricas",
    title: "Métricas e Indicadores",
    icon: TrendingUp,
    description: "KPIs e performance",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">📊 Métricas e Indicadores</h2>
          <p className="text-muted-foreground mb-6">
            O sistema monitora automaticamente o desempenho do processo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">SLA de Atendimento</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Tempo</div>
                    <p className="text-xs text-muted-foreground">Médio em cada fase</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Savings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Economia</div>
                    <p className="text-xs text-muted-foreground">Orçado vs Comprado</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Volumetria</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Volume</div>
                    <p className="text-xs text-muted-foreground">Por departamento</p>
                </CardContent>
            </Card>
        </div>
      </div>
    )
  },
  {
    id: "exemplo-pratico",
    title: "Exemplo Prático",
    icon: CheckSquare,
    description: "Fluxo completo passo a passo",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔄 Fluxo Completo - Exemplo Prático</h2>
          <p className="text-muted-foreground mb-6">
            Acompanhe um cenário real de compra de computadores.
          </p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Cenário: Compra de 5 Desktops</CardTitle>
            </CardHeader>
            <CardContent>
                <ol className="relative border-l border-muted-foreground/20 ml-3 space-y-6">
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 ring-8 ring-white dark:ring-gray-900 dark:bg-blue-900">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-300">1</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Solicitação (João/TI)</h3>
                        <p className="text-sm text-muted-foreground">Cria solicitação de 5 Desktops com especificação técnica.</p>
                    </li>
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 ring-8 ring-white dark:ring-gray-900 dark:bg-green-900">
                            <span className="text-xs font-bold text-green-600 dark:text-green-300">2</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Aprovação A1 (Maria/Gerente)</h3>
                        <p className="text-sm text-muted-foreground">Valida a necessidade técnica e aprova.</p>
                    </li>
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100 ring-8 ring-white dark:ring-gray-900 dark:bg-yellow-900">
                            <span className="text-xs font-bold text-yellow-600 dark:text-yellow-300">3</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Cotação (Carlos/Compras)</h3>
                        <p className="text-sm text-muted-foreground">Realiza 3 cotações e seleciona a melhor oferta (Dell).</p>
                    </li>
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-100 ring-8 ring-white dark:ring-gray-900 dark:bg-green-900">
                            <span className="text-xs font-bold text-green-600 dark:text-green-300">4</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Aprovação A2 (Roberto/Diretor)</h3>
                        <p className="text-sm text-muted-foreground">Aprova o valor de R$ 15.000,00.</p>
                    </li>
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 ring-8 ring-white dark:ring-gray-900 dark:bg-purple-900">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-300">5</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Pedido (Carlos/Compras)</h3>
                        <p className="text-sm text-muted-foreground">Gera o Pedido #1234 e envia para o fornecedor.</p>
                    </li>
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 ring-8 ring-white dark:ring-gray-900 dark:bg-orange-900">
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-300">6</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Recebimento (Pedro/Almoxarifado)</h3>
                        <p className="text-sm text-muted-foreground">Recebe as 5 caixas, confere e anexa foto.</p>
                    </li>
                    <li className="ml-6">
                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 ring-8 ring-white dark:ring-gray-900 dark:bg-indigo-900">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">7</span>
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Conferência Fiscal (Ana/Fiscal)</h3>
                        <p className="text-sm text-muted-foreground">Lança a NF e integra com o ERP.</p>
                    </li>
                </ol>
            </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "suporte",
    title: "Suporte e Contato",
    icon: Phone,
    description: "Canais de atendimento",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">📞 Suporte e Contato</h2>
          <p className="text-muted-foreground mb-6">
            Canais oficiais para tirar dúvidas ou reportar problemas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Suporte Técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Para erros de sistema, falhas de integração ou problemas de acesso.
              </p>
              <Button className="w-full" variant="outline" onClick={() => window.open('mailto:sistema@blomaq.com.br')}>
                Enviar E-mail
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Administração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Para criação de novos usuários, alteração de alçadas ou configurações.
              </p>
              <p className="text-sm font-medium">Contate o administrador do sistema.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: "politicas-diretrizes",
    title: "Políticas e Diretrizes",
    icon: Shield,
    description: "Políticas de compras da empresa",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">📜 Políticas e Diretrizes de Compras</h2>
          <p className="text-muted-foreground mb-6">
            A empresa estabelece diretrizes, critérios e procedimentos para as compras de materiais e serviços.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Objetivo da Política
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span><strong>Eficiência</strong> no processo de aquisições</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span><strong>Controle</strong> rigoroso das operações</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span><strong>Qualidade</strong> dos produtos e serviços</span>
                </div>
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <span><strong>Transparência</strong> em todas as etapas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "gestao-usuarios",
    title: "Gestão de Usuários",
    icon: UserCheck,
    description: "Controle de usuários e permissões",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">👥 Gestão de Usuários</h2>
          <p className="text-muted-foreground mb-6">
            Controle completo de usuários, permissões e associações com departamentos.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tipos de Usuário e Permissões</CardTitle>
            <CardDescription>Diferentes níveis de acesso no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { role: 'Solicitante', desc: 'Pode criar solicitações', icon: FileText, color: 'blue' },
                { role: 'Comprador', desc: 'Gerencia cotações e RFQs', icon: ShoppingCart, color: 'purple' },
                { role: 'Aprovador A1', desc: 'Primeira aprovação por centro', icon: CheckCircle, color: 'green' },
                { role: 'Aprovador A2', desc: 'Aprovação final de cotações', icon: CheckCircle, color: 'green' },
                { role: 'Administrador', desc: 'Acesso total ao sistema', icon: Shield, color: 'red' },
                { role: 'Gerente', desc: 'Dashboard e relatórios', icon: BarChart3, color: 'indigo' },
                { role: 'Recebedor', desc: 'Confirma recebimentos', icon: Package, color: 'orange' }
              ].map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div key={index} className="p-4 border rounded-lg text-center hover:shadow-md transition-shadow bg-card text-card-foreground">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${item.color}-100 dark:bg-${item.color}-900/30 mb-3`}>
                      <IconComponent className={`h-6 w-6 text-${item.color}-600 dark:text-${item.color}-400`} />
                    </div>
                    <h4 className="font-semibold mb-1">{item.role}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
];

export default function UserManualPage() {
  const [activeSection, setActiveSection] = useState("bem-vindo");

  const currentSection = manualSections.find(s => s.id === activeSection);

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto px-4 py-8 max-w-7xl pb-24">
        <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manual do Usuário</h1>
            <p className="text-muted-foreground">Sistema de Gestão de Compras</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <FileText className="h-3 w-3" />
            <span>Guia Completo</span>
          </Badge>
          <Badge variant="outline" className="flex items-center space-x-1">
            <Users className="h-3 w-3" />
            <span>Todos os Perfis</span>
          </Badge>
          <Badge variant="outline" className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Versão 2.0 (Jan/2026)</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar com navegação */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Seções</CardTitle>
              <CardDescription>Navegue pelos tópicos</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-16rem)]">
                <div className="space-y-1 p-4">
                  {manualSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="h-4 w-4" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm truncate">
                                {section.title}
                              </span>
                              {section.badge && (
                                <Badge 
                                  variant={isActive ? "secondary" : "outline"} 
                                  className="text-xs ml-2"
                                >
                                  {section.badge}
                                </Badge>
                              )}
                            </div>
                            <p className={`text-xs mt-1 truncate ${
                              isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            }`}>
                              {section.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Conteúdo principal */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {currentSection && (
                    <>
                      <currentSection.icon className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle className="text-2xl">{currentSection.title}</CardTitle>
                        <CardDescription className="text-base">
                          {currentSection.description}
                        </CardDescription>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    PDF Completo
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {currentSection?.content}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}