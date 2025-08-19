import  { ConsumeMessage } from 'amqplib';
import { Messenger } from './Messenger';
import { defaultLogger as logger } from '../utils/logger';


export class Consumer extends Messenger{

  constructor(queue: string) {
    super(queue);
  }



 async handleLiveMessage( onMessage: (msg : ConsumeMessage| null  )=> Promise<void> ,delay :number =1000): Promise<void> {

  if (!this.channel) {
    logger.error('[RabbitMQ] Channel is not initialized. Call connect() first.');
    throw new Error('[RabbitMQ] Channel is not initialized. Call connect() first.');
  }

   this.channel.prefetch(1);

  console.log(" [*] Waiting for messages in %s. To exit press CTRL+C",);
 await this.channel.consume(this.queue, async (msg) => {
  if (!msg) return;

  try {
    await onMessage(msg);
    // ack 즉시 or 지연
    if(!this.channel){
      return;
    }
 
    this.channel!.ack(msg);
    
  } catch (err) {
    if (this.channel && this.channel.connection) {
      // this.channel.nack(msg, false, false);
    } else {
      logger.warn("Channel already closed, message cannot be nacked");
      // 이 경우는 DLQ에 의존하는 게 안전
    }
  }
}, { noAck: false });

}

}