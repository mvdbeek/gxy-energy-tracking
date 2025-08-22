# Galaxy Job Metrics Fetcher

A TypeScript script that fetches job metrics for all jobs in a Galaxy workflow history using the Galaxy API client.

## Features

- Fetches all jobs from a specified Galaxy history
- Retrieves detailed metrics for each job including:
  - Hostname where job executed
  - CPU and memory allocation
  - Runtime information (start/end times, duration)
  - Resource usage statistics (CPU time, memory peak)
  - System metrics (cgroup data)
- Calculates very rough CO2 and energy consumption estimates

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Galaxy API key from your Galaxy instance

## Installation

1. Install the required dependency:
```bash
npm install @galaxyproject/galaxy-api-client
```

2. If you don't have `tsx` installed globally:
```bash
npm install -g tsx
```

## Configuration

The script uses environment variables for configuration:

- `GALAXY_API_KEY` (required): Your Galaxy API key
- `GALAXY_URL` (optional): Galaxy server URL (defaults to https://usegalaxy.eu)

### Getting Your API Key

1. Log into your Galaxy instance
2. Go to User → Preferences → Manage API Key
3. Create a new API key if you don't have one

## Usage

### Basic Usage

```bash
export GALAXY_API_KEY="your-api-key-here"
npx tsx fetch-galaxy-job-metrics.ts <history-id>
```

### Using a Different Galaxy Server

```bash
export GALAXY_URL="https://usegalaxy.eu"
export GALAXY_API_KEY="your-api-key-here"
npx tsx fetch-galaxy-job-metrics.ts <history-id>
```

### Example

```bash
export GALAXY_API_KEY="your-api-key-here"
export GALAXY_URL="https://usegalaxy.eu"
npx tsx fetch-galaxy-job-metrics.ts <history_id>
```

## Sample Output

```
Connecting to Galaxy server: https://usegalaxy.eu
Fetching jobs for history: e44b0d52dc2a3225
Found 5 jobs in history

Job 11ac94870d0bb33ab17aa9acd48a28fd (toolshed.g2.bx.psu.edu/repos/iuc/dropletutils/dropletutils/1.10.0+galaxy2) - State: ok
  Metrics (11):
    hostname.hostname: vgcnbwc-worker-c36m975-0003.novalocal
    core.galaxy_slots: 1
    core.galaxy_memory_mb: 3891
    core.start_epoch: 2025-08-21 20:23:45
    core.end_epoch: 2025-08-21 20:28:35
    core.runtime_seconds: 4 minutes
    cgroup.cpu.stat.usage_usec: 3 minutes
    cgroup.cpu.stat.user_usec: 3 minutes
    cgroup.cpu.stat.system_usec: 9.8250280 seconds
    cgroup.memory.events.oom_kill: 0
    cgroup.memory.peak: 2.7 GB
```

## Finding Your History ID

1. In Galaxy, go to your workflow history
2. Look at the URL in your browser: `https://usegalaxy.eu/histories/view?id=HISTORY_ID_HERE`
3. Copy the ID from the URL

## Error Handling

The script will exit with an error message if:
- `GALAXY_API_KEY` environment variable is not set
- History ID is not provided as a command line argument
- API authentication fails
- Network or API errors occur

## Troubleshooting

- **"Provided API key is not valid"**: Check that your API key is correct and hasn't expired
- **"404 Not Found"**: Verify the history ID exists and you have access to it
- **Network errors**: Ensure you can reach the Galaxy server URL

## API Reference

This script uses the `@galaxyproject/galaxy-api-client` library to interact with:
- `/api/jobs` - Fetch jobs for a history
- `/api/jobs/{job_id}/metrics` - Get detailed metrics for each job
