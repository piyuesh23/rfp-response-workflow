import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface PhaseJobData {
  phaseId: string;
  engagementId: string;
  phaseNumber: string;
  techStack: string;
  revisionFeedback?: string;
}

export const redisConnection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
};

// Lazy singletons — avoid connecting during `next build`
let _connection: IORedis | undefined;
let _phaseQueue: Queue<PhaseJobData> | undefined;

export function getConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(redisConnection);
  }
  return _connection;
}

export function getPhaseQueue(): Queue<PhaseJobData> {
  if (!_phaseQueue) {
    _phaseQueue = new Queue<PhaseJobData>("phase-execution", {
      connection: getConnection(),
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
  }
  return _phaseQueue;
}

// Keep backward-compatible named exports that are lazy via getters
// These are used by existing code that imports `connection` and `phaseQueue` directly
export const connection: IORedis = new Proxy({} as IORedis, {
  get(_, prop) {
    return (getConnection() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const phaseQueue: Queue<PhaseJobData> = new Proxy({} as Queue<PhaseJobData>, {
  get(_, prop) {
    return (getPhaseQueue() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
