import { BlockRequiredAction, BlockType, Permission, QuizQuestionType } from "@athena/types";
import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { SubmitExamDto } from "../../src/learning/progress/application/dto/submit-exam.dto";
import { bootstrapE2E, shutdownE2E } from "../bootstrap-e2e";

describe("POST /progress/.../exam/submit (e2e)", () => {
  let app: INestApplication;
  let fixtures: any;
  let studentToken: string;

  let courseId: string;
  let lessonId: string;
  let examBlockId: string;
  let activeAttemptId: string;
  let questionIdFromSnapshot: string;

  beforeAll(async () => {
    const res = await bootstrapE2E();
    app = res.app;
    fixtures = res.fixtures;

    const studentRole = await fixtures.createRole({
      name: "student_exam_submitter",
      permissions: [Permission.ENROLLMENTS_READ],
    });

    const user = await fixtures.createUser({
      login: "exam_submitter",
      password: "Password123!",
      roleId: studentRole.id,
    });
    studentToken = await fixtures.login("exam_submitter", "Password123!");

    const course = await fixtures.createCourse({ title: "Submit Exam Course" });
    const lesson = await fixtures.createLesson({ courseId: course.id, title: "Final Test" });

    courseId = course.id;
    lessonId = lesson.id;

    await fixtures.createLibraryBlock({
      type: BlockType.QuizQuestion,
      tags: ["submit-e2e"],
      content: {
        type: QuizQuestionType.Open,
        question: { json: { text: "What is 2+2?" } },
        correctAnswerText: "4",
      },
    });

    const examBlock = await fixtures.createBlock({
      lessonId: lesson.id,
      type: BlockType.QuizExam,
      requiredAction: BlockRequiredAction.SUBMIT,
      content: {
        title: "Math Exam",
        passPercentage: 100,
        source: {
          includeTags: ["submit-e2e"],
          count: 1,
        },
      },
    });
    examBlockId = examBlock.id;

    const cohort = await fixtures.createCohort({
      courseId,
      instructorId: (await fixtures.createInstructor()).id,
      name: "Submit Cohort",
    });
    await fixtures.enrollStudentWithProgress({ userId: user.id, cohortId: cohort.id, courseId });
    await new Promise(r => setTimeout(r, 500));

    const http = request(app.getHttpServer());
    const startRes = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${examBlockId}/exam/start`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send();

    activeAttemptId = startRes.body.id;
    questionIdFromSnapshot = startRes.body.questions[0].id;
  }, 60000);

  afterAll(async () => {
    await fixtures.resetDatabase();
    await shutdownE2E(app);
  });

  it("should evaluate a correct submission, close attempt, and sync progress", async () => {
    const http = request(app.getHttpServer());

    const payload: SubmitExamDto = {
      answers: [
        {
          questionId: questionIdFromSnapshot,
          textAnswer: "4",
        },
      ],
    };

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${examBlockId}/exam/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      attemptId: activeAttemptId,
      score: 100,
      passed: true,
      passPercentage: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
  });

  it("should return 400 Bad Request if attempting to submit an already closed attempt", async () => {
    const http = request(app.getHttpServer());
    const payload: SubmitExamDto = { answers: [] };

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${examBlockId}/exam/submit`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No active exam attempt found");
  });
});
