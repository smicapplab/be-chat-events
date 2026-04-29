import { Test, TestingModule } from '@nestjs/testing';
import { SqsUtil } from './sqs-util';
import { OcrService } from '../ocr/ocr.service';

describe('SqsUtil', () => {
  let sqsUtil: SqsUtil;
  let ocrService: OcrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsUtil,
        {
          provide: OcrService,
          useValue: {
            getDocumentAnalysis: jest.fn(),
            generateContent: jest.fn(),
          },
        },
      ],
    }).compile();

    sqsUtil = module.get<SqsUtil>(SqsUtil);
    ocrService = module.get<OcrService>(OcrService);
  });

  it('should be defined', () => {
    expect(sqsUtil).toBeDefined();
  });

  describe('handleSQSMessage', () => {
    it('should handle process-pdf action', async () => {
      const data = { foo: 'bar' };
      await sqsUtil.handleSQSMessage('process-pdf', data);
      expect(ocrService.getDocumentAnalysis).toHaveBeenCalledWith(data);
    });

    it('should handle generate-content action', async () => {
      const data = { foo: 'bar' };
      await sqsUtil.handleSQSMessage('generate-content', data);
      expect(ocrService.generateContent).toHaveBeenCalledWith(data);
    });

    it('should return Unknown Action for unknown action', async () => {
      const result = await sqsUtil.handleSQSMessage('unknown', {});
      expect(result).toBe('Unknown Action');
    });

    it('should propagate errors from ocrService', async () => {
      (ocrService.getDocumentAnalysis as jest.Mock).mockRejectedValue(
        new Error('Fail'),
      );
      await expect(sqsUtil.handleSQSMessage('process-pdf', {})).rejects.toThrow(
        'Fail',
      );
    });
  });
});
