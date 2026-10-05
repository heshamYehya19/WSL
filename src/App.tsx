import { lazy, useEffect } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { PublicLayout } from "./components/layout/PublicLayout"
import { AppShell } from "./components/layout/AppShell"

import Landing from "./pages/public/Landing"
import About from "./pages/public/About"
import HowItWorks from "./pages/public/HowItWorks"
import ForStudents from "./pages/public/ForStudents"
import ForUniversities from "./pages/public/ForUniversities"
import ForCompanies from "./pages/public/ForCompanies"
import DemoLogin from "./pages/public/DemoLogin"

// Per-role pages are lazy-loaded — they're only ever reached after signing in
// (via DemoLogin), so splitting them out keeps the public-page first paint small
// without needing a loading flash on the pages people actually land on cold.
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"))
const ChallengeDiscovery = lazy(() => import("./pages/student/ChallengeDiscovery"))
const ChallengeDetails = lazy(() => import("./pages/student/ChallengeDetails"))
const MyProjects = lazy(() => import("./pages/student/MyProjects"))
const ProjectWorkspace = lazy(() => import("./pages/student/ProjectWorkspace"))
const MyProfile = lazy(() => import("./pages/student/MyProfile"))
const Opportunities = lazy(() => import("./pages/student/Opportunities"))
const OpportunityDetail = lazy(() => import("./pages/student/OpportunityDetail"))

const UniversityDashboard = lazy(() => import("./pages/university/UniversityDashboard"))
const UniversityChallenges = lazy(() => import("./pages/university/UniversityChallenges"))
const ChallengeReview = lazy(() => import("./pages/university/ChallengeReview"))
const StudentProjects = lazy(() => import("./pages/university/StudentProjects"))
const ProjectMonitoring = lazy(() => import("./pages/university/ProjectMonitoring"))
const SubmissionsQueue = lazy(() => import("./pages/university/SubmissionsQueue"))
const SkillsOverview = lazy(() => import("./pages/university/SkillsOverview"))
const IndustryInsights = lazy(() => import("./pages/university/IndustryInsights"))
const UniversityStudentDetail = lazy(() => import("./pages/university/UniversityStudentDetail"))

const CompanyDashboard = lazy(() => import("./pages/company/CompanyDashboard"))
const SubmitChallenge = lazy(() => import("./pages/company/SubmitChallenge"))
const MyChallenges = lazy(() => import("./pages/company/MyChallenges"))
const ChallengeStatus = lazy(() => import("./pages/company/ChallengeStatus"))
const TalentDiscovery = lazy(() => import("./pages/company/TalentDiscovery"))
const CandidateProfile = lazy(() => import("./pages/company/CandidateProfile"))
const CompanySubmission = lazy(() => import("./pages/company/CompanySubmission"))

import NotFound from "./pages/NotFound"

/** New page, new scroll position — React Router doesn't reset it on its own. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/for-students" element={<ForStudents />} />
        <Route path="/for-universities" element={<ForUniversities />} />
        <Route path="/for-companies" element={<ForCompanies />} />
        <Route path="/login" element={<DemoLogin />} />
      </Route>

      <Route path="/student" element={<AppShell role="student" />}>
        <Route index element={<StudentDashboard />} />
        <Route path="challenges" element={<ChallengeDiscovery />} />
        <Route path="challenges/:id" element={<ChallengeDetails />} />
        <Route path="projects" element={<MyProjects />} />
        <Route path="projects/:id" element={<ProjectWorkspace />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="opportunities/:id" element={<OpportunityDetail />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>

      <Route path="/university" element={<AppShell role="university" />}>
        <Route index element={<UniversityDashboard />} />
        <Route path="challenges" element={<UniversityChallenges />} />
        <Route path="challenges/:id" element={<ChallengeReview />} />
        <Route path="projects" element={<StudentProjects />} />
        <Route path="projects/:id" element={<ProjectMonitoring />} />
        <Route path="submissions" element={<SubmissionsQueue />} />
        <Route path="students" element={<SkillsOverview />} />
        <Route path="students/:id" element={<UniversityStudentDetail />} />
        <Route path="insights" element={<IndustryInsights />} />
      </Route>

      <Route path="/company" element={<AppShell role="company" />}>
        <Route index element={<CompanyDashboard />} />
        <Route path="submit" element={<SubmitChallenge />} />
        <Route path="challenges" element={<MyChallenges />} />
        <Route path="challenges/:id" element={<ChallengeStatus />} />
        <Route path="talent" element={<TalentDiscovery />} />
        <Route path="talent/:id" element={<CandidateProfile />} />
        <Route path="submissions/:projectId" element={<CompanySubmission />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}
