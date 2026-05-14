/**
 * Reusable Likert-style survey step.
 * Supports BARC-10 (0-4 scale) and QoL (1-5 scale).
 */

const BARC10_QUESTIONS = [
  "I feel I belong to a community that supports my recovery.",
  "I feel that I have people I can rely on for help.",
  "I have hope for my future.",
  "I feel that my life has purpose and meaning.",
  "I am managing my finances in a responsible way.",
  "I am engaging in meaningful daily activities.",
  "I am coping with urges or cravings to use substances.",
  "I feel physically healthy.",
  "I feel mentally and emotionally stable.",
  "I am working toward my personal goals.",
];

const BARC10_LABELS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
const BARC10_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981'];

const QOL_QUESTIONS = [
  "How satisfied are you with the quality of your life overall?",
  "How satisfied are you with your physical health?",
  "How satisfied are you with your mental health and emotional wellbeing?",
  "How satisfied are you with your relationships with family or friends?",
  "How satisfied are you with your living situation?",
  "How satisfied are you with your sense of safety and security?",
  "How satisfied are you with your sense of purpose or direction in life?",
];

const QOL_LABELS = ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'];
const QOL_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981'];

function LikertQuestion({ question, index, value, onChange, labels, colors, scale }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700 font-medium leading-snug">
        <span className="text-slate-400 mr-1">{index + 1}.</span>{question}
      </p>
      <div className="flex gap-1">
        {scale.map((val, i) => (
          <button
            key={val}
            onClick={() => onChange(val)}
            title={labels[i]}
            className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all border-2 ${
              value === val ? 'scale-105 border-transparent text-white' : 'border-slate-200 text-slate-400 hover:border-slate-300'
            }`}
            style={value === val ? { background: colors[i] } : {}}
          >
            {val}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-0.5">
        <span className="text-xs text-slate-400">{labels[0]}</span>
        <span className="text-xs text-slate-400">{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

export function BARC10Survey({ answers, onChange }) {
  const scale = [0, 1, 2, 3, 4];
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
          BARC-10 · Recovery Capital
        </div>
        <h3 className="font-bold text-slate-800 text-base">How is your recovery going?</h3>
        <p className="text-slate-400 text-xs mt-1">Rate how much you agree with each statement this week.</p>
      </div>
      {BARC10_QUESTIONS.map((q, i) => (
        <LikertQuestion
          key={i}
          question={q}
          index={i}
          value={answers[i]}
          onChange={val => onChange(i, val)}
          labels={BARC10_LABELS}
          colors={BARC10_COLORS}
          scale={scale}
        />
      ))}
      {Object.keys(answers).length === BARC10_QUESTIONS.length && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
          <p className="text-indigo-700 font-bold text-lg">
            Score: {Object.values(answers).reduce((a, b) => a + b, 0)} / 40
          </p>
          <p className="text-indigo-500 text-xs">Higher scores = stronger recovery capital</p>
        </div>
      )}
    </div>
  );
}

export function QoLSurvey({ answers, onChange }) {
  const scale = [1, 2, 3, 4, 5];
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
          Quality of Life Survey
        </div>
        <h3 className="font-bold text-slate-800 text-base">How are you feeling about your life?</h3>
        <p className="text-slate-400 text-xs mt-1">Rate your satisfaction in each area.</p>
      </div>
      {QOL_QUESTIONS.map((q, i) => (
        <LikertQuestion
          key={i}
          question={q}
          index={i}
          value={answers[i]}
          onChange={val => onChange(i, val)}
          labels={QOL_LABELS}
          colors={QOL_COLORS}
          scale={scale}
        />
      ))}
      {Object.keys(answers).length === QOL_QUESTIONS.length && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center">
          <p className="text-teal-700 font-bold text-lg">
            Score: {Object.values(answers).reduce((a, b) => a + b, 0)} / 35
          </p>
          <p className="text-teal-500 text-xs">Higher scores = greater quality of life</p>
        </div>
      )}
    </div>
  );
}

export const BARC10_COUNT = BARC10_QUESTIONS.length;
export const QOL_COUNT = QOL_QUESTIONS.length;