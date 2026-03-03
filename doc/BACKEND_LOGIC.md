# Backend Logic — LearnSphere

## Core Principles
- Deterministic
- Explainable
- No AI decisions
- No silent automation

## Services
- AuthService
- SubjectService
- TaskService
- SessionService
- AnalyticsService
- ReviewService

## Analytics Rules
- Active Day ≥ 18 minutes
- Neglect ≥ 14 days inactivity
- Weak Subject = lowest marks OR downward trend

## AI Boundary
AI may:
- Summarize user text
- Phrase flashcard questions

AI may NOT:
- Compute analytics
- Detect risks
- Schedule automatically

END.