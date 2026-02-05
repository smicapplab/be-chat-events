import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SqsUtil } from './utils/sqs-util';

let app: any;

async function bootstrap() {
  app = await NestFactory.create(AppModule);
  await app.init();
}

export const handler = async (event: any, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    if (!app) {
      await bootstrap();
    }

    const sqsUtil = app.get(SqsUtil);

    // SQS Requests
    if (event.Records && event.Records.length > 0) {
      const sqsMessage = event.Records[0];
      const messageBody = JSON.parse(sqsMessage.body);
      const { action, data = {} } = messageBody;
      const response = await sqsUtil.handleSQSMessage(action, data)
      return response;
    }

    return { message: "Unknown Queue triggered!!!!!" };
  } catch (error) {
    console.error('Error in lambda handler:', error);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      }),
    };
  }
};