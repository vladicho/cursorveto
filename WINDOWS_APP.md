# MoldeLab para Windows

O MoldeLab deve existir em duas formas:

- editor web, aberto pelo navegador
- aplicativo nativo Windows, instalado como `.exe` ou `.msi`

## Objetivo

O aplicativo Windows deve manter a experiencia do editor web, mas com recursos
de desktop:

- abrir e salvar projetos locais
- importar arquivos grandes sem depender do navegador
- trabalhar offline
- acessar impressoras e plotters
- integrar motores nativos de geometria, nesting e importacao
- preparar instalador para modelistas e confeccoes

## Caminho recomendado

```text
MoldeLab Web
HTML/CSS/JS
v
Wrapper desktop
Tauri ou Electron
v
App Windows
.exe / .msi
```

Preferencia inicial: **Tauri**.

Motivos:

- mais leve que Electron
- gera executavel Windows
- reaproveita o frontend existente
- integra bem com Rust
- pode chamar bibliotecas C/C++ para parsers e nesting

## Estrutura futura

```text
moldelab/
|-- web/
|   |-- index.html
|   |-- styles.css
|   `-- app.js
|-- native/
|   `-- windows/
|-- core/
|   |-- geometry/
|   |-- importers/
|   `-- nesting/
`-- docs/
```

## Modulos nativos futuros

```text
core/
|-- geometry/
|   |-- point.c
|   |-- polyline.c
|   `-- polygon.c
|-- importers/
|   |-- ads_parser.c
|   |-- dxf_parser.c
|   |-- svg_parser.c
|   `-- plt_parser.c
`-- nesting/
    |-- collision.c
    |-- no_fit_polygon.c
    `-- optimizer.c
```

## Primeiro MVP Windows

1. Empacotar o editor atual como aplicativo.
2. Adicionar abrir/salvar projeto local.
3. Exportar SVG em pasta escolhida pelo usuario.
4. Preparar menu nativo: Arquivo, Importar, Exportar, Ajuda.
5. Depois mover importadores e nesting pesado para `core/`.
