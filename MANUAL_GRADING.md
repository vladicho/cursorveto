# Grade Manual de Tamanhos

O MoldeLab nao tera ampliacao/reducao automatica como recurso principal.

Se o usuario quiser criar uma grade de tamanhos, ele deve editar manualmente
cada tamanho do molde e salvar o resultado. Isso evita prometer uma gradação
automatica incorreta.

## Regra de Produto

```text
Sem ampliacao/reducao automatica no MVP.
```

Fluxo esperado:

```text
Criar tamanho base
v
Duplicar peca ou projeto
v
Editar pontos manualmente
v
Salvar tamanho
v
Repetir ate completar a grade requerida
```

## Por Que Manual

Em modelagem de vestuario, ampliar/reduzir nem sempre e proporcional. Cada
regiao do molde pode exigir ajuste diferente. Por isso, no MVP o usuario deve
ter controle manual sobre os pontos.

## O Que o Sistema Deve Apoiar

- duplicar peca
- renomear peca com tamanho
- editar pontos
- salvar projeto `.moldelab.json`
- visualizar pecas/tamanhos lado a lado
- encaixar as pecas criadas manualmente

## Exemplo

```text
Short tamanho 38
Short tamanho 40
Short tamanho 42
```

Cada tamanho pode ser uma peca editada e salva manualmente pelo usuario.

## Futuro

Gradação automatica pode ser estudada depois, mas nao deve ser promessa inicial
do produto.
