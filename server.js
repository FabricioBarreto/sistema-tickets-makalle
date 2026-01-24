const https = require("https");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Certificados HTTPS
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "localhost.pem")),
};

// Mapeo de extensiones a MIME types
const mimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
};

app.prepare().then(() => {
  https
    .createServer(httpsOptions, (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        const pathname = parsedUrl.pathname;

        /**
         * ===============================
         *  NEXT.JS maneja TODO
         * ===============================
         * Incluyendo archivos estáticos
         */
        handle(req, res, parsedUrl);
      } catch (error) {
        console.error("Error handling request:", error);
        res.statusCode = 500;
        res.end("Internal server error");
      }
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on https://${hostname}:${port}`);
      console.log(`> Static files will be served from /public`);
    });
});
