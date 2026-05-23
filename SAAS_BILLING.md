# Login, Assinaturas e Pagamento

O MoldeLab web deve ser vendido como SaaS, com acesso por usuario e senha,
planos pagos e pagamento com cartao de credito.

## Objetivos

- permitir cadastro de usuarios
- permitir login com email e senha
- proteger projetos e arquivos de cada usuario
- liberar recursos por plano
- aceitar pagamento com cartao de credito
- bloquear acesso quando a assinatura estiver vencida/cancelada
- manter historico de pagamentos e status da conta

## Arquitetura Recomendada

```text
Frontend MoldeLab
|
|-- Login / Cadastro
|-- Area do editor
|-- Tela de planos
|-- Tela de assinatura

Backend API
|
|-- auth
|-- users
|-- projects
|-- subscriptions
|-- billing webhooks

Banco de dados
|
|-- users
|-- projects
|-- plans
|-- subscriptions
|-- payments

Gateway de pagamento
|
|-- Stripe
|-- Mercado Pago
|-- Pagar.me
```

## Pagamento

O site nao deve processar dados sensiveis do cartao diretamente. O correto e
usar checkout seguro do provedor de pagamento.

Fluxo:

```text
Usuario escolhe plano
v
Frontend cria sessao de checkout
v
Gateway recebe dados do cartao
v
Gateway confirma pagamento por webhook
v
Backend atualiza assinatura
v
MoldeLab libera acesso
```

## Protecao Contra Cobranca Duplicada

O botao de pagar deve ser protegido contra duplo clique. Um usuario nao pode
ser cobrado duas vezes se clicar no botao rapidamente ou se a rede repetir a
requisicao.

Regra obrigatoria no frontend:

```text
Usuario clica pagar
v
Botao entra em loading
v
Botao fica disabled
v
Cliques seguintes sao ignorados
v
Frontend aguarda resposta da API
```

Regra obrigatoria no backend:

```text
Recebe tentativa de checkout
v
Usa order_id/payment_attempt_id/idempotency_key
v
Se tentativa ja existe, retorna a mesma sessao
v
Se tentativa nao existe, cria uma nova sessao
v
Nunca cria duas cobrancas para o mesmo pedido
```

Campos recomendados:

```sql
checkout_attempts
- id
- user_id
- plan_id
- order_id
- idempotency_key
- provider
- provider_checkout_id
- status
- created_at
- updated_at
```

No webhook, o backend tambem deve ser idempotente:

- se o mesmo evento chegar duas vezes, processar uma vez so
- salvar `provider_event_id`
- nao liberar assinatura duplicada
- nao criar pagamento duplicado
- registrar eventos repetidos como ignorados

Essa protecao deve existir mesmo usando Mercado Pago, Stripe ou outro gateway.
Desabilitar o botao no frontend ajuda a experiencia, mas a garantia real fica
no backend.

## Planos Possiveis

```text
Free / Teste
- abrir editor
- criar poucos projetos
- exportacao limitada

Pro
- projetos ilimitados
- importar SVG/DXF/PLT
- digitalizacao por imagem
- exportar SVG/DXF/PDF

Studio
- multiusuario
- biblioteca compartilhada
- nesting avancado
- suporte prioritario
```

## Banco de Dados Inicial

```sql
users
- id
- name
- email
- password_hash
- created_at

projects
- id
- user_id
- name
- data_json
- created_at
- updated_at

plans
- id
- name
- price
- limits_json

subscriptions
- id
- user_id
- plan_id
- provider
- provider_subscription_id
- status
- current_period_end

payments
- id
- user_id
- provider
- provider_payment_id
- amount
- status
- created_at
```

## Seguranca

- nunca salvar numero de cartao no banco
- salvar senha somente com hash forte
- usar HTTPS em producao
- validar webhooks do provedor de pagamento
- separar projetos por `user_id`
- bloquear exportacoes pagas no backend, nao apenas no frontend
- manter logs de eventos de assinatura

## Implementacao Recomendada

Primeira versao:

```text
Next.js ou React frontend
Node.js/NestJS ou FastAPI backend
PostgreSQL
Stripe ou Mercado Pago
JWT/session cookies
S3/R2 para arquivos futuros
```

No Brasil, Mercado Pago ou Pagar.me podem ser boas opcoes. Para alcance
internacional e assinaturas recorrentes, Stripe costuma ser o caminho mais
simples tecnicamente.
