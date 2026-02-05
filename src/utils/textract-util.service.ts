import { GetDocumentTextDetectionCommand, StartDocumentTextDetectionCommand, StartDocumentTextDetectionCommandOutput, TextractClient } from "@aws-sdk/client-textract";

export class TextractUtilService {

    static getTextractClient = () => {
        const textractClient = new TextractClient({
            region: 'ap-southeast-1',
            credentials: {
                accessKeyId: process.env.PRI_AWS_ACCESS_KEY,
                secretAccessKey: process.env.PRI_AWS_SECRET_KEY,
            },
        });
        return textractClient;
    };



    static getDocumentBlocks = async (jobId: string) => {
        const textractClient = this.getTextractClient();
        try {
            let nextToken = undefined;
            const allBlocks = [];
            do {
                const params = {
                    JobId: jobId,
                    NextToken: nextToken,
                };

                const command = new GetDocumentTextDetectionCommand(params);
                try {
                    const response = await textractClient.send(command);
                    allBlocks.push(...response.Blocks);
                    nextToken = response.NextToken; // Update nextToken for pagination
                } catch (error) {
                    console.error("Error getting document text detection:", error);
                    return { data: [], error: error };
                }
            } while (nextToken);

            return { data: allBlocks, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }

    static startTextExtractAsync = async ({
        fileName,
        bucket,
    }): Promise<StartDocumentTextDetectionCommandOutput> => {
        const textractClient = this.getTextractClient();
        try {
            const input = {
                DocumentLocation: {
                    S3Object: {
                        Bucket: bucket,
                        Name: fileName,
                    },
                },
            };

            const command = new StartDocumentTextDetectionCommand(input);
            const data = await textractClient.send(command);
            return data;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    // static getDocumentBlocks = async (jobId: string) => {
    //     const textractClient = this.getTextractClient();
    //     try {
    //         let nextToken = undefined;
    //         const allBlocks = [];
    //         do {
    //             const params = {
    //                 JobId: jobId,
    //                 NextToken: nextToken,
    //             };

    //             const command = new GetDocumentAnalysisCommand(params);
    //             try {
    //                 const response = await textractClient.send(command);
    //                 allBlocks.push(...response.Blocks);
    //                 nextToken = response.NextToken; // Update nextToken for pagination
    //             } catch (error) {
    //                 console.error("Error getting document analysis:", error);
    //                 return { data: [], error: error };
    //             }
    //         } while (nextToken);

    //         return { data: allBlocks, error: null };
    //     } catch (error) {
    //         return { data: null, error };
    //     }
    // }

}