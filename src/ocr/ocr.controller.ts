import { Body, Controller, Post } from '@nestjs/common';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {

    constructor(
        private readonly ocrService: OcrService
    ) { }

    @Post("doc-analysis")
    async getDocumentAnalysis(
        @Body() dto: { docTrainingId: number; jobId: string, description: string }
    ) {
        try {
            const result = await this.ocrService.getDocumentAnalysis(dto);
            return { ...result, message: "" }
        } catch (error) {
            console.error(error)
            return { success: false, result: "", message: "Something went wrong.  Please try again." }
        }
    }

    @Post("recover-errors")
    async recoverErrors(
        @Body() dto: { docTrainingId: number; }
    ) {
        try {
            await this.ocrService.recoverErrors(dto);
            return { success: true }
        } catch (error) {
            return { error }
        }
    }

    @Post("generate-content")
    async generateContent(
        @Body() dto: { docTrainingId: number; jobId: string, description: string }
    ) {
        try {
            const result = await this.ocrService.generateContent(dto);
            return { ...result, message: "" }
        } catch (error) {
            console.error(error)
            return { success: false, result: "", message: "Something went wrong.  Please try again." }
        }
    }

}
