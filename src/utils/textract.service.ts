import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetDocumentTextDetectionCommand, StartDocumentTextDetectionCommand, StartDocumentTextDetectionCommandOutput, TextractClient } from "@aws-sdk/client-textract";

@Injectable()
export class TextractService {
    private readonly logger = new Logger(TextractService.name);
    private readonly textractClient: TextractClient;

    constructor(private readonly configService: ConfigService) {
        this.textractClient = new TextractClient({
            region: this.configService.get<string>('AWS_REGION', 'ap-southeast-1'),
            credentials: {
                accessKeyId: this.configService.get<string>('PRI_AWS_ACCESS_KEY'),
                secretAccessKey: this.configService.get<string>('PRI_AWS_SECRET_KEY'),
            },
        });
    }

    async getDocumentBlocks(jobId: string): Promise<{ data: any[]; error: any }> {
        try {
            let nextToken: string | undefined = undefined;
            const allBlocks: any[] = [];
            do {
                const command = new GetDocumentTextDetectionCommand({
                    JobId: jobId,
                    NextToken: nextToken,
                });

                const response = await this.textractClient.send(command);
                if (response.Blocks) {
                    allBlocks.push(...response.Blocks);
                }
                nextToken = response.NextToken;
            } while (nextToken);

            return { data: allBlocks, error: null };
        } catch (error) {
            this.logger.error(`Error getting document blocks for job ${jobId}:`, error);
            return { data: [], error };
        }
    }

    async startTextExtractAsync(params: { fileName: string; bucket: string }): Promise<StartDocumentTextDetectionCommandOutput> {
        try {
            const command = new StartDocumentTextDetectionCommand({
                DocumentLocation: {
                    S3Object: {
                        Bucket: params.bucket,
                        Name: params.fileName,
                    },
                },
            });

            return await this.textractClient.send(command);
        } catch (error) {
            this.logger.error(`Error starting text extraction for ${params.fileName}:`, error);
            throw error;
        }
    }
}
