import { NativeSelect } from '@/components/tremor/NativeSelect';
import { Field } from '@/components/unbk/field';
import { type GradeOpt, type LevelOpt } from '@/types/unbk';
import { useMemo } from 'react';

export interface AcademicValue {
    level_id: string;
    grade_level_id: string;
    grade_id: string;
}

interface Props {
    levels: LevelOpt[];
    grades?: GradeOpt[];
    value: AcademicValue;
    onChange: (next: AcademicValue) => void;
    errors?: { level_id?: string; grade_level_id?: string; grade_id?: string };
    /** tampilkan pilihan rombel (butuh `grades`) */
    withGrade?: boolean;
    /** izinkan tingkat kosong = "semua tingkat" */
    allowAllLevels?: boolean;
    /** batasi rombel ke tahun ajaran tertentu */
    academicYearId?: number | null;
    className?: string;
}

/**
 * Pilihan berantai: Jenjang -> Tingkat -> Rombel.
 * Mengubah jenjang mengosongkan tingkat dan rombel; mengubah tingkat mengosongkan rombel.
 */
export function AcademicSelect({ levels, grades = [], value, onChange, errors = {}, withGrade = false, allowAllLevels = false, academicYearId, className = '' }: Props) {
    const level = useMemo(() => levels.find((l) => String(l.id) === value.level_id), [levels, value.level_id]);
    const gradeLevels = level?.grade_levels ?? [];
    const rombels = useMemo(
        () => grades.filter((g) => String(g.grade_level_id) === value.grade_level_id && (!academicYearId || g.academic_year_id === academicYearId)),
        [grades, value.grade_level_id, academicYearId],
    );

    return (
        <div className={`grid gap-4 ${withGrade ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} ${className}`}>
            <Field label="Jenjang" error={errors.level_id}>
                <NativeSelect value={value.level_id} onChange={(e) => onChange({ level_id: e.target.value, grade_level_id: '', grade_id: '' })} hasError={!!errors.level_id}>
                    <option value="">{allowAllLevels ? 'Semua jenjang' : 'Pilih jenjang…'}</option>
                    {levels.map((l) => (
                        <option key={l.id} value={l.id}>
                            {l.code} · {l.name}
                        </option>
                    ))}
                </NativeSelect>
            </Field>
            <Field label="Tingkat" error={errors.grade_level_id}>
                <NativeSelect value={value.grade_level_id} disabled={!level} onChange={(e) => onChange({ ...value, grade_level_id: e.target.value, grade_id: '' })} hasError={!!errors.grade_level_id}>
                    <option value="">{!level ? 'Pilih jenjang dulu' : allowAllLevels ? 'Semua tingkat' : 'Pilih tingkat…'}</option>
                    {gradeLevels.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name}
                        </option>
                    ))}
                </NativeSelect>
            </Field>
            {withGrade && (
                <Field label="Rombel" error={errors.grade_id} hint={value.grade_level_id && rombels.length === 0 ? 'Belum ada rombel di tingkat ini' : undefined}>
                    <NativeSelect value={value.grade_id} disabled={!value.grade_level_id} onChange={(e) => onChange({ ...value, grade_id: e.target.value })} hasError={!!errors.grade_id}>
                        <option value="">{!value.grade_level_id ? 'Pilih tingkat dulu' : 'Semua rombel / tanpa rombel'}</option>
                        {rombels.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.code} · {g.name}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>
            )}
        </div>
    );
}

/** Nilai awal AcademicValue dari id tingkat (mencari jenjangnya). */
export function academicValueFrom(levels: LevelOpt[], gradeLevelId: number | null | undefined, gradeId: number | null | undefined): AcademicValue {
    const level = levels.find((l) => l.grade_levels.some((g) => g.id === gradeLevelId));
    return {
        level_id: level ? String(level.id) : '',
        grade_level_id: gradeLevelId ? String(gradeLevelId) : '',
        grade_id: gradeId ? String(gradeId) : '',
    };
}

/** Nomor tingkat (1–12) dari id tingkat. */
export function gradeNumberOf(levels: LevelOpt[], gradeLevelId: string | number | null | undefined): number | null {
    for (const l of levels) {
        const g = l.grade_levels.find((x) => String(x.id) === String(gradeLevelId));
        if (g) return g.number;
    }
    return null;
}
