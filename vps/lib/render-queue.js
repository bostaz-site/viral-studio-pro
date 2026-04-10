/**
 * Simple in-memory render queue with concurrency limit.
 *
 * Prevents multiple FFmpeg renders from running simultaneously and crashing
 * the VPS with OOM. Jobs are processed one-at-a-time (FIFO).
 *
 * For production scale, migrate to BullMQ + Redis.
 */

const MAX_CONCURRENT = 1; // Railway has limited memory — 1 at a time is safest
let running = 0;
const queue = [];
// Track job IDs currently running so /health and /status can report them
const runningJobIds = new Set();

/**
 * Enqueue a render job. Returns a promise that resolves when the job completes.
 *
 * @param {string} jobId - Unique job identifier (for logging)
 * @param {() => Promise<any>} fn - The async render function to execute
 * @returns {Promise<any>} - Result of fn()
 */
export function enqueueRender(jobId, fn) {
  return new Promise((resolve, reject) => {
    const job = { jobId, fn, resolve, reject };

    if (running < MAX_CONCURRENT) {
      runJob(job);
    } else {
      console.log(`[Queue] Job ${jobId} queued (${queue.length + 1} waiting, ${running} running)`);
      queue.push(job);
    }
  });
}

async function runJob(job) {
  running++;
  runningJobIds.add(job.jobId);
  console.log(`[Queue] Job ${job.jobId} started (${running} running, ${queue.length} waiting)`);

  try {
    const result = await job.fn();
    job.resolve(result);
  } catch (err) {
    job.reject(err);
  } finally {
    running--;
    runningJobIds.delete(job.jobId);
    console.log(`[Queue] Job ${job.jobId} done (${running} running, ${queue.length} waiting)`);

    // Process next job in queue
    if (queue.length > 0) {
      const next = queue.shift();
      runJob(next);
    }
  }
}

/**
 * Return the 0-indexed position of a jobId in the waiting queue, or -1 if
 * the job is currently running or not known. Used by /status to show the
 * user "3rd in line" progress.
 */
export function getJobPosition(jobId) {
  if (runningJobIds.has(jobId)) return 0; // "your turn"
  const idx = queue.findIndex((j) => j.jobId === jobId);
  return idx === -1 ? -1 : idx + 1;
}

/**
 * Get current queue status.
 */
export function getQueueStatus() {
  return {
    running,
    waiting: queue.length,
    maxConcurrent: MAX_CONCURRENT,
    runningJobIds: Array.from(runningJobIds),
    waitingJobIds: queue.map((j) => j.jobId),
  };
}
