import { IRawContent } from "@models/RawContentModel";
import { defaultLogger as logger } from "../utils/logger";
import { InMemoryMessenger } from "./InMemoryMessenger";

export class InMemoryProducer extends InMemoryMessenger {
  constructor(queue: string) {
    super(queue);
  }

  async sendMessage(message: IRawContent) {
    if (this.isClosed) {
      throw new Error("[InMemoryProducer] Messenger is closed");
    }

    // 메시지를 큐에 넣음
    this.messages.push(message);

    logger.info(
      `[InMemoryProducer] Sent message to ${this.queue}: ${JSON.stringify(
        message
      )}`
    );
      logger.eventInfo(
      `[InMemoryProducer] Sent message to ${this.messages.length}: ${JSON.stringify(
        message
      )}`
    );
  }
}
