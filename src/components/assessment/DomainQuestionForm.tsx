"use client";

import { useCallback, useRef } from "react";
import type { QuestionDto } from "@/modules/question-bank/question-bank.types";

interface DomainQuestionFormProps {
  questions: QuestionDto[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, optionId: string) => void;
}

function scrollToElement(element: HTMLElement) {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  element.scrollIntoView({
    behavior: reducedMotion ? "instant" : "smooth",
    block: "start",
  });
}

export function DomainQuestionForm({
  questions,
  answers,
  onAnswerChange,
}: DomainQuestionFormProps) {
  const legendRefs = useRef(new Map<string, HTMLLegendElement>());

  const handleSelect = useCallback(
    (questionId: string, optionId: string) => {
      onAnswerChange(questionId, optionId);

      const index = questions.findIndex((q) => q.id === questionId);
      requestAnimationFrame(() => {
        if (index + 1 < questions.length) {
          const nextLegend = legendRefs.current.get(questions[index + 1].id);
          if (nextLegend) scrollToElement(nextLegend);
          return;
        }

        const actionsEl = document.getElementById("assessment-actions");
        if (actionsEl) scrollToElement(actionsEl);
      });
    },
    [onAnswerChange, questions],
  );

  return (
    <div className="space-y-8">
      {questions.map((question, index) => (
        <fieldset key={question.id} className="space-y-4">
          <legend
            ref={(el) => {
              if (el) {
                legendRefs.current.set(question.id, el);
              } else {
                legendRefs.current.delete(question.id);
              }
            }}
            className="scroll-mt-[var(--assessment-scroll-offset)] break-words text-base font-medium leading-7 text-zinc-900"
          >
            <span className="ml-2 text-sm text-zinc-400">
              {index + 1}.
            </span>
            {question.text}
          </legend>
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
