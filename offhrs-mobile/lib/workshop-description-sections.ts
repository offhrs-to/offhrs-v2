export type WorkshopDescriptionFields = {
  description?: string | null;
  workshop_experience?: string | null;
  workshop_experience_hidden?: boolean | null;
  workshop_materials_takeaway?: string | null;
  workshop_materials_takeaway_hidden?: boolean | null;
  workshop_skill_level?: string | null;
  workshop_skill_level_hidden?: boolean | null;
};

const SECTIONS = [
  {
    title: 'The Experience',
    contentField: 'workshop_experience' as const,
    hiddenField: 'workshop_experience_hidden' as const,
  },
  {
    title: 'Materials & Takeaway',
    contentField: 'workshop_materials_takeaway' as const,
    hiddenField: 'workshop_materials_takeaway_hidden' as const,
  },
  {
    title: 'Skill Level',
    contentField: 'workshop_skill_level' as const,
    hiddenField: 'workshop_skill_level_hidden' as const,
  },
] as const;

export function visibleWorkshopDescriptionSections(
  fields: WorkshopDescriptionFields
): Array<{ title: string; body: string }> {
  return SECTIONS.flatMap((section) => {
    const hidden = Boolean(fields[section.hiddenField]);
    const body = String(fields[section.contentField] ?? '').trim();
    if (hidden || !body) return [];
    return [{ title: section.title, body }];
  });
}
