import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class QuizResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const isProfessor = request.user?.role === 'professor';
    return next.handle().pipe(
      map((quiz: any) => {
        const path: string = request.url || '';
        // Do not strip fields for professors or on the score endpoint
        if (
          !isProfessor &&
          quiz &&
          Array.isArray(quiz.questions) &&
          !path.includes('/score')
        ) {
          const filteredQuestions = quiz.questions.map((q: any) => ({
            id: q.id,
            quizId: q.quizId,
            question: q.question,
            choices: q.choices,
          }));
          return { ...quiz, questions: filteredQuestions };
        }
        return quiz;
      }),
    );
  }
}
