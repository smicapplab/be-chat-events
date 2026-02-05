import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export class SqsClientUtil {

    static getSqsCLient = () => {
        const sqsClient = new SQSClient({
            region: "ap-southeast-1",
            credentials: {
                accessKeyId: process.env.PRI_AWS_ACCESS_KEY,
                secretAccessKey: process.env.PRI_AWS_SECRET_KEY,
            },
        });
        return sqsClient;
    };

    static async sendSQSMessage(
        dto: any,
        action: string,
        queueUrl: string,
        delaySeconds?: number
    ): Promise<Boolean> {
        try {
            const sqsClient = this.getSqsCLient();
            const params = {
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                    action,
                    data: dto
                }),
                ...(delaySeconds ? { DelaySeconds: delaySeconds } : {}),
            };

            await sqsClient.send(new SendMessageCommand(params));
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}