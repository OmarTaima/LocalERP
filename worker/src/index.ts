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

const queue = new Queue<{ companyId?: string }>("cron", { connection: { url: env.REDIS_URL } });

for (const job of CRON_JOBS) {
  await queue.upsertJobScheduler(job.name, { pattern: job.pattern }, { name: job.name, data: { companyId: undefined } });
}

async function runCronJob(jobName: CronJobName, companyId: string): Promise<{ status: number }> {
  const response = await fetch(`${env.CRON_API_URL}${API_ENDPOINTS[jobName]}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CRON_API_TOKEN}`,
      "Content-Type": "application/json",
      "x-company-id": companyId,
    },
  });
  if (!response.ok) throw new Error(`${jobName} failed for company ${companyId}: HTTP ${response.status}`);
  return { status: response.status };
}

const worker = new Worker<{ companyId?: string; name?: CronJobName }>(
  "cron",
  async (job: Job<{ companyId?: string; name?: CronJobName }>) => {
    const jobName = (job.data.name ?? job.name) as CronJobName;
    const companyIds = env.CRON_COMPANY_IDS.split(",").map((companyId) => companyId.trim()).filter(Boolean);
    const results = [];
    for (const companyId of companyIds) {
      results.push(await runCronJob(jobName, companyId));
    }
    return { jobName, companies: results.length };
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