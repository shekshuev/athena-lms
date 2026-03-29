import type { IEventBus } from "@athena/common";
import type { SubmissionResult } from "@athena/types";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";

import { AthenaEvent, SubmissionCompletedEvent } from "../shared/events/types";

/**
 * @class SubmissionResultProcessor
 * @description BullMQ Processor (Worker) that listens for completed execution results
 * from the 'submission-result' queue.
 *
 * It acts as a bridge between the Runner (external service) and the API's internal logic.
 * When a result is received, it emits a domain event to notify interested modules
 * (e.g., NotificationGateway, LearnService).
 */
@Processor("submission-result")
export class SubmissionResultProcessor extends WorkerHost {
  private readonly logger = new Logger(SubmissionResultProcessor.name);

  constructor(@Inject("IEventBus") private readonly eventBus: IEventBus) {
    super();
  }

  /**
   * Standard BullMQ process method.
   * Triggered whenever the Runner finishes a job and pushes the result to Redis.
   *
   * @param job - The BullMQ Job object containing the execution result in `job.data`.
   * @returns A promise that resolves to a status object when processing is complete.
   */
  async process(job: Job<SubmissionResult, void, string>): Promise<{ processed: boolean }> {
    const result = job.data;

    const meta = result.metadata;

    this.logger.log(`Received result for ${result.submissionId}. Routing to [${meta?.socketId || "UNKNOWN"}]`);
    const event = new SubmissionCompletedEvent(result);
    await this.eventBus.publish(AthenaEvent.SUBMISSION_COMPLETED, event);

    return { processed: true };
  }
}
