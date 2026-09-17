import { Route, Routes } from "react-router-dom"
import { PublicLayout } from "./components/layout/PublicLayout"
import { AppShell } from "./components/layout/AppShell"

import Landing from "./pages/public/Landing"
import About from "./pages/public/About"
import HowItWorks from "./pages/public/HowItWorks"
import ForStudents from "./pages/public/ForStudents"
import ForUniversities from "./pages/public/ForUniversities"
import ForCompanies from "./pages/public/ForCompanies"
import DemoLogin from "./pages/public/DemoLogin"

import StudentDashboard from "./pages/student/StudentDashboard"
import ChallengeDiscovery from "./pages/student/ChallengeDiscovery"
import ChallengeDetails from "./pages/student/ChallengeDetails"
import MyProjects from "./pages/student/MyProjects"
import ProjectWorkspace from "./pages/student/ProjectWorkspace"
import MySkills from "./pages/student/MySkills"
import MyProfile from "./pages/student/MyProfile"
import Opportunities from "./pages/student/Opportunities"
import OpportunityDetail from "./pages/student/OpportunityDetail"

import UniversityDashboard from "./pages/university/UniversityDashboard"
import UniversityChallenges from "./pages/university/UniversityChallenges"
import ChallengeReview from "./pages/university/ChallengeReview"
import StudentProjects from "./pages/university/StudentProjects"
import ProjectMonitoring from "./pages/university/ProjectMonitoring"
import EvidenceReview from "./pages/university/EvidenceReview"
import VerificationQueue from "./pages/university/VerificationQueue"
import VerificationDetail from "./pages/university/VerificationDetail"
import SkillsOverview from "./pages/university/SkillsOverview"
import UniversityStudentDetail from "./pages/university/UniversityStudentDetail"

import CompanyDashboard from "./pages/company/CompanyDashboard"
import SubmitChallenge from "./pages/company/SubmitChallenge"
import MyChallenges from "./pages/company/MyChallenges"
import ChallengeStatus from "./pages/company/ChallengeStatus"
import TalentDiscovery from "./pages/company/TalentDiscovery"
import CandidateProfile from "./pages/company/CandidateProfile"
import CompanyEvidenceView from "./pages/company/CompanyEvidenceView"

import NotFound from "./pages/NotFound"

export default function App() {
  return (
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
        <Route path="skills" element={<MySkills />} />
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
        <Route path="evidence" element={<EvidenceReview />} />
        <Route path="verification" element={<VerificationQueue />} />
        <Route path="verification/:signalId" element={<VerificationDetail />} />
        <Route path="students" element={<SkillsOverview />} />
        <Route path="students/:id" element={<UniversityStudentDetail />} />
      </Route>

      <Route path="/company" element={<AppShell role="company" />}>
        <Route index element={<CompanyDashboard />} />
        <Route path="submit" element={<SubmitChallenge />} />
        <Route path="challenges" element={<MyChallenges />} />
        <Route path="challenges/:id" element={<ChallengeStatus />} />
        <Route path="talent" element={<TalentDiscovery />} />
        <Route path="talent/:id" element={<CandidateProfile />} />
        <Route path="evidence/:projectId/:studentId" element={<CompanyEvidenceView />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
