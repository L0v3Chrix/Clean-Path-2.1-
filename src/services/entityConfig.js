export const entityConfigs = {
  CarePlanGoal: { table: 'care_plan_goals', bucket: null },
  CarePlanTask: { table: 'care_plan_tasks', bucket: null },
  ChatChannel: { table: 'chat_channels', bucket: null },
  ChatMessage: { table: 'chat_messages', bucket: null },
  ChoreAssignment: { table: 'chore_assignments', bucket: null },
  ChoreTemplate: { table: 'chore_templates', bucket: null },
  ComplianceEvidence: { table: 'compliance_evidence', bucket: 'secure-documents' },
  Grant: { table: 'grants', bucket: null },
  GrantEnrollment: { table: 'grant_enrollments', bucket: null },
  HipaaAuditLog: { table: 'audit_logs', bucket: null },
  HouseInventoryItem: { table: 'inventory_items', bucket: null },
  IncidentReport: { table: 'incident_reports', bucket: null },
  IntegrationConfig: { table: 'integration_configs', bucket: null },
  InventoryRequest: { table: 'inventory_requests', bucket: null },
  Location: { table: 'locations', bucket: null },
  LocationExpense: { table: 'location_expenses', bucket: null },
  MaintenanceTicket: { table: 'maintenance_tickets', bucket: 'secure-documents' },
  Medication: { table: 'medications', bucket: 'medication-photos' },
  MedicationLog: { table: 'medication_logs', bucket: null },
  MorningReflection: { table: 'morning_reflections', bucket: null },
  NarrCompliance: { table: 'compliance_items', bucket: null },
  Organization: { table: 'organizations', bucket: null },
  OrganizationMember: { table: 'organization_members', bucket: null },
  BedAssignment: { table: 'bed_assignments', bucket: null },
  ProcurementRequest: { table: 'procurement_requests', bucket: null },
  Resident: { table: 'residents', bucket: 'intake-attachments' },
  ResidentContact: { table: 'resident_contacts', bucket: null },
  ResidentDocument: { table: 'resident_documents', bucket: 'resident-documents' },
  ResidentFee: { table: 'resident_fees', bucket: null },
  ResidentInterview: { table: 'resident_interviews', bucket: null },
  ResidentMilestone: { table: 'resident_milestones', bucket: null },
  ResidentOutcome: { table: 'resident_outcomes', bucket: null },
  ResidentPayment: { table: 'resident_payments', bucket: null },
  SecureDocument: { table: 'secure_documents', bucket: 'secure-documents' },
  Shift: { table: 'shifts', bucket: null },
  SignatureRequest: { table: 'signature_requests', bucket: 'resident-documents' },
  StaffMember: { table: 'staff_profiles', bucket: null },
  StaffTask: { table: 'staff_tasks', bucket: null },
  TaskLog: { table: 'task_logs', bucket: null },
  TrainingCompletion: { table: 'training_completions', bucket: null },
  TrainingModule: { table: 'training_modules', bucket: 'secure-documents' },
  VitalReading: { table: 'vital_readings', bucket: null },
};

export function getEntityConfig(entityName) {
  const config = entityConfigs[entityName];
  if (!config) {
    throw new Error(`Unknown entity: ${entityName}`);
  }
  return {
    ...config,
    schema: {
      name: entityName,
      table: config.table,
      storageBucket: config.bucket,
    },
  };
}
