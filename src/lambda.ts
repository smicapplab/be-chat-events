import { NestFactory } from '@nestjs/core';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SqsUtil } from './utils/sqs-util';

let cachedApp: INestApplicationContext;
const logger = new Logger('LambdaHandler');

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.createApplicationContext(AppModule);
    cachedApp = app;
  }
  return cachedApp;
}

export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    const app = await bootstrap();
    const sqsUtil = app.get(SqsUtil);

    if (!event.Records || event.Records.length === 0) {
      logger.warn('No records found in SQS event');
      return { message: "No records to process" };
    }

    // Process all records and wait for them to finish
    // Note: In production, you might want to handle partial failures
    for (const record of event.Records) {
      try {
        const messageBody = JSON.parse(record.body);
        const { action, data = {} } = messageBody;
        await sqsUtil.handleSQSMessage(action, data);
      } catch (recordError) {
        logger.error(`Failed to process record ${record.messageId}`, recordError);
        throw recordError; // Rethrow to mark the whole batch as failed (standard SQS behavior)
      }
    }

    return { message: "Success" };
  } catch (error) {
    logger.error('Critical error in lambda handler:', error);
    // Rethrowing allows AWS SQS to handle retries and DLQ
    throw error;
  }
};