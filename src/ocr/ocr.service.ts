import { DatabaseService } from '../database/database.service';
import { Injectable } from '@nestjs/common';
import { TextractUtilService } from '../utils/textract-util.service';
import { S3Util } from '../utils/s3-util';
import { SqsClientUtil } from '../utils/sqs-util-client';
import { OpenAI } from 'openai';
@Injectable()
export class OcrService {

    private bucket: string;
    private openaiKey: string;
    private openai: OpenAI;

    constructor(
        private readonly databaseService: DatabaseService,
    ) {
        this.bucket = process.env.AWS_PORTAL_BUCKET;
        this.openaiKey = process.env.OPENAI_API_KEY;
        this.openai = new OpenAI({
            apiKey: this.openaiKey, // Ensure this environment variable is set
        });
    }

    async getDocExtractByJobId(jobId: string) {
        const knex = this.databaseService.getKnex();
        const docExtract = await knex('doc_extract')
            .select(
                'id',
                'doc_training_id',
                'status',
                'file_name',
                'blocks',
            )
            .where('job_id', jobId)
            .first();

        return docExtract;
    }

    private cleanResponse = (response: string) => {
        let cleaned = response.trim();

        // Remove OpenAI formatting wrappers
        cleaned = cleaned.replace(/^'''json|```json|```|'''/g, "").trim();

        // Fix cases where a quoted amount is followed by unquoted text
        cleaned = cleaned.replace(/("\$?[0-9,\.]+")\s+for\s+([^"]+)"/gi, (_, amount, rest) => {
            return `"${amount.replace(/"/g, "")} for ${rest}"`;
        });

        // Remove any trailing commas before closing brackets or braces
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        return cleaned;
    };

    private parseJSON = (response) => {
        try {
            const cleanedResponse = this.cleanResponse(response);
            return JSON.parse(cleanedResponse);
        } catch (error) {
            console.error("Error parsing JSON:", error.message);
            console.error("Raw Response:", response);
            return null; // Return null or handle the error as needed
        }
    };

    // private extractTextWithTables = (blocks: any[]): string => {
    //     const lines: string[] = [];
    //     const tables: string[] = [];

    //     // LINE blocks
    //     for (const block of blocks) {
    //         if (block.BlockType === 'LINE' && block.Text) {
    //             lines.push(block.Text.trim());
    //         }
    //     }

    //     // TABLE blocks
    //     const cellMap = new Map();
    //     for (const block of blocks) {
    //         if (block.BlockType === 'CELL') {
    //             const row = block.RowIndex;
    //             const col = block.ColumnIndex;
    //             const text = block.Relationships?.flatMap((rel) =>
    //                 rel.Type === 'CHILD'
    //                     ? rel.Ids.map(id => blocks.find(b => b.Id === id && b.BlockType === 'WORD')?.Text).filter(Boolean)
    //                     : []
    //             ).join(' ') ?? '';

    //             if (!cellMap.has(row)) cellMap.set(row, {});
    //             cellMap.get(row)[col] = text;
    //         }
    //     }

    //     if (cellMap.size > 0) {
    //         tables.push('--- Extracted Table ---');
    //         for (const [rowIndex, rowCols] of [...cellMap.entries()].sort()) {
    //             const rowText = Object.keys(rowCols)
    //                 .sort((a, b) => +a - +b)
    //                 .map((colIndex) => rowCols[colIndex])
    //                 .join(' | ');
    //             tables.push(rowText);
    //         }
    //         tables.push('------------------------');
    //     }

    //     return [...lines, ...tables].join('\n');
    // };

    private extractTextSimple = (blocks: any[]): string => {
        if (!blocks || blocks.length === 0) return '';

        const lines = blocks
            .filter((block) => block.BlockType === 'LINE' && block.Text)
            .map((block) => block.Text.trim());

        return lines.join('\n');
    };

    private processDocument = async (text: string, description: string) => {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini", // gpt-4o Or "gpt-4o-mini" if you want faster and cheaper
                messages: [
                    {
                        role: 'system',
                        content: `
                        You are an AI assistant helping a mortgage company build a chatbot.
                        
                        You will receive the full text content from one page of a ${description ?? 'This is a seller guide for mortgage brokers detailing the eligibility requirements, documentation, and submission process for home loan funding.'}
                        
                        Your task is to:
                        1. Summarize the content of the page in 2–3 sentences.
                        2. Generate **relevant customer-style question-and-answer pairs** that someone might ask based on the document. These could be brokers, loan applicants, or internal staff.

                        - Only generate questions that can be answered **directly from the content provided**.  
                        - Do **not invent or guess answers**.  
                        - If the page is dense, you may generate **up to 20 Q&A pairs**.  
                        - If there is less content, it's okay to return fewer — just ensure all are useful and factual.

                        Output in this JSON format:
                        {
                          "summary": "string",
                          "qa": [
                            { "q": "customer-style question here", "a": "document-based answer here" },
                            ...
                          ]
                        }
                        Do not invent answers. Only generate questions that can be answered from the provided text.
                              `.trim()
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });

            const openaiResponse = response.choices[0].message.content;
            const parsedData = this.parseJSON(openaiResponse);
            return parsedData;
        } catch (error) {
            console.error("Error classifying document with OpenAI:", error);
            throw error;
        }
    };

    async getDocumentAnalysis(props: { docTrainingId: number; jobId: string, description: string }) {
        const { jobId, docTrainingId, description } = props
        const knex = this.databaseService.getKnex();
        try {
            const docExtract = await this.getDocExtractByJobId(jobId)
            const { data, error } = await TextractUtilService.getDocumentBlocks(jobId)
            const fileName = `chat-json-blocks/${docTrainingId}/${docExtract.id}.blocks.json`
            const buffer = Buffer.from(JSON.stringify(data));
            await S3Util.uploadDocument(
                this.bucket,
                fileName,
                buffer,
                "application/pdf")

            await knex('doc_extract')
                .where('id', docExtract.id)
                .update({
                    status: error ? "FAILED" : "PARTIAL:BLOCKS",
                    blocks: fileName,
                })

            await SqsClientUtil.sendSQSMessage(
                { jobId, docTrainingId, description },
                "generate-content",
                process.env.SQS_CHAT_QUEUE,
            )

            return { data: `Blocks Saved: ${jobId}` };
        } catch (error) {
            console.error(error);
            return { success: false, error }
        }
    }

    async generateContent(props: { docTrainingId: number; jobId: string, description: string }) {
        const { jobId, docTrainingId, description } = props
        const knex = this.databaseService.getKnex();
        try {
            const docExtract = await this.getDocExtractByJobId(jobId)
            const blocks = await S3Util.readJsonFileFromS3(this.bucket, docExtract.blocks)
            const text = this.extractTextSimple(blocks);
            const { summary, qa } = await this.processDocument(text, description);

            await knex('doc_extract')
                .where('id', docExtract.id)
                .update({
                    summary,
                    generated_content: knex.raw('?::jsonb', [JSON.stringify(qa)]),
                    status: "DONE"
                })


            const isComplete = await knex('doc_extract')
                .where('doc_training_id', docTrainingId)
                .andWhere('status', '!=', 'DONE')
                .first();

            if (!isComplete) {
                await knex('doc_training')
                    .where('id', docTrainingId)
                    .update({ stage: 'DONE' });

                await this.generateCollectiveSummary(docTrainingId);
            }

            return { summary };
        } catch (error) {
            console.error(error);
            return { success: false, error }
        }
    }


    private async safeStartTextExtractAsync(params: { fileName: string, bucket: string }, retries = 5): Promise<any> {
        try {
            return await TextractUtilService.startTextExtractAsync(params);
        } catch (error: any) {
            if (retries > 0 && error.name === "ProvisionedThroughputExceededException") {
                const waitTime = (6 - retries) * 1000; // 1s, 2s, 3s...
                console.warn(`Textract throttled - retrying after ${waitTime}ms`);
                await new Promise(res => setTimeout(res, waitTime));
                return this.safeStartTextExtractAsync(params, retries - 1);
            }
            throw error;
        }
    }

    async recoverErrors(props: { docTrainingId: number; }): Promise<void> {
        const knex = this.databaseService.getKnex();
        const docTraining = await knex('doc_training')
            .where('id', props.docTrainingId)
            .first()

        if (props.docTrainingId) {
            const docExtracts = await knex('doc_extract')
                .where('doc_training_id', props.docTrainingId)
                .andWhereNot("status", "DONE")

            console.log("Found ", docExtracts.length, "unfinished records")
            let delayPerRec = 0;
            for (let docExtract of docExtracts) {
                const params = {
                    fileName: `chat-train/${props.docTrainingId}/${docExtract.file_name}`,
                    bucket: process.env.AWS_PORTAL_BUCKET,
                };
                await this.safeStartTextExtractAsync(params);

                await new Promise(res => setTimeout(res, 1000));

                //this.generateContent({ jobId: docExtract.job_id, docTrainingId: props.docTrainingId, description: docTraining.description })

                await SqsClientUtil.sendSQSMessage(
                    { jobId: docExtract.job_id, docTrainingId: props.docTrainingId, description: docTraining.description },
                    "process-pdf",
                    process.env.SQS_CHAT_QUEUE,
                    60 + delayPerRec
                )

                // await SqsClientUtil.sendSQSMessage(
                //     { jobId: docExtract.job_id, docTrainingId: props.docTrainingId, description: docTraining.description },
                //     "doc-analysis",
                //     process.env.SQS_CHAT_QUEUE,
                //     60 + delayPerRec
                // )

                delayPerRec += 5
            }

        }

    }

    async generateCollectiveSummary(docTrainingId: number) {
        const knex = this.databaseService.getKnex();

        // Get all summaries
        const summaries = await knex('doc_extract')
            .where('doc_training_id', docTrainingId)
            .pluck('summary');

        const combined = summaries.filter(Boolean).join('\n');

        const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: 'system',
                    content: `
You will receive multiple summaries from various pages of a mortgage-related document.
Combine and condense these into one coherent collective summary.
The output should be clear, concise, and reflect the key points across all pages.
                    `.trim()
                },
                {
                    role: 'user',
                    content: combined
                }
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
