// WSL's automatic AI review. Runs two small ML models (trained in
// scripts/ml/train.py on real source code + Wikipedia data, see that file) over
// the student's actual submitted text, so a rating for "Python" means the
// submission was actually checked for Python content rather than assumed from
// evidence type/count. simulateAIReview's rating is informational only — it
// never blocks or gates the workflow; checkRelevance is a separate, explicit
// gate run at evidence intake to reject submissions that have nothing to do
// with the challenge at all. See server/ml/analyze.ts for the analysis itself.
export { checkRelevance, simulateAIReview } from "./ml/analyze.ts"
export type { ChallengeContext, RelevanceCheck, SimulatedRating } from "./ml/analyze.ts"
