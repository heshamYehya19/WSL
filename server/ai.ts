// WSL's automatic AI review. Runs two small ML models (trained in
// scripts/ml/train.py on real source code + Wikipedia data, see that file) over
// the student's actual submitted text, so a rating for "Python" means the
// submission was actually checked for Python content rather than assumed from
// evidence type/count. Automatic and informational only — never blocks or
// gates anything in the workflow. See server/ml/analyze.ts for the analysis
// itself.
export { simulateAIReview } from "./ml/analyze.ts"
export type { ChallengeContext, SimulatedRating } from "./ml/analyze.ts"
