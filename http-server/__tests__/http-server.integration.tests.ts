import * as request from 'supertest';
import * as  express from 'express';
import { HttpServer } from '../http-server';
import * as fs from 'fs/promises';

describe('HTTP Server Integration Tests', () => {
    let app: express.Application;
    let httpServer: HttpServer;
    const testBlobsDir = './http-server/__tests__/blobs';
    const testTempBlobsDir = './http-server/__tests__/temp-blobs';
    const testFilesWorkerDir = './http-server/files-worker.ts';

    beforeAll(async () => {
        // Clean up test directories
        await fs.rm(testBlobsDir, { recursive: true, force: true });
        await fs.rm(testTempBlobsDir, { recursive: true, force: true });
        
        // Create test directories
        await fs.mkdir(testBlobsDir, { recursive: true });
        await fs.mkdir(testTempBlobsDir, { recursive: true });

        httpServer = new HttpServer(testBlobsDir, testTempBlobsDir, testFilesWorkerDir);
        await httpServer.warmUp();
        
        app = express();
        app.post("/blobs/:id", (req, res) => {
            const id = req.params.id;
            httpServer.post(id, req, res);
        });
        app.get("/blobs/:id", async (req, res) => {
            const id = req.params.id;
            httpServer.get(id, res);
        });
    });

    // afterAll(async () => {
        // await httpServer.tearDown();
    // });

    describe('POST /blobs/:id', () => {

        it('should handle content length correctly', async () => {
            const testData = Buffer.from('test data');
            const contentLength = testData.length;
            
            const response = await request(app)
                .post('/blobs/test123')
                .set('Content-Type', 'text/plain')
                .set('Content-Length', contentLength.toString())
                .send(testData);

            expect(response.status).toBe(200);
            
            // Verify the blob was stored correctly
            const getResponse = await request(app)
                .get('/blobs/test123')
                .responseType('blob');  // This ensures we get the raw buffer

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.toString()).toBe('test data');
        });

    });

    // describe('GET /blobs/:id', () => {
    //     it('should return 404 for non-existent blob', async () => {
    //         const response = await request(app)
    //             .get('/blobs/nonexistent');

    //         expect(response.status).toBe(404);
    //     });

    //     it('should return blob with correct content type', async () => {
    //         const testData = Buffer.from('test data');
    //         const contentType = 'text/plain';

    //         // Store blob
    //         await request(app)
    //             .post('/blobs/test123')
    //             .set('Content-Type', contentType)
    //             .set('Content-Length', testData.length.toString())
    //             .send(testData);

    //         // Retrieve blob
    //         const response = await request(app)
    //             .get('/blobs/test123');

    //         expect(response.status).toBe(200);
    //         expect(response.headers['content-type']).toBe(contentType);
    //         expect(response.body.toString()).toBe(testData.toString());
    //     });
    // });
}); 