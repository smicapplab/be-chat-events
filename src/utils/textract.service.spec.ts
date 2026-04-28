import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TextractService } from './textract.service';
import { TextractClient, GetDocumentTextDetectionCommand, StartDocumentTextDetectionCommand } from "@aws-sdk/client-textract";

jest.mock('@aws-sdk/client-textract');

describe('TextractService', () => {
    let service: TextractService;
    let textractClient: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TextractService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue?: string) => {
                            if (key === 'AWS_REGION') return 'ap-southeast-1';
                            if (key === 'PRI_AWS_ACCESS_KEY') return 'test-access-key';
                            if (key === 'PRI_AWS_SECRET_KEY') return 'test-secret-key';
                            return defaultValue;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<TextractService>(TextractService);
        textractClient = (service as any).textractClient;
        textractClient.send = jest.fn();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getDocumentBlocks', () => {
        it('should fetch all blocks with pagination', async () => {
            textractClient.send
                .mockResolvedValueOnce({
                    Blocks: [{ Id: '1' }],
                    NextToken: 'token1',
                })
                .mockResolvedValueOnce({
                    Blocks: [{ Id: '2' }],
                });

            const result = await service.getDocumentBlocks('job-id');

            expect(result.data).toHaveLength(2);
            expect(result.data).toEqual([{ Id: '1' }, { Id: '2' }]);
            expect(textractClient.send).toHaveBeenCalledTimes(2);
        });

        it('should return error if textract fails', async () => {
            const mockError = new Error('Textract error');
            textractClient.send.mockRejectedValue(mockError);

            const result = await service.getDocumentBlocks('job-id');

            expect(result.data).toEqual([]);
            expect(result.error).toEqual(mockError);
        });
    });

    describe('startTextExtractAsync', () => {
        it('should start text extraction', async () => {
            const mockResponse = { JobId: 'job-id' };
            textractClient.send.mockResolvedValue(mockResponse);

            const result = await service.startTextExtractAsync({
                fileName: 'test.pdf',
                bucket: 'test-bucket',
            });

            expect(result).toEqual(mockResponse);
            expect(textractClient.send).toHaveBeenCalledWith(expect.any(StartDocumentTextDetectionCommand));
        });
    });
});
