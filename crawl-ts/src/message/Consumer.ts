import  { ConsumeMessage } from 'amqplib';
import { Messenger } from './Messenger';
import { defaultLogger as logger } from '../utils/logger';


export class Consumer extends Messenger{

  private consumerTag?: string;
  constructor(queue: string) {
     super(queue);
  }



 async handleLiveMessage( onMessage: (msg : ConsumeMessage| null  )=> Promise<void> ,delay :number =1000): Promise<string> {

  if (!this.channel) {
    logger.error('[RabbitMQ] Channel is not initialized. Call connect() first.');
    throw new Error('[RabbitMQ] Channel is not initialized. Call connect() first.');
  }

   
   this.channel.prefetch(1);

   console.log(" [*] Waiting for messages in %s. To exit press CTRL+C",);
   const { consumerTag } = await this.channel.consume(this.queue, async (msg) => {
   if (!msg) return;

    try {
      const timeoutMs = 600000;
      
      await Promise.race([
       onMessage(msg), // 실제 메시지 처리
          new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout processing message")), timeoutMs)
        )
      ]);
      
      // ack 즉시 or 지연
      if(!this.channel){
        return;
      }
  
      this.channel!.ack(msg);
      
    } catch (err) {
      if (this.channel && this.channel.connection) {
        await this.channel.assertQueue(this.queue, { durable: true });
        this.channel.nack(msg, false, true);
      } else {
        logger.warn("Channel already closed, message cannot be nacked");
        // 이 경우는 DLQ에 의존하는 게 안전
      }
    }
  }, { noAck: false });

  this.consumerTag =consumerTag
  return consumerTag

}

  async stop(): Promise<void> {
    if (!this.channel) {
      logger.warn("[RabbitMQ] No channel to stop consumer from.");
      return;
    }
    if (!this.consumerTag) {
      logger.warn("[RabbitMQ] No consumerTag to cancel.");
      return;
    }
    await this.channel.cancel(this.consumerTag);
    logger.info(`[RabbitMQ] Consumer stopped. consumerTag=${this.consumerTag}`);
    this.consumerTag = undefined;
  }

}