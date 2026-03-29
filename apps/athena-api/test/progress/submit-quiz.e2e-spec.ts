import { BlockRequiredAction, BlockType, Permission, QuizQuestionType } from "@athena/types";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { v4 as uuid } from "uuid";

import { SubmitQuizDto } from "../../src/learning/progress/application/dto/submit-quiz.dto";
import { bootstrapE2E, shutdownE2E } from "../bootstrap-e2e";

describe("POST /progress/.../quiz (e2e)", () => {
  let app: INestApplication;
  let fixtures: any;
  let studentToken: string;

  let courseId: string;
  let lessonId: string;

  let multipleChoiceBlockId: string;
  let openQuestionBlockId: string;

  const correctOptionId = uuid();
  const wrongOptionId = uuid();

  beforeAll(async () => {
    const res = await bootstrapE2E();
    app = res.app;
    fixtures = res.fixtures;

    const studentRole = await fixtures.createRole({
      name: "student_quiz",
      permissions: [Permission.ENROLLMENTS_READ],
    });

    const user = await fixtures.createUser({
      login: "quiz_student",
      password: "Password123!",
      roleId: studentRole.id,
    });
    studentToken = await fixtures.login("quiz_student", "Password123!");

    const course = await fixtures.createCourse({ title: "Quiz Course" });
    const lesson = await fixtures.createLesson({ courseId: course.id, title: "Interactive Basics" });

    courseId = course.id;
    lessonId = lesson.id;

    const multipleBlock = await fixtures.createBlock({
      lessonId: lesson.id,
      type: BlockType.QuizQuestion,
      requiredAction: BlockRequiredAction.SUBMIT,
      content: {
        type: QuizQuestionType.Multiple,
        question: { json: { text: "Choose correct options" } },
        options: [
          { id: correctOptionId, text: "Correct A", isCorrect: true },
          { id: wrongOptionId, text: "Wrong B", isCorrect: false },
        ],
        explanation: "A is the only correct answer.",
      },
    });
    multipleChoiceBlockId = multipleBlock.id;

    const openBlock = await fixtures.createBlock({
      lessonId: lesson.id,
      type: BlockType.QuizQuestion,
      requiredAction: BlockRequiredAction.SUBMIT,
      content: {
        type: QuizQuestionType.Open,
        question: { json: { text: "Type the exact word" } },
        correctAnswerText: "Athena",
        explanation: "Athena is the goddess of wisdom.",
      },
    });
    openQuestionBlockId = openBlock.id;

    const cohort = await fixtures.createCohort({
      courseId,
      instructorId: (await fixtures.createInstructor()).id,
      name: "Quiz Cohort",
    });
    await fixtures.enrollStudentWithProgress({ userId: user.id, cohortId: cohort.id, courseId });

    await new Promise(r => setTimeout(r, 500));
  }, 60000);

  afterAll(async () => {
    await fixtures.resetDatabase();
    await shutdownE2E(app);
  });

  it("should evaluate Multiple Choice as CORRECT and return explanation", async () => {
    const http = request(app.getHttpServer());

    const payload: SubmitQuizDto = {
      selectedOptionIds: [correctOptionId],
    };

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${multipleChoiceBlockId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isCorrect: true,
      explanation: "A is the only correct answer.",
    });
  });

  it("should evaluate Multiple Choice as WRONG if incorrect option selected", async () => {
    const http = request(app.getHttpServer());

    const payload: SubmitQuizDto = {
      selectedOptionIds: [correctOptionId, wrongOptionId],
    };

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${multipleChoiceBlockId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
  });

  it("should evaluate Open Question as CORRECT ignoring case", async () => {
    const http = request(app.getHttpServer());

    const payload: SubmitQuizDto = {
      textAnswer: "  aThEnA  ",
    };

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${openQuestionBlockId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      isCorrect: true,
      explanation: "Athena is the goddess of wisdom.",
    });
  });

  it("should evaluate Open Question as WRONG for incorrect text", async () => {
    const http = request(app.getHttpServer());

    const payload: SubmitQuizDto = {
      textAnswer: "Zeus",
    };

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${openQuestionBlockId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
  });

  it("should return 400 for invalid UUID in options", async () => {
    const http = request(app.getHttpServer());

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${multipleChoiceBlockId}/quiz`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        selectedOptionIds: ["not-a-uuid"],
      });

    expect(res.status).toBe(400);
  });

  it("should return 401 without token", async () => {
    const http = request(app.getHttpServer());
    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${multipleChoiceBlockId}/quiz`)
      .send({ selectedOptionIds: [correctOptionId] });

    expect(res.status).toBe(401);
  });
});
