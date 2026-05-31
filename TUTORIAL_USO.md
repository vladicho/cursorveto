# Tutorial de uso do MoldeLab

Este guia mostra o fluxo basico para usar o MoldeLab no navegador.

## 1. Abrir o editor

No Render, abra a URL principal do servico `moldelab`.

No Windows/local, execute:

```text
abrir-moldelab.cmd
```

Depois abra:

```text
http://localhost:8787
```

O deploy atual pula login, entao o editor abre direto.

## 2. Conhecer a tela

- **Arquivo**: abrir projeto, importar vetor e exportar arquivos.
- **Tecido**: configurar largura, tipo de tecido, grade e encaixe automatico.
- **Modo**: escolher mover, editar pontos, desenhar, calibrar, digitalizar, pan e medir.
- **Digitalizacao**: importar foto, usar camera, scanner pelo celular, ArUco e scikit-image.
- **Editar**: desfazer, refazer, copiar, colar, fechar contorno e criar peca.
- **Peca**: nome, modelo, tamanho, cor, margem de costura, fio, piques e bloqueio.

O canvas branco e a area onde ficam o tecido, as pecas e a imagem digitalizada.

## 3. Criar uma peca manual

1. Abra o menu **Modo**.
2. Clique em **Desenhar**.
3. Clique no canvas para marcar os pontos do molde.
4. Quando terminar o contorno, abra **Editar**.
5. Clique em **Fechar contorno**.

A peca vira um molde vetorial editavel.

## 4. Editar pontos da peca

1. Selecione a peca.
2. Abra **Modo**.
3. Clique em **Pontos**.
4. Arraste pontos no canvas.
5. Use **Peca > Apagar ponto** para remover um ponto selecionado.

Tambem da para mover a peca inteira usando o modo **Mover**.

## 5. Importar vetor

1. Abra **Arquivo**.
2. Em **Importar vetor**, escolha um arquivo `.svg`, `.dxf` ou `.plt`.
3. O MoldeLab cria pecas a partir dos caminhos encontrados.

O suporte a `.ads` ainda precisa de amostras reais do Audaces para mapear a geometria.

## 6. Digitalizar por imagem

1. Abra **Digitalizacao**.
2. Em **Foto ou scan do molde**, selecione uma imagem.
3. O app entra no modo **Calibrar**.
4. Informe a **Medida de referencia (cm)**.
5. Clique dois pontos da imagem que correspondem a essa medida real.
6. Depois use **Digitalizar** para marcar pontos manualmente ou **Auto digitalizar** para criar o contorno automatico.

Para melhores resultados, use foto com boa luz, fundo contrastante e molde inteiro visivel.

## 7. Digitalizar com camera

1. Abra **Digitalizacao**.
2. Clique em **Abrir camera**.
3. Posicione o molde inteiro.
4. Clique em **Capturar**.
5. Calibre a escala ou use **Auto digitalizar**.

Em alguns navegadores, camera so funciona em HTTPS ou `localhost`.

## 8. Scanner pelo celular

1. Rode o app pelo servidor local ou Render.
2. Abra **Digitalizacao**.
3. Veja o QR Code do scanner.
4. Leia o QR Code no celular.
5. No celular, enquadre o molde.
6. No desktop, clique em **Capturar do celular**.

O celular envia o frame para o editor, e a imagem fica pronta para calibrar ou auto digitalizar.

## 9. Usar ArUco

O ArUco serve para calibrar escala automaticamente usando um marcador impresso.

1. Imprima um marcador ArUco ou um quadrado preto bem contrastado.
2. Coloque o marcador na foto junto com o molde.
3. Abra **Digitalizacao**.
4. Informe o tamanho real em **Marcador ArUco (cm)**.
5. Clique em **Detectar ArUco**.
6. Depois use **Auto digitalizar**.

Se escolher o motor **ArUco + OpenCV**, o app tenta calibrar pelo marcador antes de criar o contorno.

## 10. Usar scikit-image

O modo **scikit-image** usa o microservico Python `moldelab-skimage`.

1. Abra **Digitalizacao**.
2. Importe ou capture uma imagem.
3. Em **Motor de digitalizacao**, escolha **scikit-image**.
4. Clique em **Auto digitalizar**.

No Render free, o microservico pode dormir. A primeira tentativa pode demorar um pouco. Se ele falhar, o app usa fallback local no navegador.

## 11. Configurar tecido

1. Abra **Tecido**.
2. Escolha **Plano** ou **Tubular**.
3. Informe a largura do tecido.
4. Ajuste a margem entre pecas.
5. Ative ou desative grade conforme precisar.

Essas medidas influenciam o encaixe e as exportacoes.

## 12. Encaixe automatico

1. Crie ou importe as pecas.
2. Configure largura do tecido e margem.
3. Abra **Tecido**.
4. Defina o **Tempo do encaixe (s)**.
5. Clique em **Encaixe automatico**.

O app testa combinacoes e aplica o melhor encaixe encontrado. Use **Interromper encaixe** para parar antes do tempo.

## 13. Exportar arquivos

No menu **Arquivo**, use:

- **Salvar projeto**: salva `.moldelab.json`.
- **Exportar SVG**: gera arquivo vetorial.
- **Exportar DXF**: gera arquivo para CAD.
- **Exportar PLT**: gera arquivo HPGL/plotter.
- **Mini risco JPG**: gera imagem do encaixe.

Antes de exportar, confira se nao ha colisao entre pecas ou peca fora da largura do tecido.

## 14. Dicas rapidas

- Use **Ctrl+S** para salvar projeto.
- Use **Ctrl+Z** para desfazer.
- Use **Delete** para apagar ponto ou peca selecionada.
- Use **F** para ajustar a tela.
- Use **G** para mostrar ou ocultar grade.
- Use clique direito no canvas ou na peca para abrir menu contextual.

## 15. Fluxo recomendado

1. Configure o tecido.
2. Importe ou digitalize as pecas.
3. Ajuste pontos e nomes das pecas.
4. Defina modelo, tamanho, cor e margem de costura.
5. Rode o encaixe automatico.
6. Confira colisao, largura e cabecalho.
7. Exporte SVG, DXF, PLT ou mini risco.
