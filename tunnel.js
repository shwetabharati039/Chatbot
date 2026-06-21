const localtunnel = require("localtunnel");

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000, subdomain: "nova-chatbot-" + Date.now().toString(36) });
    const msg = "\n  Public URL: " + tunnel.url + "\n  Share this URL with anyone to use the chatbot.\n";
    console.log(msg);
    require("fs").writeFileSync("public-url.txt", tunnel.url, "utf-8");
    tunnel.on("error", (err) => console.error("Tunnel error:", err.message));
  } catch (err) {
    console.error("Failed:", err.message);
    try {
      const tunnel = await localtunnel({ port: 3000 });
      const msg = "\n  Public URL: " + tunnel.url + "\n  Share this URL with anyone to use the chatbot.\n";
      console.log(msg);
      require("fs").writeFileSync("public-url.txt", tunnel.url, "utf-8");
    } catch (err2) {
      console.error("Still failed:", err2.message);
    }
  }
})();
