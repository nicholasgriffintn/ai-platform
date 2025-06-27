import { Container } from "@cloudflare/containers";

export class NLPAgent extends Container {
  defaultPort = 8080;
  enableInternet = false;
  sleepAfter = "5m";

  onError(error: unknown) {
    console.log("NLP Agent error:", {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      container: "nlp-agent",
    });
  }

  onStart() {
    console.log("NLP Agent started successfully", {
      timestamp: new Date().toISOString(),
      port: this.defaultPort,
      internetEnabled: this.enableInternet,
    });
  }

  onStop() {
    console.log("NLP Agent stopped", {
      timestamp: new Date().toISOString(),
      container: "nlp-agent",
    });
  }
}

export class WebAgent extends Container {
  defaultPort = 8080;
  enableInternet = true; // Needs internet for web scraping
  sleepAfter = "5m";

  onError(error: unknown) {
    console.log("Web Agent error:", {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      container: "web-agent",
    });
  }

  onStart() {
    console.log("Web Agent started successfully", {
      timestamp: new Date().toISOString(),
      port: this.defaultPort,
      internetEnabled: this.enableInternet,
    });
  }

  onStop() {
    console.log("Web Agent stopped", {
      timestamp: new Date().toISOString(),
      container: "web-agent",
    });
  }
}
