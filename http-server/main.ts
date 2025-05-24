import { HttpServer } from "./http-server.ts";
import express from "express";


async function main() {
const httpServer = new HttpServer("./http-server/blobs", "./http-server/temp-blobs", "./files-worker.ts");
await httpServer.warmUp();

const app = express();
app.post("/blobs/:id", (req, res) => {
    const id = req.params.id;
    httpServer.post(id, req, res);
});

app.get("/blobs/:id", (req, res) => {
    const id = req.params.id;
    httpServer.get(id, res);
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

app.on("close", async () => {
    await httpServer.tearDown();
});
}
main()