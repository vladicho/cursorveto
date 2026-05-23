# Estrategia de Produto

O MoldeLab deve ser melhor que sistemas legados de modelagem em pontos que
importam para modelistas, confecções pequenas e medias e equipes de producao.

## Posicionamento

```text
MoldeLab = modelagem vetorial + digitalizacao + nesting + nuvem + Windows
```

O objetivo nao e replicar 100% de um sistema antigo, mas entregar um fluxo mais
simples, moderno e acessivel para criar, importar, editar, encaixar e exportar
moldes.

## Diferenciais

- interface moderna e mais facil de aprender
- versao web e aplicativo nativo Windows
- projetos salvos na nuvem com backup
- digitalizacao por foto ou scan
- compatibilidade progressiva com Audaces `.ads` e `.amk`
- importacao SVG, DXF, PLT e formatos futuros
- nesting visual com colisao e aproveitamento em tempo real
- exportacao SVG, DXF e PDF
- historico de versoes dos moldes
- biblioteca de pecas e bases
- login, planos e pagamento online
- suporte a clientes pequenos que precisam de ferramenta acessivel

## Fluxo Profissional Esperado

```text
Cliente entra na conta
v
Cria ou abre projeto
v
Importa molde, digitaliza ou desenha do zero
v
Edita pontos, curvas, medidas e grade
v
Faz encaixe no tecido
v
Valida aproveitamento e colisao
v
Exporta risco/molde
v
Salva historico na nuvem
```

## Fases

### Fase 1 - Core Profissional

- salvar e abrir projeto `.moldelab.json`
- editor com medidas reais
- camadas e pecas organizadas
- digitalizacao mais robusta
- exportacao SVG/PDF

### Fase 2 - Compatibilidade Audaces

- `ads_inspector`
- `amk_inspector`
- importador de `.txt` Audaces
- referencia visual `.wmf`
- validacao de area/perimetro
- parser parcial `.ads` por blocos de peca

### Fase 3 - SaaS

- login
- projetos na nuvem
- planos pagos
- Mercado Pago ou Stripe
- controle de acesso por assinatura

### Fase 4 - Windows

- Tauri ou Electron
- instalador Windows
- abrir/salvar arquivos locais
- integracao com impressao/plotter
- assinatura de app para distribuicao profissional

## Prioridade Atual

Para transformar o prototipo em produto real, a prioridade e:

1. salvar/abrir projeto
2. exportar PDF
3. melhorar digitalizacao
4. iniciar `ads_inspector` e `amk_inspector`
5. criar login/pagamento
6. preparar app Windows
