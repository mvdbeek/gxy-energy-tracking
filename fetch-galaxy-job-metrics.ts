import { createGalaxyApi } from "@galaxyproject/galaxy-api-client";
import { type components } from "@galaxyproject/galaxy-api-client";

const GALAXY_URL = process.env.GALAXY_URL || "https://usegalaxy.eu";
const API_KEY = process.env.GALAXY_API_KEY;
const HISTORY_ID = process.argv[2];

// Carbon emission calculation constants
const DEFAULT_PUE = 1.67;
const MEMORY_POWER_USAGE_CONSTANT = 0.375; // W/GiB
const DEFAULT_CARBON_INTENSITY = 475; // gCO2/kWh (global average)
const DEFAULT_CPU_TDP = 240; // Watts (default TDP Xeon Platinum 8175M)
const DEFAULT_CPU_CORES = 24; // Cores (default for Xeon Platinum 8175M)
const DEFAULT_TDP_PER_CORE = DEFAULT_CPU_TDP / DEFAULT_CPU_CORES; // Watts (total guesstimate)

// Configuration from environment variables
const PUE = parseFloat(process.env.PUE || DEFAULT_PUE.toString());
const CARBON_INTENSITY = parseFloat(
  process.env.CARBON_INTENSITY || DEFAULT_CARBON_INTENSITY.toString(),
);
const CPU_TDP = parseFloat(process.env.CPU_TDP || DEFAULT_CPU_TDP.toString());

interface CarbonEmissions {
  cpu_carbon_emissions: number;
  memory_carbon_emissions: number;
  total_carbon_emissions: number;
  energy_needed_cpu: number;
  energy_needed_memory: number;
  total_energy_needed: number;
  runtime_hours: number;
}

function parseRuntimeToHours(runtimeString: string): number {
  // Parse runtime strings like "4 minutes", "19 minutes", "1 hour", etc.
  const parts = runtimeString.toLowerCase().split(" ");
  const value = parseFloat(parts[0]);
  const unit = parts[1];

  if (unit.startsWith("hour")) {
    return value;
  } else if (unit.startsWith("minute")) {
    return value / 60;
  } else if (unit.startsWith("second")) {
    return value / 3600;
  }

  return 0; // fallback
}

function calculateCarbonEmissions(metrics: components["schemas"]["JobMetric"][]): CarbonEmissions | null {
  // Extract required metrics
  const galaxySlots = metrics.find((m) => m.name === "galaxy_slots")?.value;
  const galaxyMemoryMb = metrics.find(
    (m) => m.name === "galaxy_memory_mb",
  )?.value;
  const runtimeSeconds = metrics.find(
    (m) => m.name === "runtime_seconds",
  )?.value;

  if (!galaxySlots || !galaxyMemoryMb || !runtimeSeconds) {
    return null; // Missing required metrics
  }

  // Convert values
  const coresAllocated = parseFloat(galaxySlots);
  const memoryAllocatedMb = parseFloat(galaxyMemoryMb);
  const memoryAllocatedGb = memoryAllocatedMb / 1024; // Convert MB to GB
  const runtimeHours = parseRuntimeToHours(runtimeSeconds);

  // Calculate power usage
  // const tdpPerCore = CPU_TDP / totalCores; // we don't have the total cores ...
  const totalTdp = DEFAULT_TDP_PER_CORE * coresAllocated;

  const powerNeededCpu = PUE * totalTdp;
  const powerNeededMemory =
    PUE * memoryAllocatedGb * MEMORY_POWER_USAGE_CONSTANT;
  const totalPowerNeeded = powerNeededCpu + powerNeededMemory;

  // Calculate energy usage (in kWh)
  const energyNeededCpu = (runtimeHours * powerNeededCpu) / 1000;
  const energyNeededMemory = (runtimeHours * powerNeededMemory) / 1000;
  const totalEnergyNeeded = (runtimeHours * totalPowerNeeded) / 1000;

  // Calculate carbon emissions (in gCO2e)
  const cpuCarbonEmissions = energyNeededCpu * CARBON_INTENSITY;
  const memoryCarbonEmissions = energyNeededMemory * CARBON_INTENSITY;
  const totalCarbonEmissions = totalEnergyNeeded * CARBON_INTENSITY;

  return {
    cpu_carbon_emissions: cpuCarbonEmissions,
    memory_carbon_emissions: memoryCarbonEmissions,
    total_carbon_emissions: totalCarbonEmissions,
    energy_needed_cpu: energyNeededCpu,
    energy_needed_memory: energyNeededMemory,
    total_energy_needed: totalEnergyNeeded,
    runtime_hours: runtimeHours,
  };
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
    headers: { Accept: "application/json" },
  });

  try {
    console.log(`Connecting to Galaxy server: ${GALAXY_URL}`);
    console.log(`Fetching jobs for history: ${HISTORY_ID}`);

    const jobsResponse = await api.GET("/api/jobs", {
      params: { query: { history_id: HISTORY_ID, key: API_KEY } },
    });

    if (jobsResponse.error) {
      console.error("Error fetching jobs:", jobsResponse.error);
      return;
    }

    const jobs = jobsResponse.data;
    console.log(`Found ${jobs.length} jobs in history`);

    let totalCarbonEmissions = 0;
    let totalEnergyNeeded = 0;
    let jobsWithEmissions = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`\nJob ${job.id} (${job.tool_id}) - State: ${job.state}`);

      const metricsResponse = await api.GET("/api/jobs/{job_id}/metrics", {
        params: { path: { job_id: job.id } },
      });

      if (metricsResponse.error) {
        console.error(
          `Error fetching metrics for job ${job.id}:`,
          metricsResponse.error,
        );
        continue;
      }

      const metrics = metricsResponse.data.filter((metric) => metric !== null);

      if (metrics.length === 0) {
        console.log("  No metrics available");
      } else {
        console.log(`  Metrics (${metrics.length}):`);
        metrics.forEach((metric) => {
          console.log(`    ${metric.plugin}.${metric.name}: ${metric.value}`);
        });

        // Calculate carbon emissions
        const emissions = calculateCarbonEmissions(metrics);
        if (emissions) {
          console.log(`  Carbon Emissions:`);
          console.log(
            `    Runtime: ${emissions.runtime_hours.toFixed(4)} hours`,
          );
          console.log(
            `    CPU Energy: ${emissions.energy_needed_cpu.toFixed(6)} kWh`,
          );
          console.log(
            `    Memory Energy: ${emissions.energy_needed_memory.toFixed(6)} kWh`,
          );
          console.log(
            `    Total Energy: ${emissions.total_energy_needed.toFixed(6)} kWh`,
          );
          console.log(
            `    CPU CO2e: ${emissions.cpu_carbon_emissions.toFixed(2)} gCO2e`,
          );
          console.log(
            `    Memory CO2e: ${emissions.memory_carbon_emissions.toFixed(2)} gCO2e`,
          );
          console.log(
            `    Total CO2e: ${emissions.total_carbon_emissions.toFixed(2)} gCO2e`,
          );

          totalCarbonEmissions += emissions.total_carbon_emissions;
          totalEnergyNeeded += emissions.total_energy_needed;
          jobsWithEmissions++;
        } else {
          console.log(
            "  Carbon emissions calculation not possible (missing required metrics)",
          );
        }
      }
    }

    // Display summary
    console.log(`\n=== CARBON EMISSIONS SUMMARY ===`);
    console.log(`Configuration:`);
    console.log(`  PUE: ${PUE}`);
    console.log(`  Carbon Intensity: ${CARBON_INTENSITY} gCO2/kWh`);
    console.log(`  CPU TDP: ${CPU_TDP} W`);
    console.log(`  Memory Power Factor: ${MEMORY_POWER_USAGE_CONSTANT} W/GiB`);

    if (jobsWithEmissions > 0) {
      console.log(`\nTotals (${jobsWithEmissions}/${jobs.length} jobs):`);
      console.log(
        `  Total Energy Consumption: ${totalEnergyNeeded.toFixed(6)} kWh`,
      );
      console.log(
        `  Total Carbon Emissions: ${totalCarbonEmissions.toFixed(2)} gCO2e`,
      );
      console.log(
        `  Average per job: ${(totalCarbonEmissions / jobsWithEmissions).toFixed(2)} gCO2e`,
      );

      // Convert to more readable units
      if (totalCarbonEmissions > 1000) {
        console.log(
          `  Total Carbon Emissions: ${(totalCarbonEmissions / 1000).toFixed(3)} kgCO2e`,
        );
      }
    } else {
      console.log(
        `\nNo carbon emissions calculated (missing required metrics)`,
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

fetchJobMetricsForHistory()
  .then(() => {
    console.log("\nScript completed");
  })
  .catch((error) => {
    console.error("Script failed:", error);
  });
