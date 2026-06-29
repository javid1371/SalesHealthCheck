"use client";

import { useCallback, useRef } from "react";
import { scrollToAssessmentTargetAfterLayout } from "@/lib/assessment-scroll";
import type { QuestionDto } from "@/modules/question-bank/question-bank.types";

interface DomainQuestionFormProps {
  questions: QuestionDto[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, optionId: string) => void;
}

export function DomainQuestionForm({
  questions,
  answers,
  onAnswerChange,
}: DomainQuestionFormProps) {
  const anchorRefs = useRef(new Map<string, HTMLDivElement>());

  const handleSelect = useCallback(
    (questionId: string, optionId: string) => {
      onAnswerChange(questionId, optionId);

      const index = questions.findIndex((q) => q.id === questionId);
      if (index + 1 < questions.length) {
        const nextAnchor = anchorRefs.current.get(questions[index + 1].id);
        scrollToAssessmentTargetAfterLayout(nextAnchor);
        return;
      }

      scrollToAssessmentTargetAfterLayout(
        document.getElementById("assessment-actions"),
      );
    },
    [onAnswerChange, questions],
  );

  return (
    <div className="min-w-0 space-y-8">
      {questions.map((question, index) => (
        <fieldset key={question.id} className="min-w-0 w-full space-y-4">
          <legend className="sr-only">{question.text}</legend>
          <div
            ref={(el) => {
              if (el) {
                anchorRefs.current.set(question.id, el);
              } else {
                anchorRefs.current.delete(question.id);
              }
            }}
            className="break-words text-base font-medium leading-7 text-zinc-900"
          >
            <span className="ml-2 text-sm text-zinc-400">{index + 1}.</span>
            {question.text}
          </div>
          <div className="space-y-3">
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 motion-safe:transition motion-safe:active:scale-[0.99] sm:min-h-[3.25rem] sm:items-start sm:p-4 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => handleSelect(question.id, option.id)}
                    className="h-5 w-5 shrink-0 accent-emerald-600 sm:mt-0.5"
                  />
                  <span className="min-w-0 break-words text-sm leading-6 text-zinc-800">
                    {option.text}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function isDomainComplete(
  questions: QuestionDto[],
  answers: Record<string, string>,
): boolean {
  return questions.every((q) => Boolean(answers[q.id]));
}
