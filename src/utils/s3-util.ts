import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

export class S3Util {

    static getS3CLient = () => {
        const s3Client = new S3Client({
            credentials: {
                accessKeyId: process.env.PRI_AWS_ACCESS_KEY,
                secretAccessKey: process.env.PRI_AWS_SECRET_KEY,
            },
        });
        return s3Client;
    };

    static uploadDocument = async (bucket: string, fileName: string, buffer: any, contentType = "application/pdf") => {
        const s3Client = this.getS3CLient();
        try {
            const checkUpload = new Upload({
                client: s3Client,
                params: {
                    Bucket: bucket,
                    Key: fileName,
                    ContentType: contentType,
                    Body: buffer,
                },
            });

            checkUpload.on("httpUploadProgress", (progress) => {
                console.log(progress);
            });

            await checkUpload.done();
            console.log("Upload Done");
        } catch (e) {
            console.error("Upload Error:", e);
        }
    }

    static streamToString = async (stream: Readable): Promise<string> => {
        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            stream.on("error", (error) => reject(error));
        });
    }

    static readJsonFileFromS3 = async (bucket: string, key: string): Promise<any> => {
        const s3Client = this.getS3CLient();
        try {
            // Create the command to get the object from S3
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await s3Client.send(command);

            // Read the data from the S3 object
            const stream = response.Body as Readable;
            const data = await this.streamToString(stream);

            // Parse the JSON data
            return JSON.parse(data);
        } catch (error) {
            console.error("Error reading or parsing JSON file from S3:", error);
            throw error;
        }
    }

    static getFileBufferFromS3 = async (bucket: string, key: string): Promise<any> => {
        const s3Client = this.getS3CLient();
        try {
            const command = new GetObjectCommand({ Bucket: bucket, Key: key });
            const response = await s3Client.send(command);
            const stream = response.Body as Readable;

            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks)));
            });

        } catch (error) {
            console.error("Error reading document from S3:", error);
            throw error;
        }
    }
}