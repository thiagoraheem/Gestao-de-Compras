import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Camera
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
          <p className="text-gray-600 mb-6 text-lg">
            Este manual irá guiá-lo através de todas as funcionalidades do sistema, desde o primeiro acesso até a conclusão completa de um processo de compra.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>O que você encontrará neste manual:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Navegação básica</strong> e primeiros passos</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Políticas e diretrizes</strong> de compras</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Processo completo de compras</strong> (8 fases)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Gestão de fornecedores</strong> e usuários</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Configurações</strong> e personalização</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Dicas e boas práticas</strong> para cada perfil</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Solução de problemas</strong> comuns</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span><strong>Auditoria e controles</strong> internos</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Tela de Login do Sistema</h3>
              <p className="text-blue-800 mb-3">
                A tela inicial do Sistema de Gestão de Compras oferece acesso seguro e intuitivo para todos os usuários.
              </p>
              <p className="text-sm text-blue-700">
                <em>Figura 1: Tela de login do Sistema de Gestão de Compras</em>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "politicas-diretrizes",
    title: "Políticas e Diretrizes",
    icon: Shield,
    description: "Políticas de compras da empresa",
    badge: "Importante",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">📜 Políticas e Diretrizes de Compras</h2>
          <p className="text-gray-600 mb-6">
            A empresa estabelece diretrizes, critérios e procedimentos para as compras de materiais, produtos, insumos e contratação de serviços.
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
            <p className="mb-4">
              Conforme Política de Compras oficial, visando assegurar:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <span><strong>Eficiência</strong> no processo de aquisições</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span><strong>Controle</strong> rigoroso das operações</span>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <span><strong>Economicidade</strong> na aplicação de recursos</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-purple-600" />
                  <span><strong>Qualidade</strong> dos produtos e serviços</span>
                </div>
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-orange-600" />
                  <span><strong>Transparência</strong> em todas as etapas</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-red-600" />
                  <span><strong>Eficácia</strong> na melhor condição de compra</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Princípios Fundamentais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-600" />
                  Obrigatoriedade do Fluxo
                </h4>
                <p className="text-sm text-gray-600">Todas as solicitações devem passar pelo processo de compras oficial</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Utilização do Sistema
                </h4>
                <p className="text-sm text-gray-600">Uso obrigatório do Módulo de Compras integrado ao ERP</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Classificação de Urgência
                </h4>
                <p className="text-sm text-gray-600">Solicitantes devem classificar corretamente o grau de urgência</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-purple-600" />
                  Controle de Assinaturas
                </h4>
                <p className="text-sm text-gray-600">Todas as assinaturas corporativas devem ser gerenciadas pelo setor de compras</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "getting-started",
    title: "Primeiros Passos",
    icon: Zap,
    description: "Como começar a usar o sistema",
    badge: "Essencial",
    content: (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Info className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Bem-vindo ao Sistema de Gestão de Compras</h4>
          </div>
          <p className="text-blue-800 text-sm">
            Este sistema foi desenvolvido para otimizar e controlar todo o processo de compras da empresa,
            desde a solicitação inicial até o recebimento dos materiais.
          </p>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center space-x-2">
            <ChevronRight className="h-4 w-4" />
            <span>Acessando o Sistema</span>
          </h4>
          <ol className="list-decimal list-inside space-y-2 ml-4 text-sm">
            <li>Abra seu navegador e acesse o endereço do sistema</li>
            <li>Digite seu usuário/email e senha na tela de login</li>
            <li>Caso tenha esquecido a senha, clique em "Esqueci minha senha"</li>
            <li>No primeiro acesso, altere sua senha em <strong>Perfil → Alterar Senha</strong></li>
          </ol>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold flex items-center space-x-2">
            <ChevronRight className="h-4 w-4" />
            <span>Navegação Principal</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="font-medium">Kanban</span>
              </div>
              <p className="text-sm text-gray-600">Visualização principal com todas as solicitações em formato de quadro</p>
            </div>
            <div className="border rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">Gerenciar</span>
              </div>
              <p className="text-sm text-gray-600">Lista completa de solicitações com filtros avançados</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "workflow",
    title: "Fluxo de Compras",
    icon: ShoppingCart,
    description: "Entenda as 8 fases do processo",
    badge: "Importante",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔄 Workflow de Compras - Guia Completo</h2>
          <p className="text-gray-600 mb-6">
            O sistema utiliza um workflow Kanban com 8 fases fixas. Cada fase tem responsáveis específicos e ações permitidas.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>As 8 Fases do Processo</CardTitle>
            <CardDescription>Workflow completo do processo de compras</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { phase: '1', name: 'Solicitação', icon: FileText, color: 'blue', desc: 'Criação da solicitação' },
                { phase: '2', name: 'Aprovação A1', icon: CheckCircle, color: 'green', desc: 'Primeira aprovação' },
                { phase: '3', name: 'Cotação', icon: DollarSign, color: 'yellow', desc: 'Busca de fornecedores' },
                { phase: '4', name: 'Aprovação A2', icon: CheckCircle, color: 'green', desc: 'Segunda aprovação' },
                { phase: '5', name: 'Pedido', icon: FileText, color: 'purple', desc: 'Geração do pedido' },
                { phase: '6', name: 'Recebimento', icon: ShoppingCart, color: 'orange', desc: 'Recebimento dos itens' },
                { phase: '7', name: 'Conclusão', icon: Award, color: 'teal', desc: 'Finalização do processo' },
                { phase: '8', name: 'Arquivado', icon: FileText, color: 'gray', desc: 'Processo arquivado' }
              ].map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div key={index} className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${item.color}-100 mb-3`}>
                      <IconComponent className={`h-6 w-6 text-${item.color}-600`} />
                    </div>
                    <h4 className="font-semibold mb-1">{item.phase}. {item.name}</h4>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              📝 Fase 1: Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Quem pode usar</Badge>
              <span className="text-sm font-semibold">Todos os usuários autenticados</span>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Como criar uma nova solicitação:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm">1. <strong>Clique no botão "+" flutuante</strong> (canto inferior direito) ou</p>
                  <p className="text-sm">2. <strong>Menu</strong> → <strong>Nova Solicitação</strong></p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <em>Figura 8: Botão flutuante para criar nova solicitação</em>
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">📋 Dados Obrigatórios:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-semibold text-sm mb-1">Empresa</h5>
                    <p className="text-xs text-gray-600">Selecione a empresa (geralmente pré-selecionada)</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-semibold text-sm mb-1">Centro de Custo</h5>
                    <p className="text-xs text-gray-600">Gerentes: qualquer centro / Outros: limitados aos associados</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-semibold text-sm mb-1">Categoria</h5>
                    <div className="space-y-1 text-xs">
                      <p>🔧 <strong>Produto:</strong> Materiais físicos, equipamentos</p>
                      <p>🛠️ <strong>Serviço:</strong> Manutenção, consultoria, treinamento</p>
                      <p>📦 <strong>Outros:</strong> Demais necessidades</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-semibold text-sm mb-1">Urgência</h5>
                    <div className="space-y-1 text-xs">
                      <p>🟢 <strong>Baixo:</strong> Processo normal (15-30 dias)</p>
                      <p>🟡 <strong>Médio:</strong> Necessidade moderada (7-15 dias)</p>
                      <p>🔴 <strong>Alto:</strong> Urgente (até 7 dias)</p>
                      <p>🔵 <strong>Muito Alto:</strong> Crítico (até 3 dias)</p>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-semibold text-sm mb-1">Justificativa</h5>
                    <p className="text-xs text-gray-600">Explique detalhadamente a necessidade</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <em>Figuras 9 e 10: Seção de dados básicos da solicitação e seção para adicionar itens</em>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Dicas importantes:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Seja específico nas especificações técnicas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Justifique adequadamente a necessidade</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Verifique se o centro de custo está correto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Revise todos os dados antes de enviar</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              ✅ Fase 2: Aprovação A1
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Quem pode usar</Badge>
              <span className="text-sm font-semibold">Usuários com permissão "Aprovador A1"</span>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Restrições importantes:</h4>
              <div className="space-y-2 text-sm text-yellow-800">
                <p>• Aprovadores A1 só veem solicitações dos <strong>centros de custo associados</strong> ao seu perfil</p>
                <p>• Não é possível aprovar solicitações de outros centros de custo</p>
                <p>• O sistema <strong>valida automaticamente</strong> se você tem permissão para aprovar cada solicitação</p>
                <p>• A validação ocorre tanto no <strong>frontend</strong> quanto no <strong>backend</strong> para máxima segurança</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <em>Figuras 11 e 12: Cards na fase Aprovação A1 e tela de aprovação - usuário autorizado vs não autorizado</em>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Opções disponíveis:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border-l-4 border-green-500 bg-green-50">
                  <h5 className="font-semibold text-green-800 mb-2">✅ Aprovar:</h5>
                  <div className="space-y-1 text-sm text-green-700">
                    <p>• Clique em <strong>"Aprovar"</strong></p>
                    <p>• A solicitação move automaticamente para <strong>"Cotação"</strong></p>
                    <p>• <strong>Compradores</strong> recebem notificação</p>
                    <p>• Histórico de aprovação é registrado</p>
                  </div>
                </div>
                <div className="p-4 border-l-4 border-red-500 bg-red-50">
                  <h5 className="font-semibold text-red-800 mb-2">❌ Reprovar:</h5>
                  <div className="space-y-1 text-sm text-red-700">
                    <p>• Clique em <strong>"Reprovar"</strong></p>
                    <p>• <strong>Obrigatório:</strong> Informe o motivo da reprovação</p>
                    <p>• A solicitação volta para <strong>"Solicitação"</strong></p>
                    <p>• Solicitante recebe notificação com o motivo</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              💰 Fase 3: Cotação (RFQ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Quem pode usar</Badge>
              <span className="text-sm font-semibold">Usuários com permissão "Comprador"</span>
            </div>

            <p className="text-sm text-gray-600">
              Esta é uma das fases mais importantes do processo, onde são obtidas as propostas dos fornecedores.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <em>Figuras 14-19: Processo completo de cotação - criação de RFQ, seleção de fornecedores, upload de propostas e análise comparativa</em>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">📋 Dados da Cotação:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm">• <strong>Número da Cotação:</strong> Gerado automaticamente</p>
                  <p className="text-sm">• <strong>Local de Entrega:</strong> Selecione onde o material deve ser entregue</p>
                  <p className="text-sm">• <strong>Prazo para Cotação:</strong> Data limite para fornecedores responderem</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">• <strong>Termos e Condições:</strong> Condições gerais da cotação</p>
                  <p className="text-sm">• <strong>Especificações Técnicas:</strong> Detalhes técnicos consolidados</p>
                  <p className="text-sm">• <strong>Seleção de Fornecedores:</strong> Mínimo 1, recomendado 3+</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">🏆 Seleção do Vencedor:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm">• Marque o fornecedor escolhido</p>
                  <p className="text-sm">• Registre valor negociado</p>
                  <p className="text-sm">• Informe descontos obtidos</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">• Motivos: Melhor preço, prazo, qualidade</p>
                  <p className="text-sm">• Justificativa da escolha documentada</p>
                  <p className="text-sm">• Análise comparativa obrigatória</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                ✅ Fase 4: Aprovação A2
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Quem pode usar</Badge>
                <span className="text-sm">Aprovadores A2</span>
              </div>
              <p className="text-sm text-gray-600">Aprovação final antes da geração do pedido de compra.</p>
              <div className="space-y-2">
                <h5 className="font-semibold text-sm">Opções:</h5>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• ✅ Aprovar</li>
                  <li>• 🗃️ Arquivar definitivamente</li>
                  <li>• 🔄 Retornar para nova cotação</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                📋 Fase 5: Pedido de Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Quem pode usar</Badge>
                <span className="text-sm">Compradores</span>
              </div>
              <p className="text-sm text-gray-600">Geração do pedido oficial de compra.</p>
              <div className="space-y-2">
                <h5 className="font-semibold text-sm">Funcionalidades:</h5>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• 📄 PDF gerado automaticamente</li>
                  <li>• 📝 Observações do pedido</li>
                  <li>• 🖨️ Visualizar e baixar PDF</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                📦 Fase 6: Recebimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Quem pode usar</Badge>
                <span className="text-sm">Recebedores</span>
              </div>
              <p className="text-sm text-gray-600">Recebimento e conferência dos materiais.</p>
              <div className="space-y-2">
                <h5 className="font-semibold text-sm">Ações:</h5>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• ✅ Confirmar recebimento</li>
                  <li>• ⚠️ Registrar pendência</li>
                  <li>• 📊 Controle de qualidade</li>
                  <li>• 🔢 Informar Qtd Atual (NF) apenas com números inteiros (0 ou positivos)</li>
                  <li>• 🛑 Usar o botão “Reportar Divergência” para retornar o pedido à fase de Pedido de Compra quando houver divergência de quantidade</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                🎯 Fases 7-8: Conclusão e Arquivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Acesso</Badge>
                <span className="text-sm">Todos (visualização)</span>
              </div>
              <p className="text-sm text-gray-600">Fase final com resumo completo e arquivamento.</p>
              <div className="space-y-2">
                <h5 className="font-semibold text-sm">Informações:</h5>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• 📊 Métricas do processo</li>
                  <li>• 📈 Timeline completa</li>
                  <li>• 📎 Anexos disponíveis</li>
                  <li>• 🖨️ Função de impressão</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <h3 className="font-semibold text-green-900 mb-2">💡 Dica Importante</h3>
              <p className="text-green-800">
                Cada fase tem validações automáticas e só permite ações para usuários com as permissões adequadas. 
                O sistema garante que o fluxo seja seguido corretamente e todas as ações são auditáveis.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "gestao-fornecedores",
    title: "Gestão de Fornecedores",
    icon: Building,
    description: "Cadastro e gerenciamento de fornecedores",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🏢 Gestão de Fornecedores</h2>
          <p className="text-gray-600 mb-6">
            Cadastro e gerenciamento completo de fornecedores para o processo de cotação.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Acesso ao Módulo</h3>
              <p className="text-blue-800 mb-3">
                Para acessar a gestão de fornecedores, vá ao <strong>Menu Principal</strong> → <strong>Fornecedores</strong>.
              </p>
              <p className="text-sm text-blue-700">
                <em>Figura 20: Tela de gestão de fornecedores com lista e opções de cadastro</em>
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Cadastro de Fornecedores
            </CardTitle>
            <CardDescription>Informações necessárias para cadastrar um novo fornecedor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">📋 Dados Básicos:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Nome/Razão Social:</strong> Nome completo da empresa</p>
                  <p>• <strong>CNPJ:</strong> Documento de identificação</p>
                  <p>• <strong>Inscrição Estadual:</strong> Quando aplicável</p>
                  <p>• <strong>Endereço Completo:</strong> Rua, número, bairro, cidade, CEP</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">📞 Dados de Contato:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Telefone Principal:</strong> Contato comercial</p>
                  <p>• <strong>E-mail:</strong> Para envio de RFQs</p>
                  <p>• <strong>Pessoa de Contato:</strong> Responsável comercial</p>
                  <p>• <strong>Site:</strong> Website da empresa (opcional)</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2">💼 Condições Comerciais:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p><strong>Prazo de Pagamento:</strong></p>
                  <p className="text-gray-600">Ex: 30 dias, À vista, 15/30 dias</p>
                </div>
                <div>
                  <p><strong>Prazo de Entrega:</strong></p>
                  <p className="text-gray-600">Tempo médio de entrega</p>
                </div>
                <div>
                  <p><strong>Observações:</strong></p>
                  <p className="text-gray-600">Informações adicionais</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Editando Fornecedores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm">1. <strong>Localize o fornecedor</strong> na lista</p>
                <p className="text-sm">2. <strong>Clique no ícone de edição</strong> (lápis)</p>
                <p className="text-sm">3. <strong>Modifique os dados</strong> necessários</p>
                <p className="text-sm">4. <strong>Salve as alterações</strong></p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Dica:</strong> Mantenha sempre os dados de contato atualizados para facilitar o processo de cotação.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Excluindo Fornecedores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm">1. <strong>Clique no ícone de exclusão</strong> (lixeira)</p>
                <p className="text-sm">2. <strong>Confirme a exclusão</strong> no modal</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Atenção:</strong> Fornecedores que já participaram de cotações não podem ser excluídos, apenas desativados.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Busca e Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">🔍 Busca por Nome</h4>
                <p className="text-xs text-gray-600">Digite o nome ou razão social do fornecedor</p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">📄 Busca por CNPJ</h4>
                <p className="text-xs text-gray-600">Informe o CNPJ para localização rápida</p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">📊 Status</h4>
                <p className="text-xs text-gray-600">Filtre por fornecedores ativos ou inativos</p>
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
          <p className="text-gray-600 mb-6">
            Controle completo de usuários, permissões e associações com departamentos.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Acesso ao Módulo</h3>
              <p className="text-blue-800 mb-3">
                Para acessar a gestão de usuários, vá ao <strong>Menu Principal</strong> → <strong>Usuários</strong>.
              </p>
              <p className="text-sm text-blue-700">
                <em>Figura 21: Tela de gestão de usuários com lista e permissões</em>
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tipos de Usuário e Permissões</CardTitle>
            <CardDescription>Diferentes níveis de acesso no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { role: 'Solicitante', desc: 'Pode criar solicitações (padrão)', icon: FileText, color: 'blue' },
                { role: 'Comprador', desc: 'Gerencia cotações e RFQs', icon: ShoppingCart, color: 'purple' },
                { role: 'Aprovador A1', desc: 'Primeira aprovação por centro de custo', icon: CheckCircle, color: 'green' },
                { role: 'Aprovador A2', desc: 'Aprovação final de cotações', icon: CheckCircle, color: 'green' },
                { role: 'Administrador', desc: 'Acesso total ao sistema', icon: Shield, color: 'red' },
                { role: 'Gerente', desc: 'Dashboard e relatórios', icon: BarChart3, color: 'indigo' },
                { role: 'Recebedor', desc: 'Confirma recebimentos', icon: ShoppingCart, color: 'orange' }
              ].map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div key={index} className="p-4 border rounded-lg text-center hover:shadow-md transition-shadow">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${item.color}-100 mb-3`}>
                      <IconComponent className={`h-6 w-6 text-${item.color}-600`} />
                    </div>
                    <h4 className="font-semibold mb-1">{item.role}</h4>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Criando Novos Usuários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">📋 Dados Pessoais:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Nome Completo:</strong> Nome e sobrenome</p>
                  <p>• <strong>E-mail:</strong> Será usado como login</p>
                  <p>• <strong>Telefone:</strong> Contato do usuário</p>
                  <p>• <strong>Cargo/Função:</strong> Posição na empresa</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">🏢 Associações:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Empresa:</strong> Empresa do usuário</p>
                  <p>• <strong>Departamento:</strong> Setor de trabalho</p>
                  <p>• <strong>Centro de Custo:</strong> Para aprovadores A1</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Importante - Aprovadores A1:</h4>
              <p className="text-sm text-yellow-800">
                Usuários com permissão "Aprovador A1" <strong>devem ser associados aos centros de custo</strong> que podem aprovar. 
                Esta associação determina quais solicitações eles visualizam e podem aprovar.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Permissões do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <h5 className="font-semibold">Roles Disponíveis:</h5>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Comprador</Badge>
                  <Badge variant="outline">Aprovador A1</Badge>
                  <Badge variant="outline">Aprovador A2</Badge>
                  <Badge variant="outline">Administrador</Badge>
                  <Badge variant="outline">Gerente</Badge>
                  <Badge variant="outline">Recebedor</Badge>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <strong>✅ Flexibilidade:</strong> Um usuário pode ter múltiplas permissões simultaneamente.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Editando Usuários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <p>1. <strong>Localize o usuário</strong> na lista</p>
                <p>2. <strong>Clique no ícone de edição</strong></p>
                <p>3. <strong>Modifique dados pessoais</strong> ou permissões</p>
                <p>4. <strong>Atualize associações</strong> se necessário</p>
                <p>5. <strong>Salve as alterações</strong></p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Dica:</strong> Revise periodicamente as permissões dos usuários para manter a segurança.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: "permissions",
    title: "Perfis e Permissões",
    icon: Users,
    description: "Entenda os diferentes tipos de usuário",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "Solicitante",
              desc: "Usuário básico que pode criar solicitações",
              permissions: ["Criar solicitações", "Visualizar próprias solicitações", "Anexar documentos"]
            },
            {
              title: "Aprovador A1",
              desc: "Aprova solicitações por centro de custo",
              permissions: ["Aprovar/reprovar A1", "Visualizar solicitações do centro", "Todas as funções de Solicitante"]
            },
            {
              title: "Comprador",
              desc: "Gerencia cotações e pedidos de compra",
              permissions: ["Criar cotações", "Gerar pedidos", "Gerenciar fornecedores", "Todas as funções anteriores"]
            },
            {
              title: "Aprovador A2",
              desc: "Aprovação final das cotações",
              permissions: ["Aprovar/reprovar A2", "Visualizar todas as cotações", "Todas as funções anteriores"]
            },
            {
              title: "Recebedor",
              desc: "Recebe e confere materiais",
              permissions: ["Receber materiais", "Reportar pendências", "Finalizar recebimentos"]
            },
            {
              title: "Gerente",
              desc: "Acesso ao dashboard executivo",
              permissions: ["Dashboard completo", "Relatórios gerenciais", "Métricas e indicadores"]
            },
            {
              title: "Administrador",
              desc: "Controle total do sistema",
              permissions: ["Gerenciar usuários", "Configurar empresas", "Todas as permissões", "Limpeza de dados"]
            }
          ].map((role, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{role.title}</CardTitle>
                <CardDescription>{role.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {role.permissions.map((perm, i) => (
                    <li key={i} className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  },
  {
    id: "tips",
    title: "Dicas e Boas Práticas",
    icon: HelpCircle,
    description: "Maximize sua produtividade",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Para Solicitantes</span>
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Planeje com antecedência para evitar urgências</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Seja específico nas descrições e especificações</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Anexe catálogos e documentos de referência</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Justifique bem a necessidade e urgência</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Para Compradores</span>
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Mantenha cadastro de fornecedores atualizado</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Solicite cotações de pelo menos 3 fornecedores</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Analise não apenas preço, mas qualidade e prazo</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Documente bem as justificativas de escolha</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold mb-3 flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Prazos e Metas</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="font-medium text-blue-900">Processo Completo</div>
              <div className="text-2xl font-bold text-blue-600">&lt; 15 dias</div>
              <div className="text-sm text-blue-700">Meta ideal</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="font-medium text-green-900">Taxa de Aprovação A1</div>
              <div className="text-2xl font-bold text-green-600">&gt; 80%</div>
              <div className="text-sm text-green-700">Meta ideal</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="font-medium text-purple-900">Tempo de Cotação</div>
              <div className="text-2xl font-bold text-purple-600">&lt; 5 dias</div>
              <div className="text-sm text-purple-700">Meta ideal</div>
            </div>
          </div>
        </div>
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
              problem: "Não consigo criar uma solicitação",
              solutions: [
                "Verifique se você está logado no sistema",
                "Confirme se tem permissão para o centro de custo selecionado",
                "Tente atualizar a página (F5)",
                "Limpe o cache do navegador"
              ]
            },
            {
              problem: "Não recebo notificações por e-mail",
              solutions: [
                "Verifique sua caixa de spam/lixo eletrônico",
                "Confirme se seu e-mail está correto no perfil",
                "Entre em contato com o administrador do sistema"
              ]
            },
            {
              problem: "Erro ao fazer upload de arquivo",
              solutions: [
                "Verifique se o arquivo tem menos de 10MB",
                "Confirme se o formato é PDF, DOC, DOCX, XLS, XLSX ou imagem",
                "Tente renomear o arquivo removendo caracteres especiais",
                "Verifique sua conexão com a internet"
              ]
            },
            {
              problem: "Não consigo aprovar uma solicitação",
              solutions: [
                "Verifique se você tem permissão de aprovador",
                "Confirme se a solicitação está na fase correta",
                "Verifique se o centro de custo está associado ao seu usuário",
                "Tente fazer logout e login novamente"
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
                      <li key={i} className="flex items-start space-x-2 text-sm">
                        <ChevronRight className="h-3 w-3 text-gray-400 mt-1" />
                        <span>{solution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <HelpCircle className="h-5 w-5 text-yellow-600" />
            <h4 className="font-semibold text-yellow-900">Ainda precisa de ajuda?</h4>
          </div>
          <p className="text-yellow-800 text-sm mb-3">
            Se o problema persistir, entre em contato com o suporte técnico fornecendo:
          </p>
          <ul className="text-yellow-800 text-sm space-y-1">
            <li>• Seu nome de usuário</li>
            <li>• Descrição detalhada do problema</li>
            <li>• Passos que levaram ao erro</li>
            <li>• Mensagem de erro (se houver)</li>
            <li>• Navegador utilizado</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: "configuracoes-pessoais",
    title: "Configurações Pessoais",
    icon: User,
    description: "Gerencie seu perfil e preferências",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">⚙️ Configurações Pessoais</h2>
          <p className="text-gray-600 mb-6">
            Gerencie seu perfil, altere sua senha e configure suas preferências pessoais.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Acesso às Configurações</h3>
              <p className="text-blue-800 mb-3">
                Para acessar suas configurações pessoais, clique no <strong>seu avatar</strong> no canto superior direito 
                e selecione <strong>"Configurações"</strong> no menu dropdown.
              </p>
              <p className="text-sm text-blue-700">
                <em>Figura 22: Menu do usuário com opções de perfil e configurações</em>
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Perfil do Usuário
            </CardTitle>
            <CardDescription>Atualize suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">📋 Dados Pessoais:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Nome Completo:</strong> Altere seu nome de exibição</p>
                  <p>• <strong>E-mail:</strong> Visualize seu e-mail de login</p>
                  <p>• <strong>Telefone:</strong> Atualize seu contato</p>
                  <p>• <strong>Cargo:</strong> Modifique sua função</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">🏢 Informações Corporativas:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Empresa:</strong> Empresa associada (somente leitura)</p>
                  <p>• <strong>Departamento:</strong> Setor de trabalho (somente leitura)</p>
                  <p>• <strong>Permissões:</strong> Roles atribuídas (somente leitura)</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Nota:</strong> Algumas informações como empresa, departamento e permissões 
                só podem ser alteradas por um administrador do sistema.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alteração de Senha
            </CardTitle>
            <CardDescription>Mantenha sua conta segura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">🔐 Como Alterar:</h4>
                <div className="space-y-2 text-sm">
                  <p>1. <strong>Informe a senha atual</strong></p>
                  <p>2. <strong>Digite a nova senha</strong></p>
                  <p>3. <strong>Confirme a nova senha</strong></p>
                  <p>4. <strong>Clique em "Alterar Senha"</strong></p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">🛡️ Requisitos de Segurança:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Mínimo 8 caracteres</strong></p>
                  <p>• <strong>Pelo menos 1 letra maiúscula</strong></p>
                  <p>• <strong>Pelo menos 1 número</strong></p>
                  <p>• <strong>Pelo menos 1 caractere especial</strong></p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>💡 Dica de Segurança:</strong> Altere sua senha regularmente e nunca compartilhe 
                suas credenciais com outras pessoas.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Recuperação de Senha
            </CardTitle>
            <CardDescription>Caso tenha esquecido sua senha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold">📧 Processo de Recuperação:</h4>
              <div className="space-y-2 text-sm">
                <p>1. <strong>Na tela de login</strong>, clique em "Esqueci minha senha"</p>
                <p>2. <strong>Informe seu e-mail</strong> cadastrado no sistema</p>
                <p>3. <strong>Verifique sua caixa de entrada</strong> (e spam/lixo eletrônico)</p>
                <p>4. <strong>Clique no link</strong> recebido por e-mail</p>
                <p>5. <strong>Defina uma nova senha</strong> seguindo os requisitos</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>⏰ Tempo de Validade:</strong> O link de recuperação é válido por 24 horas. 
                Após esse período, será necessário solicitar um novo link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: "uso-mobile",
    title: "Uso Mobile",
    icon: Smartphone,
    description: "Sistema otimizado para dispositivos móveis",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">📱 Uso Mobile</h2>
          <p className="text-gray-600 mb-6">
            O sistema é totalmente responsivo e otimizado para dispositivos móveis.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
            <div>
              <h3 className="font-semibold text-green-900 mb-2">Design Responsivo</h3>
              <p className="text-green-800 mb-3">
                O sistema se adapta automaticamente ao tamanho da tela, proporcionando 
                uma experiência otimizada em smartphones e tablets.
              </p>
              <p className="text-sm text-green-700">
                <em>Figuras 23-25: Interface mobile - menu, kanban e formulários adaptados</em>
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Funcionalidades Mobile
            </CardTitle>
            <CardDescription>Todas as funcionalidades disponíveis em dispositivos móveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">✅ Funcionalidades Completas:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Criar solicitações</strong> com todos os campos</p>
                  <p>• <strong>Aprovar/reprovar</strong> solicitações</p>
                  <p>• <strong>Gerenciar cotações</strong> e RFQs</p>
                  <p>• <strong>Visualizar relatórios</strong> e métricas</p>
                  <p>• <strong>Receber notificações</strong> em tempo real</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">📱 Otimizações Mobile:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Menu hambúrguer</strong> para navegação</p>
                  <p>• <strong>Cards otimizados</strong> para toque</p>
                  <p>• <strong>Formulários adaptados</strong> para teclado mobile</p>
                  <p>• <strong>Botões maiores</strong> para facilitar o toque</p>
                  <p>• <strong>Scroll otimizado</strong> para listas longas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Dicas para Uso Mobile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">🌐 Conectividade:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Wi-Fi recomendado</strong> para uploads de arquivos</p>
                  <p>• <strong>4G/5G suficiente</strong> para uso geral</p>
                  <p>• <strong>Modo offline limitado</strong> - sincroniza ao reconectar</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">⚡ Performance:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Feche abas desnecessárias</strong> do navegador</p>
                  <p>• <strong>Mantenha o app atualizado</strong> (PWA)</p>
                  <p>• <strong>Limpe o cache</strong> periodicamente</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📲 Instalação como App (PWA)</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <p>1. <strong>Acesse o sistema</strong> pelo navegador mobile</p>
                <p>2. <strong>Toque no menu do navegador</strong> (3 pontos)</p>
                <p>3. <strong>Selecione "Adicionar à tela inicial"</strong></p>
                <p>4. <strong>Confirme a instalação</strong></p>
                <p>5. <strong>Use como um app nativo</strong> com ícone na tela inicial</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Upload de Arquivos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <p>• <strong>Câmera integrada</strong> para fotos diretas</p>
                <p>• <strong>Galeria de fotos</strong> para imagens existentes</p>
                <p>• <strong>Arquivos da nuvem</strong> (Google Drive, OneDrive)</p>
                <p>• <strong>Compressão automática</strong> para economizar dados</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações Push
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <p>• <strong>Permita notificações</strong> quando solicitado</p>
                <p>• <strong>Receba alertas</strong> de novas solicitações</p>
                <p>• <strong>Lembretes de prazos</strong> importantes</p>
                <p>• <strong>Configure no sistema</strong> quais receber</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: "sistema-notificacoes",
    title: "Sistema de Notificações",
    icon: Bell,
    description: "Notificações automáticas por e-mail",
    content: (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-4">🔔 Sistema de Notificações</h2>
          <p className="text-gray-600 mb-6">
            O sistema envia notificações automáticas por e-mail para manter todos informados sobre o andamento dos processos.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Notificações Automáticas por E-mail
            </CardTitle>
            <CardDescription>Comunicação automática para cada etapa do processo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">📧 Tipos de Notificação:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Nova solicitação criada</strong> → Aprovadores A1</p>
                  <p>• <strong>Solicitação aprovada A1</strong> → Compradores</p>
                  <p>• <strong>Cotação criada</strong> → Fornecedores selecionados</p>
                  <p>• <strong>Cotação finalizada</strong> → Aprovadores A2</p>
                  <p>• <strong>Pedido gerado</strong> → Fornecedor vencedor</p>
                  <p>• <strong>Material recebido</strong> → Solicitante original</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">📋 Conteúdo dos E-mails:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Número da solicitação</strong></p>
                  <p>• <strong>Descrição resumida</strong></p>
                  <p>• <strong>Valor total (quando aplicável)</strong></p>
                  <p>• <strong>Prazo para ação</strong></p>
                  <p>• <strong>Link direto</strong> para o sistema</p>
                  <p>• <strong>Instruções específicas</strong> da fase</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <em>Figura 26: Exemplo de e-mail de notificação com layout profissional e informações completas</em>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações de Notificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold">⚙️ Configurações Pessoais:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Frequência:</strong> Imediata, diária ou semanal</p>
                  <p>• <strong>Tipos:</strong> Selecione quais receber</p>
                  <p>• <strong>Horário:</strong> Defina horário preferido</p>
                  <p>• <strong>Formato:</strong> Resumo ou detalhado</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">🎯 Por Tipo de Usuário:</h4>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Solicitantes:</strong> Status das suas solicitações</p>
                  <p>• <strong>Aprovadores:</strong> Itens pendentes de aprovação</p>
                  <p>• <strong>Compradores:</strong> Cotações para processar</p>
                  <p>• <strong>Recebedores:</strong> Materiais para receber</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">📧 Configuração de E-mail</h4>
              <p className="text-sm text-yellow-800">
                Verifique se o e-mail cadastrado está correto e adicione <strong>sistema@blomaq.com.br</strong> 
                à sua lista de contatos confiáveis para evitar que as notificações caiam no spam.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Alertas de Prazo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <p>• <strong>3 dias antes</strong> do vencimento</p>
                <p>• <strong>1 dia antes</strong> do vencimento</p>
                <p>• <strong>No dia</strong> do vencimento</p>
                <p>• <strong>Após vencimento</strong> (escalação)</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Escalação:</strong> Prazos vencidos são automaticamente escalados para supervisores.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Relatórios por E-mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <p>• <strong>Resumo semanal</strong> para gerentes</p>
                <p>• <strong>Relatório mensal</strong> de performance</p>
                <p>• <strong>Alertas de orçamento</strong> por centro de custo</p>
                <p>• <strong>Indicadores de SLA</strong> e prazos</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  <strong>📊 Personalização:</strong> Configure quais métricas receber nos relatórios automáticos.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
];

export default function UserManualPage() {
  const [activeSection, setActiveSection] = useState("bem-vindo");

  const currentSection = manualSections.find(s => s.id === activeSection);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manual do Usuário</h1>
            <p className="text-gray-600">Sistema de Gestão de Compras</p>
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
            <span>Atualizado</span>
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
              <ScrollArea className="h-[600px]">
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
                            : 'hover:bg-muted'
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
              <ScrollArea className="h-[700px] pr-4">
                {currentSection?.content}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
