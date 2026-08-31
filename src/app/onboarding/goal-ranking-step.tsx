"use client";

import { useRef, useState } from "react";

import { GOALS } from "@/lib/validation/onboarding";

type Props = {
  ranking: string[];
  onChange: (ranking: string[]) => void;
};

export function GoalRankingStep({ ranking, onChange }: Props) {
  const [items, setItems] = useState<string[]>(
    ranking.length > 0 ? ranking : [...GOALS],
  );
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  const commit = (next: string[]) => {
    setItems(next);
    onChange(next);
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    dragIndex.current = index;
    setDraggingIndex(index);
    commit(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDraggingIndex(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    commit(next);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    commit(next);
  };

  return (
    <section>
      <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
        What matters most to you?
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
        Drag to rank these goals — most important at the top. Pace will
        personalise your experience around your top goal.
      </p>

      <ul
        className="space-y-2"
        role="listbox"
        aria-label="Goal ranking"
      >
        {items.map((goal, index) => {
          const isDragging = draggingIndex === index;
          return (
            <li
              key={goal}
              role="option"
              aria-selected={false}
              aria-label={`${index + 1}. ${goal}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={[
                "flex items-center gap-3 p-4 border rounded-xl bg-surface select-none transition-all duration-150",
                isDragging
                  ? "border-primary shadow-md opacity-50 bg-secondary-container/20"
                  : "border-outline-variant hover:border-primary",
              ].join(" ")}
              style={{ cursor: "grab" }}
            >
              <span
                className="material-symbols-outlined text-outline shrink-0 text-[20px]"
                aria-hidden="true"
              >
                drag_indicator
              </span>

              <span
                className={[
                  "w-6 h-6 rounded-full flex items-center justify-center font-label-sm text-label-sm shrink-0 transition-colors",
                  index === 0
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-highest text-outline",
                ].join(" ")}
                aria-hidden="true"
              >
                {index + 1}
              </span>

              <span className="flex-grow font-body-md text-body-md">{goal}</span>

              <div className="flex flex-col gap-0.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveUp(index);
                  }}
                  disabled={index === 0}
                  aria-label={`Move "${goal}" up`}
                  className="text-outline-variant hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors leading-none"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    keyboard_arrow_up
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveDown(index);
                  }}
                  disabled={index === items.length - 1}
                  aria-label={`Move "${goal}" down`}
                  className="text-outline-variant hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors leading-none"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    keyboard_arrow_down
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="font-body-sm text-body-sm text-outline mt-stack-md">
        Your top goal influences how Pace frames recommendations and plans.
      </p>
    </section>
  );
}
