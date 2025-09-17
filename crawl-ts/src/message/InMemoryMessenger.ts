import { IRawContent } from "@models/RawContentModel";
import { defaultLogger as logger } from "../utils/logger";

const message_queue : IRawContent[]=[];

export class InMemoryMessenger {
  protected queue: string;
  protected messages = message_queue
  protected isClosed = false;

  constructor(queue: string) {
    this.queue = queue;
  }

  async connect() {
    this.isClosed=false;
    logger.debug(`[InMemory] Connecting with queue ${this.queue}`);
    
  }

  async close() {
    logger.debug(`[InMemory] Closing for queue ${this.queue}`);
    this.isClosed = true;
  }

  async publish(message: any) {
    if (this.isClosed) {
      throw new Error("[InMemory] Messenger is closed");
    }
    this.messages.push(message);
    logger.debug(`[InMemory] Published message to ${this.queue}`, message);
  }


}
