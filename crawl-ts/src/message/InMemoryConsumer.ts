import { InMemoryMessenger } from "./InMemoryMessenger";
import { defaultLogger as logger } from "../utils/logger";
import { IRawContent } from "@models/RawContentModel";
import { timeoutAfter } from "@browser/ChromeBrowserManager";

export class InMemoryConsumer extends InMemoryMessenger {
  private isConsuming = false;

async consume(
    onMessage: (msg: IRawContent) => Promise<void>,
    { delay = 100 }: { delay?: number } = {}
  ) {
    logger.info(`[InMemory] Start consuming from ${this.queue}`);

    (async () => {
      while (this.isConsuming) {
        logger.info(`[InMemory] Message processed from ${this.queue}`);
        const msg = this.messages.shift();
        logger.info(`[InMemory] Message processed from ${msg}`);
        if (msg) {
          try {
            logger.info(`[InMemory] Message processed from ${this.queue}`);
            await timeoutAfter(onMessage(msg),120_000,Error("Message를 parsing하는데 시간을 초과했습니다."));
          } catch (err) {
            if (err instanceof Error){
                logger.error(err.name+ err.message);
            }
            // 재시도용으로 다시 큐에 삽입
            this.messages.push(msg);
          }
        }
        await new Promise((res) => setTimeout(res, delay));
      }
    })();
  }
  async handleLiveMessage(
    onMessage: (msg: any) => Promise<void>,
    delay: number = 1000
  ): Promise<string> {
    this.isConsuming = true;
    logger.info(`[InMemory] Start consuming from ${this.queue}`);
    this.consume(onMessage, { delay });

    return "in-memory-consumer";
  }

  async stop(): Promise<void> {
    this.isConsuming = false;
    await this.close();
  }

   async run(): Promise<void> {
    this.isConsuming =true;
  }
  
}