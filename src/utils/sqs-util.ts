import { OcrService } from "src/ocr/ocr.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SqsUtil {
    constructor(
        private readonly ocrService: OcrService,
    ) { }

    async handleSQSMessage(
        action: string,
        data: any
    ): Promise<any> {
        try {
            switch (action) {
                case "process-pdf":
                    await this.ocrService.getDocumentAnalysis(data);
                    break;
                case "generate-content":
                    await this.ocrService.generateContent(data);
                    break;
                default:
                    return "Unknown Queque"
            }

            return true;
        } catch (error) {
            throw error;
        }
    }
}