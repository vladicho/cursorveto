# Controle de Qualidade

Este checklist define o minimo necessario antes de colocar o MoldeLab em
producao.

## Objetivo

Garantir que o MoldeLab esteja seguro, estavel, correto nas medidas e pronto
para usuarios reais, especialmente porque o produto envolve arquivos de moldes,
assinaturas pagas e exportacao para producao de vestuario.

## Areas de Teste

```text
Controle de Qualidade
|-- Editor vetorial
|-- Digitalizacao
|-- Importadores
|-- Exportadores
|-- Nesting
|-- Login e senha
|-- Assinaturas e pagamento
|-- Seguranca
|-- Performance
|-- Windows app
|-- Deploy
`-- Backup e recuperacao
```

## Editor Vetorial

- selecionar, mover, girar e espelhar pecas
- editar pontos sem deformar a peca de forma inesperada
- manter medidas em centimetros
- testar zoom, pan e regua
- verificar se o canvas nao fica em branco
- testar navegadores principais: Chrome, Edge e Firefox

## Digitalizacao

- importar foto de molde
- calibrar escala com medida conhecida
- criar peca clicando no contorno
- verificar se a peca criada fica em escala real
- testar imagens grandes
- testar imagens rotacionadas ou com baixa qualidade

## Importadores

- testar SVG com `polygon`, `polyline` e `path`
- testar DXF com `LWPOLYLINE`, `POLYLINE`, `VERTEX` e `LINE`
- testar PLT com `PU`, `PD` e `PA`
- validar arquivos vazios, corrompidos e muito grandes
- comparar medidas importadas com o arquivo original
- testar `.ads` apenas com amostras reais do Audaces 7

## Exportadores

- exportar SVG
- abrir o SVG exportado em outro programa
- verificar escala real
- verificar se todas as pecas aparecem
- testar nomes de arquivos e caracteres especiais
- futuramente validar DXF e PDF

## Nesting

- garantir que pecas nao se sobreponham
- respeitar largura do tecido
- respeitar margem entre pecas
- calcular aproveitamento corretamente
- testar pecas muito grandes
- testar muitas pecas no mesmo risco

## Login e Senha

- cadastro de usuario
- login
- logout
- recuperacao de senha
- troca de senha
- bloqueio de usuario nao autenticado
- usuario so acessa os proprios projetos
- sessao expira corretamente

## Assinaturas e Pagamento

- criar checkout de plano
- pagamento aprovado
- pagamento recusado
- assinatura ativa
- assinatura cancelada
- assinatura vencida
- webhook valido
- webhook invalido
- liberar recursos apenas para plano correto
- nunca salvar dados sensiveis de cartao

## Seguranca

- HTTPS em producao
- senha com hash forte
- protecao contra acesso a projetos de outro usuario
- validacao de upload
- limite de tamanho de arquivo
- protecao contra scripts em SVG importado
- validacao dos webhooks de pagamento
- logs de eventos importantes
- variaveis secretas fora do codigo

## Performance

- abrir editor rapidamente
- importar arquivos grandes sem travar a interface
- testar muitos pontos no canvas
- testar nesting com varias pecas
- medir uso de memoria
- otimizar renderizacao quando necessario

## Windows App

- abrir e salvar arquivos locais
- importar arquivos pelo explorador do Windows
- exportar para pasta escolhida
- testar instalador `.exe` ou `.msi`
- testar Windows 10 e Windows 11
- testar permissao de arquivos e antivirus
- testar impressoras/plotters quando disponivel

## Deploy

- build de producao
- HTTPS configurado
- banco com backup automatico
- migracoes testadas
- logs e monitoramento ativos
- dominio configurado
- ambiente de teste separado de producao
- rollback documentado

## Criterios Para Ir a Producao

O MoldeLab so deve ir para producao quando:

- login e pagamento estiverem testados
- projetos estiverem isolados por usuario
- importacao/exportacao principal estiver validada com arquivos reais
- backup estiver funcionando
- HTTPS estiver ativo
- erros importantes forem registrados em logs
- checklist critico estiver aprovado
