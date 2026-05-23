# Arquitetura de Importadores

O MoldeLab deve trabalhar com compatibilidade parcial dos formatos de modelagem.
O foco inicial e importar geometria, curvas e medidas. Metadados proprietarios,
regras internas e automacoes especificas de outros sistemas podem ser ignorados.

## Formatos

Importar:

- `.ads` Audaces 7, quando houver amostras suficientes para mapear geometria
- `.amk` Audaces Encaixe 7, para recuperar posicionamento das pecas no risco
- `.dxf` para interoperabilidade CAD
- `.svg` para vetor web
- `.plt` para plotter/risco

Exportar:

- `.dxf`
- `.svg`
- `.pdf`

## Camada de Importacao

```text
Import Layer
├── ads_parser.c
├── dxf_parser.c
├── svg_parser.c
├── plt_parser.c
└── internal_geometry.c
```

No prototipo web atual:

- SVG cria pecas internas a partir de `polygon`, `polyline` e `path` simples
  com comandos `M`, `L`, `H`, `V` e `Z`.
- DXF importa `LWPOLYLINE`, `POLYLINE`/`VERTEX` e `LINE` simples.
- PLT importa caminhos HPGL basicos com `PU`, `PD` e `PA`.
- ADS fica como parser experimental dependente de amostras reais do Audaces 7.
- AMK fica como parser experimental para encaixes/markers do Audaces.

## Estrutura Interna

```c
typedef struct {
    float x;
    float y;
} Point;

typedef struct {
    Point *points;
    int count;
} Polyline;
```

No editor, cada `Polyline` vira uma peca vetorial. A renderizacao, encaixe,
edicao de pontos e exportacao trabalham sobre essa geometria interna.

## Estrategia para ADS

`.ads` deve ser tratado como importador experimental. O primeiro objetivo nao e
replicar todo o Audaces, mas recuperar contornos, piques, curvas e medidas
basicas. Para isso, precisamos analisar arquivos reais exportados do Audaces 7.

A amostra `CALCA JEANS MASC.ads` confirmou a assinatura `CADZ vs6.0`, imagem
JPEG embutida no cabecalho, bloco `LIG` apos a imagem e nomes das pecas em
blocos separados. O mesmo modelo tambem possui `.txt` com metadados/medidas e
`.wmf` com visual vetorial, formando o principal conjunto de validacao.

Conjunto principal de validacao:

```text
CALCA JEANS MASC.ads  -> geometria binaria e nomes das pecas
CALCA JEANS MASC.txt  -> tamanhos, areas e perimetros oficiais
CALCA JEANS MASC.wmf  -> visual vetorial para conferencia
```

Fluxo ideal:

```text
Arquivo .ads
↓
Parser experimental
↓
Geometria interna
↓
Editor MoldeLab
↓
Exportacao DXF/SVG/PDF
```

## Estrategia para AMK

Arquivos `.amk` do Audaces Encaixe 7 parecem guardar o risco/marker. A amostra
`SHORT SURF FEM.amk` comeca com a assinatura `AUDENC32 7.0`, referencia o
arquivo `.ads` original e contem grade de tamanhos, nomes de pecas e muitos
valores numericos que parecem coordenadas e posicionamentos.

Objetivo inicial do parser `.amk`:

```text
Arquivo .amk
↓
Cabecalho AUDENC32 7.0
↓
Referencia ao .ads
↓
Largura/comprimento do encaixe
↓
Lista de pecas posicionadas
↓
Coordenadas, rotacao e espelhamento
↓
Renderizacao do risco no MoldeLab
```

Esse parser deve trabalhar junto com o `.ads`: o `.ads` fornece a geometria da
peca, e o `.amk` fornece onde cada peca foi colocada no tecido.
