import { Test, TestingModule } from '@nestjs/testing';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { OcrAnalysisDto, GenerateContentDto, RecoverErrorsDto } from './dto/ocr.dto';

describe('OcrController', () => {
    let controller: OcrController;
    let service: OcrService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OcrController],
            providers: [
                {
                    provide: OcrService,
                    useValue: {
                        getDocumentAnalysis: jest.fn(),
                        generateContent: jest.fn(),
                        recoverErrors: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<OcrController>(OcrController);
        service = module.get<OcrService>(OcrService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getDocumentAnalysis', () => {
        it('should call service and return result', async () => {
            const dto: OcrAnalysisDto = { docTrainingId: 1, jobId: 'j1', description: 'd' };
            const mockResult = { data: 'ok' };
            (service.getDocumentAnalysis as jest.Mock).mockResolvedValue(mockResult);

            const result = await controller.getDocumentAnalysis(dto);

            expect(result).toEqual({ ...mockResult, message: '' });
            expect(service.getDocumentAnalysis).toHaveBeenCalledWith(dto);
        });
    });

    describe('generateContent', () => {
        it('should call service and return result', async () => {
            const dto: GenerateContentDto = { docTrainingId: 1, jobId: 'j1', description: 'd' };
            const mockResult = { summary: 'done' };
            (service.generateContent as jest.Mock).mockResolvedValue(mockResult);

            const result = await controller.generateContent(dto);

            expect(result).toEqual({ ...mockResult, message: '' });
        });
    });

    describe('recoverErrors', () => {
        it('should call service and return success', async () => {
            const dto: RecoverErrorsDto = { docTrainingId: 1 };
            
            const result = await controller.recoverErrors(dto);

            expect(result).toEqual({ success: true });
            expect(service.recoverErrors).toHaveBeenCalledWith(dto);
        });
    });
});
