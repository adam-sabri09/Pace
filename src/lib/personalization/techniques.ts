import type { TechniqueKey } from './types';

export interface TechniqueInfo {
  key: TechniqueKey;
  label: string;
  shortDescription: string;
  sessionInstruction: string;
  bestFor: string[];
}

export const TECHNIQUES: Record<TechniqueKey, TechniqueInfo> = {
  active_recall: {
    key: 'active_recall',
    label: 'Active Recall',
    shortDescription: 'Test yourself without looking at notes.',
    sessionInstruction:
      'Close your notes. Write down everything you remember about the topic, then check. Repeat until you can recall it cleanly.',
    bestFor: ['memory challenges', 'exam preparation', 'building long-term retention'],
  },
  spaced_repetition: {
    key: 'spaced_repetition',
    label: 'Spaced Repetition',
    shortDescription: 'Review material at increasing intervals.',
    sessionInstruction:
      'Work through your flashcards or question set. Move cards you got right into a longer-interval pile and review the ones you missed again at the end.',
    bestFor: ['memorising large amounts of content', 'vocabulary', 'definitions and facts'],
  },
  practice_testing: {
    key: 'practice_testing',
    label: 'Practice Testing',
    shortDescription: 'Work through past papers and exam-style questions.',
    sessionInstruction:
      'Work through practice questions or a past paper section under timed, exam conditions. Review every answer — especially the ones you got right — to understand why.',
    bestFor: ['exam readiness', 'understanding question types', 'spotting gaps'],
  },
  pomodoro: {
    key: 'pomodoro',
    label: 'Pomodoro',
    shortDescription: 'Focused sprints with short breaks.',
    sessionInstruction:
      'Set a timer for 25 minutes. Work on only this topic — no phone, no tabs. When the timer rings, take a 5-minute break before continuing.',
    bestFor: ['focus problems', 'building a study habit', 'avoiding burnout'],
  },
  deep_work: {
    key: 'deep_work',
    label: 'Deep Work',
    shortDescription: 'Sustained, distraction-free focus on a hard problem.',
    sessionInstruction:
      'Clear everything else. Spend the full session on the hardest concept in this topic. No notifications, no switching. Go slow and go deep.',
    bestFor: ['understanding complex ideas', 'long focus spans', 'difficult subjects'],
  },
  feynman: {
    key: 'feynman',
    label: 'Feynman Technique',
    shortDescription: 'Explain the concept as if teaching it.',
    sessionInstruction:
      "Write an explanation of this topic as if you were teaching it to someone who knows nothing. Every time you get stuck, that gap is what you study next.",
    bestFor: ['understanding', 'spotting misconceptions', 'consolidating notes'],
  },
  interleaving: {
    key: 'interleaving',
    label: 'Interleaving',
    shortDescription: 'Mix topics or subjects within a single session.',
    sessionInstruction:
      'Divide the session into short blocks and rotate between two or three different topics or question types. Mixing forces your brain to retrieve differently each time.',
    bestFor: ['juggling many subjects', 'avoiding the "I know it" trap', 'building flexible recall'],
  },
};
