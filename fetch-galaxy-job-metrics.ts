import { createGalaxyApi } from "@galaxyproject/galaxy-api-client";

const GALAXY_URL = process.env.GALAXY_URL || "https://usegalaxy.org";
const API_KEY = process.env.GALAXY_API_KEY;
const HISTORY_ID = process.argv[2];

interface Job {
  id: string;
  tool_id: string;
  state: string;
  create_time: string;
  update_time: string;
  [key: string]: any;
}


async function fetchJobMetricsForHistory() {
  if (!API_KEY) {
    console.error("Error: GALAXY_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!HISTORY_ID) {
    console.error("Error: History ID is required as a command line argument");
    console.error("Usage: npx tsx fetch-galaxy-job-metrics.ts <history-id>");
    process.exit(1);
  }

  const api = createGalaxyApi({
    baseUrl: GALAXY_URL,
    apiKey: API_KEY,
    headers: { Accept: "application/json" }
  });

  try {
    console.log(`Connecting to Galaxy server: ${GALAXY_URL}`);
    console.log(`Fetching jobs for history: ${HISTORY_ID}`);
    
    const jobsResponse = await api.GET("/api/jobs", {
      params: { query: { history_id: HISTORY_ID, key: API_KEY } }
    });

    if (jobsResponse.error) {
      console.error("Error fetching jobs:", jobsResponse.error);
      return;
    }

    const jobs = jobsResponse.data as Job[];
    console.log(`Found ${jobs.length} jobs in history`);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`\nJob ${job.id} (${job.tool_id}) - State: ${job.state}`);
      
      const metricsResponse = await api.GET("/api/jobs/{job_id}/metrics", {
        params: { path: { job_id: job.id } }
      });

      if (metricsResponse.error) {
        console.error(`Error fetching metrics for job ${job.id}:`, metricsResponse.error);
        continue;
      }

      const metrics = metricsResponse.data as any[];
      
      if (metrics.length === 0) {
        console.log("  No metrics available");
      } else {
        console.log(`  Metrics (${metrics.length}):`);
        metrics.forEach((metric: any) => {
          console.log(`    ${metric.plugin}.${metric.name}: ${metric.value}`);
        });
      }
    }

  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

fetchJobMetricsForHistory().then(() => {
  console.log("\nScript completed");
}).catch(error => {
  console.error("Script failed:", error);
});
