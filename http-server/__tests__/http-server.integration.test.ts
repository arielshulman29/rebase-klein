import * as request from 'supertest';
import * as  express from 'express';
import { HttpServer } from '../http-server';
import * as fs from 'fs/promises';

describe('HTTP Server Integration Tests', () => {
    let app: express.Application;
    let httpServer: HttpServer;
    const testBlobsDir = './blobs';
    const testTempBlobsDir = './temp-blobs';

    beforeAll(async () => {
        // Clean up test directories
        await fs.rm(testBlobsDir, { recursive: true, force: true });
        await fs.rm(testTempBlobsDir, { recursive: true, force: true });
        
        // Create test directories
        await fs.mkdir(testBlobsDir, { recursive: true });
        await fs.mkdir(testTempBlobsDir, { recursive: true });

        httpServer = new HttpServer();
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

    afterAll(async () => {
        await httpServer.tearDown();
    });

    describe('POST /blobs/:id', () => {
        it('should successfully store a blob with valid data', async () => {
            const testData = Buffer.from('test data');
            const response = await request(app)
                .post('/blobs/test123')
                .set('Content-Type', 'text/plain')
                .set('Content-Length', testData.length.toString())
                .send(testData);

            expect(response.status).toBe(200);
            expect(response.text).toBe('Upload complete');
        });

        // it('should reject blob with invalid ID characters', async () => {
        //     const testData = Buffer.from('test data');
        //     const response = await request(app)
        //         .post('/blobs/test@123')
        //         .set('Content-Type', 'text/plain')
        //         .set('Content-Length', testData.length.toString())
        //         .send(testData);

        //     expect(response.status).toBe(400);
        //     expect(response.text).toContain('Id contains invalid characters');
        // });

        // it('should store and retrieve custom headers', async () => {
        //     const testData = Buffer.from('test data');
        //     const customHeader = 'x-rebase-custom';
        //     const customValue = 'test-value';

        //     // Store blob with custom header
        //     await request(app)
        //         .post('/blobs/test123')
        //         .set('Content-Type', 'text/plain')
        //         .set('Content-Length', testData.length.toString())
        //         .set(customHeader, customValue)
        //         .send(testData);

        //     // Retrieve blob and verify headers
        //     const response = await request(app)
        //         .get('/blobs/test123');

        //     expect(response.status).toBe(200);
        //     expect(response.headers[customHeader.toLowerCase()]).toBe(customValue);
        // });
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