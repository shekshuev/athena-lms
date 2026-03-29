import type { StudentSubmissionRequest, StudentLessonView, StudentDashboardView, CheckQuizQuestionResponse, CheckQuizQuestionRequest, QuizAttemptResponse, SubmitExamResponse, SubmitExamRequest } from '@athena/types'

export const useLearning = () => {
  const { t } = useI18n()
  const toast = useToast()

  const fetchMyDashboard = async () => {
    try {
      const data = await $api<StudentDashboardView[]>('/api/progress', {
        method: 'GET'
      })
      return data
    } catch (error: unknown) {
      console.error(error)
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.dashboard-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const fetchMyProgress = async (courseId: string) => {
    try {
      const data = await $api<StudentDashboardView>(`/api/progress/${courseId}`, {
        method: 'GET'
      })
      return data
    } catch (error: unknown) {
      console.error(error)
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.progress-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const fetchLesson = async (courseId: string, lessonId: string) => {
    try {
      const data = await $api<StudentLessonView>(`/api/progress/${courseId}/lesson/${lessonId}`, {
        method: 'GET'
      })
      return data
    } catch (error: unknown) {
      console.error(error)
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.lesson-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const markAsViewed = async (courseId: string, lessonId: string, blockId: string) => {
    try {
      const data = await $api<{ status: string, score: number }>(`/api/progress/${courseId}/lessons/${lessonId}/blocks/${blockId}/view`, {
        method: 'POST'
      })
      return data
    } catch (error: unknown) {
      console.error(error)
      throw error
    }
  }

  const submitAssignment = async (courseId: string, lessonId: string, blockId: string, payload: StudentSubmissionRequest) => {
    try {
      const data = await $api<{ status: string }>(`/api/progress/${courseId}/lessons/${lessonId}/blocks/${blockId}/submit`, {
        method: 'POST',
        body: payload
      })

      toast.add({
        title: t('common.success'),
        description: t('toasts.learning.submission-sent'),
        color: 'success',
        icon: 'i-lucide-check-circle'
      })

      return data
    } catch (error: unknown) {
      console.error(error)
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.submission-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const submitQuiz = async (courseId: string, lessonId: string, blockId: string, payload: CheckQuizQuestionRequest) => {
    try {
      return await $api<CheckQuizQuestionResponse>(`/api/progress/${courseId}/lessons/${lessonId}/blocks/${blockId}/quiz`, {
        method: 'POST',
        body: payload
      })
    } catch (error: unknown) {
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.submit-quiz-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const getActiveExam = async (courseId: string, lessonId: string, blockId: string) => {
    try {
      return await $api<QuizAttemptResponse | null>(`/api/progress/${courseId}/lessons/${lessonId}/blocks/${blockId}/exam/active`, {
        method: 'GET'
      })
    } catch (error: unknown) {
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.get-active-exam-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const startExam = async (courseId: string, lessonId: string, blockId: string) => {
    try {
      return await $api<QuizAttemptResponse>(`/api/progress/${courseId}/lessons/${lessonId}/blocks/${blockId}/exam/start`, {
        method: 'POST'
      })
    } catch (error: unknown) {
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.start-exam-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  const submitExam = async (courseId: string, lessonId: string, blockId: string, payload: SubmitExamRequest) => {
    try {
      return await $api<SubmitExamResponse>(`/api/progress/${courseId}/lessons/${lessonId}/blocks/${blockId}/exam/submit`, {
        method: 'POST',
        body: payload
      })
    } catch (error: unknown) {
      toast.add({
        title: t('common.error'),
        description: t('toasts.learning.submit-exam-error'),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      throw error
    }
  }

  return {
    fetchMyDashboard,
    fetchMyProgress,
    fetchLesson,
    markAsViewed,
    submitAssignment,
    submitQuiz,
    getActiveExam,
    startExam,
    submitExam
  }
}
