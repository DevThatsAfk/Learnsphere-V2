openapi: 3.0.3

info:
  title: LearnSphere API
  version: 1.0.0
  description: >
    Deterministic REST APIs for LearnSphere.
    Backend is the single source of truth.
    No AI-driven decisions. No silent automation.

servers:
  - url: /api

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:

    # ─────────────────────────
    # AUTH
    # ─────────────────────────
    AuthToken:
      type: object
      properties:
        token:
          type: string

    # ─────────────────────────
    # SUBJECTS
    # ─────────────────────────
    Subject:
      type: object
      properties:
        id:
          type: string
        name:
          type: string

    # ─────────────────────────
    # TASKS & CHECKLISTS
    # ─────────────────────────
    Task:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        subject_id:
          type: string
        status:
          type: string
          enum: [NOT_STARTED, IN_PROGRESS, COMPLETED]
        completion_percentage:
          type: integer

    ChecklistItem:
      type: object
      properties:
        id:
          type: string
        label:
          type: string
        is_completed:
          type: boolean

    # ─────────────────────────
    # STUDY SESSIONS
    # ─────────────────────────
    StudySession:
      type: object
      properties:
        id:
          type: string
        subject_id:
          type: string
        topic:
          type: string
        session_type:
          type: string
          enum: [STUDY, REVISION]
        active_minutes:
          type: integer
        start_time:
          type: string
          format: date-time
        end_time:
          type: string
          format: date-time

    SessionStartResponse:
      type: object
      properties:
        id:
          type: string
        start_time:
          type: string
          format: date-time

    SessionEndRequest:
      type: object
      properties:
        active_minutes:
          type: integer

    SessionReview:
      type: object
      properties:
        reflection_text:
          type: string
        tags:
          type: array
          items:
            type: string

    # ─────────────────────────
    # EXAMS & MARKS
    # ─────────────────────────
    Exam:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        exam_date:
          type: string
          format: date

    ExamMark:
      type: object
      properties:
        subject_id:
          type: string
        marks:
          type: integer

    # ─────────────────────────
    # ANALYTICS
    # ─────────────────────────
    AnalyticsSnapshot:
      type: object
      properties:
        subject_id:
          type: string
        total_active_minutes:
          type: integer
        average_marks:
          type: number

    ConsistencyDay:
      type: object
      properties:
        date:
          type: string
          format: date
        active_minutes:
          type: integer
        is_active:
          type: boolean

    TodayOverview:
      type: object
      properties:
        total_active_minutes:
          type: integer
        sessions_count:
          type: integer

    NeglectSignal:
      type: object
      properties:
        subject_id:
          type: string
        days_since_last_activity:
          type: integer

    # ─────────────────────────
    # REVIEW & FLASHCARDS
    # ─────────────────────────
    ReviewItem:
      type: object
      properties:
        review_id:
          type: string
        subject_id:
          type: string
        topic:
          type: string
        recall_strength:
          type: string
          enum: [WEAK, MODERATE, STRONG]

    Flashcard:
      type: object
      properties:
        card_id:
          type: string
        question:
          type: string

    FlashcardResult:
      type: object
      properties:
        recall_strength:
          type: string
          enum: [WEAK, MODERATE, STRONG]

# ─────────────────────────
# PATHS
# ─────────────────────────
paths:

  # AUTH
  /auth/login:
    post:
      summary: Login user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                password:
                  type: string
      responses:
        '200':
          description: Authenticated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthToken'

  # SUBJECTS
  /subjects:
    get:
      summary: Get all subjects
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Subject'
    post:
      summary: Create subject
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Created

  # TASKS
  /tasks:
    get:
      summary: Get all tasks
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Task'

  /tasks/{taskId}/checklist:
    get:
      summary: Get checklist for task
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ChecklistItem'

  /tasks/{taskId}/checklist/{itemId}:
    patch:
      summary: Update checklist item
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
        - name: itemId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                is_completed:
                  type: boolean
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChecklistItem'

  # SESSIONS
  /sessions/start:
    post:
      summary: Start study session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                subject_id:
                  type: string
                topic:
                  type: string
                session_type:
                  type: string
      responses:
        '200':
          description: Started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionStartResponse'

  /sessions/{sessionId}/end:
    post:
      summary: End study session
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SessionEndRequest'
      responses:
        '200':
          description: Ended
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StudySession'

  /sessions/{sessionId}/review:
    post:
      summary: Submit session review
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SessionReview'
      responses:
        '201':
          description: Stored

  # EXAMS
  /exams:
    get:
      summary: Get exams
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Exam'
    post:
      summary: Create exam
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                exam_date:
                  type: string
      responses:
        '201':
          description: Created

  /exams/{examId}/marks:
    get:
      summary: Get marks for exam
      parameters:
        - name: examId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ExamMark'
    post:
      summary: Add marks for exam
      parameters:
        - name: examId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/ExamMark'
      responses:
        '201':
          description: Stored

  # ANALYTICS
  /analytics/overview:
    get:
      summary: Subject-wise analytics snapshot
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AnalyticsSnapshot'

  /analytics/consistency:
    get:
      summary: Consistency calendar
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ConsistencyDay'

  /analytics/today:
    get:
      summary: Today overview
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodayOverview'

  /analytics/neglect:
    get:
      summary: Neglect signals
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/NeglectSignal'

  # REVIEW
  /reviews:
    get:
      summary: Review queue
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ReviewItem'

  /reviews/{reviewId}/flashcards:
    get:
      summary: Get flashcards
      parameters:
        - name: reviewId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Flashcard'

  /reviews/{reviewId}/flashcards/{cardId}:
    post:
      summary: Submit flashcard result
      parameters:
        - name: reviewId
          in: path
          required: true
          schema:
            type: string
        - name: cardId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/FlashcardResult'
      responses:
        '200':
          description: Stored