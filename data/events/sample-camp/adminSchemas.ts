// Fields only organizers see and fill in: { key: { data: JSON Schema, ui } }

export const camper_admin_schema = {
  badge_name: {
    data: { type: 'string', title: 'Name for badge', maxLength: 20 },
  },
  staff_notes: {
    data: { type: 'string', title: 'Staff notes', maxLength: 500 },
    ui: { 'ui:widget': 'textarea' },
  },
};

export const registration_admin_schema = {
  checked_in: {
    data: { type: 'boolean', title: 'Checked in' },
  },
  scholarship: {
    data: { type: 'integer', minimum: 0, title: 'Scholarship awarded (dollars)' },
  },
};
