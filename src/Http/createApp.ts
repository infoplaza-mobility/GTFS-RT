import express from "express";
import { IFeedManager } from "../Interfaces/Services/UpdateTrainFeed";

export function createApp(feedManager: IFeedManager, publishDirectory: string): express.Express {
    const app = express();

    app.get("/health", (_request, response) => {
        const health = feedManager.getHealth();
        response.set("Cache-Control", "no-store");
        response.status(health.status === "healthy" ? 200 : 503).json(health);
    });

    app.use(express.static(publishDirectory));
    return app;
}
