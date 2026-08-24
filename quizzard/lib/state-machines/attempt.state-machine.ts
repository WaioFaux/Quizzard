import { AttemptStatus } from "@prisma/client";
import { IllegalTransitionError } from "../utils/errors";

type AttemptTransition = {
  from: AttemptStatus;
  to: AttemptStatus;
};

const LEGAL_TRANSITIONS: AttemptTransition[] = [
  { from: AttemptStatus.IN_PROGRESS, to: AttemptStatus.SUBMITTED },
  { from: AttemptStatus.IN_PROGRESS, to: AttemptStatus.AUTO_SUBMITTED },
];

export function transitionAttempt(
  from: AttemptStatus,
  to: AttemptStatus
): void {
  const isLegal = LEGAL_TRANSITIONS.some(
    (t) => t.from === from && t.to === to
  );

  if (!isLegal) {
    throw new IllegalTransitionError("Attempt", from, to);
  }
}
