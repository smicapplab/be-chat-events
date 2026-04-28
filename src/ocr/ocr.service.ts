import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';
import { S3Service } from '../utils/s3.service';
import { TextractService } from '../utils/textract.service';
import { SqsService } from '../utils/sqs.service';
import { GenerateContentDto, OcrAnalysisDto, RecoverErrorsDto } from './dto/ocr.dto';

const OcrResponseSchema = z.object({
    summary: z.string().describe("Summarize the content of the page in 2–3 sentences."),
    qa: z.array(z.object({
        q: z.string().describe("customer-style question"),
        a: z.string().describe("document-based answer")
    })).describe("Generate up to 20 relevant customer-style question-and-answer pairs.")
});

@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);
    private readonly bucket: string;
    private readonly openai: OpenAI;
    private readonly chatQueue: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly databaseService: DatabaseService,
        private readonly s3Service: S3Service,
        private readonly textractService: TextractService,
        private readonly sqsService: SqsService,
    ) {
        this.bucket = this.configService.get<string>('AWS_PORTAL_BUCKET');
        this.chatQueue = this.configService.get<string>('SQS_CHAT_QUEUE');
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    async getDocExtractByJobId(jobId: string) {
        const knex = this.databaseService.getKnex();
        return await knex('doc_extract')
            .select('id', 'doc_training_id', 'status', 'file_name', 'blocks')
            .where('job_id', jobId)
            .first();
    }

    private extractTextSimple(blocks: any[]): string {
        if (!blocks || blocks.length === 0) return '';
        return blocks
            .filter((block) => block.BlockType === 'LINE' && block.Text)
            .map((block) => block.Text.trim())
            .join('\n');
    }

    private async processDocument(text: string, description: string) {
        try {
            const completion = await this.openai.beta.chat.completions.parse({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI assistant helping a mortgage company build a chatbot. 
                        You will receive text from one page of a ${description ?? 'mortgage document'}.
                        Generate a summary and relevant Q&A pairs. Only use provided text. Do not invent answers.`
                    },
                    { role: 'user', content: text }
                ],
                response_format: zodResponseFormat(OcrResponseSchema, "ocr_response"),
                temperature: 0.3,
            });

            return completion.choices[0].message.parsed;
        } catch (error) {
            this.logger.error("Error classifying document with OpenAI:", error);
            throw error;
        }
    }

    async getDocumentAnalysis(props: OcrAnalysisDto) {
        const { jobId, docTrainingId, description } = props;
        const knex = this.databaseService.getKnex();
        try {
            const docExtract = await this.getDocExtractByJobId(jobId);
            const { data, error } = await this.textractService.getDocumentBlocks(jobId);
            
            const fileName = `chat-json-blocks/${docTrainingId}/${docExtract.id}.blocks.json`;
            const buffer = Buffer.from(JSON.stringify(data));
            
            await this.s3Service.uploadDocument(this.bucket, fileName, buffer, "application/json");

            await knex('doc_extract')
                .where('id', docExtract.id)
                .update({
                    status: error ? "FAILED" : "PARTIAL:BLOCKS",
                    blocks: fileName,
                });

            await this.sqsService.sendSQSMessage(
                { jobId, docTrainingId, description },
                "generate-content",
                this.chatQueue,
            );

            return { data: `Blocks Saved: ${jobId}` };
        } catch (error) {
            this.logger.error(`Document analysis failed for jobId ${jobId}:`, error);
            return { success: false, error };
        }
    }

    async generateContent(props: GenerateContentDto) {
        const { jobId, docTrainingId, description } = props;
        const knex = this.databaseService.getKnex();
        try {
            const docExtract = await this.getDocExtractByJobId(jobId);
            const blocks = await this.s3Service.readJsonFileFromS3(this.bucket, docExtract.blocks);
            const text = this.extractTextSimple(blocks);
            const { summary, qa } = await this.processDocument(text, description);

            await knex('doc_extract')
                .where('id', docExtract.id)
                .update({
                    summary,
                    generated_content: knex.raw('?::jsonb', [JSON.stringify(qa)]),
                    status: "DONE"
                });

            const incomplete = await knex('doc_extract')
                .where('doc_training_id', docTrainingId)
                .andWhere('status', '!=', 'DONE')
                .first();

            if (!incomplete) {
                await knex('doc_training')
                    .where('id', docTrainingId)
                    .update({ stage: 'DONE' });

                await this.generateCollectiveSummary(docTrainingId);
            }

            return { summary };
        } catch (error) {
            this.logger.error(`Content generation failed for jobId ${jobId}:`, error);
            return { success: false, error };
        }
    }

    private async safeStartTextExtractAsync(params: { fileName: string, bucket: string }, retries = 5): Promise<any> {
        try {
            return await this.textractService.startTextExtractAsync(params);
        } catch (error: any) {
            if (retries > 0 && error.name === "ProvisionedThroughputExceededException") {
                const waitTime = (6 - retries) * 1000;
                this.logger.warn(`Textract throttled - retrying after ${waitTime}ms`);
                await new Promise(res => setTimeout(res, waitTime));
                return this.safeStartTextExtractAsync(params, retries - 1);
            }
            throw error;
        }
    }

    async recoverErrors(props: RecoverErrorsDto): Promise<void> {
        const knex = this.databaseService.getKnex();
        const docTraining = await knex('doc_training')
            .where('id', props.docTrainingId)
            .first();

        if (docTraining) {
            const docExtracts = await knex('doc_extract')
                .where('doc_training_id', props.docTrainingId)
                .andWhereNot("status", "DONE");

            this.logger.log(`Found ${docExtracts.length} unfinished records for docTrainingId ${props.docTrainingId}`);
            
            let delayPerRec = 0;
            for (const docExtract of docExtracts) {
                const params = {
                    fileName: `chat-train/${props.docTrainingId}/${docExtract.file_name}`,
                    bucket: this.bucket,
                };
                await this.safeStartTextExtractAsync(params);
                await new Promise(res => setTimeout(res, 1000));

                await this.sqsService.sendSQSMessage(
                    { jobId: docExtract.job_id, docTrainingId: props.docTrainingId, description: docTraining.description },
                    "process-pdf",
                    this.chatQueue,
                    60 + delayPerRec
                );
                delayPerRec += 5;
            }
        }
    }

    async generateCollectiveSummary(docTrainingId: number) {
        const knex = this.databaseService.getKnex();
        const summaries = await knex('doc_extract')
            .where('doc_training_id', docTrainingId)
            .pluck('summary');

        const combined = summaries.filter(Boolean).join('\n');

        const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: 'system',
                    content: `Combine and condense these summaries from a mortgage document into one coherent summary.`
                },
                { role: 'user', content: combined }
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        const collectiveSummary = response.choices[0].message.content?.trim();

        await knex('doc_training')
            .where('id', docTrainingId)
            .update({ summary: collectiveSummary });

        return { summary: collectiveSummary };
    }
}
