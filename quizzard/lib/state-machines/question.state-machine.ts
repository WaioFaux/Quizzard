import { QuestionStatus } from "@prisma/client";
import { IllegalTransitionError } from "../utils/errors";

type QuestionTransition = {
  from: QuestionStatus;
  to: QuestionStatus;
};

const LEGAL_TRANSITIONS: QuestionTransition[] = [
  { from: QuestionStatus.DRAFT, to: QuestionStatus.APPROVED },
  { from: QuestionStatus.DRAFT, to: QuestionStatus.FLAGGED_FOR_REVIEW },
  { from: QuestionStatus.FLAGGED_FOR_REVIEW, to: QuestionStatus.APPROVED },
  { from: QuestionStatus.FLAGGED_FOR_REVIEW, to: QuestionStatus.DRAFT },
  { from: QuestionStatus.APPROVED, to: QuestionStatus.FLAGGED_FOR_REVIEW },
  { from: QuestionStatus.APPROVED, to: QuestionStatus.DRAFT },
];

export function transitionQuestion(
  from: QuestionStatus,
  to: QuestionStatus
): void {
  const isLegal = LEGAL_TRANSITIONS.some(
    (t) => t.from === from && t.to === to
  );

  if (!isLegal) {
    throw new IllegalTransitionError("Question", from, to);
  }
}
