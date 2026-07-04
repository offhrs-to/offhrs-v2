export type WorkshopDescriptionSectionKey = 'experience' | 'materials_takeaway' | 'skill_level'

export type WorkshopDescriptionFields = {
  description?: string | null
  workshop_experience?: string | null
  workshop_experience_hidden?: boolean | null
  workshop_materials_takeaway?: string | null
  workshop_materials_takeaway_hidden?: boolean | null
  workshop_skill_level?: string | null
  workshop_skill_level_hidden?: boolean | null
}

export const WORKSHOP_DESCRIPTION_SECTIONS: ReadonlyArray<{
  key: WorkshopDescriptionSectionKey
  title: string
  contentField: keyof WorkshopDescriptionFields
  hiddenField: keyof WorkshopDescriptionFields
  placeholder: string
}> = [
  {
    key: 'experience',
    title: 'The Experience',
    contentField: 'workshop_experience',
    hiddenField: 'workshop_experience_hidden',
    placeholder:
      'Describe step-by-step flow of the workshop and the experience customers can expect through the workshop',
  },
  {
    key: 'materials_takeaway',
    title: 'Materials & Takeaway',
    contentField: 'workshop_materials_takeaway',
    hiddenField: 'workshop_materials_takeaway_hidden',
    placeholder: 'List exactly what is provided and what the customers walk away with',
  },
  {
    key: 'skill_level',
    title: 'Skill Level',
    contentField: 'workshop_skill_level',
    hiddenField: 'workshop_skill_level_hidden',
    placeholder: 'Specify if the class requires prior knowledge',
  },
]

export function visibleWorkshopDescriptionSections(
  fields: WorkshopDescriptionFields
): Array<{ title: string; body: string }> {
  return WORKSHOP_DESCRIPTION_SECTIONS.flatMap((section) => {
    const hidden = Boolean(fields[section.hiddenField])
    const body = String(fields[section.contentField] ?? '').trim()
    if (hidden || !body) return []
    return [{ title: section.title, body }]
  })
}
