import { OcrService } from "../ocr/ocr.service";
import { Injectable, Logger } from "@nestjs/common";
import { GenerateContentDto, OcrAnalysisDto } from "../ocr/dto/ocr.dto";

@Injectable()
export class SqsUtil {
    private readonly logger = new Logger(SqsUtil.name);

    constructor(
        private readonly ocrService: OcrService,
    ) { }

    async handleSQSMessage(
        action: string,
        data: any
    ): Promise<boolean | string> {
        try {
            this.logger.log(`Handling SQS action: ${action}`);
            switch (action) {
                case "process-pdf":
                case "doc-analysis":
                    await this.ocrService.getDocumentAnalysis(data as OcrAnalysisDto);
                    break;
                case "generate-content":
                    await this.ocrService.generateContent(data as GenerateContentDto);
                    break;
                default:
                    this.logger.warn(`Unknown action received: ${action}`);
                    return "Unknown Action";
            }
            return true;
        } catch (error) {
            this.logger.error(`Error handling SQS message (${action}):`, error);
            throw error; // Propagate to trigger SQS retry/DLQ
        }
    }
}