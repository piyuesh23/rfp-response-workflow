import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface PhaseJobData {
  phaseId: string;
  engagementId: string;
  phaseNumber: number;
  techStack: string;
  revisionFeedback?: string;
}

export const redisConnection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
};

export const connection = new IORedis(redisConnection);

export const phaseQueue = new Queue<PhaseJobData>("phase-execution", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
