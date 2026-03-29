import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { TypeOrmModule } from "@nestjs/typeorm";

import { SubmissionQueueModule } from "../../submission-queue";
import { DeleteProgressHandler } from "./application/commands/handlers/delete-progress.handler";
import { GradeBlockHandler } from "./application/commands/handlers/grade-block.handler";
import { InitializeProgressHandler } from "./application/commands/handlers/initialize-progress.handler";
import { StartExamHandler } from "./application/commands/handlers/start-exam.handler";
import { SubmitAssignmentHandler } from "./application/commands/handlers/submit-assignment.handler";
import { SubmitExamHandler } from "./application/commands/handlers/submit-exam.handler";
import { SubmitQuizHandler } from "./application/commands/handlers/submit-quiz.handler";
import { BlockCompletedHandler } from "./application/events/handlers/block-completed.handler";
import { CourseCompletedHandler } from "./application/events/handlers/course-completed.handler";
import { LessonCompletedHandler } from "./application/events/handlers/lesson-completed.handler";
import { ProgressInitializedHandler } from "./application/events/handlers/progress-initialized.handler";
import { GetActiveExamHandler } from "./application/queries/handlers/get-active-exam.handler";
import { GetStudentLessonHandler } from "./application/queries/handlers/get-student-lesson.handler";
import { GetStudentProgressHandler } from "./application/queries/handlers/get-student-progress.handler";
import { ProgressSagas } from "./application/sagas/progress.saga";
import { PROGRESS_REPOSITORY } from "./domain/repository/progress.repository";
import { ProgressOrmEntity } from "./infrastructure/persistence/entities/progress.orm.entity";
import {
  StudentDashboard,
  StudentDashboardSchema,
} from "./infrastructure/persistence/mongo/schemas/student-dashboard.schema";
import { TypeOrmProgressRepository } from "./infrastructure/persistence/repositories/typeorm-progress.repository";
import { ProgressEventListener } from "./presentation/progress.listener";
import { ContentModule } from "../../content";
import { CompleteBlockSyncHandler } from "./application/commands/handlers/complete-block-sync.handler";
import { ProgressController } from "./presentation/progress.controller";
import { Enrollment } from "../enrollment/entities/enrollment.entity";
import { GetStudentDashboardHandler } from "./application/queries/handlers/get-student-dashboard.handler";
import { ExamReaperProcessor } from "./application/workers/exam-reaper.processor";
import { ExamReaperService } from "./application/workers/exam-reaper.service";
import { QuizAttemptOrmEntity } from "./infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { GradingListener } from "./presentation/grading.listener";

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([ProgressOrmEntity, Enrollment, QuizAttemptOrmEntity]),
    MongooseModule.forFeature([{ name: StudentDashboard.name, schema: StudentDashboardSchema }]),
    BullModule.registerQueue({
      name: "exam-reaper",
    }),
    SubmissionQueueModule,
    ContentModule,
    JwtModule,
  ],
  providers: [
    {
      provide: PROGRESS_REPOSITORY,
      useClass: TypeOrmProgressRepository,
    },
    InitializeProgressHandler,
    DeleteProgressHandler,
    SubmitAssignmentHandler,
    SubmitQuizHandler,
    StartExamHandler,
    SubmitExamHandler,
    CompleteBlockSyncHandler,
    ProgressInitializedHandler,
    BlockCompletedHandler,
    CourseCompletedHandler,
    LessonCompletedHandler,
    GetStudentProgressHandler,
    GetStudentDashboardHandler,
    GetStudentLessonHandler,
    GradeBlockHandler,
    GetActiveExamHandler,
    ProgressEventListener,
    ProgressSagas,
    GradingListener,
    ExamReaperProcessor,
    ExamReaperService,
  ],
  controllers: [ProgressController],
})
export class ProgressModule {}
