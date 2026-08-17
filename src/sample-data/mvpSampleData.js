export const SAMPLE_BATCH_ID = '00000000-0000-4000-8000-0000000000a1';
export const SAMPLE_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
export const SAMPLE_STORAGE_BUCKETS = [
  'resident-documents',
  'secure-documents',
  'medication-photos',
  'intake-attachments',
];

export const SAMPLE_AUTH_USERS = [
  {
    key: 'owner',
    fallbackId: '00000000-0000-4000-8000-000000000f01',
    email: 'sample.owner@example.test',
    fullName: 'Sample Owner',
    role: 'owner',
  },
  {
    key: 'admin',
    fallbackId: '00000000-0000-4000-8000-000000000f02',
    email: 'sample.admin@example.test',
    fullName: 'Sample Admin',
    role: 'admin',
  },
  {
    key: 'staff',
    fallbackId: '00000000-0000-4000-8000-000000000f03',
    email: 'sample.staff@example.test',
    fullName: 'Sample Staff',
    role: 'staff',
  },
  {
    key: 'resident',
    fallbackId: '00000000-0000-4000-8000-000000000f04',
    email: 'sample.resident@example.test',
    fullName: 'Sample Resident',
    role: 'resident',
  },
];

export const MVP_FEATURE_COVERAGE = {
  organization_and_location_setup: ['organizations', 'locations'],
  staff_user_access: ['organization_members', 'staff_profiles'],
  resident_intake_and_profiles: ['residents'],
  emergency_contacts: ['resident_contacts'],
  recovery_notes_and_care_plans: ['care_plan_goals', 'care_plan_tasks'],
  medication_tracking_and_dose_logs: ['medications', 'medication_logs'],
  incident_reports_and_follow_up: ['incident_reports'],
  staff_tasks_and_handoffs: ['staff_tasks'],
  training_center_basics: ['training_modules', 'training_completions'],
  secure_documents_and_policies: ['resident_documents', 'secure_documents'],
  compliance_readiness: ['compliance_items', 'compliance_evidence'],
  occupancy_and_bed_capacity: ['bed_assignments'],
  inventory_and_supplies: ['inventory_items', 'inventory_requests'],
  owner_operator_dashboard_metrics: [
    'residents',
    'locations',
    'incident_reports',
    'medication_logs',
    'compliance_items',
    'bed_assignments',
    'inventory_items',
  ],
  future_integration_placeholders: ['integration_configs'],
};

export const insertOrder = [
  'organizations',
  'organization_members',
  'locations',
  'staff_profiles',
  'residents',
  'resident_contacts',
  'resident_documents',
  'secure_documents',
  'care_plan_goals',
  'care_plan_tasks',
  'medications',
  'medication_logs',
  'incident_reports',
  'staff_tasks',
  'training_modules',
  'training_completions',
  'compliance_items',
  'compliance_evidence',
  'inventory_items',
  'inventory_requests',
  'integration_configs',
  'location_expenses',
  'maintenance_tickets',
  'morning_reflections',
  'procurement_requests',
  'resident_fees',
  'resident_interviews',
  'resident_milestones',
  'resident_outcomes',
  'resident_payments',
  'shifts',
  'signature_requests',
  'task_logs',
  'vital_readings',
  'grants',
  'grant_enrollments',
  'chat_channels',
  'chat_messages',
  'chore_templates',
  'chore_assignments',
  'bed_assignments',
];

export const deleteOrder = [...insertOrder].reverse();

const ids = {
  locationNorth: '00000000-0000-4000-8000-000000000101',
  locationSouth: '00000000-0000-4000-8000-000000000102',
  staffOwner: '00000000-0000-4000-8000-000000000301',
  staffAdmin: '00000000-0000-4000-8000-000000000302',
  staffHouse: '00000000-0000-4000-8000-000000000303',
  residentJordan: '00000000-0000-4000-8000-000000000201',
  residentRiley: '00000000-0000-4000-8000-000000000202',
  residentMorgan: '00000000-0000-4000-8000-000000000203',
  residentCasey: '00000000-0000-4000-8000-000000000204',
  residentApplicant: '00000000-0000-4000-8000-000000000205',
  residentAlumni: '00000000-0000-4000-8000-000000000206',
  docAgreement: '00000000-0000-4000-8000-000000000401',
  docPolicy: '00000000-0000-4000-8000-000000000402',
  goalRecovery: '00000000-0000-4000-8000-000000000501',
  goalEmployment: '00000000-0000-4000-8000-000000000502',
  taskMeeting: '00000000-0000-4000-8000-000000000511',
  taskResume: '00000000-0000-4000-8000-000000000512',
  medDaily: '00000000-0000-4000-8000-000000000601',
  medMat: '00000000-0000-4000-8000-000000000602',
  trainingOrientation: '00000000-0000-4000-8000-000000000701',
  trainingMedication: '00000000-0000-4000-8000-000000000702',
  complianceNarr: '00000000-0000-4000-8000-000000000801',
  complianceMedication: '00000000-0000-4000-8000-000000000802',
  complianceEvidence: '00000000-0000-4000-8000-000000000811',
  inventoryCoffee: '00000000-0000-4000-8000-000000000901',
  inventoryNarcan: '00000000-0000-4000-8000-000000000902',
};

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function timestampOffset(days, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function sampleMeta(row, { organizationScoped = true } = {}) {
  const timestamp = timestampOffset(-7);
  return {
    ...(organizationScoped ? { organization_id: SAMPLE_ORGANIZATION_ID } : {}),
    ...row,
    is_sample_data: true,
    sample_data_batch_id: SAMPLE_BATCH_ID,
    created_at: row.created_at || timestamp,
    updated_at: row.updated_at || timestamp,
  };
}

function authId(authUserIds, key) {
  return authUserIds?.[key] || SAMPLE_AUTH_USERS.find((user) => user.key === key)?.fallbackId;
}

function residentName(id) {
  const names = {
    [ids.residentJordan]: 'Demo Jordan',
    [ids.residentRiley]: 'Demo Riley',
    [ids.residentMorgan]: 'Demo Morgan',
    [ids.residentCasey]: 'Demo Casey',
    [ids.residentApplicant]: 'Demo Applicant',
    [ids.residentAlumni]: 'Demo Alumni',
  };
  return names[id] || 'Demo Resident';
}

export function buildSampleDataset({ authUserIds = {} } = {}) {
  const ownerUserId = authId(authUserIds, 'owner');
  const adminUserId = authId(authUserIds, 'admin');
  const staffUserId = authId(authUserIds, 'staff');
  const residentUserId = authId(authUserIds, 'resident');

  const residentRows = [
    sampleMeta({
      id: ids.residentJordan,
      location_id: ids.locationNorth,
      user_id: residentUserId,
      first_name: 'Demo',
      last_name: 'Jordan',
      preferred_name: 'Jordan',
      date_of_birth: '1994-04-12',
      phone: '555-0101',
      email: 'demo.jordan@example.test',
      status: 'active',
      room: '101A',
      phase: '2',
      intake_date: dateOffset(-45),
      sober_date: dateOffset(-120),
      recovery_pathway: '12-step',
      emergency_notes: 'SAMPLE: Call primary contact first for urgent updates.',
      key_alerts: 'SAMPLE: Transportation support on appointment days.',
      recovery_notes: 'SAMPLE: Weekly peer meeting goal and evening check-in rhythm.',
      medication_notes: 'SAMPLE: Staff-observed morning dose log required.',
      consent_signed: true,
      resident_agreement_signed: true,
    }),
    sampleMeta({
      id: ids.residentRiley,
      location_id: ids.locationNorth,
      first_name: 'Demo',
      last_name: 'Riley',
      preferred_name: 'Riley',
      date_of_birth: '1988-09-20',
      phone: '555-0102',
      email: 'demo.riley@example.test',
      status: 'active',
      room: '102B',
      phase: '1',
      intake_date: dateOffset(-21),
      sober_date: dateOffset(-60),
      recovery_pathway: 'SMART',
      emergency_notes: 'SAMPLE: Backup contact is authorized for transportation updates.',
      key_alerts: 'SAMPLE: New resident, staff should review orientation tasks.',
      recovery_notes: 'SAMPLE: Building structure around work search and evening routine.',
      medication_notes: 'SAMPLE: No current medication support requested.',
      consent_signed: true,
      resident_agreement_signed: true,
    }),
    sampleMeta({
      id: ids.residentMorgan,
      location_id: ids.locationSouth,
      first_name: 'Demo',
      last_name: 'Morgan',
      preferred_name: 'Morgan',
      date_of_birth: '1991-02-03',
      phone: '555-0103',
      email: 'demo.morgan@example.test',
      status: 'active',
      room: '201A',
      phase: '3',
      intake_date: dateOffset(-90),
      sober_date: dateOffset(-210),
      recovery_pathway: 'MAT',
      emergency_notes: 'SAMPLE: Contact care coordinator for medication appointment changes.',
      key_alerts: 'SAMPLE: MAT appointment every Thursday morning.',
      recovery_notes: 'SAMPLE: Strong meeting attendance; employment planning underway.',
      medication_notes: 'SAMPLE: MAT medication tracked as staff-observed.',
      consent_signed: true,
      resident_agreement_signed: true,
    }),
    sampleMeta({
      id: ids.residentCasey,
      location_id: ids.locationSouth,
      first_name: 'Demo',
      last_name: 'Casey',
      preferred_name: 'Casey',
      date_of_birth: '1997-11-18',
      phone: '555-0104',
      email: 'demo.casey@example.test',
      status: 'active',
      room: '202B',
      phase: '1',
      intake_date: dateOffset(-10),
      exit_date: dateOffset(24),
      sober_date: dateOffset(-35),
      recovery_pathway: 'faith-based',
      emergency_notes: 'SAMPLE: Primary contact prefers email for non-urgent updates.',
      key_alerts: 'SAMPLE: Planned transition review within 30 days.',
      recovery_notes: 'SAMPLE: Needs follow-up on discharge planning tasks.',
      medication_notes: 'SAMPLE: PRN medication listed for documentation practice only.',
      consent_signed: true,
      resident_agreement_signed: false,
    }),
    sampleMeta({
      id: ids.residentApplicant,
      location_id: ids.locationNorth,
      first_name: 'Demo',
      last_name: 'Applicant',
      preferred_name: 'Applicant',
      date_of_birth: '1990-06-14',
      phone: '555-0105',
      email: 'demo.applicant@example.test',
      status: 'applicant',
      intake_date: dateOffset(9),
      recovery_pathway: '12-step',
      emergency_notes: 'SAMPLE: Intake pending final document review.',
      recovery_notes: 'SAMPLE: Applicant is a UI/UX test record only.',
      medication_notes: 'SAMPLE: Medication history pending.',
      consent_signed: false,
      resident_agreement_signed: false,
    }),
    sampleMeta({
      id: ids.residentAlumni,
      location_id: ids.locationNorth,
      first_name: 'Demo',
      last_name: 'Alumni',
      preferred_name: 'Alumni',
      date_of_birth: '1985-01-30',
      phone: '555-0106',
      email: 'demo.alumni@example.test',
      status: 'alumni',
      room: 'Former 103A',
      phase: 'completed',
      intake_date: dateOffset(-220),
      exit_date: dateOffset(-30),
      sober_date: dateOffset(-300),
      recovery_pathway: 'SMART',
      recovery_notes: 'SAMPLE: Alumni outcome and follow-up testing record.',
      medication_notes: 'SAMPLE: No active medications.',
      consent_signed: true,
      resident_agreement_signed: true,
    }),
  ];

  const tables = {
    organizations: [
      sampleMeta({
        id: SAMPLE_ORGANIZATION_ID,
        name: 'SAMPLE - Recovery Centered Living Demo',
        housing_type: 'recovery residence',
        narr_level: 'II',
        state: 'MO',
        status: 'trial',
        mission_statement: 'SAMPLE: Provide recovery-centered housing operations with dignity, structure, and accountability.',
        recovery_pathways: ['12-step', 'faith-based', 'SMART', 'MAT'],
        harm_reduction_enabled: true,
        phone: '555-0100',
        email: 'sample.clearpath@example.test',
        website: 'https://example.test/clearpath',
        house_rules: 'SAMPLE: Curfew, meeting attendance, medication documentation, and respectful shared living rules.',
      }, { organizationScoped: false }),
    ],
    organization_members: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000111',
        user_id: ownerUserId,
        role: 'owner',
        display_name: 'Sample Owner',
        email: 'sample.owner@example.test',
        status: 'active',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000112',
        user_id: adminUserId,
        role: 'admin',
        display_name: 'Sample Admin',
        email: 'sample.admin@example.test',
        status: 'active',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000113',
        user_id: staffUserId,
        role: 'staff',
        display_name: 'Sample Staff',
        email: 'sample.staff@example.test',
        status: 'active',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000114',
        user_id: residentUserId,
        role: 'resident',
        display_name: 'Sample Resident',
        email: 'sample.resident@example.test',
        status: 'active',
      }),
    ],
    locations: [
      sampleMeta({
        id: ids.locationNorth,
        name: 'SAMPLE - North House',
        address: '100 Example Recovery Way',
        city: 'Sample City',
        state: 'MO',
        zip: '64000',
        housing_type: 'Recovery Residence',
        narr_level: 'II',
        total_beds: 6,
        occupied_beds: 2,
        house_manager_id: ids.staffHouse,
        phone: '555-0110',
        status: 'active',
        certifications: ['SAMPLE NARR readiness'],
        notes: 'SAMPLE: Primary house for intake and early recovery workflow testing.',
      }),
      sampleMeta({
        id: ids.locationSouth,
        name: 'SAMPLE - South House',
        address: '200 Example Center Drive',
        city: 'Sample City',
        state: 'MO',
        zip: '64001',
        housing_type: 'Recovery Residence',
        narr_level: 'III',
        total_beds: 5,
        occupied_beds: 2,
        house_manager_id: ids.staffHouse,
        phone: '555-0111',
        status: 'active',
        certifications: ['SAMPLE state readiness'],
        notes: 'SAMPLE: Step-down location for occupancy and compliance UI testing.',
      }),
    ],
    staff_profiles: [
      sampleMeta({
        id: ids.staffOwner,
        user_id: ownerUserId,
        location_ids: [ids.locationNorth, ids.locationSouth],
        first_name: 'Sample',
        last_name: 'Owner',
        email: 'sample.owner@example.test',
        phone: '555-0120',
        role: 'owner',
        title: 'Owner / Operator',
        certifications: ['SAMPLE owner orientation'],
        hire_date: dateOffset(-365),
        status: 'active',
        lived_experience: true,
        notes: 'SAMPLE: Owner visibility record for dashboard testing.',
      }),
      sampleMeta({
        id: ids.staffAdmin,
        user_id: adminUserId,
        location_ids: [ids.locationNorth],
        first_name: 'Sample',
        last_name: 'Admin',
        email: 'sample.admin@example.test',
        phone: '555-0121',
        role: 'director',
        title: 'Program Director',
        certifications: ['SAMPLE documentation training'],
        hire_date: dateOffset(-180),
        status: 'active',
        lived_experience: false,
        notes: 'SAMPLE: Admin record for compliance and staff task testing.',
      }),
      sampleMeta({
        id: ids.staffHouse,
        user_id: staffUserId,
        location_ids: [ids.locationNorth, ids.locationSouth],
        first_name: 'Sample',
        last_name: 'Staff',
        email: 'sample.staff@example.test',
        phone: '555-0122',
        role: 'house_manager',
        title: 'House Manager',
        certifications: ['SAMPLE medication documentation'],
        hire_date: dateOffset(-90),
        status: 'active',
        lived_experience: true,
        notes: 'SAMPLE: House manager for handoff, dose log, and incident workflows.',
      }),
    ],
    residents: residentRows,
    resident_contacts: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000211',
        resident_id: ids.residentJordan,
        name: 'Sample Jordan Primary Contact',
        relationship: 'Sibling',
        phone: '555-0201',
        email: 'sample.jordan.primary@example.test',
        is_emergency_contact: true,
        notes: 'SAMPLE: Call first for urgent matters.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000212',
        resident_id: ids.residentJordan,
        name: 'Sample Jordan Backup Contact',
        relationship: 'Friend',
        phone: '555-0202',
        email: 'sample.jordan.backup@example.test',
        is_emergency_contact: true,
        notes: 'SAMPLE: Backup contact for transportation only.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000213',
        resident_id: ids.residentMorgan,
        name: 'Sample Morgan Care Coordinator',
        relationship: 'Care coordinator',
        phone: '555-0203',
        email: 'sample.morgan.care@example.test',
        is_emergency_contact: false,
        notes: 'SAMPLE: Appointment coordination example.',
      }),
    ],
    resident_documents: [
      sampleMeta({
        id: ids.docAgreement,
        resident_id: ids.residentJordan,
        location_id: ids.locationNorth,
        title: 'SAMPLE - Resident Agreement',
        document_type: 'resident_agreement',
        label: 'Signed agreement',
        storage_bucket: 'resident-documents',
        storage_path: `${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/resident-documents/resident-agreement.txt`,
        signed_at: timestampOffset(-30),
        signed_date: dateOffset(-30),
        expires_at: timestampOffset(60),
        expiry_date: dateOffset(60),
        status: 'current',
        visibility_scope: 'resident_and_staff',
        metadata: { sample: true, workflow: 'resident_documents' },
        notes: 'SAMPLE: Fake document metadata for UI testing only.',
      }),
    ],
    secure_documents: [
      sampleMeta({
        id: ids.docPolicy,
        location_id: ids.locationNorth,
        folder: 'policies',
        title: 'SAMPLE - Medication Documentation Policy',
        description: 'SAMPLE: Policy document used to test secure document lists and compliance evidence.',
        document_type: 'policy',
        storage_bucket: 'secure-documents',
        storage_path: `${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/secure-documents/medication-policy.txt`,
        file_name: 'sample-medication-policy.txt',
        file_type: 'text/plain',
        file_size_kb: 1,
        access_level: 'staff_and_admin',
        visibility_scope: 'staff_and_admin',
        uploaded_by_name: 'Sample Admin',
        uploaded_by_id: adminUserId,
        tags: ['sample', 'policy', 'medication'],
        metadata: { sample: true, workflow: 'secure_documents' },
      }),
    ],
    care_plan_goals: [
      sampleMeta({
        id: ids.goalRecovery,
        resident_id: ids.residentJordan,
        term: 'short_term',
        category: 'Recovery Routine',
        title: 'SAMPLE - Attend three recovery meetings this week',
        description: 'SAMPLE: Build consistent meeting attendance and document barriers.',
        target_date: dateOffset(7),
        status: 'in_progress',
        progress_notes: 'SAMPLE: Two meetings completed; one planned.',
      }),
      sampleMeta({
        id: ids.goalEmployment,
        resident_id: ids.residentMorgan,
        term: 'long_term',
        category: 'Employment',
        title: 'SAMPLE - Complete job readiness plan',
        description: 'SAMPLE: Draft resume and identify three applications.',
        target_date: dateOffset(30),
        status: 'not_started',
        progress_notes: 'SAMPLE: Assigned to case manager.',
      }),
    ],
    care_plan_tasks: [
      sampleMeta({
        id: ids.taskMeeting,
        resident_id: ids.residentJordan,
        goal_id: ids.goalRecovery,
        title: 'SAMPLE - Log weekly meeting attendance',
        description: 'SAMPLE: Staff should verify meeting plan and document attendance.',
        recurrence: 'weekly',
        due_date: dateOffset(3),
        assigned_to_id: staffUserId,
        assigned_to_name: 'Sample Staff',
        status: 'pending',
        notes: 'SAMPLE: Handoff item for evening staff.',
      }),
      sampleMeta({
        id: ids.taskResume,
        resident_id: ids.residentMorgan,
        goal_id: ids.goalEmployment,
        title: 'SAMPLE - Draft resume',
        description: 'SAMPLE: Resident and staff prepare a starter resume.',
        recurrence: 'once',
        due_date: dateOffset(10),
        assigned_to_id: adminUserId,
        assigned_to_name: 'Sample Admin',
        status: 'pending',
        notes: 'SAMPLE: Supports employment goal testing.',
      }),
    ],
    medications: [
      sampleMeta({
        id: ids.medDaily,
        resident_id: ids.residentJordan,
        medication_name: 'SAMPLE - Morning Support Medication',
        name: 'SAMPLE - Morning Support Medication',
        generic_name: 'sample-only',
        dosage: '10 mg',
        schedule: 'Every morning with breakfast',
        form: 'tablet',
        route: 'oral',
        frequency: 'once_daily',
        scheduled_times: ['08:00'],
        prescribing_provider: 'Sample Provider',
        prescriber: 'Sample Provider',
        pharmacy: 'Sample Pharmacy',
        rx_number: 'SAMPLE-RX-001',
        instructions: 'SAMPLE: Observe dose and record outcome.',
        start_date: dateOffset(-20),
        status: 'active',
        bottle_photo_path: `${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/medication-photos/morning-support.png`,
        qr_code: 'SAMPLE-MED-001',
        controlled_substance: false,
        mat_medication: false,
        current_quantity: 18,
        low_stock_threshold: 7,
        reorder_quantity: 30,
        notes: 'SAMPLE: Medication record for UI/UX testing only.',
      }),
      sampleMeta({
        id: ids.medMat,
        resident_id: ids.residentMorgan,
        medication_name: 'SAMPLE - MAT Appointment Medication',
        name: 'SAMPLE - MAT Appointment Medication',
        generic_name: 'sample-mat-only',
        dosage: '8 mg',
        schedule: 'Daily staff-observed dose',
        form: 'film',
        route: 'sublingual',
        frequency: 'once_daily',
        scheduled_times: ['09:00'],
        prescribing_provider: 'Sample MAT Clinic',
        prescriber: 'Sample MAT Clinic',
        pharmacy: 'Sample Pharmacy',
        rx_number: 'SAMPLE-RX-002',
        instructions: 'SAMPLE: MAT flag enabled for workflow testing.',
        start_date: dateOffset(-60),
        status: 'active',
        bottle_photo_path: `${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/medication-photos/mat-medication.png`,
        qr_code: 'SAMPLE-MED-002',
        controlled_substance: true,
        mat_medication: true,
        current_quantity: 5,
        low_stock_threshold: 6,
        reorder_quantity: 14,
        notes: 'SAMPLE: Low stock MAT example for dashboard and inventory prompts.',
      }),
    ],
    medication_logs: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000611',
        resident_id: ids.residentJordan,
        medication_id: ids.medDaily,
        scheduled_at: timestampOffset(0, 8),
        scheduled_date: dateOffset(0),
        scheduled_time: '08:00',
        administered_at: timestampOffset(0, 8),
        administered_by: staffUserId,
        administered_by_name: 'Sample Staff',
        status: 'administered',
        outcome: 'observed',
        notes: 'SAMPLE: Dose administered during breakfast check.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000612',
        resident_id: ids.residentMorgan,
        medication_id: ids.medMat,
        scheduled_at: timestampOffset(-1, 9),
        scheduled_date: dateOffset(-1),
        scheduled_time: '09:00',
        administered_at: null,
        administered_by_name: 'Sample Staff',
        status: 'missed',
        outcome: 'follow_up_required',
        missed_reason: 'SAMPLE: Resident was at outside appointment.',
        notes: 'SAMPLE: Follow-up documented for missed dose workflow.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000613',
        resident_id: ids.residentJordan,
        medication_id: ids.medDaily,
        scheduled_at: timestampOffset(1, 8),
        scheduled_date: dateOffset(1),
        scheduled_time: '08:00',
        administered_by_name: 'Sample Staff',
        status: 'held',
        outcome: 'provider_instruction',
        notes: 'SAMPLE: Held status example for QA testing.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000614',
        resident_id: ids.residentMorgan,
        medication_id: ids.medMat,
        scheduled_at: timestampOffset(2, 9),
        scheduled_date: dateOffset(2),
        scheduled_time: '09:00',
        administered_by_name: 'Sample Staff',
        status: 'refused',
        outcome: 'resident_refused',
        missed_reason: 'SAMPLE: Resident refused sample dose.',
        notes: 'SAMPLE: Refusal status example for QA testing.',
      }),
    ],
    incident_reports: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000621',
        resident_id: ids.residentRiley,
        location_id: ids.locationNorth,
        reported_by: staffUserId,
        reported_by_id: staffUserId,
        category: 'house_rule',
        type: 'curfew',
        severity: 'medium',
        incident_date: dateOffset(-2),
        incident_time: '22:45',
        description: 'SAMPLE: Resident returned after curfew and staff documented immediate check-in.',
        people_involved: 'Sample Staff; Demo Riley',
        involved_staff_names: 'Sample Staff',
        immediate_action: 'SAMPLE: Staff completed safety check and documented next-day follow-up.',
        action_taken: 'SAMPLE: Reminder of house expectations and recovery support check.',
        follow_up_required: true,
        follow_up_notes: 'SAMPLE: House manager to review routine plan.',
        status: 'open',
        confidential: true,
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000622',
        resident_id: null,
        location_id: ids.locationSouth,
        reported_by: adminUserId,
        reported_by_id: adminUserId,
        category: 'facility',
        type: 'maintenance_safety',
        severity: 'low',
        incident_date: dateOffset(-6),
        incident_time: '14:15',
        description: 'SAMPLE: Loose stair tread noted during walkthrough.',
        people_involved: 'Sample Admin',
        involved_staff_names: 'Sample Admin',
        immediate_action: 'SAMPLE: Area marked and maintenance task created.',
        action_taken: 'SAMPLE: Repair completed.',
        follow_up_required: false,
        follow_up_notes: 'SAMPLE: Closed after verification.',
        status: 'closed',
        confidential: false,
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000623',
        resident_id: ids.residentMorgan,
        location_id: ids.locationSouth,
        reported_by: adminUserId,
        reported_by_id: adminUserId,
        category: 'medication',
        type: 'missed_mat_follow_up',
        severity: 'high',
        incident_date: dateOffset(-1),
        incident_time: '09:20',
        description: 'SAMPLE: Missed MAT-related appointment required same-day supervisor review.',
        people_involved: 'Sample Admin; Demo Morgan',
        involved_staff_names: 'Sample Admin',
        immediate_action: 'SAMPLE: Staff contacted provider and documented resident check-in.',
        action_taken: 'SAMPLE: Follow-up plan opened and care-plan task assigned.',
        follow_up_required: true,
        follow_up_notes: 'SAMPLE: Confirm provider follow-up and update medication notes.',
        status: 'open',
        confidential: true,
      }),
    ],
    staff_tasks: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000631',
        location_id: ids.locationNorth,
        resident_id: ids.residentRiley,
        title: 'SAMPLE - Evening handoff: follow up after curfew incident',
        description: 'SAMPLE: Ask what got in the way, review support plan, and document next step.',
        assigned_to: staffUserId,
        assigned_to_name: 'Sample Staff',
        due_at: timestampOffset(1, 18),
        status: 'pending',
        priority: 'high',
        handoff_notes: 'SAMPLE: Include recovery-support tone, not punitive language.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000632',
        location_id: ids.locationSouth,
        resident_id: ids.residentCasey,
        title: 'SAMPLE - Transition planning check',
        description: 'SAMPLE: Confirm move-out plan and document any follow-up needs.',
        assigned_to: adminUserId,
        assigned_to_name: 'Sample Admin',
        due_at: timestampOffset(-1, 15),
        status: 'in_progress',
        priority: 'medium',
        handoff_notes: 'SAMPLE: Overdue item for dashboard testing.',
      }),
    ],
    training_modules: [
      sampleMeta({
        id: ids.trainingOrientation,
        title: 'SAMPLE - Staff Orientation Basics',
        description: 'SAMPLE: Core expectations for documentation, handoffs, and resident dignity.',
        category: 'onboarding',
        content_type: 'slides',
        slides: [
          { title: 'Welcome', body: 'SAMPLE: ClearPath is used for daily recovery-housing operations.' },
          { title: 'Document clearly', body: 'SAMPLE: Write what happened, who was involved, and next steps.' },
        ],
        required_for_roles: ['staff', 'house_manager'],
        estimated_minutes: 12,
        status: 'published',
      }),
      sampleMeta({
        id: ids.trainingMedication,
        title: 'SAMPLE - Medication Log Workflow',
        description: 'SAMPLE: Practice documenting administered, missed, held, and refused doses.',
        category: 'medication_management',
        content_type: 'slides',
        slides: [
          { title: 'Dose outcomes', body: 'SAMPLE: Pick the actual outcome and add context.' },
          { title: 'Follow-up', body: 'SAMPLE: Missed/refused doses should have a clear next step.' },
        ],
        required_for_roles: ['staff', 'house_manager'],
        estimated_minutes: 15,
        status: 'published',
      }),
    ],
    training_completions: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000711',
        module_id: ids.trainingOrientation,
        staff_id: ids.staffHouse,
        completed_date: dateOffset(-12),
        score: 96,
        notes: 'SAMPLE: Completed during onboarding.',
      }),
    ],
    compliance_items: [
      sampleMeta({
        id: ids.complianceNarr,
        location_id: ids.locationNorth,
        standard_source: 'NARR',
        domain: 'Operations',
        requirement_code: 'SAMPLE-NARR-OPS-01',
        requirement_text: 'SAMPLE: Maintain written resident agreement and house expectations.',
        rule_id: 'sample-narr-ops-01',
        rule_name: 'SAMPLE - Resident agreement readiness',
        status: 'compliant',
        evidence_notes: 'SAMPLE: Linked agreement and policy evidence.',
        document_url: `${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/secure-documents/medication-policy.txt`,
        due_date: dateOffset(45),
        assigned_to: adminUserId,
        last_reviewed: dateOffset(-5),
        reviewed_by_id: adminUserId,
      }),
      sampleMeta({
        id: ids.complianceMedication,
        location_id: ids.locationSouth,
        standard_source: 'internal',
        domain: 'Medication Documentation',
        requirement_code: 'SAMPLE-MED-01',
        requirement_text: 'SAMPLE: Missed, refused, held, and administered doses are documented.',
        rule_id: 'sample-med-01',
        rule_name: 'SAMPLE - Medication log completeness',
        status: 'in_progress',
        evidence_notes: 'SAMPLE: Needs second reviewer before certification readiness.',
        due_date: dateOffset(14),
        assigned_to: staffUserId,
        last_reviewed: dateOffset(-2),
        reviewed_by_id: staffUserId,
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000813',
        location_id: ids.locationSouth,
        standard_source: 'state',
        domain: 'Physical Environment',
        requirement_code: 'SAMPLE-GAP-01',
        requirement_text: 'SAMPLE: Fire drill documentation is reviewed and kept current.',
        rule_id: 'sample-gap-01',
        rule_name: 'SAMPLE - Overdue fire drill documentation',
        status: 'not_met',
        evidence_notes: 'SAMPLE: Gap item for compliance readiness testing.',
        due_date: dateOffset(-3),
        assigned_to: adminUserId,
        last_reviewed: dateOffset(-10),
        reviewed_by_id: adminUserId,
      }),
    ],
    compliance_evidence: [
      sampleMeta({
        id: ids.complianceEvidence,
        compliance_item_id: ids.complianceNarr,
        secure_document_id: ids.docPolicy,
        notes: 'SAMPLE: Policy document supports readiness review.',
      }),
    ],
    inventory_items: [
      sampleMeta({
        id: ids.inventoryCoffee,
        location_id: ids.locationNorth,
        name: 'SAMPLE - Coffee filters',
        category: 'kitchen',
        unit: 'packs',
        current_quantity: 3,
        low_stock_threshold: 2,
        reorder_quantity: 10,
        status: 'in_stock',
        notes: 'SAMPLE: Normal stock item.',
      }),
      sampleMeta({
        id: ids.inventoryNarcan,
        location_id: ids.locationSouth,
        name: 'SAMPLE - Naloxone kits',
        category: 'safety',
        unit: 'kits',
        current_quantity: 1,
        low_stock_threshold: 3,
        reorder_quantity: 8,
        status: 'low_stock',
        notes: 'SAMPLE: Low-stock safety item for alert testing.',
      }),
    ],
    inventory_requests: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000911',
        location_id: ids.locationSouth,
        item_id: ids.inventoryNarcan,
        item_name: 'SAMPLE - Naloxone kits',
        category: 'safety',
        requested_by_name: 'Sample Staff',
        requested_by_id: staffUserId,
        quantity_requested: 8,
        urgency: 'high',
        notes: 'SAMPLE: Reorder low-stock safety supply.',
        status: 'pending',
        staff_notes: 'SAMPLE: Awaiting admin approval.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000912',
        location_id: ids.locationNorth,
        item_id: ids.inventoryCoffee,
        item_name: 'SAMPLE - Coffee filters',
        category: 'kitchen',
        requested_by_name: 'Sample House Manager',
        requested_by_id: adminUserId,
        quantity_requested: 4,
        urgency: 'low',
        notes: 'SAMPLE: Routine supply request completed for request-status testing.',
        status: 'fulfilled',
        staff_notes: 'SAMPLE: Purchased and restocked.',
      }),
    ],
    integration_configs: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000921',
        integration_name: 'SAMPLE - QuickBooks Planning Placeholder',
        integration_type: 'accounting',
        status: 'disconnected',
        config_notes: 'SAMPLE: Placeholder only. No live QuickBooks connection is configured.',
        metadata: { sample: true, futureOnly: true },
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000922',
        integration_name: 'SAMPLE - SMS Planning Placeholder',
        integration_type: 'sms',
        status: 'disconnected',
        config_notes: 'SAMPLE: Placeholder only. Consent, policies, and templates required before activation.',
        metadata: { sample: true, futureOnly: true },
      }),
    ],
    bed_assignments: [
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000931',
        location_id: ids.locationNorth,
        resident_id: ids.residentJordan,
        bed_label: '101A',
        room: '101',
        bed_number: 'A',
        status: 'occupied',
        assigned_at: timestampOffset(-45),
        notes: 'SAMPLE: Current occupied bed.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000932',
        location_id: ids.locationNorth,
        resident_id: ids.residentRiley,
        bed_label: '102B',
        room: '102',
        bed_number: 'B',
        status: 'occupied',
        assigned_at: timestampOffset(-21),
        notes: 'SAMPLE: Current occupied bed.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000933',
        location_id: ids.locationNorth,
        resident_id: null,
        bed_label: '103A',
        room: '103',
        bed_number: 'A',
        status: 'available',
        notes: 'SAMPLE: Open bed for applicant assignment testing.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000934',
        location_id: ids.locationSouth,
        resident_id: ids.residentMorgan,
        bed_label: '201A',
        room: '201',
        bed_number: 'A',
        status: 'occupied',
        assigned_at: timestampOffset(-90),
        notes: 'SAMPLE: Current occupied bed.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000935',
        location_id: ids.locationSouth,
        resident_id: ids.residentCasey,
        bed_label: '202B',
        room: '202',
        bed_number: 'B',
        status: 'reserved',
        assigned_at: timestampOffset(-10),
        expected_move_out_date: dateOffset(24),
        notes: 'SAMPLE: Upcoming move-out placeholder for occupancy UI testing.',
      }),
      sampleMeta({
        id: '00000000-0000-4000-8000-000000000936',
        location_id: ids.locationSouth,
        resident_id: null,
        bed_label: '203A',
        room: '203',
        bed_number: 'A',
        status: 'available',
        notes: 'SAMPLE: Open bed for applicant assignment testing.',
      }),
    ],
  };

  for (const table of insertOrder) {
    if (!tables[table]) tables[table] = [];
  }

  return {
    batch: {
      id: SAMPLE_BATCH_ID,
      organization_id: SAMPLE_ORGANIZATION_ID,
      label: 'ClearPath MVP E2E Sample Dataset',
      description: 'Fake sample data for ClearPath MVP UI/UX testing. Remove before compliance certification.',
      created_by_tool: 'scripts/sample-data/seed.mjs',
    },
    authUsers: SAMPLE_AUTH_USERS,
    tables,
  };
}

export function createStorageObjectPlan(dataset = buildSampleDataset()) {
  const storageRows = [
    ...dataset.tables.resident_documents,
    ...dataset.tables.secure_documents,
    ...dataset.tables.medications,
  ];

  const objects = storageRows
    .map((row) => {
      const bucket = row.storage_bucket || (row.bottle_photo_path ? 'medication-photos' : null);
      const path = row.storage_path || row.bottle_photo_path;
      if (!bucket || !path) return null;
      const isMedicationPhoto = bucket === 'medication-photos';
      return {
        bucket,
        path,
        contentType: isMedicationPhoto ? 'image/png' : 'text/plain',
        body: isMedicationPhoto
          ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
          : `SAMPLE FILE ONLY\nBatch: ${dataset.batch.id}\nPath: ${path}\n`,
        encoding: isMedicationPhoto ? 'base64' : 'utf8',
      };
    })
    .filter(Boolean);

  objects.push({
    bucket: 'intake-attachments',
    path: `${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/intake-attachments/sample-intake-note.txt`,
    contentType: 'text/plain',
    body: `SAMPLE FILE ONLY\nBatch: ${dataset.batch.id}\nWorkflow: intake attachment\n`,
    encoding: 'utf8',
  });

  return objects;
}

export function validateDatasetShape(dataset = buildSampleDataset()) {
  const errors = [];
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const hasValue = (table, field, value) => dataset.tables[table]?.some((row) => row[field] === value);

  for (const [feature, tables] of Object.entries(MVP_FEATURE_COVERAGE)) {
    if (tables.length === 0) {
      errors.push(`${feature} does not name any tables.`);
    }
    for (const table of tables) {
      if (!dataset.tables[table]?.length) {
        errors.push(`${feature} has no sample rows in ${table}.`);
      }
    }
  }

  for (const table of insertOrder) {
    if (!Array.isArray(dataset.tables[table])) {
      errors.push(`${table} is missing from the sample dataset.`);
      continue;
    }

    for (const row of dataset.tables[table]) {
      if (row.is_sample_data !== true) errors.push(`${table}.${row.id} is not tagged as sample data.`);
      if (row.sample_data_batch_id !== dataset.batch.id) errors.push(`${table}.${row.id} has the wrong batch id.`);
      if (table !== 'organizations' && row.organization_id !== dataset.batch.organization_id) {
        errors.push(`${table}.${row.id} is not scoped to the sample organization.`);
      }

      const serialized = JSON.stringify(row);
      for (const email of serialized.match(emailPattern) || []) {
        if (!email.endsWith('@example.test')) {
          errors.push(`${table}.${row.id} contains a non-sample email: ${email}`);
        }
      }
    }
  }

  for (const object of createStorageObjectPlan(dataset)) {
    if (!object.path.startsWith(`${dataset.batch.organization_id}/sample/${dataset.batch.id}/`)) {
      errors.push(`${object.bucket}/${object.path} is outside the removable sample prefix.`);
    }
  }

  for (const status of ['administered', 'missed', 'refused', 'held']) {
    if (!hasValue('medication_logs', 'status', status)) errors.push(`Medication workflow is missing a ${status} dose log.`);
  }

  for (const severity of ['low', 'medium', 'high']) {
    if (!hasValue('incident_reports', 'severity', severity)) errors.push(`Incident workflow is missing ${severity} severity.`);
  }

  for (const status of ['compliant', 'in_progress', 'not_met']) {
    if (!hasValue('compliance_items', 'status', status)) errors.push(`Compliance workflow is missing ${status} status.`);
  }

  for (const status of ['occupied', 'available', 'reserved']) {
    if (!hasValue('bed_assignments', 'status', status)) errors.push(`Bed capacity workflow is missing ${status} bed assignment.`);
  }

  for (const status of ['pending', 'fulfilled']) {
    if (!hasValue('inventory_requests', 'status', status)) errors.push(`Inventory workflow is missing ${status} request.`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
