process.chdir("/home/ubuntu/cursorveto");
module.paths.unshift("/home/ubuntu/cursorveto/node_modules");

const http = require("http");

const payload = JSON.stringify({
  system: "Responda em portugues, curto.",
  messages: [{ role: "user", content: "Oi, tudo bem?" }]
});

const req = http.request({
  hostname: "localhost",
  port: 8787,
  path: "/api/chat",
  method: "POST",
  headers: { "Content-Type": "application/json" }
}, (res) => {
  let data = "";
  res.on("data", (c) => { data += c; });
  res.on("end", () => {
    try {
      const j = JSON.parse(data);
      if (j.content) {
        console.log("OK:", j.content[0].text);
      } else {
        console.log("RESPOSTA:", data.substring(0, 300));
      }
    } catch {
      console.log("RAW:", data.substring(0, 300));
    }
  });
});
req.write(payload);
req.end();
