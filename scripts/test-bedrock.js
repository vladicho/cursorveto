process.chdir("/home/ubuntu/cursorveto");
module.paths.unshift("/home/ubuntu/cursorveto/node_modules");

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const models = [
  "us.anthropic.claude-sonnet-4-6-v1:0",
  "us.anthropic.claude-sonnet-4-6",
  "anthropic.claude-3-haiku-20240307-v1:0",
  "us.anthropic.claude-sonnet-4-20250514-v1:0",
  "us.anthropic.claude-3-haiku-20240307-v1:0",
];

async function test(modelId) {
  const client = new BedrockRuntimeClient({ region: "us-east-2" });
  try {
    const cmd = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 30,
        messages: [{ role: "user", content: "Diga oi." }]
      })
    });
    const r = await client.send(cmd);
    const result = JSON.parse(new TextDecoder().decode(r.body));
    console.log("OK " + modelId + ": " + result.content[0].text);
    return true;
  } catch(e) {
    console.log("FAIL " + modelId + ": " + e.name);
    return false;
  }
}

(async () => {
  for (const m of models) {
    if (await test(m)) break;
  }
})();
