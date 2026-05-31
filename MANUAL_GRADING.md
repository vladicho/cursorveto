# Graduacao Manual de Tamanhos

O MoldeLab nao promete graduacao automatica perfeita. Em modelagem de vestuario,
cada regiao do molde pode crescer de forma diferente. Por isso, a abordagem e
**graduacao manual assistida**.

## Ferramenta Atual

No menu **Peca**, o usuario pode:

- selecionar um ponto no modo **Pontos**
- escolher o **Passo graduacao (cm)**
- mover o ponto para **cima**, **baixo**, **esquerda** ou **direita**

Esse fluxo replica a ideia de graduacao por deslocamento manual de pontos. O
modelista continua decidindo quais pontos crescem e quanto crescem.

## Fluxo Esperado

```text
Criar tamanho base
v
Duplicar peca ou projeto
v
Renomear a copia com o novo tamanho
v
Selecionar pontos importantes
v
Aplicar deslocamentos manuais por direcao
v
Salvar tamanho
v
Repetir ate completar a grade
```

## Por Que Manual

Ampliar ou reduzir um molde raramente e proporcional em todos os pontos.
Ombro, cava, lateral, cintura, barra e gancho podem exigir regras diferentes.
A ferramenta ajuda a aplicar deslocamentos tecnicos, mas nao decide a regra pelo
usuario.

## O Que o Sistema Apoia

- duplicar peca
- renomear peca com tamanho
- editar pontos por arraste
- editar pontos pelo teclado
- editar pontos pelos botoes de graduacao
- salvar projeto `.moldelab.json`
- visualizar pecas e tamanhos lado a lado
- encaixar as pecas graduadas manualmente

## Exemplo

```text
Short tamanho 38
Short tamanho 40
Short tamanho 42
```

Cada tamanho pode ser uma copia da peca base com pontos ajustados manualmente.

## Futuro

Uma tabela de regras por ponto pode ser estudada depois. O primeiro passo e
garantir que o usuario tenha controle fino por direcao e por centimetro.
