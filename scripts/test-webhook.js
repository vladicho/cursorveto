process.chdir("/home/ubuntu/cursorveto");
module.paths.unshift("/home/ubuntu/cursorveto/node_modules");

const http = require("http");

// Simula o payload que a Meta envia quando alguém manda mensagem
const webhookPayload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{
    id: "TEST",
    changes: [{
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "5511981692038", phone_number_id: "1110907578783483" },
        messages: [{
          from: "5511999999999",
          id: "wamid.test123",
          timestamp: Math.floor(Date.now() / 1000).toString(),
          text: { body: "Oi, quero criar um molde de blusa feminina" },
          type: "text"
        }]
      },
      field: "messages"
    }]
  }]
});

const req = http.request({
  hostname: "localhost",
  port: 8787,
  path: "/webhook/whatsapp",
  method: "POST",
  headers: { "Content-Type": "application/json" }
}, (res) => {
  let data = "";
  res.on("data", (c) => { data += c; });
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Resposta:", data);
    // Esperar 5s para o processamento em background
    setTimeout(() => {
      console.log("(verifique pm2 logs para ver se o Bedrock respondeu)");
      process.exit(0);
    }, 5000);
  });
});
req.write(webhookPayload);
req.end();
