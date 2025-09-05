import { FastifyInstance, FastifyReply } from 'fastify';
import { getJobQueue } from '../jobs/JobQueue.js';
import type { PitchInput } from '../v2/types.js';

export default async function jobRoutes(app: FastifyInstance) {
  const jobQueue = getJobQueue();

  // Start a new job
  app.post('/api/jobs', async (req, reply) => {
    try {
      const body = req.body as any;

      // Validate required fields
      if (!body.project_title || !body.elevator_pitch) {
        return reply.code(400).send({
          error: 'Missing required fields: project_title and elevator_pitch',
        });
      }

      const input: PitchInput = {
        project_title: body.project_title,
        elevator_pitch: body.elevator_pitch,
        language: body.language || 'de',
        target: body.target || 'Pre-Seed/Seed VCs',
        geo: body.geo || 'EU/DACH',
      };

      const options = {
        skipCache: body.skip_cache === true,
        parallelLimit: body.parallel_limit || 2,
        timeoutMs: body.timeout_ms || 300000,
      };

      const jobId = await jobQueue.createJob(input, options);

      // Return immediately with job ID
      return reply.code(202).send({
        jobId,
        status: 'queued',
        message: 'Job created successfully. Use /api/jobs/:id to check progress.',
      });
    } catch (error) {
      console.error('Error creating job:', error);
      return reply.code(500).send({
        error: 'Failed to create job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get job status
  app.get('/api/jobs/:jobId', async (req, reply) => {
    try {
      const { jobId } = req.params as { jobId: string };
      
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      const artifacts = await jobQueue.getArtifacts(jobId);

      return reply.send({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        artifacts: Object.keys(artifacts).reduce((acc, key) => {
          acc[key] = {
            name: artifacts[key].name,
            type: artifacts[key].type,
            hash: artifacts[key].hash,
            timestamp: artifacts[key].timestamp,
            // Don't send full data in status endpoint to keep response small
          };
          return acc;
        }, {} as Record<string, any>),
        result: job.result,
      });
    } catch (error) {
      console.error('Error getting job status:', error);
      return reply.code(500).send({
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get job artifact data
  app.get('/api/jobs/:jobId/artifacts/:artifactName', async (req, reply) => {
    try {
      const { jobId, artifactName } = req.params as { 
        jobId: string; 
        artifactName: string; 
      };
      
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      const artifacts = await jobQueue.getArtifacts(jobId);
      const artifact = artifacts[artifactName];
      
      if (!artifact) {
        return reply.code(404).send({ error: 'Artifact not found' });
      }

      return reply.send({
        name: artifact.name,
        type: artifact.type,
        data: artifact.data,
        hash: artifact.hash,
        timestamp: artifact.timestamp,
      });
    } catch (error) {
      console.error('Error getting job artifact:', error);
      return reply.code(500).send({
        error: 'Failed to get job artifact',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Server-Sent Events stream for real-time updates
  app.get('/api/jobs/:jobId/stream', async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    
    try {
      const job = await jobQueue.getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      const sendEvent = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send initial status
      sendEvent('status', {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
      });

      // Set up polling interval
      const pollInterval = setInterval(async () => {
        try {
          const currentJob = await jobQueue.getJob(jobId);
          if (!currentJob) {
            clearInterval(pollInterval);
            sendEvent('error', { message: 'Job not found' });
            reply.raw.end();
            return;
          }

          sendEvent('status', {
            jobId: currentJob.id,
            status: currentJob.status,
            progress: currentJob.progress,
          });

          // If job is completed or failed, send final result and close
          if (currentJob.status === 'completed' || currentJob.status === 'failed') {
            if (currentJob.result) {
              sendEvent('result', currentJob.result);
            }
            if (currentJob.error) {
              sendEvent('error', { message: currentJob.error });
            }
            sendEvent('done', { status: currentJob.status });
            clearInterval(pollInterval);
            reply.raw.end();
          }
        } catch (error) {
          console.error('Error in SSE polling:', error);
          clearInterval(pollInterval);
          sendEvent('error', { message: 'Internal server error' });
          reply.raw.end();
        }
      }, 2000); // Poll every 2 seconds

      // Handle client disconnect
      req.raw.on('close', () => {
        clearInterval(pollInterval);
      });

      req.raw.on('error', () => {
        clearInterval(pollInterval);
      });

    } catch (error) {
      console.error('Error setting up SSE stream:', error);
      return reply.code(500).send({
        error: 'Failed to set up stream',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get queue statistics
  app.get('/api/jobs/stats', async (req, reply) => {
    try {
      const stats = await jobQueue.getQueueStats();
      return reply.send(stats);
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return reply.code(500).send({
        error: 'Failed to get queue stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check for job system
  app.get('/api/jobs/health', async (req, reply) => {
    try {
      const stats = await jobQueue.getQueueStats();
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        queue: stats,
      });
    } catch (error) {
      console.error('Job system health check failed:', error);
      return reply.code(503).send({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
