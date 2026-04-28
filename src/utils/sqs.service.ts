import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

@Injectable()
export class SqsService {
    private readonly logger = new Logger(SqsService.name);
    private readonly sqsClient: SQSClient;

    constructor(private readonly configService: ConfigService) {
        this.sqsClient = new SQSClient({
            region: this.configService.get<string>('AWS_REGION', 'ap-southeast-1'),
            credentials: {
                accessKeyId: this.configService.get<string>('PRI_AWS_ACCESS_KEY'),
                secretAccessKey: this.configService.get<string>('PRI_AWS_SECRET_KEY'),
            },
        });
    }

    async sendSQSMessage(
        dto: any,
        action: string,
        queueUrl: string,
        delaySeconds?: number
    ): Promise<boolean> {
        try {
            const params = {
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                    action,
                    data: dto
                }),
                ...(delaySeconds ? { DelaySeconds: delaySeconds } : {}),
            };

            await this.sqsClient.send(new SendMessageCommand(params));
            return true;
        } catch (error) {
            this.logger.error(`Error sending SQS message to ${queueUrl}:`, error);
            throw error;
        }
    }
}
