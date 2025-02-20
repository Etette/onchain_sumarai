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
import fs from "fs";
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

class WebhookAgentRuntime extends AgentRuntime {
  private webhookUrl: string;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(config: any, webhookUrl: string) {
    super(config);
    this.webhookUrl = webhookUrl;
  }

  async sendWebhook(data: any): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      this.retryCount = 0;
      elizaLogger.debug('Webhook sent successfully:', data);
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
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
  webhookUrl: string
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
  }, webhookUrl);
}

async function startAgent(
  character: Character,
  directClient: DirectClient,
  webhookUrl: string
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
    const runtime = createAgent(character, db, cache, token, webhookUrl);

    await runtime.initialize();
    runtime.clients = await initializeClients(character, runtime);
    directClient.registerAgent(runtime);

    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);
    
    // Notify webhook about agent start
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

    // Get webhook URL from environment or settings
    const webhookUrl = process.env.WEBHOOK_URL || settings.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL is required but not provided');
    }

    let characters = [character];
    if (args.characters || args.character) {
      characters = await loadCharacters(args.characters || args.character);
    }

    const startedAgents = await Promise.all(
      characters.map(char => startAgent(char, directClient, webhookUrl))
    );

    directClient.startAgent = async (character: Character) => {
      return startAgent(character, directClient, webhookUrl);
    };

    const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
    if (!isDaemonProcess) {
      elizaLogger.log("Chat started. Type 'exit' to quit.");
      const chat = startChat(characters);
      chat();
    }

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

process.on('SIGTERM', () => {
  elizaLogger.log('Received SIGTERM. Shutting down...');
  process.exit(0);
});

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});