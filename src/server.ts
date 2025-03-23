import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";
import { solanaPlugin } from "@elizaos/plugin-solana";
import express from 'express';
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDbCache } from "./cache/index.ts";
import { character } from "./character.ts";
import { startChat } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import {
  getTokenForProvider,
  loadCharacters,
  parseArguments,
} from "./config/index.ts";
import { initializeDatabase } from "./database/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Main Render port
const RENDER_PORT = process.env.PORT || "3000";

// Utility function for controlled delays
const wait = (minTime: number = 1000, maxTime: number = 3000): Promise<void> => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

// Check if port is available
const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        }
      })
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
};

// Find next available port
const findAvailablePort = async (startPort: number, maxAttempts: number = 10): Promise<number> => {
  let port = startPort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
    attempts++;
  }
  throw new Error(`No available ports found after ${maxAttempts} attempts starting from ${startPort}`);
};

interface WebhookConfig {
  endpoint: string;
  method: 'POST' | 'GET';
  headers?: Record<string, string>;
  retryAttempts?: number;
}

class WebhookAgentRuntime extends AgentRuntime {
  private webhookConfig?: WebhookConfig;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(config: any, webhookConfig?: WebhookConfig) {
    super(config);
    this.webhookConfig = webhookConfig;
    this.maxRetries = webhookConfig?.retryAttempts || 3;
  }

  async sendWebhook(data: any): Promise<void> {
    if (!this.webhookConfig) return;

    try {
      const response = await fetch(this.webhookConfig.endpoint, {
        method: this.webhookConfig.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.webhookConfig.headers,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      this.retryCount = 0;
      elizaLogger.debug(`Webhook sent successfully to ${this.webhookConfig.endpoint}`);
    } catch (error) {
      elizaLogger.warn(`Webhook attempt failed (${this.retryCount + 1}/${this.maxRetries}):`, error);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const backoffTime = 1000 * this.retryCount;
        elizaLogger.debug(`Retrying webhook in ${backoffTime}ms...`);
        await wait(backoffTime, backoffTime);
        return this.sendWebhook(data);
      }
      elizaLogger.warn(`Webhook delivery failed after ${this.maxRetries} attempts:`, error);
    }
  }
}

function createAgent(
  character: Character,
  db: any,
  cache: any,
  token: string,
  webhookConfig?: WebhookConfig
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name,
  );

  const nodePlugin = createNodePlugin();

  return new WebhookAgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [
      bootstrapPlugin,
      nodePlugin,
      character.settings?.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null,
    ].filter(Boolean),
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache,
  }, webhookConfig);
}

async function startAgent(
  character: Character,
  directClient: DirectClient,
  webhookConfig?: WebhookConfig
): Promise<WebhookAgentRuntime> {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const dataDir = path.join(__dirname, "../data");

    fs.mkdirSync(dataDir, { recursive: true });

    const db = initializeDatabase(dataDir);
    await db.init();

    const cache = initializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token, webhookConfig);

    await runtime.initialize();
    runtime.clients = await initializeClients(character, runtime);
    directClient.registerAgent(runtime);

    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);
    
    await runtime.sendWebhook({
      event: 'agent_started',
      character: character.name,
      agentId: runtime.agentId,
      timestamp: new Date().toISOString()
    });

    return runtime;
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
    throw error;
  }
}

const startAgents = async () => {
  try {
    const directClient = new DirectClient();
    const args = parseArguments();
    
    // Setup main web server for Render
    const app = express();
    app.use(express.json());
    
    // Enhanced health check endpoint for Render
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Add webhook endpoint directly to the main app
    app.post('/webhook', (req, res) => {
      elizaLogger.debug('Received webhook:', req.body);
      res.status(200).send('OK');
    });

    // Start the main server first on the Render-assigned port
    const mainServer = app.listen(parseInt(RENDER_PORT), () => {
      elizaLogger.success(`Main server started on port ${RENDER_PORT}`);
    });
    
    // Determine the base URL for webhooks
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? (process.env.RENDER_EXTERNAL_URL || settings.WEBHOOK_URL || `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`)
      : `http://localhost:${RENDER_PORT}`;
    
    // Configure webhook to use the main server's endpoint
    const webhookConfig: WebhookConfig = {
      endpoint: `${baseUrl}/webhook`, 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.WEBHOOK_SECRET || 'default-secret'}`,
        'User-Agent': 'ElizaOS-Agent/1.0',
      },
      retryAttempts: 5
    };

    elizaLogger.success(`Webhook configured at ${webhookConfig.endpoint}`);

    let characters = [character];
    if (args.characters || args.character) {
      characters = await loadCharacters(args.characters || args.character);
    }

    const startedAgents = await Promise.all(
      characters.map(char => startAgent(char, directClient, webhookConfig))
    );

    directClient.startAgent = async (character: Character) => {
      return startAgent(character, directClient, webhookConfig);
    };

    // Find available port for DirectClient (only in development)
    let directClientPort: number;
    if (isProduction) {
      // In production, don't start the DirectClient server separately
      directClientPort = parseInt(RENDER_PORT);
      // Assuming DirectClient does not support direct integration with Express
      elizaLogger.warn('DirectClient does not support registerExpress. Skipping integration.');
      elizaLogger.success(`DirectClient registered with main server on port ${directClientPort}`);
    } else {
      // In development, start DirectClient on a separate port
      const directPort = parseInt(settings.SERVER_PORT || "3002");
      directClientPort = await findAvailablePort(directPort);
      directClient.start(directClientPort);
      elizaLogger.success(`DirectClient started on port ${directClientPort}`);
    }

    const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
    if (!isDaemonProcess && !isProduction) {
      elizaLogger.log("Chat started. Type 'exit' to quit.");
      const chat = startChat(characters);
      chat();
    }

    // Add graceful shutdown for all servers
    process.on('SIGTERM', async () => {
      elizaLogger.log('Received SIGTERM. Performing graceful shutdown...');
      mainServer.close();
      process.exit(0);
    });

    return startedAgents;
  } catch (error) {
    elizaLogger.error("Error in startAgents:", error);
    process.exit(1);
  }
};

// Error handlers
process.on('uncaughtException', (error) => {
  elizaLogger.error('Uncaught Exception:', error);
  process.exit(1);
});

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});