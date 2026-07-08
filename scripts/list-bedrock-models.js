process.chdir("/home/ubuntu/cursorveto");
module.paths.unshift("/home/ubuntu/cursorveto/node_modules");

const { BedrockClient, ListFoundationModelsCommand } = require("@aws-sdk/client-bedrock");

async function main() {
  const client = new BedrockClient({ region: "us-east-2" });
  const result = await client.send(new ListFoundationModelsCommand({ byProvider: "Anthropic" }));
  for (const m of result.modelSummaries) {
    console.log(m.modelId);
  }
}

main().catch(e => console.error("ERRO:", e.name, e.message));
