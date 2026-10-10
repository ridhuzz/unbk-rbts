export interface School {
    name: string;
    level: string;
    tagline?: string;
    logo: string | null;
    banner: string | null;
    color: string;
}

export interface StudentInfo {
    id: number;
    exam_number: string;
    name: string;
    gender: 'L' | 'P' | null;
    tingkat: string | null;
    grade: string | null;
    major: string | null;
    class_name: string | null;
    session_no: number;
    photo: string | null;
}

export type ExamWindow = 'inactive' | 'not_started' | 'open' | 'closed';
export type ExamStatus = 'draft' | 'active' | 'finished';
export type AttemptStatus = 'in_progress' | 'finished' | 'force_finished';

export interface AvailableExam {
    id: number;
    name: string;
    subject: string;
    exam_date: string;
    start_time: string;
    late_limit_time: string;
    duration_minutes: number;
    total_questions: number;
    window: ExamWindow;
    show_token: boolean;
    token_hint: string | null;
    attempt_status: AttemptStatus | null;
    score: number | null;
    instructions: string | null;
}

export interface AttemptHistory {
    id: number;
    exam: string;
    subject: string;
    exam_date: string;
    finished_at: string | null;
    published: boolean;
    score: number | null;
    correct: number | null;
    total: number;
}

export interface QuestionOption {
    key: string;
    body: string;
    image: string | null;
}

export interface StudentQuestion {
    id: number;
    position: number;
    type: 'multiple_choice' | 'essay';
    body: string;
    image: string | null;
    audio: string | null;
    video: string | null;
    options: QuestionOption[];
    answer: string | null;
    essay_answer: string | null;
    is_doubtful: boolean;
}

export interface AttemptInfo {
    id: number;
    status: AttemptStatus;
    started_at: string;
    ends_at: string;
    remaining_seconds: number;
    server_time: string;
}

export interface Option {
    id: number;
    code: string;
    name?: string;
    is_active?: boolean;
}

// ---- referensi akademik berantai (dari MasterController::academicOptions) ----
export interface GradeLevelOpt {
    id: number;
    number: number;
    name: string;
    intl_label?: string | null;
}
export interface LevelOpt {
    id: number;
    code: string;
    name: string;
    grade_levels: GradeLevelOpt[];
}
export interface GradeOpt {
    id: number;
    code: string;
    name: string;
    grade_level_id: number | null;
    level_id: number | null;
    academic_year_id: number | null;
}
export interface SubjectOpt {
    id: number;
    code: string;
    name: string;
    kind: 'school' | 'subtest';
    exam_format_id: number | null;
    min_grade: number | null;
    max_grade: number | null;
    is_elective: boolean;
}
export interface CurriculumOpt {
    id: number;
    name: string;
}
export interface FormatOpt {
    id: number;
    code: string;
    name: string;
}
export interface AcademicOptions {
    levels: LevelOpt[];
    grades: GradeOpt[];
    majors: Option[];
    curricula: CurriculumOpt[];
    exam_formats: FormatOpt[];
    subjects: SubjectOpt[];
    academic_years: Option[];
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export interface ExamRow {
    id: number;
    code: string;
    name: string;
    question_bank_id: number;
    bank: string | null;
    subject: string | null;
    academic_year_id: number | null;
    exam_format_id: number | null;
    exam_format: string | null;
    level_id: number | null;
    grade_level_id: number | null;
    tingkat: string | null;
    grade_id: number | null;
    grade: string | null;
    major_id: number | null;
    major: string | null;
    session_no: number | null;
    exam_date: string;
    start_time: string;
    late_limit_time: string;
    duration_minutes: number;
    late_policy: 'full' | 'reduced';
    token: string;
    show_token: boolean;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    mc_count: number;
    essay_count: number;
    mc_weight_percent: number;
    essay_weight_percent: number;
    status: ExamStatus;
    window: ExamWindow;
    proctor_name: string | null;
    supervisor_name: string | null;
    notes: string | null;
    instructions: string | null;
    results_published_at: string | null;
    attempts_count: number;
    finished_count: number;
}
