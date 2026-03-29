import { BlockRequiredAction, BlockType, Permission, QuizAttemptStatus, QuizQuestionType } from "@athena/types";
import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { bootstrapE2E, shutdownE2E } from "../bootstrap-e2e";

describe("POST /progress/.../exam/start (e2e)", () => {
  let app: INestApplication;
  let fixtures: any;
  let studentToken: string;

  let courseId: string;
  let lessonId: string;

  let examBlockId: string;
  let textBlockId: string;

  let firstAttemptId: string;

  beforeAll(async () => {
    const res = await bootstrapE2E();
    app = res.app;
    fixtures = res.fixtures;

    // 1. Создаем студента с правами
    const studentRole = await fixtures.createRole({
      name: "student_exam_starter",
      permissions: [Permission.ENROLLMENTS_READ],
    });

    const user = await fixtures.createUser({
      login: "exam_starter",
      password: "Password123!",
      roleId: studentRole.id,
    });
    studentToken = await fixtures.login("exam_starter", "Password123!");

    // 2. Создаем курс и урок
    const course = await fixtures.createCourse({ title: "Exam Course" });
    const lesson = await fixtures.createLesson({ courseId: course.id, title: "Final Test" });

    courseId = course.id;
    lessonId = lesson.id;

    // 3. Создаем вопросы в БИБЛИОТЕКЕ (LibraryBlocks), чтобы экзамену было откуда их тянуть
    await fixtures.createLibraryBlock({
      type: BlockType.QuizQuestion,
      tags: ["e2e-exam"],
      content: {
        type: QuizQuestionType.Single,
        question: { json: { text: "Library Question 1" } },
        options: [
          { id: "opt-1", text: "Correct A", isCorrect: true },
          { id: "opt-2", text: "Wrong B", isCorrect: false },
        ],
        explanation: "Because A.",
      },
    });

    await fixtures.createLibraryBlock({
      type: BlockType.QuizQuestion,
      tags: ["e2e-exam"],
      content: {
        type: QuizQuestionType.Open,
        question: { json: { text: "Library Question 2" } },
        correctAnswerText: "Secret Answer",
        explanation: "Top secret.",
      },
    });

    // 4. Создаем блок Экзамена в уроке
    const examBlock = await fixtures.createBlock({
      lessonId: lesson.id,
      type: BlockType.QuizExam,
      requiredAction: BlockRequiredAction.SUBMIT,
      content: {
        title: "E2E Final Exam",
        timeLimitMinutes: 10,
        passPercentage: 80,
        source: {
          includeTags: ["e2e-exam"],
          count: 2,
        },
      },
    });
    examBlockId = examBlock.id;

    // 5. Создаем обычный Text блок (для негативного теста)
    const textBlock = await fixtures.createBlock({
      lessonId: lesson.id,
      type: BlockType.Text,
      requiredAction: BlockRequiredAction.VIEW,
      content: { json: { text: "Just a text" } },
    });
    textBlockId = textBlock.id;

    // 6. Записываем студента на курс
    const cohort = await fixtures.createCohort({
      courseId,
      instructorId: (await fixtures.createInstructor()).id,
      name: "Exam Cohort",
    });
    await fixtures.enrollStudentWithProgress({ userId: user.id, cohortId: cohort.id, courseId });

    await new Promise(r => setTimeout(r, 500));
  }, 60000);

  afterAll(async () => {
    await fixtures.resetDatabase();
    await shutdownE2E(app);
  });

  it("should generate a new exam attempt and STRIP correct answers", async () => {
    const http = request(app.getHttpServer());

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${examBlockId}/exam/start`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(QuizAttemptStatus.IN_PROGRESS);
    expect(res.body.timeLimitMinutes).toBe(10);
    expect(res.body.questions).toHaveLength(2);

    firstAttemptId = res.body.id; // Запоминаем ID для следующего теста

    // ПРОВЕРКА БЕЗОПАСНОСТИ: Убеждаемся, что секреты вырезаны из слепка
    const questions = res.body.questions;
    for (const q of questions) {
      expect(q).not.toHaveProperty("explanation");
      expect(q).not.toHaveProperty("correctAnswerText");

      if (q.options) {
        for (const opt of q.options) {
          expect(opt).not.toHaveProperty("isCorrect");
        }
      }
    }
  });

  it("should return the EXACT SAME attempt if the user calls start again (idempotency)", async () => {
    const http = request(app.getHttpServer());

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${examBlockId}/exam/start`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send();

    expect(res.status).toBe(200);
    // ID должен совпадать с тем, что сгенерировался в первом тесте
    expect(res.body.id).toBe(firstAttemptId);
    expect(res.body.questions).toHaveLength(2);
  });

  it("should return 400 Bad Request if attempting to start exam on a non-exam block", async () => {
    const http = request(app.getHttpServer());

    const res = await http
      .post(`/progress/${courseId}/lessons/${lessonId}/blocks/${textBlockId}/exam/start`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Block is not an exam");
  });

  it("should return 401 without token", async () => {
    const http = request(app.getHttpServer());
    const res = await http.post(`/progress/${courseId}/lessons/${lessonId}/blocks/${examBlockId}/exam/start`).send();

    expect(res.status).toBe(401);
  });
});
