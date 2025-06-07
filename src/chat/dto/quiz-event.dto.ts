export class QuizEventDto {
  /** 실제 퀴즈 콘텐츠 ID */
  quizId: string;

  /** 생성(false) 또는 제출(true) 여부 */
  isSubmit: boolean;

  /** 이벤트 생성(또는 제출)한 사용자 ID */
  userId: string;

  /** 이벤트 발생 시간 */
  timestamp: Date;
}
