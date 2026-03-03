# Database Schema — LearnSphere

users(id, email, password_hash, role)

subjects(id, user_id, name)

tasks(id, subject_id, title, status, completion_percentage)

task_checklists(id, task_id, label, is_completed)

study_sessions(id, subject_id, topic, session_type, active_minutes, start_time, end_time, reflection_text, tags)

exams(id, title, exam_date)

exam_marks(id, exam_id, subject_id, marks)

analytics_snapshots(subject_id, total_active_minutes, average_marks)

review_items(id, subject_id, topic, recall_strength)

flashcards(id, review_item_id, question, answer)

END.