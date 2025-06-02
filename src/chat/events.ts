export const EVENTS = {
  // 클라이언트 → 서버: 방 참가 요청
  ROOM_JOIN: 'room:join' as const,
  // 서버 → 클라이언트: 방 참가 완료 알림
  ROOM_JOINED: 'room:joined' as const,

  // 클라이언트 → 서버: 채팅 전송 요청
  CHAT_SEND: 'chat:send' as const,
  // 서버 → 클라이언트: 채팅 메시지 전달
  CHAT_MESSAGE: 'chat:message' as const,
  // 서버 → 클라이언트: 채팅 이력 전송
  MESSAGES: 'messages' as const,

  // 클라이언트 → 서버: 기능 업데이트 요청
  FEATURE_UPDATE: 'feature:update' as const,
  // 서버 → 클라이언트: 기능 업데이트 알림
  FEATURE_UPDATED: 'feature:updated' as const,

  // 클라이언트 → 서버: 퀴즈 생성 요청
  QUIZ_CREATE: 'quiz:create' as const,
  // 서버 → 클라이언트: 퀴즈 생성 결과
  QUIZ_CREATED: 'quiz:created' as const,

  // 클라이언트 → 서버: 추첨 시작 요청
  DRAW_START: 'draw:start' as const,
  // 서버 → 클라이언트: 추첨 결과 전달
  DRAW_RESULT: 'draw:result' as const,

  // 클라이언트 → 서버: 체크 생성 요청
  CHECK_CREATE: 'check:create' as const,
  // 서버 → 클라이언트: 체크 생성 결과
  CHECK_CREATED: 'check:created' as const,
  // 클라이언트 → 서버: 체크 상태 토글 요청
  CHECK_TOGGLE: 'check:toggle' as const,
  // 서버 → 클라이언트: 체크 토글 결과
  CHECK_TOGGLED: 'check:toggled' as const,

  // 클라이언트 → 서버: OX 퀴즈 응답 제출 요청
  OXQUIZ_ANSWER: 'oxquiz:answer' as const,
  // 서버 → 클라이언트: OX 퀴즈 응답 결과 브로드캐스트
  OXQUIZ_ANSWERED: 'oxquiz:answered' as const,
    // 클라이언트 → 서버: OX 퀴즈 생성 요청
  OXQUIZ_CREATE: 'oxquiz:create' as const,
    // 서버 → 클라이언트: OX 퀴즈 생성 결과
  OXQUIZ_CREATED: 'oxquiz:created' as const,
  // 서버 → 클라이언트: 유저 퇴장 알림
  USER_LEFT: 'user:left' as const,
}; 