import { Queue, Worker, type Job } from "bullmq";
import { env } from "./config/env";

const CRON_JOBS = [
  { name: "recurring-invoices", pattern: "0 3 * * *" },
  { name: "low-stock-digest", pattern: "30 7 * * *" },
  { name: "overdue-reminders", pattern: "0 8 * * *" },
  { name: "attendance-check", pattern: "0 18 * * *" },
  { name: "fx-sync", pattern: "0 * * * *" },
] as const;

type CronJobName = (typeof CRON_JOBS)[number]["name"];

const API_ENDPOINTS: Record<CronJobName, string> = {
  "recurring-invoices": "/api/v1/recurring-invoices/run",
  "low-stock-digest": "/api/v1/dashboard/alerts",
  "overdue-reminders": "/api/v1/dashboard/alerts",
  "attendance-check": "/api/v1/dashboard/alerts",
  "fx-sync": "/api/v1/reports/fx-revaluation",
};

const queue = new Queue<{ tenantId?: string }>("cron", { connection: { url: env.REDIS_URL } });

for (const job of CRON_JOBS) {
  await queue.upsertJobScheduler(job.name, { pattern: job.pattern }, { name: job.name, data: { tenantId: undefined } });
}

async function runCronJob(jobName: CronJobName, tenantId: string): Promise<{ status: number }> {
  const response = await fetch(`${env.CRON_API_URL}${API_ENDPOINTS[jobName]}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CRON_API_TOKEN}`,
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
    },
  });
  if (!response.ok) throw new Error(`${jobName} failed for tenant ${tenantId}: HTTP ${response.status}`);
  return { status: response.status };
}

const worker = new Worker<{ tenantId?: string; name?: CronJobName }>(
  "cron",
  async (job: Job<{ tenantId?: string; name?: CronJobName }>) => {
    const jobName = (job.data.name ?? job.name) as CronJobName;
    const tenantIds = env.CRON_TENANT_IDS.split(",").map((tenantId) => tenantId.trim()).filter(Boolean);
    const results = [];
    for (const tenantId of tenantIds) {
      results.push(await runCronJob(jobName, tenantId));
    }
    return { jobName, tenants: results.length };
  },
  { connection: { url: env.REDIS_URL } },
);

worker.on("completed", (job) => {
  console.log(`[worker:cron] ${job.name} completed (${JSON.stringify(job.returnvalue)})`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker:cron] ${job?.name} failed: ${err.message}`);
});

console.log(`[worker] cron queue listening on ${env.REDIS_URL}; ${CRON_JOBS.length} schedules registered`);